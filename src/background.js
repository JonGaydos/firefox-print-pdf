const ERROR_BADGE_MS = 2000;

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
    const settings = await loadSettings();
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error("No active tab");
    }
    await browser.tabs.saveAsPDF({
      ...pageSettings(settings),
      toFileName: buildFilename(tab.title, tab.url, settings, new Date()),
    });
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

browser.commands.onCommand.addListener((name) => {
  if (name === "save-pdf") {
    savePdf();
  }
});

browser.action.onClicked.addListener((tab, info) => {
  if (info && Array.isArray(info.modifiers) && info.modifiers.includes("Shift")) {
    openPrintDialog();
  } else {
    savePdf();
  }
});
