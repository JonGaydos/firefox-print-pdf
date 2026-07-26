const test = require("node:test");
const assert = require("node:assert");
const { buildFilename, stripSiteName } = require("../src/filename.js");

const AFTER = { datePosition: "after", stripSite: false };
const BEFORE = { datePosition: "before", stripSite: false };
const NONE = { datePosition: "none", stripSite: false };
const STRIP = { datePosition: "none", stripSite: true };
const DATE = new Date(2026, 6, 25);
const URL = "https://example.com/article";

test("puts the date after the title by default", () => {
  assert.strictEqual(buildFilename("Quarterly Report", URL, AFTER, DATE),
    "Quarterly Report 2026-07-25");
});

test("puts the date before the title when asked", () => {
  assert.strictEqual(buildFilename("Quarterly Report", URL, BEFORE, DATE),
    "2026-07-25 Quarterly Report");
});

test("omits the date when asked", () => {
  assert.strictEqual(buildFilename("Quarterly Report", URL, NONE, DATE),
    "Quarterly Report");
});

test("zero pads single digit months and days", () => {
  assert.strictEqual(buildFilename("Report", URL, AFTER, new Date(2026, 0, 5)),
    "Report 2026-01-05");
});

test("collapses whitespace and trims", () => {
  assert.strictEqual(buildFilename("  Spaced   out\ntitle  ", URL, NONE, DATE),
    "Spaced out title");
});

test("falls back to the hostname when there is no title", () => {
  assert.strictEqual(buildFilename("", URL, NONE, DATE), "example.com");
});

test("falls back to page when there is no title and no valid url", () => {
  assert.strictEqual(buildFilename("", "not a url", NONE, DATE), "page");
});

test("truncates a long title but keeps the date", () => {
  const result = buildFilename("A".repeat(200), URL, AFTER, DATE);
  assert.strictEqual(result, `${"A".repeat(120)} 2026-07-25`);
});

test("strips a trailing site name when enabled", () => {
  assert.strictEqual(buildFilename("Council Approves Budget - Example News", URL, STRIP, DATE),
    "Council Approves Budget");
});

test("strips a pipe separated site name", () => {
  assert.strictEqual(buildFilename("Council Approves Budget | Example News", URL, STRIP, DATE),
    "Council Approves Budget");
});

test("strips only the last segment", () => {
  assert.strictEqual(buildFilename("Long Article Name - Section - Example News", URL, STRIP, DATE),
    "Long Article Name - Section");
});

test("leaves the title alone when stripping is disabled", () => {
  assert.strictEqual(buildFilename("Council Approves Budget - Example News", URL, NONE, DATE),
    "Council Approves Budget - Example News");
});

test("does not strip when too little title would remain", () => {
  assert.strictEqual(stripSiteName("Budget - Example News"), "Budget - Example News");
});

test("does not strip when the trailing segment is too long", () => {
  const long = "Some Article - " + "B".repeat(41);
  assert.strictEqual(stripSiteName(long), long);
});

test("does not strip a hostname fallback", () => {
  assert.strictEqual(buildFilename("", "https://news-site.com/x", STRIP, DATE),
    "news-site.com");
});
