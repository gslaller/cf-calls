<script lang="ts">
  import { onMount } from "svelte";
  import { WebRTCManager } from "$lib/WebRTCManager";
  // import { WebRTCManager as WebRTCManager2 } from "$lib/index2";
  import AudioVis from "$lib/comps/AudioVis.svelte";

  let localVideoEle: HTMLVideoElement;
  let remoteVideoEle: HTMLVideoElement;
  let remoteVideoEle2: HTMLVideoElement;

  let isStreaming = false;

  let localAudio: MediaStreamTrack | null = null;
  let remoteAudio: MediaStreamTrack | null = null;
  let remoteAudio2: MediaStreamTrack | null = null;

  // const manager = new WebRTCManager();
  // const manager2 = new WebRTCManager2();
  const manager = new WebRTCManager();

  async function starter() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideoEle.srcObject = stream;
      localAudio = stream.getAudioTracks()[0];

      console.log("Now Sending media");
      let objs = await manager.send(stream);

      console.log("Now receiving media one");
      let remoteStream = await manager.receive(objs);
      remoteAudio = remoteStream.getAudioTracks()[0];
      remoteVideoEle.srcObject = remoteStream;

      // sleep for 10 seconds
      await new Promise((resolve) => setTimeout(resolve, 10000));

      console.log("Now receiving media two");
      let remoteStream2 = await manager.receive(objs);

      let audioTrack2 = remoteStream2.getAudioTracks()[0];
      remoteAudio2 = audioTrack2;
      remoteVideoEle2.srcObject = remoteStream2;
      isStreaming = true;
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  }

  async function fullClose() {}

  async function sendClose() {}

  async function receiveClose() {}

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

      if (remoteVideoEle2.srcObject) {
        (remoteVideoEle2.srcObject as MediaStream)
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
  <button type="button" on:click={fullClose} disabled={!isStreaming}>
    Stop Stream
  </button>
  <div class="row">
    <button type="button" on:click={sendClose} disabled={!isStreaming}>
      Stop Sending
    </button>
    <button type="button" on:click={receiveClose} disabled={!isStreaming}>
      Stop Receiving
    </button>
  </div>

  <div class="video-container">
    <div class="video-wrapper">
      <h2>Local:</h2>
      <video bind:this={localVideoEle} autoplay controls muted playsinline>
        <track kind="captions" />
      </video>
      {#if localAudio}
        <AudioVis track={localAudio} />
      {/if}
    </div>

    <div class="video-wrapper">
      <h2>Remote: {remoteAudio?.id}</h2>
      <video bind:this={remoteVideoEle} autoplay controls muted playsinline>
        <track kind="captions" />
      </video>
      {#if remoteAudio}
        <AudioVis track={remoteAudio} />
      {/if}
    </div>
    <div class="video-wrapper">
      <h2>Remote - 2: {remoteAudio2?.id}</h2>
      <video bind:this={remoteVideoEle2} autoplay controls muted playsinline>
        <track kind="captions" />
      </video>
      {#if remoteAudio2}
        <AudioVis track={remoteAudio2} />
      {/if}
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

  .row {
    display: flex;
    gap: 20px;
  }
</style>
