const test = require("node:test");
const assert = require("node:assert");
const { buildFilename, stripSiteName } = require("../src/filename.js");

const AFTER = { template: "{title} {date}", stripSite: false };
const BEFORE = { template: "{date} {title}", stripSite: false };
const NONE = { template: "{title}", stripSite: false };
const STRIP = { template: "{title}", stripSite: true };
const DATE = new Date(2026, 6, 25, 14, 5);
const URL = "https://example.com/article";

test("renders title then date with the default template", () => {
  assert.strictEqual(buildFilename("Quarterly Report", URL, AFTER, DATE),
    "Quarterly Report 2026-07-25");
});

test("renders date then title", () => {
  assert.strictEqual(buildFilename("Quarterly Report", URL, BEFORE, DATE),
    "2026-07-25 Quarterly Report");
});

test("renders title alone", () => {
  assert.strictEqual(buildFilename("Quarterly Report", URL, NONE, DATE),
    "Quarterly Report");
});

test("renders the time token with a dot separator", () => {
  assert.strictEqual(
    buildFilename("Report", URL, { template: "{title} {date} {time}", stripSite: false }, DATE),
    "Report 2026-07-25 14.05");
});

test("renders the hostname token", () => {
  assert.strictEqual(
    buildFilename("Report", URL, { template: "{hostname} {title}", stripSite: false }, DATE),
    "example.com Report");
});

test("renders year, month, and day tokens", () => {
  assert.strictEqual(
    buildFilename("Report", URL, { template: "{month}-{day}-{year} {title}", stripSite: false }, DATE),
    "07-25-2026 Report");
});

test("leaves unknown tokens as literal text", () => {
  assert.strictEqual(
    buildFilename("Report", URL, { template: "{title} {nonsense}", stripSite: false }, DATE),
    "Report {nonsense}");
});

test("falls back to the title when the template renders empty", () => {
  assert.strictEqual(
    buildFilename("Report", URL, { template: "   ", stripSite: false }, DATE),
    "Report");
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
