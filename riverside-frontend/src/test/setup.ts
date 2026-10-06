import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without this each render leaves its DOM behind and a second test in the same
// file would match markup from the first.
afterEach(cleanup);

// jsdom defines window.localStorage behind a getter, but under this vitest and
// jsdom pairing the getter returns undefined even with a real origin set, while
// sessionStorage works. AuthContext persists the signed-in user there, so without
// this it throws on its first read and cannot be tested.
//
// This is the Storage interface, not a stub: same four operations, same
// string-only values, held in memory for the life of the test file.
if (typeof window.localStorage === "undefined") {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
  };
  Object.defineProperty(window, "localStorage", {
    value: shim,
    configurable: true,
    writable: false,
  });
}


