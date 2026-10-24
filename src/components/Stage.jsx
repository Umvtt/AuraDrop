import { useMemo, useRef } from "react";
import { generateCss } from "../lib/codegen.js";
import { STARTER_LOOKS } from "../lib/design.js";
import { useTilt } from "../hooks/useTilt.js";
import { Icons } from "./TitleBar.jsx";

/**
 * The live stage. It renders the card with exactly the CSS the export hub
 * generates (images aside), so the preview is the export.
 */
export function Stage({ design, dropTarget, onStarterLook, onSurprise, onReset }) {
  const areaRef = useRef(null);
  const anchorRef = useRef(null);
  const cardRef = useRef(null);
  const { content, vibes, aura } = design;

  const css = useMemo(() => generateCss(design, { images: "live" }), [design]);
  useTilt({ areaRef, anchorRef, cardRef, enabled: design.tilt.enabled, max: design.tilt.max });

  const imageVars = {
    "--aura-bg-image": content.background ? `url("${content.background}")` : undefined,
    "--aura-avatar-image": content.avatar ? `url("${content.avatar}")` : undefined,
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] border border-white/[0.07] shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <style>{css}</style>
      <div ref={areaRef} className="aura-scene h-full min-h-0!" style={imageVars}>
        {aura.orbs && aura.points.map((p, i) => <div key={p.id} className={`aura-orb aura-orb--${i + 1}`} />)}

        <div ref={anchorRef} className="aura-float">
          {(vibes.pulse || vibes.shimmer) && <div className="aura-glow" />}
          <div ref={cardRef} className="aura-card" data-drop="background">
            {content.background && <div className="aura-card__layer aura-card__bg" />}
            <div className="aura-card__layer aura-card__tint" />
            {vibes.shimmer && <div className="aura-card__layer aura-card__shimmer" />}
            <div className="aura-card__layer aura-card__glare" />
            <div className="aura-card__content">
              {(content.avatar || content.emoji) && (
                <div
                  data-drop="avatar"
                  className={`aura-card__avatar ${dropTarget === "avatar" ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : ""}`}
                >
                  {content.avatar ? "" : content.emoji}
                </div>
              )}
              {content.title && <h3 className="aura-card__title">{content.title}</h3>}
              {content.subtitle && <p className="aura-card__subtitle">{content.subtitle}</p>}
              {content.button && (
                <button type="button" className="aura-card__button" tabIndex={-1}>
                  {content.button}
                </button>
              )}
            </div>
            {dropTarget === "background" && (
              <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-[inherit] border-2 border-dashed border-white/80 bg-[#08090e]/75 text-[13px] font-semibold backdrop-blur-sm">
                Drop to use as card background
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Starter looks */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-white/10 bg-black/30 p-1.5 backdrop-blur-xl">
          <span className="px-1.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted @max-[880px]:hidden">Starter looks</span>
          {STARTER_LOOKS.map((look) => (
            <button
              key={look.id}
              type="button"
              onClick={() => onStarterLook(look)}
              className="press focus-ring group flex items-center gap-1.5 rounded-xl px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-ink/85 hover:bg-white/10 hover:text-white"
            >
              <span
                className="size-3.5 rounded-full border border-white/40 transition-[scale] duration-300 ease-spring group-hover:scale-125"
                style={{ background: `linear-gradient(135deg, ${look.colors.join(", ")})` }}
              />
              {look.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSurprise}
            title="Surprise me"
            className="press focus-ring flex items-center gap-1.5 rounded-xl whitespace-nowrap border border-white/10 bg-gradient-to-r from-accent/30 to-accent-2/30 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-xl hover:from-accent/45 hover:to-accent-2/45"
          >
            {Icons.dice}
            <span className="@max-[880px]:sr-only">Surprise me</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            title="Back to the default card"
            className="press focus-ring flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5 whitespace-nowrap text-[12px] font-medium text-ink/80 backdrop-blur-xl hover:text-white"
          >
            {Icons.reset}
            <span className="@max-[880px]:sr-only">Reset</span>
          </button>
        </div>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11.5px] text-white/45">
        Move your mouse around the stage to tilt the card · Drop an image from your desktop onto it
      </p>
    </div>
  );
}
