
  /* ESPIL Online landing UI: theme BGM, sign-in modal, guest flow. */
  (function(){
    "use strict";
    var audio=document.getElementById('bgm');
    var toggle=document.getElementById('bgm-toggle');
    var started=false, muted=false, userPaused=false;
    /* Track catalogue (2026-10-06 QA #2): the hover card shows the current song.
       Adding a city theme = one line here + the mp3 in assets/bgm/cities/. */
    var LANDING_THEME={title:'Green',artist:'Espil Ceil',src:'assets/Green_bgm_landing.mp3'};
    var CITY_THEMES={
      'Vancouver':{title:'Citrus Tree',artist:'Espil Ceil',src:'assets/bgm/cities/vancouver.mp3'}
    };
    var currentTheme=LANDING_THEME,pendingThemeUrl=null;
    function paintBgmCard(){
      var t=document.getElementById('bgm-card-title'),
          a=document.getElementById('bgm-card-artist'),
          s=document.getElementById('bgm-card-state');
      if(t)t.textContent=currentTheme.title;
      if(a)a.textContent=currentTheme.artist;
      if(s)s.textContent=(muted?'Muted':'Now playing')+' · loops forever';
    }
    if(audio){
      audio.volume=0.5;
      audio.loop=true; /* songs loop forever (2026-10-06 QA #2) */
      audio.addEventListener('playing',function(){pendingThemeUrl=null;});
      audio.addEventListener('error',function(){
        var cur='';
        try{cur=audio.currentSrc||audio.src||'';}catch(e){}
        if(pendingThemeUrl&&cur.slice(-pendingThemeUrl.length)===pendingThemeUrl){
          /* A city theme file is missing: fall back to the landing theme, stay unmuted. */
          pendingThemeUrl=null;
          try{audio.src=LANDING_THEME.src;audio.loop=true;}catch(e){}
          currentTheme=LANDING_THEME;paintBgmCard();
          if(started&&!muted&&!userPaused)play();
          return;
        }
        /* Theme song file not uploaded yet: show OFF instead of pretending. */
        if(audio.networkState===3||(audio.error&&audio.error.code===4)){
          muted=true; userPaused=true; paintToggle(); paintBgmCard();
        }
      });
    }
    function paintToggle(){
      if(!toggle)return;
      toggle.innerHTML='&#9834;'; /* Han 2차 QA #2: ON/OFF 텍스트 제거, 아이콘만 */
      toggle.setAttribute('aria-pressed',String(!muted));
      toggle.style.opacity=muted?.45:1;
    }
    function play(){
      if(!audio||muted||userPaused)return;
      var p=audio.play();
      if(p&&p.catch)p.catch(function(){});
    }
    /* Lighter tick for moving through choices; pop stays for enter/confirm. */
    var actx=null;
    function tick(){
      try{
        var AC=window.AudioContext||window.webkitAudioContext;
        if(!AC)return;
        if(!actx)actx=new AC();
        if(actx.state==='suspended')actx.resume();
        var t=actx.currentTime;
        var o=actx.createOscillator(),g=actx.createGain();
        o.type='triangle';
        o.frequency.setValueAtTime(880,t);
        o.frequency.exponentialRampToValueAtTime(660,t+.05);
        g.gain.setValueAtTime(.0001,t);
        g.gain.exponentialRampToValueAtTime(.16,t+.008);
        g.gain.exponentialRampToValueAtTime(.0001,t+.07);
        o.connect(g);g.connect(actx.destination);
        o.start(t);o.stop(t+.08);
      }catch(e){}
    }
    function pop(){
      try{
        var AC=window.AudioContext||window.webkitAudioContext;
        if(!AC)return;
        if(!actx)actx=new AC();
        if(actx.state==='suspended')actx.resume();
        var t=actx.currentTime;
        var o=actx.createOscillator(),g=actx.createGain();
        o.type='sine';
        o.frequency.setValueAtTime(540,t);
        o.frequency.exponentialRampToValueAtTime(150,t+.11);
        g.gain.setValueAtTime(.0001,t);
        g.gain.exponentialRampToValueAtTime(.45,t+.012);
        g.gain.exponentialRampToValueAtTime(.0001,t+.17);
        o.connect(g);g.connect(actx.destination);
        o.start(t);o.stop(t+.19);
      }catch(e){}
    }
    /* Volume fade helper (~1.2s): slow fade-out on city enter, slow fade-in on return. */
    var fadeTimer=null;
    function fadeTo(target,done){
      if(!audio)return;
      if(fadeTimer){clearInterval(fadeTimer);fadeTimer=null;}
      var step=(target-audio.volume)/20;
      if(Math.abs(step)<.004){try{audio.volume=target;}catch(e){} if(done)done(); return;}
      fadeTimer=setInterval(function(){
        var v=audio.volume+step;
        if((step>0&&v>=target)||(step<0&&v<=target))v=target;
        try{audio.volume=Math.max(0,Math.min(1,v));}catch(e){}
        if(v===target){clearInterval(fadeTimer);fadeTimer=null;if(done)done();}
      },60);
    }
    function unlock(){
      if(started)return; started=true; play();
    }
    document.addEventListener('pointerdown',unlock);
    document.addEventListener('keydown',unlock);
    document.addEventListener('touchstart',unlock,{passive:true});
    /* Switch to a city theme song (loops forever); missing files fall back to the
       landing theme via the error handler above. */
    function playTheme(theme){
      if(!audio)return;
      pendingThemeUrl=theme.src;
      fadeTo(0,function(){
        try{audio.src=theme.src;audio.loop=true;}catch(e){}
        currentTheme=theme;paintBgmCard();
        if(!started||muted||userPaused)return;
        try{audio.volume=0;}catch(e){}
        var p=audio.play(); if(p&&p.catch)p.catch(function(){});
        fadeTo(window.__espilBgmVol!=null?window.__espilBgmVol:.5);
      });
    }
    /* Per-city theme songs (walkable-map BGM). To give a new city its own theme,
       drop its mp3 in assets/bgm/cities/ and add one line here, e.g.
       tokyo:{src:'assets/bgm/cities/tokyo.mp3',title:'...'}.
       Vancouver's theme is "Citrus Tree" by Espil Ceil. */
    /* 'vancouver' (walkable-map key) aliases the landing catalogue's 'Vancouver' theme entry. */
    CITY_THEMES.vancouver={src:'assets/bgm/cities/vancouver.mp3',title:'Citrus Tree',artist:'Espil Ceil'};
    var CITY_DWELL_MS=60000, CITY_FADE_MS=4000, CITY_VOLUME=0.5;
    var cityAudio=null, cityTimer=null, cityFadeTimer=null;
    var mapCity=null, cityDwellElapsed=false, cityThemeFailed=false;
    function ensureCityAudio(){
      if(cityAudio)return cityAudio;
      var a=document.createElement('audio');
      a.loop=true; a.preload='auto';
      a.addEventListener('error',function(){ cityThemeFailed=true; });
      cityAudio=a; return a;
    }
    function cityFadeTo(target,done){
      var a=cityAudio;
      if(!a){ if(done)done(); return; }
      if(cityFadeTimer){clearInterval(cityFadeTimer);cityFadeTimer=null;}
      var steps=Math.max(1,Math.round(CITY_FADE_MS/60));
      var step=(target-a.volume)/steps;
      if(Math.abs(target-a.volume)<0.004){
        try{a.volume=target;}catch(e){}
        if(done)done(); return;
      }
      cityFadeTimer=setInterval(function(){
        var v=a.volume+step;
        if((step>0&&v>=target)||(step<0&&v<=target))v=target;
        try{a.volume=Math.max(0,Math.min(1,v));}catch(e){}
        if(v===target){clearInterval(cityFadeTimer);cityFadeTimer=null;if(done)done();}
      },60);
    }
    function startCityTheme(){
      if(muted||userPaused||!mapCity)return;
      var theme=CITY_THEMES[mapCity];
      if(!theme||!theme.src)return;
      /* The entry sequence already switched the main BGM to this city theme:
         don't layer a second copy of the same song. */
      if(currentTheme&&currentTheme.src===theme.src&&audio&&!audio.paused)return;
      var a=ensureCityAudio();
      if(a.getAttribute('src')!==theme.src){
        cityThemeFailed=false;
        a.setAttribute('src',theme.src);
        try{a.load();}catch(e){}
      }
      if(cityThemeFailed)return;
      try{a.volume=0;}catch(e){}
      var p=a.play(); if(p&&p.catch)p.catch(function(){});
      cityFadeTo(window.__espilBgmVol!=null?window.__espilBgmVol:CITY_VOLUME);
    }
    function stopCityTheme(){
      if(cityTimer){clearTimeout(cityTimer);cityTimer=null;}
      if(cityAudio&&!cityAudio.paused){
        cityFadeTo(0,function(){ try{cityAudio.pause();}catch(e){} });
      }
      cityDwellElapsed=false;
    }
    window.EspilAudio={
      onCitySelect:function(){
        if(audio&&!audio.paused)fadeTo(0,function(){try{audio.pause();}catch(e){}});
      },
      onCityEnter:function(cityName){
        var theme=CITY_THEMES[cityName];
        if(theme)playTheme(theme);
      },
      onReturnToOrbit:function(){
        if(currentTheme!==LANDING_THEME&&audio){
          try{audio.src=LANDING_THEME.src;audio.loop=true;}catch(e){}
          currentTheme=LANDING_THEME;paintBgmCard();
        }
        if(!started||muted||userPaused||!audio)return;
        try{audio.volume=0;}catch(e){}
        var p=audio.play(); if(p&&p.catch)p.catch(function(){});
        fadeTo(window.__espilBgmVol!=null?window.__espilBgmVol:.5);
      },
      /* Walkable map entered: after CITY_DWELL_MS in the map, fade the city's
         theme in and loop it. Exiting the map cancels the timer/stops the song. */
      onMapEnter:function(cityId){
        stopCityTheme();
        mapCity=cityId||null;
        if(!mapCity||!CITY_THEMES[mapCity])return;
        cityTimer=setTimeout(function(){
          cityTimer=null; cityDwellElapsed=true; startCityTheme();
        },CITY_DWELL_MS);
      },
      onMapExit:function(){
        mapCity=null; stopCityTheme();
      },
      currentTrack:function(){return {title:currentTheme.title,artist:currentTheme.artist,muted:muted};},
      pop:pop,
      tick:tick,
      toggle:function(){
        muted=!muted; userPaused=muted;
        if(audio){ if(muted)audio.pause(); else play(); }
        if(cityAudio){
          if(muted){ try{cityAudio.pause();}catch(e){} }
          else if(mapCity&&cityDwellElapsed)startCityTheme();
        }
        paintToggle();paintBgmCard();
      }
    };
    if(toggle)toggle.addEventListener('click',function(e){e.stopPropagation();window.EspilAudio.toggle();});
    paintToggle();paintBgmCard();
    /* Hover/focus card: song info in a Genshin-styled caption box (2026-10-06 QA #2). */
    (function(){
      var card=document.getElementById('bgm-card');
      if(!toggle||!card)return;
      function show(){
        paintBgmCard();
        card.classList.add('show');
        card.setAttribute('aria-hidden','false');
      }
      function hide(){
        card.classList.remove('show');
        card.setAttribute('aria-hidden','true');
      }
      toggle.addEventListener('mouseenter',show);
      toggle.addEventListener('mouseleave',hide);
      toggle.addEventListener('focus',show);
      toggle.addEventListener('blur',hide);
    }());

    /* Toast */
    var toast=document.getElementById('toast'), toastTimer=null;
    function showToast(msg){
      if(!toast)return;
      toast.textContent=msg; toast.classList.add('show');
      if(toastTimer)clearTimeout(toastTimer);
      toastTimer=setTimeout(function(){toast.classList.remove('show');},3200);
    }
    window.__espilToast=showToast;

    /* Sign-in modal */
    var modal=document.getElementById('signin-modal');
    var openBtn=document.getElementById('signin-open');
    var closeBtn=document.getElementById('signin-close');
    /* Local copy: this IIFE cannot see the first script block's helpers. */
    function setGateHidden(h){ var cs=document.getElementById('city-status'); if(cs)cs.classList.toggle('gate-hidden',!!h); }
    function openModal(){ if(modal)modal.setAttribute('aria-hidden','false'); setGateHidden(true); }
    function closeModal(){ if(modal)modal.setAttribute('aria-hidden','true'); setGateHidden(false); if(window.__espilLoginGateCancel)window.__espilLoginGateCancel(); }
    if(openBtn)openBtn.addEventListener('click',function(e){e.stopPropagation();openModal();});
    if(closeBtn)closeBtn.addEventListener('click',closeModal);
    if(modal)modal.addEventListener('click',function(e){ if(e.target===modal)closeModal(); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape')closeModal(); });
    var providers=document.querySelectorAll('.provider');
    Array.prototype.forEach.call(providers,function(btn){
      btn.addEventListener('click',function(){
        if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
        var name=btn.getAttribute('data-provider')||'Sign-in';
        if(window.__espilLoginBypass&&window.__espilLoginBypass())return; /* Han 2026-10-17: login bypass (no backend yet) */
        if(window.__espilLoginGatePending&&window.__espilLoginGatePending()){ window.__espilLoginGateDone(); return; }
        showToast(name+' sign-in arrives with the game server.');
      });
    });
    /* Guest entry (Han 2026-10-18, production config): the modal's
       one active control - same pass-through the provider buttons
       used, now explicit. */
    var guestBtn=document.getElementById('guest-enter');
    if(guestBtn)guestBtn.addEventListener('click',function(){
      if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
      if(window.__espilLoginBypass&&window.__espilLoginBypass())return;
      if(window.__espilLoginGatePending&&window.__espilLoginGatePending()){ window.__espilLoginGateDone(); return; }
      showToast('Guest entry is available at a city gate.');
    });
  }());
  