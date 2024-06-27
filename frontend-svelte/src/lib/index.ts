type ObjectToBePassed = {
    sessionId: string;
    trackId: string;
}[];

/**
 * WebRTCManager
 * 
 * This class esbtlishes a single WebRTC connection to the CF- Calls api.
 * The connection can send and receive multiple MediaStreamTracks.
 * 
 * enpoints api:
 * - POST ${basepath}/newSession
 * - POST ${basepath}/newTrack
 * - POST ${basepath}/renegotiate
 * - POST ${basepath}/close
 * - GET/SSE ${basepath}/events
 */
export class WebRTCManager {
    private pcSend: RTCPeerConnection | null = null;
    private pcReceive: RTCPeerConnection | null = null;
    private readonly iceServers = [{ urls: "stun:stun.cloudflare.com:3478" }];
    private readonly httpServer = "http://localhost:8088";

    private async createPeerConnection(): Promise<RTCPeerConnection> {
        return new RTCPeerConnection({
            iceServers: this.iceServers,
            bundlePolicy: "max-bundle",
        });
    }

    private async waitForIceConnection(pc: RTCPeerConnection): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            pc.addEventListener("iceconnectionstatechange", () => {
                if (pc.iceConnectionState === "connected") {
                    resolve();
                }
            });
            setTimeout(() => reject("ICE connection timeout"), 5000);
        });
    }

    private async newSession(offer: RTCSessionDescriptionInit) {
        const response = await fetch(`${this.httpServer}/newSession`, {
            method: "POST",
            body: JSON.stringify({ sessionDescription: offer }),
        });
        return await response.json() as {
            sessionId: string;
            sessionDescription: RTCSessionDescriptionInit;
        };
    }

    private async newTrack(
        sessionId: string,
        payload: {
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
        }
    ) {
        const url = new URL(`${this.httpServer}/newTrack`);
        url.searchParams.append("sessionId", sessionId);
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(payload),
        });

        return await response.json() as {
            requiresImmediateRenegotiation: boolean;
            sessionDescription: RTCSessionDescriptionInit;
            tracks: Array<{
                mid: string;
                sessionId: string;
                trackName: string;
            }>
        };
    }

    private async renegotiate(sessionId: string, payload: RTCSessionDescriptionInit): Promise<void> {
        const url = new URL(`${this.httpServer}/renegotiate`);
        url.searchParams.append("sessionId", sessionId);
        await fetch(url, {
            method: "POST",
            body: JSON.stringify({ sessionDescription: payload }),
        });
    }

    private async establishConnection(): Promise<void> {
        return;
    }

    public async send(localStream: MediaStream): Promise<ObjectToBePassed> {
        this.pcSend = await this.createPeerConnection();

        const sendOnlyTransceivers = localStream.getTracks().map(track =>
            this.pcSend!.addTransceiver(track, { direction: "sendonly" })
        );

        const offer = await this.pcSend.createOffer();
        await this.pcSend.setLocalDescription(offer);

        const newSessionResponse = await this.newSession(offer);
        const { sessionId, sessionDescription } = newSessionResponse;

        await this.pcSend.setRemoteDescription(sessionDescription);
        await this.waitForIceConnection(this.pcSend);

        const trackObjects = sendOnlyTransceivers.map(transceiver => ({
            location: "local" as const,
            mid: transceiver.mid!,
            trackName: transceiver.sender.track!.id,
        }));

        const offer2 = await this.pcSend.createOffer();
        await this.pcSend.setLocalDescription(offer2);

        const newTrackPayload = await this.newTrack(sessionId, {
            sessionDescription: offer2,
            tracks: trackObjects,
        });

        console.log({ newTrackPayload, time: "Somewhere " });

        await this.pcSend.setRemoteDescription(newTrackPayload.sessionDescription);

        return newTrackPayload.tracks.map(track => ({
            sessionId,
            trackId: track.trackName,
        }));
    }



    public async receive(payload: ObjectToBePassed): Promise<MediaStream> {
        this.pcReceive = await this.createPeerConnection();

        this.pcReceive.addTransceiver("audio", { direction: "recvonly" });
        this.pcReceive.addTransceiver("video", { direction: "recvonly" });

        const offer = await this.pcReceive.createOffer();
        await this.pcReceive.setLocalDescription(offer);

        const newSessionResponse = await this.newSession(offer);
        const { sessionId, sessionDescription } = newSessionResponse;

        await this.pcReceive.setRemoteDescription(sessionDescription);
        await this.waitForIceConnection(this.pcReceive);

        const remoteTracksObjects = payload.map(track => ({
            location: "remote" as const,
            sessionId: track.sessionId,
            trackName: track.trackId,
        }));

        const trackPromise = new Promise<MediaStreamTrack[]>((resolve, reject) => {
            const tracks: MediaStreamTrack[] = [];
            this.pcReceive!.addEventListener("track", (ev) => {
                tracks.push(ev.track);
                console.log(ev);
                if (tracks.length === remoteTracksObjects.length) {
                    resolve(tracks);
                }
            });
            setTimeout(() => reject("Timeout, not all tracks received"), 5000);
        });

        // console.log({ remoteTracksObjects });
        const answerTracks = await this.newTrack(sessionId, { tracks: remoteTracksObjects });
        // console.log({ answerTracks });

        if (answerTracks.requiresImmediateRenegotiation && answerTracks.sessionDescription.type === "offer") {
            await this.pcReceive.setRemoteDescription(answerTracks.sessionDescription);
            const answer = await this.pcReceive.createAnswer();
            await this.pcReceive.setLocalDescription(answer);
            await this.renegotiate(sessionId, answer);
        }


        const tracks = await trackPromise;
        this.pcReceive.getReceivers().forEach(receiver => {
            console.log({ receiver });
        });
        return new MediaStream(tracks);
    }

}
