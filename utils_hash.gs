/** utils_hash.gs */

function sha256Hex(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var v = (raw[i] < 0) ? raw[i] + 256 : raw[i];
    var h = v.toString(16);
    if (h.length === 1) h = "0" + h;
    out.push(h);
  }
  return out.join("");
}
