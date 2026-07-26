const DEFAULTS = {
  headers: false,
  backgrounds: true,
  orientation: "portrait",
  datePosition: "after",
  stripSite: false,
  showContextMenu: true,
};

const ALLOWED_VALUES = {
  orientation: ["portrait", "landscape"],
  datePosition: ["after", "before", "none"],
};

function mergeSettings(stored) {
  const merged = { ...DEFAULTS };
  if (!stored || typeof stored !== "object") {
    return merged;
  }
  for (const key of Object.keys(DEFAULTS)) {
    const value = stored[key];
    if (typeof DEFAULTS[key] === "boolean") {
      if (typeof value === "boolean") {
        merged[key] = value;
      }
    } else if (ALLOWED_VALUES[key].includes(value)) {
      merged[key] = value;
    }
  }
  return merged;
}

async function loadSettings() {
  return mergeSettings(await browser.storage.sync.get(Object.keys(DEFAULTS)));
}

if (typeof module !== "undefined") {
  module.exports = { DEFAULTS, mergeSettings };
}
