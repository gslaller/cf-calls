type ObjectToBePassed = {
    sessionId: string;
    trackId: string;
}[];

let pcSend: RTCPeerConnection;
let pcReceive: RTCPeerConnection;

type NewSessionResponse = {
    sessionId: string;
    sessionDescription: RTCSessionDescriptionInit;
};

async function newSession(offfer: RTCSessionDescriptionInit): Promise<NewSessionResponse> {
    let newSessionResponse = await fetch("http://localhost:8088/newSession", {
        method: "POST",
        body: JSON.stringify({
            sessionDescription: offfer
        })
    });

    return newSessionResponse.json();
}

type NewTrackPayload = {
    sessionDescription: RTCSessionDescriptionInit;
    tracks: {
        location: "local";
        mid: string;
        trackName: string;
    }[];
} | {
    tracks: {
        location: "remote";
        sessionId: string;
        trackName: string;
    }[];
};

type NewTrackResponse = {
    requiresImmediateRenegotiation: boolean;
    sessionDescription: RTCSessionDescriptionInit;
    tracks: Array<{
        mid: string;
        trackName: string;
    }>
};

async function newTrack(sessionId: string, payload: NewTrackPayload): Promise<NewTrackResponse> {
    // add query params to the url
    let url = new URL("http://localhost:8088/newTrack");
    url.searchParams.append("sessionId", sessionId);


    let newLocalTracksResult = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload)
    });

    return newLocalTracksResult.json();
}

async function renegotiate(sessionId: string, payload: RTCSessionDescriptionInit): Promise<void> {
    let url = new URL("http://localhost:8088/renegotiate");
    url.searchParams.append("sessionId", sessionId);
    await fetch(url, {
        method: "POST",
        body: JSON.stringify({
            sessionDescription: payload
        })
    });
}

export async function JustSend(localStream: MediaStream): Promise<ObjectToBePassed> {

    pcSend = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.cloudflare.com:3478",
            }
        ],
        bundlePolicy: "max-bundle",
    });

    let sendOnlyTransceivers = localStream.getTracks().map(track => {
        return pcSend.addTransceiver(track, {
            direction: "sendonly"
        });
    });

    let offer = await pcSend.createOffer();
    await pcSend.setLocalDescription(offer);

    let newSessionResponse = await newSession(offer);
    const sessionId = newSessionResponse.sessionId;

    await pcSend.setRemoteDescription(newSessionResponse.sessionDescription);

    await new Promise<void>((resolve, reject) => {
        pcSend.addEventListener("iceconnectionstatechange", (ev) => {
            if (pcSend.iceConnectionState === "connected") {
                resolve();
            }
        });
        setTimeout(reject, 5000, "timeout");
    });

    const trackObjects = sendOnlyTransceivers.map(transceiver => {
        return {
            location: "local" as const,
            mid: transceiver.mid!,
            trackName: transceiver.sender.track!.id,
        }
    });

    let offer2 = await pcSend.createOffer();
    await pcSend.setLocalDescription(offer2);


    let newTrackPayload = await newTrack(sessionId, {
        sessionDescription: offer2,
        tracks: trackObjects
    });

    return newTrackPayload.tracks.map(track => {
        return {
            sessionId: sessionId,
            trackId: track.trackName
        }
    });
}

export async function JustReceive(payload: ObjectToBePassed): Promise<MediaStream> {
    pcReceive = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.cloudflare.com:3478",
            }
        ],
        bundlePolicy: "max-bundle",
    });

    let audioTransceiver = pcReceive.addTransceiver("audio", {
        direction: "recvonly"
    });

    let receiveOnlyTransceivers = pcReceive.addTransceiver("video", {
        direction: "recvonly"
    });

    let offer = await pcReceive.createOffer();
    await pcReceive.setLocalDescription(offer);

    let newSessionResponse = await newSession(offer);
    let sessionId = newSessionResponse.sessionId;

    await pcReceive.setRemoteDescription(newSessionResponse.sessionDescription);

    await new Promise<void>((resolve, reject) => {
        pcReceive.addEventListener("iceconnectionstatechange", (ev) => {
            if (pcReceive.iceConnectionState === "connected") {
                resolve();
            }
        });
        setTimeout(reject, 5000, "timeout");
    });

    let remoteTracksObjects = payload.map(track => {
        return {
            location: "remote" as const,
            sessionId: track.sessionId,
            trackName: track.trackId
        }
    });

    const trackPromise = new Promise<MediaStreamTrack[]>((resolve, reject) => {
        let tracks: MediaStreamTrack[] = [];
        pcReceive.addEventListener("track", (ev) => {
            tracks.push(ev.track);
            if (tracks.length === remoteTracksObjects.length) {
                resolve(tracks);
            }
        });
        setTimeout(reject, 5000, "timeout, not all tracks received");
    });

    let answerTracks = await newTrack(sessionId, {
        tracks: remoteTracksObjects
    });

    if (answerTracks.requiresImmediateRenegotiation && answerTracks.sessionDescription.type === "offer") {
        await pcReceive.setRemoteDescription(answerTracks.sessionDescription);
        let answer = await pcReceive.createAnswer();
        await pcReceive.setLocalDescription(answer);
        await renegotiate(sessionId, answer);
    }


    const tracks = await trackPromise;
    return new MediaStream(tracks);

}
