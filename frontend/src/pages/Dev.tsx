import React, { useEffect, useRef, useState } from 'react';
import { PlusCircle, Play, Layers, X, CheckCircle, Copy } from 'lucide-react';
import { WebRTCManagerTester } from '../lib/WebRTCManagerTest';
import { ObjectToBePassed } from '../lib/WebRTCManager';

const VideoFeed: React.FC<{
    stream: MediaStream,
    token?: ObjectToBePassed,
    onRemove: () => void
}> = ({ stream, token, onRemove }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    function copyToClipboard() {
        navigator.clipboard.writeText(JSON.stringify(token));
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }

    return (
        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="relative">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    controls
                    muted
                    className="w-full h-auto"
                />
                <div className="absolute top-2 right-2 flex space-x-2">
                    {token && (
                        <button
                            onClick={copyToClipboard}
                            className={`p-1 rounded-full transition-colors duration-300 ${isCopied ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'
                                }`}
                            title={isCopied ? "Token copied!" : "Copy token to clipboard"}
                        >
                            {isCopied ? <CheckCircle size={20} className="text-white border-spacing-1" /> : <Copy size={20} className="text-white" />}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onRemove}
                        className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors duration-300"
                        title="Remove video feed"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

function JSONSHA256(obj: ObjectToBePassed): Promise<string> {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(obj)))
        .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
}

interface Manager {
    id: string;
    instance: WebRTCManagerTester;
}

const ManagerSection: React.FC<{
    manager: Manager,
    onRemoveManager: (id: string) => void
}> = ({ manager, onRemoveManager }) => {

    const [senderFeed, setSenderFeed] = useState<{
        token: ObjectToBePassed,
        stream: MediaStream
        id: string,
        close: () => void,
        managerId: string,
    }[]>([]);

    const [receiverFeed, setReceiverFeed] = useState<{
        token: ObjectToBePassed,
        stream: MediaStream
        id: string,
        close: () => void,
        managerId: string,
    }[]>([]);

    const [tokenInput, setTokenInput] = useState('');

    async function addSender() {
        let { close, stream, token } = await manager.instance.sendFake({ audio: true, video: true });
        let id = await JSONSHA256(token);
        setSenderFeed([...senderFeed, { token, stream, id, close, managerId: manager.id }]);
    }


    async function addReceiver() {
        try {
            const token = JSON.parse(tokenInput) as ObjectToBePassed;
            const { close, mediaStream } = await manager.instance.receive(token);
            const id = await JSONSHA256(token);
            setReceiverFeed([...receiverFeed, { token, stream: mediaStream, id, close, managerId: manager.id }]);
            setTokenInput('');
        } catch (error) {
            console.error('Error adding receiver:', error);
            alert('Invalid token or error fetching stream');
        }
    }

    function removeSender(id: string, close: () => void) {
        close();
        setSenderFeed(senderFeed.filter(s => s.id !== id));
    }

    function removeReceiver(id: string, close: () => void) {
        close();
        setReceiverFeed(receiverFeed.filter(r => r.id !== id));
    }

    async function alertSessionState() {
        let getSessionState = await manager.instance.session();
        console.log({ resp: getSessionState })
    }

    return (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
            <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Manager {manager.id}</h2>

                    <button
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={alertSessionState}
                    >
                        getSessionState
                    </button>
                    <button
                        onClick={() => onRemoveManager(manager.id)}
                        className="text-red-500 hover:text-red-700"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Sender Section */}
                <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Sender</h3>
                    <button
                        type="button"
                        onClick={addSender}
                        className="mb-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        <PlusCircle size={20} className="mr-2" />
                        New Sender
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {senderFeed.map(({ token, stream, id, close }) => (
                            <VideoFeed
                                key={id}
                                stream={stream}
                                token={token}
                                onRemove={() => removeSender(id, close)}
                            />
                        ))}
                    </div>
                </div>

                {/* Receiver Section */}
                <div>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Receiver</h3>
                    <div className="flex mb-4">
                        <input
                            type="text"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            placeholder="Enter token"
                            className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                            onClick={addReceiver}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Play size={20} className="mr-2" />
                            Fetch Stream
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {receiverFeed.map(({ stream, id, close }) => (
                            <VideoFeed
                                key={id}
                                stream={stream}
                                onRemove={() => removeReceiver(id, close)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Dev: React.FC = () => {
    const [managers, setManagers] = useState<Manager[]>([]);

    useEffect(() => {
        addManager();
    }, []);

    function addManager() {
        let manager = new WebRTCManagerTester();
        setManagers([...managers, { id: manager.id, instance: manager }]);
    }

    function removeManager(id: string) {
        setManagers(managers.filter(m => m.id !== id));
    }

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">WebRTC Tester</h1>

                {managers.map(manager => (
                    <ManagerSection
                        key={manager.id}
                        manager={manager}
                        onRemoveManager={removeManager}
                    />
                ))}

                {/* Add New Manager Button */}
                <div className="text-center">
                    <button
                        onClick={addManager}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        <Layers size={20} className="mr-2" />
                        Add New Manager
                    </button>
                </div>
            </div>
        </div>
    );
}
