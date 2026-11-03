
  /* Time-of-day dark screen (Han 2026-10-21): full-screen black
     overlay, pointer-transparent, always on top; opacity follows
     the local clock - clear by day, half-dark deep at night, with
     dawn and dusk ramps so day and night read clearly. */
  (function(){
    function opacityFor(d){
      var h=d.getHours()+d.getMinutes()/60;
      if(h>=7&&h<18)return 0;
      if(h>=21||h<5)return 0.5;
      if(h>=18)return 0.5*(h-18)/3;
      return 0.5*(1-(h-5)/2);
    }
    window.__espilDayNightOpacity=opacityFor;
    var el=document.createElement('div');
    el.id='espil-daynight'; el.setAttribute('aria-hidden','true');
    document.body.appendChild(el);
    function apply(){ el.style.opacity=String(opacityFor(new Date())); }
    apply();
    setInterval(apply,30000);
  })();
  