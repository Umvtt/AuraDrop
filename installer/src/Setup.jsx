import { useCallback, useEffect, useRef, useState } from "react";
import { api, onCloseBlocked, onProgress } from "./bridge.js";

const INSTALL_STEPS = [
  { id: "check", label: "Checking your PC" },
  { id: "unpack", label: "Unpacking AuraDrop" },
  { id: "install", label: "Installing AuraDrop" },
  { id: "verify", label: "Double-checking everything" },
];
const REMOVE_STEPS = [
  { id: "check", label: "Finding AuraDrop" },
  { id: "remove", label: "Removing AuraDrop" },
  { id: "verify", label: "Making sure it's all gone" },
];
const RAIL = [
  { id: "welcome", label: "Welcome" },
  { id: "options", label: "Options" },
  { id: "progress", label: "Install" },
  { id: "done", label: "Done" },
];

const formatSize = (bytes) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;

/** Tauri rejects with our SetupError object, or a plain string. */
function toError(err) {
  if (err && typeof err === "object" && "message" in err) {
    return { message: err.message, detail: err.detail ?? "", step: err.step ?? "" };
  }
  return { message: "Something unexpected went wrong.", detail: String(err), step: "" };
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Drop({ size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
      <defs>
        <linearGradient id="setup-drop" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#f0abfc" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        d="M512 120 C 610 270 800 440 800 620 C 800 780 672 904 512 904 C 352 904 224 780 224 620 C 224 440 414 270 512 120 Z"
        fill="url(#setup-drop)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="22"
      />
      <path d="M390 590 C 390 490 445 410 500 345" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="52" strokeLinecap="round" />
    </svg>
  );
}

function Button({ children, onClick, variant = "secondary", disabled, autoFocus, className = "", ...rest }) {
  const styles = {
    primary:
      "bg-gradient-to-r from-accent to-accent-2 text-[#0b0c12] font-semibold shadow-[0_8px_24px_rgba(167,139,250,0.35)] hover:brightness-110",
    secondary: "border border-white/12 bg-white/[0.07] text-ink hover:bg-white/[0.12]",
    ghost: "text-muted hover:bg-white/[0.06] hover:text-ink",
    danger: "border border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`press focus-ring flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Switch({ checked, onChange, label, hint, icon }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="press focus-ring glass-soft flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left hover:bg-white/[0.07]"
    >
      <span className="grid size-7 flex-none place-items-center rounded-lg bg-white/[0.07] text-[14px]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        <span className="block truncate text-[11px] text-muted">{hint}</span>
      </span>
      <span
          className={`relative h-[22px] w-[38px] flex-none rounded-full border transition-colors duration-200 ${
            checked ? "border-transparent bg-gradient-to-r from-accent to-accent-2" : "border-white/10 bg-white/10"
          }`}
        >
          <span
            className="absolute top-[2px] left-[2px] size-4 rounded-full bg-white shadow-md transition-[translate] duration-400 ease-spring"
            style={{ translate: checked ? "16px 0" : "0 0" }}
          />
        </span>
    </button>
  );
}

function StepRow({ label, state }) {
  return (
    <li className="flex items-center gap-3" data-state={state}>
      <span
        className={`grid size-6 flex-none place-items-center rounded-full border text-[11px] ${
          state === "done"
            ? "border-transparent bg-gradient-to-br from-accent to-accent-2 text-[#0b0c12]"
            : state === "active"
              ? "border-accent/70 bg-accent/15"
              : state === "failed"
                ? "border-rose-400/60 bg-rose-500/20 text-rose-200"
                : "border-white/15 bg-white/[0.04] text-muted"
        }`}
      >
        {state === "done" ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8.5 3 3 7-7" />
          </svg>
        ) : state === "active" ? (
          <span className="spin block size-3 rounded-full border-2 border-accent border-t-transparent" />
        ) : state === "failed" ? (
          "!"
        ) : null}
      </span>
      <span className={`text-[13px] ${state === "pending" ? "text-muted" : "text-ink"}`}>{label}</span>
    </li>
  );
}

function Check({ on }) {
  return on ? <span className="text-emerald-300">✓</span> : <span className="text-muted">—</span>;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export default function Setup() {
  const [info, setInfo] = useState(null);
  const [page, setPage] = useState("loading");
  const [job, setJob] = useState("install");
  const [options, setOptions] = useState(null);
  const [launch, setLaunch] = useState(true);
  const [dirError, setDirError] = useState("");
  const [checkingDir, setCheckingDir] = useState(false);
  const [progress, setProgress] = useState({ current: null, done: [] });
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const busy = page === "progress";
  const busyRef = useRef(false);
  busyRef.current = busy;

  const notify = useCallback((message) => setToast({ message, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Only the latest load may update the screen (a slower, older one must
  // not reset the page after an install has already started).
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setPage("loading");
    try {
      const i = await api.getInfo();
      if (seq !== loadSeq.current) return;
      setInfo(i);
      setOptions({
        dir: i.installed?.location ?? i.defaultDir,
        desktopShortcut: true,
        associate: true,
        autostart: i.autostartEnabled,
        // Started by AuraDrop's update screen: keep every existing choice.
        update: Boolean(i.autoUpdate && i.installed),
      });
      setDirError("");
      setPage("welcome");
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(toError(err));
      setPage("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const off = onProgress((step) =>
      setProgress((p) => ({ current: step, done: p.current && p.current !== step ? [...p.done, p.current] : p.done })),
    );
    const offClose = onCloseBlocked(() => notify("Hang on — setup is still working."));
    return () => {
      off.then((f) => f());
      offClose.then((f) => f());
    };
  }, [notify]);

  // --- actions ---------------------------------------------------------------

  const runJob = useCallback(
    async (kind) => {
      setModal(null);
      setJob(kind);
      setProgress({ current: null, done: [] });
      setError(null);
      setPage("progress");
      try {
        if (kind === "install") {
          setReport(await api.install(options));
          setPage("done");
        } else {
          await api.uninstall();
          setPage("removed");
        }
      } catch (err) {
        setError(toError(err));
        setPage("error");
      }
    },
    [options],
  );

  // Started by AuraDrop's updater: go straight to installing, then reopen
  // AuraDrop on its own. (AuraDrop has already closed itself.)
  const autoStarted = useRef(false);
  useEffect(() => {
    if (info?.autoUpdate && page === "welcome" && !autoStarted.current) {
      autoStarted.current = true;
      runJob("install");
    }
  }, [info, page, runJob]);
  useEffect(() => {
    if (!info?.autoUpdate || page !== "done" || !report) return;
    const t = setTimeout(async () => {
      try {
        await api.launchApp(report.exe);
      } catch (err) {
        notify(String(err));
        return;
      }
      api.quit();
    }, 1400);
    return () => clearTimeout(t);
  }, [info, page, report, notify]);

  /** Make sure AuraDrop isn't open before touching its files. */
  const start = useCallback(
    async (kind) => {
      if (await api.isAppRunning()) setModal({ kind });
      else runJob(kind);
    },
    [runJob],
  );

  const recheckRunning = async () => {
    if (await api.isAppRunning()) notify("AuraDrop is still open.");
    else runJob(modal.kind);
  };

  const changeFolder = async () => {
    const picked = await api.pickFolder(options.dir);
    if (!picked) return;
    setCheckingDir(true);
    try {
      const dir = await api.chooseDir(picked);
      setOptions((o) => ({ ...o, dir }));
      setDirError("");
    } catch (err) {
      setDirError(typeof err === "string" ? err : toError(err).message);
    } finally {
      setCheckingDir(false);
    }
  };

  const finish = async () => {
    if (launch && report) {
      try {
        await api.launchApp(report.exe);
      } catch (err) {
        notify(String(err));
        return;
      }
    }
    api.quit();
  };

  const close = () => {
    if (busyRef.current) notify("Hang on — setup is still working.");
    else api.quit();
  };

  const copyDetails = async () => {
    const text = `AuraDrop Setup ${info?.version ?? ""}\nStep: ${error.step}\n${error.message}\n${error.detail}`;
    try {
      await navigator.clipboard.writeText(text);
      notify("Details copied");
    } catch {
      notify("Couldn't copy – select the text instead");
    }
  };

  // Keyboard: Esc steps back / closes the modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (modal) setModal(null);
      else if (page === "options" || page === "confirm-remove") setPage("welcome");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, page]);

  // --- render ----------------------------------------------------------------

  const railIndex = { welcome: 0, "confirm-remove": 0, options: 1, progress: 2, done: 3, removed: 3, error: 2 }[page] ?? 0;
  const tone = page === "done" || page === "removed" ? "success" : page === "error" ? "error" : undefined;

  return (
    <div className="setup-scene flex flex-col" data-tone={tone}>
      <div className="setup-orb setup-orb--1" />
      <div className="setup-orb setup-orb--2" />
      <div className="setup-orb setup-orb--3" />

      {/* Title bar */}
      <header data-tauri-drag-region className="relative z-10 flex h-10 flex-none items-center pr-1 pl-4">
        <span data-tauri-drag-region className="flex-1 text-[12px] font-medium text-white/70">
          AuraDrop Setup
        </span>
        <button
          type="button"
          aria-label="Minimize"
          title="Minimize"
          onClick={api.minimize}
          className="press focus-ring grid h-8 w-11 place-items-center rounded-lg text-ink/70 hover:bg-white/10 hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" /></svg>
        </button>
        <button
          type="button"
          aria-label="Close setup"
          title="Close setup"
          onClick={close}
          className="press focus-ring grid h-8 w-11 place-items-center rounded-lg text-ink/70 hover:bg-[#e81123] hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.1"><path d="m0.5 0.5 9 9M9.5 0.5l-9 9" /></svg>
        </button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-5 pb-5">
        {/* Brand rail */}
        <aside className="glass flex w-[210px] flex-none flex-col items-center rounded-3xl px-5 pt-7 pb-5">
          <div className="float drop-shadow-[0_10px_30px_rgba(167,139,250,0.55)]">
            <Drop size={92} />
          </div>
          <h1 className="mt-3 font-display text-[22px] font-semibold tracking-tight">
            Aura<span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">Drop</span>
          </h1>
          <span className="mt-1 rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[11px] text-muted">
            v{info?.version ?? "…"} · 64-bit
          </span>
          <ol className="mt-7 flex w-full flex-col gap-2.5" aria-label="Setup steps">
            {RAIL.map((r, i) => (
              <li
                key={r.id}
                aria-current={i === railIndex ? "step" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1 text-[12.5px] transition-colors ${
                  i === railIndex ? "bg-white/[0.08] text-white" : i < railIndex ? "text-ink/80" : "text-muted/70"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    i < railIndex ? "bg-accent-2" : i === railIndex ? "bg-accent shadow-[0_0_10px_#a78bfa]" : "bg-white/20"
                  }`}
                />
                {r.label}
              </li>
            ))}
          </ol>
          <p className="mt-auto text-center text-[10.5px] leading-snug text-muted/80">Installs just for you. No administrator rights needed.</p>
        </aside>

        {/* Page */}
        <main className="glass flex min-w-0 flex-1 flex-col rounded-3xl px-6 pt-5 pb-5">
          {page === "loading" && (
            <div className="grid flex-1 place-items-center text-muted">
              <span className="spin block size-6 rounded-full border-2 border-accent border-t-transparent" aria-label="Loading" />
            </div>
          )}

          {page === "welcome" && info && (
            <Welcome
              info={info}
              onInstall={() => start("install")}
              onCustomize={() => setPage("options")}
              onUninstall={() => setPage("confirm-remove")}
            />
          )}

          {page === "options" && options && (
            <div className="page-in flex min-h-0 flex-1 flex-col">
              <h2 className="font-display text-[20px] font-semibold">Make it yours</h2>
              <p className="mt-1 text-[12.5px] text-muted">Pick where AuraDrop lives and how it fits into Windows.</p>

              <div className="scroll-thin -mx-2 mt-2.5 min-h-0 flex-1 overflow-y-auto px-2 pb-0.5">
              <div>
                <p className="mb-1.5 text-[11.5px] font-semibold tracking-wide text-muted uppercase">Install location</p>
                <div className="flex items-center gap-2">
                  <div
                    className="glass-soft min-w-0 flex-1 truncate rounded-xl px-3 py-2 font-mono text-[12px] text-ink/90"
                    title={options.dir}
                    data-testid="install-dir"
                  >
                    {options.dir}
                  </div>
                  <Button onClick={changeFolder} disabled={checkingDir}>
                    {checkingDir ? "Checking…" : "Change…"}
                  </Button>
                </div>
                {dirError && (
                  <p role="alert" className="mt-1.5 text-[11.5px] text-rose-300">
                    {dirError}
                  </p>
                )}
                {options.dir !== info.defaultDir && (
                  <button
                    type="button"
                    onClick={() => {
                      setOptions((o) => ({ ...o, dir: info.defaultDir }));
                      setDirError("");
                    }}
                    className="focus-ring mt-1 text-[11.5px] text-accent hover:underline"
                  >
                    Use the default folder
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-1">
                <Switch icon="🖥️" label="Desktop shortcut" hint="Put an AuraDrop icon on your desktop" checked={options.desktopShortcut} onChange={(v) => setOptions((o) => ({ ...o, desktopShortcut: v }))} />
                <Switch icon="📂" label="Open .auradrop files with AuraDrop" hint="Double-click a saved design to open it" checked={options.associate} onChange={(v) => setOptions((o) => ({ ...o, associate: v }))} />
                <Switch icon="🌅" label="Start with Windows" hint="Waits quietly in the system tray when you sign in" checked={options.autostart} onChange={(v) => setOptions((o) => ({ ...o, autostart: v }))} />
                <Switch icon="🚀" label="Open AuraDrop when setup finishes" hint="Jump straight in" checked={launch} onChange={setLaunch} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">📌 A Start menu shortcut is always added so you can find AuraDrop.</p>
              </div>

              <footer className="mt-auto flex items-center gap-2 pt-3">
                <Button variant="ghost" onClick={() => setPage("welcome")}>
                  Back
                </Button>
                <span className="flex-1" />
                <Button variant="primary" onClick={() => start("install")} disabled={checkingDir}>
                  {info.mode === "update" ? "Update" : info.mode === "fresh" ? "Install" : "Reinstall"}
                </Button>
              </footer>
            </div>
          )}

          {page === "progress" && (
            <div className="page-in flex flex-1 flex-col" aria-live="polite">
              <h2 className="font-display text-[20px] font-semibold">
                {job === "install" ? (info?.mode === "update" ? "Updating AuraDrop…" : "Installing AuraDrop…") : "Removing AuraDrop…"}
              </h2>
              <p className="mt-1 text-[12.5px] text-muted">This only takes a few seconds. Please keep this window open.</p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="Progress">
                <div
                  className="relative h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(6, (((job === "install" ? INSTALL_STEPS : REMOVE_STEPS).findIndex((s) => s.id === progress.current) + 0.6) / (job === "install" ? INSTALL_STEPS : REMOVE_STEPS).length) * 100)}%`,
                  }}
                >
                  <div className="bar-shimmer absolute inset-0 rounded-full" />
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-3">
                {(job === "install" ? INSTALL_STEPS : REMOVE_STEPS).map((s) => (
                  <StepRow
                    key={s.id}
                    label={s.label}
                    state={progress.current === s.id ? "active" : progress.done.includes(s.id) ? "done" : "pending"}
                  />
                ))}
              </ul>
            </div>
          )}

          {page === "done" && report && (
            <div className="page-in flex flex-1 flex-col">
              <div className="flex items-center gap-3">
                <span className="pop grid size-11 place-items-center rounded-full bg-gradient-to-br from-emerald-300 to-accent-2 text-[20px] text-[#0b0c12] shadow-[0_0_30px_rgba(52,211,153,0.5)]">
                  ✓
                </span>
                <div>
                  <h2 className="font-display text-[20px] font-semibold">
                    {info?.autoUpdate ? "AuraDrop is up to date!" : "AuraDrop is ready!"}
                  </h2>
                  <p className="text-[12.5px] text-muted">
                    {info?.autoUpdate ? `Version ${report.version} is installed. Opening AuraDrop…` : `Version ${report.version} is installed and checked.`}
                  </p>
                </div>
              </div>
              {/* An auto-update keeps the user's choices; listing defaults would mislead. */}
              {!info?.autoUpdate && (
              <dl className="glass-soft mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl p-4 text-[12.5px]">
                <dt className="text-muted">Installed to</dt>
                <dd className="truncate font-mono text-[11.5px]" title={report.dir}>{report.dir}</dd>
                <dt className="text-muted">Start menu</dt>
                <dd><Check on /></dd>
                <dt className="text-muted">Desktop shortcut</dt>
                <dd><Check on={options.desktopShortcut} /></dd>
                <dt className="text-muted">Opens .auradrop files</dt>
                <dd><Check on={options.associate} /></dd>
                <dt className="text-muted">Starts with Windows</dt>
                <dd><Check on={options.autostart} /></dd>
              </dl>
              )}
              <footer className="mt-auto flex items-center gap-3 pt-4">
                <label className={`flex cursor-pointer items-center gap-2 text-[12.5px] text-ink/90 ${info?.autoUpdate ? "invisible" : ""}`}>
                  <input type="checkbox" checked={launch} onChange={(e) => setLaunch(e.target.checked)} className="size-4 accent-violet-400" />
                  Open AuraDrop now
                </label>
                <span className="flex-1" />
                <Button variant="primary" onClick={finish} autoFocus>
                  Finish
                </Button>
              </footer>
            </div>
          )}

          {page === "confirm-remove" && info?.installed && (
            <div className="page-in flex flex-1 flex-col">
              <h2 className="font-display text-[20px] font-semibold">Remove AuraDrop?</h2>
              <p className="mt-1 text-[12.5px] text-muted">
                This removes AuraDrop {info.installed.version} and its shortcuts from this PC.
              </p>
              <div className="glass-soft mt-5 rounded-xl p-4 text-[12.5px] leading-relaxed text-ink/90">
                💾 Your saved <span className="font-mono">.auradrop</span> designs and exported images stay exactly where they are.
              </div>
              <footer className="mt-auto flex items-center gap-2 pt-3">
                <Button variant="ghost" onClick={() => setPage("welcome")}>
                  Cancel
                </Button>
                <span className="flex-1" />
                <Button variant="danger" onClick={() => start("uninstall")}>
                  Remove AuraDrop
                </Button>
              </footer>
            </div>
          )}

          {page === "removed" && (
            <div className="page-in flex flex-1 flex-col">
              <div className="flex items-center gap-3">
                <span className="pop grid size-11 place-items-center rounded-full bg-white/10 text-[20px]">👋</span>
                <div>
                  <h2 className="font-display text-[20px] font-semibold">AuraDrop was removed</h2>
                  <p className="text-[12.5px] text-muted">Thanks for trying it. Your designs are still safe.</p>
                </div>
              </div>
              <footer className="mt-auto flex justify-end pt-4">
                <Button variant="primary" onClick={() => api.quit()} autoFocus>
                  Close
                </Button>
              </footer>
            </div>
          )}

          {page === "error" && error && (
            <div className="page-in flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-3">
                <span className="pop grid size-11 flex-none place-items-center rounded-full bg-rose-500/25 text-[20px] text-rose-100">!</span>
                <div>
                  <h2 className="font-display text-[20px] font-semibold">Something went wrong</h2>
                  <p role="alert" className="text-[12.5px] text-ink/85">{error.message}</p>
                </div>
              </div>
              <details className="glass-soft mt-5 min-h-0 overflow-auto rounded-xl p-3 text-[12px]">
                <summary className="cursor-pointer text-muted">Technical details</summary>
                <pre className="mt-2 font-mono text-[11px] whitespace-pre-wrap text-ink/80 select-text">{`Step: ${error.step}\n${error.detail}`}</pre>
              </details>
              <footer className="mt-auto flex items-center gap-2 pt-3">
                <Button variant="ghost" onClick={copyDetails}>
                  Copy details
                </Button>
                <span className="flex-1" />
                <Button onClick={() => api.quit()}>Close</Button>
                <Button variant="primary" onClick={load}>
                  Try again
                </Button>
              </footer>
            </div>
          )}
        </main>
      </div>

      {modal && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#08090e]/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="running-title">
          <div className="glass page-in w-[420px] rounded-2xl bg-[#14151f]/90 p-5">
            <h3 id="running-title" className="font-display text-[16px] font-semibold">
              AuraDrop is open
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/80">
              Save your work in AuraDrop first. Setup can close it for you — anything unsaved will be lost.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <span className="flex-1" />
              <Button onClick={recheckRunning}>I closed it</Button>
              <Button variant="primary" onClick={() => runJob(modal.kind)} autoFocus>
                Close it for me
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
          <div key={toast.key} role="status" className="toast-in glass rounded-xl px-4 py-2 text-[12.5px]">
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

function Welcome({ info, onInstall, onCustomize, onUninstall }) {
  const { mode, installed } = info;
  const title = {
    fresh: "Let's get you set up",
    reinstall: "AuraDrop is already installed",
    update: "An update is ready",
    downgrade: "A newer AuraDrop is installed",
  }[mode];
  const primary = { fresh: "Install", reinstall: "Reinstall", update: "Update", downgrade: "Install anyway" }[mode];

  return (
    <div className="page-in flex flex-1 flex-col">
      <h2 className="font-display text-[22px] font-semibold">{title}</h2>
      {mode === "fresh" && (
        <p className="mt-1 text-[12.5px] text-muted">AuraDrop turns anyone into a glass-UI wizard in seconds.</p>
      )}
      {mode === "reinstall" && (
        <p className="mt-1 text-[12.5px] text-muted">
          Version {installed.version} lives in <span className="font-mono text-ink/80">{installed.location}</span>. Reinstall to repair it, or remove it.
        </p>
      )}
      {mode === "update" && (
        <p className="mt-1 text-[12.5px] text-muted">
          Update from <span className="text-ink">{installed.version}</span> to <span className="text-ink">{info.version}</span>. Your settings and designs are kept.
        </p>
      )}
      {mode === "downgrade" && (
        <p className="mt-1 text-[12.5px] text-amber-200/90">
          You have version {installed.version}. Installing {info.version} replaces it with an older version.
        </p>
      )}

      {!info.hasPayload && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[12px] text-rose-100">
          This copy of setup is incomplete and can't install AuraDrop. Please download setup again.
        </p>
      )}

      <ul className="mt-5 flex flex-col gap-2.5">
        {[
          ["🫧", "Glass cards that tilt toward your cursor", "Real frost, shine and 3D physics."],
          ["🌈", "Glowing mesh-gradient auras", "Drag colours around and watch them drift."],
          ["⚡", "One-click code export", "Copy CSS, HTML or Tailwind, or save a PNG."],
        ].map(([icon, title, text]) => (
          <li key={title} className="glass-soft flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="grid size-8 flex-none place-items-center rounded-lg bg-white/[0.07] text-base">{icon}</span>
            <span>
              <span className="block text-[12.5px] font-medium">{title}</span>
              <span className="block text-[11px] text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] text-muted">
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1">📦 {formatSize(info.sizeBytes)} on disk</span>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1">🔓 No admin needed</span>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1">🪟 Windows 10 & 11</span>
      </div>

      <footer className="mt-auto flex items-center gap-2 pt-3">
        {installed && (
          <Button variant="ghost" onClick={onUninstall}>
            Uninstall
          </Button>
        )}
        <span className="flex-1" />
        <Button onClick={onCustomize} disabled={!info.hasPayload}>
          Customize
        </Button>
        <Button variant="primary" onClick={onInstall} disabled={!info.hasPayload} autoFocus>
          {primary}
        </Button>
      </footer>
    </div>
  );
}
