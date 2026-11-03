
/* Pointer shadow (Han 2026-10-21): a shooting-star trail for
   the Earth-mark cursor - yellow and green light scattering
   behind the pointer. The earlier trail was removed because
   it could not be seen; this one is built to read on dark and
   bright screens alike: a tapering comet streak through the
   pointer's recent path, saturated particle cores, and
   additive glow halos on top. It sleeps when nothing is
   alive, so it costs nothing at rest. */
(function(){
  if(window.__espilTrailOn)return; window.__espilTrailOn=true;
  /* No reduced-motion gate (Han 2026-10-21): he asked for the touch
     light to appear for the mouse too, and on a PC that reports reduced
     motion the gate silently killed the whole effect while the phone
     still showed it. The effect is user-requested; it always runs. */
  var cv=null,ctx=null,parts=[],path=[],raf=0,spawned=0;
  var lastX=-1,lastY=-1,lastT=0,acc=0;
  var COLORS=['#ffe259','#f7d154','#fff3a0','#7dff9a','#4ade80','#a7f3c7'];
  var sprites={};
  function rgba(hex,a){
    var n=parseInt(hex.slice(1),16);
    return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
  }
  function sprite(color){
    if(sprites[color])return sprites[color];
    var s=document.createElement('canvas'); s.width=s.height=64;
    var g=s.getContext('2d');
    var gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,0.95)');
    gr.addColorStop(0.22,rgba(color,0.8));
    gr.addColorStop(0.55,rgba(color,0.28));
    gr.addColorStop(1,rgba(color,0));
    g.fillStyle=gr; g.fillRect(0,0,64,64);
    sprites[color]=s; return s;
  }
  function ensure(){
    if(cv)return;
    cv=document.createElement('canvas'); cv.id='espil-trail';
    cv.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:950;';
    document.body.appendChild(cv); ctx=cv.getContext('2d');
    var rs=function(){ cv.width=window.innerWidth; cv.height=window.innerHeight; };
    rs(); window.addEventListener('resize',rs);
  }
  function spawn(x,y,vx,vy,n){
    for(var i=0;i<n;i++){
      if(parts.length>=160)break;
      var a=Math.random()*Math.PI*2, sp=12+Math.random()*66;
      parts.push({
        x:x+(Math.random()-0.5)*4, y:y+(Math.random()-0.5)*4,
        vx:vx*0.22+Math.cos(a)*sp, vy:vy*0.22+Math.sin(a)*sp-16,
        life:0, ttl:420+Math.random()*430,
        size:11+Math.random()*22,
        core:0.9+Math.random()*1.5,
        color:COLORS[(Math.random()*COLORS.length)|0]
      });
      spawned++;
    }
  }
  function frame(now){
    raf=0;
    if(!ctx)return;
    var W=cv.width,H=cv.height;
    ctx.clearRect(0,0,W,H);
    while(path.length&&now-path[0].t>230)path.shift();
    var i,p,fr;
    /* comet streak: bright tapering tail through recent points */
    if(path.length>1){
      ctx.globalCompositeOperation='lighter';
      ctx.lineCap='round'; ctx.lineJoin='round';
      for(i=1;i<path.length;i++){
        var p0=path[i-1],p1=path[i];
        fr=i/path.length;
        ctx.strokeStyle=rgba(i%2? '#ffe259':'#4ade80',0.10+0.30*fr*fr);
        ctx.lineWidth=0.6+5.2*fr*fr;
        ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke();
      }
    }
    /* saturated cores (read even on bright map tiles) */
    ctx.globalCompositeOperation='source-over';
    for(i=parts.length-1;i>=0;i--){
      p=parts[i]; fr=1-p.life/p.ttl;
      if(fr<=0)continue;
      ctx.globalAlpha=Math.min(1,fr*1.4)*0.95;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.core*(0.5+0.5*fr),0,6.2832); ctx.fill();
    }
    /* additive halos */
    ctx.globalCompositeOperation='lighter';
    for(i=parts.length-1;i>=0;i--){
      p=parts[i]; fr=1-p.life/p.ttl;
      if(fr<=0){ parts.splice(i,1); continue; }
      var s=p.size*(1.25-0.55*fr);
      ctx.globalAlpha=Math.min(1,fr*1.5);
      ctx.drawImage(sprite(p.color),p.x-s/2,p.y-s/2,s,s);
    }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    /* physics */
    var dt=16.7;
    for(i=parts.length-1;i>=0;i--){
      p=parts[i]; p.life+=dt;
      p.vx*=0.985; p.vy=p.vy*0.985-14*dt/1000; /* sparks scatter and float up a little */
      p.x+=p.vx*dt/1000; p.y+=p.vy*dt/1000;
    }
    if(parts.length||path.length>1){ raf=requestAnimationFrame(frame); }
    else { ctx.clearRect(0,0,W,H); path.length=0; }
  }
  function kick(){ if(!raf)raf=requestAnimationFrame(frame); }
  document.addEventListener('pointermove',function(e){
    ensure();
    var now=performance.now();
    var x=e.clientX,y=e.clientY;
    if(lastX>=0){
      var dx=x-lastX,dy=y-lastY,d=Math.hypot(dx,dy),dtm=Math.max(1,now-lastT);
      acc+=d;
      path.push({x:x,y:y,t:now});
      if(path.length>26)path.shift();
      if(acc>6){ spawn(x,y,dx/dtm*1000*0.14,dy/dtm*1000*0.14, d>30?5:3); acc=0; }
      kick();
    }
    lastX=x; lastY=y; lastT=now;
  },{passive:true,capture:true});
  /* A click (or tap) flashes the same light even without movement
     (Han 2026-10-21: hover OR click). */
  document.addEventListener('pointerdown',function(e){
    ensure();
    spawn(e.clientX,e.clientY,0,0,8);
    lastX=e.clientX; lastY=e.clientY; lastT=performance.now();
    kick();
  },{passive:true,capture:true});
  window.__espilTrailStats=function(){ return {alive:parts.length,path:path.length,spawned:spawned}; };
})();
