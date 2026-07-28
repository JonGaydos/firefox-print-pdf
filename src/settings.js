const DEFAULTS = {
  headers: false,
  backgrounds: true,
  orientation: "portrait",
  paperSize: "letter",
  margins: "normal",
  template: "{title} {date}",
  stripSite: false,
  showContextMenu: true,
};

const ALLOWED_VALUES = {
  orientation: ["portrait", "landscape"],
  paperSize: ["letter", "legal", "a4"],
  margins: ["normal", "narrow", "none"],
};

const TEMPLATE_BY_DATE_POSITION = {
  after: "{title} {date}",
  before: "{date} {title}",
  none: "{title}",
};

function mergeSettings(stored) {
  const merged = { ...DEFAULTS };
  if (!stored || typeof stored !== "object") {
    return merged;
  }
  for (const key of Object.keys(DEFAULTS)) {
    if (key === "template") {
      continue;
    }
    const value = stored[key];
    if (typeof DEFAULTS[key] === "boolean") {
      if (typeof value === "boolean") {
        merged[key] = value;
      }
    } else if (ALLOWED_VALUES[key].includes(value)) {
      merged[key] = value;
    }
  }
  if (typeof stored.template === "string" && stored.template.trim()) {
    merged.template = stored.template;
  } else if (TEMPLATE_BY_DATE_POSITION[stored.datePosition]) {
    merged.template = TEMPLATE_BY_DATE_POSITION[stored.datePosition];
  }
  return merged;
}

async function loadSettings() {
  const keys = Object.keys(DEFAULTS).concat("datePosition");
  return mergeSettings(await browser.storage.sync.get(keys));
}

if (typeof module !== "undefined") {
  module.exports = { DEFAULTS, mergeSettings };
}
