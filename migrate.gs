/** migrate.gs */

// Optional: migrate legacy PropertiesService mapping itemKey->eventId to EventLedger.
function migrate_from_properties_to_ledger() {
  var cfg = CFG();
  ensureSafety_(cfg);
  ensureLedgerSheet();

  var props = PropertiesService.getScriptProperties().getProperties();
  var keys = Object.keys(props);

  var migrated = 0;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!k) continue;

    // Heuristic: legacy keys are sha256 hex length 64 and value looks like calendar event id.
    if (!/^[0-9a-f]{64}$/.test(k)) continue;

    var v = props[k];
    if (!v) continue;

    var existing = getLedgerRowByItemKey(k);
    if (existing) continue;

    upsertLedgerRow({
      itemKey: k,
      calendarEventId: v,
      articleId: "",
      url: "",
      type: "",
      label: "",
      startIso: "",
      endIso: "",
      summary: "",
      fingerprint: sha256Hex("|" + v), // placeholder
      lastUpsertAt: nowIso_(),
      status: "active"
    });
    migrated += 1;
  }

  console.log("[migrate] migrated=" + migrated);
}
