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
- A keyboard shortcut for the same action.
- A suggested filename built from the page title and the current date.
- An options page covering print appearance and filename format.
- Brief visual feedback when the save cannot be performed.

Out of scope:

- Saving multiple tabs in one action. `saveAsPDF` takes no tab id and
  only ever acts on the active tab, so batch saving would mean
  programmatically switching to each tab in turn and waiting for the user
  to dismiss a separate native dialog per tab. Cancelling midway leaves
  the user on an arbitrary tab. This is a different feature, not an
  increment on this one.
- Saving a selection or a region of a page.
- Chrome or any non-Firefox browser. `tabs.saveAsPDF` is Firefox only.
- Any control over which folder the dialog opens in. See Constraints.

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

`saveAsPDF` fails on pages where extensions are not permitted to run,
including `about:` pages, `view-source:`, and addons.mozilla.org. This is
a Firefox restriction with no workaround. The extension reports the
failure rather than attempting to handle it.

### Keyboard shortcut conflicts fail silently

Per the `commands` documentation, a shortcut already claimed by Firefox
or another add-on can still be declared, but the listener is never
called and no error is raised. The chosen default (`Ctrl+Shift+Z`) is the
conventional Redo combination, which Firefox honors in editable fields
alongside `Ctrl+Y`. Whether it is claimed at the browser level could not
be confirmed from documentation and must be established by testing.

### Unsigned extensions

Release Firefox refuses to install unsigned extensions permanently. The
extension will be signed through addons.mozilla.org on the unlisted
("On your own") channel, which produces a signed `.xpi` for private
installation without publishing it to the public add-on directory.

## Architecture

One background script, one options page, no content scripts, no message
passing. The background script is a thin wrapper around a single browser
API call; the options page is a form that writes to `storage.sync`.

```
toolbar click, or Ctrl+Shift+Z
  -> storage.sync.get, merged over built-in defaults
  -> tabs.query({active: true, currentWindow: true})
  -> build filename from tab.title (or hostname) and the date setting
  -> build pageSettings from the stored settings
  -> tabs.saveAsPDF(pageSettings)
  -> resolve: "saved" | "replaced" | "canceled" | "not_saved" | "not_replaced"
  -> reject: privileged page or other failure -> error badge
```

### Files

| Path              | Contents                                                  |
| ----------------- | --------------------------------------------------------- |
| `manifest.json`   | Manifest V3, `activeTab` and `storage` permissions, `action`, `commands`, `options_ui`, `browser_specific_settings.gecko.id`, `strict_min_version` |
| `background.js`   | Click listener, settings load, filename builder, `saveAsPDF` call, badge feedback |
| `settings.js`     | The defaults object and a `loadSettings()` helper, shared by the background script and the options page |
| `options.html`    | Settings form                                              |
| `options.js`      | Loads current values, saves on change                      |
| `icons/icon.svg`  | Toolbar icon. Firefox accepts SVG icons, so no PNG raster set is required |
| `README.md`       | Signing, installation, and update instructions             |

Rough sizes: `background.js` about 55 lines, `settings.js` about 20,
`options.js` about 35, `options.html` about 50. If `background.js` grows
past 70 lines the design has drifted and should be revisited.

`settings.js` exists so the defaults are declared exactly once. Both the
background script and the options page load it; they must never carry
separate copies of the default values.

## Settings

Stored in `storage.sync` so that settings follow a Firefox account across
machines if Sync is enabled, and behave as local storage if it is not.
Sync storage requires the add-on to have an explicit id, which it does.

| Key            | Type    | Default | Effect                                     |
| -------------- | ------- | ------- | ------------------------------------------ |
| `headers`      | boolean | `false` | When true, restore Firefox's default header and footer stamps (`&T`, `&U`, `&PT`, `&D`). When false, all six fields are empty strings. |
| `backgrounds`  | boolean | `true`  | Sets both `showBackgroundColors` and `showBackgroundImages`. |
| `orientation`  | string  | `portrait` | `portrait` maps to `0`, `landscape` to `1`. |
| `datePosition` | string  | `after` | `after`: `Title 2026-07-25`. `before`: `2026-07-25 Title`. `none`: `Title`. |

Header and footer stamps are exposed as one setting rather than six
fields. Anyone who wants per-corner control can be given it later; there
is no evidence anyone does.

Values are read fresh on each invocation rather than cached, so a change
in the options page takes effect on the next click with no reload.

Any stored value that is missing or of the wrong type falls back to its
default. The extension never writes settings from the background script.

## Behavior

### Filename

Format depends on `datePosition`, defaulting to `<title> <YYYY-MM-DD>`.

- The date is the local date at the time of the click, zero padded.
- The title is the tab's title with whitespace collapsed to single
  spaces and leading and trailing whitespace removed.
- If the title is empty or missing, the hostname of the tab URL is used
  instead. If the URL has no hostname, the literal string `page` is used.
- The title portion is truncated to 120 characters to stay clear of the
  Windows path length limit. Truncation happens before the date is
  applied, so the date is always present.
- Characters that are illegal in filenames are sanitized by Firefox via
  `DownloadPaths.sanitize` before the picker is shown. The extension does
  not duplicate this.
- The `.pdf` extension is supplied by Firefox and is not appended by the
  extension.

### Print settings

Built from the stored settings on each call.

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

Declared in `manifest.json` under `commands` using the reserved name
`_execute_action`, with `suggested_key.default` set to `Ctrl+Shift+Z`.
Because no popup is defined, this fires the same `action.onClicked`
listener as the toolbar button, so it requires no JavaScript at all.

If testing shows the combination is claimed by Firefox, fall back in this
order and record the working choice in the README: `Ctrl+Shift+Y`,
`Alt+Shift+P`, `Ctrl+Alt+P`. Either way the user can rebind it under
Manage Extension Shortcuts in `about:addons`.

### Feedback

- Success, replace, and cancel are all terminal states with no feedback.
  Cancelling the dialog is a normal user action, not an error.
- On rejection, the toolbar button shows a red `!` badge for two seconds,
  then clears. The error is also written to the extension console.
- No notifications, because the `notifications` permission would add an
  install warning for a case this minor.

## Permissions

`activeTab` and `storage`.

`activeTab` is granted for the active tab when the user clicks the
toolbar button or triggers the command, which are the only entry points,
and it grants access to that tab's title and URL. `storage` produces no
user-visible install warning in Firefox. Between them the extension
should install with no permission prompt.

Open question to resolve during implementation: whether `saveAsPDF`
itself requires the broader `tabs` permission. MDN states no permission
requirement, and the API takes no tab id, which suggests `activeTab`
suffices. If the call fails with a permission error under `activeTab`,
switch the manifest to `tabs` and accept the resulting "read your
browsing history" install warning. This must be confirmed by running the
extension, not by reading documentation.

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

## Verification

There are no automated tests. The extension is a UI-triggered wrapper
around a browser API that opens a native dialog, so there is nothing to
assert against without a browser harness larger than the extension
itself.

Verification is manual, performed after loading the unsigned extension
through `about:debugging` and before signing:

1. `web-ext lint` reports no errors.
2. A normal article page saves, and the dialog is prefilled with the page
   title followed by the date.
3. `Ctrl+Shift+Z` on a normal page opens the same dialog. If nothing
   happens, the combination is claimed; switch to the next fallback and
   retest.
4. A page with a very long title produces a truncated but valid filename.
5. A page with no title produces the hostname.
6. The resulting PDF has no header or footer text and renders background
   colors and images.
7. An `about:preferences` tab triggers the error badge rather than
   failing silently.
8. Cancelling the dialog produces no badge.
9. Each option changes the next save as described: headers on restores
   the stamps, backgrounds off produces a white background, landscape
   rotates the output, and each `datePosition` value produces the stated
   filename shape.
10. A fresh profile with no stored settings behaves as the defaults
    table describes.

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
