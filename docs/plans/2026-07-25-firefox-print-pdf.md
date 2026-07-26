# Print to PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Firefox extension that saves the current page as a PDF in one click, with the filename prefilled from the page title.

**Architecture:** A Manifest V3 event page wrapping two browser APIs, `tabs.saveAsPDF()` for the one-click save and `tabs.print()` for the escape hatch. No content scripts, no message passing, no dependencies. Pure logic (filename building, settings validation) lives in two standalone files that Node can unit test; everything else is browser glue verified by hand.

**Tech Stack:** Plain JavaScript, no build step, no runtime dependencies. `node --test` for unit tests. `web-ext` via `npx` for linting and packaging.

**Spec:** `docs/specs/2026-07-25-firefox-print-pdf-design.md`

## Global Constraints

- Manifest V3. Firefox only. `strict_min_version` is `115.0`.
- Add-on id is `print-to-pdf@jgayd.local`. It must never change; AMO treats a
  changed id as a different add-on.
- Background is an event page (`background.scripts`). Firefox does not support
  `background.service_worker`.
- Classic scripts, not ES modules. Firefox support for `"type": "module"` in
  the background key is undocumented, and the extension targets 115.
- Use the `browser.*` namespace with promises, never callback-style `chrome.*`.
- Permissions are limited to `activeTab`, `storage`, and `menus`. Do not add
  `scripting`, `tabs`, or host permissions without the fallback in Task 1
  being triggered.
- No runtime dependencies and no network requests. The privacy claim in the
  README depends on this staying true.
- Extension source lives in `src/`. Tests, `package.json`, and `docs/` must
  stay out of the packaged zip, which is why `web-ext` is always run with
  `--source-dir=src`.
- No emojis or em dashes anywhere, including UI copy and commit messages.

## File Structure

| Path                   | Responsibility                                             |
| ---------------------- | ---------------------------------------------------------- |
| `src/manifest.json`    | Declaration only                                            |
| `src/settings.js`      | `DEFAULTS`, `mergeSettings()` (pure), `loadSettings()` (browser) |
| `src/filename.js`      | `buildFilename()` and its helpers. Pure, no browser APIs    |
| `src/background.js`    | Entry point listeners, page settings mapping, menus, badges  |
| `src/options.html`     | Settings form markup and styling                            |
| `src/options.js`       | Reads controls into `storage.sync`, restores them on open    |
| `src/icons/icon.svg`   | Toolbar icon, themed via `context-fill`                     |
| `test/filename.test.js`| Unit tests for `buildFilename()`                            |
| `test/settings.test.js`| Unit tests for `mergeSettings()`                            |
| `package.json`         | Test, lint, and build scripts. No dependencies              |
| `README.md`            | Install, signing, update, privacy, shortcut                 |

`settings.js` and `filename.js` end with a two-line CommonJS export shim:

```js
if (typeof module !== "undefined") {
  module.exports = { /* ... */ };
}
```

In Firefox `module` is undefined and the block is skipped. In Node the tests
require the exact file Firefox loads, with no build step and no duplicated
logic. This is the only unusual construct in the codebase and it exists solely
so the pure logic is testable.

## Testing Approach

Tasks 2 and 3 are test-driven, because `buildFilename()` and `mergeSettings()`
are pure functions with real edge cases.

Tasks 1, 4, 5, and 6 have no automated tests. They call browser APIs that open
native dialogs, and a harness capable of asserting against those would be
larger than the extension. Their verification steps are manual, with the exact
action and the exact expected result written out. Perform them; do not assume
them.

Load the extension for manual testing at `about:debugging#/runtime/this-firefox`,
"Load Temporary Add-on", and select `src/manifest.json`. After editing any
file, press Reload on that page. The temporary add-on disappears when Firefox
restarts, which is expected until Task 7.

---

### Task 1: Scaffolding and a working one-click save

Produces a loadable extension whose button saves a PDF with a hardcoded
filename and hardcoded print settings. This is deliberately first: nothing
else can be verified until the extension loads, and it settles the open
question of whether `saveAsPDF` accepts `activeTab`.

**Files:**
- Create: `package.json`
- Create: `src/manifest.json`
- Create: `src/background.js`
- Create: `src/icons/icon.svg`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: `savePdf()`, `showError(message)`, `pageSettings(settings)` in the
  background global scope. Later tasks call all three.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
web-ext-artifacts/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "firefox-print-pdf",
  "version": "1.0.0",
  "private": true,
  "description": "Firefox extension that saves the current page as a PDF in one click.",
  "scripts": {
    "test": "node --test test/",
    "lint": "npx --yes web-ext lint --source-dir=src",
    "build": "npx --yes web-ext build --source-dir=src --artifacts-dir=dist --overwrite-dest"
  }
}
```

- [ ] **Step 3: Create `src/icons/icon.svg`**

`context-fill` is a Firefox extension to SVG that makes the icon adopt the
toolbar's text color, so it stays legible in both light and dark themes.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <path d="M9.25 1.75H4.5a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5z"
        fill="none" stroke="context-fill" stroke-opacity="context-fill-opacity"
        stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M9.25 1.75V5h3.25"
        fill="none" stroke="context-fill" stroke-opacity="context-fill-opacity"
        stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M8 7.25v3.5M6.6 9.35 8 10.75l1.4-1.4"
        fill="none" stroke="context-fill" stroke-opacity="context-fill-opacity"
        stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 4: Create `src/manifest.json`**

`storage`, `menus`, and `options_ui` are added in later tasks, when the files
they point at exist. Declaring them now would fail lint.

```json
{
  "manifest_version": 3,
  "name": "Print to PDF",
  "version": "1.0.0",
  "description": "Save the current page as a PDF in one click.",
  "browser_specific_settings": {
    "gecko": {
      "id": "print-to-pdf@jgayd.local",
      "strict_min_version": "115.0"
    }
  },
  "permissions": ["activeTab"],
  "background": {
    "scripts": ["background.js"]
  },
  "action": {
    "default_title": "Save as PDF",
    "default_icon": "icons/icon.svg"
  },
  "commands": {
    "_execute_action": {
      "suggested_key": { "default": "Ctrl+Shift+X" },
      "description": "Save the page as a PDF"
    }
  },
  "icons": {
    "48": "icons/icon.svg",
    "96": "icons/icon.svg"
  }
}
```

- [ ] **Step 5: Create `src/background.js`**

The settings object is inlined here and replaced in Task 3. `pageSettings()`
already takes a settings argument so that Task 3 is a wiring change, not a
rewrite.

```js
const ERROR_BADGE_MS = 2000;

const TEMPORARY_SETTINGS = {
  headers: false,
  backgrounds: true,
  orientation: "portrait",
};

function pageSettings(settings) {
  const stamps = settings.headers;
  return {
    headerLeft: stamps ? "&T" : "",
    headerCenter: "",
    headerRight: stamps ? "&U" : "",
    footerLeft: stamps ? "&PT" : "",
    footerCenter: "",
    footerRight: stamps ? "&D" : "",
    showBackgroundColors: settings.backgrounds,
    showBackgroundImages: settings.backgrounds,
    orientation: settings.orientation === "landscape" ? 1 : 0,
    shrinkToFit: true,
  };
}

async function showError(message) {
  console.error("Print to PDF:", message);
  await browser.action.setBadgeBackgroundColor({ color: "#d70022" });
  await browser.action.setBadgeText({ text: "!" });
  setTimeout(() => browser.action.setBadgeText({ text: "" }), ERROR_BADGE_MS);
}

async function savePdf() {
  try {
    const settings = TEMPORARY_SETTINGS;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error("No active tab");
    }
    await browser.tabs.saveAsPDF({
      ...pageSettings(settings),
      toFileName: tab.title || "page",
    });
  } catch (error) {
    await showError(error.message);
  }
}

browser.action.onClicked.addListener(() => {
  savePdf();
});
```

- [ ] **Step 6: Lint the extension**

Run: `npm run lint`
Expected: no errors. Warnings about a missing `homepage_url` or similar
metadata are acceptable; anything reported as an error is not.

- [ ] **Step 7: Load it in Firefox and save a page**

Open `about:debugging#/runtime/this-firefox`, "Load Temporary Add-on",
select `src/manifest.json`. Pin the button to the toolbar from the extensions
puzzle-piece menu. Navigate to any ordinary article page and click the button.

Expected: the OS Save dialog opens, prefilled with the page title and a `.pdf`
extension. Saving produces a readable PDF with no header or footer text and
with background colors rendered.

**If the call fails with a permission error**, the open question in the spec
has resolved the other way. Change `"permissions": ["activeTab"]` to
`"permissions": ["tabs"]` in `src/manifest.json`, reload, and retest. Record
which one was needed in the README in Task 7.

- [ ] **Step 8: Verify the keyboard shortcut**

Press `Ctrl+Shift+X` on an ordinary page, then again with the cursor inside a
text input on that page.

Expected: the same Save dialog both times. If nothing happens in either case,
the combination is claimed by something else. Change `suggested_key.default`
to `Ctrl+Shift+F`, reload, retest, and record the working choice for the README.

- [ ] **Step 9: Verify the error badge**

Open `about:preferences` and click the button.

Expected: a red `!` badge on the toolbar icon for about two seconds, and an
error logged to the console at `about:debugging` under Inspect.

- [ ] **Step 10: Commit**

```bash
git add .gitignore package.json src/
git commit -m "Add extension skeleton with one-click PDF save"
```

---

### Task 2: Filename builder

**Files:**
- Create: `src/filename.js`
- Create: `test/filename.test.js`
- Modify: `src/manifest.json` (background scripts list)
- Modify: `src/background.js` (call `buildFilename`)

**Interfaces:**
- Consumes: `savePdf()` from Task 1
- Produces: `buildFilename(title, url, settings, date) -> string`, where
  `settings` needs only `datePosition` (`"after" | "before" | "none"`) and
  `stripSite` (boolean), and `date` is a `Date`. Also exports `stripSiteName`,
  `formatDate`, and `MAX_TITLE_LENGTH` for tests.

- [ ] **Step 1: Write the failing tests**

Create `test/filename.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/filename.js'`.

- [ ] **Step 3: Write `src/filename.js`**

The regular expression in `stripSiteName` uses a greedy `.*` so that it matches
the *last* separator in the title rather than the first.

```js
const MAX_TITLE_LENGTH = 120;
const MAX_SITE_LENGTH = 40;
const MIN_TITLE_REMAINING = 10;
const SITE_SUFFIX = /^(.*\S)\s+[-|–—·]\s+(\S.*)$/;

function formatDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function stripSiteName(title) {
  const match = SITE_SUFFIX.exec(title);
  if (!match) {
    return title;
  }
  const [, head, tail] = match;
  if (tail.length > MAX_SITE_LENGTH || head.length < MIN_TITLE_REMAINING) {
    return title;
  }
  return head;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname || "page";
  } catch (error) {
    return "page";
  }
}

function buildFilename(title, url, settings, date) {
  let base = String(title || "").replace(/\s+/g, " ").trim();
  if (base && settings.stripSite) {
    base = stripSiteName(base);
  }
  if (!base) {
    base = hostnameOf(url);
  }
  if (base.length > MAX_TITLE_LENGTH) {
    base = base.slice(0, MAX_TITLE_LENGTH).trim();
  }
  if (settings.datePosition === "none") {
    return base;
  }
  const stamp = formatDate(date);
  return settings.datePosition === "before" ? `${stamp} ${base}` : `${base} ${stamp}`;
}

if (typeof module !== "undefined") {
  module.exports = { buildFilename, stripSiteName, formatDate, MAX_TITLE_LENGTH };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 15 tests.

- [ ] **Step 5: Load the module in the background page**

In `src/manifest.json`, change the background block to:

```json
  "background": {
    "scripts": ["filename.js", "background.js"]
  },
```

Order matters. Classic background scripts share one global scope and run in
the order listed, so `filename.js` must come before `background.js`.

- [ ] **Step 6: Call it from `savePdf()`**

In `src/background.js`, add the two filename keys to `TEMPORARY_SETTINGS`:

```js
const TEMPORARY_SETTINGS = {
  headers: false,
  backgrounds: true,
  orientation: "portrait",
  datePosition: "after",
  stripSite: false,
};
```

and replace the `toFileName` line inside `savePdf()`:

```js
    await browser.tabs.saveAsPDF({
      ...pageSettings(settings),
      toFileName: buildFilename(tab.title, tab.url, settings, new Date()),
    });
```

- [ ] **Step 7: Verify in Firefox**

Reload the add-on at `about:debugging` and click the button on an article page.

Expected: the Save dialog is prefilled with the page title followed by today's
date, for example `Council Approves Budget 2026-07-25`.

- [ ] **Step 8: Commit**

```bash
git add src/filename.js src/background.js src/manifest.json test/filename.test.js
git commit -m "Build the suggested filename from the page title and date"
```

---

### Task 3: Settings storage

**Files:**
- Create: `src/settings.js`
- Create: `test/settings.test.js`
- Modify: `src/manifest.json` (permissions, background scripts list)
- Modify: `src/background.js` (replace `TEMPORARY_SETTINGS`)

**Interfaces:**
- Consumes: `savePdf()` from Task 1
- Produces: `DEFAULTS` (object), `mergeSettings(stored) -> settings`, and
  `async loadSettings() -> settings`. Tasks 4, 5, and 6 all call
  `loadSettings()`. The settings object has exactly these keys: `headers`,
  `backgrounds`, `orientation`, `datePosition`, `stripSite`, `showContextMenu`.

- [ ] **Step 1: Write the failing tests**

Create `test/settings.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/settings.js'`.

- [ ] **Step 3: Write `src/settings.js`**

```js
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
```

`loadSettings` is deliberately outside the export shim. It touches
`browser.storage` and cannot run under Node, so exporting it would invite a
test that needs a stub.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 22 tests total across both files.

- [ ] **Step 5: Add the storage permission and load the module**

In `src/manifest.json`:

```json
  "permissions": ["activeTab", "storage"],
  "background": {
    "scripts": ["settings.js", "filename.js", "background.js"]
  },
```

- [ ] **Step 6: Read real settings in `savePdf()`**

In `src/background.js`, delete the whole `TEMPORARY_SETTINGS` constant and
change the first line inside the `try` block of `savePdf()` from
`const settings = TEMPORARY_SETTINGS;` to:

```js
    const settings = await loadSettings();
```

- [ ] **Step 7: Verify in Firefox**

Reload the add-on and click the button on an article page.

Expected: identical behavior to Task 2, since the stored settings are empty and
`mergeSettings` returns the defaults. This step is confirming that reading from
`storage.sync` with nothing stored does not throw.

- [ ] **Step 8: Commit**

```bash
git add src/settings.js src/background.js src/manifest.json test/settings.test.js
git commit -m "Read print and filename options from sync storage"
```

---

### Task 4: Options page

**Files:**
- Create: `src/options.html`
- Create: `src/options.js`
- Modify: `src/manifest.json` (`options_ui`)

**Interfaces:**
- Consumes: `DEFAULTS` and `loadSettings()` from Task 3
- Produces: nothing consumed by later tasks. Writes settings keys into
  `browser.storage.sync`, which Task 5 observes through `storage.onChanged`.

- [ ] **Step 1: Create `src/options.html`**

Control ids are identical to the settings keys, which is what lets `options.js`
stay generic.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Print to PDF options</title>
    <style>
      body { font: message-box; font-size: 13px; margin: 16px; min-width: 340px; }
      h1 { font-size: 15px; margin: 0 0 14px; font-weight: 600; }
      label { display: block; margin: 10px 0; }
      select { margin-left: 6px; }
      p.note { color: GrayText; margin: 18px 0 0; line-height: 1.4; }
    </style>
  </head>
  <body>
    <h1>Print to PDF</h1>

    <label><input type="checkbox" id="headers"> Show headers and footers (title, URL, page number, date)</label>
    <label><input type="checkbox" id="backgrounds"> Render background colors and images</label>
    <label><input type="checkbox" id="stripSite"> Remove the trailing site name from the filename</label>
    <label><input type="checkbox" id="showContextMenu"> Show the right-click menu items</label>

    <label>Orientation
      <select id="orientation">
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>
    </label>

    <label>Date in the filename
      <select id="datePosition">
        <option value="after">After the title</option>
        <option value="before">Before the title</option>
        <option value="none">No date</option>
      </select>
    </label>

    <p class="note">
      Changes apply to the next save. The Save dialog opens in the folder you
      last saved to, which Firefox controls and this extension cannot change.
    </p>

    <script src="settings.js"></script>
    <script src="options.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/options.js`**

```js
const CHECKBOXES = ["headers", "backgrounds", "stripSite", "showContextMenu"];
const SELECTS = ["orientation", "datePosition"];

function onChange(event) {
  const control = event.target;
  const value = control.type === "checkbox" ? control.checked : control.value;
  browser.storage.sync.set({ [control.id]: value });
}

async function restore() {
  const settings = await loadSettings();
  for (const id of CHECKBOXES) {
    document.getElementById(id).checked = settings[id];
  }
  for (const id of SELECTS) {
    document.getElementById(id).value = settings[id];
  }
}

for (const id of [...CHECKBOXES, ...SELECTS]) {
  document.getElementById(id).addEventListener("change", onChange);
}

restore();
```

There is no Save button. Each control writes on change, which is the
convention for browser extension options and removes a state to get wrong.

- [ ] **Step 3: Register the options page**

In `src/manifest.json`, add after the `commands` block:

```json
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  },
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Verify each setting changes the output**

Reload the add-on. Open the options page from `about:addons`, select the
extension, Preferences tab. For each of these, change the setting, close the
options page, and save a page:

1. Headers on. Expected: title and URL across the top, page number and date
   across the bottom of the PDF.
2. Backgrounds off. Expected: white background, no background images.
3. Orientation landscape. Expected: a landscape PDF.
4. Date position before. Expected: the dialog offers `2026-07-25 Title`.
5. Date position none. Expected: the dialog offers `Title` alone.
6. Strip site on, on a page whose title ends in a site name. Expected: the
   suffix is gone from the suggested filename.

Then reopen the options page and confirm every control still shows the value
you set, which proves `restore()` reads back correctly.

- [ ] **Step 6: Commit**

```bash
git add src/options.html src/options.js src/manifest.json
git commit -m "Add options page for print and filename settings"
```

---

### Task 5: Print dialog escape hatch

**Files:**
- Modify: `src/background.js`

**Interfaces:**
- Consumes: `showError()` from Task 1
- Produces: `openPrintDialog()`, which Task 6 calls from its second menu item.

- [ ] **Step 1: Add `openPrintDialog()`**

In `src/background.js`, add after `savePdf()`:

```js
async function openPrintDialog() {
  try {
    await browser.tabs.print();
  } catch (error) {
    await showError(error.message);
  }
}
```

No settings and no filename are passed. `tabs.print()` opens print preview,
which owns those choices, and the API accepts no arguments.

- [ ] **Step 2: Route Shift+click to it**

Replace the `browser.action.onClicked` listener at the bottom of the file:

```js
browser.action.onClicked.addListener((tab, info) => {
  if (info && Array.isArray(info.modifiers) && info.modifiers.includes("Shift")) {
    openPrintDialog();
  } else {
    savePdf();
  }
});
```

The guards matter. The keyboard shortcut fires this same listener, and a
command invocation carries no click data, so `info` may be undefined.

- [ ] **Step 3: Verify both paths**

Reload the add-on. On an ordinary page:

1. Click the button. Expected: the Save dialog, as before.
2. Shift+click the button. Expected: Firefox's print preview opens instead.
3. Press `Ctrl+Shift+X`. Expected: the Save dialog, not print preview.

If Shift+click opens the Save dialog rather than print preview, `info` is not
being delivered on this Firefox version. In that case delete the Shift branch,
leave `openPrintDialog()` in place for Task 6, and note the removal in the
README.

- [ ] **Step 4: Commit**

```bash
git add src/background.js
git commit -m "Open the print dialog on Shift click"
```

---

### Task 6: Context menu

**Files:**
- Modify: `src/manifest.json` (permissions)
- Modify: `src/background.js`

**Interfaces:**
- Consumes: `savePdf()` from Task 1, `loadSettings()` from Task 3,
  `openPrintDialog()` from Task 5
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Add the menus permission**

In `src/manifest.json`:

```json
  "permissions": ["activeTab", "storage", "menus"],
```

- [ ] **Step 2: Add menu registration and handling**

In `src/background.js`, add above the `browser.action.onClicked` listener:

```js
const MENU_SAVE = "save-as-pdf";
const MENU_PRINT = "save-as-pdf-dialog";
const MENU_CONTEXTS = ["page", "selection", "tab"];

async function syncMenus() {
  await browser.menus.removeAll();
  const { showContextMenu } = await loadSettings();
  if (!showContextMenu) {
    return;
  }
  browser.menus.create({
    id: MENU_SAVE,
    title: "Save as PDF",
    contexts: MENU_CONTEXTS,
  });
  browser.menus.create({
    id: MENU_PRINT,
    title: "Save as PDF (print dialog)",
    contexts: MENU_CONTEXTS,
  });
}

browser.menus.onClicked.addListener(async (info, tab) => {
  if (tab && tab.active === false) {
    await browser.tabs.update(tab.id, { active: true });
  }
  if (info.menuItemId === MENU_SAVE) {
    savePdf();
  } else if (info.menuItemId === MENU_PRINT) {
    openPrintDialog();
  }
});

browser.storage.onChanged.addListener(syncMenus);

syncMenus();
```

Two things here are not obvious:

`removeAll()` runs before every create because this is an event page. It can be
unloaded and restarted, re-running the top-level `syncMenus()` call, and
creating a menu with an existing id throws.

The tab activation exists because `saveAsPDF` only ever acts on the *active*
tab. Right-clicking an inactive tab in the tab strip and choosing Save would
otherwise silently save whatever page you were already looking at. Activating
first makes the clicked tab the one that gets saved.

- [ ] **Step 3: Verify the menu appears in all three contexts**

Reload the add-on, then right-click:

1. On empty page content. Expected: both items present.
2. On a paragraph of selected text. Expected: both items still present. This is
   the case that a `page`-only registration would miss.
3. On the current tab in the tab strip. Expected: both items present.

Choosing "Save as PDF" from each opens the Save dialog with the correct page
title. Choosing "Save as PDF (print dialog)" opens print preview.

- [ ] **Step 4: Verify the inactive tab case**

With at least two tabs open, right-click a tab that is *not* currently active
and choose "Save as PDF".

Expected: Firefox switches to that tab, and the Save dialog is prefilled with
*that* tab's title, not the previously active one.

- [ ] **Step 5: Verify the toggle**

Open the options page, uncheck "Show the right-click menu items", then
right-click a page.

Expected: neither item appears, with no reload or restart. Re-check the box and
confirm both come back.

- [ ] **Step 6: Commit**

```bash
git add src/background.js src/manifest.json
git commit -m "Add right-click menu items with a visibility toggle"
```

---

### Task 7: Documentation and packaging

**Files:**
- Create: `README.md`
- Modify: `docs/specs/2026-07-25-firefox-print-pdf-design.md` (record resolved
  open questions)

**Interfaces:**
- Consumes: everything
- Produces: a signed `.xpi` for permanent installation

- [ ] **Step 1: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: 22 tests passing, no lint errors.

- [ ] **Step 2: Work through the spec's verification list**

Open the Verification section of
`docs/specs/2026-07-25-firefox-print-pdf-design.md` and perform all thirteen
items against a freshly reloaded add-on. Items 1 through 12 have been covered
by earlier tasks; item 13 has not, so specifically test a fresh profile.

For item 13, open a new profile with `about:profiles`, "Create a New Profile",
launch it, load the temporary add-on there, and confirm the extension behaves
as the defaults table describes with nothing stored.

Fix anything that fails before continuing. Do not proceed with unresolved
failures.

- [ ] **Step 3: Write `README.md`**

Fill the two bracketed values from what Tasks 1 and 5 actually established.

```markdown
# Print to PDF

A Firefox extension that saves the current page as a PDF in one click. The
Save dialog opens with the filename already filled in from the page title.

## Use

- Click the toolbar button, or press `Ctrl+Shift+X`, or right-click the page
  and choose "Save as PDF".
- Hold Shift while clicking the button, or choose "Save as PDF (print dialog)",
  to open Firefox's print preview instead, where paper size, scale, and page
  ranges can be adjusted for one save.
- Settings are under `about:addons`, this extension, Preferences.

## Known limits

- The extension cannot choose which folder the Save dialog opens in. Firefox
  reopens it wherever you last saved. Save to Downloads once and it will keep
  going there.
- It cannot run on `about:` pages, `view-source:`, or addons.mozilla.org.
  Firefox blocks extensions on those, and the button shows a red badge.
- The PDF is whatever Firefox's print engine produces, which follows the site's
  print stylesheet. Some sites drop images or navigation when printed, and
  content that has not loaded yet may be missing. Use the print dialog escape
  hatch when a page needs adjusting.

## Privacy

The extension makes no network requests, bundles no third party code, and has
no analytics. It stores six settings in Firefox Sync storage and nothing else.
It reads the active tab's title and URL at the moment you invoke it, uses them
to build a filename, and discards them. All of this is checkable against the
source, which is under 250 lines.

Permissions requested: `activeTab` (the current tab's title and URL, only when
you invoke the extension), `storage` (the settings), and `menus` (the
right-click items). [If Task 1 required it, note here that `tabs` replaced
`activeTab` and why.]

## Development

    npm test        # unit tests for the filename and settings logic
    npm run lint    # web-ext lint
    npm run build   # produces dist/*.zip

Load it unsigned for testing at `about:debugging#/runtime/this-firefox`, "Load
Temporary Add-on", and pick `src/manifest.json`. It disappears on restart.

## Signing and installing permanently

Release Firefox will not install unsigned extensions permanently. Signing is
free and the add-on stays private.

1. Sign in at https://addons.mozilla.org.
2. Run `npm run build` to produce `dist/print_to_pdf-<version>.zip`.
3. Go to the Developer Hub, "Submit a New Add-on".
4. Choose **"On your own"**. This is the important step. It keeps the add-on
   unlisted, so it is never published to the public directory.
5. Upload the zip. Automated validation returns a signed `.xpi`, usually within
   a minute.
6. Install it at `about:addons`, gear icon, "Install Add-on From File".
7. Pin the button to the toolbar from the puzzle-piece menu.

To update: bump `version` in `src/manifest.json`, then repeat steps 2 to 6. The
add-on id must never change or AMO treats it as a different extension.

To install on another machine, copy the signed `.xpi` and use step 6. No
re-signing needed.

## Keyboard shortcut

The default is [Ctrl+Shift+X, or whichever fallback Task 1 established].
Rebind it at `about:addons`, gear icon, "Manage Extension Shortcuts". Firefox
only accepts letters, digits, function keys, and a short list of named keys, so
combinations like `Ctrl+[` cannot be bound.
```

- [ ] **Step 4: Record the resolved open questions in the spec**

The spec has two open questions and one uncertain fallback. Update it to say
what actually happened, so the document does not stay stale:

- In the Permissions section, replace the "Open question" paragraph with the
  permission that was actually needed and one sentence on how it was confirmed.
- In the Print dialog escape hatch section, replace the "must be confirmed by
  running the extension" sentence with the result.
- In the Constraints section, confirm the shortcut that works.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/specs/2026-07-25-firefox-print-pdf-design.md
git commit -m "Add README and record verified behavior in the spec"
```

- [ ] **Step 6: Build and sign**

Run: `npm run build`
Expected: `dist/print_to_pdf-1.0.0.zip` exists. Confirm the zip contains only
`manifest.json`, the three scripts, `options.html`, and `icons/icon.svg`, and
no tests, docs, or `package.json`.

Then follow the signing steps in the README. This step needs a Mozilla account
and cannot be automated.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: the save path and badge
to Task 1, filename rules to Task 2, settings and their validation to Task 3,
the options page to Task 4, the escape hatch to Task 5, context menus and the
visibility toggle to Task 6, privacy text, distribution, and the verification
sweep to Task 7. The spec's out-of-scope items (paper size, margins, multiple
tabs, link targets) appear in no task, which is correct.

**Placeholders.** Two bracketed values remain in the README template in Task 7,
Step 3. Both are deliberate: they cannot be filled until Tasks 1 and 5 establish
which permission and which shortcut actually work, and Step 3 says so.

**Type consistency.** `buildFilename(title, url, settings, date)` is defined in
Task 2 and called with that exact signature in Task 2 Step 6. `loadSettings()`
is defined in Task 3 and called in Tasks 3, 4, and 6. `pageSettings(settings)`
and `showError(message)` are defined in Task 1 and called in Tasks 1 and 5.
`openPrintDialog()` is defined in Task 5 and called in Tasks 5 and 6. The six
settings keys are identical across `DEFAULTS`, the options page control ids,
and every read site.

**Script load order.** `settings.js`, `filename.js`, `background.js` in the
manifest, and `settings.js` before `options.js` in `options.html`. Both are
required, because classic scripts share a global scope and run in order.
