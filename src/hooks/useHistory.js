import { useCallback, useEffect, useRef, useState } from "react";

const LIMIT = 100;
const SETTLE_MS = 350;

/**
 * Design state with undo/redo. Rapid changes (dragging a slider) are folded
 * into one history entry once they settle, so undo jumps back a whole gesture
 * instead of one pixel at a time.
 *
 * History lives in refs and is only touched from event handlers, never from
 * inside React state updaters (those may run twice in StrictMode).
 */
export function useHistory(initial) {
  const [present, setPresent] = useState(initial);
  const presentRef = useRef(initial);
  const past = useRef([]);
  const future = useRef([]);
  const committed = useRef(initial);
  const timer = useRef(0);
  const [, setVersion] = useState(0);
  const bump = () => setVersion((n) => n + 1);

  const show = (value) => {
    presentRef.current = value;
    setPresent(value);
  };

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = 0;
    const value = presentRef.current;
    if (value === committed.current) return;
    past.current = [...past.current, committed.current].slice(-LIMIT);
    future.current = [];
    committed.current = value;
    bump();
  }, []);

  const set = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(presentRef.current) : updater;
      if (next === presentRef.current) return;
      show(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SETTLE_MS);
      if (future.current.length) bump();
    },
    [flush],
  );

  /** Replace state and clear history (new / open file). */
  const reset = useCallback((value) => {
    clearTimeout(timer.current);
    timer.current = 0;
    past.current = [];
    future.current = [];
    committed.current = value;
    show(value);
    bump();
  }, []);

  const undo = useCallback(() => {
    flush();
    const prior = past.current.at(-1);
    if (prior === undefined) return;
    past.current = past.current.slice(0, -1);
    future.current = [committed.current, ...future.current];
    committed.current = prior;
    show(prior);
    bump();
  }, [flush]);

  const redo = useCallback(() => {
    flush();
    const next = future.current[0];
    if (next === undefined) return;
    future.current = future.current.slice(1);
    past.current = [...past.current, committed.current];
    committed.current = next;
    show(next);
    bump();
  }, [flush]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    design: present,
    set,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0 || present !== committed.current,
    canRedo: future.current.length > 0,
  };
}
