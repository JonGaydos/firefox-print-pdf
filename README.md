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
- If a save cannot start at all, the button shows a red badge for two
  seconds. In practice this has not been observed on any page, including
  Firefox's own `about:` pages, which save normally.
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
right-click items).

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

The default is `Ctrl+Shift+X`. Rebind it at `about:addons`, gear icon,
"Manage Extension Shortcuts". Firefox only accepts letters, digits, function
keys, and a short list of named keys, so combinations like `Ctrl+[` cannot be
bound.
