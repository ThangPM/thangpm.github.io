(() => {
  const scene = document.querySelector("[data-document-scene]");
  if (!scene) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stages = ["sources", "agents", "retrieve", "synthesize", "attribute", "evaluate"];
  const descriptionPanel = scene.querySelector("[data-scene-description-panel]");
  const canvas = scene.querySelector(".scene-canvas");
  let inView = true;
  let timer = null;

  function updateMotion() {
    const allowed = !reducedMotion.matches;
    const running = allowed && inView && !document.hidden;
    scene.dataset.running = String(running);
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    if (running) {
      timer = window.setTimeout(() => {
        timer = null;
        selectStage(stages[(stages.indexOf(scene.dataset.activeStage) + 1) % stages.length]);
      }, 5200);
    }
  }

  function selectStage(stage, manual = false) {
    descriptionPanel.setAttribute("aria-live", manual ? "polite" : "off");
    scene.dataset.activeStage = stage;
    scene.querySelectorAll("[data-scene-select]").forEach((control) => {
      control.setAttribute("aria-pressed", String(control.dataset.sceneSelect === stage));
    });
    scene.querySelectorAll("[data-scene-description]").forEach((description) => {
      description.hidden = description.dataset.sceneDescription !== stage;
    });
    if (manual) {
      canvas.getAnimations({ subtree: true }).forEach((animation) => {
        animation.currentTime = 0;
      });
    }
    updateMotion();
  }

  scene.querySelectorAll("[data-scene-controls]").forEach((controls) => {
    controls.hidden = false;
  });
  scene.querySelectorAll("[data-scene-select]").forEach((button) => {
    button.addEventListener("click", () => selectStage(button.dataset.sceneSelect, true));
  });
  selectStage(scene.dataset.activeStage);
  reducedMotion.addEventListener("change", updateMotion);
  document.addEventListener("visibilitychange", updateMotion);

  if ("IntersectionObserver" in window) {
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        updateMotion();
      },
      { threshold: 0.15 }
    );
    observer.observe(canvas);
  }
})();
