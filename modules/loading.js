
  /* Loading screen driver (2026-10-14, Han): the han.espil.online water-glass
     sequence, driven by real load progress — document.images + readyState,
     completed by the Earth-settled signal (espil-earth-ready). Min ~1s on
     screen, 8s hard cap so it never traps the reader. */
  (function(){
    var loader=document.getElementById('loader'); if(!loader) return;
    document.body.classList.add('loading');
    var shown=0, real=0, start=Date.now(), finished=false, earthReady=false, tick=null, mapMode=false, suspended=false;
    window.addEventListener('espil-earth-ready',function(){earthReady=true;});
    if(window.__espilEarthReady)earthReady=true;
    function render(){
      loader.style.setProperty('--p', shown);
    }
    function measure(){
      if(mapMode){ /* map entry: progress is bound to real readiness -
           the bridge's city systems AND the Mapbox visual signal the P1
           layer publishes (__espilMapProgress01: 0 init, .45 style load,
           1 first idle / failure release). Absent signal = no map layer
           expected, treated as ready. (Han PC verdict 2026-10-17 #1) */
        var cp=window.__espilCityProgress01||0;
        var mp=(typeof window.__espilMapProgress01==='number')?window.__espilMapProgress01:1;
        real=Math.max(0,Math.min(100,(cp*0.65+mp*0.35)*100));
        return;
      }
      var imgs=document.images, done=0;
      for(var i=0;i<imgs.length;i++){ if(imgs[i].complete) done++; }
      var imgPart=imgs.length? (done/imgs.length)*65 : 65;
      var docPart=(document.readyState==='complete')?15:(document.readyState==='interactive'?9:3);
      var earthPart=earthReady?20:0;
      real=Math.min(100, imgPart+docPart+earthPart);
    }
    function ready(){
      if(mapMode){
        var mp2=(typeof window.__espilMapProgress01==='number')?window.__espilMapProgress01:1;
        return !!window.__espilCitySettledFlag && mp2>=1;
      }
      return earthReady && document.readyState==='complete';
    }
    function tickFn(){
      measure();
      /* Map mode: the liquid IS the real progress (Han PC verdict
         2026-10-19 #3) - it rises toward the real level at a bounded
         rate and never passes it, so a slow load fills the glass
         slowly and the glass never sits full while the game still
         loads. No chase curve, no +6 race-ahead allowance. */
      var target=mapMode? real : Math.max(real, Math.min(92, (Date.now()-start)/55));
      if(ready()) target=100;
      if(mapMode){ if(target>shown)shown=Math.min(target,shown+1.6); }
      else{ shown+=(target-shown)*0.14; if(target-shown<0.4) shown=target; }
      render();
      if(shown>=99.5 && ready() && Date.now()-start>=(mapMode?800:1000)) finish();
      if(Date.now()-start>(mapMode?30000:8000)) finish(); /* never trap the reader */
    }
    function begin(map){
      if(map&&mapMode&&tick&&!finished)return; /* a map load is already running (preload began at the Dive click): keep the liquid where it is */
      if(map&&mapMode&&suspended&&!finished){
        /* Resume after a gate screen (Han 2026-10-19, flow ruling #2):
           the glass ran from the Dive click until the login screen,
           sleeps while the gate is up, and resumes here for the
           character-confirm -> city segment - same liquid level, the
           clock (min display + hard cap) rebases to this segment. */
        suspended=false; start=Date.now();
        loader.classList.remove('done');
        document.body.classList.add('loading');
        tick=setInterval(tickFn,50); render();
        return;
      }
      mapMode=!!map;
      shown=0; real=0; start=Date.now(); finished=false; suspended=false;
      loader.classList.remove('done');
      document.body.classList.add('loading');
      if(tick) clearInterval(tick);
      tick=setInterval(tickFn,50);
      render();
    }
    function finish(){
      if(finished) return; finished=true; suspended=false;
      shown=100; render(); if(tick){clearInterval(tick); tick=null;}
      setTimeout(function(){
        loader.classList.add('done');
        document.body.classList.remove('loading');
        /* the element stays in the DOM: the map-entry bridge re-shows it */
      },350);
    }
    /* Map-entry bridge (espilShowMapLoader): restart the standard driver in
       map mode - progress from the bridge, finish on its settled flag. */
    window.__espilStartMapLoader=function(){ begin(true); };
    /* Segment pause (Han 2026-10-19 #2): the login gate is an
       interaction screen, not a loading segment - the glass sleeps
       while it is up and resumes at the character-confirm segment. */
    window.__espilSuspendMapLoader=function(){
      if(mapMode&&!finished){ if(tick){clearInterval(tick); tick=null;} suspended=true; }
    };
    begin(false);
  })();
  