
  /* ESPIL Online landing UI: theme BGM, sign-in modal, guest flow. */
  (function(){
    "use strict";
    var audio=document.getElementById('bgm');
    var toggle=document.getElementById('bgm-toggle');
    var started=false, muted=false, userPaused=false;
    /* BGM set (Han's rule, confirmed 2026-10-26, re-applied 2026-11-06): NO
       per-city themes. Every owned track is ONE set, played in random rotation
       with no immediate repeat, on the landing screen and in the map alike.
       Volume 0.3, 4 s fades, the previous song fades out before a swap
       (fade-previous-on-overlap), and the mute toggle stays linked.
       assets/bgm/waitemata.mp3 is the song "Croatia" (title corrected by Han,
       2026-10-27; the file name predates the correction). */
    var BGM_SET=[
      {title:'Green',artist:'Espil Ceil',src:'assets/Green_bgm_landing.mp3'},
      {title:'Citrus Tree',artist:'Espil Ceil',src:'assets/bgm/cities/vancouver.mp3'},
      {title:'Croatia',artist:'Espil Ceil',src:'assets/bgm/waitemata.mp3'},
      {title:'Fire End Dwelling Ash',artist:'Espil Ceil',src:'assets/bgm/fire-end-dwelling-ash.mp3'}
    ];
    var SET_FADE_MS=4000;
    var currentTheme=BGM_SET[0];
    /* Playback volume: the set standard is 0.3. A volume the user picked in
       the settings panel is stored (localStorage 'espil_bgm_vol', mirrored to
       window.__espilBgmVol by the game UI) and always wins over the default. */
    function bgmVol(){
      var stored=null;
      try{stored=localStorage.getItem('espil_bgm_vol');}catch(e){}
      if(stored!=null){
        var v=(window.__espilBgmVol!=null)?window.__espilBgmVol:parseFloat(stored);
        if(v!=null&&!isNaN(v))return Math.max(0,Math.min(1,v));
      }
      return 0.3;
    }
    function paintBgmCard(){
      var t=document.getElementById('bgm-card-title'),
          a=document.getElementById('bgm-card-artist'),
          s=document.getElementById('bgm-card-state');
      if(t)t.textContent=currentTheme.title;
      if(a)a.textContent=currentTheme.artist;
      if(s)s.textContent=(muted?'Muted':'Now playing')+' \u00b7 shuffled set';
    }
    /* Missing-file bookkeeping: a track that fails to load is skipped for the
       rest of the cycle; if EVERY track fails there is nothing to play, so the
       toggle shows OFF instead of pretending (legacy landing behaviour). */
    var failedSrcs={};
    function failedCount(){ var n=0; for(var k in failedSrcs)n++; return n; }
    if(audio){
      audio.volume=bgmVol();
      audio.loop=false; /* the set rotates on 'ended'; no track loops */
      audio.addEventListener('playing',function(){ failedSrcs={}; });
      audio.addEventListener('ended',function(){
        if(muted||userPaused)return;
        playSetTrack(pickNextTrack(null));
      });
      audio.addEventListener('error',function(){
        var cur='';
        try{cur=audio.currentSrc||audio.src||'';}catch(e){}
        for(var i=0;i<BGM_SET.length;i++){
          if(cur.slice(-BGM_SET[i].src.length)===BGM_SET[i].src)failedSrcs[BGM_SET[i].src]=true;
        }
        if(failedCount()>=BGM_SET.length){
          muted=true; userPaused=true; paintToggle(); paintBgmCard();
          return;
        }
        playSetTrack(pickNextTrack(failedSrcs));
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
    /* Volume fade helper: ~1.2 s by default; set swaps pass SET_FADE_MS so
       the incoming song fades in over 4 s after the outgoing one is silenced. */
    var fadeTimer=null;
    function fadeTo(target,done,durationMs){
      if(!audio)return;
      if(fadeTimer){clearInterval(fadeTimer);fadeTimer=null;}
      var steps=Math.max(1,Math.round((durationMs||1200)/60));
      var step=(target-audio.volume)/steps;
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
    /* Pick the next set track at random, never the one that just finished
       (with two tracks this strictly alternates). skip, when given, also
       excludes tracks that failed to load this cycle. A single-track set
       simply returns its only track. */
    function pickNextTrack(skip){
      if(BGM_SET.length<2)return BGM_SET[0];
      var pool=[],i,t;
      for(i=0;i<BGM_SET.length;i++){
        t=BGM_SET[i];
        if(t===currentTheme)continue;
        if(skip&&skip[t.src])continue;
        pool.push(t);
      }
      if(!pool.length){
        for(i=0;i<BGM_SET.length;i++)if(BGM_SET[i]!==currentTheme)pool.push(BGM_SET[i]);
      }
      return pool[Math.floor(Math.random()*pool.length)];
    }
    /* Swap to a set track: the outgoing song is silenced first, the new song
       starts at 0 and fades in over SET_FADE_MS - the previous song never
       overlaps the next one. The card repaints on every rotation. */
    function playSetTrack(theme){
      if(!audio||!theme)return;
      if(fadeTimer){clearInterval(fadeTimer);fadeTimer=null;}
      try{audio.src=theme.src;audio.loop=false;}catch(e){}
      currentTheme=theme;paintBgmCard();
      if(!started||muted||userPaused)return;
      try{audio.volume=0;}catch(e){}
      var p=audio.play(); if(p&&p.catch)p.catch(function(){});
      fadeTo(bgmVol(),null,SET_FADE_MS);
    }
    window.EspilAudio={
      /* Scene hooks kept for the pair's callers. Per-city themes are
         retired: selecting, entering or leaving a city no longer switches
         songs - the set keeps rotating across the landing screen and the
         map alike. */
      onCitySelect:function(){},
      onCityEnter:function(cityName){},
      onReturnToOrbit:function(){},
      onMapEnter:function(cityId){},
      onMapExit:function(){},
      currentTrack:function(){return {title:currentTheme.title,artist:currentTheme.artist,muted:muted};},
      pop:pop,
      tick:tick,
      toggle:function(){
        muted=!muted; userPaused=muted;
        if(audio){
          if(muted)audio.pause();
          else if(audio.ended)playSetTrack(pickNextTrack(null));
          else play();
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
  