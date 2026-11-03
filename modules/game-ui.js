
/* __espilGameUI v1 - the Espil game UI template (Han's order,
   2026-10-28): the profile, inventory, stall and friend/party
   windows share ONE game-style template - the deep green game
   frame with a wood-brown rim and parchment buttons, in the exact
   values of the Zealandia client's shell (.st-card / .pill-btn),
   per Han's order that the UI match Zealandia (2026-10-30) -
   drawn in pure CSS so it loads instantly and matches the world.
   Han's layout law: NO scrolling anywhere except the inventory
   grid; every window must resolve inside a single screen, so the
   cards are flex columns capped at 94vh with compact rows. */
(function () {
  'use strict';
  if (window.__espilGameUI) return;
  window.__espilGameUI = true;
  var st = document.createElement('style');
  st.id = 'espil-game-ui';
  st.textContent =
    /* ---- the shared game frame (all .skill-tree windows) -------- */
    '.skill-tree .st-card{border:2px solid #6b4a2f;border-radius:24px;color:#e8f5e9;' +
      'background:linear-gradient(180deg,#1e3320 0%,#142414 50%,#0d1a0d 100%);' +
      'box-shadow:0 0 44px rgba(63,125,68,.25),0 24px 60px rgba(0,0,0,.5),inset 0 0 30px rgba(90,61,38,.15);' +
      'max-height:94vh;overflow:hidden;display:flex;flex-direction:column;padding:18px 20px}' +
    '.skill-tree .st-head{flex:none;padding-bottom:10px;margin-bottom:12px;border-bottom:1px solid rgba(201,168,106,.38)}' +
    '.skill-tree .st-head h2{color:#ffd97a;text-shadow:0 0 12px rgba(255,217,122,.35)}' +
    '.skill-tree .st-close{border:2px solid #6b4a2f;background:radial-gradient(circle,#2d4a2f,#1a2e1c);color:#ffd97a}' +
    '.skill-tree .st-close:hover{border-color:#ffd97a;box-shadow:0 0 12px rgba(255,217,122,.45)}' +
    '.skill-tree .st-grid{flex:1 1 auto;min-height:0;overflow:hidden}' +
    '.skill-tree .pill-btn{border:1px solid #a8854f;background:linear-gradient(180deg,#f8f3e6,#e6dabd);color:#3b2f28;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 2px 10px rgba(0,0,0,.35)}' +
    '.skill-tree .pill-btn:hover{border-color:#d3ab63;background:linear-gradient(180deg,#fffaf0,#f1e7cd)}' +
    '.skill-tree .pill-btn:hover{border-color:#ffd97a}' +
    /* ---- inventory: the ONE window allowed to scroll ------------ */
    '#inventory-panel .st-grid{overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,106,.6) transparent;padding-right:2px}' +
    /* ---- character / profile ------------------------------------ */
    '#character-panel .st-card{width:min(600px,calc(100% - 24px))}' +
    /* ---- stall: one screen, compact form + board ----------------- */
    '#stall-panel .st-card{width:min(680px,calc(100% - 24px))}' +
    '#stall-panel .st-grid{display:block}' +
    '#stall-panel .st-grid>div{margin:5px 0!important}' +
    '#stall-panel #stall-board{gap:6px!important;margin-top:4px!important}' +
    '#stall-panel #stall-board>*{min-height:52px}' +
    '#stall-panel .st-foot{margin:8px 0 0;font-size:.6rem;line-height:1.5}' +
    '#stall-panel input,#stall-panel select{padding:6px 8px!important}' +
    /* ---- friends / party ----------------------------------------- */
    '#friends-panel .st-card{width:min(560px,calc(100% - 24px))}' +
    '#friends-panel #espil-social-body{overflow:hidden;min-height:0}' +
    '#friends-panel .espil-list{overflow:hidden}' +
    '#friends-panel .espil-row{padding:5px 9px;margin:0 0 5px}' +
    '#friends-panel input{padding:7px 9px!important}' +
    /* ---- small screens -------------------------------------------- */
    '@media (max-width:640px){.skill-tree .st-card{padding:13px 14px;border-radius:14px}.skill-tree .st-grid{gap:6px}}';
  document.head.appendChild(st);
})();

