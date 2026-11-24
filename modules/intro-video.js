/* __espilIntroVideo v1 - start intro video (Han 2026-11-24).
   The 10 s cauldron reveal (animation series ep01, Green BGM cut)
   plays full-screen over the landing from the first paint, before
   the #intro screen. Skippable from the first frame (button + Esc);
   on end, skip, error or stall it fades out and removes itself,
   revealing the landing exactly as it was. Purely presentational:
   nothing in the entry flow waits on it, and every failure path
   dismisses it (fail-open) so it can never trap the start. */
(function () {
  var root = document.getElementById('espil-intro-video');
  if (!root) return;
  window.__espilIntroVideoBooted = true;
  if (window.__espilIntroVideoTimer) { clearTimeout(window.__espilIntroVideoTimer); window.__espilIntroVideoTimer = null; }
  var video = document.getElementById('espil-intro-video-el');
  var skip = document.getElementById('espil-intro-video-skip');
  var dismissed = false, lastT = -1, stallTicks = 0;
  function dismiss() {
    if (dismissed) return; dismissed = true;
    try { if (video) video.pause(); } catch (e) {}
    document.removeEventListener('keydown', onKey, true);
    root.classList.add('iv-hide');
    setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 500);
  }
  function onKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) dismiss(); }
  if (skip) skip.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey, true);
  if (video) {
    video.addEventListener('ended', dismiss);
    video.addEventListener('error', dismiss, true);
    var p = null;
    try { p = video.play(); } catch (e) {}
    if (p && p.catch) p.catch(function () { /* muted autoplay refused: stay as a poster with the skip live; the watchdog below still bounds it */ });
    /* Stall watchdog: if the playhead does not advance for ~4 s
       (network stall, undecodable file), let the user through. */
    var iv = setInterval(function () {
      if (dismissed) { clearInterval(iv); return; }
      var t = -1; try { t = video.currentTime; } catch (e) {}
      if (t === lastT) { stallTicks++; } else { stallTicks = 0; lastT = t; }
      if (stallTicks >= 4) { clearInterval(iv); dismiss(); }
    }, 1000);
  } else { dismiss(); }
  window.__espilIntroVideo = {
    dismiss: dismiss,
    state: function () { return { dismissed: dismissed, t: video ? video.currentTime : -1 }; }
  };
})();
