import { useCallback, useEffect, useRef, useState } from "react";
import { storeRead, storeRemove, storeWrite } from "../lib/native.js";
import { newId, parseProjectFile, serializeProject } from "../lib/project.js";

/**
 * The projects library: every project autosaves into the app's data folder.
 * The index (names, dates, thumbnails) lives in "projects"; each project in
 * "project-<id>".
 */
export function useLibrary() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    storeRead("projects").then((d) => {
      if (Array.isArray(d?.items)) setItems(d.items.filter((x) => typeof x?.id === "string"));
      setLoaded(true);
    });
  }, []);

  const writeIndex = (next) => {
    itemsRef.current = next;
    setItems(next);
    return storeWrite("projects", { v: 1, items: next }).catch(() => {});
  };

  /** Save a project (creates the entry if needed). Returns the id. */
  const save = useCallback(async (id, project, extra = {}) => {
    const pid = id ?? newId("p");
    const text = serializeProject(project);
    await storeWrite(`project-${pid}`, JSON.parse(text));
    const now = Date.now();
    const cur = itemsRef.current.find((x) => x.id === pid);
    const entry = { createdAt: now, ...cur, ...extra, id: pid, name: project.name, updatedAt: now, canvas: project.canvas, pages: project.pages.length };
    await writeIndex([entry, ...itemsRef.current.filter((x) => x.id !== pid)]);
    return pid;
  }, []);

  const setThumb = useCallback((id, thumb) => {
    const next = itemsRef.current.map((x) => (x.id === id ? { ...x, thumb } : x));
    writeIndex(next);
  }, []);

  const open = useCallback(async (id) => {
    const data = await storeRead(`project-${id}`);
    if (!data) throw new Error("That project couldn't be found.");
    return parseProjectFile(JSON.stringify(data));
  }, []);

  const rename = useCallback(async (id, name) => {
    const project = await open(id);
    project.name = name;
    await save(id, project);
  }, [open, save]);

  const duplicate = useCallback(async (id) => {
    const project = await open(id);
    project.name = `${project.name} copy`;
    const thumb = itemsRef.current.find((x) => x.id === id)?.thumb;
    return save(null, project, { thumb, path: null });
  }, [open, save]);

  const remove = useCallback(async (id) => {
    await storeRemove(`project-${id}`);
    await writeIndex(itemsRef.current.filter((x) => x.id !== id));
  }, []);

  return { items, loaded, save, open, rename, duplicate, remove, setThumb };
}
