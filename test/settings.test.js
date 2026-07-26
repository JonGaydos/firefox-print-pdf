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
    datePosition: "after",
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

test("ignores a boolean setting stored as a string", () => {
  assert.strictEqual(mergeSettings({ headers: "true" }).headers, false);
});

test("ignores a value outside the allowed list", () => {
  assert.strictEqual(mergeSettings({ datePosition: "sideways" }).datePosition, "after");
});

test("ignores unknown keys", () => {
  assert.deepStrictEqual(mergeSettings({ nonsense: 1 }), DEFAULTS);
});
