import { useEffect, useRef, useState } from "react";
import { Film, X } from "lucide-react";
import * as native from "../../lib/native.js";
import { suggestedLength } from "../../lib/motion.js";
import { Segmented, Slider } from "../controls.jsx";

const SIZES = {
  video: [
    { id: "1920", label: "Full HD", side: 1920 },
    { id: "1280", label: "720p", side: 1280 },
    { id: "854", label: "480p", side: 854 },
  ],
  gif: [
    { id: "640", label: "Large", side: 640 },
    { id: "480", label: "Medium", side: 480 },
    { id: "360", label: "Small", side: 360 },
  ],
};

/** Export the current page as a video or GIF: animations, drifting background and moving tanks. */
export function ExportMotion({ project, pageIndex, onClose, notify, fileName }) {
  const page = project.pages[pageIndex];
  const [format, setFormat] = useState("mp4");
  const [seconds, setSeconds] = useState(() => suggestedLength(page));
  const [size, setSize] = useState("1920");
  const [fps, setFps] = useState(30);
  const [progress, setProgress] = useState(null);
  const abort = useRef(null);
  const gif = format === "gif";

  useEffect(() => {
    setSize(gif ? "480" : "1920");
    setFps(gif ? 15 : 30);
  }, [gif]);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && !abort.current && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const start = async () => {
    const ctl = new AbortController();
    abort.current = ctl;
    setProgress(0);
    try {
      const { exportGif, exportVideo } = await import("../../lib/video.js");
      const side = SIZES[gif ? "gif" : "video"].find((s) => s.id === size)?.side ?? 1280;
      const opts = { seconds, fps, maxSide: side, onProgress: setProgress, signal: ctl.signal };
      const out = gif ? await exportGif(project, pageIndex, opts) : await exportVideo(project, pageIndex, { ...opts, format });
      const label = { mp4: "MP4 video", webm: "WebM video", gif: "GIF animation" }[out.ext];
      if (out.ext !== format) notify("This PC can't make MP4 here, so it's a WebM video instead.", "info");
      const path = await native.saveMedia(out.bytes, `${fileName}.${out.ext}`, out.ext, label, out.mime);
      if (path) notify(`Exported ${native.baseName(path)}`, "success");
      onClose();
    } catch (err) {
      if (err?.name !== "AbortError") notify(`Couldn't export: ${err.message ?? err}`, "error");
      setProgress(null);
    } finally {
      abort.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-6 backdrop-blur-[2px]" onPointerDown={(e) => e.target === e.currentTarget && progress == null && onClose()}>
      <div className="menu-surface pop-in flex w-[420px] flex-col gap-4 p-5!" role="dialog" aria-label="Export video or GIF" data-testid="export-motion">
        <div className="flex items-center gap-2">
          <Film size={17} className="text-accent" />
          <h2 className="flex-1 font-display text-[17px] font-semibold">Export video or GIF</h2>
          <button type="button" aria-label="Close" disabled={progress != null} onClick={onClose} className="press grid size-8 place-items-center rounded-lg text-muted hover:bg-white/10 disabled:opacity-30">
            <X size={16} />
          </button>
        </div>
        <Segmented label="Format" value={format} onChange={setFormat} options={[{ id: "mp4", label: "MP4" }, { id: "webm", label: "WebM" }, { id: "gif", label: "GIF" }]} />
        <p className="-mt-2 text-[11.5px] text-muted">{gif ? "Plays everywhere, even in chats. Fewer colours and smaller." : format === "mp4" ? "Best for TikTok, YouTube, Discord and phones." : "Smaller files, great for the web."}</p>
        <Slider label="Length" value={seconds} min={2} max={15} onChange={setSeconds} format={(v) => `${v} s`} />
        <Segmented label="Size" value={size} onChange={setSize} options={SIZES[gif ? "gif" : "video"].map((s) => ({ id: s.id, label: s.label }))} />
        <Segmented
          label="Smoothness"
          value={String(fps)}
          onChange={(v) => setFps(Number(v))}
          options={(gif ? [10, 15, 20] : [24, 30, 60]).map((f) => ({ id: String(f), label: `${f} fps` }))}
        />
        {progress != null ? (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="w-10 text-right font-mono text-[12px]">{Math.round(progress * 100)}%</span>
            <button type="button" onClick={() => abort.current?.abort()} className="chip-btn">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={start} data-testid="export-motion-go" className="press focus-ring rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-[13.5px] font-bold text-[#0b0c12]">
            Export {gif ? "GIF" : "video"}
          </button>
        )}
        <p className="text-[11px] text-muted">Exports this page with its animations{page.elements.some((e) => e.type === "vehicle") ? " and moving 3D vehicles" : ""}. Buttons don't get clicked in videos.</p>
      </div>
    </div>
  );
}
