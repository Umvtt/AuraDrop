// Element renderers the player doesn't carry itself: 3D vehicles are drawn
// by the shared renderer in src/vehicles3d/service.js (loaded on demand).
const live = new WeakMap();
let service = null;
const load = () => (service ??= import("../vehicles3d/service.js"));

export const playerRenderers = {
  vehicle(el, inner, ctx) {
    const old = live.get(inner);
    old?.then((h) => h?.dispose());
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block";
    inner.append(canvas);
    const opts = { view: ctx.view || el.view, yaw: el.yaw, pitch: el.pitch, zoom: el.zoom, spin: el.spin, animate: ctx.animate && el.animate, ground: el.ground };
    const handle = load().then((s) => (canvas.isConnected || inner.isConnected ? s.attach(canvas, el.vehicle, opts) : null));
    live.set(inner, handle);
    // Clean up when the element's content is rebuilt or removed.
    const obs = new MutationObserver(() => {
      if (!canvas.isConnected) {
        obs.disconnect();
        handle.then((h) => h?.dispose());
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  },
};
