import { CallsService } from './CallsService';
import type { CallsServiceI } from './CallsService';

export type ObjectToBePassed = {
    sessionId: string;
    trackId: string;
}[];

interface WebRTCManagerI {
    send(localStream: MediaStream): Promise<ObjectToBePassed>;
    receive(payload: ObjectToBePassed): Promise<MediaStream>;
}

export class WebRTCManager implements WebRTCManagerI {
    private pc: RTCPeerConnection | null = null;
    private sessionId: string | null = null;
    private readonly iceServers = [{ urls: "stun:stun.cloudflare.com:3478" }];
    private callsService: CallsServiceI;

    public id: string = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);

    constructor(callsService?: CallsServiceI) {
        this.callsService = callsService || new CallsService();
    }

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

    async send(localStream: MediaStream): Promise<ObjectToBePassed> {
        let pc = await this.getRTC();

        const sendOnlyTransceivers = localStream.getTracks().map(track => {
            return pc.addTransceiver(track, { direction: "sendonly" });
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        let offer2 = offer;

        if (this.sessionId === null) {
            const { sessionId, sessionDescription } = await this.callsService.newSession(offer);
            this.sessionId = sessionId;
            await pc.setRemoteDescription(sessionDescription);
            await this.waitForIceConnection(pc);

            offer2 = await pc.createOffer();
            await pc.setLocalDescription(offer2);
        }

        const trackObjects = sendOnlyTransceivers.map(transceiver => ({
            location: "local" as const,
            mid: transceiver.mid!,
            trackName: transceiver.sender.track!.id,
        }));

        const newTrackResponse = await this.callsService.newTrack(
            this.sessionId,
            {
                sessionDescription: offer2,
                tracks: trackObjects
            }
        );

        console.log({ newTrackResponse, time: "144 manager 2" })
        await pc.setRemoteDescription(newTrackResponse.sessionDescription);

        return newTrackResponse.tracks.map(track => ({
            sessionId: this.sessionId!,
            trackId: track.trackName,
        }));
    }

    public async receive(payload: ObjectToBePassed): Promise<MediaStream> {
        let pc = await this.getRTC();

        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addTransceiver("video", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        let firstTime = false;

        if (this.sessionId === null) {
            const newSessionResponse = await this.callsService.newSession(offer);
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
            answerTracks = await this.callsService.newTrack(this.sessionId, { tracks: remoteTracksObjects });
            console.log({ answerTracks, time: "First time" });
        } else {
            console.log("Adding new tracks");
            answerTracks = await this.callsService.newTrack(this.sessionId, { sessionDescription: offer, tracks: remoteTracksObjects });
            console.log({ answerTracks, time: "Second time" });
        }

        console.log("Setting remote description");
        await pc.setRemoteDescription(answerTracks.sessionDescription);

        if (answerTracks.requiresImmediateRenegotiation && answerTracks.sessionDescription.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this.callsService.renegotiate(this.sessionId, answer);
        }

        const tracks = await trackPromise;
        pc.getReceivers().forEach(receiver => {
            console.log({ receiver });
        });
        return new MediaStream(tracks);
    }

    public async closeAll(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}