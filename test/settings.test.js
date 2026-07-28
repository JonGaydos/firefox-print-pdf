const test = require("node:test");
const assert = require("node:assert");
const { DEFAULTS, mergeSettings, buildTemplate } = require("../src/settings.js");

test("returns the defaults for empty storage", () => {
  assert.deepStrictEqual(mergeSettings({}), DEFAULTS);
});

test("returns the defaults for null", () => {
  assert.deepStrictEqual(mergeSettings(null), DEFAULTS);
});

test("defaults are the documented values", () => {
  assert.deepStrictEqual(DEFAULTS, {
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
  });
});

test("applies stored values over the defaults", () => {
  const result = mergeSettings({ headers: true, orientation: "landscape" });
  assert.strictEqual(result.headers, true);
  assert.strictEqual(result.orientation, "landscape");
  assert.strictEqual(result.backgrounds, true);
});

test("applies a stored paper size and margins", () => {
  const result = mergeSettings({ paperSize: "a4", margins: "none" });
  assert.strictEqual(result.paperSize, "a4");
  assert.strictEqual(result.margins, "none");
});

test("ignores a boolean setting stored as a string", () => {
  assert.strictEqual(mergeSettings({ headers: "true" }).headers, false);
});

test("ignores a value outside the allowed list", () => {
  assert.strictEqual(mergeSettings({ paperSize: "tabloid" }).paperSize, "letter");
});

test("ignores unknown keys", () => {
  assert.deepStrictEqual(mergeSettings({ nonsense: 1 }), DEFAULTS);
});

test("buildTemplate covers the default", () => {
  assert.strictEqual(
    buildTemplate({ fnDate: true, fnTime: false, fnHostname: false, fnDateFirst: false }),
    "{title} {date}");
});

test("buildTemplate places the stamp before the title", () => {
  assert.strictEqual(
    buildTemplate({ fnDate: true, fnTime: true, fnHostname: false, fnDateFirst: true }),
    "{date} {time} {title}");
});

test("buildTemplate appends the hostname last", () => {
  assert.strictEqual(
    buildTemplate({ fnDate: true, fnTime: false, fnHostname: true, fnDateFirst: false }),
    "{title} {date} {hostname}");
});

test("buildTemplate with nothing checked is the title alone", () => {
  assert.strictEqual(
    buildTemplate({ fnDate: false, fnTime: false, fnHostname: false, fnDateFirst: false }),
    "{title}");
});

test("builder settings derive the template", () => {
  const result = mergeSettings({ fnDate: true, fnTime: true, fnDateFirst: true, customTemplate: false });
  assert.strictEqual(result.template, "{date} {time} {title}");
});

test("custom mode preserves the stored template verbatim", () => {
  const result = mergeSettings({ customTemplate: true, template: "{year}-{month} {title}" });
  assert.strictEqual(result.template, "{year}-{month} {title}");
});

test("infers builder state from a 1.1 template", () => {
  const result = mergeSettings({ template: "{date} {title}" });
  assert.strictEqual(result.fnDate, true);
  assert.strictEqual(result.fnDateFirst, true);
  assert.strictEqual(result.customTemplate, false);
});

test("infers custom mode from an inexpressible template", () => {
  const result = mergeSettings({ template: "{title} saved {date}" });
  assert.strictEqual(result.customTemplate, true);
  assert.strictEqual(result.template, "{title} saved {date}");
});

test("migrates a legacy datePosition to builder state", () => {
  const result = mergeSettings({ datePosition: "before" });
  assert.strictEqual(result.template, "{date} {title}");
  assert.strictEqual(result.fnDateFirst, true);
  assert.strictEqual(result.customTemplate, false);
});

test("migrates datePosition none to date unchecked", () => {
  const result = mergeSettings({ datePosition: "none" });
  assert.strictEqual(result.template, "{title}");
  assert.strictEqual(result.fnDate, false);
});

test("stored builder state is not overridden by inference", () => {
  const result = mergeSettings({ fnDate: false, customTemplate: false, template: "{title} {date}" });
  assert.strictEqual(result.fnDate, false);
  assert.strictEqual(result.template, "{title}");
});
