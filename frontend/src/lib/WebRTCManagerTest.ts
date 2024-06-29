import { WebRTCManager } from "./WebRTCManager";

export type fakeAudioVideoP = {
    audio?: {
        sinWave: number,
    } | boolean,
    video?: {
        foregroundText: string,
        textColor: string,
    } | boolean
};

export class WebRTCManagerTester extends WebRTCManager {
    public async sendFake(obj: fakeAudioVideoP) {
        const [stream, _] = await this.fakeAudioVideo(obj);
        const { token, close } = await this.send(stream);
        return {
            stream,
            token,
            close: () => {
                close();
                stream.getTracks().forEach(track => track.stop());
            }
        }
    }

    private fakeAudioVideo(obj: fakeAudioVideoP): Promise<[MediaStream, () => void]> {
        let { audio, video } = obj;
        if (typeof audio === 'boolean') {
            audio = audio ? { sinWave: Math.floor(Math.random() * 1000 + 200) } : undefined;
        }
        if (typeof video === 'boolean') {
            video = video ? {
                foregroundText: this.generateRandomString(12),
                textColor: this.getRandomColor(),
            } : undefined;
        }

        return new Promise((resolve, reject) => {
            const stream = new MediaStream();
            let audioContext: AudioContext | undefined;
            let oscillator: OscillatorNode | undefined;
            let animationFrameId: number | undefined;

            // Audio implementation
            if (audio) {
                audioContext = new AudioContext();
                oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(audio.sinWave, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Reduced gain to avoid loud sound
                oscillator.connect(gainNode);
                const audioDestination = audioContext.createMediaStreamDestination();
                gainNode.connect(audioDestination);
                oscillator.start();
                stream.addTrack(audioDestination.stream.getAudioTracks()[0]);
            }

            // Improved video implementation
            if (video) {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 480;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                let frame = 0;
                const particles: Particle[] = [];
                for (let i = 0; i < 50; i++) {
                    particles.push(new Particle(canvas.width, canvas.height));
                }

                function drawFrame() {
                    if (!ctx) return;
                    if (typeof video !== 'object') return;
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Background text
                    ctx.font = '20px Arial';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';

                    // Particle animation
                    particles.forEach(particle => {
                        particle.update();
                        particle.draw(ctx);
                    });

                    // Foreground text with animation
                    ctx.font = '30px Arial';
                    ctx.fillStyle = video.textColor;
                    const x = canvas.width / 2;
                    const y = canvas.height / 2 + Math.sin(frame / 30) * 20;
                    ctx.textAlign = 'center';
                    ctx.fillText(video.foregroundText, x, y);

                    // Timestamp without animation
                    ctx.font = '12px Arial';
                    ctx.fillStyle = 'white';
                    ctx.textAlign = 'left';
                    ctx.fillText(new Date().toLocaleTimeString(), 10, 20);


                    frame++;
                    animationFrameId = requestAnimationFrame(drawFrame);
                }

                drawFrame();
                const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
                stream.addTrack(videoTrack);
            }

            const closeFunction = () => {
                if (oscillator) {
                    oscillator.stop();
                }
                if (audioContext) {
                    audioContext.close();
                }
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            resolve([stream, closeFunction]);
        });
    }

    private generateRandomString(length: number): string {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    private getRandomColor(): string {
        return `hsl(${Math.random() * 360}, 100%, 50%)`;
    }
}

class Particle {
    private x: number;
    private y: number;
    private size: number;
    private speedX: number;
    private speedY: number;
    private color: string;
    private maxWidth: number;
    private maxHeight: number;

    constructor(maxWidth: number, maxHeight: number) {
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
        this.x = Math.random() * maxWidth;
        this.y = Math.random() * maxHeight;
        this.size = Math.random() * 5 + 1;
        this.speedX = Math.random() * 3 - 1.5;
        this.speedY = Math.random() * 3 - 1.5;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > this.maxWidth) this.x = 0;
        else if (this.x < 0) this.x = this.maxWidth;

        if (this.y > this.maxHeight) this.y = 0;
        else if (this.y < 0) this.y = this.maxHeight;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}