import { useCallback, useEffect, useState } from "react";
import { storeRead, storeWrite } from "../lib/native.js";
import { sanitizeVehicle } from "../vehicles3d/spec.js";

/** Saved vehicles, kept in the app's data folder (localStorage in the browser). */
export function useHangar() {
  const [list, setList] = useState([]);
  useEffect(() => {
    storeRead("hangar").then((d) => {
      if (Array.isArray(d?.vehicles)) setList(d.vehicles.map(sanitizeVehicle));
    });
  }, []);
  const persist = (next) => {
    setList(next);
    storeWrite("hangar", { v: 1, vehicles: next }).catch(() => {});
  };
  const save = useCallback((v) => {
    setList((cur) => {
      const next = [sanitizeVehicle(v), ...cur.filter((x) => x.id !== v.id)].slice(0, 200);
      storeWrite("hangar", { v: 1, vehicles: next }).catch(() => {});
      return next;
    });
  }, []);
  const remove = useCallback((id) => setList((cur) => {
    const next = cur.filter((x) => x.id !== id);
    storeWrite("hangar", { v: 1, vehicles: next }).catch(() => {});
    return next;
  }), []);
  void persist;
  return { list, save, remove };
}
