/* FixTwin demo-page reading tracker (25 Nov 2026).
   Cookieless and stores nothing on the visitor's device. Sends anonymous events to PostHog:
   demo_open, demo_engaged, demo_scroll (25/50/75/90/100), demo_section (each h2 that comes into view),
   demo_click, demo_leave (active reading seconds, total seconds, max scroll).
   Each demo page belongs to one business, so counts per page = what that lead did.
   ?ft=internal marks this browser as ours (never tracked again); ?ft=debug logs events to the console instead of sending. */
(function () {
  var CFG = { key: "phc_tv7yMboPrSBEtKKURwGRVkB8n2Lk9FwHzLpskuzVmkJB", host: "https://us.i.posthog.com" }; // public project key (PostHog project 767863)
  var q = location.search, debug = /[?&]ft=debug\b/.test(q), test = /[?&]ft=test\b/.test(q);
  try {
    if (/[?&]ft=internal\b/.test(q)) localStorage.setItem("ft_internal", "1");
    if (!debug && localStorage.getItem("ft_internal") === "1") return;
  } catch (e) {}
  if (!debug && (!CFG.key || navigator.webdriver)) return;

  var page = location.pathname.replace(/index\.html$/, "");
  var openId = "o" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  var t0 = Date.now(), active = 0, lastAct = Date.now(), maxScroll = 0, marks = {}, engaged = false;
  var ref = ""; try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) {}

  function send(event, props) {
    var p = { page: page, open_id: openId, $current_url: location.origin + page, $process_person_profile: false };
    if (test) p.test = true; // ?ft=test: a real send that the stats script leaves out
    for (var k in props || {}) p[k] = props[k];
    var body = JSON.stringify({ api_key: CFG.key, event: event, distinct_id: openId, properties: p, timestamp: new Date().toISOString() });
    if (debug) { console.log("[ft]", event, p); return; }
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon(CFG.host + "/i/v0/e/", new Blob([body], { type: "text/plain" }))))
        fetch(CFG.host + "/i/v0/e/", { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } });
    } catch (e) {}
  }

  function scrollPct() {
    var h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) || 1;
    return Math.min(100, Math.round((window.scrollY + window.innerHeight) / h * 100));
  }
  function onScroll() {
    lastAct = Date.now();
    var s = scrollPct(); if (s > maxScroll) maxScroll = s;
    [25, 50, 75, 90, 100].forEach(function (m) { if (maxScroll >= m && !marks[m]) { marks[m] = 1; send("demo_scroll", { depth: m }); } });
    checkEngaged();
  }
  function checkEngaged() {
    if (!engaged && (active >= 8 || maxScroll >= 50)) { engaged = true; send("demo_engaged", { active_seconds: active, max_scroll: maxScroll }); }
  }
  // active reading time: page visible and someone moved, scrolled, tapped or typed in the last 30 seconds
  setInterval(function () {
    if (!document.hidden && Date.now() - lastAct < 30000) { active++; checkEngaged(); }
  }, 1000);
  ["mousemove", "touchstart", "keydown", "wheel"].forEach(function (ev) {
    window.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true });
  });
  window.addEventListener("scroll", onScroll, { passive: true });

  if ("IntersectionObserver" in window) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var t = (e.target.textContent || "").trim().slice(0, 80);
        if (e.isIntersecting && !seen[t]) { seen[t] = 1; send("demo_section", { section: t }); }
      });
    }, { threshold: 0.25 });
    document.querySelectorAll("h2").forEach(function (h) { io.observe(h); });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a,button");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    send("demo_click", { text: (a.textContent || "").trim().slice(0, 60), link: href.split("?")[0].slice(0, 120) });
  }, true);

  var lastLeave = 0;
  function leave() {
    if (Date.now() - lastLeave < 2000) return;
    lastLeave = Date.now();
    send("demo_leave", { active_seconds: active, total_seconds: Math.round((Date.now() - t0) / 1000), max_scroll: maxScroll });
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) leave(); });
  window.addEventListener("pagehide", leave);

  maxScroll = scrollPct();
  send("demo_open", {
    referrer: ref, mobile: /Mobi|Android|iPhone/i.test(navigator.userAgent),
    viewport: window.innerWidth + "x" + window.innerHeight, first_screen: maxScroll
  });
})();
