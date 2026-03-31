function sendInitialEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  try {
    const ss = SpreadsheetApp.getActive();
    const leads = ss.getSheetByName("leads");
    const templates = ss.getSheetByName("templates");
    const config = ss.getSheetByName("config");

    // master on/off
    if (String(config.getRange("B1").getValue()).trim().toUpperCase() !== "TRUE") return;

    // --- config values ---
    const signature = String(config.getRange("B2").getValue() || "");
    const DAILY_LIMIT = Number(config.getRange("B3").getValue()); // NOW pulled directly from config (no fallback)

    let sentToday = Number(config.getRange("B4").getValue() || 0);
    const lastDate = String(config.getRange("B5").getValue() || "");
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    // reset daily counter if new day
    if (lastDate !== today) {
      sentToday = 0;
      config.getRange("B4").setValue(0);
      config.getRange("B5").setValue(today);
    }

    /* ===========================
       PAUSE CHECK
       =========================== */
    const pausedUntil = String(config.getRange("B12").getValue() || "").trim();
    if (pausedUntil) {
      if (pausedUntil > today) return; // still paused
      config.getRange("B12").setValue(""); // pause expired → resume
    }
    /* =========================== */

    const PER_RUN_LIMIT = Number(config.getRange("B6").getValue() || 10);
    const MIN_DELAY_MS = Number(config.getRange("B7").getValue() || 2000);
    const MAX_DELAY_MS = Number(config.getRange("B8").getValue() || 6000);
    const LONG_BREAK_CHANCE = Number(config.getRange("B9").getValue() || 0.10);
    const LONG_BREAK_MIN_MS = Number(config.getRange("B10").getValue() || 30000);
    const LONG_BREAK_MAX_MS = Number(config.getRange("B11").getValue() || 90000);

    if (sentToday >= DAILY_LIMIT) return;

    // --- load data ---
    const leadsData = leads.getDataRange().getValues();
    const templateData = templates.getDataRange().getValues();

    // --- Get column indices from headers ---
    const headers = leadsData[0];
    const columnIndices = {};
    for (let i = 0; i < headers.length; i++) {
      columnIndices[String(headers[i]).trim()] = i;
    }

    // Validate required columns exist
    const requiredColumns = ["lead_id", "email", "status", "sent_at", "followup_count", "last_followup_at"];
    for (const col of requiredColumns) {
      if (columnIndices[col] === undefined) {
        throw new Error(`Missing required column: ${col}`);
      }
    }

    // Helper function to get column index by name
    function getCol(columnName) {
      const idx = columnIndices[columnName];
      if (idx === undefined) {
        throw new Error(`Column '${columnName}' not found in leads sheet`);
      }
      return idx;
    }

    // --- parse templates ---
    const stages = [];
    const stageMap = {};
    for (let i = 1; i < templateData.length; i++) {
      const name = String(templateData[i][0] || "").trim();
      if (!name) continue;

      const subject = String(templateData[i][1] || "");
      const body = String(templateData[i][2] || "");
      const delayRaw = templateData[i][3];
      const delayDays =
        delayRaw === "" || delayRaw === null || delayRaw === undefined
          ? NaN
          : Number(delayRaw);

      stages.push(name);
      stageMap[name] = { subject, body, delayDays };
    }

    for (const s of stages) {
      const d = Number(stageMap[s].delayDays || 0);
      if (s !== "intro" && d < 1) {
        throw new Error(`BAD CONFIG: template '${s}' has delay_days=${d}`);
      }
    }

    if (!stageMap["intro"]) throw new Error("Missing 'intro' template");

    function prevStageName(stageName) {
      const idx = stages.indexOf(stageName);
      return idx <= 0 ? null : stages[idx - 1];
    }

    function isEligibleForStage(stageName, status) {
      status = String(status || "").trim();
      if (status === "REPLIED" || status === "DO_NOT_CONTACT") return false;
      if (stageName === "intro") {
        return status === "" || status === "NEW" || status === "NOT_CONTACTED";
      }
      return status === `SENT_${prevStageName(stageName)}`;
    }

    function cooldownPassed(stageName, sentAt, lastFollowup) {
      const delayDays = stageMap[stageName].delayDays || 0;
      if (delayDays <= 0) return true;

      const base =
        stageName === "intro" || stageName === "followup_1"
          ? sentAt
          : lastFollowup;

      if (!base) return false;
      const t = base instanceof Date ? base : new Date(base);
      return Date.now() - t.getTime() >= delayDays * 86400000;
    }

    let sentThisRun = 0;

    for (const stageName of stages) {
      if (sentThisRun >= PER_RUN_LIMIT || sentToday >= DAILY_LIMIT) break;

      for (let i = 1; i < leadsData.length; i++) {
        if (sentThisRun >= PER_RUN_LIMIT || sentToday >= DAILY_LIMIT) break;

        const email = String(leadsData[i][getCol("email")] || "").trim();
        if (!email) continue;

        if (!isEligibleForStage(stageName, leadsData[i][getCol("status")])) continue;
        if (!cooldownPassed(stageName, leadsData[i][getCol("sent_at")], leadsData[i][getCol("last_followup_at")])) continue;

        // Get additional columns if they exist (optional columns)
        const domain = columnIndices["domain_name"] !== undefined
          ? String(leadsData[i][getCol("domain_name")] || "").trim()
          : "";

        const rawPrice = columnIndices["price"] !== undefined
          ? leadsData[i][getCol("price")]
          : "";

        const price =
          typeof rawPrice === "number"
            ? rawPrice.toLocaleString("en-US")
            : String(rawPrice || "");

        let subject = stageMap[stageName].subject
          .replaceAll("{{domain_name}}", domain)
          .replaceAll("{{price}}", price);

        let body = stageMap[stageName].body
          .replaceAll("{{domain_name}}", domain)
          .replaceAll("{{price}}", price);

        if (signature) body += "\n\n" + signature;

        /* ===========================
           QUOTA CATCH
           =========================== */
        try {
          GmailApp.sendEmail(email, subject, body, { name: "Amphi Kreiman" });
        } catch (e) {
          const msg = String(e && e.message ? e.message : e);

          if (
            msg.includes("Service invoked too many times for one day") ||
            msg.includes("Daily user sending quota exceeded")
          ) {
            const tomorrow = Utilities.formatDate(
              new Date(Date.now() + 24 * 60 * 60 * 1000),
              Session.getScriptTimeZone(),
              "yyyy-MM-dd"
            );
            config.getRange("B12").setValue(tomorrow);
            return; // STOP ENTIRE RUN
          }

          continue; // non-quota error → skip lead
        }
        /* =========================== */

        // FIX: Force immediate write to sheet before logging
        const row = i + 1;

        // Update status IMMEDIATELY after send
        leads.getRange(row, getCol("status") + 1).setValue(`SENT_${stageName}`);

        // Update sent_at timestamp for intro
        if (stageName === "intro" && !leads.getRange(row, getCol("sent_at") + 1).getValue()) {
          leads.getRange(row, getCol("sent_at") + 1).setValue(new Date());
        }

        // Update followup tracking for non-intro stages
        if (stageName !== "intro") {
          leads.getRange(row, getCol("followup_count") + 1).setValue(Number(leadsData[i][getCol("followup_count")] || 0) + 1);
          leads.getRange(row, getCol("last_followup_at") + 1).setValue(new Date());
        }

        // FORCE FLUSH - ensure writes happen immediately
        SpreadsheetApp.flush();

        // THEN log to email_log
        appendEmailLog_(ss, {
          ts: new Date(),
          leadId: leadsData[i][getCol("lead_id")],
          toEmail: email,
          domainName: domain,
          stage: stageName,
          subject,
          statusWritten: `SENT_${stageName}`
        });

        sentThisRun++;
        sentToday++;
        config.getRange("B4").setValue(sentToday);

        // FORCE FLUSH again to ensure counter is updated
        SpreadsheetApp.flush();

        // Normal short delay (B7–B8)
        Utilities.sleep(
          Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS
        );

        // ===== LONG BREAK (B9–B11) =====
        if (Math.random() < LONG_BREAK_CHANCE) {
          const longBreakMs =
            Math.floor(Math.random() * (LONG_BREAK_MAX_MS - LONG_BREAK_MIN_MS + 1)) +
            LONG_BREAK_MIN_MS;

          Utilities.sleep(longBreakMs);
        }
        // ===============================
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function appendEmailLog_(ss, rowObj) {
  const sh = ss.getSheetByName("email_log") || ss.insertSheet("email_log");

  // add headers once
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ts",
      "lead_id",
      "to_email",
      "domain_name",
      "stage",
      "subject",
      "status_written"
    ]);
  }

  sh.appendRow([
    rowObj.ts,
    rowObj.leadId,
    rowObj.toEmail,
    rowObj.domainName,
    rowObj.stage,
    rowObj.subject,
    rowObj.statusWritten
  ]);

  // FORCE FLUSH to ensure log is written
  SpreadsheetApp.flush();
}
