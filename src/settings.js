const DEFAULTS = {
  headers: false,
  backgrounds: true,
  orientation: "portrait",
  paperSize: "letter",
  margins: "normal",
  fnDate: true,
  fnTime: false,
  fnHostname: false,
  fnDateFirst: false,
  customTemplate: false,
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

const BUILDER_KEYS = ["fnDate", "fnTime", "fnHostname", "fnDateFirst", "customTemplate"];

function buildTemplate(state) {
  const stamp = [state.fnDate ? "{date}" : "", state.fnTime ? "{time}" : ""]
    .filter(Boolean)
    .join(" ");
  const parts = state.fnDateFirst ? [stamp, "{title}"] : ["{title}", stamp];
  if (state.fnHostname) {
    parts.push("{hostname}");
  }
  return parts.filter(Boolean).join(" ");
}

function inferBuilder(template) {
  for (const fnDateFirst of [false, true]) {
    for (const fnDate of [true, false]) {
      for (const fnTime of [false, true]) {
        for (const fnHostname of [false, true]) {
          const state = { fnDate, fnTime, fnHostname, fnDateFirst };
          if (buildTemplate(state) === template) {
            return { ...state, customTemplate: false };
          }
        }
      }
    }
  }
  return { customTemplate: true };
}

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
  const hasBuilderState = BUILDER_KEYS.some((key) => typeof stored[key] === "boolean");
  if (!hasBuilderState) {
    Object.assign(merged, inferBuilder(merged.template));
  }
  if (!merged.customTemplate) {
    merged.template = buildTemplate(merged);
  }
  return merged;
}

async function loadSettings() {
  const keys = Object.keys(DEFAULTS).concat("datePosition");
  return mergeSettings(await browser.storage.sync.get(keys));
}

if (typeof module !== "undefined") {
  module.exports = { DEFAULTS, mergeSettings, buildTemplate };
}
