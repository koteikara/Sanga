/**
 * Sync CalendarEvents sheet -> Google Calendar
 *
 * Rules:
 * - eventKey is the primary key
 * - calendarEventId exists:
 *    - status=cancelled -> (1) get+update status=cancelled, (2) fallback remove
 *    - otherwise        -> patch (update)
 * - calendarEventId empty:
 *    - status=cancelled -> skip (nothing to cancel)
 *    - otherwise        -> insert
 *
 * Safety:
 * - TARGET_CALENDAR_ID must not be empty nor 'primary'
 */
function sync_calendar_events_from_sheet(dryRun) {
  dryRun = !!dryRun;

  var cfg = CFG();
  var calId = String(cfg.TARGET_CALENDAR_ID || "").trim();

  if (!calId || calId === "primary") {
    throw new Error("Safety stop: TARGET_CALENDAR_ID is empty or 'primary'.");
  }

  ensureCalendarEventsSheet();

  // runtime log (事故防止)
  try {
    var calMeta = Calendar.Calendars.get(calId);
    console.log(
      "[runtime] calendar id=" + calId +
      " summary=" + (calMeta.summary || "") +
      " accessRole=" + (calMeta.accessRole || "")
    );
  } catch (e) {
    throw new Error("Failed to access target calendar: " + (e && e.message ? e.message : e));
  }

  var records = listCalendarEventsRecords({});
  var nowIso = Utilities.formatDate(new Date(), cfg.TZ, "yyyy-MM-dd'T'HH:mm:ss");

  var inserted = 0;
  var updated = 0;
  var cancelled = 0;
  var skipped = 0;
  var errors = 0;

  for (var i = 0; i < records.length; i++) {
    var rec = records[i];

    try {
      var status = String(rec.status || "active").toLowerCase();

      // fingerprint（ユーザー可視項目のみ）
      var fpSource =
        String(rec.title || "") + "|" +
        String(rec.startIso || "") + "|" +
        String(rec.endIso || "");
      var fp = sha256Hex(fpSource);

      // -----------------------------
      // CANCELLED
      // -----------------------------
      if (status === "cancelled") {
        if (!rec.calendarEventId) {
          skipped++;
          console.log("[cancel-skip] no eventId eventKey=" + rec.eventKey);
          continue;
        }

        if (dryRun) {
          cancelled++;
          console.log("[cancel:dry-run] eventKey=" + rec.eventKey + " eventId=" + rec.calendarEventId);
          // dry-runでもシートは更新しない（lastSyncAtなど）
          continue;
        }

        // 1) get -> update(status=cancelled)
        var cancelledOk = false;
        try {
          var ev = Calendar.Events.get(calId, rec.calendarEventId);
          ev.status = "cancelled";
          Calendar.Events.update(ev, calId, rec.calendarEventId);
          cancelledOk = true;
          console.log("[cancel:update] eventKey=" + rec.eventKey + " eventId=" + rec.calendarEventId);
        } catch (e1) {
          console.error("[cancel:update:error] eventKey=" + rec.eventKey + " eventId=" + rec.calendarEventId +
                        " message=" + (e1 && e1.message ? e1.message : e1));
        }

        // 2) fallback remove (delete) if update failed
        if (!cancelledOk) {
          try {
            Calendar.Events.remove(calId, rec.calendarEventId);
            cancelledOk = true;
            console.log("[cancel:remove] eventKey=" + rec.eventKey + " eventId=" + rec.calendarEventId);
          } catch (e2) {
            console.error("[cancel:remove:error] eventKey=" + rec.eventKey + " eventId=" + rec.calendarEventId +
                          " message=" + (e2 && e2.message ? e2.message : e2));
            throw e2;
          }
        }

        // sheet update (keep eventId even if removed; status tells truth)
        updateCalendarEventsRowAfterSync_(rec, {
          lastSyncAt: nowIso,
          fingerprint: fp
        });

        cancelled++;
        continue; // ★重要：insert/patch に落とさない
      }

      // -----------------------------
      // INSERT
      // -----------------------------
      if (!rec.calendarEventId) {
        if (dryRun) {
          inserted++;
          console.log("[insert:dry-run] eventKey=" + rec.eventKey);
        } else {
          var evInsert = buildCalendarEventPayload_(rec, cfg);
          var created = Calendar.Events.insert(evInsert, calId);

          updateCalendarEventsRowAfterSync_(rec, {
            calendarEventId: created.id,
            lastSyncAt: nowIso,
            fingerprint: fp
          });

          inserted++;
          console.log("[insert] eventKey=" + rec.eventKey + " eventId=" + created.id);
        }
        continue;
      }

      // -----------------------------
      // PATCH (UPDATE)
      // -----------------------------
      if (rec.fingerprint && rec.fingerprint === fp) {
        skipped++;
        console.log("[skip] no change eventKey=" + rec.eventKey);
        continue;
      }

      if (dryRun) {
        updated++;
        console.log("[patch:dry-run] eventKey=" + rec.eventKey + " eventId=" + rec.calendarEventId);
      } else {
        var evPatch = buildCalendarEventPayload_(rec, cfg);
        Calendar.Events.patch(evPatch, calId, rec.calendarEventId);

        updateCalendarEventsRowAfterSync_(rec, {
          lastSyncAt: nowIso,
          fingerprint: fp
        });

        updated++;
        console.log("[patch] eventKey=" + rec.eventKey + " eventId=" + rec.calendarEventId);
      }

    } catch (err) {
      errors++;
      console.error(
        "[error] eventKey=" + rec.eventKey +
        " message=" + (err && err.message ? err.message : err)
      );
    }
  }

  console.log(
    "[sync] done dryRun=" + dryRun +
    " inserted=" + inserted +
    " updated=" + updated +
    " cancelled=" + cancelled +
    " skipped=" + skipped +
    " errors=" + errors
  );
}

/**
 * Build Calendar API event payload from CalendarEvents record
 * (for insert/patch of active events)
 */
function buildCalendarEventPayload_(rec, cfg) {
  var ev = {
    summary: rec.title || "",
    description: rec.description || "",
    location: rec.location || "",
    status: "confirmed"
  };

  if (rec.url) {
    ev.description = (ev.description ? ev.description + "\n\n" : "") + rec.url;
  }

  if (rec.isAllDay === true) {
    ev.start = { date: String(rec.startIso || "").substring(0, 10) };
    ev.end   = { date: String(rec.endIso || "").substring(0, 10) };
  } else {
    ev.start = { dateTime: rec.startIso, timeZone: cfg.TZ };
    ev.end   = { dateTime: rec.endIso,   timeZone: cfg.TZ };
  }

  return ev;
}

/**
 * Update CalendarEvents sheet after successful sync
 */
function updateCalendarEventsRowAfterSync_(rec, updates) {
  updates = updates || {};

  var row = {
    eventKey: rec.eventKey,
    calendarEventId: updates.calendarEventId !== undefined ? updates.calendarEventId : rec.calendarEventId,
    source: rec.source,
    status: rec.status,
    title: rec.title,
    startIso: rec.startIso,
    endIso: rec.endIso,
    isAllDay: rec.isAllDay,
    location: rec.location,
    description: rec.description,
    url: rec.url,
    lastSyncAt: updates.lastSyncAt || rec.lastSyncAt,
    fingerprint: updates.fingerprint || rec.fingerprint
  };

  upsertCalendarEventsRow(row);
}
