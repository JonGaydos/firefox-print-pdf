const ERROR_BADGE_MS = 2000;

const TEMPORARY_SETTINGS = {
  headers: false,
  backgrounds: true,
  orientation: "portrait",
  datePosition: "after",
  stripSite: false,
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
      toFileName: buildFilename(tab.title, tab.url, settings, new Date()),
    });
  } catch (error) {
    await showError(error.message);
  }
}

browser.action.onClicked.addListener(() => {
  savePdf();
});
