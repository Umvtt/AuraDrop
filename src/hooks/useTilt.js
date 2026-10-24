import { useEffect, useRef } from "react";
import { computeTilt, glareAngle, isSettled, springStep } from "../lib/tilt.js";

const REST = { rx: 0, ry: 0, gx: 28, gy: 18, gi: 0.55 };
// Hovering uses a stiffer spring so the card tracks the cursor closely; the
// return to rest is softer, with a little overshoot, so it feels physical.
const TRACK = { stiffness: 260, damping: 26 };
const RETURN = { stiffness: 120, damping: 11 };

/**
 * Drives the card's 3D tilt and glare from pointer movement over `areaRef`.
 * Writes straight to the DOM in a rAF loop – no React re-renders per frame.
 *
 * `anchorRef` is the untransformed wrapper used to measure the card centre
 * (measuring the tilted card itself would feed back into the maths).
 */
export function useTilt({ areaRef, anchorRef, cardRef, enabled, max }) {
  const maxRef = useRef(max);
  maxRef.current = max;

  useEffect(() => {
    const area = areaRef.current;
    const anchor = anchorRef.current;
    const card = cardRef.current;
    if (!area || !anchor || !card) return;

    const state = Object.fromEntries(Object.entries(REST).map(([k, v]) => [k, { value: v, velocity: 0 }]));
    const target = { ...REST };
    let spring = RETURN;
    let raf = 0;
    let last = 0;

    const write = () => {
      card.style.transform = `perspective(1000px) rotateX(${state.rx.value}deg) rotateY(${state.ry.value}deg)`;
      card.style.setProperty("--aura-gx", `${state.gx.value}%`);
      card.style.setProperty("--aura-gy", `${state.gy.value}%`);
      card.style.setProperty("--aura-ga", `${glareAngle(state.gx.value, state.gy.value)}deg`);
      card.style.setProperty("--aura-gi", String(state.gi.value));
    };

    const step = (now) => {
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      let moving = false;
      for (const key in state) {
        state[key] = springStep(state[key], target[key], dt, spring.stiffness, spring.damping);
        if (!isSettled(state[key], target[key])) moving = true;
      }
      write();
      if (moving) {
        raf = requestAnimationFrame(step);
      } else {
        raf = 0;
        last = 0;
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };

    const onMove = (e) => {
      if (!enabled) return;
      const t = computeTilt(e.clientX, e.clientY, anchor.getBoundingClientRect(), maxRef.current);
      Object.assign(target, { rx: t.rx, ry: t.ry, gx: t.gx, gy: t.gy, gi: 0.35 + 0.65 * t.intensity });
      spring = TRACK;
      kick();
    };
    const onLeave = () => {
      Object.assign(target, REST);
      spring = RETURN;
      kick();
    };

    if (!enabled) onLeave();
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerleave", onLeave);
    write();
    return () => {
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [areaRef, anchorRef, cardRef, enabled]);
}
