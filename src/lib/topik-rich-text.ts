function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderTopikRichText(input: string) {
  const escaped = escapeHtml(input);

  return escaped
    .replace(/&lt;(\/?)(b|strong)&gt;/gi, "<$1$2>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br />")
    .replace(/\r\n|\r|\n/g, "<br />");
}
