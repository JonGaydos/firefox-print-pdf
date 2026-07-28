# One-Click Print to PDF

A Firefox extension that saves the current page as a PDF in one click. The
Save dialog opens with the filename already filled in from the page title
and date, so saving is click, Enter, done.

No data collection, no network requests, no dependencies. MIT licensed.

## Install

From the Firefox add-ons site (link arrives with the first listed
release), or download the signed `.xpi` from this repository's Releases
page and install it via `about:addons`, gear icon, "Install Add-on From
File".

## Use

- Click the toolbar button, or press `Ctrl+Shift+F`, or right-click the page
  and choose "Save as PDF".
- "Save as PDF (Reader View)" in the right-click menu saves the article as
  Reader View renders it: clean text without the site's layout. Useful when
  a site's print output is broken. Only available on pages Firefox
  recognizes as articles.
- Hold Shift while clicking the button, press `Alt+Shift+F`, or choose
  "Save as PDF (print dialog)" to open Firefox's print preview instead,
  where scale and page ranges can be adjusted for one save. The extension's
  settings do not apply there; Firefox's own print settings do.
- Settings are under `about:addons`, this extension, Preferences: headers
  and footers, backgrounds, orientation, paper size (Letter, Legal, A4),
  margins, the filename template, site name stripping, and context menu
  visibility.
- The filename template accepts `{title}`, `{date}`, `{time}`, and
  `{hostname}`. The default is `{title} {date}`.

## Known limits

- The extension cannot choose which folder the Save dialog opens in. Firefox
  reopens it wherever you last saved. Save to Downloads once and it will keep
  going there.
- If a save cannot start at all, the button shows a red badge for two
  seconds. In practice this has not been observed on any page, including
  Firefox's own `about:` pages, which save normally.
- The PDF is whatever Firefox's print engine produces, which follows the site's
  print stylesheet. Some sites drop images or navigation when printed, and
  content that has not loaded yet may be missing. Use the print dialog escape
  hatch when a page needs adjusting.

## Privacy

This extension exists because the alternatives were unclear about what
they collect or asked for more permissions than the job requires. It was
built to do one thing with the minimum access Firefox allows.

Absolutely no data is collected. The extension makes no network requests,
bundles no third party code, and has no analytics. It stores its settings
in Firefox Sync storage and nothing else. It reads the active tab's title
and URL at the moment you invoke it, uses them to build a filename, and
discards them. All of this is checkable against the source, which is a
few hundred lines of plain JavaScript with no build step.

Permissions requested: `activeTab` (the current tab's title and URL, only when
you invoke the extension), `storage` (the settings), and `menus` (the
right-click items).

## Development

    npm test        # unit tests for the filename and settings logic
    npm run lint    # web-ext lint
    npm run build   # produces dist/*.zip

Load it unsigned for testing at `about:debugging#/runtime/this-firefox`, "Load
Temporary Add-on", and pick `src/manifest.json`. It disappears on restart.

## Releasing (maintainer notes)

1. Bump `version` in `src/manifest.json` and `package.json`.
2. `npm test && npm run lint && npm run build` produces `dist/*.zip`.
3. Upload the zip at the AMO Developer Hub as a new version on the listed
   channel. Automated validation signs it, usually within a minute.
4. Attach the signed `.xpi` to a GitHub release:

    gh release create v<version> <signed>.xpi --title "v<version>" --notes "<what changed>"

The add-on id must never change or AMO treats it as a different
extension. Installs update automatically from AMO once a listed version
exists.

## Keyboard shortcut

The default is `Ctrl+Shift+F`. Rebind it at `about:addons`, gear icon,
"Manage Extension Shortcuts". Firefox only accepts letters, digits, function
keys, and a short list of named keys, so combinations like `Ctrl+[` cannot be
bound.
