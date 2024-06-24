<script lang="ts">
  import { onMount } from "svelte";
  import { ReflectStream } from "$lib";

  let localVideoEle: HTMLVideoElement;
  let remoteVideoEle: HTMLVideoElement;
  let isStreaming = false;

  async function starter() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideoEle.srcObject = stream;
      let remoteStream = await ReflectStream(stream);
      remoteVideoEle.srcObject = remoteStream;
      isStreaming = true;
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  }

  onMount(() => {
    return () => {
      // Clean up streams when component is destroyed
      if (localVideoEle.srcObject) {
        (localVideoEle.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
      if (remoteVideoEle.srcObject) {
        (remoteVideoEle.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  });
</script>

<main>
  <button type="button" on:click={starter} disabled={isStreaming}>
    {isStreaming ? "Streaming..." : "Start Stream"}
  </button>

  <div class="video-container">
    <div class="video-wrapper">
      <h2>Local</h2>
      <video bind:this={localVideoEle} autoplay muted playsinline>
        <track kind="captions" />
      </video>
    </div>

    <div class="video-wrapper">
      <h2>Remote</h2>
      <video bind:this={remoteVideoEle} autoplay muted playsinline>
        <track kind="captions" />
      </video>
    </div>
  </div>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  button {
    display: block;
    width: 100%;
    padding: 10px;
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    margin-bottom: 20px;
  }

  button:hover {
    background-color: #45a049;
  }

  button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }

  .video-container {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }

  @media (min-width: 768px) {
    .video-container {
      grid-template-columns: 1fr 1fr;
    }
  }

  .video-wrapper {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  h2 {
    background-color: #f1f1f1;
    margin: 0;
    padding: 10px;
    font-size: 18px;
  }

  video {
    width: 100%;
    height: auto;
    display: block;
  }
</style>
