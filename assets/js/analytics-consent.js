(() => {
  const banner = document.getElementById("analytics-consent");
  const script = document.getElementById("analytics-script");
  if (!banner || !script) return;

  const storageKey = "analytics-consent";
  let loaded = false;
  let preference = null;

  try {
    preference = localStorage.getItem(storageKey);
  } catch (error) {
    console.warn("Analytics preferences cannot be read; analytics remains opt-in.", error);
  }

  function enableAnalytics() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", script.dataset.measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(script.dataset.measurementId)}`;
    tag.onerror = () => console.warn("Google Analytics could not load. Check network access or content blockers.");
    document.head.appendChild(tag);
  }

  function choosePreference(value) {
    preference = value;
    try {
      localStorage.setItem(storageKey, value);
    } catch (error) {
      console.warn("Analytics preferences cannot be saved; this choice applies only to this page.", error);
    }
    banner.hidden = true;
    if (value === "granted") {
      window[`ga-disable-${script.dataset.measurementId}`] = false;
      if (loaded) window.gtag("consent", "update", { analytics_storage: "granted" });
      enableAnalytics();
    } else if (loaded) {
      window[`ga-disable-${script.dataset.measurementId}`] = true;
      window.gtag("consent", "update", { analytics_storage: "denied" });
    }
    const settingsButton = document.querySelector("[data-analytics-settings]");
    if (settingsButton) settingsButton.focus();
  }

  document.querySelectorAll("[data-analytics-consent]").forEach((button) => {
    button.addEventListener("click", () => choosePreference(button.dataset.analyticsConsent));
  });
  document.querySelectorAll("[data-analytics-settings]").forEach((button) => {
    button.hidden = false;
    button.addEventListener("click", () => {
      banner.hidden = false;
      banner.querySelector("button").focus();
    });
  });

  if (preference === "granted") enableAnalytics();
  banner.hidden = preference === "granted" || preference === "denied";
})();
