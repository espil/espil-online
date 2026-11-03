
  /* Liquid physics for the loading glass (2026-10-15, Han): the surface is a
     spring chain — each column pulls on its neighbours — rocked by an
     oscillating lateral force that grows with --p. Fast crests throw
     droplets; droplets arc under gravity and splash back in with a ripple.
     Pure enhancement: any failure here leaves the CSS liquid untouched. */
  (function(){
    var loader=document.getElementById('loader'); if(!loader) return;
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    /* Luminous yellow-to-green gradient (Han 2026-10-16): the stops are drawn
       fresh on every load along yellow -> green and lifted in luminance so
       the liquid glows inside the glass. Shared by the CSS liquid (inline
       style) and the physics canvas, so both always match. */
    var YC=[255,245,155], GC=[202,248,118], stops=[[0,YC[0],YC[1],YC[2],0.76]], k;
    for(k=1;k<=4;k++){
      var t=k/5+(Math.random()-0.5)*0.09;
      stops.push([t, Math.round(YC[0]+(GC[0]-YC[0])*t), Math.round(YC[1]+(GC[1]-YC[1])*t), Math.round(YC[2]+(GC[2]-YC[2])*t), 0.68+Math.random()*0.08]);
    }
    stops.push([1,172,230,64,0.78]);
    var waterEl=loader.querySelector('.water');
    if(waterEl){
      var parts=[];
      for(k=0;k<stops.length;k++){ var s0=stops[k]; parts.push('rgba('+s0[1]+','+s0[2]+','+s0[3]+','+s0[4].toFixed(2)+') '+(s0[0]*100).toFixed(1)+'%'); }
      waterEl.style.background='linear-gradient(100deg, rgba(255,255,255,.12), rgba(255,255,255,0) 36%, rgba(255,255,255,.07) 60%, rgba(255,255,255,0) 82%), linear-gradient(180deg, '+parts.join(', ')+')';
    }
    var canvas=loader.querySelector('.water-canvas'); if(!canvas) return;
    var ctx=null; try{ ctx=canvas.getContext('2d'); }catch(e){}
    if(!ctx) return;
    loader.classList.add('physics-on');
    var W=196, H=196, N=30, K=90, C=1.6, COUPLE=150, GRAV=1600;
    var h=[], v=[], i;
    for(i=0;i<N;i++){ h.push(0); v.push(0); }
    var drops=[], bubbles=[];
    var baseY=H+4, phase=0, budget=0, last=performance.now(), prevDrive=0, speedSm=0, agit=0.35, agitTick=0, running=false, fillP=0;
    function progress(){
      var p=parseFloat(loader.style.getPropertyValue('--p'));
      return isNaN(p)?0:Math.max(0,Math.min(100,p));
    }
    function colAt(x){ var c=Math.floor(x/W*N); return c<0?0:(c>=N?N-1:c); }
    function surfY(x){ return baseY+h[colAt(x)]; }
    function spawnDrop(x,y,vy,vx,r){
      if(drops.length>=60) return;
      if(y>H-16||fillP<18) return; /* nothing flies before a real body of liquid (Han 2026-10-16 #0, re-check #9) */
      drops.push({x:x,y:y,vy:vy,vx:vx,r:r});
    }
    function frame(now){
      if(!document.body.contains(loader) || loader.classList.contains('done')){ running=false; return; }
      var dt=(now-last)/1000; last=now;
      if(dt>0.05) dt=0.05;
      if(dt<=0){ requestAnimationFrame(frame); return; }
      var p=progress(), energy=0.3+0.7*agit; fillP=p;
      phase+=dt*1.85;
      var amp=(0.5+p*0.02+agit*(1.1+p*0.055))/9.1; /* rock fraction, speed-led */
      var drive=Math.cos(phase)*amp;
      if(prevDrive!==0 && Math.sign(drive)!==Math.sign(prevDrive) && p>50){
        /* rock reversal at high fill: a burst off the leading side — inset
           from the rim, where the round glass does not clip the droplets */
        var ex=(drive>0?0.22:0.78)*W;
        for(var b=0;b<3+Math.round(3*agit);b++) spawnDrop(ex+(Math.random()*14-7), surfY(ex), -(230+Math.random()*190)*(0.45+0.75*agit), (Math.random()*90-45), 2.2+Math.random()*2.6);
      }
      prevDrive=drive;
      /* fill level eases toward the driver's --p */
      var targetY=H-(p/100)*H, prevBase=baseY;
      baseY+=(targetY-baseY)*Math.min(1,dt*2.6);
      var rise=(prevBase-baseY)/Math.max(dt,0.001); /* px/s the line climbs */
      /* Agitation follows the loading SPEED (Han 2026-10-16): fast progress
         churns the liquid, a stall lets it settle. agit also feeds the CSS
         fallback rock through the --agit variable. */
      speedSm+=((rise>0?rise:0)-speedSm)*Math.min(1,dt*2.2);
      agit=Math.max(0,Math.min(1,speedSm/55));
      if(++agitTick>=9){ agitTick=0; try{ loader.style.setProperty('--agit', agit.toFixed(2)); }catch(e){} }
      /* spring chain, two substeps */
      for(var s=0;s<2;s++){
        var dts=dt/2, a=[], c;
        for(c=0;c<N;c++){
          var left=c>0?h[c-1]:h[c], right=c<N-1?h[c+1]:h[c];
          a[c]=-K*h[c]-C*v[c]+COUPLE*(left+right-2*h[c]);
        }
        for(c=0;c<N;c++){
          var nx=(c/(N-1))*2-1;
          v[c]+=(a[c]-drive*820*nx)*dts;
          h[c]+=v[c]*dts;
        }
      }
      if(rise>50){ /* pouring in fast: the surface gets thrown around */
        for(var r2=0;r2<4;r2++){ var rc=Math.floor(Math.random()*N); v[rc]-=rise*0.55*Math.random(); }
        if(Math.random()<0.75) spawnDrop(Math.random()*W, baseY, -(200+Math.random()*200)*energy, (Math.random()*70-35), 1.7+Math.random()*2.2);
      }
      /* crest ejection: fast-rising crests throw droplets */
      budget+=dt*(2+9*agit);
      for(var c2=2;c2<N-2;c2++){
        if(budget>=1 && v[c2]<-80*energy && h[c2]<=h[c2-1] && h[c2]<=h[c2+1] && Math.random()<0.6){
          budget-=1;
          spawnDrop((c2+0.5)/N*W, baseY+h[c2]-2, v[c2]*1.05-(110+Math.random()*120), ((c2/(N-1))*2-1)*58+(Math.random()*76-38), 2+Math.random()*2.6);
        }
      }
      /* bubbles inside the liquid: rise, wobble, pop at the surface */
      if(bubbles.length<7 && p>=35 && Math.random()<dt*3.2){ var bx=26+Math.random()*(W-52); if(surfY(bx)<H-55) bubbles.push({x:bx, y:Math.min(H-8, surfY(bx)+10+Math.random()*14), r:1.4+Math.random()*2.2, vy:-(16+Math.random()*22), seed:Math.random()*6.28}); } /* bubbles only in a substantially filled glass (Han re-check 2026-10-17 #9) */
      for(var bi=bubbles.length-1;bi>=0;bi--){
        var bb=bubbles[bi]; bb.y+=bb.vy*dt; bb.x+=Math.sin(now/300+bb.seed)*7*dt;
        if(bb.y<=surfY(bb.x)+3){ v[colAt(bb.x)]-=16; bubbles.splice(bi,1); }
      }
      /* droplets under gravity; landing pushes a ripple into the surface */
      for(var di=drops.length-1;di>=0;di--){
        var d=drops[di];
        d.vy+=GRAV*dt; d.x+=d.vx*dt; d.y+=d.vy*dt;
        if(d.x<2){ d.x=2; d.vx=Math.abs(d.vx)*0.5; }
        if(d.x>W-2){ d.x=W-2; d.vx=-Math.abs(d.vx)*0.5; }
        if(d.vy>0 && d.y>=surfY(d.x)){
          v[colAt(d.x)]+=d.vy*0.20;
          if(d.vy>300){ /* hard landing: a small crown splash */
            spawnDrop(d.x, surfY(d.x)-2, -(70+Math.random()*80), (Math.random()*50-25), 1.2+Math.random()*1.4);
            spawnDrop(d.x, surfY(d.x)-2, -(55+Math.random()*60), (Math.random()*50-25), 1+Math.random()*1.2);
          } else if(Math.random()<0.3) spawnDrop(d.x, surfY(d.x)-2, -(50+Math.random()*70), (Math.random()*44-22), 1+Math.random()*1.2);
          drops.splice(di,1);
        } else if(d.y>H+10){ drops.splice(di,1); }
      }
      /* ---- render ---- */
      ctx.clearRect(0,0,W,H);
      var grad=ctx.createLinearGradient(0,Math.max(0,baseY-30),0,H);
      for(var gs=0;gs<stops.length;gs++){ var st=stops[gs]; grad.addColorStop(st[0],'rgba('+st[1]+','+st[2]+','+st[3]+','+st[4]+')'); }
      ctx.beginPath();
      ctx.moveTo(-4,H+4);
      for(var px=0;px<N;px++) ctx.lineTo((px+0.5)/N*W, baseY+h[px]);
      ctx.lineTo(W+4,H+4);
      ctx.closePath();
      ctx.fillStyle=grad; ctx.fill();
      /* luminous sheen pooled in the upper liquid, so it glows in the glass */
      var sheen=ctx.createLinearGradient(0,Math.max(0,baseY-8),0,Math.min(H,baseY+64));
      sheen.addColorStop(0,'rgba(255,255,232,0.36)');
      sheen.addColorStop(1,'rgba(255,255,232,0)');
      ctx.fillStyle=sheen; ctx.fill();
      /* surface glint along the simulated line */
      ctx.beginPath();
      for(var gx=0;gx<N;gx++){ var gy=baseY+h[gx]; if(gx===0) ctx.moveTo((gx+0.5)/N*W,gy); else ctx.lineTo((gx+0.5)/N*W,gy); }
      ctx.strokeStyle='rgba(245,255,220,0.75)'; ctx.lineWidth=2; ctx.stroke();
      /* bubbles */
      ctx.strokeStyle='rgba(255,255,255,0.45)'; ctx.lineWidth=1;
      for(var bu=0;bu<bubbles.length;bu++){ var q=bubbles[bu]; ctx.beginPath(); ctx.arc(q.x,q.y,q.r,0,6.2832); ctx.stroke(); }
      /* droplets */
      for(var dr=0;dr<drops.length;dr++){
        var o=drops[dr];
        ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,6.2832);
        ctx.fillStyle='rgba(250,255,224,0.95)'; ctx.fill();
        ctx.beginPath(); ctx.arc(o.x-o.r*0.3,o.y-o.r*0.3,o.r*0.38,0,6.2832);
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    running=true; requestAnimationFrame(frame);
    /* Map-entry bridge (espilShowMapLoader): restart the liquid physics so
       the re-shown glass fills and sloshes again. */
    window.__espilStartLoaderPhysics=function(){
      drops.length=0; last=performance.now();
      if(!running){ running=true; requestAnimationFrame(frame); }
    };
  })();
  