import { useEffect, useRef, useState } from "react";
import { createPlayer } from "../player/player.js";
import { openUrl } from "../lib/native.js";

/**
 * Play mode: just the project, with working buttons. Opening a .auradrop
 * file lands here; "Edit" switches to the editor.
 */
export function Preview({ project, startPage = 0, onEdit, onPageChange }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [page, setPage] = useState(startPage);
  // The control bar fades out while the mouse is still, so it never covers
  // the project for long.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = setTimeout(() => setIdle(true), 2500);
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  useEffect(() => {
    const player = createPlayer(hostRef.current, project, {
      mode: "play",
      page: startPage,
      keyboard: true,
      confirmLinks: true,
      openUrl: (url) => openUrl(url),
      onPageChange: (i) => {
        setPage(i);
        onPageChange?.(i);
      },
    });
    playerRef.current = player;
    hostRef.current.focus();
    return () => player.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-2 pb-2">
      <div ref={hostRef} tabIndex={-1} className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#050608] outline-none" data-testid="preview" />
      <div className={`pointer-events-none absolute inset-x-0 bottom-5 flex justify-center transition-opacity duration-500 ${idle ? "opacity-0" : "opacity-100"}`} data-testid="preview-bar">
        <div className="glass-chrome pointer-events-auto flex items-center gap-2 rounded-2xl px-2 py-1.5 backdrop-blur-xl">
          {project.pages.length > 1 && (
            <div className="flex items-center gap-1.5 px-1" role="tablist" aria-label="Pages">
              {project.pages.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={i === page}
                  aria-label={p.name}
                  title={p.name}
                  onClick={() => playerRef.current?.setPage(i)}
                  className={`size-2.5 rounded-full transition-[scale,background] ${i === page ? "scale-125 bg-white" : "bg-white/35 hover:bg-white/60"}`}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => onEdit(page)}
            className="press focus-ring flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#0b0c12]"
          >
            ✏️ Edit
          </button>
        </div>
      </div>
    </div>
  );
}
