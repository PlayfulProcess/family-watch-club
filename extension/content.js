// Movie Companion — content script
// Watches the largest playing <video> on the page, pauses at configured
// timestamps, and shows a discussion prompt overlay.
// Works on Disney+, Netflix, YouTube, and most sites with an HTML5 player.

(() => {
  "use strict";

  const POLL_MS = 300;
  const FIRE_WINDOW = 2.0; // seconds past the target within which a point fires

  let settings = {
    enabled: true,
    allCaps: true,
    offsetSeconds: 0,
    activeSetId: "moana"
  };
  let promptSets = {}; // id -> set
  let fired = new Set(); // indices fired this viewing
  let lastTime = -1;
  let overlayEl = null;
  let pollTimer = null;

  // ---------- storage ----------

  function loadState() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["settings", "promptSets"], (data) => {
          if (data && data.settings) settings = Object.assign(settings, data.settings);
          if (data && data.promptSets) promptSets = data.promptSets;
          resolve();
        });
      } catch (e) {
        resolve(); // storage unavailable (rare); run with defaults
      }
    });
  }

  // Seed bundled prompt sets, and upgrade stored copies when the bundled
  // set has a newer "version" (so extension updates reach existing installs).
  async function seedIfEmpty() {
    let changed = false;
    for (const path of [
      "prompts/moana.json", "prompts/moana-legends.json", "prompts/moana-repair.json",
      "prompts/frozen-discussion.json", "prompts/frozen-repair.json",
      "prompts/kpop-demon-hunters-discussion.json", "prompts/kpop-demon-hunters-repair.json"
    ]) {
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
    if (changed) {
      try { chrome.storage.local.set({ promptSets }); } catch (e) {}
    }
  }

  // Let the popup ask for the current movie time, or grab a frame as a still image
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === "mc-get-time") {
        const v = findVideo();
        sendResponse(v ? { time: v.currentTime } : {});
        return false;
      }
      if (msg && msg.type === "mc-grab-frame") {
        const v = findVideo();
        if (!v) { sendResponse({}); return false; }
        try {
          const canvas = document.createElement("canvas");
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
          sendResponse({ time: v.currentTime, dataUrl: canvas.toDataURL("image/png") });
        } catch (e) {
          // Cross-origin/DRM-protected video taints the canvas — can't read pixels.
          sendResponse({ time: v.currentTime, error: "This video can't be captured (protected content)." });
        }
        return false;
      }
      return false;
    });
  } catch (e) { /* ignore */ }

  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.settings) settings = Object.assign(settings, changes.settings.newValue || {});
      if (changes.promptSets) promptSets = changes.promptSets.newValue || {};
      if (!settings.enabled) removeOverlay();
      applyCapsClass();
    });
  } catch (e) { /* ignore */ }

  // ---------- helpers ----------

  function activeSet() {
    return promptSets[settings.activeSetId] || null;
  }

  // Accepts 3520 (seconds), "58:40", or "1:23:05"
  function toSeconds(t) {
    if (typeof t === "number") return t;
    const parts = String(t).split(":").map(Number);
    if (parts.some(isNaN)) return NaN;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }

  function findVideo() {
    let best = null, bestArea = 0;
    document.querySelectorAll("video").forEach((v) => {
      const r = v.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea && v.readyState >= 1) { best = v; bestArea = area; }
    });
    return best;
  }

  // ---------- overlay ----------

  function applyCapsClass() {
    if (overlayEl) overlayEl.classList.toggle("mc-caps", !!settings.allCaps);
  }

  function removeOverlay() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  function showOverlay(video, point, index) {
    removeOverlay();
    const set = activeSet();

    const root = document.createElement("div");
    root.id = "mc-overlay";
    if (settings.allCaps) root.classList.add("mc-caps");

    const card = document.createElement("div");
    card.className = "mc-card";

    const badge = document.createElement("div");
    badge.className = "mc-badge";
    badge.textContent = (set && set.title ? set.title : "Movie Companion") + " · " + fmt(toSeconds(point.time));
    card.appendChild(badge);

    if (point.title) {
      const h = document.createElement("div");
      h.className = "mc-title";
      h.textContent = point.title;
      card.appendChild(h);
    }

    if (point.story) {
      const story = document.createElement("div");
      story.className = "mc-story";
      point.story.split("\n").forEach((para) => {
        if (!para.trim()) return;
        const p = document.createElement("p");
        p.textContent = para;
        story.appendChild(p);
      });
      card.appendChild(story);
    }

    const kid = document.createElement("div");
    kid.className = "mc-kid";
    kid.textContent = point.kid || point.prompt || "";
    card.appendChild(kid);

    if (point.quiz && Array.isArray(point.quiz.options) && point.quiz.options.length > 0) {
      const quiz = document.createElement("div");
      quiz.className = "mc-quiz";
      if (point.quiz.question) {
        const q = document.createElement("div");
        q.className = "mc-quiz-q";
        q.textContent = point.quiz.question;
        quiz.appendChild(q);
      }
      const opts = document.createElement("div");
      opts.className = "mc-quiz-opts";
      const reply = document.createElement("div");
      reply.className = "mc-quiz-reply";
      point.quiz.options.forEach((opt) => {
        const b = document.createElement("button");
        b.className = "mc-opt";
        b.textContent = opt.text;
        b.addEventListener("click", () => {
          opts.querySelectorAll(".mc-opt").forEach((x) => x.classList.remove("mc-right", "mc-almost"));
          b.classList.add(opt.right ? "mc-right" : "mc-almost");
          reply.textContent = opt.reply || (opt.right ? "YES!" : "HMM... TRY ANOTHER!");
          reply.classList.toggle("mc-reply-right", !!opt.right);
        });
        opts.appendChild(b);
      });
      quiz.appendChild(opts);
      quiz.appendChild(reply);
      card.appendChild(quiz);
    }

    if (point.parent) {
      const details = document.createElement("details");
      details.className = "mc-parent";
      const summary = document.createElement("summary");
      summary.textContent = "For the grown-up";
      const p = document.createElement("p");
      p.textContent = point.parent;
      details.appendChild(summary);
      details.appendChild(p);
      card.appendChild(details);
    }

    const row = document.createElement("div");
    row.className = "mc-row";

    const btn = document.createElement("button");
    btn.className = "mc-continue";
    btn.textContent = "KEEP WATCHING";
    btn.addEventListener("click", () => {
      fired.add(index);
      removeOverlay();
      video.play().catch(() => {});
    });
    row.appendChild(btn);

    card.appendChild(row);

    // small offset nudge controls, for syncing with ads/logos differences
    const sync = document.createElement("div");
    sync.className = "mc-sync";
    sync.append("prompt timing: ");
    [["-10s", -10], ["-2s", -2], ["+2s", 2], ["+10s", 10]].forEach(([label, delta]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.addEventListener("click", () => {
        settings.offsetSeconds = (settings.offsetSeconds || 0) + delta;
        try { chrome.storage.local.set({ settings }); } catch (e) {}
        sync.querySelector(".mc-offset-val").textContent = ` (offset ${settings.offsetSeconds}s)`;
      });
      sync.appendChild(b);
    });
    const off = document.createElement("span");
    off.className = "mc-offset-val";
    off.textContent = ` (offset ${settings.offsetSeconds || 0}s)`;
    sync.appendChild(off);
    card.appendChild(sync);

    root.appendChild(card);
    (document.fullscreenElement || document.body).appendChild(root);
    overlayEl = root;
  }

  // ---------- main loop ----------

  function tick() {
    if (!settings.enabled) return;
    const set = activeSet();
    if (!set || !Array.isArray(set.points) || set.points.length === 0) return;

    const video = findVideo();
    if (!video) return;

    const t = video.currentTime;
    if (isNaN(t)) return;

    // Rewind detection: allow points to fire again after seeking back
    if (t < lastTime - 3) {
      fired.forEach((i) => {
        const pt = set.points[i];
        if (pt && toSeconds(pt.time) + (settings.offsetSeconds || 0) > t) fired.delete(i);
      });
      removeOverlay();
    }
    lastTime = t;

    if (overlayEl) {
      // keep the movie paused while the prompt is up
      if (!video.paused) video.pause();
      return;
    }

    for (let i = 0; i < set.points.length; i++) {
      if (fired.has(i)) continue;
      const target = toSeconds(set.points[i].time) + (settings.offsetSeconds || 0);
      if (isNaN(target)) continue;
      if (t >= target && t <= target + FIRE_WINDOW) {
        video.pause();
        showOverlay(video, set.points[i], i);
        break;
      }
    }
  }

  loadState()
    .then(seedIfEmpty)
    .then(() => {
      pollTimer = setInterval(tick, POLL_MS);
    });
})();
