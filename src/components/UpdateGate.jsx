import { useEffect, useState } from "react";
import { installUpdate, onUpdateProgress, openUrl } from "../lib/native.js";
import { Logo } from "./TitleBar.jsx";

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * Shown over everything when a newer AuraDrop is published. The update is
 * required, so there's no "later" – but if installing fails, the user can
 * retry or download it from GitHub, so nobody is ever stuck.
 */
export function UpdateGate({ info }) {
  const [state, setState] = useState("ready"); // ready | downloading | installing | error
  const [progress, setProgress] = useState({ downloaded: 0, total: info.size });
  const [error, setError] = useState("");

  useEffect(() => {
    const off = onUpdateProgress((p) => setProgress(p));
    return () => void off.then?.((f) => f());
  }, []);

  const start = async () => {
    setError("");
    setState("downloading");
    setProgress({ downloaded: 0, total: info.size });
    try {
      await installUpdate(info);
      setState("installing");
    } catch (err) {
      setError(String(err?.message ?? err));
      setState("error");
    }
  };

  const pct = progress.total ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100)) : 0;
  const notes = info.notes.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim();

  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-[#08090e]/80 p-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <div className="glass-chrome pop-in w-full max-w-[460px] rounded-3xl p-7 text-center" style={{ background: "rgba(18,19,28,0.92)" }}>
        <div className="mx-auto mb-3 w-fit drop-shadow-[0_10px_30px_rgba(167,139,250,0.55)]">
          <Logo size={56} />
        </div>
        <h2 id="update-title" className="font-display text-[21px] font-semibold">
          {state === "installing" ? "Installing the update…" : "Update required"}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {state === "installing" ? (
            "AuraDrop will close and reopen in a few seconds."
          ) : (
            <>
              AuraDrop <span className="font-semibold text-white">{info.version}</span> is out. You have {info.current}.
            </>
          )}
        </p>

        {notes && state !== "installing" && (
          <div className="scroll-thin mt-4 max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3 text-left text-[12px] leading-relaxed whitespace-pre-wrap text-ink/80">
            {notes}
          </div>
        )}

        {(state === "downloading" || state === "installing") && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Download progress">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300" style={{ width: `${state === "installing" ? 100 : pct}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted">
              {state === "installing" ? "Starting the installer…" : `${mb(progress.downloaded)} of ${mb(progress.total)}`}
            </p>
          </div>
        )}

        {state === "error" && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[12px] text-rose-100">
            {error}
          </p>
        )}

        {(state === "ready" || state === "error") && (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              autoFocus
              onClick={start}
              className="press focus-ring rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-[14px] font-semibold text-[#0b0c12] shadow-[0_8px_24px_rgba(167,139,250,0.35)] hover:brightness-110"
            >
              {state === "error" ? "Try again" : `Update now (${mb(info.size)})`}
            </button>
            {state === "error" && (
              <button type="button" onClick={() => openUrl(info.pageUrl)} className="press focus-ring rounded-xl px-4 py-2 text-[12.5px] text-muted hover:bg-white/10 hover:text-ink">
                Download it from GitHub instead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
