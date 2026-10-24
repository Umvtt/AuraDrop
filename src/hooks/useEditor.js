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

/**
 * Project editing state: the project (with undo/redo), the page being
 * edited and the selected element, plus every edit operation the UI needs.
 */
export function useEditor(initial) {
  const history = useHistory(initial);
  const { design: project, set, reset } = history;
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const page = project.pages[Math.min(pageIndex, project.pages.length - 1)];
  const selected = page.elements.find((e) => e.id === selectedId) ?? null;

  const updatePageAt = (p, index, fn) => ({
    ...p,
    pages: p.pages.map((pg, i) => (i === index ? fn(pg) : pg)),
  });

  const ops = useMemo(() => {
    // Discrete edits are their own undo step; continuous ones (dragging,
    // sliders) are merged by useHistory.
    const step = (fn) => set(fn, { step: true });
    const onPage = (fn, opts) => set((p) => updatePageAt(p, Math.min(pageIndex, p.pages.length - 1), fn), opts);
    const stepOnPage = (fn) => onPage(fn, { step: true });
    const mapEl = (id, fn) => onPage((pg) => ({ ...pg, elements: pg.elements.map((e) => (e.id === id ? fn(e) : e)) }));

    return {
      setProject: set,
      /** Deep-merge a patch (or apply a function) to one element. */
      updateElement: (id, patch) => mapEl(id, (e) => (typeof patch === "function" ? patch(e) : deepMerge(e, patch))),
      addElement: (type, overrides = {}) => {
        let created;
        step((p) => {
          created = createElement(type, p.canvas, overrides);
          return updatePageAt(p, Math.min(pageIndex, p.pages.length - 1), (pg) => ({ ...pg, elements: [...pg.elements, created] }));
        });
        setSelectedId(created.id);
        return created;
      },
      insertElement: (el) => {
        stepOnPage((pg) => ({ ...pg, elements: [...pg.elements, el] }));
        setSelectedId(el.id);
      },
      removeElement: (id) => {
        step((p) =>
          pruneAssets(
            updatePageAt(p, Math.min(pageIndex, p.pages.length - 1), (pg) => ({
              ...pg,
              elements: pg.elements.filter((e) => e.id !== id),
            })),
          ),
        );
        setSelectedId((s) => (s === id ? null : s));
      },
      duplicateElement: (id) => {
        let copy;
        stepOnPage((pg) => {
          const i = pg.elements.findIndex((e) => e.id === id);
          if (i < 0) return pg;
          copy = duplicateElement(pg.elements[i]);
          const elements = [...pg.elements];
          elements.splice(i + 1, 0, copy);
          return { ...pg, elements };
        });
        if (copy) setSelectedId(copy.id);
      },
      /** dir: +1 forward, -1 backward, "front", "back". */
      moveLayer: (id, dir) =>
        stepOnPage((pg) => {
          const els = [...pg.elements];
          const i = els.findIndex((e) => e.id === id);
          if (i < 0) return pg;
          const [el] = els.splice(i, 1);
          const to = dir === "front" ? els.length : dir === "back" ? 0 : Math.max(0, Math.min(els.length, i + dir));
          els.splice(to, 0, el);
          return { ...pg, elements: els };
        }),
      updatePage: (patch) => onPage((pg) => deepMerge(pg, patch)),
      addPage: () => {
        step((p) => ({ ...p, pages: [...p.pages, { ...createPage(`Page ${p.pages.length + 1}`), bg: structuredClone(p.pages[p.pages.length - 1].bg) }] }));
        setPageIndex(project.pages.length);
        setSelectedId(null);
      },
      duplicatePage: (index) => {
        step((p) => {
          const pages = [...p.pages];
          pages.splice(index + 1, 0, duplicatePage(p.pages[index]));
          return { ...p, pages };
        });
        setPageIndex(index + 1);
        setSelectedId(null);
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
        setSelectedId(null);
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
      pageUpdater: (fn) => (p) => updatePageAt(p, Math.min(pageIndex, p.pages.length - 1), fn),
    };
  }, [set, pageIndex, project.pages]);

  const goToPage = useCallback((i) => {
    setPageIndex(i);
    setSelectedId(null);
  }, []);

  const load = useCallback(
    (p, startPage = 0) => {
      reset(p);
      setPageIndex(startPage);
      setSelectedId(null);
    },
    [reset],
  );

  return {
    project,
    page,
    pageIndex: Math.min(pageIndex, project.pages.length - 1),
    selected,
    selectedId,
    select: setSelectedId,
    goToPage,
    load,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    ...ops,
  };
}
