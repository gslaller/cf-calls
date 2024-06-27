import React, { useRef, } from 'react';
import { PlusCircle, Copy, X } from 'lucide-react';
import { WebRTCManagerTester } from '../lib/WebRTCManagerTest';


export const Dev: React.FC = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef2 = useRef<HTMLVideoElement>(null);

    async function init() {
        let manager = new WebRTCManagerTester();
        let [stream, token] = await manager.sendFake({ audio: true, video: true });
        localVideoRef.current!.srcObject = stream;
        let remoteStream = await manager.receive(token);
        remoteVideoRef.current!.srcObject = remoteStream;
        await new Promise(r => setTimeout(r, 5000));
        let remoteStream2 = await manager.receive(token);
        remoteVideoRef2.current!.srcObject = remoteStream2;
    }
    return (
        <div className="container">
            <button type="button" onClick={init}>  <PlusCircle size={24} /> </button>
            <video ref={localVideoRef} autoPlay playsInline controls muted></video>
            <video ref={remoteVideoRef} autoPlay playsInline controls muted></video>
            <video ref={remoteVideoRef2} autoPlay playsInline controls muted></video>
        </div>
    );
}