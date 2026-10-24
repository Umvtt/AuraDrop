// 3D tilt physics. Pure functions so they can be unit-tested and reused by
// the exported tilt script.

/**
 * Map a pointer position to tilt angles relative to the card's centre.
 * Pointers outside the card still tilt it (the whole stage is live), but the
 * normalised offset is clamped so the card never flips past `max`.
 */
export function computeTilt(pointerX, pointerY, rect, max) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const nx = clamp((pointerX - cx) / (rect.width / 2), -1, 1);
  const ny = clamp((pointerY - cy) / (rect.height / 2), -1, 1);
  return {
    // Moving right turns the right edge away from the viewer (rotateY +),
    // moving down tips the bottom edge away (rotateX -).
    rx: -ny * max,
    ry: nx * max,
    // Glare position in card-local percent, pointing at the cursor.
    gx: 50 + nx * 50,
    gy: 50 + ny * 50,
    // Distance from centre 0..1 – drives glare strength.
    intensity: Math.min(1, Math.hypot(nx, ny)),
  };
}

/** Angle (deg) for a linear glare that brightens toward the cursor. */
export function glareAngle(gx, gy) {
  const dx = gx - 50;
  const dy = gy - 50;
  if (dx === 0 && dy === 0) return 180;
  // CSS gradient angles: 0deg points up, 90deg points right.
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}

/**
 * One semi-implicit Euler step of a damped spring, per channel.
 * `state` is { value, velocity }; returns a new state.
 */
export function springStep(state, target, dt, stiffness = 170, damping = 18) {
  const force = -stiffness * (state.value - target) - damping * state.velocity;
  const velocity = state.velocity + force * dt;
  const value = state.value + velocity * dt;
  return { value, velocity };
}

export function isSettled(state, target, epsilon = 0.01) {
  return Math.abs(state.value - target) < epsilon && Math.abs(state.velocity) < epsilon;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
