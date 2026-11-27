/* __espilUiTheme v1
   Espil Online UI redesign - phase 1: design tokens + common components.
   Source: ui-room/redesign/REDESIGN-DESIGN.md (tokens section 4 as revised
   by the 2026-11-23 bright-palette ruling, button standard section 9,
   Curved Sidebar shell grammar section 11).
   Injects ONE style element (id "espil-ui-theme"); idempotent.
   Classes are additive: existing surfaces opt in by adding classes.
   Nothing here restyles existing selectors. */
(function () {
  'use strict';
  if (document.getElementById('espil-ui-theme')) return;
  var css = [
    ':root{',
    '  --espil-wood-dark:#5a3a1a; --espil-wood-mid:#9a6a34; --espil-wood-light:#c98f4e;',
    '  --espil-sign:#e8b06a; --espil-cream:#fff8e7; --espil-parch:#ffedcb;',
    '  --espil-ink:#5a4020; --espil-action:#ffc61a; --espil-confirm:#69c24a;',
    '  --espil-sky:#57b7e8; --espil-danger:#f0563a;',
    '  --espil-grade-common:#b8a888; --espil-grade-fine:#7ac74f; --espil-grade-rare:#4aa3ff;',
    '  --espil-grade-epic:#b06ee8; --espil-grade-legend:#ffb02e;',
    '  --espil-glass-bg:rgba(24,16,44,.72); --espil-glass-line:rgba(176,110,232,.55);',
    '  --espil-glass-glow:0 0 14px rgba(140,80,255,.35);',
    '  --espil-title-font:"Jua","Gmarket Sans Bold","Gmarket Sans",sans-serif;',
    '  --espil-radius:14px;',
    '}',
    /* ---- buttons (standard: pressable at a glance, one strong primary,
       48px touch floor, immediate pressed feedback) ---- */
    '.espil-btn{ display:inline-flex; align-items:center; justify-content:center; gap:6px;',
    '  min-height:40px; padding:8px 18px; border-radius:12px; cursor:pointer;',
    '  border:3px solid var(--espil-wood-dark); background:var(--espil-parch); color:var(--espil-ink);',
    '  font-weight:800; font-size:14px; line-height:1.15; user-select:none; -webkit-user-select:none;',
    '  box-shadow:0 3px 0 var(--espil-wood-dark), 0 5px 10px rgba(0,0,0,.25);',
    '  transition:transform .06s ease, box-shadow .06s ease, filter .12s ease; }',
    '.espil-btn:hover{ filter:brightness(1.05); }',
    '.espil-btn:active{ transform:translateY(2px); box-shadow:0 1px 0 var(--espil-wood-dark), 0 2px 5px rgba(0,0,0,.25); }',
    '.espil-btn:focus-visible{ outline:3px solid var(--espil-sky); outline-offset:2px; }',
    '.espil-btn[disabled]{ opacity:.45; pointer-events:none; }',
    '.espil-btn-touch{ min-height:48px; min-width:48px; }',
    '.espil-btn-primary{ background:linear-gradient(180deg,#ffd94d,var(--espil-action)); color:#5a3a00; }',
    '.espil-btn-confirm{ background:linear-gradient(180deg,#8fdd6d,var(--espil-confirm)); color:#1e4d12; }',
    '.espil-btn-danger{ background:linear-gradient(180deg,#ff8a70,var(--espil-danger)); color:#5c1408; }',
    '.espil-btn-ghost{ background:rgba(255,248,231,.35); box-shadow:0 2px 0 var(--espil-wood-dark); }',
    /* ---- panels: wood frame, cream face, hanging sign title ---- */
    '.espil-panel{ background:var(--espil-cream); border:4px solid var(--espil-wood-mid);',
    '  border-radius:var(--espil-radius); box-shadow:0 0 0 2px var(--espil-wood-dark), 0 14px 34px rgba(0,0,0,.45);',
    '  color:var(--espil-ink); }',
    '.espil-panel-sign{ display:inline-block; background:linear-gradient(180deg,#f2c078,var(--espil-sign));',
    '  border:3px solid var(--espil-wood-dark); border-radius:10px; padding:5px 18px;',
    '  font-family:var(--espil-title-font); font-size:19px; letter-spacing:.4px; color:#4a2c08;',
    '  box-shadow:0 3px 0 var(--espil-wood-dark); }',
    '.espil-close{ width:34px; height:34px; border-radius:50%; border:3px solid #1d4e79;',
    '  background:radial-gradient(circle at 35% 30%, #8fd0ff, var(--espil-sky) 65%, #2f7fc4);',
    '  color:#fff; font-weight:900; font-size:15px; cursor:pointer; line-height:1;',
    '  display:inline-flex; align-items:center; justify-content:center;',
    '  box-shadow:0 2px 0 #1d4e79, 0 4px 8px rgba(0,0,0,.3); }',
    '.espil-close:active{ transform:translateY(2px); box-shadow:0 0 0 #1d4e79; }',
    /* ---- left tab rail (icon tabs, red-dot badge) ---- */
    '.espil-rail-tabs{ display:flex; flex-direction:column; gap:8px; }',
    '.espil-tab{ position:relative; width:52px; height:52px; border-radius:12px; cursor:pointer;',
    '  border:3px solid var(--espil-wood-dark); background:var(--espil-parch); color:var(--espil-ink);',
    '  display:flex; align-items:center; justify-content:center; font-weight:800;',
    '  box-shadow:0 2px 0 var(--espil-wood-dark); }',
    '.espil-tab.active{ background:linear-gradient(180deg,#ffd94d,var(--espil-action)); }',
    '.espil-tab .espil-dot{ position:absolute; top:-5px; right:-5px; width:13px; height:13px;',
    '  border-radius:50%; background:var(--espil-danger); border:2px solid #fff; }',
    /* ---- slots: rounded square, pastel face, grade border, count badge ---- */
    '.espil-slot{ position:relative; width:48px; height:48px; border-radius:10px;',
    '  border:3px solid var(--espil-grade-common); background:#fdf3da;',
    '  display:flex; align-items:center; justify-content:center; overflow:visible; }',
    '.espil-slot.grade-fine{ border-color:var(--espil-grade-fine); }',
    '.espil-slot.grade-rare{ border-color:var(--espil-grade-rare); }',
    '.espil-slot.grade-epic{ border-color:var(--espil-grade-epic); }',
    '.espil-slot.grade-legend{ border-color:var(--espil-grade-legend); }',
    '.espil-slot .espil-count{ position:absolute; right:-4px; bottom:-4px; min-width:19px; height:19px;',
    '  padding:0 4px; border-radius:9px; background:var(--espil-wood-dark); color:#ffe9b0;',
    '  font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; }',
    /* ---- currency pill ---- */
    '.espil-pill{ display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 14px;',
    '  border-radius:15px; border:2.5px solid var(--espil-wood-dark);',
    '  background:linear-gradient(180deg,#fff3cf,var(--espil-parch)); color:var(--espil-ink);',
    '  font-weight:800; font-size:13px; box-shadow:0 2px 0 var(--espil-wood-dark); }',
    /* ---- shell layer: Curved Sidebar glass (navigation chrome only) ---- */
    '.espil-glass{ background:var(--espil-glass-bg); border:1.5px solid var(--espil-glass-line);',
    '  border-radius:18px; box-shadow:var(--espil-glass-glow), 0 12px 30px rgba(0,0,0,.45);',
    '  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); color:#efe9ff; }',
    '.espil-rail{ width:64px; padding:10px 0; display:flex; flex-direction:column; align-items:center; gap:10px;',
    '  transition:width .22s ease; overflow:hidden; }',
    '.espil-rail.expanded{ width:248px; align-items:stretch; padding:10px 12px; }',
    '.espil-rail-item{ display:flex; align-items:center; gap:10px; min-height:48px; padding:0 10px;',
    '  border-radius:12px; color:#efe9ff; cursor:pointer; border:1.5px solid transparent; white-space:nowrap; }',
    '.espil-rail-item:hover, .espil-rail-item.active{ border-color:var(--espil-glass-line);',
    '  background:linear-gradient(90deg, rgba(140,80,255,.28), rgba(140,80,255,.05)); }'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'espil-ui-theme';
  st.textContent = css;
  document.head.appendChild(st);
  window.__espilUiTheme = { version: 1 };
})();
