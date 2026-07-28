const ERROR_BADGE_MS = 2000;
const READER_LOAD_TIMEOUT_MS = 5000;

const PAPER_SIZES = {
  letter: { paperSizeUnit: 0, paperWidth: 8.5, paperHeight: 11 },
  legal: { paperSizeUnit: 0, paperWidth: 8.5, paperHeight: 14 },
  a4: { paperSizeUnit: 1, paperWidth: 210, paperHeight: 297 },
};

const MARGIN_INCHES = { normal: 0.5, narrow: 0.25, none: 0 };

function pageSettings(settings) {
  const stamps = settings.headers;
  const margin = MARGIN_INCHES[settings.margins];
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
    ...PAPER_SIZES[settings.paperSize],
    marginTop: margin,
    marginBottom: margin,
    marginLeft: margin,
    marginRight: margin,
  };
}

async function showError(message) {
  console.error("Print to PDF:", message);
  await browser.action.setBadgeBackgroundColor({ color: "#d70022" });
  await browser.action.setBadgeText({ text: "!" });
  setTimeout(() => browser.action.setBadgeText({ text: "" }), ERROR_BADGE_MS);
}

async function activeTabContext() {
  const settings = await loadSettings();
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    throw new Error("No active tab");
  }
  return {
    settings,
    tab,
    filename: buildFilename(tab.title, tab.url, settings, new Date()),
  };
}

async function savePdf() {
  try {
    const { settings, filename } = await activeTabContext();
    await browser.tabs.saveAsPDF({
      ...pageSettings(settings),
      toFileName: filename,
    });
  } catch (error) {
    await showError(error.message);
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, READER_LOAD_TIMEOUT_MS);
    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === "complete") {
        done();
      }
    }
    function done() {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    browser.tabs.onUpdated.addListener(listener);
  });
}

async function savePdfReaderView() {
  try {
    const { settings, tab, filename } = await activeTabContext();
    if (!tab.isArticle) {
      throw new Error("Reader View is not available on this page");
    }
    await browser.tabs.toggleReaderMode(tab.id);
    await waitForTabComplete(tab.id);
    try {
      await browser.tabs.saveAsPDF({
        ...pageSettings(settings),
        toFileName: filename,
      });
    } finally {
      try {
        await browser.tabs.toggleReaderMode(tab.id);
      } catch (error) {
        console.warn("Print to PDF: could not leave Reader View:", error.message);
      }
    }
  } catch (error) {
    await showError(error.message);
  }
}

async function openPrintDialog() {
  try {
    await browser.tabs.print();
  } catch (error) {
    await showError(error.message);
  }
}

const MENU_SAVE = "save-as-pdf";
const MENU_READER = "save-as-pdf-reader";
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
    id: MENU_READER,
    title: "Save as PDF (Reader View)",
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
  } else if (info.menuItemId === MENU_READER) {
    savePdfReaderView();
  } else if (info.menuItemId === MENU_PRINT) {
    openPrintDialog();
  }
});

browser.storage.onChanged.addListener(syncMenus);

syncMenus();

browser.commands.onCommand.addListener((name) => {
  if (name === "save-pdf") {
    savePdf();
  } else if (name === "open-print-dialog") {
    openPrintDialog();
  }
});

browser.action.onClicked.addListener((tab, info) => {
  if (info && Array.isArray(info.modifiers) && info.modifiers.includes("Shift")) {
    openPrintDialog();
  } else {
    savePdf();
  }
});
