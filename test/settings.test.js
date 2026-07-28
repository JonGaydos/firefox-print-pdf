const test = require("node:test");
const assert = require("node:assert");
const { DEFAULTS, mergeSettings } = require("../src/settings.js");

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

test("accepts a stored template", () => {
  assert.strictEqual(mergeSettings({ template: "{date} {title}" }).template, "{date} {title}");
});

test("ignores a blank template", () => {
  assert.strictEqual(mergeSettings({ template: "   " }).template, "{title} {date}");
});

test("ignores a non-string template", () => {
  assert.strictEqual(mergeSettings({ template: 7 }).template, "{title} {date}");
});

test("migrates datePosition before to a template", () => {
  assert.strictEqual(mergeSettings({ datePosition: "before" }).template, "{date} {title}");
});

test("migrates datePosition none to a template", () => {
  assert.strictEqual(mergeSettings({ datePosition: "none" }).template, "{title}");
});

test("a stored template wins over a legacy datePosition", () => {
  const result = mergeSettings({ datePosition: "none", template: "{time} {title}" });
  assert.strictEqual(result.template, "{time} {title}");
});
