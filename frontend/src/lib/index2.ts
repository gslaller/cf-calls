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
    private pc: RTCPeerConnection | null = null;
    private sessionId: string | null = null;
    private readonly iceServers = [{ urls: "stun:stun.cloudflare.com:3478" }];
    private readonly httpServer = "http://localhost:8088";

    private async getRTC(): Promise<RTCPeerConnection> {
        if (this.pc !== null) {
            return this.pc;
        }
        this.pc = new RTCPeerConnection({
            iceServers: this.iceServers,
            bundlePolicy: "max-bundle",
        });

        return this.pc;
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
            sessionDescription?: RTCSessionDescriptionInit;
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





    public async receive(payload: ObjectToBePassed): Promise<MediaStream> {
        let pc = await this.getRTC();

        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addTransceiver("video", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        let firstTime = false;

        if (this.sessionId === null) {
            // we don't need to create a new session if there is already one
            const newSessionResponse = await this.newSession(offer);
            const { sessionId, sessionDescription } = newSessionResponse;
            this.sessionId = sessionId;

            await pc.setRemoteDescription(sessionDescription);
            await this.waitForIceConnection(pc);
            firstTime = true;

        } else {
            console.log("Found sessionId", this.sessionId);

        }

        const remoteTracksObjects = payload.map(track => ({
            location: "remote" as const,
            sessionId: track.sessionId,
            trackName: track.trackId,
        }));

        const trackPromise = new Promise<MediaStreamTrack[]>((resolve, reject) => {

            const tracks: MediaStreamTrack[] = [];
            let localCounter = 0;
            this.pc!.addEventListener("track", (ev) => {
                localCounter++;

                tracks.push(ev.track);
                console.log(`Received track ${localCounter} of ${remoteTracksObjects.length}`)
                console.log(ev);
                if (tracks.length === remoteTracksObjects.length) {
                    resolve(tracks);
                }
            });
            setTimeout(() => reject(`only received ${tracks.length} of ${remoteTracksObjects.length} tracks`), 5000);
        });



        let answerTracks;
        if (firstTime) {
            console.log("Adding new tracks for the first time");
            answerTracks = await this.newTrack(this.sessionId, { tracks: remoteTracksObjects });
            console.log({ answerTracks, time: "First time" });
        } else {
            console.log("Adding new tracks");
            answerTracks = await this.newTrack(this.sessionId, { sessionDescription: offer, tracks: remoteTracksObjects });
            console.log({ answerTracks, time: "Second time" });
            await pc.setRemoteDescription(answerTracks.sessionDescription);
        }

        if (answerTracks.requiresImmediateRenegotiation && answerTracks.sessionDescription.type === "offer") {
            await pc.setRemoteDescription(answerTracks.sessionDescription);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this.renegotiate(this.sessionId, answer);
        }


        const tracks = await trackPromise;
        pc.getReceivers().forEach(receiver => {
            console.log({ receiver });
        });
        return new MediaStream(tracks);
    }

}
