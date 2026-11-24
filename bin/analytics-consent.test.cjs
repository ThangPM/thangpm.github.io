const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(new URL("../assets/js/analytics-consent.js", `file://${__filename}`), "utf8");

function setup(choice, storageUnavailable = false) {
  const listeners = {};
  const tags = [];
  const warnings = [];
  const banner = { hidden: true, querySelector: () => ({ focus() {} }) };
  const settings = { hidden: true, focus() {}, addEventListener: (_, callback) => (listeners.settings = callback) };
  const buttons = ["granted", "denied"].map((value) => ({
    dataset: { analyticsConsent: value },
    addEventListener: (_, callback) => (listeners[value] = callback),
  }));
  const storage = new Map(choice ? [["analytics-consent", choice]] : []);
  const window = {};
  runInNewContext(source, {
    window,
    document: {
      getElementById: (id) => (id === "analytics-consent" ? banner : { dataset: { measurementId: "G-TEST" } }),
      querySelectorAll: (selector) => (selector === "[data-analytics-consent]" ? buttons : [settings]),
      querySelector: () => settings,
      createElement: () => ({}),
      head: { appendChild: (tag) => tags.push(tag) },
    },
    localStorage: {
      getItem: (key) => {
        if (storageUnavailable) throw new Error("Storage unavailable");
        return storage.get(key) ?? null;
      },
      setItem: (key, value) => {
        if (storageUnavailable) throw new Error("Storage unavailable");
        storage.set(key, value);
      },
    },
    console: { warn: (...args) => warnings.push(args) },
  });
  return { banner, listeners, tags, storage, window, warnings };
}

test("new and invalid preferences never load analytics before consent", () => {
  for (const choice of [undefined, "invalid"]) {
    const state = setup(choice);
    assert.equal(state.banner.hidden, false);
    assert.equal(state.tags.length, 0);
    state.listeners.denied();
    assert.equal(state.tags.length, 0);
    assert.equal(state.storage.get("analytics-consent"), "denied");
  }
  assert.equal(setup("denied").banner.hidden, true);
  assert.equal(setup("denied").tags.length, 0);
});

test("grant loads once, persists, and revocation disables measurement", () => {
  const state = setup();
  state.listeners.granted();
  state.listeners.granted();
  assert.equal(state.tags.length, 1);
  assert.equal(state.tags[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST");
  assert.equal(state.storage.get("analytics-consent"), "granted");
  state.listeners.settings();
  assert.equal(state.banner.hidden, false);
  state.listeners.denied();
  assert.equal(state.window["ga-disable-G-TEST"], true);
  assert.equal(state.window.dataLayer.at(-1)[2].analytics_storage, "denied");
  state.listeners.granted();
  assert.equal(state.window["ga-disable-G-TEST"], false);
  assert.equal(state.tags.length, 1);
  assert.equal(setup("granted").tags.length, 1);
});

test("unavailable storage keeps analytics opt-in and surfaces the failure", () => {
  const state = setup(undefined, true);
  assert.equal(state.tags.length, 0);
  assert.equal(state.banner.hidden, false);
  assert.equal(state.warnings.length, 1);
  state.listeners.granted();
  assert.equal(state.tags.length, 1);
  assert.equal(state.warnings.length, 2);
});
