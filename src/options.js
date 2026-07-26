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
