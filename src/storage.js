// Drop-in replacement for the window.storage API that exists inside Claude
// artifacts. Same async shape, backed by localStorage, so Game.jsx calls it
// exactly as before:
//
//   window.storage.get(key)        -> { key, value }   (throws if missing)
//   window.storage.set(key, value) -> { key, value }
//   window.storage.delete(key)     -> { key, deleted: true }
//
// Every localStorage touch is wrapped: a full quota, Safari private browsing,
// or a locked-down WebView must never throw past this file. If a write can't
// land in localStorage, an in-memory map holds it so the current session keeps
// playing (that save just won't survive a reload).
//
// Precedence rule: `memory` only ever holds values NEWER than localStorage
// (it is written on failure and cleared on the next successful write), so a
// read checks memory first, then localStorage.

const memory = new Map();
let warned = false;

function warnOnce(err) {
  if (warned) return;
  warned = true;
  console.warn("[storage] localStorage unavailable, using in-memory fallback:", err);
}

function readItem(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    return localStorage.getItem(key);
  } catch (err) {
    warnOnce(err);
    return null;
  }
}

function writeItem(key, value) {
  try {
    localStorage.setItem(key, value);
    memory.delete(key); // localStorage is now current; drop any stale fallback
  } catch (err) {
    warnOnce(err);
    memory.set(key, value);
  }
}

function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    warnOnce(err);
  }
  memory.delete(key);
}

window.storage = {
  async get(key) {
    const value = readItem(key);
    if (value === null || value === undefined) {
      throw new Error(`No value stored for key: ${key}`);
    }
    return { key, value };
  },

  async set(key, value) {
    writeItem(key, value);
    return { key, value };
  },

  async delete(key) {
    removeItem(key);
    return { key, deleted: true };
  },
};
