// Video (MP4 / WebM) and GIF export of an animated page. Frames come from
// the canvas renderer (renderPng.js); video is encoded with WebCodecs.
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from "webm-muxer";
import { prepareFrames } from "./renderPng.js";

const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

/** Pick a codec the computer can encode: H.264 for MP4, VP9/VP8 for WebM. */
async function pickCodec(format, width, height, fps, bitrate) {
  if (typeof VideoEncoder === "undefined") return null;
  const tries =
    format === "mp4"
      ? [["avc", "avc1.640033"], ["avc", "avc1.640028"], ["avc", "avc1.4d0028"], ["avc", "avc1.42001f"]]
      : [["V_VP9", "vp09.00.40.08"], ["V_VP9", "vp09.00.10.08"], ["V_VP8", "vp8"]];
  for (const [mux, codec] of tries) {
    const config = { codec, width, height, bitrate, framerate: fps, ...(mux === "avc" ? { avc: { format: "avc" } } : {}) };
    try {
      const { supported } = await VideoEncoder.isConfigSupported(config);
      if (supported) return { mux, config };
    } catch {
      // Try the next one.
    }
  }
  return null;
}

/**
 * Encode `seconds` of page `pageIndex` as a video.
 * format: "mp4" | "webm". maxSide caps the long edge. Returns { bytes, ext, mime }.
 */
export async function exportVideo(project, pageIndex, { seconds = 5, fps = 30, format = "mp4", maxSide = 1920, onProgress, signal } = {}) {
  const { w, h } = project.canvas;
  const k = Math.min(1, maxSide / Math.max(w, h)) * (Math.max(w, h) < 900 ? 2 : 1);
  const W = even(w * k);
  const H = even(h * k);
  const bitrate = Math.round(Math.min(16e6, Math.max(2e6, W * H * fps * 0.14)));
  let picked = await pickCodec(format, W, H, fps, bitrate);
  // No H.264 encoder on this PC: fall back to WebM.
  if (!picked && format === "mp4") {
    picked = await pickCodec("webm", W, H, fps, bitrate);
    format = "webm";
  }
  if (!picked) throw new Error("This computer can't encode video here. Try a GIF instead.");

  const frames = await prepareFrames(project, pageIndex, k);
  const enc = document.createElement("canvas");
  enc.width = W;
  enc.height = H;
  const ectx = enc.getContext("2d");
  const muxer =
    format === "mp4"
      ? new Mp4Muxer({ target: new Mp4Target(), video: { codec: "avc", width: W, height: H, frameRate: fps }, fastStart: "in-memory" })
      : new WebmMuxer({ target: new WebmTarget(), video: { codec: picked.mux, width: W, height: H, frameRate: fps } });
  let failure = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) });
  encoder.configure(picked.config);
  const total = Math.round(seconds * fps);
  try {
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      if (failure) throw failure;
      frames.draw(i / fps);
      ectx.fillStyle = "#000";
      ectx.fillRect(0, 0, W, H);
      ectx.drawImage(frames.canvas, 0, 0, W, H);
      const frame = new VideoFrame(enc, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 6) await nextFrame();
      onProgress?.((i + 1) / total);
      if (i % 3 === 0) await nextFrame();
    }
    await encoder.flush();
    if (failure) throw failure;
    muxer.finalize();
  } finally {
    if (encoder.state !== "closed") encoder.close();
    frames.dispose();
  }
  return { bytes: new Uint8Array(muxer.target.buffer), ext: format, mime: format === "mp4" ? "video/mp4" : "video/webm" };
}

/** An animated GIF (smaller and choppier, but plays everywhere). */
export async function exportGif(project, pageIndex, { seconds = 4, fps = 15, maxSide = 480, onProgress, signal } = {}) {
  const { w, h } = project.canvas;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const W = Math.max(2, Math.round(w * k));
  const H = Math.max(2, Math.round(h * k));
  const frames = await prepareFrames(project, pageIndex, k);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d", { willReadFrequently: true });
  const gif = GIFEncoder();
  const total = Math.round(seconds * fps);
  try {
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      frames.draw(i / fps);
      octx.fillStyle = "#000";
      octx.fillRect(0, 0, W, H);
      octx.drawImage(frames.canvas, 0, 0, W, H);
      const { data } = octx.getImageData(0, 0, W, H);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), W, H, { palette, delay: Math.round(1000 / fps) });
      onProgress?.((i + 1) / total);
      await nextFrame();
    }
    gif.finish();
  } finally {
    frames.dispose();
  }
  return { bytes: gif.bytes(), ext: "gif", mime: "image/gif" };
}
