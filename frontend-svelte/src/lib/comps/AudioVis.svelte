<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  export let track: MediaStreamTrack;

  let canvas: HTMLCanvasElement;
  let audioContext: AudioContext;
  let analyser: AnalyserNode;
  let source: MediaStreamAudioSourceNode;
  let animationId: number;

  onMount(() => {
    audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(new MediaStream([track]));
    source.connect(analyser);

    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) {
      console.error("Unable to get 2D context");
      return;
    }

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    function draw() {
      animationId = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      if (!canvasCtx) return;

      canvasCtx.fillStyle = "rgb(200, 200, 200)";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "rgb(0, 0, 0)";

      canvasCtx.beginPath();

      const sliceWidth = (WIDTH * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * HEIGHT) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    }

    draw();
  });

  onDestroy(() => {
    cancelAnimationFrame(animationId);
    if (audioContext) {
      audioContext.close();
    }
  });
</script>

<canvas bind:this={canvas} width="400" height="100"></canvas>

<style>
  canvas {
    border: 1px solid #000;
    width: 100%;
    max-width: 400px;
  }
</style>
