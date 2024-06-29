import { CallsService } from './CallsService';
import type { GetSessionStateResponse, TrackObjectResponse } from './CallsService';

export type ObjectToBePassed = {
    sessionId: string;
    trackId: string;
}[];

interface WebRTCManagerI {
    send(localStream: MediaStream): Promise<ObjectToBePassed>;
    receive(payload: ObjectToBePassed): Promise<MediaStream>;
    session(): Promise<GetSessionStateResponse>;
}

export class WebRTCManager implements WebRTCManagerI {
    private pc: RTCPeerConnection | null = null;
    private sessionId: string | null = null;
    private readonly iceServers = [{ urls: "stun:stun.cloudflare.com:3478" }];
    private callsService: CallsService;

    public id: string = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);

    constructor(callsService?: CallsService) {
        this.callsService = callsService || new CallsService();
    }

    session(): Promise<GetSessionStateResponse> {
        if (this.sessionId === null) {
            throw new Error("Session ID is null");
        }
        return this.callsService.getSessionState(this.sessionId);
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

    // transceivers should already be added to the pc
    private async createSession(): Promise<string> {
        if (this.pc === null) return "";
        if (this.pc?.getTransceivers().length === 0) {
            throw new Error("No transceivers added to the pc");
        }

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        const { sessionId, sessionDescription } = await this.callsService.newSession(offer);
        this.sessionId = sessionId;
        await this.pc.setRemoteDescription(sessionDescription);
        await this.waitForIceConnection(this.pc);

        return sessionId;

    }

    async send(localStream: MediaStream): Promise<ObjectToBePassed> {
        let pc = await this.getRTC();

        const sendOnlyTransceivers = localStream.getTracks().map(track => {
            return pc.addTransceiver(track, { direction: "sendonly" });
        });

        if (this.sessionId === null) {
            await this.createSession();
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const trackObjects = sendOnlyTransceivers.map(transceiver => ({
            location: "local" as const,
            mid: transceiver.mid!,
            trackName: transceiver.sender.track!.id,
        }));

        const newTrackResponse = await this.callsService.newTrack(
            this.sessionId!,
            {
                sessionDescription: offer,
                tracks: trackObjects
            }
        );

        await pc.setRemoteDescription(newTrackResponse.sessionDescription);

        return newTrackResponse.tracks.map(track => ({
            sessionId: this.sessionId!,
            trackId: track.trackName,
        }));
    }

    private allAnswers: Awaited<ReturnType<CallsService["newTrack"]>>[] = [];

    public async receive(payload: ObjectToBePassed): Promise<MediaStream> {
        let pc = await this.getRTC();

        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addTransceiver("video", { direction: "recvonly" });

        if (this.sessionId === null) {
            await this.createSession();
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const remoteTracksObjects = payload.map(track => ({
            location: "remote" as const,
            sessionId: track.sessionId,
            trackName: track.trackId,
        }));

        let answerTracks: Awaited<ReturnType<CallsService["newTrack"]>>;
        let midsToWait: string[] = [];

        const trackPromise = new Promise<MediaStreamTrack[]>((resolve, reject) => {
            const tracks: MediaStreamTrack[] = [];

            let localMap = new Map<string, MediaStreamTrack>();
            this.pc!.addEventListener("track", (ev) => {
                let mid = ev.transceiver.mid!;
                let track = ev.track;
                localMap.set(mid, track);
                if (midsToWait.includes(mid)) {
                    midsToWait = midsToWait.filter(m => m !== mid);
                }
                if (midsToWait.length === 0) {
                    resolve(answerTracks.tracks.map(t => localMap.get(t.mid)!));
                }
            });
            setTimeout(() => reject(`only received ${tracks.length} of ${remoteTracksObjects.length} tracks`), 5000);
        });

        answerTracks = await this.callsService.newTrack(this.sessionId!, { sessionDescription: offer, tracks: remoteTracksObjects });
        this.allAnswers.push(answerTracks);
        midsToWait = answerTracks.tracks.map(t => t.mid);

        await pc.setRemoteDescription(answerTracks.sessionDescription);

        if (answerTracks.requiresImmediateRenegotiation && answerTracks.sessionDescription.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this.callsService.renegotiate(this.sessionId!, answer);
        }

        const tracks = await trackPromise;
        return new MediaStream(tracks);
    }

    public async closeAll(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async closeIncomingP(payload: ObjectToBePassed) {
        let mids = [];

        for (let answer of this.allAnswers) {
            let { tracks } = answer;

            for (let track of tracks) {
                let match = payload.some(p => p.sessionId === this.sessionId && p.trackId === track.trackName);

                if (match) {
                    mids.push({ mid: track.mid });
                }
            }
        }

        // Call closeIncoming with the collected mids
        this.closeIncoming(mids);
    }



    public async closeIncoming(mids: { mid: string }[]) {
        let pc = await this.getRTC();
        let offer = await pc.createOffer();
        pc.setLocalDescription(offer);
        let response = await this.callsService.closeTracks(this.sessionId!, { sessionDescription: offer, tracks: mids, force: true });
        if (response.requiresImmediateRenegotiation) {
            let answer = await pc.createAnswer();
            pc.setLocalDescription(answer);
            await this.callsService.renegotiate(this.sessionId!, answer);
        }

        response.tracks.forEach(track => {
            console.log("Stopping track", track);
            let transceiver = pc.getTransceivers().find(t => t.mid === track.mid);
            console.log("Transceiver", transceiver)
            if (transceiver) {
                transceiver.stop();
            }
        });
    }
}