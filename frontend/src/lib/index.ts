// place files you want to import through the `$lib` alias in this folder.

// should reflect

let pc: RTCPeerConnection;

export async function ReflectStream(localStream: MediaStream): Promise<MediaStream> {
    pc = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.cloudflare.com:3478",
            }
        ],
        bundlePolicy: "max-bundle",
    });

    let sendOnlyTransceivers = localStream.getTracks().map(track => {
        return pc.addTransceiver(track, {
            direction: "sendonly"
        });
    });

    let offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    let newSessionResponse = await fetch("http://localhost:8088/newSession", {
        method: "POST",
        body: JSON.stringify({
            sessionDescription: offer
        })
    });

    let newSession = await newSessionResponse.json() as {
        sessionId: string;
        sessionDescription: RTCSessionDescriptionInit;
    }

    await pc.setRemoteDescription(newSession.sessionDescription);

    await new Promise<void>((resolve, reject) => {
        pc.addEventListener("iceconnectionstatechange", (ev) => {
            if (pc.iceConnectionState === "connected") {
                resolve();
            }
        });
        setTimeout(reject, 5000, "timeout");
    });

    const trackObjects = sendOnlyTransceivers.map(transceiver => {
        return {
            location: "local",
            mid: transceiver.mid,
            trackName: transceiver.sender.track?.id,
        }
    });

    let offer2 = await pc.createOffer();
    await pc.setLocalDescription(offer2);

    const newLocalTracksResult = await fetch("http://localhost:8088/newTrack", {
        method: "POST",
        body: JSON.stringify({
            sessionDescription: offer2,
            sessionId: newSession.sessionId,
            tracks: trackObjects
        })
    });

    type NewLocalTracksResponse = {
        requiresImmediateRenegotiation: boolean;
        sessionDescription: RTCSessionDescriptionInit;
        tracks: Array<{
            mid: string;
            trackName: string;
        }>
    }

    let data = await newLocalTracksResult.json() as NewLocalTracksResponse;
    await pc.setRemoteDescription(data.sessionDescription);

    let remoteTrackObjects = trackObjects.map(trackObject => {
        return {
            location: "remote",
            sessionId: newSession.sessionId,
            trackName: trackObject.trackName,
        }
    });

    const remoteTracksPromise = new Promise<MediaStreamTrack[]>((resolve, reject) => {
        let tracks: MediaStreamTrack[] = [];
        pc.ontrack = (ev) => {
            tracks.push(ev.track);
            if (tracks.length === trackObjects.length) {
                resolve(tracks);
            }
        };
    });

    const newRemoteTracksResult = await fetch("http://localhost:8088/newTrack", {
        method: "POST",
        body: JSON.stringify({
            sessionId: newSession.sessionId,
            tracks: remoteTrackObjects
        })
    });

    let remoteTracks = await newRemoteTracksResult.json() as NewLocalTracksResponse;

    if (remoteTracks.requiresImmediateRenegotiation && remoteTracks.sessionDescription.type === "offer") {
        await pc.setRemoteDescription(remoteTracks.sessionDescription);
        let answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        let resp = await fetch("http://localhost:8088/renegotiate", {
            method: "POST",
            body: JSON.stringify({
                sessionId: newSession.sessionId,
                sessionDescription: answer
            })
        });

        console.log(await resp.json());
    }

    const remoteT = await remoteTracksPromise;
    const remoteStream = new MediaStream(remoteT);

    return remoteStream;
}