/*
 * Srijon Captioner - Stylize engine v1
 * Turns forced-aligned WhisperX words into smart MOGRT blocks.
 *
 * Premiere 26.2 note:
 * UXP owns the UI, profiles, grouping and job queue.
 * A tiny invisible CEP/ExtendScript helper performs MOGRT Source Text writes
 * because that write path is more reliable than UXP for AE MOGRT text in 26.2.
 */

const STYLIZE_PRESET_STORAGE_KEY = "captioner.mogrtPresets.v1";
const STYLIZE_TRACK_STORAGE_KEY = "captioner.stylize.videoTrack.v1";
const STYLIZE_REPLACE_STORAGE_KEY = "captioner.stylize.replaceExisting.v1";
let stylizeBlocks = [];
let stylizeCurrentPreset = null;
let stylizeGenerating = false;

function stylizeReadPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STYLIZE_PRESET_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(function(p) {
      return p && p.profile && p.profilePath && p.mogrtPath;
    }) : [];
  } catch (_) {
    return [];
  }
}

function stylizeWritePresets(items) {
  localStorage.setItem(STYLIZE_PRESET_STORAGE_KEY, JSON.stringify(items || []));
}

function stylizeSafeId(value) {
  return String(value || "style")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "style";
}

function stylizeProfileDefaults(profile) {
  const src = profile && typeof profile === "object" ? profile : {};
  const slots = Array.isArray(src.slots) ? src.slots.map(function(slot, index) {
    return {
      role: String(slot.role || (index === 0 ? "primary" : "secondary")),
      controller: String(slot.controller || ("SC_TEXT_" + (index + 1))),
      required: slot.required !== false,
      maxChars: Math.max(4, Math.round(Number(slot.maxChars) || 24)),
      preferredWords: Math.max(1, Math.round(Number(slot.preferredWords) || 3))
    };
  }).filter(function(slot) { return !!slot.controller; }) : [];

  if (!slots.length) {
    throw new Error("This profile has no text slots. Export it again with Srijon_MOGRT_Author.jsx.");
  }

  const composer = src.composer || {};
  const timing = src.timing || {};
  return {
    schema: String(src.schema || ""),
    profileVersion: Number(src.profileVersion || 1),
    id: stylizeSafeId(src.id || src.displayName || "mogrt-style"),
    displayName: String(src.displayName || src.id || "MOGRT Style"),
    mogrtFile: String(src.mogrtFile || ""),
    strategy: String(src.strategy || (slots.length === 1 ? "single" : "double-balanced")),
    slots: slots,
    composer: {
      minTotalWords: Math.max(1, Math.round(Number(composer.minTotalWords) || 1)),
      maxTotalWords: Math.max(1, Math.round(Number(composer.maxTotalWords) || Math.max(5, slots.length * 3))),
      preferPhraseBoundaries: composer.preferPhraseBoundaries !== false,
      avoidOrphans: composer.avoidOrphans !== false,
      balanceSlots: composer.balanceSlots !== false,
      keywordPolicy: String(composer.keywordPolicy || "none"),
      punctuationAwareInternally: composer.punctuationAwareInternally !== false
    },
    timing: {
      wordLevel: timing.wordLevel === true || String(src.strategy) === "word",
      introProtectedSeconds: Math.max(0, Number(timing.introProtectedSeconds) || 0),
      outroProtectedSeconds: Math.max(0, Number(timing.outroProtectedSeconds) || 0),
      bodyMayStretch: timing.bodyMayStretch !== false,
      recommendedMinimumDurationSeconds: Math.max(0.05, Number(timing.recommendedMinimumDurationSeconds) || 0.65)
    }
  };
}

function stylizeRenderPresetOptions(selectedId) {
  const select = $("stylizePresetSelect");
  if (!select) return;
  const presets = stylizeReadPresets().slice().sort(function(a, b) {
    return String(a.profile.displayName || "").localeCompare(String(b.profile.displayName || ""));
  });
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = presets.length ? "Choose a MOGRT style" : "No MOGRT styles added";
  select.appendChild(empty);
  presets.forEach(function(item) {
    const option = document.createElement("option");
    option.value = item.profile.id;
    option.textContent = item.profile.displayName;
    select.appendChild(option);
  });
  if (selectedId && presets.some(function(p) { return p.profile.id === selectedId; })) {
    select.value = selectedId;
  } else {
    select.value = "";
  }
  stylizeCurrentPreset = presets.find(function(p) { return p.profile.id === select.value; }) || null;
  stylizeRenderProfileSummary();
}

function stylizeRenderProfileSummary() {
  const target = $("stylizeProfileMeta");
  if (!target) return;
  if (!stylizeCurrentPreset) {
    target.textContent = "Add the .srijon.json exported beside your MOGRT.";
    return;
  }
  const p = stylizeCurrentPreset.profile;
  const slotNames = p.slots.map(function(s) { return s.controller; }).join(" + ");
  target.textContent = p.strategy + " • " + slotNames + " • up to " + p.composer.maxTotalWords + " words";
}

async function stylizeAddPreset() {
  try {
    const profileFile = await fs.getFileForOpening({ types: ["json"] });
    if (!profileFile) return;
    const raw = await profileFile.read();
    const parsed = JSON.parse(String(raw || ""));
    if (String(parsed.schema || "") !== "srijon-mogrt-profile-v1") {
      throw new Error("Not a Srijon MOGRT profile. Expected schema srijon-mogrt-profile-v1.");
    }
    const profile = stylizeProfileDefaults(parsed);
    const profilePath = String(profileFile.nativePath || "");
    if (!profilePath) throw new Error("UXP did not return a native path for the selected profile.");

    let mogrtPath = profile.mogrtFile
      ? joinPath(dirnamePath(profilePath), profile.mogrtFile)
      : "";

    if (!mogrtPath || !nativeFs.existsSync(mogrtPath)) {
      setStatus("The matching MOGRT was not found beside the profile. Choose the .mogrt file now.", "ready");
      const mogrtFile = await fs.getFileForOpening({ types: ["mogrt"] });
      if (!mogrtFile) return;
      mogrtPath = String(mogrtFile.nativePath || "");
    }
    if (!mogrtPath || !nativeFs.existsSync(mogrtPath)) {
      throw new Error("The MOGRT file could not be found.");
    }

    let presets = stylizeReadPresets();
    const record = {
      profile: profile,
      profilePath: profilePath,
      mogrtPath: mogrtPath,
      addedAt: Date.now()
    };
    const index = presets.findIndex(function(p) { return p.profile && p.profile.id === profile.id; });
    if (index >= 0) presets[index] = record;
    else presets.push(record);
    stylizeWritePresets(presets);
    stylizeRenderPresetOptions(profile.id);
    stylizeBuildPreview();
    setStatus("Added MOGRT style \"" + profile.displayName + "\".", "success");
  } catch (e) {
    setStatus("Could not add MOGRT style: " + (e.message || e), "error");
  }
}

function stylizeRemovePreset() {
  const select = $("stylizePresetSelect");
  const id = select ? select.value : "";
  if (!id) return setStatus("Choose a MOGRT style first.", "error");
  const old = stylizeReadPresets();
  const next = old.filter(function(p) { return !p.profile || p.profile.id !== id; });
  stylizeWritePresets(next);
  stylizeBlocks = [];
  stylizeRenderPresetOptions("");
  stylizeRenderPreview();
  setStatus("Removed the saved MOGRT style. The original .mogrt and .json files were not deleted.", "success");
}

function stylizePreparedWords() {
  if (!rawTranscript || !Array.isArray(rawTranscript.words)) return [];
  const source = rawTranscript.words
    .map(function(w) {
      const normalized = normalizeWord(w);
      normalized.score = w && w.score != null ? Number(w.score) : null;
      return normalized;
    })
    .filter(function(w) {
      return w.text && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start;
    })
    .sort(function(a, b) { return a.start - b.start; });
  return prepareDisplayWords(source, captionRules());
}

function stylizeText(words) {
  return wordsText(words).replace(/\s+/g, " ").trim();
}

function stylizeWeakBreakPenalty(left, right) {
  if (!left || !right) return 0;
  let score = 0;
  try {
    score += breakLanguagePenalty(left, right);
  } catch (_) {}
  if (sentenceEnding(left.text)) score -= 8;
  else if (clauseEnding(left.text)) score -= 3.5;
  const gap = Math.max(0, right.start - left.end);
  if (gap >= 0.30) score -= 5;
  else if (gap >= 0.18) score -= 2.5;
  else if (gap >= 0.10) score -= 1;
  return score;
}

function stylizeKeywordScore(word) {
  if (!word) return -999;
  const clean = bareWord(word.text || word.displayText || "");
  if (!clean) return -999;
  const stop = new Set(["a","an","the","to","of","for","with","at","in","on","from","by","and","or","but","so","because","if","when","while","as","than","that","this","these","those","is","are","was","were","be","been","being"]);
  let score = stop.has(clean) ? -20 : 0;
  const shown = String(word.displayText || word.text || "");
  const letters = shown.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 4 && letters.length <= 11) score += 5;
  if (letters.length > 11) score += 2;
  if (letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) score += 8;
  if (/[A-Z].*[a-z]|[a-z].*[A-Z]/.test(shown)) score += 6;
  if (word.score != null && Number.isFinite(Number(word.score))) score += Math.max(0, Number(word.score)) * 0.5;
  return score;
}

function stylizeChooseKeyword(words) {
  let best = null;
  for (let i = 0; i < words.length; i++) {
    const score = stylizeKeywordScore(words[i]);
    if (!best || score > best.score) best = { index: i, word: words[i], score: score };
  }
  return best;
}

function stylizePartitionSlots(words, slots, profile) {
  if (!slots.length) return null;
  if (slots.length === 1) {
    const text = stylizeText(words);
    if (text.length > slots[0].maxChars && words.length > 1) return null;
    const delta = Math.abs(words.length - slots[0].preferredWords);
    return {
      fields: Object.fromEntries([[slots[0].controller, text]]),
      score: delta * 0.75 + Math.max(0, text.length - slots[0].maxChars) * 8
    };
  }

  let best = null;
  function walk(slotIndex, wordIndex, fields, sizes, score) {
    if (slotIndex === slots.length) {
      if (wordIndex !== words.length) return;
      let finalScore = score;
      if (profile.composer.balanceSlots && sizes.length > 1) {
        const max = Math.max.apply(null, sizes);
        const min = Math.min.apply(null, sizes);
        finalScore += (max - min) / Math.max(1, max) * 3.2;
      }
      if (!best || finalScore < best.score) best = { fields: Object.assign({}, fields), score: finalScore };
      return;
    }

    const slot = slots[slotIndex];
    const remainingSlots = slots.length - slotIndex - 1;
    const minTake = slot.required ? 1 : 0;
    const maxTake = words.length - wordIndex - remainingSlots;
    for (let take = minTake; take <= maxTake; take++) {
      const piece = words.slice(wordIndex, wordIndex + take);
      const text = stylizeText(piece);
      if (take && text.length > slot.maxChars && take > 1) break;
      if (!take && slot.required) continue;

      let partScore = Math.abs(take - slot.preferredWords) * 0.9;
      if (take === 1 && words.length > slots.length) partScore += 1.4;
      if (take && text.length > slot.maxChars) partScore += 18 + (text.length - slot.maxChars) * 4;
      if (take && slot.maxChars > 0) {
        const fill = Math.min(1.5, text.length / slot.maxChars);
        partScore += Math.pow(fill - 0.72, 2) * 1.1;
      }
      if (wordIndex + take < words.length && take > 0) {
        partScore += stylizeWeakBreakPenalty(words[wordIndex + take - 1], words[wordIndex + take]);
      }
      fields[slot.controller] = text;
      sizes.push(text.length);
      walk(slotIndex + 1, wordIndex + take, fields, sizes, score + partScore);
      sizes.pop();
      delete fields[slot.controller];
    }
  }

  walk(0, 0, {}, [], 0);
  return best;
}

function stylizeAllocateFields(words, profile) {
  const keywordSlots = profile.slots.filter(function(s) { return s.role === "keyword"; });
  const textSlots = profile.slots.filter(function(s) { return s.role !== "keyword"; });
  let result = stylizePartitionSlots(words, textSlots.length ? textSlots : profile.slots, profile);
  if (!result) return null;

  if (keywordSlots.length) {
    const keyword = stylizeChooseKeyword(words);
    const keywordText = keyword ? String(keyword.word.displayText || keyword.word.text || "") : "";
    keywordSlots.forEach(function(slot) {
      result.fields[slot.controller] = keywordText.length <= slot.maxChars
        ? keywordText
        : keywordText.slice(0, slot.maxChars);
    });
    if (keyword && keyword.score > 0) result.score -= Math.min(3, keyword.score * 0.15);
  }
  return result;
}

function stylizeBuildBlocks(words, profile) {
  if (!words.length) return [];
  const minWords = Math.min(profile.composer.maxTotalWords, profile.composer.minTotalWords);
  const maxWords = Math.max(minWords, profile.composer.maxTotalWords);
  const recommendedMin = profile.timing.recommendedMinimumDurationSeconds;
  const rules = captionRules();

  if (profile.timing.wordLevel || profile.strategy === "word") {
    const slot = profile.slots[0];
    const items = words.map(function(word) {
      const fields = {};
      fields[slot.controller] = String(word.displayText || word.text || "");
      return {
        start: word.start,
        rawEnd: word.end,
        end: word.end,
        fields: fields,
        words: [word],
        score: 0
      };
    });
    for (let i = 0; i < items.length - 1; i++) items[i].end = items[i + 1].start;
    if (items.length) {
      const last = items[items.length - 1];
      last.end = Math.max(last.rawEnd, last.start + recommendedMin);
    }
    return items;
  }

  const n = words.length;
  const dp = new Array(n + 1).fill(Infinity);
  const choice = new Array(n).fill(null);
  dp[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    for (let count = 1; count <= maxWords && i + count <= n; count++) {
      const j = i + count - 1;
      if (count > 1 && crossesHardPause(words, i, j, rules.pause)) break;
      const group = words.slice(i, j + 1);
      const allocation = stylizeAllocateFields(group, profile);
      if (!allocation) continue;

      const duration = Math.max(0.01, group[group.length - 1].end - group[0].start);
      if (duration > rules.maxDuration && count > 1) break;

      let score = allocation.score + dp[j + 1];
      if (count < minWords && j < n - 1) score += (minWords - count) * 4.5;
      if (duration < recommendedMin) score += (recommendedMin - duration) * 4.0;
      if (j < n - 1 && profile.composer.preferPhraseBoundaries) {
        score += stylizeWeakBreakPenalty(words[j], words[j + 1]);
      }
      if (profile.composer.avoidOrphans && count === 1 && j < n - 1) score += 5;

      if (score < dp[i]) {
        dp[i] = score;
        choice[i] = {
          next: j + 1,
          fields: allocation.fields,
          score: score,
          words: group
        };
      }
    }

    if (!choice[i]) {
      const one = [words[i]];
      const allocation = stylizeAllocateFields(one, profile);
      const fields = allocation ? allocation.fields : Object.fromEntries([[profile.slots[0].controller, stylizeText(one)]]);
      choice[i] = { next: i + 1, fields: fields, score: 50 + dp[i + 1], words: one };
      dp[i] = choice[i].score;
    }
  }

  const blocks = [];
  let at = 0;
  while (at < n) {
    const c = choice[at];
    const group = c.words;
    blocks.push({
      start: group[0].start,
      rawEnd: group[group.length - 1].end,
      end: group[group.length - 1].end,
      fields: c.fields,
      words: group,
      score: c.score
    });
    at = Math.max(at + 1, c.next);
  }

  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].end = blocks[i + 1].start;
  }
  if (blocks.length) {
    const last = blocks[blocks.length - 1];
    last.end = Math.max(last.rawEnd, last.start + recommendedMin);
  }
  return blocks;
}

function stylizeBuildPreview() {
  if (!stylizeCurrentPreset) {
    stylizeBlocks = [];
    stylizeRenderPreview();
    return false;
  }
  const words = stylizePreparedWords();
  if (!words.length) {
    stylizeBlocks = [];
    stylizeRenderPreview();
    if (currentOutputMode() === "stylize") {
      setStatus("Transcribe the sequence first, then Stylize can build MOGRT blocks from the aligned words.", "ready");
    }
    return false;
  }
  stylizeBlocks = stylizeBuildBlocks(words, stylizeCurrentPreset.profile);
  stylizeRenderPreview();
  setStatus(
    "Prepared " + stylizeBlocks.length + " styled caption blocks for \"" +
    stylizeCurrentPreset.profile.displayName + "\" using real aligned word timing.",
    "success"
  );
  return true;
}

function stylizeRenderPreview() {
  const preview = $("stylizePreview");
  const count = $("stylizeCount");
  if (count) count.textContent = stylizeBlocks.length + " blocks";
  if (!preview) return;
  preview.innerHTML = "";

  if (!stylizeBlocks.length) {
    const empty = document.createElement("div");
    empty.className = "stylizeEmpty";
    empty.textContent = stylizeCurrentPreset
      ? "Transcribe first, then build the styled preview."
      : "Add a MOGRT profile to begin.";
    preview.appendChild(empty);
    return;
  }

  stylizeBlocks.slice(0, 80).forEach(function(block) {
    const row = document.createElement("div");
    row.className = "stylizeBlock";
    const timing = document.createElement("div");
    timing.className = "time";
    timing.textContent = srtTime(block.start) + " → " + srtTime(block.end);
    row.appendChild(timing);
    Object.keys(block.fields).forEach(function(key) {
      const field = document.createElement("div");
      field.className = "stylizeField";
      const label = document.createElement("span");
      label.textContent = key;
      const value = document.createElement("strong");
      value.textContent = block.fields[key];
      field.appendChild(label);
      field.appendChild(value);
      row.appendChild(field);
    });
    preview.appendChild(row);
  });

  if (stylizeBlocks.length > 80) {
    const more = document.createElement("div");
    more.className = "stylizeEmpty";
    more.textContent = "Previewing first 80 blocks. Timeline generation includes all " + stylizeBlocks.length + ".";
    preview.appendChild(more);
  }
}

async function stylizeInstallBridge() {
  try {
    const installer = await getPluginAssetPath("install_stylize_bridge.bat");
    const result = await shell.openPath(
      installer,
      "Srijon Captioner needs this bundled Premiere timeline helper to write exposed MOGRT text fields on Premiere 26.2."
    );
    if (result) throw new Error(String(result));
    setStatus("Timeline helper installer launched. Close and reopen Premiere once, then return to Stylize.", "success");
  } catch (e) {
    setStatus("Could not launch the timeline helper installer: " + (e.message || e), "error");
  }
}

function stylizeJobId() {
  return "stylize-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
}

async function stylizeWaitForBridge(startedPath, resultPath) {
  const startedAt = Date.now();
  let sawStarted = false;
  while ((Date.now() - startedAt) < 900000) {
    if (!sawStarted && nativeFs.existsSync(startedPath)) {
      sawStarted = true;
      setStatus("Timeline helper received the job. Creating MOGRT caption clips…", "busy");
    }
    if (nativeFs.existsSync(resultPath)) {
      const raw = nativeFs.readFileSync(resultPath, { encoding: "utf-8" });
      return JSON.parse(String(raw || "{}"));
    }
    if (!sawStarted && (Date.now() - startedAt) > 10000) {
      throw new Error("The timeline helper did not pick up the job. Click Install / repair helper, restart Premiere once, and try again.");
    }
    await new Promise(function(resolve) { setTimeout(resolve, 500); });
  }
  throw new Error("Timed out waiting for Premiere to finish creating the styled captions.");
}

async function stylizeGenerateTimeline() {
  if (stylizeGenerating) return;
  if (!guardNoActiveCaptionJob("generate styled captions")) return;
  if (!guardNoActiveDeliveryAction("generate styled captions")) return;
  if (!stylizeCurrentPreset) return setStatus("Choose a MOGRT style first.", "error");
  if (!rawTranscript) return setStatus("Transcribe the sequence first.", "error");
  if (!nativeFs.existsSync(stylizeCurrentPreset.mogrtPath)) {
    return setStatus("The saved MOGRT file moved or was deleted. Remove this style and add its profile again.", "error");
  }
  if (!stylizeBlocks.length && !stylizeBuildPreview()) return;

  const project = await ppro.Project.getActiveProject();
  if (!project) return setStatus("No active Premiere project.", "error");
  const sequence = await project.getActiveSequence();
  if (!sequence) return setStatus("No active sequence.", "error");
  if (!dirnamePath(String(project.path || ""))) {
    return setStatus("Save the Premiere project first. Stylize uses a small job queue beside the project.", "error");
  }

  const humanTrack = Math.max(1, Math.round(Number($("stylizeVideoTrack").value) || 3));
  localStorage.setItem(STYLIZE_TRACK_STORAGE_KEY, String(humanTrack));
  const replaceExisting = !!($("stylizeReplaceExisting") && $("stylizeReplaceExisting").checked);
  localStorage.setItem(STYLIZE_REPLACE_STORAGE_KEY, replaceExisting ? "true" : "false");

  const queue = await projectOutputFolder(project, "StylizeBridge");
  if (!queue) return setStatus("Could not create the StylizeBridge job folder beside the project.", "error");

  const id = stylizeJobId();
  const jobPath = joinPath(queue, id + ".job.json");
  const startedPath = joinPath(queue, id + ".started.json");
  const resultPath = joinPath(queue, id + ".result.json");
  const profile = stylizeCurrentPreset.profile;
  const job = {
    schema: "srijon-stylize-job-v1",
    jobId: id,
    createdAt: new Date().toISOString(),
    sequenceName: String(sequence.name || ""),
    presetId: profile.id,
    presetName: profile.displayName,
    mogrtPath: stylizeCurrentPreset.mogrtPath,
    videoTrackIndex: humanTrack - 1,
    replaceExisting: replaceExisting,
    clipNamePrefix: "SCAP:" + profile.id + ":",
    blocks: stylizeBlocks.map(function(block, index) {
      return {
        index: index,
        start: Number(block.start),
        end: Number(block.end),
        fields: block.fields,
        name: "SCAP:" + profile.id + ":" + String(index + 1).padStart(4, "0")
      };
    })
  };

  stylizeGenerating = true;
  setControlDisabled("stylizeGenerateBtn", true);
  try {
    writeUtf8FileVerified(jobPath, JSON.stringify(job, null, 2));
    setStatus("Queued " + job.blocks.length + " styled captions for V" + humanTrack + ". Waiting for the Premiere timeline helper…", "busy");
    const result = await stylizeWaitForBridge(startedPath, resultPath);
    if (!result || result.ok !== true) {
      throw new Error((result && result.error) || "The timeline helper reported an unknown failure.");
    }
    setStatus(
      "Styled captions ready • " + Number(result.created || 0) + " MOGRT clips on V" + humanTrack +
      (Number(result.removed || 0) ? " • replaced " + Number(result.removed) + " old generated clips" : "") + ".",
      "success"
    );
  } catch (e) {
    setStatus("Stylize failed: " + (e.message || e), "error");
  } finally {
    stylizeGenerating = false;
    setControlDisabled("stylizeGenerateBtn", false);
  }
}

function renderStylizeWorkspace() {
  const select = $("stylizePresetSelect");
  if (select) {
    const presets = stylizeReadPresets();
    stylizeCurrentPreset = presets.find(function(p) { return p.profile && p.profile.id === select.value; }) || null;
  }
  stylizeRenderProfileSummary();
  if (rawTranscript && stylizeCurrentPreset) stylizeBuildPreview();
  else stylizeRenderPreview();
}


function stylizeSetMode(active) {
  const smartBtn = $("modeSmartBtn");
  const jsonBtn = $("modeWordJsonBtn");
  const stylizeBtn = $("modeStylizeBtn");
  const input = $("outputMode");

  if (active) {
    if (input) input.value = "stylize";
    localStorage.setItem("captioner.outputMode", "stylize");
    if (smartBtn) {
      smartBtn.classList.remove("active");
      smartBtn.setAttribute("aria-pressed", "false");
    }
    if (jsonBtn) {
      jsonBtn.classList.remove("active");
      jsonBtn.setAttribute("aria-pressed", "false");
    }
    if (stylizeBtn) {
      stylizeBtn.classList.add("active");
      stylizeBtn.setAttribute("aria-pressed", "true");
    }
    if ($("outputModeChip")) $("outputModeChip").textContent = "MOGRT";
    ["smartComposeSection","smartPreviewSection","smartExportSection","wordJsonSection"].forEach(function(id) {
      const el = $(id); if (el) el.classList.add("modeHidden");
    });
    const section = $("stylizeSection");
    if (section) section.classList.remove("modeHidden");
    renderStylizeWorkspace();
    setStatus(rawTranscript
      ? "Stylize is ready. Choose a MOGRT profile, preview the smart word placement, then generate."
      : "Stylize is ready. Transcribe first so it can use real aligned word timing.", "ready");
    return;
  }

  if (stylizeBtn) {
    stylizeBtn.classList.remove("active");
    stylizeBtn.setAttribute("aria-pressed", "false");
  }
  const section = $("stylizeSection");
  if (section) section.classList.add("modeHidden");
}

function stylizeWireMode() {
  const stylizeBtn = $("modeStylizeBtn");
  if (stylizeBtn) stylizeBtn.addEventListener("click", function() {
    if (!guardNoActiveCaptionJob("open Stylize")) return;
    stylizeSetMode(true);
  });

  ["modeSmartBtn","modeWordJsonBtn"].forEach(function(id) {
    const button = $(id);
    if (button) button.addEventListener("click", function() {
      stylizeSetMode(false);
    });
  });

  const stored = localStorage.getItem("captioner.outputMode");
  if (stored === "stylize") stylizeSetMode(true);
}

function stylizeInit() {
  stylizeRenderPresetOptions("");
  stylizeWireMode();
  const storedTrack = localStorage.getItem(STYLIZE_TRACK_STORAGE_KEY);
  if ($("stylizeVideoTrack")) $("stylizeVideoTrack").value = storedTrack || "3";
  const storedReplace = localStorage.getItem(STYLIZE_REPLACE_STORAGE_KEY);
  if ($("stylizeReplaceExisting")) $("stylizeReplaceExisting").checked = storedReplace !== "false";

  if ($("stylizePresetSelect")) $("stylizePresetSelect").addEventListener("change", function() {
    const presets = stylizeReadPresets();
    stylizeCurrentPreset = presets.find(function(p) {
      return p.profile && p.profile.id === $("stylizePresetSelect").value;
    }) || null;
    stylizeRenderProfileSummary();
    stylizeBuildPreview();
  });
  if ($("addStylizePresetBtn")) $("addStylizePresetBtn").addEventListener("click", stylizeAddPreset);
  if ($("removeStylizePresetBtn")) $("removeStylizePresetBtn").addEventListener("click", stylizeRemovePreset);
  if ($("stylizeBuildBtn")) $("stylizeBuildBtn").addEventListener("click", stylizeBuildPreview);
  if ($("stylizeGenerateBtn")) $("stylizeGenerateBtn").addEventListener("click", stylizeGenerateTimeline);
  if ($("stylizeInstallBridgeBtn")) $("stylizeInstallBridgeBtn").addEventListener("click", stylizeInstallBridge);
  if ($("stylizeVideoTrack")) $("stylizeVideoTrack").addEventListener("change", function() {
    localStorage.setItem(STYLIZE_TRACK_STORAGE_KEY, String($("stylizeVideoTrack").value || "3"));
  });
  if ($("stylizeReplaceExisting")) $("stylizeReplaceExisting").addEventListener("change", function() {
    localStorage.setItem(STYLIZE_REPLACE_STORAGE_KEY, $("stylizeReplaceExisting").checked ? "true" : "false");
  });
  stylizeRenderPreview();
}

stylizeInit();
