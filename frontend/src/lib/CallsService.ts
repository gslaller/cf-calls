// Common types
type SessionDescription = RTCSessionDescriptionInit;

type TrackObject = {
    location: 'local';
    trackName: string;
    mid: string;
} | {
    location: 'remote';
    trackName: string;
    sessionId: string;
}

type CloseTrackObject = {
    mid: string;
};

type ErrorObject = {
    errorCode: string;
    errorDescription: string;
};

// /apps/{appId}/sessions/new
type NewSessionRequest = {
    sessionDescription: SessionDescription;
};

type NewSessionResponse = {
    sessionDescription: SessionDescription;
    sessionId: string;
};

type OneTwoThree = {

}

// /apps/{appId}/sessions/{sessionId}/tracks/new
type TracksRequest = {
    sessionDescription?: SessionDescription;
    tracks: TrackObject[];
};

export type TrackObjectResponse = {
    sessionId: string;
    trackName: string;
    mid: string;
}

type TracksResponse = {
    requiresImmediateRenegotiation: boolean;
    sessionDescription: SessionDescription;
    tracks: (TrackObjectResponse & { error?: ErrorObject })[];
};

// /apps/{appId}/sessions/{sessionId}/renegotiate
type RenegotiateRequest = {
    sessionDescription: SessionDescription;
};

type RenegotiateResponse = SessionDescription;

// /apps/{appId}/sessions/{sessionId}/tracks/close
type CloseTracksRequest = {
    sessionDescription: SessionDescription;
    tracks: CloseTrackObject[];
    force?: boolean;
};

type CloseTracksResponse = {
    sessionDescription: SessionDescription;
    tracks: (CloseTrackObject & { error?: ErrorObject })[];
    requiresImmediateRenegotiation: boolean;
};

// /apps/{appId}/sessions/{sessionId}
export type GetSessionStateResponse = {
    tracks: (TrackObject & { status: 'active' | 'inactive' | 'waiting' })[];
};



export class CallsService {

    constructor(
        private readonly httpServerURL: string = "http://localhost:8088"
    ) { }

    private async fetchJSON<T>(url: string, method: string, body?: any): Promise<T> {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json() as T;
    }

    async newSession(offer: SessionDescription): Promise<NewSessionResponse> {
        return this.fetchJSON<NewSessionResponse>(
            `${this.httpServerURL}/newSession`,
            'POST',
            { sessionDescription: offer }
        );
    }

    async newTrack(sessionId: string, payload: TracksRequest): Promise<TracksResponse> {
        const url = new URL(`${this.httpServerURL}/newTrack`);
        url.searchParams.append("sessionId", sessionId);
        return this.fetchJSON<TracksResponse>(url.toString(), 'POST', payload);
    }

    async renegotiate(sessionId: string, payload: SessionDescription): Promise<SessionDescription> {
        const url = new URL(`${this.httpServerURL}/renegotiate`);
        url.searchParams.append("sessionId", sessionId);
        return this.fetchJSON<SessionDescription>(
            url.toString(),
            'POST',
            { sessionDescription: payload }
        );
    }

    async closeTracks(sessionId: string, payload: CloseTracksRequest): Promise<CloseTracksResponse> {
        const url = new URL(`${this.httpServerURL}/close`);
        url.searchParams.append("sessionId", sessionId);
        return this.fetchJSON<CloseTracksResponse>(url.toString(), 'POST', payload);
    }

    async getSessionState(sessionId: string): Promise<GetSessionStateResponse> {
        const url = new URL(`${this.httpServerURL}/session`);
        url.searchParams.append("sessionId", sessionId);
        return this.fetchJSON<GetSessionStateResponse>(url.toString(), 'POST');
    }

}


