import { useCallback, useMemo, useState } from "react";
import { useHistory } from "./useHistory.js";
import {
  createElement,
  createPage,
  deepMerge,
  duplicateElement,
  duplicatePage,
  newId,
  pruneAssets,
} from "../lib/project.js";

/** Axis-aligned bounds of some elements (ignores rotation). */
export function boundsOf(els) {
  if (!els.length) return null;
  const x = Math.min(...els.map((e) => e.x));
  const y = Math.min(...els.map((e) => e.y));
  const r = Math.max(...els.map((e) => e.x + e.w));
  const b = Math.max(...els.map((e) => e.y + e.h));
  return { x, y, w: r - x, h: b - y };
}

/** Selecting one member of a group selects the whole group. */
function expandGroups(elements, ids) {
  const groups = new Set(elements.filter((e) => ids.includes(e.id) && e.group).map((e) => e.group));
  if (!groups.size) return ids;
  return elements.filter((e) => ids.includes(e.id) || (e.group && groups.has(e.group))).map((e) => e.id);
}

/**
 * Project editing state: the project (with undo/redo), the page being
 * edited and the selection, plus every edit operation the UI needs.
 */
export function useEditor(initial) {
  const history = useHistory(initial);
  const { design: project, set, reset } = history;
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);

  const page = project.pages[Math.min(pageIndex, project.pages.length - 1)];
  const selection = useMemo(() => page.elements.filter((e) => selectedIds.includes(e.id)), [page.elements, selectedIds]);
  const selected = selection.length === 1 ? selection[0] : null;

  const updatePageAt = (p, index, fn) => ({
    ...p,
    pages: p.pages.map((pg, i) => (i === index ? fn(pg) : pg)),
  });

  /**
   * select(id) / select([ids]) / select(null). `add` toggles ids in and out
   * of the selection (Shift/Ctrl+click); `deep` skips group expansion.
   */
  const select = useCallback(
    (ids, { add = false, deep = false } = {}) => {
      const list = ids == null ? [] : Array.isArray(ids) ? ids : [ids];
      setSelectedIds((cur) => {
        const expanded = deep ? list : expandGroups(page.elements, list);
        if (!add) return expanded;
        const allIn = expanded.every((id) => cur.includes(id));
        return allIn ? cur.filter((id) => !expanded.includes(id)) : [...cur, ...expanded.filter((id) => !cur.includes(id))];
      });
    },
    [page.elements],
  );

  const ops = useMemo(() => {
    // Discrete edits are their own undo step; continuous ones (dragging,
    // sliders) are merged by useHistory.
    const step = (fn) => set(fn, { step: true });
    const current = (p) => Math.min(pageIndex, p.pages.length - 1);
    const onPage = (fn, opts) => set((p) => updatePageAt(p, current(p), fn), opts);
    const stepOnPage = (fn) => onPage(fn, { step: true });
    const mapEls = (ids, fn, opts) =>
      onPage((pg) => ({ ...pg, elements: pg.elements.map((e) => (ids.includes(e.id) ? fn(e) : e)) }), opts);

    const removeElements = (ids) => {
      if (!ids.length) return;
      step((p) =>
        pruneAssets(
          updatePageAt(p, current(p), (pg) => ({
            ...pg,
            elements: pg.elements
              .filter((e) => !ids.includes(e.id))
              // Show/hide actions pointing at deleted layers stop pointing.
              .map((e) =>
                e.actions.some((a) => a.type === "toggle" && ids.includes(a.target))
                  ? { ...e, actions: e.actions.map((a) => (a.type === "toggle" && ids.includes(a.target) ? { ...a, target: null } : a)) }
                  : e,
              ),
          })),
        ),
      );
      setSelectedIds((s) => s.filter((id) => !ids.includes(id)));
    };

    const insertElements = (els) => {
      if (!els.length) return;
      stepOnPage((pg) => ({ ...pg, elements: [...pg.elements, ...els] }));
      setSelectedIds(els.map((e) => e.id));
    };

    const duplicateElements = (ids) => {
      const copies = [];
      stepOnPage((pg) => {
        const regroup = new Map();
        const picked = pg.elements.filter((e) => ids.includes(e.id));
        for (const el of picked) {
          const copy = duplicateElement(el);
          if (el.group) {
            if (!regroup.has(el.group)) regroup.set(el.group, newId("g"));
            copy.group = regroup.get(el.group);
          }
          copies.push(copy);
        }
        // Copies go right above the topmost original.
        const top = Math.max(...picked.map((e) => pg.elements.indexOf(e)));
        const elements = [...pg.elements];
        elements.splice(top + 1, 0, ...copies);
        return { ...pg, elements };
      });
      if (copies.length) setSelectedIds(copies.map((c) => c.id));
      return copies.map((c) => c.id);
    };

    /**
     * Mirror layers left↔right ("x") or top↕bottom ("y"). In place they flip
     * inside their own box; with `copy` a mirrored copy goes on the other
     * side of the canvas centre (handy for two tanks facing off).
     */
    const mirror = (ids, axis, { copy = false } = {}) => {
      const made = [];
      stepOnPage((pg) => {
        const picked = pg.elements.filter((e) => ids.includes(e.id) && (copy || !e.locked));
        if (!picked.length) return pg;
        const b = boundsOf(picked);
        const line = copy ? (axis === "x" ? project.canvas.w / 2 : project.canvas.h / 2) : axis === "x" ? b.x + b.w / 2 : b.y + b.h / 2;
        const flip = (e) => {
          const n = { ...e, rotation: e.rotation ? -e.rotation : 0 };
          if (axis === "x") n.x = Math.round(2 * line - e.x - e.w);
          else n.y = Math.round(2 * line - e.y - e.h);
          if (e.type === "image") n[axis === "x" ? "flipX" : "flipY"] = !e[axis === "x" ? "flipX" : "flipY"];
          // A mirrored camera angle gives the mirror image of the (symmetric) vehicle.
          if (e.type === "vehicle" && axis === "x") n.yaw = -e.yaw;
          return n;
        };
        if (!copy) return { ...pg, elements: pg.elements.map((e) => (picked.includes(e) ? flip(e) : e)) };
        const regroup = new Map();
        for (const el of picked) {
          const c = flip(duplicateElement(el));
          if (el.group) {
            if (!regroup.has(el.group)) regroup.set(el.group, newId("g"));
            c.group = regroup.get(el.group);
          }
          made.push(c);
        }
        return { ...pg, elements: [...pg.elements, ...made] };
      });
      if (made.length) setSelectedIds(made.map((c) => c.id));
    };

    /** dir: +1 forward, -1 backward, "front", "back". Works on several. */
    const moveLayers = (ids, dir) =>
        stepOnPage((pg) => {
          const els = [...pg.elements];
          const moving = els.filter((e) => ids.includes(e.id));
          if (!moving.length) return pg;
          if (dir === "front" || dir === "back") {
            const rest = els.filter((e) => !ids.includes(e.id));
            return { ...pg, elements: dir === "front" ? [...rest, ...moving] : [...moving, ...rest] };
          }
          // Step each one past its neighbour, starting from the far end so
          // a block of selected layers moves together.
          const order = dir > 0 ? [...moving].reverse() : moving;
          for (const el of order) {
            const i = els.indexOf(el);
            const j = i + dir;
            if (j < 0 || j >= els.length || ids.includes(els[j].id)) continue;
            [els[i], els[j]] = [els[j], els[i]];
          }
          return { ...pg, elements: els };
        });

    return {
      setProject: set,
      /** Deep-merge a patch (or apply a function) to one element. */
      updateElement: (id, patch, opts) => mapEls([id], (e) => (typeof patch === "function" ? patch(e) : deepMerge(e, patch)), opts),
      /** Apply a function (or patch) to several elements at once. */
      updateElements: (ids, patch, opts) => mapEls(ids, (e) => (typeof patch === "function" ? patch(e) : deepMerge(e, patch)), opts),
      addElement: (type, overrides = {}) => {
        let created;
        step((p) => {
          created = createElement(type, p.canvas, overrides);
          return updatePageAt(p, current(p), (pg) => ({ ...pg, elements: [...pg.elements, created] }));
        });
        setSelectedIds([created.id]);
        return created;
      },
      insertElement: (el) => insertElements([el]),
      insertElements,
      removeElement: (id) => removeElements([id]),
      removeElements,
      duplicateElements,
      mirror,
      duplicateElement: (id) => duplicateElements([id]),
      moveLayers,
      moveLayer: (id, dir) => moveLayers([id], dir),
      /** Drag-and-drop in the Layers list: put `ids` at array index `to`. */
      reorderLayers: (ids, to) =>
        stepOnPage((pg) => {
          const moving = pg.elements.filter((e) => ids.includes(e.id));
          if (!moving.length) return pg;
          const before = pg.elements.slice(0, to).filter((e) => !ids.includes(e.id));
          const after = pg.elements.slice(to).filter((e) => !ids.includes(e.id));
          const elements = [...before, ...moving, ...after];
          return elements.every((e, i) => e === pg.elements[i]) ? pg : { ...pg, elements };
        }),
      group: (ids) => {
        if (ids.length < 2) return;
        const g = newId("g");
        stepOnPage((pg) => {
          // Members become one block in the layer order, at the topmost spot.
          const members = pg.elements.filter((e) => ids.includes(e.id)).map((e) => ({ ...e, group: g }));
          const top = Math.max(...members.map((m) => pg.elements.findIndex((e) => e.id === m.id)));
          const below = pg.elements.slice(0, top + 1).filter((e) => !ids.includes(e.id));
          const above = pg.elements.slice(top + 1);
          return { ...pg, elements: [...below, ...members, ...above] };
        });
      },
      ungroup: (ids) =>
        set((p) =>
          updatePageAt(p, current(p), (pg) => ({
            ...pg,
            elements: pg.elements.map((e) => (ids.includes(e.id) && e.group ? { ...e, group: null } : e)),
          })),
        { step: true }),
      /** how: left | hcenter | right | top | vcenter | bottom. One element aligns to the canvas. */
      align: (ids, how) =>
        stepOnPage((pg) => {
          const els = pg.elements.filter((e) => ids.includes(e.id) && !e.locked);
          if (!els.length) return pg;
          const toCanvas = pg.elements.filter((e) => ids.includes(e.id)).length === 1;
          const area = toCanvas ? { x: 0, y: 0, w: project.canvas.w, h: project.canvas.h } : boundsOf(els);
          // Grouped elements move as one block.
          const units = unitsOf(els);
          const moved = new Map();
          for (const u of units) {
            const b = boundsOf(u);
            let dx = 0;
            let dy = 0;
            if (how === "left") dx = area.x - b.x;
            if (how === "hcenter") dx = area.x + area.w / 2 - (b.x + b.w / 2);
            if (how === "right") dx = area.x + area.w - (b.x + b.w);
            if (how === "top") dy = area.y - b.y;
            if (how === "vcenter") dy = area.y + area.h / 2 - (b.y + b.h / 2);
            if (how === "bottom") dy = area.y + area.h - (b.y + b.h);
            for (const e of u) moved.set(e.id, { ...e, x: Math.round(e.x + dx), y: Math.round(e.y + dy) });
          }
          return { ...pg, elements: pg.elements.map((e) => moved.get(e.id) ?? e) };
        }),
      /** Even gaps between three or more things, left→right or top→bottom. */
      distribute: (ids, axis) =>
        stepOnPage((pg) => {
          const units = unitsOf(pg.elements.filter((e) => ids.includes(e.id) && !e.locked));
          if (units.length < 3) return pg;
          const key = axis === "x" ? "x" : "y";
          const size = axis === "x" ? "w" : "h";
          const items = units.map((u) => ({ u, b: boundsOf(u) })).sort((a, b) => a.b[key] - b.b[key]);
          const start = items[0].b[key];
          const end = Math.max(...items.map((i) => i.b[key] + i.b[size]));
          const total = items.reduce((s, i) => s + i.b[size], 0);
          const gap = (end - start - total) / (items.length - 1);
          const moved = new Map();
          let at = start;
          for (const { u, b } of items) {
            const d = at - b[key];
            for (const e of u) moved.set(e.id, { ...e, [key]: Math.round(e[key] + d) });
            at += b[size] + gap;
          }
          return { ...pg, elements: pg.elements.map((e) => moved.get(e.id) ?? e) };
        }),
      updatePage: (patch) => onPage((pg) => deepMerge(pg, patch)),
      addPage: () => {
        step((p) => ({ ...p, pages: [...p.pages, { ...createPage(`Page ${p.pages.length + 1}`), bg: structuredClone(p.pages[p.pages.length - 1].bg) }] }));
        setPageIndex(project.pages.length);
        setSelectedIds([]);
      },
      duplicatePage: (index) => {
        step((p) => {
          const pages = [...p.pages];
          pages.splice(index + 1, 0, duplicatePage(p.pages[index]));
          return { ...p, pages };
        });
        setPageIndex(index + 1);
        setSelectedIds([]);
      },
      removePage: (index) => {
        if (project.pages.length <= 1) return;
        const removedId = project.pages[index].id;
        step((p) =>
          pruneAssets({
            ...p,
            pages: p.pages
              .filter((_, i) => i !== index)
              // Buttons that jumped to the removed page now go "next".
              .map((pg) => ({
                ...pg,
                elements: pg.elements.map((e) =>
                  e.actions.some((a) => a.type === "page" && a.target === removedId)
                    ? { ...e, actions: e.actions.map((a) => (a.type === "page" && a.target === removedId ? { ...a, target: "next" } : a)) }
                    : e,
                ),
              })),
          }),
        );
        setPageIndex((i) => Math.max(0, Math.min(i, project.pages.length - 2)));
        setSelectedIds([]);
      },
      movePage: (index, dir) => {
        const to = index + dir;
        if (to < 0 || to >= project.pages.length) return;
        step((p) => {
          const pages = [...p.pages];
          const [pg] = pages.splice(index, 1);
          pages.splice(to, 0, pg);
          return { ...p, pages };
        });
        setPageIndex(to);
      },
      /** Store a picture/sound in the project; returns its asset id. */
      addAsset: (kind, data, name) => {
        const id = newId("a");
        step((p) => ({ ...p, assets: { ...p.assets, [id]: { kind, data, name } } }));
        return id;
      },
      /** Store an asset and point something at it in one undo step. */
      withAsset: (kind, data, name, apply) => {
        const id = newId("a");
        step((p) => pruneAssets(apply({ ...p, assets: { ...p.assets, [id]: { kind, data, name } } }, id)));
        return id;
      },
      pageUpdater: (fn) => (p) => updatePageAt(p, current(p), fn),
    };
  }, [set, pageIndex, project.pages, project.canvas]);

  const goToPage = useCallback((i) => {
    setPageIndex(i);
    setSelectedIds([]);
  }, []);

  const load = useCallback(
    (p, startPage = 0) => {
      reset(p);
      setPageIndex(startPage);
      setSelectedIds([]);
    },
    [reset],
  );

  return {
    project,
    page,
    pageIndex: Math.min(pageIndex, project.pages.length - 1),
    selected,
    selection,
    selectedIds: selection.map((e) => e.id),
    selectedId: selected?.id ?? null,
    select,
    goToPage,
    load,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    ...ops,
  };
}

/** Split elements into move-together units: one per group, one per loose element. */
function unitsOf(els) {
  const groups = new Map();
  const units = [];
  for (const e of els) {
    if (!e.group) units.push([e]);
    else if (groups.has(e.group)) groups.get(e.group).push(e);
    else {
      const u = [e];
      groups.set(e.group, u);
      units.push(u);
    }
  }
  return units;
}
