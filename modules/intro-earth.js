
  /* ESPIL Online intro = the Earth loading sequence (Han 2026-10-28): starfield
     canvas, ESPIL ONLINE typed letter-by-letter over its black shadow while the
     globe loads behind it. When typing completes and Earth is ready, the scene
     advances on its own - no key press, no tap, no prompt: the logo zooms
     through, the camera pulls back to Earth, BGM starts. */
  (function(){
    "use strict";
    var intro=document.getElementById('intro');
    var logo=document.getElementById('intro-logo');
    var typed=document.getElementById('intro-typed');
    var cont=document.getElementById('intro-continue');
    var canvas=document.getElementById('intro-stars');
    var WORD_A='Espil',WORD_B=' Online'; /* "Espil" …breathe… "Online" (2026-10-06 QA #1) */
    var WORD=WORD_A+WORD_B;
    var BREATHE_MS=850; /* the beat between the two words */
    var TYPE_MIN=50,TYPE_JITTER=50; /* 50-100ms per char: brisk, natural keystroke rhythm */
    var CARET_LINGER=800; /* caret keeps blinking briefly after typing, then the continue prompt */
    var done=false,continued=false,earthReady=false,typedDone=false,idx=0,holdDirect=false;
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.__espilIntroActive=true;
    /* Starfield */
    var stars=[],ctx=null,W=0,H=0,lastT=0;
    function sizeStars(){
      if(!canvas)return;
      var dpr=Math.min(2,window.devicePixelRatio||1);
      W=canvas.clientWidth;H=canvas.clientHeight;
      canvas.width=W*dpr;canvas.height=H*dpr;
      ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    function initStars(){
      stars=[];
      var n=Math.min(260,Math.floor(W*H/4500)),i;
      for(i=0;i<n;i++)stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.3+.3,p:Math.random()*6.28,s:.4+Math.random()*1.2});
    }
    function drawStars(t){
      if(!ctx)return;
      ctx.clearRect(0,0,W,H);
      var dt=Math.min(.05,(t-lastT)/1000||0);lastT=t;
      for(var i=0;i<stars.length;i++){
        var s=stars[i];
        s.y+=s.s*4*dt;if(s.y>H+2){s.y=-2;s.x=Math.random()*W;}
        ctx.globalAlpha=.55+.45*Math.sin(t*.0012+s.p);
        ctx.fillStyle='#cfefff';
        ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,6.283);ctx.fill();
      }
      ctx.globalAlpha=1;
      if(!continued)requestAnimationFrame(drawStars);
    }
    /* Typewriter over the black shadow */
    var spans=[],caret=null;
    function buildTyped(){
      if(!typed)return;
      typed.innerHTML='';spans=[];
      for(var i=0;i<WORD.length;i++){
        /* Two-row sign (2026-10-06, per Han): the space between the words
           becomes a line break — "Espil" over "Online". */
        if(WORD[i]===' '){
          var br=document.createElement('br');
          typed.appendChild(br);spans.push(br);
          continue;
        }
        var sp=document.createElement('span');
        sp.className='ch';
        sp.style.setProperty('--d',(i*0.05+Math.random()*0.10).toFixed(3)+'s');
        sp.textContent=WORD[i];
        typed.appendChild(sp);spans.push(sp);
      }
      caret=document.createElement('span');
      caret.className='caret';
      typed.appendChild(caret);
      /* The caret must start at the E and follow the typing: invisible chars
         still occupy layout, so parking it at the end put it on the far right. */
      typed.insertBefore(caret,spans[0]||null);
    }
    function maybeShowContinue(){
      /* The typewriter IS the Earth loading sequence (Han 2026-10-28):
         it plays while the globe loads behind it, and once typing and
         Earth are both ready the scene moves on by itself - the player
         never has to press anything. A short beat lets the finished
         neon sign land before the zoom-through. */
      if(typedDone&&earthReady&&!done){
        done=true;
        if(logo)logo.classList.add('done');
        /* A-plan HOLD (see landDirect): the advance lands directly
           on the doors - no 900 ms beat, no slide-up, no camera
           descent - because the video's own final frame already
           IS the doors composition. */
        if(holdDirect)landDirect();
        else setTimeout(contFn,900);
      }
    }
    function typeStep(){
      if(idx>=spans.length){
        typedDone=true;
        /* The caret keeps blinking (2026-10-06, per Han); the continue prompt
           appears shortly after typing completes. */
        setTimeout(function(){
          maybeShowContinue();
        },CARET_LINGER);
        return;
      }
      var el=spans[idx];
      /* The line-break between the words is always "on" — step past it and
         park the caret at the start of the second row. */
      if(el.tagName==='BR'){
        typed.insertBefore(caret,spans[idx+1]||null);
        idx++;
        setTimeout(typeStep,60);
        return;
      }
      el.classList.add('on');
      typed.insertBefore(caret,spans[idx+1]||null);
      idx++;
      var delay=TYPE_MIN+Math.random()*TYPE_JITTER;
      if(idx===WORD_A.length)delay=BREATHE_MS; /* "Espil" lands, a beat, then "Online" */
      setTimeout(typeStep,delay);
    }
    function beginEarth(){
      var G=window.__espilGlobe;
      if(G&&G.beginEarthReveal)G.beginEarthReveal();
      if(window.EspilAudio&&window.EspilAudio.onReturnToOrbit)window.EspilAudio.onReturnToOrbit();
    }
    function contFn(){
      if(continued||!done||!intro)return;continued=true;
      window.__espilIntroActive=false;
      if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
      /* Slide-up (2026-10-06, per Han): the sign slides up and stays visible
         while the camera descends — Earth rises from the bottom. No fade-out. */
      beginEarth();
      intro.classList.add('leaving');
      setTimeout(function(){if(intro.parentNode)intro.parentNode.removeChild(intro);},2600);
    }
    /* A-plan direct landing (Han 2026-11-26, A-plan chosen by the
       asset room): when the intro video's dismissal facts say its
       baked-in typewriter already ran to completion (HOLD), the
       video's last beat has already transitioned its kiosk screen
       from the sign composition to the landing's DOORS composition
       and ends on that exact frame. The page therefore lands
       DIRECTLY on the doors: contFn's end state (the intro overlay
       gone, __espilIntroActive false, the audio pop and the
       return-to-orbit BGM) reached in one synchronous step, with
       the two pieces of theatre left out - the 'leaving' slide-up
       (the sign must never present, not even sliding away) and
       beginEarthReveal's camera descent. The camera needs no move
       at all: the globe script's boot framing IS the settled
       framing (its resize() snaps the orbit and target distances
       to the default and the targets rest at the facing pitch and
       yaw), and beginEarthReveal would only park it at 1.6x and
       ease it back - the replayed zoom the A-plan removes.
       Entry-flow's own boot poll presents the doors once #intro
       is gone and the intro flag is false, and the globe's city
       pins unhide on the same flag - the same machinery the
       natural advance reaches, minus the theatre. While the Earth
       is still loading, maybeShowContinue's law governs exactly
       as on the typing path: the landing waits for
       espil-earth-ready (or its 45 s bound) with the intro
       overlay up and the sign unlit. */
    function landDirect(){
      if(continued||!done||!intro)return;continued=true;
      window.__espilIntroActive=false;
      if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
      if(window.EspilAudio&&window.EspilAudio.onReturnToOrbit)window.EspilAudio.onReturnToOrbit();
      if(intro.parentNode)intro.parentNode.removeChild(intro);
    }
    /* City switch reload (2026-10-16): after the reload startCityEntry
       requests, re-select the pending city and click through its
       ENTER button so the switch lands back at the entry sequence. */
    (function(){
      var name=null;
      try{ name=sessionStorage.getItem('espil_pending_city'); if(name)sessionStorage.removeItem('espil_pending_city'); }catch(e){}
      if(name)window.__espilHandoffCity=name; /* LANDING PACKAGE item 3: the direct-entry attempt below defers to a pending switch through this - its sessionStorage read alone always came back empty, the key already consumed here */
      if(!name)return;
      var tries=0;
      (function poll(){
        /* Budgets are generous on purpose: on a slow device or
           connection the landing can take minutes to build the
           markers, and a switch that expires silently strands the
           player on the wrong city (found in VM QA, 2026-10-16).
           The polls stop by themselves once entry begins.
           Selection goes through window.__espilSelectCityByName:
           markers/selectCity live in the globe script's IIFE and
           are NOT visible from this script (the original direct
           references were undefined forever - the switch never
           fired on any machine). */
        if(++tries>2400)return;
        if(window.__espilCityKey)return; // an entry already began (manual or ours); stop.
        if(!window.__espilSelectCityByName||!window.__espilSelectCityByName(name)){ setTimeout(poll,250); return; }
        window.__espilHandoffEntry=true; /* startCityEntry takes the fast path: no landing theatre, the gate opens at once */
        var et=0;
        (function clickEnter(){
          if(++et>2400)return;
          var info=document.getElementById('city-info'),btn=document.getElementById('city-info-enter');
          if(info&&btn&&(getComputedStyle(info).display!=='none'||document.documentElement.classList.contains('espil-handoff'))&&!btn.disabled){ btn.click(); return; }
          setTimeout(clickEnter,250);
        })();
      })();
    })();
    function boot(){
      if(!intro)return;
      /* #6 (Han 2nd QA): Path routing. A playable city path (/vancouver,
         /Paris, /NewYork, ...) skips landing → direct map entry for that city.
         /vancouver/store/{placeId} → map + center on store + open panel (#17). */
      var pathMatch=null,pathCity=null,storePlaceId=null;
      try{
        var pth=window.location.pathname;
        var sm=pth.match(/^\/vancouver\/store\/([A-Za-z0-9_-]+)/);
        if(sm){pathMatch='vancouver';pathCity='Vancouver';storePlaceId=sm[1];}
        else{
          /* LANDING PACKAGE (Han 2026-11-25, item 3): the first path
             segment, lowercased with punctuation stripped, names the
             city. '/vancouver.html' (the pair file's own name) matches
             nothing, exactly as before - the pending-city handoff
             drives that arrival. A bundle-less segment (e.g. /Seoul)
             matches nothing either: that path serves the landing,
             whose flow preselects the city (entry-flow). */
          var CITY_PATHS={vancouver:'Vancouver',auckland:'Auckland',tokyo:'Tokyo',newyork:'New York',paris:'Paris',london:'London'};
          var seg=(pth.split('/')[1]||'').toLowerCase().replace(/[^a-z0-9]/g,'');
          if(CITY_PATHS[seg]){pathMatch=seg;pathCity=CITY_PATHS[seg];}
        }
      }catch(e){}
      if(pathMatch){
        /* Direct city entry: hide landing, auto-select the path's city */
        window.__directCityEntry={city:pathCity,storePlaceId:storePlaceId};
        /* Skip intro — go straight to map flow */
        if(document.body)document.body.classList.add('direct-entry');
        /* Auto-trigger after markers are ready. The original was a
           single 2.5 s shot: on a slow device or connection the
           markers are not built yet by then and the entry never
           happens at all (found in VM QA, 2026-10-16). Poll until
           ready instead, up to ~60 s. */
        (function directEntryAttempt(n){
          try{
            /* A pending city switch (Auckland phase 1) owns the
               selection on this load - do not fight it. The hook
               consumes the flag, so polling simply resumes after. */
            var pending=window.__espilHandoffCity||null;
            try{ if(!pending)pending=sessionStorage.getItem('espil_pending_city'); }catch(e){}
            var ee=document.getElementById('city-entry');
            if(ee&&ee.getAttribute('aria-hidden')==='false')return; /* entry already started */
            if(!pending&&window.__espilSelectCityByName&&window.__espilSelectCityByName(pathCity)){
              /* Auto-click ENTER CITY after info panel shows */
              setTimeout(function(){
                var btn=document.getElementById('city-info-enter');
                if(btn&&!btn.classList.contains('is-disabled'))btn.click();
              },800);
              return;
            }
          }catch(e){console.warn('Direct entry failed:',e);}
          if(n<600)setTimeout(function(){directEntryAttempt(n+1);},500);
        })(0);
      }
      sizeStars();initStars();
      requestAnimationFrame(drawStars);
      window.addEventListener('resize',function(){sizeStars();initStars();});
      buildTyped();
      /* The typewriter always plays, even when the OS requests reduced motion:
         this is the signature brand moment and it's gentle (no large-scale motion). */
      function startTyping(){
        setTimeout(typeStep,600);
      }
      /* Directive 0 hold (Han 2026-11-26): the typewriter IS the loading
         sequence, but the 10 s intro video plays full-screen over this
         overlay and the typing used to run out behind it (~4-5 s) -
         invisible to anyone who did not skip the video. The typing now
         starts only once the intro video has dismissed (it dismisses on
         end / skip / error / stall - fail-open on every path), so the
         order a viewer actually sees is: the video (plaza -> the kiosk's
         Earth -> the real Earth) -> the landing globe -> the typewriter
         over the Earth reveal. The wait consumes only intro-video's
         published state surface plus the root element's presence (the
         inline fail-open in index.html removes the root at 9 s if that
         module never loads). If there is no video - or it already
         dismissed - typing starts at once, exactly as before. The
         wait is bounded by signs of life, not by the video alone:
         15 s with no dismissal surface at all, or 15 s without the
         playhead advancing, starts the typing anyway - so a lost or
         wedged signal can never suppress the typewriter, while a
         video that is genuinely still playing is never undercut.
         Nothing else moves: the text, the
         typing speed and the Earth reveal are untouched, and no entry
         step waits on this - only the typer's start moves. */
      /* Typewriter handoff (Han 2026-11-26, reading (i), beat map
         FINAL from the asset room the same day for v6; A-plan
         chosen by the asset room the same day): the NEW intro
         video carries the typewriter inside itself, on the Earth
         inside the kiosk screen - typing starts at 4.75 s and
         completes at 6.00 s; the kiosk screen then shows the
         landing's first frame and from 8.00 s the screen content
         fills the whole frame, transitioning from the sign
         composition to the DOORS composition (globe, city pins,
         the ENTER panel) and ending on the page's settled doors
         frame exactly. The page typer must never re-type what
         the video already typed - and under the A-plan the page
         must not present the sign at all on that path: the video
         ended on the doors, so a completed sign appearing now
         (then sliding away while the camera descends) would step
         the scene BACKWARD before the doors. When the dismissal
         facts say the video's typing ran to completion (HOLD),
         the page therefore lands directly on the doors
         (completeHandoff + landDirect, via holdDirect in
         maybeShowContinue); every other path keeps the shipped
         typing exactly (TYPE). The threshold is the video's
         typing-completion time; if the media's beat map ever
         moves, this one constant is where it is re-tied. */
      var ESPIL_VIDEO_TYPE_DONE_S=6.00;
      function completeHandoff(){
        /* HOLD's terminal step: typedDone is set WITHOUT lighting
           a single character - the sign never presents on this
           path, not even while the landing waits for the Earth
           (maybeShowContinue's law still gates the advance on
           espil-earth-ready, exactly as for a finished typing
           run, and the overlay stays up unlit in the meantime).
           When the advance fires, landDirect removes the overlay
           in the same task, so no frame of the sign can paint;
           the end state - #intro removed, the intro flag false,
           the doors presented by entry-flow's own poll - is the
           natural advance's own, reached without its theatre. */
        typedDone=true;
        maybeShowContinue();
      }
      function handoffMode(){
        var st=null;
        try{ st=(window.__espilIntroVideo&&window.__espilIntroVideo.state())||null; }catch(e){}
        if(!st||!st.dismissed)return 'type';
        if(st.dismissReason==='ended')return 'hold';
        if(st.dismissReason==='error'||st.dismissReason==='stall'||st.dismissReason==='novideo')return 'type';
        if(typeof st.dismissT==='number'&&st.dismissT>=ESPIL_VIDEO_TYPE_DONE_S)return 'hold';
        return 'type';
      }
      var typingStarted=false;
      function beginTyping(mode){
        if(typingStarted)return;typingStarted=true;
        var apply=function(){ if(mode==='hold'){ holdDirect=true; completeHandoff(); } else startTyping(); };
        /* Don't let the typing play out in a hidden tab: wait until the page is visible. */
        if(document.hidden){
          var __visStart=function(){
            if(!document.hidden){document.removeEventListener('visibilitychange',__visStart);apply();}
          };
          document.addEventListener('visibilitychange',__visStart);
        }else apply();
      }
      function introVideoGone(){
        if(!document.getElementById('espil-intro-video'))return true;
        try{
          var st=window.__espilIntroVideo&&window.__espilIntroVideo.state();
          return !!(st&&st.dismissed);
        }catch(e){return false;}
      }
      if(introVideoGone())beginTyping(handoffMode());
      else{
        var videoWaitStart=Date.now();
        var lastVidT=-1,lastAdvance=Date.now();
        var videoPoll=setInterval(function(){
          var st=null;
          try{st=(window.__espilIntroVideo&&window.__espilIntroVideo.state())||null;}catch(e){}
          var now=Date.now();
          if(st&&typeof st.t==='number'&&st.t!==lastVidT){lastVidT=st.t;lastAdvance=now;}
          if(introVideoGone()||(!st&&now-videoWaitStart>=15000)||(st&&now-lastAdvance>=15000)){
            clearInterval(videoPoll);
            beginTyping(handoffMode());
          }
        },200);
      }
      if(window.__espilEarthReady){earthReady=true;maybeShowContinue();}
      else window.addEventListener('espil-earth-ready',function(){earthReady=true;maybeShowContinue();});
      setTimeout(function(){earthReady=true;maybeShowContinue();},45000);
      intro.addEventListener('click',contFn);
      intro.addEventListener('touchend',function(e){e.preventDefault();contFn();},{passive:false});
      intro.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' ')e.preventDefault();contFn();});
      document.addEventListener('keydown',function(){contFn();});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
    else boot();
  }());
  