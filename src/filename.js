const MAX_TITLE_LENGTH = 120;
const MAX_SITE_LENGTH = 40;
const MIN_TITLE_REMAINING = 10;
const SITE_SUFFIX = /^(.*\S)\s+[-|–—·]\s+(\S.*)$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(date) {
  return `${pad(date.getHours())}.${pad(date.getMinutes())}`;
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
  const parts = {
    title: base,
    date: formatDate(date),
    time: formatTime(date),
    hostname: hostnameOf(url),
    year: String(date.getFullYear()),
    month: pad(date.getMonth() + 1),
    day: pad(date.getDate()),
  };
  const name = settings.template
    .replace(/\{(title|date|time|hostname|year|month|day)\}/g, (token, key) => parts[key])
    .replace(/\s+/g, " ")
    .trim();
  return name || base;
}

if (typeof module !== "undefined") {
  module.exports = { buildFilename, stripSiteName, formatDate, MAX_TITLE_LENGTH };
}
