# Firefox Print to PDF extension: design

Date: 2026-07-25
Status: approved, not yet implemented

## Purpose

Save the current page as a PDF in one click from the Firefox toolbar. The
Save As dialog opens with a filename derived from the page title, so no
typing is required in the common case.

Firefox can already do this through Ctrl+P and the "Save to PDF" print
destination, but that path takes several interactions and defaults to
header, footer, and background settings that are not wanted here. The
extension collapses it to a single click.

## Scope

In scope:

- A toolbar button that saves the active tab as a PDF.
- A keyboard shortcut and a context menu item for the same action.
- An escape hatch that opens the full print dialog when a page needs
  per-save adjustment.
- A suggested filename built from the page title and the current date.
- An options page covering print appearance, filename format, and whether
  the context menu item appears.
- Brief visual feedback when the save cannot be performed.

Out of scope:

- Saving multiple tabs in one action. `saveAsPDF` takes no tab id and
  only ever acts on the active tab, so batch saving would mean
  programmatically switching to each tab in turn and waiting for the user
  to dismiss a separate native dialog per tab. Cancelling midway leaves
  the user on an arbitrary tab. This is a different feature, not an
  increment on this one.
- Saving a link target as a PDF. Same reason: the API only acts on the
  active tab, so a context menu item on a link cannot work.
- Saving a selection or a region of a page.
- Paper size and margin settings. Both are settable through
  `PageSettings` and can be added later if the fixed values prove wrong.
- Chrome or any non-Firefox browser. `tabs.saveAsPDF` is Firefox only.
- Any control over which folder the dialog opens in. See Constraints.

## Prior art

The "Quick PDF" extension solves the same problem with a different
mechanism, and the difference is the main design decision here. It
declares the `scripting` permission and describes "secure messaging
between the extension and webpage", and its documented flow ends in the
print preview dialog. That is a content script calling `window.print()`.

This design calls `tabs.saveAsPDF()` from the background script instead.
The consequences favor the latter:

- Fewer steps. `saveAsPDF` goes straight to the OS file picker with the
  filename prefilled. `window.print()` opens print preview, where the
  user must select a destination, save, and then name the file.
- Cannot be broken by the page. A site can override or suppress
  `window.print`. `tabs.saveAsPDF` runs in the parent process, above the
  content, and pages cannot interfere with it.
- Fewer permissions. No content script means neither `scripting` nor any
  messaging code.

Its documentation also claims Manifest V3 with "Firefox 90 and later",
which is not possible, since MV3 arrived in Firefox 109. The document
should be treated as marketing copy, not an API reference.

One thing worth taking from it: its troubleshooting section advises
ensuring nothing is selected on the page, which indicates its context
menu item is registered for the `page` context only. Firefox switches to
the `selection` context when text is highlighted, so the item disappears
exactly when a user is most likely to be saving an article they have been
reading. This design registers both.

## Constraints

### The save folder cannot be set by the extension

The original requirement was for the dialog to default to the Downloads
folder on every machine. This is not achievable from inside a
WebExtension.

`tabs.PageSettings` exposes `toFileName`, which is a filename only and
accepts no path component. In the Firefox implementation of `saveAsPDF`
(`browser/components/extensions/parent/ext-tabs.js`), the file picker is
initialized in `modeSave` and its `displayDirectory` is never set, and no
download preferences are read. The starting folder is therefore whatever
the platform file picker last used in that profile.

There is no alternative API. `downloads.download` can write into the
Downloads folder, but it requires the file contents, and Firefox never
exposes the rendered PDF bytes to extensions.

Practical consequence: saving into Downloads once per machine makes the
dialog open there from then on. This is Firefox profile state, not
extension behavior, and the extension can neither enforce nor restore it.

### Privileged pages

The original design assumed `saveAsPDF` fails on privileged pages
(`about:` pages, `view-source:`, addons.mozilla.org), reasoning from the
rule that extensions cannot run there. Verification on 2026-07-25 showed
otherwise: `about:preferences` saves normally. The cannot-run restriction
applies to content scripts, and `saveAsPDF` renders in the parent
process, so it is not blocked by it.

The error badge is retained for genuine failures (no active tab, print
engine errors), but there is no known page class that reliably triggers
it. The tab title is also exposed normally there: `about:preferences`
suggested `Settings 2026-07-25`, so the hostname fallback did not apply
either. The filename fallbacks remain in place for pages without titles
generally.

### Print rendering is not screen rendering

The output is whatever Firefox's print engine produces, which is subject
to the site's `@media print` stylesheet. Some sites strip navigation,
change fonts, or hide images when printing. Content that has not loaded
because it sits below the fold behind lazy loading may not appear at all.
This is inherent to any extension built on the print engine, including
Quick PDF, and is the reason the print dialog escape hatch exists.

### Keyboard shortcut choice is constrained

Two separate limits apply.

First, `commands` accepts only a fixed key set: A-Z, 0-9, F1-F12, and
`Comma`, `Period`, `Home`, `End`, `PageUp`, `PageDown`, `Space`,
`Insert`, `Delete`, and the four arrow keys. Punctuation outside comma
and period, brackets included, cannot be bound at all, by the manifest or
by the user through Manage Extension Shortcuts.

Second, a shortcut already claimed by Firefox or another add-on can still
be declared, but the listener is never called and no error is raised.
Conflicts are silent, so the chosen combination has to be verified by
pressing it.

The requirement is a left-hand combination. Checking Firefox's key table
in `browser/base/content/browser-sets.inc`, every left-hand
`Ctrl+<letter>` is taken except `Ctrl+Q`: W, R, T, S, D, F, G, B, and E
are browser bindings, A, C, V, X, and Z are text editor bindings, and
Ctrl+1 through Ctrl+5 switch tabs. `Ctrl+Q` is free on Windows only,
because `key_quitApplication` is guarded to `accel,shift` under `XP_WIN`
and plain `accel` elsewhere, so it would quit Firefox on Linux and
macOS. It was rejected for that reason.

`Ctrl+Shift+X` was chosen first. It appears in neither
`browser-sets.inc` nor the DevTools shortcut set, but verification on
2026-07-25 found it silently claimed in this profile, presumably by
another installed extension, and it never fired even as a named command.
The default is therefore `Ctrl+Shift+F`, the documented fallback. Note
that `Ctrl+Shift+Z` is the DevTools Debugger panel and `Ctrl+Shift+S` is
Screenshot, so neither is available.

### Unsigned extensions

Release Firefox refuses to install unsigned extensions permanently. The
extension will be signed through addons.mozilla.org on the unlisted
("On your own") channel, which produces a signed `.xpi` for private
installation without publishing it to the public add-on directory.

## Architecture

One background script, one options page, no content scripts, no message
passing. The background script wraps two browser API calls; the options
page is a form that writes to `storage.sync`.

```
entry points
  toolbar click            -> save
  Ctrl+Shift+X             -> save
  context menu "Save as PDF" -> save
  Shift + toolbar click    -> print dialog
  context menu "Save as PDF (print dialog)" -> print dialog

save:
  storage.sync.get, merged over built-in defaults
  -> tabs.query({active: true, currentWindow: true})
  -> build filename from tab.title (or hostname) and the filename settings
  -> build pageSettings from the print settings
  -> tabs.saveAsPDF(pageSettings)
  -> resolve: "saved" | "replaced" | "canceled" | "not_saved" | "not_replaced"
  -> reject: privileged page or other failure -> error badge

print dialog:
  -> tabs.print()
  -> no settings are applied, no filename is suggested
```

### Files

Extension source lives under `src/` so that `web-ext` can package it with
`--source-dir=src`, leaving tests, `package.json`, and `docs/` out of the
zip.

| Path                    | Contents                                            |
| ----------------------- | --------------------------------------------------- |
| `src/manifest.json`     | Manifest V3, `activeTab`, `storage`, and `menus` permissions, `action`, `commands`, `options_ui`, `browser_specific_settings.gecko.id`, `strict_min_version` |
| `src/background.js`     | Entry point listeners, menu registration, page settings mapping, `saveAsPDF` and `print` calls, badge feedback |
| `src/settings.js`       | `DEFAULTS`, `mergeSettings()`, and `loadSettings()`, shared by the background script and the options page |
| `src/filename.js`       | `buildFilename()` and its helpers. Pure, no browser APIs |
| `src/options.html`      | Settings form                                        |
| `src/options.js`        | Loads current values, saves on change                |
| `src/icons/icon-dark.svg`, `icon-light.svg` | Toolbar icon variants selected by `theme_icons`. Firefox accepts SVG icons, so no PNG raster set is required. An earlier single icon used `context-fill`, which renders blank in extension toolbar icons (it only works in privileged chrome contexts), hence the explicit two-variant approach |
| `test/filename.test.js` | Unit tests for `buildFilename()`                     |
| `test/settings.test.js` | Unit tests for `mergeSettings()`                     |
| `package.json`          | Test, lint, and build scripts. No dependencies       |
| `README.md`             | Signing, installation, update, and privacy notes     |

Rough sizes: `background.js` about 75 lines, `filename.js` about 45,
`settings.js` about 35, `options.js` about 25, `options.html` about 45. If
`background.js` grows past 110 lines the design has drifted and should be
revisited.

`settings.js` exists so the defaults are declared exactly once. Both the
background script and the options page load it; they must never carry
separate copies of the default values.

`filename.js` is separate from `background.js` because it is the only
non-trivial logic in the extension and the only part worth unit testing.
It and `settings.js` each end with a two-line CommonJS export shim
(`if (typeof module !== "undefined")`), which is inert in Firefox and lets
`node --test` require the exact files Firefox loads, with no build step
and no duplicated logic.

Background scripts are classic scripts, not ES modules, because Firefox
support for `"type": "module"` in the background key is undocumented and
the extension targets Firefox 115. They share one global scope and run in
the order listed, so `settings.js` and `filename.js` must precede
`background.js`.

## Settings

Stored in `storage.sync` so that settings follow a Firefox account across
machines if Sync is enabled, and behave as local storage if it is not.
Sync storage requires the add-on to have an explicit id, which it does.

| Key               | Type    | Default          | Effect                            |
| ----------------- | ------- | ---------------- | --------------------------------- |
| `headers`         | boolean | `false`          | When true, restore Firefox's default header and footer stamps (`&T`, `&U`, `&PT`, `&D`). When false, all six fields are empty strings. |
| `backgrounds`     | boolean | `true`           | Sets both `showBackgroundColors` and `showBackgroundImages`. |
| `orientation`     | string  | `portrait`       | `portrait` maps to `0`, `landscape` to `1`. |
| `paperSize`       | string  | `letter`         | `letter` 8.5x11in, `legal` 8.5x14in, `a4` 210x297mm (`paperSizeUnit` 1). Added in 1.1.0. |
| `margins`         | string  | `normal`         | All four margins: `normal` 0.5in, `narrow` 0.25in, `none` 0. Added in 1.1.0. |
| `template`        | string  | `{title} {date}` | Filename template. Tokens `{title}`, `{date}`, `{time}` (HH.MM, dot because a colon is illegal on Windows), `{hostname}`. Unknown tokens stay literal. A template that renders blank falls back to the title. Added in 1.1.0, replacing `datePosition`. |
| `stripSite`       | boolean | `false`          | Remove a trailing site name from the title. See Filename. |
| `showContextMenu` | boolean | `true`           | Whether the right-click items are registered. |

`datePosition` (1.0.0) is migrated: a stored value maps to the
equivalent template (`after` to `{title} {date}`, `before` to
`{date} {title}`, `none` to `{title}`), and an explicitly stored
`template` always wins. The old key is never deleted from storage, it is
simply ignored once a template exists.

Header and footer stamps are exposed as one setting rather than six
fields. Anyone who wants per-corner control can be given it later; there
is no evidence anyone does.

Values are read fresh on each invocation rather than cached, so a change
in the options page takes effect on the next save with no reload. The one
exception is `showContextMenu`, which must act on change: the background
script listens to `storage.onChanged` and creates or removes the menu
items in response.

Any stored value that is missing or of the wrong type falls back to its
default. The extension never writes settings from the background script.

## Behavior

### Filename

Format depends on `datePosition`, defaulting to `<title> <YYYY-MM-DD>`.

- The date is the local date at the time of the click, zero padded.
- The title is the tab's title with whitespace collapsed to single
  spaces and leading and trailing whitespace removed.
- If `stripSite` is on, a trailing site name is removed. A site name is a
  final segment introduced by a separator surrounded by spaces, where the
  separator is one of `-`, `|`, `–`, `—`, or `·`. The segment is removed
  only if it is 40 characters or fewer and at least 10 characters of
  title remain afterwards. Only the last such segment is removed. These
  guards exist so that titles which legitimately contain a separator are
  not mangled.
- If the title is empty or missing, the hostname of the tab URL is used
  instead. If the URL has no hostname, the literal string `page` is used.
  Site stripping does not apply to a hostname fallback.
- The title portion is truncated to 120 characters to stay clear of the
  Windows path length limit. Truncation happens after stripping and
  before the date is applied, so the date is always present.
- Characters that are illegal in filenames are sanitized by Firefox via
  `DownloadPaths.sanitize` before the picker is shown. The extension does
  not duplicate this.
- The `.pdf` extension is supplied by Firefox and is not appended by the
  extension.

### Print settings

Built from the stored settings on each save.

| `PageSettings` field                        | Source                          |
| ------------------------------------------- | ------------------------------- |
| `headerLeft`, `headerCenter`, `headerRight` | `""` unless `headers`, then `&T`, `""`, `&U` |
| `footerLeft`, `footerCenter`, `footerRight` | `""` unless `headers`, then `&PT`, `""`, `&D` |
| `showBackgroundColors`                      | `backgrounds`                   |
| `showBackgroundImages`                      | `backgrounds`                   |
| `orientation`                               | `0` or `1` from `orientation`   |
| `shrinkToFit`                               | always `true`                   |

Everything else stays at the Firefox default: Letter paper, 0.5 inch
margins, 0 edge spacing.

Note that the six header and footer fields default to non-empty values,
so suppressing them requires setting all six to empty strings
explicitly. Omitting them does not disable them.

### Keyboard shortcut

Declared in `manifest.json` under `commands` as a named command
`save-pdf` with `suggested_key.default` set to `Ctrl+Shift+X`, handled
by a `commands.onCommand` listener that calls the same save path as the
toolbar button.

The original design used the reserved name `_execute_action`, which
fires `action.onClicked` with no extra code. It was replaced during
verification (2026-07-25) when the shortcut did not fire: Firefox has
known flakiness dispatching `_execute_action` to `onClicked` for MV3
extensions, and a named command removes that path entirely. A named
command also gets a fresh per-command shortcut store, so the manifest
default reliably applies rather than a previously stored value.

The combination is left hand only, which was the selection criterion.
See Constraints for why the alternatives were rejected. If testing shows
it is claimed after all, fall back to `Ctrl+Shift+F` and record the
working choice in the README. Either way the user can rebind it under
Manage Extension Shortcuts in `about:addons`, subject to the same
restricted key set.

A command invocation carries no modifier information, so the save
shortcut never opens the print dialog. Instead a second named command
`open-print-dialog` (added 1.1.0, default `Alt+Shift+F`) reaches the
escape hatch from the keyboard.

The two right-click items are grouped by Firefox into a submenu named
after the extension, which is automatic for any extension registering
more than one item in a context and cannot be overridden.

### Context menu

Three items, registered under contexts `page`, `selection`, and `tab`:

- "Save as PDF", which performs the same save as the toolbar button.
- "Save as PDF (Reader View)" (added 1.1.0), which toggles the tab into
  Reader View, saves, and toggles back. The filename is computed from
  the title and URL captured before entering Reader View, both because
  that is the real page identity and because the `activeTab` grant may
  not survive the reader-mode navigation. If `tab.isArticle` is false,
  the error badge shows and nothing is toggled. Waiting for the reader
  document uses `tabs.onUpdated` status `complete` with a five second
  timeout, and leaving Reader View is attempted even if the save fails.
- "Save as PDF (print dialog)", which opens print preview.

The `selection` context matters: Firefox switches context when text is
highlighted, and a `page`-only item disappears at exactly the moment a
user is most likely to want it. The `tab` context puts the item on the
tab strip, which is often where the pointer already is.

Menu clicks grant `activeTab` the same way toolbar clicks do, so no
additional permission is needed beyond `menus` itself.

Both items are registered at startup only if `showContextMenu` is true,
and are created or removed by a `storage.onChanged` listener when the
setting is toggled.

### Print dialog escape hatch

`tabs.print()` opens Firefox's print preview, where paper size, scale,
page ranges, and margins can all be adjusted for a single save. It is
reached by holding Shift while clicking the toolbar button, or by the
second context menu item.

No stored settings are applied and no filename is suggested on this path.
Print preview owns those decisions, and passing settings it would then
show as editable defaults is not possible through this API.

Shift detection relies on the second argument to `action.onClicked`, an
`OnClickData` object carrying a `modifiers` array. Confirmed working
2026-07-25: Shift+click opens print preview. The listener still guards
against the argument being absent, because a command invocation carries
no click data.

### Feedback

- Success, replace, and cancel are all terminal states with no feedback.
  Cancelling the dialog is a normal user action, not an error.
- On rejection, the toolbar button shows a red `!` badge for two seconds,
  then clears. The error is also written to the extension console.
- No notifications, because the `notifications` permission would add an
  install warning for a case this minor.

## Permissions

`activeTab`, `storage`, and `menus`.

`activeTab` is granted for the active tab when the user clicks the
toolbar button, triggers the command, or picks a context menu item, which
are the only entry points, and it grants access to that tab's title and
URL. Neither `storage` nor `menus` produces a user-visible install
warning in Firefox. Between them the extension should install with no
permission prompt.

Notably absent is `scripting`, which the comparable extension requires.
Calling the tabs API from the background script needs no content script
and no host permissions.

Resolved 2026-07-25: `saveAsPDF` works under `activeTab` alone,
confirmed by saving pages with correct titles in the suggested filename,
including `about:preferences`. The `tabs` permission fallback in the
original design was never needed.

## Manifest details

- Manifest V3. Firefox MV3 uses `action` rather than `browser_action`,
  and event page style `background.scripts`, not a service worker.
- `browser_specific_settings.gecko.id` must be set to a stable id
  (for example `print-to-pdf@jgayd.local`). AMO will not sign an add-on
  without one, and changing it later creates a separate add-on.
- `strict_min_version` set to `115.0`.
- `options_ui.browser_style` is not set; the options page carries its own
  minimal styling.
- Use the `browser.*` namespace with promises. The extension is Firefox
  only, so there is no reason to use the callback style `chrome.*` API.

## Privacy

The extension makes no network requests, bundles no third party code, has
no analytics, and stores nothing except the six settings above. It reads
the active tab's title and URL only at the moment it is invoked, uses
them to build a filename, and discards them. This is a factual
description of the design, and it belongs in the README so it can be
checked against the source.

## Verification

Two layers.

`buildFilename()` and `mergeSettings()` are pure functions with real edge
cases, and they carry unit tests run by `node --test` with no
dependencies. They are the only automated tests, and they cover the only
logic in the extension that can be wrong without being obvious.

Everything else is browser glue: listeners calling APIs that open native
dialogs. There is nothing to assert against without a harness larger than
the extension itself, so it is verified by hand after loading the
unsigned extension through `about:debugging` and before signing:

1. `web-ext lint` reports no errors.
2. A normal article page saves, and the dialog is prefilled with the page
   title followed by the date.
3. `Ctrl+Shift+X` on a normal page opens the same dialog. If nothing
   happens, the combination is claimed; switch to `Ctrl+Shift+F` and
   retest. Test it once inside a text field as well, since editor
   bindings apply there and not elsewhere.
4. The context menu item appears on a plain page, on a page with text
   selected, and on the tab strip, and saves from all three.
5. Shift-clicking the button opens print preview rather than the save
   dialog, as does the second context menu item.
6. A page with a very long title produces a truncated but valid filename.
7. A page with no title produces the hostname.
8. The resulting PDF has no header or footer text and renders background
   colors and images.
9. An `about:preferences` tab saves rather than erroring, with the
   dialog suggesting `Settings 2026-07-25` (confirmed 2026-07-25).
10. Cancelling the dialog produces no badge.
11. Each option changes the next save as described: headers on restores
    the stamps, backgrounds off produces a white background, landscape
    rotates the output, each `datePosition` value produces the stated
    filename shape, and `stripSite` removes a site suffix without
    mangling a title that merely contains a dash.
12. Toggling `showContextMenu` off removes both menu items without
    requiring a restart, and toggling it back on restores them.
13. A fresh profile with no stored settings behaves as the defaults table
    describes.

## Distribution

Signing through addons.mozilla.org, unlisted channel:

1. Create or sign in to a Mozilla account.
2. Package the extension as a zip of its contents, either by hand or with
   `web-ext build`.
3. Developer Hub, "Submit a New Add-on", select "On your own" to keep it
   unlisted.
4. Upload the zip. Automated validation returns a signed `.xpi`.
5. Install through `about:addons`, gear icon, "Install Add-on From File".
6. Pin the button to the toolbar from the extensions (puzzle piece) menu.

Updating means bumping `version` in the manifest and repeating steps 2
through 5. The signed `.xpi` can be copied to other machines and
installed directly rather than re-signed.
