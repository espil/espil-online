
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
    var done=false,continued=false,earthReady=false,typedDone=false,idx=0;
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
        setTimeout(contFn,900);
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
    /* City switch reload (2026-10-16): after the reload startCityEntry
       requests, re-select the pending city and click through its
       ENTER button so the switch lands back at the entry sequence. */
    (function(){
      var name=null;
      try{ name=sessionStorage.getItem('espil_pending_city'); if(name)sessionStorage.removeItem('espil_pending_city'); }catch(e){}
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
      /* #6 (Han 2nd QA): Path routing. /vancouver skips landing → direct map entry.
         /vancouver/store/{placeId} → map + center on store + open panel (#17). */
      var pathMatch=null,storePlaceId=null;
      try{
        var pth=window.location.pathname;
        if(pth==='/vancouver'||pth==='/vancouver/'){
          pathMatch='vancouver';
        }else{
          var sm=pth.match(/^\/vancouver\/store\/([A-Za-z0-9_-]+)/);
          if(sm){pathMatch='vancouver';storePlaceId=sm[1];}
        }
      }catch(e){}
      if(pathMatch==='vancouver'){
        /* Direct city entry: hide landing, auto-select Vancouver */
        window.__directCityEntry={city:'Vancouver',storePlaceId:storePlaceId};
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
            var pending=null;
            try{pending=sessionStorage.getItem('espil_pending_city');}catch(e){}
            var ee=document.getElementById('city-entry');
            if(ee&&ee.getAttribute('aria-hidden')==='false')return; /* entry already started */
            if(!pending&&window.__espilSelectCityByName&&window.__espilSelectCityByName('Vancouver')){
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
      /* Don't let the typing play out in a hidden tab: wait until the page is visible. */
      if(document.hidden){
        var __visStart=function(){
          if(!document.hidden){document.removeEventListener('visibilitychange',__visStart);startTyping();}
        };
        document.addEventListener('visibilitychange',__visStart);
      }else startTyping();
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
  