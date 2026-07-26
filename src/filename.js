const MAX_TITLE_LENGTH = 120;
const MAX_SITE_LENGTH = 40;
const MIN_TITLE_REMAINING = 10;
const SITE_SUFFIX = /^(.*\S)\s+[-|–—·]\s+(\S.*)$/;

function formatDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function stripSiteName(title) {
  const match = SITE_SUFFIX.exec(title);
  if (!match) {
    return title;
  }
  const [, head, tail] = match;
  if (tail.length > MAX_SITE_LENGTH || head.length < MIN_TITLE_REMAINING) {
    return title;
  }
  return head;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname || "page";
  } catch (error) {
    return "page";
  }
}

function buildFilename(title, url, settings, date) {
  let base = String(title || "").replace(/\s+/g, " ").trim();
  if (base && settings.stripSite) {
    base = stripSiteName(base);
  }
  if (!base) {
    base = hostnameOf(url);
  }
  if (base.length > MAX_TITLE_LENGTH) {
    base = base.slice(0, MAX_TITLE_LENGTH).trim();
  }
  if (settings.datePosition === "none") {
    return base;
  }
  const stamp = formatDate(date);
  return settings.datePosition === "before" ? `${stamp} ${base}` : `${base} ${stamp}`;
}

if (typeof module !== "undefined") {
  module.exports = { buildFilename, stripSiteName, formatDate, MAX_TITLE_LENGTH };
}
