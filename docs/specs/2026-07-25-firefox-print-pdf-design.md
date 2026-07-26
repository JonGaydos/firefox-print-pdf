# Firefox Print to PDF extension: design

Date: 2026-07-25
Status: approved, not yet implemented

## Purpose

Save the current page as a PDF in one click from the Firefox toolbar. The
Save As dialog opens with a filename derived from the page title, so no
typing is required in the common case.

Firefox can already do this through Ctrl+P and the "Save to PDF" print
destination, but that path takes several interactions and resets the
header, footer, and background settings to values that are not wanted
here. The extension collapses it to a single click with fixed settings.

## Scope

In scope:

- A toolbar button that saves the active tab as a PDF.
- A suggested filename built from the page title and the current date.
- Fixed print settings (no headers or footers, backgrounds rendered).
- Brief visual feedback when the save cannot be performed.

Out of scope:

- An options page or any configurable setting.
- A keyboard shortcut.
- Chrome or any non-Firefox browser (`tabs.saveAsPDF` is Firefox only).
- Saving multiple tabs, selections, or regions.
- Any control over which folder the dialog opens in (see Constraints).

## Constraints

### The save folder cannot be set by the extension

The original requirement was for the dialog to default to the Downloads
folder on every machine. This is not achievable from inside a
WebExtension.

`tabs.PageSettings` exposes `toFileName`, which is a filename only and
accepts no path component. In the Firefox implementation of
`saveAsPDF` (`browser/components/extensions/parent/ext-tabs.js`), the
file picker is initialized in `modeSave` and its `displayDirectory` is
never set, and no download preferences are read. The starting folder is
therefore whatever the platform file picker last used in that profile.

There is no alternative API. `downloads.download` can write into the
Downloads folder, but it requires the file contents, and Firefox never
exposes the rendered PDF bytes to extensions.

Practical consequence: saving into Downloads once per machine makes the
dialog open there from then on. This is Firefox profile state, not
extension behavior, and it is not something the extension can enforce or
restore.

### Privileged pages

`saveAsPDF` fails on pages where extensions are not permitted to run,
including `about:` pages, `view-source:`, and addons.mozilla.org. This is
a Firefox restriction with no workaround. The extension reports the
failure rather than attempting to handle it.

### Unsigned extensions

Release Firefox refuses to install unsigned extensions permanently. The
extension will be signed through addons.mozilla.org on the unlisted
("On your own") channel, which produces a signed `.xpi` for private
installation without publishing it to the public add-on directory.

## Architecture

A single background script, no content scripts, no storage, no message
passing. The extension is a thin wrapper around one browser API call.

```
toolbar click
  -> tabs.query({active: true, currentWindow: true})
  -> build filename from tab.title (or hostname) plus the local date
  -> tabs.saveAsPDF(pageSettings)
  -> resolve: "saved" | "replaced" | "canceled" | "not_saved" | "not_replaced"
  -> reject: privileged page or other failure -> error badge
```

### Files

| Path              | Contents                                                  |
| ----------------- | --------------------------------------------------------- |
| `manifest.json`   | Manifest V3, `activeTab` permission, `action` entry, `browser_specific_settings.gecko.id`, `strict_min_version` |
| `background.js`   | Click listener, filename builder, `saveAsPDF` call, badge feedback |
| `icons/icon.svg`  | Toolbar icon. Firefox accepts SVG icons, so no PNG raster set is required |
| `README.md`       | Signing, installation, and update instructions             |

`background.js` is expected to be about 40 lines. If it grows past that,
the design has drifted and should be revisited.

## Behavior

### Filename

Format: `<title> <YYYY-MM-DD>.pdf`

- The date is the local date at the time of the click, zero padded.
- The title is the tab's title with whitespace collapsed to single
  spaces and leading and trailing whitespace removed.
- If the title is empty or missing, the hostname of the tab URL is used
  instead. If the URL has no hostname, the literal string `page` is used.
- The title portion is truncated to 120 characters to stay clear of the
  Windows path length limit. Truncation happens before the date is
  appended, so the date is always present.
- Characters that are illegal in filenames are sanitized by Firefox via
  `DownloadPaths.sanitize` before the picker is shown. The extension does
  not duplicate this.
- The `.pdf` extension is supplied by Firefox and is not appended by the
  extension.

### Print settings

Passed to `saveAsPDF` on every call. Not configurable.

| Setting                                          | Value | Reason                          |
| ------------------------------------------------ | ----- | ------------------------------- |
| `headerLeft`, `headerCenter`, `headerRight`       | `""`  | Remove the default page title and URL stamps |
| `footerLeft`, `footerCenter`, `footerRight`       | `""`  | Remove the default page number and date stamps |
| `showBackgroundColors`                            | `true`  | Render the page as it appears on screen |
| `showBackgroundImages`                            | `true`  | Same                            |
| `shrinkToFit`                                     | `true`  | Fit page width to paper         |

Everything else stays at the Firefox default: Letter portrait, 0.5 inch
margins, 0 edge spacing.

Note that the header and footer fields default to non-empty values
(`&T`, `&U`, `&PT`, `&D`), so all six must be explicitly set to empty
strings. Omitting them does not disable them.

### Feedback

- Success, replace, and cancel are all terminal states with no feedback.
  Cancelling the dialog is a normal user action, not an error.
- On rejection, the toolbar button shows a red `!` badge for two seconds,
  then clears. The error is also written to the extension console.
- No notifications, because the `notifications` permission would add an
  install warning for a case this minor.

## Permissions

`activeTab` only. It is granted for the active tab when the user clicks
the toolbar button, which is exactly the trigger this extension uses, and
it grants access to that tab's title and URL. An extension requesting
only `activeTab` shows no permission warnings at install time.

Open question to resolve during implementation: whether `saveAsPDF`
itself requires the broader `tabs` permission. The MDN page does not
state a permission requirement, and the API takes no tab id, which
suggests `activeTab` is sufficient. If the call fails with a permission
error under `activeTab`, switch the manifest to `tabs` and accept the
resulting "read your browsing history" install warning. This must be
confirmed by running the extension, not by reading documentation.

## Manifest details

- Manifest V3. Firefox MV3 uses `action` rather than `browser_action`,
  and event page style `background.scripts`, not a service worker.
- `browser_specific_settings.gecko.id` must be set to a stable id
  (for example `print-to-pdf@jgayd.local`). AMO will not sign an add-on
  without one, and changing it later creates a separate add-on.
- `strict_min_version` set to `115.0`.
- Use the `browser.*` namespace with promises. The extension is Firefox
  only, so there is no reason to use the callback style `chrome.*` API.

## Verification

There are no automated tests. The extension is a UI-triggered wrapper
around a browser API that opens a native dialog, so there is nothing to
assert against without a browser harness that would be larger than the
extension itself.

Verification is manual, performed after loading the unsigned extension
through `about:debugging` and before signing:

1. `web-ext lint` reports no errors.
2. A normal article page saves, and the dialog is prefilled with the page
   title followed by the date.
3. A page with a very long title produces a truncated but valid filename.
4. A page with no title produces the hostname.
5. The resulting PDF has no header or footer text and renders background
   colors and images.
6. An `about:preferences` tab triggers the error badge rather than
   failing silently.
7. Cancelling the dialog produces no badge.

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
