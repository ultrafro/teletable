export function generateFakeVideoStream() {
  //create fake media stream with video
  const fakeVideoStream = new MediaStream();
  // Create a canvas-based video track
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Draw a simple colored rectangle as a placeholder
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText("Video Call", 10, 30);
  }
  const videoTrack = canvas.captureStream(1).getVideoTracks()[0];
  if (videoTrack) {
    fakeVideoStream.addTrack(videoTrack);
  }
  return fakeVideoStream;
}
