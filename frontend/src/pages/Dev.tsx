import React, { useEffect, useRef, useState } from 'react';
import { PlusCircle, Play, Layers, X } from 'lucide-react';
import { WebRTCManagerTester } from '../lib/WebRTCManagerTest';
import { ObjectToBePassed } from '../lib/WebRTCManager';

const VideoFeed: React.FC<{
    stream: MediaStream,
    token: ObjectToBePassed,
    onRemove: () => void
}> = ({ stream, token, onRemove }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={onRemove}
                className="absolute top-2 right-2 text-white hover:text-red-500 transition-colors"
            >
                <X size={24} />
            </button>
            <input
                readOnly
                value={JSON.stringify(token)}
                className="w-full bg-gray-700 text-white text-xs p-2 truncate"
            />
            <video
                ref={videoRef}
                autoPlay
                playsInline
                controls
                muted
                className="w-full h-auto"
            ></video>
        </div>
    );
}

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
    senderFeed: any[],
    receiverFeed: any[],
    onAddSender: (managerId: string) => void,
    onAddReceiver: (managerId: string, token: string) => void,
    onRemoveSender: (id: string) => void,
    onRemoveReceiver: (id: string) => void,
    onRemoveManager: (id: string) => void
}> = ({
    manager,
    senderFeed,
    receiverFeed,
    onAddSender,
    onAddReceiver,
    onRemoveSender,
    onRemoveReceiver,
    onRemoveManager
}) => {
        const [tokenInput, setTokenInput] = useState('');

        return (
            <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Manager {manager.id}</h2>
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
                            onClick={() => onAddSender(manager.id)}
                            className="mb-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <PlusCircle size={20} className="mr-2" />
                            New Sender
                        </button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {senderFeed.filter(feed => feed.managerId === manager.id).map(({ token, stream, id }) => (
                                <VideoFeed
                                    key={id}
                                    stream={stream}
                                    token={token}
                                    onRemove={() => onRemoveSender(id)}
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
                                onClick={() => {
                                    onAddReceiver(manager.id, tokenInput);
                                    setTokenInput('');
                                }}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <Play size={20} className="mr-2" />
                                Fetch Stream
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {receiverFeed.filter(feed => feed.managerId === manager.id).map(({ token, stream, id }) => (
                                <VideoFeed
                                    key={id}
                                    stream={stream}
                                    token={token}
                                    onRemove={() => onRemoveReceiver(id)}
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

    const [senderFeed, setSenderFeed] = useState<{
        token: ObjectToBePassed,
        stream: MediaStream
        id: string,
        managerId: string,
    }[]>([]);

    const [receiverFeed, setReceiverFeed] = useState<{
        token: ObjectToBePassed,
        stream: MediaStream
        id: string,
        managerId: string,
    }[]>([]);

    useEffect(() => {
        addManager();
    }, []);

    function addManager() {
        const newManager: Manager = {
            id: Math.random().toString(36).substr(2, 9),
            instance: new WebRTCManagerTester()
        };
        setManagers([...managers, newManager]);
    }

    function removeManager(id: string) {
        let manager = managers.find(m => m.id === id);
        manager?.instance.closeAll();

        setManagers(managers.filter(m => m.id !== id));
        setSenderFeed(senderFeed.filter(s => s.managerId !== id));
        setReceiverFeed(receiverFeed.filter(r => r.managerId !== id));
    }

    async function addSender(managerId: string) {
        const manager = managers.find(m => m.id === managerId);
        if (!manager) return;

        let [stream, token] = await manager.instance.sendFake({ audio: true, video: true });
        let id = await JSONSHA256(token);
        setSenderFeed([...senderFeed, { token, stream, id, managerId }]);
    }

    async function addReceiver(managerId: string, tokenInput: string) {
        const manager = managers.find(m => m.id === managerId);
        if (!manager) return;

        try {
            const token = JSON.parse(tokenInput) as ObjectToBePassed;
            const stream = await manager.instance.receive(token);
            const id = await JSONSHA256(token);
            setReceiverFeed([...receiverFeed, { token, stream, id, managerId }]);
        } catch (error) {
            console.error('Error adding receiver:', error);
            alert('Invalid token or error fetching stream');
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">WebRTC Tester</h1>

                {managers.map(manager => (
                    <ManagerSection
                        key={manager.id}
                        manager={manager}
                        senderFeed={senderFeed}
                        receiverFeed={receiverFeed}
                        onAddSender={addSender}
                        onAddReceiver={addReceiver}
                        onRemoveSender={(id) => setSenderFeed(senderFeed.filter(s => s.id !== id))}
                        onRemoveReceiver={(id) => setReceiverFeed(receiverFeed.filter(r => r.id !== id))}
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