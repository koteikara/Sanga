/** utils_text.gs */

function zenkakuToHankakuDigits(s) {
  return String(s || "").replace(/[０-９]/g, function(ch){
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

function normalizeWs(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "");
}
