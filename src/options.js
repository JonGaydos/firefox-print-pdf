const CHECKBOXES = [
  "headers", "backgrounds", "stripSite", "showContextMenu",
  "fnDate", "fnTime", "fnHostname", "fnDateFirst", "customTemplate",
];
const SELECTS = ["orientation", "paperSize", "margins"];
const BUILDER = ["fnDate", "fnTime", "fnHostname", "fnDateFirst"];

function control(id) {
  return document.getElementById(id);
}

function currentSettings() {
  const settings = {};
  for (const id of CHECKBOXES) {
    settings[id] = control(id).checked;
  }
  for (const id of SELECTS) {
    settings[id] = control(id).value;
  }
  settings.template = control("template").value;
  return settings;
}

function refreshFilenameControls() {
  const custom = control("customTemplate").checked;
  control("template").disabled = !custom;
  for (const id of BUILDER) {
    control(id).disabled = custom;
  }
  if (!custom) {
    control("template").value = buildTemplate(currentSettings());
  }
  const example = buildFilename(
    "Page Title",
    "https://example.com/a",
    { template: control("template").value, stripSite: false },
    new Date(),
  );
  control("preview").textContent = `Example: ${example}.pdf`;
}

function save() {
  refreshFilenameControls();
  browser.storage.sync.set(currentSettings());
}

async function restore() {
  const settings = await loadSettings();
  for (const id of CHECKBOXES) {
    control(id).checked = settings[id];
  }
  for (const id of SELECTS) {
    control(id).value = settings[id];
  }
  control("template").value = settings.template;
  refreshFilenameControls();
}

for (const id of [...CHECKBOXES, ...SELECTS, "template"]) {
  control(id).addEventListener("change", save);
}
control("template").addEventListener("input", refreshFilenameControls);

restore();
