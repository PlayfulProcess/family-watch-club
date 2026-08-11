"use strict";

const $ = (id) => document.getElementById(id);

let settings = { enabled: true, allCaps: true, offsetSeconds: 0, activeSetId: "moana" };
let promptSets = {};

const BUNDLED = ["prompts/moana.json", "prompts/moana-legends.json", "prompts/moana-repair.json"];

async function seedIfEmpty() {
  const data = await chrome.storage.local.get(["settings", "promptSets"]);
  if (data.settings) settings = Object.assign(settings, data.settings);
  promptSets = data.promptSets || {};
  let changed = false;
  for (const path of BUNDLED) {
    try {
      const res = await fetch(chrome.runtime.getURL(path));
      const set = await res.json();
      if (!set || !set.id) continue;
      const stored = promptSets[set.id];
      if (!stored || (set.version || 0) > (stored.version || 0)) {
        promptSets[set.id] = set;
        changed = true;
      }
    } catch (e) { /* skip */ }
  }
  if (changed) await chrome.storage.local.set({ promptSets });
}

function movieOf(set) { return set.movie || set.title || set.id; }
function themeOf(set) { return set.theme || set.title || set.id; }

function render() {
  $("enabled").checked = !!settings.enabled;
  $("caps").checked = !!settings.allCaps;
  $("offset").value = settings.offsetSeconds || 0;
  $("token").value = settings.apiToken || "";

  const sets = Object.values(promptSets);
  const active = promptSets[settings.activeSetId] || sets[0];
  const activeMovie = active ? movieOf(active) : null;

  const movieSel = $("movie");
  movieSel.innerHTML = "";
  [...new Set(sets.map(movieOf))].forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    if (m === activeMovie) opt.selected = true;
    movieSel.appendChild(opt);
  });

  const themeSel = $("theme");
  themeSel.innerHTML = "";
  sets.filter((s) => movieOf(s) === activeMovie).forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = themeOf(s);
    if (active && s.id === active.id) opt.selected = true;
    themeSel.appendChild(opt);
  });

  const eye = $("eye");
  if (active && active.grammarId) {
    eye.href = "https://flow.recursive.eco/g/" + active.grammarId;
    eye.style.display = "inline";
  } else {
    eye.style.display = "none";
  }

  $("refresh").style.display = active && active.sourceUrl ? "block" : "none";
}

function save() {
  chrome.storage.local.set({ settings });
}

function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

async function grabTime() {
  const out = $("time-result");
  out.textContent = "...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "mc-get-time" });
    if (resp && typeof resp.time === "number") {
      out.textContent = `Movie time: "${fmt(resp.time)}" (${Math.round(resp.time)}s)`;
    } else {
      out.textContent = "No playing video found on this tab.";
    }
  } catch (e) {
    out.textContent = "No video found — is the movie tab active?";
  }
}

// ---------- import: prompt sets and recursive.eco grammars ----------

const LENS_LABELS = { discussion: "Discussion", repair: "Repair Lens", legends: "Real Legends" };
function lensLabel(lens) {
  return LENS_LABELS[lens] || (lens.charAt(0).toUpperCase() + lens.slice(1));
}

// Unwrap common API response shapes down to the grammar object itself.
// Handles: { grammar: {...} } wrappers, raw user_documents rows (document_data),
// and the public decks endpoint which calls items "cards".
function unwrapGrammar(obj) {
  if (obj && obj.grammar && typeof obj.grammar === "object") obj = obj.grammar;
  if (obj && obj.document_data && typeof obj.document_data === "object") {
    obj = Object.assign({}, obj, obj.document_data);
  }
  if (obj && !Array.isArray(obj.items) && Array.isArray(obj.cards)) {
    obj = Object.assign({}, obj, { items: obj.cards });
  }
  return obj;
}

// Convert a recursive.eco grammar (items + sections) into one prompt set per
// lens. Items need a movie timestamp in metadata.time; others are skipped.
// Mapping: Story -> story, Wonder Together -> kid, For the Grown-up -> parent,
// metadata.quiz -> quiz, metadata.lens -> which theme/set the point joins.
function grammarToSets(g, source) {
  const slug = String(g.name || "imported-grammar")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const movie = (() => {
    const first = (g.items || []).find((it) => it.metadata && it.metadata.movie);
    return (first && first.metadata.movie) || g.name || slug;
  })();
  const byLens = {};
  let skipped = 0;
  (g.items || []).forEach((item) => {
    const meta = item.metadata || {};
    const s = item.sections || {};
    const time = meta.time || meta.movie_time || s.Time;
    if (time === undefined || time === null || time === "") { skipped++; return; }
    const point = { time, title: item.name || item.id };
    const story = String(s.Story || "").split("* WONDER TOGETHER *")[0].trim();
    if (story) point.story = story;
    if (s["Wonder Together"]) point.kid = s["Wonder Together"];
    if (s["For the Grown-up"]) point.parent = s["For the Grown-up"];
    if (meta.quiz && Array.isArray(meta.quiz.options)) point.quiz = meta.quiz;
    const lens = meta.lens || item.category || "discussion";
    (byLens[lens] = byLens[lens] || []).push(point);
  });
  const toSec = (t) => String(t).split(":").reduce((acc, p) => acc * 60 + Number(p), 0);
  const sets = Object.entries(byLens).map(([lens, points]) => {
    points.sort((a, b) => toSec(a.time) - toSec(b.time));
    return {
      id: `${slug}-${lens}`,
      title: `${movie} — ${lensLabel(lens)}`,
      movie,
      theme: lensLabel(lens),
      note: g.description || "",
      grammarId: g.id || (source && source.grammarId) || undefined,
      sourceUrl: source && source.url ? source.url : undefined,
      points
    };
  });
  return { sets, skipped };
}

async function importParsed(parsed, source) {
  let sets, skipped = 0, label;
  parsed = unwrapGrammar(parsed);
  if (Array.isArray(parsed.points)) {
    if (!parsed.id) throw new Error("Needs 'id' and 'points'.");
    if (source && source.url) parsed.sourceUrl = source.url;
    sets = [parsed];
    label = parsed.title || parsed.id;
  } else if (Array.isArray(parsed.items)) {
    const converted = grammarToSets(parsed, source);
    sets = converted.sets;
    skipped = converted.skipped;
    if (sets.length === 0) {
      throw new Error("No items had a movie timestamp. Add metadata.time (like \"58:40\") to the items you want as pause points.");
    }
    label = sets.map((s) => `${s.theme} (${s.points.length})`).join(", ");
  } else {
    throw new Error("Not a prompt set (points) or grammar (items).");
  }
  sets.forEach((s) => { promptSets[s.id] = s; });
  settings.activeSetId = sets[0].id;
  await chrome.storage.local.set({ promptSets, settings });
  render();
  const extra = skipped > 0 ? ` — ${skipped} items without metadata.time skipped` : "";
  $("time-result").textContent = `Imported ${label}${extra}.`;
}

function importFile() { $("file").click(); }

function onFile(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await importParsed(JSON.parse(reader.result));
    } catch (e) {
      $("time-result").textContent = "Import failed: " + e.message;
    }
  };
  reader.readAsText(file);
}

async function importUrl(url) {
  url = (url || "").trim();
  if (!url) { $("time-result").textContent = "Paste a JSON URL first."; return; }
  $("time-result").textContent = "Fetching...";
  try {
    const headers = {};
    if (settings.apiToken && /^https:\/\/[^/]*recursive\.eco\//.test(url)) {
      headers["Authorization"] = "Bearer " + settings.apiToken;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(res.status === 401 || res.status === 403 || res.status === 404
        ? `HTTP ${res.status} — for a private grammar, paste your recursive.eco API token below.`
        : `HTTP ${res.status}`);
    }
    await importParsed(await res.json(), { url });
  } catch (e) {
    $("time-result").textContent = "Fetch failed: " + e.message;
  }
}

async function refreshActive() {
  const active = promptSets[settings.activeSetId];
  if (!active || !active.sourceUrl) return;
  const keep = settings.activeSetId;
  await importUrl(active.sourceUrl);
  if (promptSets[keep]) {
    settings.activeSetId = keep;
    await chrome.storage.local.set({ settings });
    render();
  }
}

function exportSet() {
  const set = promptSets[settings.activeSetId];
  if (!set) return;
  const blob = new Blob([JSON.stringify(set, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${set.id}.json`;
  a.click();
}

document.addEventListener("DOMContentLoaded", async () => {
  await seedIfEmpty();
  render();
  $("enabled").addEventListener("change", (e) => { settings.enabled = e.target.checked; save(); });
  $("caps").addEventListener("change", (e) => { settings.allCaps = e.target.checked; save(); });
  $("offset").addEventListener("change", (e) => { settings.offsetSeconds = Number(e.target.value) || 0; save(); });
  $("token").addEventListener("change", (e) => { settings.apiToken = e.target.value.trim(); save(); });
  $("movie").addEventListener("change", (e) => {
    const first = Object.values(promptSets).find((s) => movieOf(s) === e.target.value);
    if (first) { settings.activeSetId = first.id; save(); render(); }
  });
  $("theme").addEventListener("change", (e) => { settings.activeSetId = e.target.value; save(); render(); });
  $("grab").addEventListener("click", grabTime);
  $("import").addEventListener("click", importFile);
  $("file").addEventListener("change", onFile);
  $("export").addEventListener("click", exportSet);
  $("fetch").addEventListener("click", () => importUrl($("url").value));
  $("refresh").addEventListener("click", refreshActive);
});
