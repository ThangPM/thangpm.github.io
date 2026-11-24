const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(new URL("../assets/js/document-intelligence.js", `file://${__filename}`), "utf8");

function element(dataset = {}) {
  return {
    dataset,
    hidden: false,
    attributes: {},
    listeners: {},
    addEventListener(event, callback) {
      this.listeners[event] = callback;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}

function setup(reduced = false) {
  const stages = ["sources", "retrieve", "agents", "synthesize", "attribute", "evaluate"];
  const buttons = stages.map((sceneSelect) => element({ sceneSelect }));
  const descriptions = stages.map((sceneDescription) => element({ sceneDescription }));
  const controls = element();
  const scene = element({ activeStage: "sources" });
  const panel = element();
  const timers = new Map();
  const styles = new Map();
  const preference = element();
  preference.matches = reduced;
  let intersection;
  let nextTimer = 0;
  scene.style = { setProperty: (key, value) => styles.set(key, value) };
  scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });
  scene.querySelector = (selector) =>
    ({
      "[data-scene-controls]": controls,
      "[data-scene-description-panel]": panel,
      ".scene-canvas": { getAnimations: () => [] },
    })[selector];
  scene.querySelectorAll = (selector) =>
    ({
      "[data-scene-select]": buttons,
      "[data-scene-description]": descriptions,
      "[data-scene-controls]": [controls],
    })[selector];
  const document = {
    hidden: false,
    querySelector: () => scene,
    addEventListener: (event, callback) => (document[event] = callback),
  };
  runInNewContext(source, {
    document,
    window: {
      matchMedia: (query) => (query.includes("reduced-motion") ? preference : { matches: true }),
      setTimeout: (callback) => {
        timers.set(++nextTimer, callback);
        return nextTimer;
      },
      clearTimeout: (id) => timers.delete(id),
      IntersectionObserver: class {
        constructor(callback) {
          intersection = callback;
        }
        observe() {}
      },
    },
  });
  return {
    scene,
    buttons,
    descriptions,
    preference,
    document,
    styles,
    timers,
    panel,
    advance: () => {
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      callback();
    },
    intersect: (isIntersecting) => intersection([{ isIntersecting }]),
  };
}

test("each stage selection exposes exactly its explanation and pressed control", () => {
  const state = setup();
  assert.equal(state.descriptions.filter((p) => !p.hidden)[0].dataset.sceneDescription, "sources");
  for (const button of state.buttons) {
    button.listeners.click();
    assert.equal(state.scene.dataset.activeStage, button.dataset.sceneSelect);
    assert.equal(state.buttons.filter((b) => b.attributes["aria-pressed"] === "true").length, 1);
    assert.ok(
      state.buttons.filter((b) => b.attributes["aria-pressed"] === "true").every((b) => b.dataset.sceneSelect === button.dataset.sceneSelect)
    );
    assert.equal(state.descriptions.filter((p) => !p.hidden).length, 1);
    assert.equal(state.descriptions.find((p) => !p.hidden).dataset.sceneDescription, button.dataset.sceneSelect);
  }
});

test("automatic motion pauses off-screen and in hidden tabs", () => {
  const state = setup();
  assert.equal(state.scene.dataset.running, "true");
  state.intersect(false);
  assert.equal(state.scene.dataset.running, "false");
  assert.equal(state.timers.size, 0);
  state.intersect(true);
  assert.equal(state.scene.dataset.running, "true");
  state.document.hidden = true;
  state.document.visibilitychange();
  assert.equal(state.scene.dataset.running, "false");
  state.document.hidden = false;
  state.document.visibilitychange();
  assert.equal(state.scene.dataset.running, "true");
});

test("reduced-motion preference disables automatic progression, including live changes", () => {
  const state = setup(true);
  assert.equal(state.scene.dataset.running, "false");
  assert.equal(state.timers.size, 0);
  state.preference.matches = false;
  state.preference.listeners.change();
  assert.equal(state.scene.dataset.running, "true");
  state.preference.matches = true;
  state.preference.listeners.change();
  assert.equal(state.scene.dataset.running, "false");
  assert.equal(state.timers.size, 0);
});

test("walkthrough follows the whole sequence and loops from a clicked stage", () => {
  const state = setup();
  for (const stage of ["agents", "retrieve", "synthesize", "attribute", "evaluate", "sources"]) {
    state.advance();
    assert.equal(state.scene.dataset.activeStage, stage);
    assert.equal(state.timers.size, 1);
    assert.equal(state.panel.attributes["aria-live"], "off");
  }
  state.buttons.find((b) => b.dataset.sceneSelect === "attribute").listeners.click();
  assert.equal(state.scene.dataset.activeStage, "attribute");
  assert.equal(state.timers.size, 1);
  state.advance();
  assert.equal(state.scene.dataset.activeStage, "evaluate");
  state.advance();
  assert.equal(state.scene.dataset.activeStage, "sources");
});
