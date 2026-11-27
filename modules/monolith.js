
  (function(){
    /* IME KEY NORMALIZATION (2026-11-23, home-key fix): with the
       Korean IME in Hangul mode on Windows, a physical letter key
       delivers e.key as the Hangul jamo (H -> the jamo for H, code
       'KeyH'), or 'Process' during composition, so every letter
       branch keyed on e.key missed and the whole keyboard map
       (movement, skills, menus, H) read as dead. __espilNormKey
       derives the effective key ONCE: when e.key is a single
       character that is not a Latin letter, or is 'Process', and
       e.code names a letter key (KeyA-KeyZ), the effective key is
       that letter, lowercased. Every other event is returned
       untouched, so English-mode behaviour is exactly the old
       behaviour. Digit keys are NOT normalized: no handler in this
       fix branches on digit keys. Consumers call this only AFTER
       their typing guard, so text fields keep their raw events and
       Korean composition is never touched. */
    window.__espilNormKey=function(e){
      var k=e&&e.key;
      if(typeof k!=='string'||!k)return k;
      if(k==='Process'||(k.length===1&&!/^[a-zA-Z]$/.test(k))){
        var m=/^Key([A-Z])$/.exec((e&&e.code)||'');
        if(m)return m[1].toLowerCase();
      }
      return k;
    };
    var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var status=document.getElementById('city-message');
    /* Han 2026-10-16 (landing text rules): the landing message line
       carries the CITY NAME ONLY - no status copy, no hints, no
       loading or progress text. Every existing status write is
       funnelled through this setter and rendered as the current
       city name. Han 2026-11-08 (supersedes the default): before the
       visitor chooses a city, the line is the selector's prompt
       state - the text 'Choose your city'; no city is pre-selected.
       Once a city is chosen it carries that city's name only, as
       before. */
    (function(){
      if(!status)return;
      var d=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
      if(!d||!d.set)return;
      function landingCityName(){
        if(typeof selected!=='undefined'&&selected&&selected.userData&&selected.userData.name)return selected.userData.name;
        return 'Choose your city';
      }
      Object.defineProperty(status,'textContent',{
        configurable:true,
        get:function(){ return d.get.call(status); },
        set:function(){ d.set.call(status,landingCityName()); }
      });
      status.textContent='';
    })();
    var clock=document.getElementById('city-clock');
    var cityList=document.getElementById('city-list');
    var cityPhasePanel=document.getElementById('city-phase');
    var cityPhaseName=document.getElementById('city-phase-name');
    var cityReturn=document.getElementById('city-return');
    var frame=document.getElementById('earth-frame');
    var canvas=document.getElementById('globe-canvas');
    /* IANA timezone per city for the reel clock. */
    var cityTimezones={
      'Vancouver':'America/Vancouver','San Francisco':'America/Los_Angeles','Los Angeles':'America/Los_Angeles',
      'Chicago':'America/Chicago','Mexico City':'America/Mexico_City','New York':'America/New_York','Toronto':'America/Toronto',
      'Rio de Janeiro':'America/Sao_Paulo','São Paulo':'America/Sao_Paulo','Buenos Aires':'America/Argentina/Buenos_Aires',
      'London':'Europe/London','Paris':'Europe/Paris','Madrid':'Europe/Madrid','Rome':'Europe/Rome','Berlin':'Europe/Berlin',
      'Moscow':'Europe/Moscow','Lagos':'Africa/Lagos','Nairobi':'Africa/Nairobi','Cairo':'Africa/Cairo',
      'Cape Town':'Africa/Johannesburg','Istanbul':'Europe/Istanbul','Dubai':'Asia/Dubai','Mumbai':'Asia/Kolkata',
      'Delhi':'Asia/Kolkata','Singapore':'Asia/Singapore','Bangkok':'Asia/Bangkok','Shanghai':'Asia/Shanghai',
      'Hong Kong':'Asia/Hong_Kong','Beijing':'Asia/Shanghai','Seoul':'Asia/Seoul','Tokyo':'Asia/Tokyo','Manila':'Asia/Manila',
      'Jakarta':'Asia/Jakarta','Sydney':'Australia/Sydney','Melbourne':'Australia/Melbourne','Auckland':'Pacific/Auckland'
    };
    function updateClock(){
      var now=new Date();
      /* Each city keeps its own timezone; the clock follows the centered city. */
      var name=(typeof centeredMarker!=='undefined'&&centeredMarker)?centeredMarker.userData.name:null;
      var tz=name?cityTimezones[name]:null;
      var text,label='Local time';
      try{
        text=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:tz||undefined});
        if(name&&tz)label=name+' time';
      }catch(e){
        text=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      }
      clock.dateTime=now.toISOString();
      clock.textContent=text;
      clock.setAttribute('aria-label',label+' '+text);
    }
    updateClock();
    window.setInterval(updateClock,1000);
    if(!window.THREE||!frame||!canvas){status.textContent='Earth could not be rendered on this device';return;}

    var scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(0x010306,.0085);
    var camera=new THREE.PerspectiveCamera(38,1,.01,100);
    camera.position.set(0,0,6.6);
    var renderer=new THREE.WebGLRenderer({canvas:canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.setClearColor(0x010306,1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputEncoding=THREE.sRGBEncoding;
    canvas.addEventListener('webglcontextlost',function(event){
      event.preventDefault();
      textureFailed=true;
      status.textContent='Earth rendering paused — Edge lost its graphics context; enable hardware acceleration, then refresh';
    },false);

    function seeded(seed){return function(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
    var random=seeded(8273641);
    function gaussian(){return Math.sqrt(-2*Math.log(Math.max(.000001,random())))*Math.cos(2*Math.PI*random());}

    /* Equatorial coordinates use Earth's north axis as +Y, so the sky stays fixed while the camera moves. */
    var starSphere=new THREE.Group();
    scene.add(starSphere);
    var starPositions=[],starColors=[],starSizes=[],brightStars=[];
    function addStar(raHours,decDegrees,radius,magnitude,temp,isCatalogued){
      var ra=raHours*Math.PI/12,dec=decDegrees*Math.PI/180;
      var cosD=Math.cos(dec),x=radius*cosD*Math.cos(ra),y=radius*Math.sin(dec),z=radius*cosD*Math.sin(ra);
      starPositions.push(x,y,z);
      var cool=Math.max(0,Math.min(1,(temp-3200)/7000));
      starColors.push(.84+.16*cool,.72+.24*cool,1-.2*cool);
      var size=Math.max(1.15,5.8-magnitude*1.13);
      starSizes.push(size);
      if(isCatalogued)brightStars.push({x:x,y:y,z:z,size:size});
    }
    /* Equatorial coordinates, apparent magnitudes and approximate temperatures for the brightest stars. */
    var brightCatalog=[
      [6.752,-16.716,-1.46,9940],[6.399,-52.696,-.74,7350],[14.261,19.182,-.05,4290],[18.615,38.784,.03,9600],
      [5.279,45.998,.08,4970],[5.242,-8.202,.13,12100],[7.655,5.225,.34,6530],[1.628,-57.237,.46,15000],
      [5.919,7.407,.50,3500],[14.063,-60.373,.61,25000],[12.443,-63.099,.76,28000],[19.846,8.868,.77,7550],
      [4.599,16.509,.86,3900],[13.420,-11.161,.97,25300],[16.490,-26.432,.96,3660],[7.755,28.026,1.14,4660],
      [22.961,-29.622,1.16,8590],[20.691,45.280,1.25,8520],[12.795,-59.689,1.25,27000],[10.139,11.967,1.35,12460],
      [6.977,-28.972,1.50,22800],[7.577,31.888,1.58,8840],[12.519,-57.113,1.63,3620],[17.561,-37.104,1.62,25000],
      [5.419,6.350,1.64,22000],[5.438,28.607,1.65,13800],[9.220,-69.717,1.67,15100],[5.604,-1.202,1.69,27500],
      [22.137,-46.961,1.73,13800],[12.900,55.960,1.76,9400],[11.062,61.750,1.79,4660],[3.405,49.861,1.79,6350]
    ];
    var i;
    brightCatalog.forEach(function(star){addStar(star[0],star[1],35+random()*5,star[2],star[3],true);});
    /* A restrained faint-star bed supplies the unresolved background between catalogued guide stars. */
    for(i=0;i<1200;i++){
      addStar(random()*24,Math.asin(random()*2-1)*180/Math.PI,31+random()*14,2.1+Math.pow(random(),.4)*3.8,3400+random()*6500,false);
    }
    var milkyAxis=new THREE.Vector3(.33,.77,.54).normalize();
    var helperA=new THREE.Vector3(0,1,0);
    if(Math.abs(milkyAxis.dot(helperA))>.9)helperA.set(1,0,0);
    var bandU=new THREE.Vector3().crossVectors(milkyAxis,helperA).normalize();
    var bandV=new THREE.Vector3().crossVectors(milkyAxis,bandU).normalize();
    for(i=0;i<2350;i++){
      var angle=random()*Math.PI*2;
      var latitude=gaussian()*.075;
      var dir=bandU.clone().multiplyScalar(Math.cos(angle)*Math.cos(latitude)).add(bandV.clone().multiplyScalar(Math.sin(angle)*Math.cos(latitude))).add(milkyAxis.clone().multiplyScalar(Math.sin(latitude))).normalize();
      var radius=33+random()*13;
      var x=dir.x*radius,y=dir.y*radius,z=dir.z*radius;
      starPositions.push(x,y,z);
      var warmth=random();
      starColors.push(.78+.22*warmth,.82+.15*warmth,1-.1*warmth);
      starSizes.push(.65+Math.pow(random(),4)*2.4);
    }
    var starGeometry=new THREE.BufferGeometry();
    starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
    starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
    starGeometry.setAttribute('aSize',new THREE.Float32BufferAttribute(starSizes,1));
    var starMaterial=new THREE.ShaderMaterial({
      vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'attribute float aSize;varying vec3 vColor;void main(){vColor=color;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*(230.0/-mvPosition.z);gl_Position=projectionMatrix*mvPosition;}',
      fragmentShader:'varying vec3 vColor;void main(){float d=length(gl_PointCoord-vec2(.5));float core=smoothstep(.5,.02,d);float glow=smoothstep(.5,.12,d)*.55;gl_FragColor=vec4(vColor,core+glow);}'
    });
    starSphere.add(new THREE.Points(starGeometry,starMaterial));

    var trailPositions=[];
    brightStars.slice(0,120).forEach(function(star){
      var radius=Math.sqrt(star.x*star.x+star.z*star.z),base=Math.atan2(star.z,star.x),span=.034;
      for(var s=0;s<7;s++){
        var a1=base-span/2+(span*s/7),a2=base-span/2+(span*(s+1)/7);
        trailPositions.push(radius*Math.cos(a1),star.y,radius*Math.sin(a1),radius*Math.cos(a2),star.y,radius*Math.sin(a2));
      }
    });
    var trailGeometry=new THREE.BufferGeometry();
    trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(trailPositions,3));
    starSphere.add(new THREE.LineSegments(trailGeometry,new THREE.LineBasicMaterial({color:0xaed5df,transparent:true,opacity:.11,blending:THREE.AdditiveBlending,depthWrite:false})));

    /* The planet is fixed in the equatorial frame; only the camera orbits it. */
    var earthSpin=new THREE.Group();
    earthSpin.rotation.y=-.55;
    scene.add(earthSpin);
    /*
      The visible colour comes from the local Blue Marble image. The sphere itself is also carved
      in the vertex shader from NASA GEBCO land-elevation data (0–6400 m), with restrained vertical
      exaggeration so mountain systems remain legible at globe scale. Explicit ImageLoader paths
      avoid Edge/mobile texture-decoder differences; PNG remains the colour-map fallback.
    */
    var earthMaterial=new THREE.MeshPhongMaterial({color:0x4b7180,shininess:7,specular:0x173945});
    var earth=new THREE.Mesh(new THREE.SphereGeometry(2,256,128),earthMaterial);
    earthSpin.add(earth);
    var textureReady=false,textureFailed=false,reliefReady=false,reliefFailed=false;
    function idleStatus(){
      if(textureFailed)return 'Earth surface could not load — refresh Edge or enable hardware acceleration';
      if(reliefFailed)return 'Earth terrain could not load — showing the surface without relief';
      if(!textureReady)return 'Loading Earth surface…';
      if(!reliefReady)return 'Carving Earth terrain…';
      return '';
    }
    status.textContent=idleStatus();
    function notifyEarthSettled(){
      var settled=(textureReady||textureFailed)&&(reliefReady||reliefFailed);
      if(settled&&!window.__espilEarthReady){
        window.__espilEarthReady=true;
        try{window.dispatchEvent(new Event('espil-earth-ready'));}catch(e){}
      }
    }
    function makeDataTexture(image){
      var texture=new THREE.Texture(image);
      /* Mipmaps + high anisotropy keep the globe crisp while zooming in (2026-10-06 QA #3). */
      texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.magFilter=THREE.LinearFilter;
      texture.generateMipmaps=true;
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate=true;
      return texture;
    }
    function applyEarthImage(image){
      var texture=makeDataTexture(image);
      texture.encoding=THREE.sRGBEncoding;
      earthMaterial.color.setHex(0xffffff);
      earthMaterial.map=texture;
      earthMaterial.needsUpdate=true;
      textureReady=true;
      textureFailed=false;
      status.textContent=idleStatus();
      notifyEarthSettled();
    }
    function applyElevationImage(image){
      /* Bake elevation into the mesh positions: the silhouette and lighting come from real geometry. */
      var sampleCanvas=document.createElement('canvas');
      sampleCanvas.width=image.naturalWidth||image.width;
      sampleCanvas.height=image.naturalHeight||image.height;
      var sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
      sampleContext.drawImage(image,0,0);
      var pixels=sampleContext.getImageData(0,0,sampleCanvas.width,sampleCanvas.height).data;
      var positions=earth.geometry.attributes.position;
      var uvs=earth.geometry.attributes.uv;
      var normal=new THREE.Vector3();
      for(var vertex=0;vertex<positions.count;vertex++){
        var u=uvs.getX(vertex),v=uvs.getY(vertex);
        var px=Math.max(0,Math.min(sampleCanvas.width-1,Math.round(u*(sampleCanvas.width-1))));
        var py=Math.max(0,Math.min(sampleCanvas.height-1,Math.round((1-v)*(sampleCanvas.height-1))));
        var elevationValue=pixels[(py*sampleCanvas.width+px)*4]/255;
        normal.set(positions.getX(vertex),positions.getY(vertex),positions.getZ(vertex)).normalize().multiplyScalar(2+elevationValue*.064);
        positions.setXYZ(vertex,normal.x,normal.y,normal.z);
      }
      positions.needsUpdate=true;
      earth.geometry.computeVertexNormals();
      earth.geometry.computeBoundingSphere();
      /* The same NASA field adds fine slope detail between geometry vertices. */
      var elevation=makeDataTexture(image);
      earthMaterial.bumpMap=elevation;
      earthMaterial.bumpScale=.018;
      earthMaterial.needsUpdate=true;
      reliefReady=true;
      reliefFailed=false;
      status.textContent=idleStatus();
      notifyEarthSettled();
    }
    function loadEarthImage(url,onFailure){new THREE.ImageLoader().load(url,applyEarthImage,undefined,onFailure);}
    /* The revision query defeats a stale Edge cache; PNG avoids a failing JPEG decoder/upload path.
       2026-10-06: 4096x2048 texture (was 2048x1024) for the zoomed-in city views. */
    loadEarthImage('assets/earth-blue-marble-2026.jpg?rev=edge-20261006-4k',function(){
      loadEarthImage('assets/earth-blue-marble-fallback.png?rev=edge-20261006-4k',function(){
        textureFailed=true;
        status.textContent=idleStatus();
        notifyEarthSettled();
      });
    });
    new THREE.ImageLoader().load('assets/earth-elevation-nasa.jpg?rev=terrain-20261002-1',applyElevationImage,undefined,function(){
      reliefFailed=true;
      status.textContent=idleStatus();
      notifyEarthSettled();
    });
    var atmosphere=new THREE.Mesh(new THREE.SphereGeometry(2.105,96,64),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,vertexShader:'varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vNormal;void main(){float f=pow(0.74-dot(vNormal,vec3(0.0,0.0,1.0)),2.7);gl_FragColor=vec4(0.20,0.69,0.92,0.42)*f;}'}));
    earthSpin.add(atmosphere);
    scene.add(new THREE.HemisphereLight(0x7896a3,0x02090c,.3));
    var sunlight=new THREE.DirectionalLight(0xfff7e8,2.05);
    scene.add(sunlight);
    var sunDisc=new THREE.Mesh(new THREE.SphereGeometry(.18,28,28),new THREE.MeshBasicMaterial({color:0xfff4ce,fog:false}));
    scene.add(sunDisc);
    var worldSunDirection=new THREE.Vector3(1,0,0);
    /* Phase two uses the same astronomical sun vector to tint the city sky from daylight through twilight to night. */
    var skyUniforms={
      sunDirection:{value:worldSunDirection.clone()},
      upDirection:{value:new THREE.Vector3(0,1,0)},
      daylight:{value:1}
    };
    var citySky=new THREE.Mesh(new THREE.SphereGeometry(27,64,40),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,uniforms:skyUniforms,
      vertexShader:'varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
      fragmentShader:'uniform vec3 sunDirection;uniform vec3 upDirection;uniform float daylight;varying vec3 vWorld;void main(){vec3 ray=normalize(vWorld-cameraPosition);float h=clamp(dot(ray,normalize(upDirection)),0.0,1.0);vec3 nightH=vec3(.018,.045,.09);vec3 nightT=vec3(.004,.009,.025);vec3 dayH=vec3(.42,.68,.82);vec3 dayT=vec3(.035,.22,.48);vec3 base=mix(mix(nightH,nightT,pow(h,.55)),mix(dayH,dayT,pow(h,.48)),daylight);float sun=max(dot(ray,normalize(sunDirection)),0.0);base+=vec3(1.0,.56,.28)*pow(sun,56.0)*(1.0-daylight*.35);base+=vec3(1.0,.92,.7)*pow(sun,420.0);gl_FragColor=vec4(base,1.0);}'
    }));
    citySky.visible=false;
    scene.add(citySky);
    /* Recompute the subsolar point from UTC, including Earth rotation, so the terminator tracks real time. */
    function updateSunPosition(){
      var now=new Date();
      var julian=now.getTime()/86400000+2440587.5;
      var days=julian-2451545.0;
      var meanLong=(280.460+0.9856474*days)%360;
      var anomaly=(357.528+0.9856003*days)*Math.PI/180;
      var ecliptic=(meanLong+1.915*Math.sin(anomaly)+.020*Math.sin(2*anomaly))*Math.PI/180;
      var obliquity=(23.439-.0000004*days)*Math.PI/180;
      var rightAscension=Math.atan2(Math.cos(obliquity)*Math.sin(ecliptic),Math.cos(ecliptic));
      var declination=Math.asin(Math.sin(obliquity)*Math.sin(ecliptic));
      var centuries=days/36525;
      var sidereal=(280.46061837+360.98564736629*days+.000387933*centuries*centuries-centuries*centuries*centuries/38710000)*Math.PI/180;
      var subsolarLongitude=rightAscension-sidereal;
      worldSunDirection.set(
        Math.cos(declination)*Math.cos(subsolarLongitude),
        Math.sin(declination),
        -Math.cos(declination)*Math.sin(subsolarLongitude)
      ).applyQuaternion(earthSpin.quaternion).normalize();
      sunlight.position.copy(worldSunDirection).multiplyScalar(10);
      sunDisc.position.copy(worldSunDirection).multiplyScalar(29);
      skyUniforms.sunDirection.value.copy(worldSunDirection);
      if(navigationReady){
        var solarAltitude=worldSunDirection.dot(navigationNormal);
        skyUniforms.daylight.value=Math.max(0,Math.min(1,(solarAltitude+.13)/.34));
      }
    }
    updateSunPosition();
    window.setInterval(updateSunPosition,30000);

    /* 36-city reel (restored 2026-10-06): the single-city cut was a regression. */
    var cityData=[
      ['Vancouver',49.2827,-123.1207,'sails','Canada Place sails'],['San Francisco',37.7749,-122.4194,'bridge','Golden Gate Bridge'],['Los Angeles',34.0522,-118.2437,'star','Hollywood star'],['Chicago',41.8781,-87.6298,'tower','Willis Tower'],['Mexico City',19.4326,-99.1332,'pyramid','Sun Pyramid'],['New York',40.7128,-74.006,'liberty','Statue of Liberty'],['Toronto',43.6532,-79.3832,'needle','CN Tower'],
      ['Rio de Janeiro',-22.9068,-43.1729,'christ','Christ the Redeemer'],['São Paulo',-23.5505,-46.6333,'beam','MASP'],['Buenos Aires',-34.6037,-58.3816,'obelisk','Obelisk'],['London',51.5072,-.1276,'clock','Big Ben'],['Paris',48.8566,2.3522,'eiffel','Eiffel Tower'],['Madrid',40.4168,-3.7038,'tree','Bear and strawberry tree'],['Rome',41.9028,12.4964,'colosseum','Colosseum'],['Berlin',52.52,13.405,'gate','Brandenburg Gate'],['Moscow',55.7558,37.6173,'domes','Saint Basil domes'],
      ['Lagos',6.5244,3.3792,'theatre','National Theatre'],['Nairobi',-1.2921,36.8219,'spire','KICC'],['Cairo',30.0444,31.2357,'pyramid','Great Pyramid'],['Cape Town',-33.9249,18.4241,'mountain','Table Mountain'],['Istanbul',41.0082,28.9784,'mosque','Blue Mosque'],['Dubai',25.2048,55.2708,'burj','Burj Khalifa'],['Mumbai',19.076,72.8777,'gateway','Gateway of India'],['Delhi',28.6139,77.209,'arch','India Gate'],
      ['Singapore',1.3521,103.8198,'merlion','Merlion'],['Bangkok',13.7563,100.5018,'temple','Wat Arun'],['Shanghai',31.2304,121.4737,'pearl','Oriental Pearl Tower'],['Hong Kong',22.3193,114.1694,'junk','Harbour junk'],['Beijing',39.9042,116.4074,'hall','Temple of Heaven'],['Seoul',37.5665,126.978,'needle','N Seoul Tower'],['Tokyo',35.6762,139.6503,'torii','Torii gate'],['Manila',14.5995,120.9842,'sun','Philippine sun'],['Jakarta',-6.2088,106.8456,'obelisk','National Monument'],['Sydney',-33.8688,151.2093,'sails','Sydney Opera House'],['Melbourne',-37.8136,144.9631,'station','Flinders Street Station'],['Auckland',-36.8509,174.7645,'needle','Sky Tower']
    ];
    /* Landing city availability (Han 2026-10-18; production config
       the same day): only these SIX cities are selectable in the
       landing reel - Seoul is inactive in this configuration too.
       Every other city is shown but inactive (grey, not selectable
       by click, pin, Enter, arrows or by name). Selection behaviour
       for the active six is unchanged. */
    var ESPIL_SELECTABLE_CITIES={'Vancouver':true,'Auckland':true,'Tokyo':true,'New York':true,'Paris':true,'London':true};
    var markers=[],markerGroup=new THREE.Group();
    earthSpin.add(markerGroup);
    function latLon(lat,lon,r){var phi=(90-lat)*Math.PI/180,theta=(lon+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));}
    var landmarkMats={
      stone:new THREE.MeshPhongMaterial({color:0xc7d0cc,specular:0x445a61,shininess:36}),
      pale:new THREE.MeshPhongMaterial({color:0xe8ddd0,specular:0x80949a,shininess:52}),
      bronze:new THREE.MeshPhongMaterial({color:0x9e7650,specular:0xd8af73,shininess:70}),
      steel:new THREE.MeshPhongMaterial({color:0x718c97,specular:0xd9ffff,shininess:92}),
      glass:new THREE.MeshPhongMaterial({color:0x32808e,emissive:0x082f36,specular:0xc9ffff,shininess:110,transparent:true,opacity:.9}),
      dark:new THREE.MeshPhongMaterial({color:0x17262b,specular:0x7feadd,shininess:76}),
      gold:new THREE.MeshPhongMaterial({color:0xd3a83c,emissive:0x2d1900,specular:0xffe7a3,shininess:105}),
      green:new THREE.MeshPhongMaterial({color:0x537f69,specular:0xa5d0bd,shininess:42}),
      vermillion:new THREE.MeshPhongMaterial({color:0xb5432f,specular:0xff9a7a,shininess:60}),
      marble:new THREE.MeshPhongMaterial({color:0xe9e4d8,specular:0xffffff,shininess:48}),
      rust:new THREE.MeshPhongMaterial({color:0xa8503a,specular:0xd88a63,shininess:55}),
      white:new THREE.MeshPhongMaterial({color:0xf2efe6,specular:0xffffff,shininess:60}),
      terracotta:new THREE.MeshPhongMaterial({color:0xb5654a,specular:0xd89a7a,shininess:40}),
      crimson:new THREE.MeshPhongMaterial({color:0xc0392b,specular:0xff8a70,shininess:55}),
      deepTeal:new THREE.MeshPhongMaterial({color:0x1f6f6b,specular:0x7fd4d0,shininess:70}),
      glow:new THREE.MeshBasicMaterial({color:0x8ff4e8,transparent:true,opacity:.82,depthWrite:false})
    };
    function landmarkModel(type){
      var model=new THREE.Group();
      function add(geometry,material,x,y,z,rx,ry,rz){
        var mesh=new THREE.Mesh(geometry,material||landmarkMats.stone);
        mesh.position.set(x||0,y||0,z||0);mesh.rotation.set(rx||0,ry||0,rz||0);model.add(mesh);return mesh;
      }
      function box(w,h,d,x,y,z,mat){return add(new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
      function cylinder(rt,rb,h,x,y,z,mat,segments){return add(new THREE.CylinderGeometry(rt,rb,h,segments||12),mat,x,y,z);}
      function cone(r,h,x,y,z,mat,segments){return add(new THREE.ConeGeometry(r,h,segments||12),mat,x,y,z);}
      function sphere(r,x,y,z,mat){return add(new THREE.SphereGeometry(r,12,8),mat,x,y,z);}
      function rod(ax,ay,az,bx,by,bz,r,mat){
        var a=new THREE.Vector3(ax,ay,az),b=new THREE.Vector3(bx,by,bz),mid=a.clone().add(b).multiplyScalar(.5),dir=b.clone().sub(a);
        var mesh=add(new THREE.CylinderGeometry(r,r,dir.length(),7),mat,mid.x,mid.y,mid.z);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return mesh;
      }
      var base=cylinder(.46,.5,.12,0,.06,0,landmarkMats.dark,24);
      /* The glowing base ring was removed (2026-10-06 QA #3). */
      if(type==='pyramid'){
        /* Stepped pyramid: five tiers in alternating stone tones + gold capstone */
        var w=.72;
        for(var pi=0;pi<5;pi++){box(w,.13,w,0,.19+pi*.13,0,pi%2?landmarkMats.marble:landmarkMats.pale);w-=.115;}
        box(.09,.09,.09,0,.87,0,landmarkMats.gold);
      }else if(type==='mountain'){
        /* Table Mountain: flat-topped mesa, terracotta strata + tablecloth cloud */
        cylinder(.42,.5,.3,0,.27,0,landmarkMats.stone,9);
        cylinder(.36,.44,.09,0,.44,0,landmarkMats.terracotta,9);
        cylinder(.34,.36,.08,0,.52,0,landmarkMats.stone,9);
        add(new THREE.CylinderGeometry(.4,.44,.07,24),new THREE.MeshBasicMaterial({color:0xe6edef,transparent:true,opacity:.88}),0,.56,0);
      }else if(type==='sails'){
        /* Shell roofs in a rising row on a stepped podium */
        box(.84,.09,.44,0,.165,0,landmarkMats.steel);box(.7,.08,.38,0,.25,0,landmarkMats.pale);
        var sh=[[-.3,.42],[ -.1,.58],[.12,.74],[.32,.58]],si;
        for(si=0;si<sh.length;si++){
          var s=cone(.15,sh[si][1],sh[si][0],.29+sh[si][1]/2,0,si%2?landmarkMats.white:landmarkMats.pale,10);
          s.scale.z=.38;s.rotation.z=-.12;
        }
      }else if(type==='bridge'){
        /* Golden Gate: two art-deco towers, deck, cables + suspenders */
        var bx;
        for(bx=-1;bx<=1;bx+=2){
          box(.07,.82,.1,bx*.27,.62,-.07,landmarkMats.rust);box(.07,.82,.1,bx*.27,.62,.07,landmarkMats.rust);
          box(.09,.07,.24,bx*.27,.9,0,landmarkMats.rust);box(.09,.07,.24,bx*.27,.62,0,landmarkMats.rust);box(.09,.07,.24,bx*.27,.38,0,landmarkMats.rust);
        }
        box(1.02,.06,.24,0,.3,0,landmarkMats.steel);
        rod(-.52,.52,0,-.27,1.02,0,.02,landmarkMats.pale);rod(-.27,1.02,0,.27,1.02,0,.02,landmarkMats.pale);rod(.27,1.02,0,.52,.52,0,.02,landmarkMats.pale);
        var su;
        for(su=-2;su<=2;su++){rod(su*.2,.98,0,su*.2,.33,0,.012,landmarkMats.pale);}
      }else if(type==='star'){
        /* Hollywood star: extruded five-point star */
        var starShape=new THREE.Shape();
        for(var sti=0;sti<10;sti++){
          var ang=sti*Math.PI/5-Math.PI/2,rr=sti%2?.13:.3;
          var px=Math.cos(ang)*rr,py=Math.sin(ang)*rr;
          if(sti)starShape.lineTo(px,py);else starShape.moveTo(px,py);
        }
        starShape.closePath();
        add(new THREE.ExtrudeGeometry(starShape,{depth:.1,bevelEnabled:false}),landmarkMats.gold,0,.5,-.05);
        cylinder(.34,.38,.1,0,.16,0,landmarkMats.dark,5);
      }else if(type==='tower'){
        /* Willis Tower: bundled tubes of varying heights */
        box(.3,.92,.3,-.08,.58,0,landmarkMats.glass);box(.24,.74,.24,.14,.49,.02,landmarkMats.deepTeal);
        box(.2,.58,.2,-.02,.41,-.14,landmarkMats.glass);
        rod(-.08,1.04,0,-.08,1.3,0,.02,landmarkMats.gold);rod(.14,.86,.02,.14,1.12,.02,.015,landmarkMats.steel);
      }else if(type==='needle'||type==='spire'){
        /* CN / N Seoul / Sky Tower: shaft, pod, mast */
        cylinder(.3,.34,.1,0,.17,0,landmarkMats.dark,16);
        cylinder(.055,.11,.8,0,.6,0,landmarkMats.steel,12);
        cylinder(.2,.2,.13,0,.92,0,landmarkMats.pale,16);
        cylinder(.2,.16,.06,0,1.0,0,landmarkMats.glass,16);
        cylinder(.035,.05,.34,0,1.2,0,landmarkMats.steel,8);
        sphere(.035,0,1.39,0,landmarkMats.gold);
        if(type==='spire')cylinder(.15,.15,.03,0,1.06,0,landmarkMats.dark,12);
      }else if(type==='burj'){
        /* Burj Khalifa: tiered stepped spire */
        var bw=.2,by=.22,bi;
        for(bi=0;bi<6;bi++){cylinder(bw*.82,bw,.2,0,by,0,bi%2?landmarkMats.glass:landmarkMats.steel,10);by+=.2;bw*=.8;}
        rod(0,by-.05,0,0,by+.28,0,.018,landmarkMats.gold);
      }else if(type==='pearl'){
        /* Oriental Pearl: three spheres on a shaft */
        cylinder(.3,.34,.1,0,.17,0,landmarkMats.dark,14);
        cylinder(.05,.08,.9,0,.62,0,landmarkMats.steel,10);
        sphere(.19,0,.48,0,landmarkMats.glass);sphere(.13,0,.76,0,landmarkMats.glass);sphere(.09,0,.99,0,landmarkMats.glass);
        rod(0,1.04,0,0,1.26,0,.015,landmarkMats.gold);
      }else if(type==='obelisk'){
        /* Tapered shaft on stepped base, gold orb */
        box(.4,.09,.4,0,.165,0,landmarkMats.pale);box(.3,.09,.3,0,.25,0,landmarkMats.pale);
        cylinder(.09,.14,.8,0,.7,0,landmarkMats.pale,4);
        cone(.09,.12,0,1.16,0,landmarkMats.gold,4);
        sphere(.05,0,1.26,0,landmarkMats.gold);
      }else if(type==='clock'){
        /* Big Ben: tower, clock face with hands, spire */
        box(.3,.1,.3,0,.17,0,landmarkMats.stone);
        box(.24,.8,.24,0,.57,0,landmarkMats.stone);
        box(.3,.2,.3,0,1.02,0,landmarkMats.marble);
        var face=cylinder(.085,.085,.03,0,1.02,.16,landmarkMats.white,20);face.rotation.x=Math.PI/2;
        box(.012,.07,.012,0,1.03,.18,landmarkMats.dark);var hand=box(.012,.05,.012,.02,1.02,.18,landmarkMats.dark);hand.rotation.z=-1.1;
        cone(.17,.3,0,1.27,0,landmarkMats.dark,4);
      }else if(type==='eiffel'){
        /* Eiffel Tower: four arched legs, two platforms, spire */
        var ex,ez;
        for(ex=-1;ex<=1;ex+=2)for(ez=-1;ez<=1;ez+=2)rod(ex*.28,.14,ez*.13,ex*.1,.56,ez*.05,.042,landmarkMats.bronze);
        box(.42,.06,.3,0,.56,0,landmarkMats.dark);
        for(ex=-1;ex<=1;ex+=2)for(ez=-1;ez<=1;ez+=2)rod(ex*.1,.56,ez*.05,ex*.03,.94,0,.03,landmarkMats.bronze);
        box(.2,.05,.17,0,.94,0,landmarkMats.dark);
        rod(0,.94,0,0,1.22,0,.022,landmarkMats.gold);
      }else if(type==='liberty'){
        /* Statue of Liberty: robe, crown spikes, raised torch */
        cylinder(.2,.27,.28,0,.26,0,landmarkMats.stone,12);
        cylinder(.12,.19,.5,0,.62,0,landmarkMats.green,10);
        sphere(.11,0,.95,0,landmarkMats.green);
        var ci;
        for(ci=0;ci<7;ci++){var ca=ci*Math.PI*2/7;cone(.025,.12,Math.cos(ca)*.11,1.06,Math.sin(ca)*.11,landmarkMats.green,6);}
        rod(.1,.78,0,.3,1.12,0,.04,landmarkMats.green);
        cylinder(.045,.045,.12,.32,1.2,0,landmarkMats.gold,8);
        cone(.05,.12,.32,1.32,0,landmarkMats.glow,8);
      }else if(type==='christ'){
        /* Christ the Redeemer on its peak, arms outstretched */
        cone(.32,.3,0,.27,0,landmarkMats.stone,8);
        box(.2,.22,.2,0,.5,0,landmarkMats.stone);
        cylinder(.11,.19,.52,0,.85,0,landmarkMats.pale,10);
        sphere(.1,0,1.16,0,landmarkMats.pale);
        rod(-.36,1.02,0,.36,1.02,0,.055,landmarkMats.pale);
      }else if(type==='mosque'){
        /* Blue Mosque: grand dome, half domes, four minarets */
        box(.62,.28,.46,0,.26,0,landmarkMats.marble);
        var md=sphere(.27,0,.58,0,landmarkMats.marble);md.scale.y=.78;
        cone(.04,.16,0,.82,0,landmarkMats.gold,8);
        var hx,hz;
        for(hx=-1;hx<=1;hx+=2)for(hz=-1;hz<=1;hz+=2){var hd=sphere(.13,hx*.2,.42,hz*.15,landmarkMats.marble);hd.scale.y=.7;}
        var mx,mz;
        for(mx=-1;mx<=1;mx+=2)for(mz=-1;mz<=1;mz+=2){
          cylinder(.032,.042,.85,mx*.4,.6,mz*.3,landmarkMats.marble,8);
          cylinder(.05,.05,.04,mx*.4,.82,mz*.3,landmarkMats.marble,8);
          cone(.05,.14,mx*.4,1.1,mz*.3,landmarkMats.marble,8);
        }
      }else if(type==='domes'){
        /* Saint Basil's: clustered onion domes */
        box(.58,.3,.44,0,.27,0,landmarkMats.marble);
        cylinder(.13,.15,.3,0,.55,0,landmarkMats.marble,12);
        var od=sphere(.17,0,.82,0,landmarkMats.gold);od.scale.y=1.35;cone(.04,.14,0,1.1,0,landmarkMats.gold,8);
        var dm=[[-.2,-.12,'green'],[.2,-.12,'bronze'],[-.2,.12,'bronze'],[.2,.12,'green']],di;
        for(di=0;di<dm.length;di++){
          cylinder(.08,.09,.2,dm[di][0],.5,dm[di][1],landmarkMats.marble,10);
          var so=sphere(.11,dm[di][0],.68,dm[di][1],landmarkMats[dm[di][2]]);so.scale.y=1.3;
          cone(.03,.1,dm[di][0],.86,dm[di][1],landmarkMats.gold,8);
        }
      }else if(type==='temple'){
        /* Wat Arun: tall prang with satellite prangs */
        var tw=.17,ty=.2,ti;
        for(ti=0;ti<5;ti++){cylinder(tw*.8,tw,.16,0,ty,0,landmarkMats.pale,10);ty+=.16;tw*=.78;}
        cone(.05,.16,0,ty+.06,0,landmarkMats.gold,8);
        var sx,sz;
        for(sx=-1;sx<=1;sx+=2)for(sz=-1;sz<=1;sz+=2){cylinder(.05,.07,.3,sx*.3,.3,sz*.2,landmarkMats.pale,8);cone(.05,.14,sx*.3,.52,sz*.2,landmarkMats.gold,8);}
      }else if(type==='hall'){
        /* Temple of Heaven: triple-eaved round hall */
        cylinder(.42,.46,.09,0,.165,0,landmarkMats.marble,20);
        cylinder(.36,.4,.08,0,.24,0,landmarkMats.marble,20);
        var hi;
        for(hi=0;hi<8;hi++){var ha=hi*Math.PI/4;cylinder(.03,.03,.22,Math.cos(ha)*.28,.4,Math.sin(ha)*.28,landmarkMats.bronze,6);}
        cone(.4,.17,0,.55,0,landmarkMats.bronze,16);
        cone(.28,.15,0,.7,0,landmarkMats.bronze,14);
        cone(.16,.13,0,.83,0,landmarkMats.bronze,12);
        sphere(.05,0,.93,0,landmarkMats.gold);
      }else if(type==='colosseum'){
        /* Elliptical tiers */
        var c1=cylinder(.46,.48,.17,0,.2,0,landmarkMats.stone,28);c1.scale.z=.78;
        var c2=cylinder(.4,.43,.17,0,.37,0,landmarkMats.terracotta,28);c2.scale.z=.78;
        var c3=cylinder(.33,.37,.16,0,.53,0,landmarkMats.stone,28);c3.scale.z=.78;
        add(new THREE.CylinderGeometry(.3,.3,.2,24),new THREE.MeshBasicMaterial({color:0x071013}),0,.5,0).scale.z=.78;
      }else if(type==='theatre'){
        cylinder(.46,.5,.4,0,.32,0,landmarkMats.pale,24);
        var td=sphere(.3,0,.55,0,landmarkMats.gold);td.scale.y=.62;
        box(.3,.22,.06,0,.3,.44,landmarkMats.dark);
      }else if(type==='station'){
        /* Flinders Street: long facade, central dome, arched entry */
        box(.88,.36,.34,0,.34,0,landmarkMats.bronze);
        box(.92,.08,.38,0,.55,0,landmarkMats.marble);
        sphere(.16,0,.66,0,landmarkMats.gold);
        box(.2,.26,.06,0,.28,.17,landmarkMats.dark);
        var wf=cylinder(.06,.06,.02,-.28,.42,.18,landmarkMats.white,12);wf.rotation.x=Math.PI/2;
      }else if(type==='gate'){
        /* Brandenburg Gate: six columns, entablature, quadriga */
        var gi;
        for(gi=0;gi<6;gi++)cylinder(.05,.06,.58,-.29+gi*.116,.46,0,landmarkMats.stone,10);
        box(.78,.11,.3,0,.8,0,landmarkMats.stone);
        box(.5,.13,.24,0,.92,0,landmarkMats.bronze);
        box(.14,.07,.1,0,1.02,0,landmarkMats.bronze);
        box(.1,.09,.16,.12,1.06,0,landmarkMats.gold);
      }else if(type==='gateway'){
        /* Gateway of India: grand arch, corner turrets, central dome */
        box(.7,.52,.3,0,.42,0,landmarkMats.pale);
        box(.24,.38,.32,0,.36,0,new THREE.MeshBasicMaterial({color:0x061014}));
        box(.76,.1,.34,0,.72,0,landmarkMats.bronze);
        var gx,gz;
        for(gx=-1;gx<=1;gx+=2)for(gz=-1;gz<=1;gz+=2){
          cylinder(.06,.07,.22,gx*.3,.86,gz*.1,landmarkMats.pale,8);
          sphere(.06,gx*.3,1.0,gz*.1,landmarkMats.bronze);
        }
        sphere(.13,0,.82,0,landmarkMats.bronze);
      }else if(type==='arch'){
        /* India Gate: piers, arch band, attic dome */
        box(.15,.58,.3,-.2,.45,0,landmarkMats.pale);box(.15,.58,.3,.2,.45,0,landmarkMats.pale);
        box(.62,.15,.34,0,.8,0,landmarkMats.pale);
        box(.26,.4,.32,0,.5,0,new THREE.MeshBasicMaterial({color:0x061014}));
        box(.4,.11,.3,0,.93,0,landmarkMats.bronze);
        sphere(.09,0,1.03,0,landmarkMats.bronze);
      }else if(type==='beam'){
        /* MASP: concrete beam on four red pillars, glass hall beneath */
        var px2,pz2;
        for(px2=-1;px2<=1;px2+=2)for(pz2=-1;pz2<=1;pz2+=2)box(.08,.68,.08,px2*.3,.5,pz2*.12,landmarkMats.vermillion);
        box(.76,.17,.36,0,.92,0,landmarkMats.pale);
        box(.42,.3,.22,0,.55,0,landmarkMats.glass);
      }else if(type==='junk'){
        /* Harbour junk: hull, raised prow, masted sails */
        var hull=box(.72,.15,.26,0,.22,0,landmarkMats.bronze);
        var prow=box(.14,.24,.24,.4,.3,0,landmarkMats.bronze);prow.rotation.z=-.5;
        cylinder(.035,.035,.8,-.12,.62,0,landmarkMats.bronze,8);
        cylinder(.035,.035,.66,.22,.55,0,landmarkMats.bronze,8);
        var js1=box(.34,.4,.02,-.12,.72,0,landmarkMats.terracotta);js1.rotation.y=.15;
        var js2=box(.28,.32,.02,.22,.62,0,landmarkMats.terracotta);js2.rotation.y=.15;
      }else if(type==='torii'){
        box(.1,.88,.12,-.3,.57,0,landmarkMats.vermillion);box(.1,.88,.12,.3,.57,0,landmarkMats.vermillion);
        box(.84,.1,.16,0,.91,0,landmarkMats.vermillion);box(1,.08,.14,0,1.05,0,landmarkMats.vermillion);
        box(.12,.14,.14,0,.8,0,landmarkMats.dark);
      }else if(type==='tree'){
        /* Strawberry tree + bronze bear */
        cylinder(.07,.11,.5,0,.37,0,landmarkMats.bronze,10);
        sphere(.36,0,.78,0,landmarkMats.green);sphere(.19,-.24,.66,.05,landmarkMats.green);sphere(.19,.26,.68,-.04,landmarkMats.green);
        sphere(.11,.3,.28,0,landmarkMats.bronze);sphere(.075,.3,.44,0,landmarkMats.bronze);
        sphere(.032,.3,.44,.07,landmarkMats.dark);
        sphere(.028,.26,.5,0,landmarkMats.bronze);sphere(.028,.34,.5,0,landmarkMats.bronze);
      }else if(type==='sun'){
        /* Philippine sun: faceted rays */
        sphere(.3,0,.54,0,landmarkMats.gold);
        for(var sr=0;sr<8;sr++){var sa=sr*Math.PI/4;cone(.05,.22,Math.cos(sa)*.44,.54+Math.sin(sa)*.44,0,landmarkMats.gold,6);}
      }else if(type==='merlion'){
        cylinder(.17,.27,.5,0,.39,0,landmarkMats.pale,12);
        sphere(.23,0,.78,0,landmarkMats.pale);
        cone(.15,.32,.2,.8,0,landmarkMats.pale,8);
        var spout=cylinder(.028,.028,.45,.38,.78,0,landmarkMats.glow,6);spout.rotation.z=Math.PI/2;
      }else {
        box(.5,.64,.38,0,.47,0,landmarkMats.glass);cone(.34,.35,0,.95,0,landmarkMats.gold,8);
      }
      return model;
    }
    /* Free-to-use landmark GLB models (Poly Pizza, CC0/CC-BY — see assets/landmarks/CREDITS.json).
       Loaded on demand when a city is selected so the intro stays fast; the procedural
       miniature shows until the real model arrives, then stays cached on the marker. */
    var LANDMARK_GLB={
      arch:'assets/landmarks/arch.glb',bridge:'assets/landmarks/bridge.glb',
      christ:'assets/landmarks/christ.glb',clock:'assets/landmarks/clock.glb',
      colosseum:'assets/landmarks/colosseum.glb',eiffel:'assets/landmarks/eiffel.glb',
      junk:'assets/landmarks/junk.glb',liberty:'assets/landmarks/liberty.glb',
      needle:'assets/landmarks/needle.glb',obelisk:'assets/landmarks/obelisk.glb',
      pearl:'assets/landmarks/pearl.glb',pyramid:'assets/landmarks/pyramid.glb',
      star:'assets/landmarks/star.glb',sun:'assets/landmarks/sun.glb',
      theatre:'assets/landmarks/theatre.glb',torii:'assets/landmarks/torii.glb'
    };
    /* One landmark type, two different real buildings: Cairo gets the Giza pyramid. */
    var LANDMARK_GLB_CITY={Cairo:'assets/landmarks/pyramid_giza.glb'};
    var LANDMARK_GLB_CREDIT={
      'assets/landmarks/arch.glb':'"Archway" by Poly by Google · CC-BY 3.0',
      'assets/landmarks/bridge.glb':'"Golden Gate Bridge" by Steren Giannini · CC-BY 3.0',
      'assets/landmarks/christ.glb':'"Rio de Janeiro" by Alan Zimmerman · CC-BY 3.0',
      'assets/landmarks/clock.glb':'"BigBen" by Daqian Dong · CC-BY 3.0',
      'assets/landmarks/colosseum.glb':'"Colosseum" by CreativeTrio · CC0 1.0',
      'assets/landmarks/eiffel.glb':'"Eiffel Tower" by Scott Marshall · CC-BY 3.0',
      'assets/landmarks/junk.glb':'"Small Ship" by Quaternius · CC0 1.0',
      'assets/landmarks/liberty.glb':'"Lady Liberty" by Anna M · CC-BY 3.0',
      'assets/landmarks/needle.glb':'"Radio Tower" by Poly by Google · CC-BY 3.0',
      'assets/landmarks/obelisk.glb':'"Fence Pillar" · CC0 1.0',
      'assets/landmarks/pearl.glb':'"Oriental Pearl Tower" by sugamo · CC-BY 3.0',
      'assets/landmarks/pyramid.glb':'"Mayan Temple" by Steve Atkins · CC-BY 3.0',
      'assets/landmarks/pyramid_giza.glb':'"Pyramid" by Poly by Google · CC-BY 3.0',
      'assets/landmarks/star.glb':'"Star" by Poly by Google · CC-BY 3.0',
      'assets/landmarks/sun.glb':'"Sun" by Poly by Google · CC-BY 3.0',
      'assets/landmarks/theatre.glb':'"Greek Temple" by Alexandre Thomas · CC-BY 3.0',
      'assets/landmarks/torii.glb':'"Torii Gate" by Hattie Stroud · CC-BY 3.0'
    };
    var gltfLoader=null,glbCache={},glbPending={};
    function landmarkGLBURL(cityName,type){return LANDMARK_GLB_CITY[cityName]||LANDMARK_GLB[type]||null;}
    function fitLandmarkGLB(scene){
      var box=new THREE.Box3().setFromObject(scene),size=new THREE.Vector3(),center=new THREE.Vector3();
      box.getSize(size);box.getCenter(center);
      var holder=new THREE.Group();
      scene.position.set(-center.x,-box.min.y,-center.z);
      holder.add(scene);
      holder.scale.setScalar(1/Math.max(size.x,size.y,size.z));
      return holder;
    }
    /* The diorama street view is retired; the walkable map builds its own landmark. Kept as no-ops for old call sites. */
    function swapStageLandmark(fitted){}
    function refreshStageLandmark(){}
    function updateModelCredit(marker){
      var el=document.getElementById('city-info-credit');
      if(!el)return;
      var url=marker.userData.glbURL;
      if(url&&marker.userData.glbApplied&&LANDMARK_GLB_CREDIT[url]){
        el.textContent='3D landmark model · '+LANDMARK_GLB_CREDIT[url]+' · via poly.pizza';
        el.style.display='block';
      }else{el.style.display='none';}
    }
    function ensureLandmarkGLB(marker){
      var url=landmarkGLBURL(marker.userData.name,marker.userData.type);
      marker.userData.glbURL=url;
      if(!url||typeof THREE.GLTFLoader==='undefined')return;
      if(marker.userData.glbApplied)return;
      var apply=function(fitted){
        if(marker.userData.glbApplied)return;
        marker.userData.glbApplied=true;
        /* The globe marker is an HTML pin now (2026-10-06, per Han): the real
           model is only cached for the street-view stage. */
        if(selected===marker)updateModelCredit(marker);
        /* If the street view is already showing this city, swap its landmark too. */
        if(cityPhaseActive&&selected===marker)swapStageLandmark(fitted);
      };
      if(glbCache[url]){apply(glbCache[url]);return;}
      if(glbPending[url]){glbPending[url].push(apply);return;}
      glbPending[url]=[apply];
      var loadFailed=function(reason){
        delete glbPending[url];
        try{ if(window.__espilToast)window.__espilToast('3D landmark failed to load ('+reason+')'); }catch(e){}
        try{
          if(selected&&selected.userData.glbURL===url){
            var el=document.getElementById('city-info-credit');
            if(el){ el.textContent='3D landmark model unavailable ('+reason+') · showing miniature'; el.style.display='block'; }
          }
        }catch(e){}
      };
      try{
        if(!gltfLoader)gltfLoader=new THREE.GLTFLoader();
        gltfLoader.load(url,function(gltf){
          var fitted;
          try{ fitted=fitLandmarkGLB(gltf.scene); }
          catch(e){ loadFailed('fit: '+e.message); return; }
          glbCache[url]=fitted;
          (glbPending[url]||[]).forEach(function(cb){ try{cb(fitted);}catch(e){ loadFailed('apply: '+e.message); } });
          delete glbPending[url];
        },undefined,function(err){ loadFailed((err&&(err.message||err.type))||'network'); });
      }catch(e){ loadFailed(e.message); }
    }
    var cityPhaseActive=false,cityApproachStarted=0;
    var approachSlow=false,infoShown=false;
    /* Staged zoom timers (2026-10-06 QA #3): cleared whenever the selection changes. */
    var zoomStageGen=0; /* smooth-zoom generation: bumping it cancels any running zoom tween */
    function clearZoomStages(){zoomStageGen++;}
    /* Smooth zoom tween (2026-10-06, per Han): ease targetDistance continuously
       instead of jumping between staged distances ("따닥" stutter). */
    function smoothZoomTo(toDist,durMs,labels){
      var gen=++zoomStageGen;
      var fromDist=orbitDistance,startT=performance.now();
      var tick=function(){
        if(gen!==zoomStageGen)return;
        var t=Math.min(1,(performance.now()-startT)/durMs);
        var e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2; /* easeInOutQuad */
        targetDistance=fromDist+(toDist-fromDist)*e;
        if(labels)status.textContent=labels[Math.min(labels.length-1,Math.floor(t*labels.length))];
        if(t<1)requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    /* ENTER CITY now drops into the walkable 3D downtown map (built on demand). */
    function activateCityPhase(){
      if(!selected||cityPhaseActive)return;
      gateSignin(); /* entry sequence done -> gate flow -> walkable map */
    }
    /* Gate flow (production config, Han 2026-10-18): ENTER CITY ->
       the sign-in page at the Dive gate (social buttons disabled,
       ENTER AS GUEST the one active control) -> character check
       (localStorage; none yet -> the male / female choice, confirmed
       by the player, never auto-advanced) -> the glass loader ->
       walkable map. TEST_BYPASS remains only as the QA harness's
       programmatic pass; the visible flow never auto-advances. */
    var TEST_BYPASS=true,GATE_DELAY=2000,chosenGender='male',gateActive=false;
    /* 2026-10-11 (Han QA): hide the landing city-selection readout while the
       entry gates (sign-in / character) are up — it sat above the sign-in modal. */
    function setCityStatusGateHidden(hidden){
      var cs=document.getElementById('city-status');
      if(cs)cs.classList.toggle('gate-hidden',!!hidden);
    }
    function gateSignin(){
      /* Production flow (Han 2026-10-18): the sign-in page was already
         served at the Dive gate (guest button) - do NOT show the modal
         a second time here, and never auto-advance. Straight to the
         character choice. */
      if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
      gateActive=true; /* keep the dive's auto info panel from re-showing during the gates */
      setCityStatusGateHidden(true);
      gateCharacter();
    }
    function gateCharacter(){
      var saved=null;
      try{saved=window.localStorage.getItem('espil_character');}catch(e){}
      if(window.__espilCustMergeGate && window.__espilCustMergeGate()){ return; } /* Han 2026-10-30: character creation is the Character Customizer room's v3 window (embedded by the custmerge module); the pair's basic choice below remains as its fallback */
      /* Place-space arrivals (Han 2026-11-16, DESIGN-v3 §7): the
         visit's identity is the shared session/guest record and the
         character was already chosen there - a place window never
         re-asks. With a saved record, confirm it in place and let
         the entry continue; with none (a first-ever visit through
         an address), the choice below presents as usual. */
      try{
        if(saved&&sessionStorage.getItem('espil_store_space_v1')){
          espilApplyAvatarGender(espilSavedGender());
          confirmCharacter(espilSavedGender());
          return;
        }
      }catch(e){}
      if(saved){ espilApplyAvatarGender(espilSavedGender()); } /* Han 2026-10-30 #2, narrowed by Han 2026-11-17: the saved gender still applies up front, but the screen itself no longer opens for a traveller who already HAS a character - espilGateEnterDirect below decides. When the panel does present (a first setup, a held change ticket, an untrusted saved choice), the saved values come pre-selected and ENTER simply continues. */
      if(espilGateEnterDirect(saved)){ return; }
      espilGateShowPanel();
    }
    /* The gate panel presentation, extracted unchanged from
       gateCharacter (entry re-ask fix, Han 2026-11-17): whether
       the panel presents at all is now decided in
       espilGateEnterDirect; this stays the one place it is
       ever shown. */
    function espilGateShowPanel(){
      var saved=null;
      try{saved=window.localStorage.getItem('espil_character');}catch(e){}
      var panel=document.getElementById('char-custom');
      var note=document.getElementById('char-bypass');
      var csub=panel?panel.querySelector('.char-sub'):null;
      if(csub)csub.textContent=(window.__espilT?window.__espilT('charSub').replace('{city}',espilCityDisplayName()):'Your traveler for '+espilCityDisplayName()+'.');
      setChosen(saved?espilSavedGender():'male');
      espilRenderBodyRow(); /* body selection (Han 2026-11-16): pre-selects the saved choice */
      if(note)note.hidden=true; /* no auto-entry note in the production flow */
      if(panel)panel.setAttribute('aria-hidden','false');
      if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
      /* Production flow (Han 2026-10-18): when the panel DOES
         present, the player CHOOSES male or female and presses
         ENTER - no timed auto-confirm. */
    }
    function setChosen(g){
      chosenGender=g;
      var male=document.getElementById('char-male'),female=document.getElementById('char-female');
      var confirm=document.getElementById('char-confirm'),note=document.getElementById('char-bypass');
      if(male)male.classList.toggle('is-selected',g==='male');
      if(female)female.classList.toggle('is-selected',g==='female');
      if(confirm)confirm.innerHTML=((window.__espilT?window.__espilT(g==='female'?'enterAsFemale':'enterAsMale'):'ENTER AS '+g.toUpperCase())+' &rarr;');
      if(note&&TEST_BYPASS)note.innerHTML='TESTING BYPASS &mdash; entering as <b>'+g.charAt(0).toUpperCase()+g.slice(1)+'</b>&hellip;';
    }
    /* ---- gate body row (Han 2026-11-16) ----
       Rendered into #char-body-row in the gate panel. Guests (in
       chibi mode) pick Style 1-4; signed-in users pick Master or
       Style 1-4. Under the guest-body revert modes there is no
       chibi body anywhere, so the row hides and the saved choice
       is simply preserved. The saved choice is pre-selected on
       every gate opening; changing it needs no re-registration -
       confirmCharacter writes it into the record and
       espilApplyAvatarGender rebuilds the avatar on the spot. */
    var chosenBody=null,bodyRowActive=false,espilGateLocked=false;
    /* ---- character first-setup lock (Han 2026-11-16) ----
       After sign-up the character is set ONCE in this gate;
       afterwards appearance changes go through the store only
       (customizer-once/DESIGN.md). The server record is the
       truth; espil_character.setupDone is its device mirror,
       written only by the entry-flow adoption and by the
       confirm path below - never trusted on its own beyond
       rendering this gate. Guests are outside the rule (§3.5):
       every helper here is a no-op for them. */
    var ESPIL_CHAR_API=(typeof window.__espilAuthApiBase==='string'&&window.__espilAuthApiBase)||'https://api.espil.online';
    function espilCharRecord(){
      try{var s=JSON.parse(window.localStorage.getItem('espil_character')||'null');
        return (s&&typeof s==='object')?s:null;}catch(e){ return null; }
    }
    function espilSetupDone(){
      if(espilGuestNow())return false;
      var r=espilCharRecord();
      return !!(r&&r.setupDone===true);
    }
    function espilBodyName(c){ if(c==='lunaris')return 'Lunaris'; if(c==='neutral')return 'Neutral'; return c==='master'?'Master':'Style '+(c||'style1').slice(-1); }
    /* Change tickets live in the cash ledger (espil_cash_v1).
       This gate renders BEFORE the arrival bundle loads
       cashshop.js, so the count is read from the ledger store
       itself - read-only here. cashshop stays the writer for
       buys; the spend at confirm time goes through __espilCash
       when it exists and through this same store otherwise. */
    function espilBodyChangesHeld(){
      try{var l=JSON.parse(window.localStorage.getItem('espil_cash_v1')||'null');
        var n=l&&l.entitlements?Number(l.entitlements.bodyChanges):0;
        return isFinite(n)&&n>0?Math.floor(n):0;}catch(e){ return 0; }
    }
    function espilSpendBodyChange(){
      if(window.__espilCash&&typeof window.__espilCash.spendEntitlement==='function'){
        return window.__espilCash.spendEntitlement('bodyChanges');
      }
      try{
        var l=JSON.parse(window.localStorage.getItem('espil_cash_v1')||'null');
        if(!l||typeof l!=='object')return false;
        if(!l.entitlements||typeof l.entitlements!=='object')l.entitlements={};
        var n=Number(l.entitlements.bodyChanges)||0;
        if(n<=0)return false;
        l.entitlements.bodyChanges=Math.floor(n)-1;
        if(!Array.isArray(l.txns))l.txns=[];
        l.txns.push({t:Date.now(),type:'spend',cents:0,label:'appearance-change'});
        if(l.txns.length>60)l.txns=l.txns.slice(-60);
        window.localStorage.setItem('espil_cash_v1',JSON.stringify(l));
        return true;
      }catch(e){ return false; }
    }
    function espilCharPost(path,payload){
      if(!window.fetch)return Promise.reject(new Error('no fetch'));
      return fetch(ESPIL_CHAR_API+path,{method:'POST',credentials:'include',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
        .then(function(r){ return r.json().catch(function(){return null;})
          .then(function(b){ return {status:r.status,body:b}; }); });
    }
    function espilCharMirror(character){
      try{
        var r=espilCharRecord()||{};
        r.gender=character.gender; r.bodyChoice=character.bodyChoice; r.setupDone=true;
        delete r.setupPending;
        window.localStorage.setItem('espil_character',JSON.stringify(r));
      }catch(e){}
    }
    function espilCharPending(){
      try{
        var r=espilCharRecord();
        if(r&&r.setupDone!==true){ r.setupPending=true;
          window.localStorage.setItem('espil_character',JSON.stringify(r)); }
      }catch(e){}
    }
    /* The confirm-time server write (design §3.2/§3.4/§4.4):
       a first setup posts /setup; a changed confirm by an
       already-set user spends one change ticket (when held)
       and posts /change. A 409 on setup means the account was
       set up elsewhere: the local edit is discarded, the
       server character is re-adopted and re-applied, and the
       player is told. Failures stay quiet and pending - the
       next session sync re-adopts or retries (§3.4). */
    /* ---- entry re-ask fix (Han 2026-11-17) ----
       A traveller who already HAS a character is not asked
       again at this gate: for a signed-in user the server
       setup record is the standing character (its device
       mirror is espil_character.setupDone, written by the
       entry-flow adoption and by the confirm path), for a
       guest the device record itself. gateCharacter consults
       espilGateEnterDirect first; the panel presents only
       for a first setup, for a held appearance-change ticket
       (customizer-once \u00a72.3, untouched), or when the saved
       record cannot be trusted (an out-of-allowlist choice
       keeps the old drop-and-fallback presentation). */
    function espilGateRecordComplete(rec){
      if(!rec||typeof rec!=='object')return false;
      if(rec.gender!=='male'&&rec.gender!=='female')return false;
      var bc=rec.bodyChoice;
      if(bc==null||bc==='')return true; /* a pre-selection-era record: the designed defaults (espilBodyChoice) apply */
      /* NAME-ONLY ENTRY (Han 2026-11-24): a 'neutral' record is
         complete ONLY for the entrant population - a signed-in
         arrival carrying a stale 'neutral' device record must
         still present the panel and rewrite properly (the
         account allowlist never carries the id). */
      if(bc==='neutral')return espilGuestNow();
      return ESPIL_BODY_CHOICES.indexOf(bc)>=0;
    }
    function espilGateDesignated(){
      /* The owner-designation build (Lunaris) mirrors its mark
         onto the session record; read-only here. In bytes
         without that build the mark never exists and this
         branch never fires. */
      try{ var s=JSON.parse(window.localStorage.getItem('espil_session_v1')||'null');
        return !!(s&&typeof s.designatedBody==='string'&&s.designatedBody); }catch(e){ return false; }
    }
    function espilGateAutoConfirm(){
      var g=espilSavedGender();
      setChosen(g); /* the confirm's default look reads the selected card's gender, exactly as a presented gate would have set it */
      espilApplyAvatarGender(g);
      confirmCharacter(g);
    }
    function espilGateDesignatedEnter(){
      /* The designation IS this account's character record:
         no panel, and no setup/change write of any kind -
         proceed with a confirm's tail, minus the write. */
      espilApplyAvatarGender(espilSavedGender());
      var panel=document.getElementById('char-custom');
      var note=document.getElementById('char-bypass');
      if(note)note.hidden=true;
      if(panel)panel.setAttribute('aria-hidden','true');
      if(window.__espilEntryLocationGate){ window.__espilEntryLocationGate(function(){ enterWalkMap(); }); } else { enterWalkMap(); }
    }
    function espilGateAdoptThenDecide(){
      /* The mirror has not landed on this page yet: the
         account's record may already exist server-side (the
         page-init adoption is still in flight, or this device
         has no record at all). Ask the server once - the same
         /auth/session read both session syncs run - and decide
         from its answer. Any failure, timeout or malformed
         answer presents the panel exactly as before this fix:
         the check can only ever remove a question, never trap
         an entry. */
      var settled=false;
      var present=function(){ if(settled)return; settled=true; espilGateShowPanel(); };
      var timer=setTimeout(present,4000);
      var settle=function(fn){ if(settled)return; settled=true; clearTimeout(timer); fn(); };
      if(!window.fetch){ present(); return; }
      fetch(ESPIL_CHAR_API+'/auth/session',{credentials:'include'}).then(function(r){
        return r.status===200?r.json():null;
      }).then(function(body){
        if(body&&body.signedIn&&body.user){
          settle(function(){
            if(body.character)espilCharMirror(body.character);
            if(body.character||espilGateRecordComplete(espilCharRecord())){
              /* The server record was adopted, or the device
                 record stands as the one-time setup (\u00a75.1) -
                 the auto-confirm's own sync posts it, and a
                 409 there re-adopts instead. */
              espilGateAutoConfirm();
            }else{
              espilGateShowPanel();
            }
          });
        }else if(body){
          /* The server says this arrival is signed out: prune
             the stale local record (the same prune both
             session syncs run) and re-decide as a guest. */
          settle(function(){
            try{ window.localStorage.removeItem('espil_session_v1'); }catch(e){}
            if(espilGateRecordComplete(espilCharRecord()))espilGateAutoConfirm();
            else espilGateShowPanel();
          });
        }else{
          present();
        }
      }).catch(function(){ present(); });
    }
    function espilGateEnterDirect(saved){
      if(espilGateDesignated()){ espilGateDesignatedEnter(); return true; }
      var rec=espilCharRecord();
      if(espilGuestNow()){
        if(saved&&espilGateRecordComplete(rec)){ espilGateAutoConfirm(); return true; }
        return false;
      }
      /* Signed-in: a held appearance-change ticket reopens
         this gate for its one change (\u00a72.3) - untouched, so
         a held ticket always presents the panel. */
      if(espilBodyChangesHeld()>0)return false;
      if(saved&&espilGateRecordComplete(rec)&&espilSetupDone()){ espilGateAutoConfirm(); return true; }
      if(saved&&!espilGateRecordComplete(rec))return false;
      espilGateAdoptThenDecide();
      return true;
    }
    /* I18N GUESTBTN PACKAGE (Han 2026-11-25 14:30): the arrival
       tail joins the house language pattern (ESPIL_AUCK_STR /
       ESPIL_LOGIN_LABEL above and below): the character-gate
       lines, the village boundary messages and the landmark
       panel were hardcoded Korean literals, so they rendered
       Korean in every language - the landmark button is the
       first in-game control a guest meets. Read at call time
       through __espilLang(); Korean values are the exact strings
       that shipped before this package. */
    var ESPIL_TAIL_STR={
      en:{charAlreadySet:'Your character is already set. Entering with your saved character.',lunarisDesignated:'Lunaris · The designated character for this account',bodyLockSuffix:' · Appearance changes are available with an Appearance Change Ticket from the shop',ticketBadge:'{n} Appearance Change Ticket(s) available - changing and confirming uses 1',firstSetupHint:'The first setup is free. Later appearance changes are available at the shop.',villageClosed:'This building is outside the village and cannot be entered. Create an account to roam the whole city.',villageEdge:'This is the edge of the village. Create an account to roam the whole city.',noFood:'You have nothing to eat - you can buy food at a shop in the village',lmButton:'Landmark activities',photoTake:'Take a photo',photoClose:'Close',lmEat:'Eat food',lmSwim:'Swim',swimNotice:'You can enter the water at the edge of the dock',lmBoat:'Ride the boat',boatAutoDeploy:'The boat comes out on its own when you enter the water',lmArena:'Go to the arena',lmLogin:'Have an account? Log in',accountFallback:'Create an account to roam the whole city',lmFish:'Go fishing',fishGuideNotice:'Press Space at the waterside to start fishing'},
      ko:{charAlreadySet:'이미 설정된 캐릭터입니다. 저장된 캐릭터로 들어갑니다.',lunarisDesignated:'Lunaris · 이 계정의 지정 캐릭터입니다',bodyLockSuffix:' · 외형 변경은 상점의 \'외형 변경권\'으로 가능합니다',ticketBadge:'외형 변경권 {n}장 사용 가능 - 변경하고 확인하면 1장이 사용됩니다',firstSetupHint:'첫 설정은 무료입니다. 이후 외형 변경은 상점에서 가능합니다.',villageClosed:'이 건물은 마을 밖에 있어 들어갈 수 없습니다. 계정을 만들면 도시 전체를 다닐 수 있습니다',villageEdge:'마을의 경계입니다. 계정을 만들면 도시 전체를 다닐 수 있습니다',noFood:'먹을 것이 없습니다 - 마을 안 가게에서 음식을 살 수 있습니다',lmButton:'랜드마크 활동',photoTake:'사진 찍기',photoClose:'닫기',lmEat:'음식 먹기',lmSwim:'수영하기',swimNotice:'부두 가장자리에서 물로 들어갈 수 있습니다',lmBoat:'배 타기',boatAutoDeploy:'배는 물에 들어가면 자동으로 나옵니다',lmArena:'아레나 가기',lmLogin:'계정이 있으면 로그인',accountFallback:'계정을 만들면 도시 전체를 다닐 수 있습니다',lmFish:'낚시하기',fishGuideNotice:'물가에서 Space를 누르면 낚시를 시작합니다'},
      fr:{charAlreadySet:'Votre personnage est déjà défini. Entrée avec votre personnage enregistré.',lunarisDesignated:'Lunaris · Le personnage désigné de ce compte',bodyLockSuffix:' · Les changements d\u2019apparence sont possibles avec un ticket de changement d\u2019apparence de la boutique',ticketBadge:'{n} ticket(s) de changement d\u2019apparence disponible(s) - un changement confirmé en utilise 1',firstSetupHint:'La première configuration est gratuite. Les changements d\u2019apparence suivants sont possibles à la boutique.',villageClosed:'Ce bâtiment est hors du village et ne peut pas être ouvert. Créez un compte pour parcourir toute la ville.',villageEdge:'C\u2019est la limite du village. Créez un compte pour parcourir toute la ville.',noFood:'Vous n\u2019avez rien à manger - vous pouvez acheter de la nourriture dans une boutique du village',lmButton:'Activités du lieu',photoTake:'Prendre une photo',photoClose:'Fermer',lmEat:'Manger',lmSwim:'Nager',swimNotice:'Vous pouvez entrer dans l\u2019eau au bord du quai',lmBoat:'Monter dans le bateau',boatAutoDeploy:'Le bateau sort tout seul quand vous entrez dans l\u2019eau',lmArena:'Aller à l\u2019arène',lmLogin:'Vous avez un compte ? Se connecter',accountFallback:'Créez un compte pour parcourir toute la ville',lmFish:'Aller pêcher',fishGuideNotice:'Appuyez sur Espace au bord de l\u2019eau pour commencer à pêcher'},
      zh:{charAlreadySet:'您的角色已设置。将使用已保存的角色进入。',lunarisDesignated:'Lunaris · 此账户的指定角色',bodyLockSuffix:' · 可使用商店的"外形变更券"更改外形',ticketBadge:'有 {n} 张外形变更券可用 - 更改并确认将使用 1 张',firstSetupHint:'首次设置免费。之后可在商店更改外形。',villageClosed:'这座建筑在村庄之外，无法进入。创建账户即可游览整座城市。',villageEdge:'这里是村庄的边界。创建账户即可游览整座城市。',noFood:'没有可吃的东西 - 可以在村庄里的商店买食物',lmButton:'地标活动',photoTake:'拍照',photoClose:'关闭',lmEat:'吃东西',lmSwim:'游泳',swimNotice:'可以从码头边缘下水',lmBoat:'乘船',boatAutoDeploy:'进入水中后，船会自动出现',lmArena:'去竞技场',lmLogin:'已有账户？登录',accountFallback:'创建账户即可游览整座城市',lmFish:'去钓鱼',fishGuideNotice:'在水边按 Space 即可开始钓鱼'}
    };
    function espilTailT(k,vars){ var c='en'; try{ c=window.__espilLang()||'en'; }catch(e){} var l=ESPIL_TAIL_STR[c]||ESPIL_TAIL_STR.en; var s=l[k]||ESPIL_TAIL_STR.en[k]||k; if(vars)for(var key in vars)s=s.split('{'+key+'}').join(vars[key]); return s; }
    function espilCharServerSync(prev,gender,bodyChoice){
      if(espilGuestNow())return;
      /* Owner-only designated body (Han 2026-11-17): the
         designated account makes NO setup/change writes from
         this gate - the server designation is the account's
         body record, and an inert setup row written here would
         only wait to contradict it if the designation were
         ever lifted by a future ship step. */
      if(espilDesignatedBody())return;
      var wasSet=!!(prev&&prev.setupDone===true);
      if(!wasSet){
        espilCharPost('/auth/character/setup',{gender:gender,bodyChoice:bodyChoice}).then(function(res){
          if(res&&res.status===200&&res.body&&res.body.character){
            espilCharMirror(res.body.character);
          }else if(res&&res.status===409&&res.body&&res.body.character){
            espilCharMirror(res.body.character);
            espilApplyAvatarGender(res.body.character.gender);
            if(window.__espilToast)window.__espilToast(espilTailT('charAlreadySet'));
          }else{
            espilCharPending();
          }
        }).catch(function(){ espilCharPending(); });
        return;
      }
      var changed=!prev||prev.gender!==gender||(prev.bodyChoice||null)!==(bodyChoice||null);
      if(!changed)return;
      if(espilBodyChangesHeld()>0)espilSpendBodyChange();
      espilCharPost('/auth/character/change',{gender:gender,bodyChoice:bodyChoice}).then(function(res){
        if(res&&res.status===404){
          /* The server lost the record (a fresh database): run
             the one-time setup again with the same values. */
          espilCharPost('/auth/character/setup',{gender:gender,bodyChoice:bodyChoice}).then(function(r2){
            if(r2&&r2.body&&r2.body.character)espilCharMirror(r2.body.character);
          }).catch(function(){});
        }else if(res&&res.body&&res.body.character){
          espilCharMirror(res.body.character);
        }
      }).catch(function(){});
    }
    function espilRenderBodyRow(){
      var row=document.getElementById('char-body-row');
      if(!row){ bodyRowActive=false; return; }
      if(!document.getElementById('espil-bodychoice-style')){
        var st=document.createElement('style'); st.id='espil-bodychoice-style';
        st.textContent='#char-custom .char-body-label{font:700 .62rem/1.4 Manrope,sans-serif;letter-spacing:.14em;color:#8a6a3b;margin:10px 0 4px;}'
          +'#char-custom .char-body-grid{display:flex;gap:6px;flex-wrap:wrap;}'
          +'#char-custom .char-body-card{flex:1 1 30%;padding:8px 4px;border-radius:10px;border:2px solid #cfa96f;background:linear-gradient(180deg,#fffef8,#ffedcb);color:#5a4020;font:700 12px Manrope,sans-serif;cursor:pointer;}'
          +'#char-custom .char-body-card.is-selected{border-color:#b57708;background:linear-gradient(180deg,#ffe9b8,#ffd98c);box-shadow:0 2px 8px rgba(150,100,20,.35);}'
          +'#char-custom .char-body-lock{padding:8px 10px;border-radius:10px;border:2px dashed #cfa96f;background:rgba(255,244,214,.65);color:#5a4020;font:700 12px Manrope,sans-serif;}'
          +'#char-custom .char-body-note{margin-top:6px;color:#8a6a3b;font:600 11px Manrope,sans-serif;}'
          +'#char-custom .char-body-badge{margin:0 0 6px;padding:6px 10px;border-radius:10px;background:linear-gradient(180deg,#ffe9b8,#ffd98c);border:2px solid #b57708;color:#5a4020;font:700 12px Manrope,sans-serif;}';
        (document.head||document.documentElement).appendChild(st);
      }
      /* Owner-only designated body (Han 2026-11-17): the
         designated account's gate shows the designation as the
         lock line - no body cards and no ticket branch (a
         change ticket cannot change what the server
         designated; the designation supersedes the setup
         record and the ticket path for this account). Rendered
         before the options computation so the presentation is
         the same under every guest-body mode. */
      if(espilDesignatedBody()==='lunaris'){
        espilGateLocked=true;
        bodyRowActive=false; chosenBody=null;
        row.hidden=false;
        row.innerHTML='';
        var dlab=document.createElement('div'); dlab.className='char-body-label'; dlab.textContent='BODY';
        row.appendChild(dlab);
        var dlock=document.createElement('div'); dlock.className='char-body-lock';
        dlock.textContent=espilTailT('lunarisDesignated');
        row.appendChild(dlock);
        return;
      }
      var opts=null;
      if(espilGuestBodyMode()==='chibi'){
        opts=espilGuestNow()?['style1','style2','style3','style4']:ESPIL_BODY_CHOICES;
      }
      if(!opts){ row.hidden=true; row.innerHTML=''; bodyRowActive=false; chosenBody=null; espilGateLocked=false; return; }
      /* First-setup lock (Han 2026-11-16): a signed-in user who
         completed the one-time setup sees the lock line, not the
         cards - unless they hold an appearance change ticket,
         which reopens this one gate session (design §2.3).
         Guests are never locked (§3.5). */
      espilGateLocked=false;
      var setUp=espilSetupDone(), held=espilBodyChangesHeld();
      if(!espilGuestNow()&&setUp&&held<=0){
        espilGateLocked=true;
        bodyRowActive=false; chosenBody=null;
        row.hidden=false;
        row.innerHTML='';
        var llab=document.createElement('div'); llab.className='char-body-label'; llab.textContent='BODY';
        row.appendChild(llab);
        var lockEl=document.createElement('div'); lockEl.className='char-body-lock';
        lockEl.textContent=espilBodyName(espilBodyChoice())+espilTailT('bodyLockSuffix');
        row.appendChild(lockEl);
        return;
      }
      if(!chosenBody||opts.indexOf(chosenBody)<0)chosenBody=espilBodyChoice();
      if(opts.indexOf(chosenBody)<0)chosenBody=opts[0];
      bodyRowActive=true;
      row.hidden=false;
      row.innerHTML='';
      var lab=document.createElement('div'); lab.className='char-body-label'; lab.textContent='BODY';
      row.appendChild(lab);
      if(!espilGuestNow()&&setUp&&held>0){
        var badge=document.createElement('div'); badge.className='char-body-badge';
        badge.textContent=espilTailT('ticketBadge',{n:held});
        row.appendChild(badge);
      }
      var grid=document.createElement('div'); grid.className='char-body-grid';
      opts.forEach(function(o){
        var b=document.createElement('button');
        b.type='button';
        b.className='char-body-card'+(o===chosenBody?' is-selected':'');
        b.setAttribute('data-body',o);
        b.setAttribute('aria-pressed',o===chosenBody?'true':'false');
        b.textContent=(o==='master')?'Master':'Style '+o.slice(-1);
        b.addEventListener('click',function(){ chosenBody=o; espilRenderBodyRow(); if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick(); });
        grid.appendChild(b);
      });
      row.appendChild(grid);
      if(!espilGuestNow()&&!setUp){
        var hint=document.createElement('div'); hint.className='char-body-note';
        hint.textContent=espilTailT('firstSetupHint');
        row.appendChild(hint);
      }
    }
    /* Gate re-render on session sync (2026-11-18, Lunaris
       defect 1): gateCharacter renders the BODY row once at
       panel open, from whatever the session record holds at
       that moment. entry-flow's serverSessionSync can land
       AFTER the panel opened (the sync is a fetch; the panel
       opens on the entry path's own timing), and the row then
       kept the pre-sync snapshot for the whole gate session -
       the designated owner was shown five editable cards and
       no lock line even though the record already carried the
       designation by the time the map built the Lunaris body.
       entry-flow dispatches 'espil-session-sync' after every
       sync write; while the panel is open, re-render the row
       from the fresh record. The render is idempotent and
       preserves chosenBody, so a non-designated account's row
       comes out exactly as the open-time render left it. */
    window.addEventListener('espil-session-sync',function(){
      var panel=document.getElementById('char-custom');
      if(panel&&panel.getAttribute('aria-hidden')==='false')espilRenderBodyRow();
    });
    function confirmCharacter(gender){
      var __prev=espilCharRecord(); /* first-setup lock: the pre-write record decides setup vs change below */
      try{var __rec={gender:gender,ts:Date.now()}; try{var __lk=window.__espilPendingLook?window.__espilPendingLook():null; if(__lk)__rec.look=__lk;}catch(_){} var __bc=(bodyRowActive&&chosenBody)?chosenBody:espilBodyChoiceSaved(); if(__bc)__rec.bodyChoice=__bc; if(__prev&&__prev.setupDone===true)__rec.setupDone=true; if(__prev&&__prev.setupPending===true)__rec.setupPending=true; window.localStorage.setItem('espil_character',JSON.stringify(__rec));}catch(e){} /* customizer look rides the character record (Han 2026-10-28); bodyChoice rides it the same way (Han 2026-11-16); the setup mirror flags ride it too so a confirm never erases them (Han 2026-11-16) */
      espilApplyAvatarGender(gender); /* the preload may have built the other gender's avatar before this first-time pick */
      try{ espilCharServerSync(__prev,gender,(typeof __bc==='string'&&__bc)?__bc:espilBodyChoice()); }catch(e){} /* first-setup / ticketed-change server write; guests no-op inside */
      var panel=document.getElementById('char-custom');
      var note=document.getElementById('char-bypass');
      if(note)note.hidden=true;
      if(panel)panel.setAttribute('aria-hidden','true');
      if(window.__espilEntryLocationGate){ window.__espilEntryLocationGate(function(){ enterWalkMap(); }); } else { enterWalkMap(); } /* Han 2026-10-28: the location pick sits between gender and the loading sequence */
    }
    /* Notice panel content (Han 2026-10-19, from the git record,
       wording by the COO): to update the notice, edit these arrays
       only - the panel renders from them at boot. */
    var ESPIL_NOTICE_CONTENT={
      announce:[
        'Espil Online is currently open to everyone with guest entry. The account system (Google login) is in preparation.',
        'Open cities: Vancouver and Auckland. Tokyo is built and awaiting its opening, and New York is in production.',
        'You can choose a male or female character, and customize your look: skin tone, hair style and colour, and outfit colour.'
      ],
      updates:[
        {d:'2026-10-18',t:'Launch configuration: Espil Online opened with guest-only entry, and Vancouver opened as the first city.'},
        {d:'2026-10-18',t:'Female avatar: the female character and her 14 dedicated animations are in.'},
        {d:'2026-10-18',t:'First-summon place changed: on your first entry you now arrive at the plaza in front of the Vancouver Art Gallery.'},
        {d:'2026-10-18',t:'Auckland opened: Auckland (Queen Street) opened as the second city.'},
        {d:'2026-10-17',t:'Map engine switch: the world was rebuilt on Mapbox maps, with record-based collision where the building you see is its wall and roof, building climbing, and camera-centred framing.'},
        {d:'2026-10-16',t:'Glass loader: the loading screen was standardized to the glass loader, which shows progress as rising liquid with no percentage and no status text.'},
        {d:'2026-10-14',t:'Place search improved: in-city place search now goes through the server and is more stable.'},
        {d:'2026-10-11',t:'Initial build: the character model set, chat window, status HUD and minimap were put in place.'}
      ],
      planned:[
        'Tokyo opening, and New York, Paris and London in production',
        'Google login (account system)',
        'Stalls: a personal shop opened with the Y key, for trading items and services between players',
        'World curvature (curve 1400): the terrain bend that forms with the Dive transition'
      ],
      issues:[
        'Known issue: on a slow connection, the female character walk and run animations can attach late. A file-lightening fix is in progress.',
        'Known issue: the first loading can feel long. Loading-structure improvements are in progress.',
        'Bug reports: email han@espil.online (please put [Bug] in the subject), or DM Instagram @espil_online.',
        'Helpful to include: the city name and location, what you were doing when it happened, and a screenshot if you can.'
      ]
    };
    (function wireNoticePanel(){
      function fill(id,items,withDate){
        var ul=document.getElementById(id); if(!ul)return;
        ul.innerHTML='';
        items.forEach(function(it){
          var li=document.createElement('li');
          if(withDate){ var s=document.createElement('span'); s.className='notice-date'; s.textContent=it.d+' - '; li.appendChild(s); li.appendChild(document.createTextNode(it.t)); }
          else li.textContent=it;
          ul.appendChild(li);
        });
      }
      fill('notice-announce',ESPIL_NOTICE_CONTENT.announce,false);
      fill('notice-updates',ESPIL_NOTICE_CONTENT.updates,true);
      fill('notice-planned',ESPIL_NOTICE_CONTENT.planned,false);
      fill('notice-issues',ESPIL_NOTICE_CONTENT.issues,false);
      var modal=document.getElementById('notice-modal');
      var openBtn=document.getElementById('notice-open');
      var closeBtn=document.getElementById('notice-close');
      /* Stacking fix (Han 2026-10-19, notice verdict): the markup
         lives inside #earth-frame, whose isolation:isolate makes the
         whole frame one stacking context painted under the
         body-level landing intro (z 60) - no z-index inside the frame
         can ever surface the panel. Move the backdrop to <body> so
         its own layer (z 80) competes at the top level. */
      if(modal&&modal.parentElement!==document.body)document.body.appendChild(modal);
      /* Tabs (Han 2026-10-19): one section pane at a time. */
      var ntabs=modal?modal.querySelectorAll('.notice-tab'):[];
      var npanes=modal?modal.querySelectorAll('.notice-pane'):[];
      function selectNoticeTab(key){
        ntabs.forEach(function(t){ var on=t.getAttribute('data-ntab')===key; t.classList.toggle('on',on); t.setAttribute('aria-selected',on?'true':'false'); });
        npanes.forEach(function(p){ p.classList.toggle('on',p.getAttribute('data-npane')===key); });
        if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
      }
      ntabs.forEach(function(t){ t.addEventListener('click',function(){ selectNoticeTab(t.getAttribute('data-ntab')); }); });
      /* While the panel is up, city selection is blocked (Han
         2026-10-19 PC verdict): selectCity and the arrow-key stepper
         read this flag and refuse. */
      window.__espilNoticeOpen=false;
      function open(){ window.__espilNoticeOpen=true; if(modal)modal.setAttribute('aria-hidden','false'); if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop(); }
      function close(){ window.__espilNoticeOpen=false; if(modal)modal.setAttribute('aria-hidden','true'); }
      if(openBtn)openBtn.addEventListener('click',open);
      if(closeBtn)closeBtn.addEventListener('click',close);
      if(modal)modal.addEventListener('click',function(e){ if(e.target===modal)close(); });
      document.addEventListener('keydown',function(e){ if(e.key==='Escape')close(); });
    })();
    (function wireCharCustom(){
      var male=document.getElementById('char-male');
      var female=document.getElementById('char-female');
      var confirm=document.getElementById('char-confirm');
      var back=document.getElementById('char-back');
      if(male)male.addEventListener('click',function(){if(espilGateLocked)return; /* first-setup lock: the saved gender card is display-only (Han 2026-11-16) */ setChosen('male');if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();});
      if(female)female.addEventListener('click',function(){if(espilGateLocked)return; setChosen('female');if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();});
      if(confirm)confirm.addEventListener('click',function(){confirmCharacter(chosenGender);});
      if(back)back.addEventListener('click',function(){
        var panel=document.getElementById('char-custom');
        var note=document.getElementById('char-bypass');
        if(note)note.hidden=true;
        if(panel)panel.setAttribute('aria-hidden','true');
        gateActive=false;
        if(selected)showCityInfo(selected);
      });
    }());
    /* ================================================================
       Walkable 3D downtown map — Vancouver Downtown (single city).
       Google Earth / Apple Maps 3D look, small scale: a downtown grid
       with real building obstacles, a placeholder walker avatar, jump +
       double jump, and a third-person follow camera. Keyboard (arrow keys
       move, Shift jump, Space interact, Ctrl sprint toggle, QWERASDF skills)
       and touch (stick + drag + JUMP button) parity.
       The avatar is a placeholder: Han's finished character model drops
       into `buildWalkerAvatar()` when the pipeline delivers it.
       ================================================================ */
    var mapScene=null,mapCamera=null,mapBuilt=false;
    var WATER_Z=-100, WATER_Y=.25; /* swim boundary (QA #17) */
    var carColliders=[]; /* hoisted from buildWalkMapOnce (2026-10-08): read by collideCircleAxis/updateWalkMap; stays declared, permanently empty - the traffic-car sprites that fed it were removed (Han 2026-11-04, item 2) and the dead traffic-car declarations went with the last stub on 2026-11-05 (Han: cars still visible) */
    /* 5km city (Han 2026-10-07): water bodies at scale.
       - Downtown harbor + Burrard Inlet: z < -100 (entire north)
       - English Bay: x < -2500 (west side)
       Global helper — used by updateWalkMap AND the chunk generator. */
    function isWaterAt(x,z){
      /* The prebuilt collision map is the water authority where it
         covers (Han 2026-10-16); legacy rectangles are the fallback
         outside the stored grid only. */
      if(window.__espilCollisionProbe){
        var pr=window.__espilCollisionProbe(x,z);
        if(pr){
          if(pr.cls==='water'||pr.swimmable)return true;
          /* Shoreline forgiveness (batch 6 #4): the grid cell is
             2 m - at a seawall the visible water can start inside
             the neighbouring cell while the centre cell still
             reads land, which is where swimming silently died.
             Half a body over the water counts as in it. */
          var offs=[[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]];
          for(var oi=0;oi<4;oi++){ var q=window.__espilCollisionProbe(x+offs[oi][0],z+offs[oi][1]); if(q&&(q.cls==='water'||q.swimmable))return true; }
          return false;
        }
      }
      /* Real OSM water positions (Han 2026-10-10 rebuild) */
      if(z<-4350&&x>-1392&&x<561)return true; /* Burrard Inlet */
      if(x<-2000)return true; /* English Bay / Strait of Georgia */
      if(x>-1500&&x<400&&z>100&&z<1700)return true; /* False Creek */
      return false;
    }
    var walkPlayer=null,walkColliders=[];
    var walkKeys={};
    var walkCamYaw=0,walkCamPitch=.84,walkCamDist=5.5; /* Cauldron style: 48° pitch; default follow distance 5.5 m (Han 2026-11-23 tuning verdict - screen too far: back to his 2026-11-09 proportion default; the 7.0 m zoom-out of 2026-11-10, and the 6.2 m, 2.95 m and 14 m defaults before it, are all superseded) */
    /* QA #15 (2026-10-06): sprint is a Ctrl toggle, not hold-Shift. */
    var sprintOn=false;
    function updateSprintUI(){
      var el=document.getElementById('sprint-indicator');
      if(el)el.classList.toggle('active',sprintOn);
      var btn=document.getElementById('sprint-toggle');
      if(btn)btn.classList.toggle('active',sprintOn);
    }
    /* Building registry + proximity name lookup (Han 2026-10-05).
       Stylized grid mapped to real downtown Vancouver lat/lng (1 unit = 1m).
       Google Places API (New) for place names; OSM Overpass as fallback.
       NOTE: API key is in-page for LOCAL TESTING only. Production must use
       a backend proxy + server-side caching (per business model: fetch once,
       never live-query per user). */
    var GOOGLE_PLACES_KEY='__PUT_YOUR_KEY_HERE__'; var PLACES_PROXY=/^(www\.)?espil\.online$/.test(location.hostname); /* 2026-10-14: on the live site the key stays server-side (Vercel env) — Places goes through /api/places-* proxies */ if(PLACES_PROXY)GOOGLE_PLACES_KEY='proxy'; /* 2026-10-13: real key comes from gitignored .env (GOOGLE_PLACES_KEY=...), filled in when the .env load finishes; git pull never clobbers it */
(window.__ESPIL_ENV_READY__||Promise.resolve()).then(function(){var e=window.__ESPIL_ENV__;if(e&&e.GOOGLE_PLACES_KEY&&!PLACES_PROXY)GOOGLE_PLACES_KEY=e.GOOGLE_PLACES_KEY;});
    var mapBuildings=[]; /* {x,z,w,d,name} — populated by buildWalkMapOnce */
    /* Building ID system (2026-10-14, re-applied after the shared-copy
       overwrite — recovery #1): stable IDs so UI/store flows can reference
       a building directly instead of by proximity/coords.
       OSM buildings: 'osm:{chunkKey}:{indexInChunk}' (deterministic, stable
       across sessions — the buildOsmCity and generateChunk registrations
       converge on the same ID). Downtown core: 'core:{n}' (session-scoped;
       the core layout is procedural). */
    var buildingIdIndex={}; /* id -> building record (same object as in mapBuildings) */
    function getBuildingById(id){return buildingIdIndex[id]||null;}
    var coreBldgSeq=0;
    var MAP_LAT0=49.2827,MAP_LNG0=-123.1207;
    function mapToLatLng(x,z){
      return {
        lat:MAP_LAT0+(-z)/111320,
        lng:MAP_LNG0+x/(111320*Math.cos(MAP_LAT0*Math.PI/180))
      };
    }
    var bldgNameCache={};
    /* Building-name rule (Han 2026-10-27): the label is the BUILDING's
       own name, never a store inside it. The baked open-data record
       classifies the same way at build time - building-scale places
       name the building; shops, food and services are tenants (kept
       as b.stores, listed inside by the store modal). No building
       name -> the street address. */
    var ESPIL_BUILDING_TYPES={hotel:1,motel:1,hostel:1,resort_hotel:1,apartment_building:1,apartment_complex:1,condominium_complex:1,office:1,corporate_office:1,coworking_space:1,shopping_mall:1,train_station:1,subway_station:1,transit_station:1,bus_station:1,airport:1,hospital:1,medical_center:1,school:1,university:1,library:1,museum:1,city_hall:1,courthouse:1,embassy:1,post_office:1,church:1,mosque:1,synagogue:1,hindu_temple:1,place_of_worship:1,stadium:1,arena:1,convention_center:1,movie_theater:1,performing_arts_theater:1,concert_hall:1,casino:1,parking:1,marina:1};
    var ESPIL_TENANT_TYPES={cafe:1,coffee_shop:1,bakery:1,bar:1,pub:1,wine_bar:1,juice_bar:1,tea_house:1,food_court:1,meal_takeaway:1,meal_delivery:1,bank:1,atm:1,hair_salon:1,barber_shop:1,beauty_salon:1,nail_salon:1,spa:1,massage:1,gym:1,fitness_center:1,pharmacy:1,dentist:1,doctor:1,clinic:1,physiotherapist:1,chiropractor:1,lawyer:1,accounting:1,real_estate_agency:1,insurance_agency:1,travel_agency:1,laundry:1,car_repair:1,car_wash:1,car_rental:1,gas_station:1,veterinary_care:1,florist:1,locksmith:1,moving_company:1,storage:1,funeral_home:1,market:1,department_store:1,discount_store:1,wholesaler:1,night_club:1,brewery:1,winery:1,distillery:1,tattoo_shop:1,pawn_shop:1};
    function espilIsTenantType(t){
      if(!t)return false;
      if(ESPIL_TENANT_TYPES[t])return true;
      return /(^|_)restaurant$/.test(t)||/(^|_)store$/.test(t)||/(^|_)shop$/.test(t);
    }
    function espilShortAddress(fa){
      if(!fa)return '';
      var parts=String(fa).split(',');
      for(var i=0;i<parts.length;i++){var s=parts[i].trim();if(/^[0-9]+ /.test(s))return s;}
      return '';
    }
    function fetchBuildingName(b,cb){
      if(b.name){cb(b.name);return;}
      var ll=mapToLatLng(b.x,b.z);
      /* Map room building ID (2026-10-14): identification by b.id, not coordinates.
         Coordinates are still used for the Places query itself.
         (Re-applied 2026-10-14 after the working-copy overwrite.) */
      var key=b.id?('bldg:'+b.id):(ll.lat.toFixed(4)+','+ll.lng.toFixed(4));
      if(bldgNameCache[key]){b.name=bldgNameCache[key];cb(b.name);return;}
      /* Building data (Han 2026-10-29): names and stores come from
         the baked open-data file (Overture Maps Places +
         OpenStreetMap, joined per building at build time) - no
         Google Places, no runtime API cost. The live OSM lookup
         stays as the fallback for buildings the bake misses. */
      if(window.__espilBakedFor){
        window.__espilBakedFor(b).then(function(bp){
          if(bp){
            if(bp.stores&&bp.stores.length)b.stores=bp.stores;
            var bn=bp.name||bp.addr;
            if(bn){bldgNameCache[key]=bn;b.name=bn;cb(bn);return;}
          }
          fetchBuildingNameOSM(b,cb);
        });
        return;
      }
      fetchBuildingNameOSM(b,cb);
    }
    function fetchBuildingNameOSM(b,cb){
      var ll=mapToLatLng(b.x,b.z);
      var key=ll.lat.toFixed(4)+','+ll.lng.toFixed(4);
      /* The building itself: a building-tagged way at the point. Its
         name wins; with no name, its street address. Shop and amenity
         names are tenants and never become the label. */
      var q='[out:json][timeout:10];way(around:25,'+ll.lat.toFixed(5)+','+ll.lng.toFixed(5)+')["building"];out 5;';
      fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q))
        .then(function(r){return r.json();})
        .then(function(j){
          var els=j.elements||[],nm='';
          for(var i=0;i<els.length;i++){var tg=els[i].tags||{};if(tg.name){nm=tg.name;break;}}
          if(!nm)for(var k=0;k<els.length;k++){var t2=els[k].tags||{};if(t2['addr:housenumber']&&t2['addr:street']){nm=t2['addr:housenumber']+' '+t2['addr:street'];break;}}
          if(!nm)nm='Downtown Vancouver';
          bldgNameCache[key]=nm;b.name=nm;cb(nm);
        })
        .catch(function(){cb('Downtown Vancouver');});
    }
    var nearBldg=null,nearCheckT=0;
    /* Interact range (Han PC verdict 2026-10-19 #7): the SPACE prompt
       and the interact itself are live only when the player is AT a
       building - within 2 m of a record footprint (the same polygons
       that draw and collide). The old rule (within 14 m of a building
       CENTRE, footprint half-size deducted) lit the prompt across
       whole blocks. Returns the nearest footprint distance (signed). */
    function espilRecordDistAt(px,pz){
      var pb=espilPolyBucketAt(px,pz);
      if(!pb)return 1e9;
      var best=1e9;
      for(var i=0;i<pb.length;i++){
        var d=espilPolyProbe(pb[i],px,pz).d;
        if(d<best)best=d;
      }
      return best;
    }
    /* ============ STORE NAME LABELS (Han 2026-11-06, built 2026-11-07) ============
       Names float ON the building in-world (projected divs), NOT on a
       top-of-screen display: the old #building-name pill is retired -
       nothing in this module shows or writes it anymore (the modal
       open/close handlers no longer restore it either).
       Rules:
       - A label renders only for a district record whose baked
         open-data entry carries a displayable name (building name,
         else its street address - the same resolution the building
         panel uses). A record with neither gets NO label at all:
         no name, no label (the blank-pill defect class ends here).
         Tenant store names never become the label (Han 2026-10-27).
       - Name data resolves lazily for records whose footprint is
         within ESPIL_LABEL_RADIUS (35 m, signed ring distance),
         but a label is PRESENTED only inside the Use range
         (fix batch 8 item 6, Han 2026-11-14 - the last bullet).
       - The label floats at ESPIL_LABEL_HEAD_H (2.2 m - about the
         approaching character's head height) above the record's
         ground anchor, in a colour-highlighted logwood div.
       - The anchor (the ground point UNDER the label) is the
         storefront point: the closest point on the record's ring to
         its own centre (the main facade) - the ring point itself,
         ON the wall face (fix batch 8 item 6: the batch-4 build
         pushed it 0.6 m outward off the wall; that offset is gone).
       - The Use key's judgment position is that ground anchor: on
         the P1 line Space opens the panel of the record whose
         anchor is within ESPIL_LABEL_INTERACT_R (3.5 m), replacing
         both the old centre rule and the 2 m ring gate.
       Fix batch 8 item 6 (Han 2026-11-14): the name must be fixed
       to the wall at that exact location, keep its pixel size when
       zoomed out, and appear only when the user comes within
       Use-key range - not all names at once. Item 6 therefore
       REPLACES the 35 m presentation radius with the Use range:
       a label is presented iff the player's distance to the wall
       anchor is <= ESPIL_LABEL_SHOW_R, which IS
       ESPIL_LABEL_INTERACT_R (3.5 m) - one number, the same
       predicate that lights the Use prompt (the tick's is-near
       class) and opens the panel. The 35 m radius survives only
       as the lazy name-resolution and entry-glow neighbourhood.
       Pixel size needed no change: the label is a screen-space
       div (font 12.5 px; no scale anywhere in its style or in the
       tick) - measured 24 px rendered height at camera distances
       2.28 / 4.96 / 19.54 m, before and after this change.
       Wall-fixed is structural: the tick projects the fixed world
       anchor (the wall point, at head height) through the map
       camera every frame; the label itself never moves in screen
       space, so it cannot drift or slide off the wall. */
    var ESPIL_LABEL_RADIUS=35, ESPIL_LABEL_HEAD_H=2.2, ESPIL_LABEL_INTERACT_R=3.5, ESPIL_LABEL_MAX=12;
    var ESPIL_LABEL_SHOW_R=ESPIL_LABEL_INTERACT_R; /* item 6: the presentation range IS the Use range - one number */
    var espilLabelLayer=null, espilLabelEntries=[], espilLabelPool=[], espilLabelNear=null;
    function espilLabelAnchor(rec){
      if(rec._espilAnchor)return rec._espilAnchor;
      var pr=espilPolyProbe(rec,rec.cx,rec.cz);
      rec._espilAnchor={x:pr.cx, z:pr.cz}; /* item 6: ON the wall face - no outward offset */
      return rec._espilAnchor;
    }
    function espilCollectRecsNear(px,pz,r){
      var out=[], stamp=espilCollectRecsNear._s=(espilCollectRecsNear._s||0)+1;
      var bx0=Math.floor((px-r-2)/ESPIL_POLY_CELL), bx1=Math.floor((px+r+2)/ESPIL_POLY_CELL);
      var bz0=Math.floor((pz-r-2)/ESPIL_POLY_CELL), bz1=Math.floor((pz+r+2)/ESPIL_POLY_CELL);
      for(var bx=bx0;bx<=bx1;bx++)for(var bz=bz0;bz<=bz1;bz++){
        var arr=espilPolyHash&&(espilPolyHash[bx+','+bz]);
        if(!arr)continue;
        for(var i=0;i<arr.length;i++){
          var rec=arr[i];
          if(rec._espilSeen===stamp)continue;
          rec._espilSeen=stamp; out.push(rec);
        }
      }
      return out;
    }
    function espilNearestLabelAnchor(px,pz){
      if(!espilPolyHash)return null;
      var recs=espilCollectRecsNear(px,pz,ESPIL_LABEL_INTERACT_R), best=null, bestD=1e9;
      for(var i=0;i<recs.length;i++){
        var a=espilLabelAnchor(recs[i]);
        var d=Math.hypot(px-a.x,pz-a.z);
        if(d<bestD){bestD=d;best={rec:recs[i],d:d,ax:a.x,az:a.z};}
      }
      return (best&&bestD<=ESPIL_LABEL_INTERACT_R)?best:null;
    }
    function espilLabelResolveName(rec){
      if(rec._espilLblName!==undefined||rec._espilLblBusy)return;
      rec._espilLblBusy=true;
      if(typeof window.__espilBakedFor!=='function'){rec._espilLblName=null;rec._espilLblBusy=false;return;}
      window.__espilBakedFor({x:rec.cx,z:rec.cz,w:rec.x1-rec.x0,d:rec.z1-rec.z0}).then(function(bp){
        var nm=(bp&&(bp.name||bp.addr))?String(bp.name||bp.addr):'';
        rec._espilLblName=nm?nm:null;
        rec._espilLblBusy=false;
      }).catch(function(){ rec._espilLblName=null; rec._espilLblBusy=false; });
    }
    /* STORE ENTRANCE INDICATORS (Han 2026-11-24): for the
       name-entrant population only, a small gold ground disc at the
       anchor of every building record that (a) passes BOTH village
       judgements (footprint centre and baked centre, tested live with
       the shipped espilVillageDist), (b) carries at least one baked
       store (via __espilBakedFor), and (c) is reachable under today's
       anchor judgement - reachability class R-open or R-notch from
       the lazy sidecar assets/osm/<city>_reachability.json, generated
       offline on the shipped collision grid. The marker and the
       restriction read the same source: the live espilVillageActive()
       gate plus espilVillageDist. Accounts see no discs, and a city
       without a sidecar (or without baked data) marks nothing, by
       construction. The disc is the entry glow's radial-gradient
       family at ~9 m, without beams; it carries no name - when the
       record's name label presents (inside the 3.5 m Use range) the
       label IS the indicator and the disc hides. */
    var ESPIL_MARK_CULL=80, ESPIL_MARK_SIZE=9;
    var espilMarkSidecar={status:'idle',recs:null};
    var espilMarkGroup=null, espilMarkPool=[], espilMarkTex=null, espilMarkVisible=[];
    function espilMarkSidecarLoad(){
      if(espilMarkSidecar.status!=='idle')return;
      espilMarkSidecar.status='loading';
      fetch('assets/osm/'+espilCityKey()+'_reachability.json').then(function(r){
        if(!r.ok)throw new Error('no sidecar');
        return r.json();
      }).then(function(doc){
        espilMarkSidecar.recs=(doc&&doc.rec)||{};
        espilMarkSidecar.status='ready';
      }).catch(function(){ espilMarkSidecar.recs={}; espilMarkSidecar.status='absent'; });
    }
    function espilMarkResolve(rec){
      if(rec._espilMark!==undefined||rec._espilMarkBusy)return;
      if(espilMarkSidecar.status==='idle')espilMarkSidecarLoad();
      if(espilMarkSidecar.status!=='ready'&&espilMarkSidecar.status!=='absent')return; /* retry on a later refresh */
      if(typeof window.__espilBakedFor!=='function'){rec._espilMark=null;return;}
      rec._espilMarkBusy=true;
      window.__espilBakedFor({x:rec.cx,z:rec.cz,w:rec.x1-rec.x0,d:rec.z1-rec.z0}).then(function(bp){
        rec._espilMarkBusy=false;
        var out=null;
        try{
          var stores=(bp&&bp.stores)||[];
          if(stores.length&&espilMarkSidecar.recs){
            var m=/^baked:(\d+):/.exec(String(stores[0].id||''));
            var e=m?espilMarkSidecar.recs[m[1]]:null;
            if(e)out={cls:e[0],bx:e[1],bz:e[2]};
          }
        }catch(err){ out=null; }
        rec._espilMark=out;
      }).catch(function(){ rec._espilMarkBusy=false; rec._espilMark=null; });
    }
    function espilMarkMarked(rec){
      if(!espilVillageActive())return false;
      var mk=rec._espilMark;
      if(!mk)return false;
      if(mk.cls!=='o'&&mk.cls!=='n')return false;
      var lm=espilLandmark(); if(!lm)return false;
      if(espilVillageDist(rec.cx,rec.cz)>lm.radius)return false;
      if(espilVillageDist(mk.bx,mk.bz)>lm.radius)return false;
      return true;
    }
    function espilMarkEnsurePool(){
      if(espilMarkGroup)return true;
      var sc=(typeof mapScene!=='undefined'&&mapScene)?mapScene:null;
      if(!sc||typeof THREE==='undefined')return false;
      var cv=document.createElement('canvas'); cv.width=cv.height=128;
      var cx2=cv.getContext('2d');
      var gr=cx2.createRadialGradient(64,64,2,64,64,64);
      gr.addColorStop(0,'rgba(255,236,170,0.9)'); gr.addColorStop(0.4,'rgba(255,205,92,0.35)'); gr.addColorStop(1,'rgba(255,190,60,0)');
      cx2.fillStyle=gr; cx2.fillRect(0,0,128,128);
      espilMarkTex=new THREE.CanvasTexture(cv);
      espilMarkGroup=new THREE.Group();
      sc.add(espilMarkGroup);
      return true;
    }
    function espilMarkDisc(i){
      var m=espilMarkPool[i];
      if(!m){
        m=new THREE.Mesh(new THREE.PlaneGeometry(ESPIL_MARK_SIZE,ESPIL_MARK_SIZE),
          new THREE.MeshBasicMaterial({map:espilMarkTex,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
        m.rotation.x=-Math.PI/2; m.renderOrder=3; m.visible=false;
        espilMarkGroup.add(m); espilMarkPool[i]=m;
      }
      return m;
    }
    function espilStoreMarksRefresh(px,pz,uiOpen,labelEntries){
      var vis=[];
      var on=false;
      try{ on=espilVillageActive(); }catch(e){ on=false; }
      if(on&&espilMarkSidecar.status==='idle')espilMarkSidecarLoad();
      if(on&&!uiOpen&&espilPolyHash&&espilMarkEnsurePool()){
        var recs=espilCollectRecsNear(px,pz,ESPIL_MARK_CULL);
        for(var i=0;i<recs.length;i++){
          var rec=recs[i];
          espilMarkResolve(rec);
          if(!espilMarkMarked(rec))continue;
          var a=espilLabelAnchor(rec);
          var d=Math.hypot(px-a.x,pz-a.z);
          if(d>ESPIL_MARK_CULL)continue;
          var lab=false;
          if(labelEntries)for(var li=0;li<labelEntries.length;li++){ if(labelEntries[li].rec===rec){ lab=true; break; } }
          if(lab)continue; /* the presented name label IS the indicator inside the Use range */
          vis.push({rec:rec,ax:a.x,az:a.z,d:d});
        }
        vis.sort(function(p,q){return p.d-q.d;});
      }
      if(espilMarkGroup){
        var s=0.5+0.5*Math.sin(Date.now()/1400);
        for(var vi=0;vi<vis.length;vi++){
          var m=espilMarkDisc(vi);
          m.position.set(vis[vi].ax,0.25,vis[vi].az);
          m.material.opacity=0.45+0.18*s;
          m.visible=true;
        }
        for(var k=vis.length;k<espilMarkPool.length;k++){ if(espilMarkPool[k])espilMarkPool[k].visible=false; }
      }
      espilMarkVisible=vis;
    }
    window.__espilStoreMarksState=function(){
      var on=false; try{ on=espilVillageActive(); }catch(e){}
      return { gate:on, sidecar:espilMarkSidecar.status, cull:ESPIL_MARK_CULL, size:ESPIL_MARK_SIZE,
        discs:espilMarkVisible.map(function(v){ return {x:+v.ax.toFixed(1),z:+v.az.toFixed(1),d:+v.d.toFixed(1)}; }) };
    };
    function espilLabelLayerGet(){
      if(espilLabelLayer)return espilLabelLayer;
      var st=document.createElement('style');
      st.textContent='#espil-store-labels{position:fixed;inset:0;pointer-events:none;z-index:24;overflow:hidden}'
        +'.espil-store-label{position:absolute;left:0;top:0;transform:translate(-50%,-100%);padding:4px 11px;border-radius:8px;'
        +'background:linear-gradient(180deg,rgba(84,56,31,.93),rgba(36,22,8,.95));border:1.5px solid #a97e46;color:#f5e6c8;'
        +'font:700 12.5px Manrope,"Segoe UI",sans-serif;letter-spacing:.02em;white-space:nowrap;'
        +'box-shadow:0 3px 10px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,224,170,.25);text-shadow:0 1px 2px rgba(0,0,0,.65)}'
        +'.espil-store-label.is-near{border-color:#ffd97a;box-shadow:0 0 14px rgba(255,217,122,.45),0 3px 10px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,224,170,.35)}';
      document.head.appendChild(st);
      espilLabelLayer=document.createElement('div');
      espilLabelLayer.id='espil-store-labels';
      document.body.appendChild(espilLabelLayer);
      return espilLabelLayer;
    }
    function espilStoreLabelsRefresh(px,pz){
      espilLabelNear=espilPolyHash?espilNearestLabelAnchor(px,pz):null;
      var panel=document.getElementById('bldg-panel');
      var sm=document.getElementById('store-modal');
      var uiOpen=(panel&&panel.classList.contains('open'))||(sm&&!sm.classList.contains('hidden'))||!!window.__espilInside;
      var entries=[];
      if(espilPolyHash&&!uiOpen){
        var recs=espilCollectRecsNear(px,pz,ESPIL_LABEL_RADIUS);
        var cands=[];
        for(var i=0;i<recs.length;i++){
          var rec=recs[i];
          var d=espilPolyProbe(rec,px,pz).d; if(d<0)d=0;
          if(d>ESPIL_LABEL_RADIUS)continue;
          espilLabelResolveName(rec);
          if(!rec._espilLblName)continue; /* no displayable name -> no label */
          var a0=espilLabelAnchor(rec);
          var ad=Math.hypot(px-a0.x,pz-a0.z);
          if(ad>ESPIL_LABEL_SHOW_R)continue; /* item 6: present only inside the Use range */
          cands.push({rec:rec,d:d,ad:ad});
        }
        cands.sort(function(a,b){return a.ad-b.ad;});
        var layer=espilLabelLayerGet();
        for(var j=0;j<cands.length&&j<ESPIL_LABEL_MAX;j++){
          var c=cands[j], a=espilLabelAnchor(c.rec);
          var el=espilLabelPool[j];
          if(!el){
            el=document.createElement('div');
            el.className='espil-store-label';
            layer.appendChild(el);
            espilLabelPool[j]=el;
          }
          if(el.textContent!==c.rec._espilLblName)el.textContent=c.rec._espilLblName;
          el.style.display='none'; /* the per-frame tick positions + shows */
          entries.push({rec:c.rec,name:c.rec._espilLblName,ax:a.x,az:a.z,d:c.d,ad:c.ad,el:el});
        }
      }
      for(var k=entries.length;k<espilLabelPool.length;k++){
        if(espilLabelPool[k])espilLabelPool[k].style.display='none';
      }
      espilLabelEntries=entries;
      espilStoreMarksRefresh(px,pz,uiOpen,entries);
    }
    var espilLabelV=null;
    function espilStoreLabelsTick(){
      if(!espilLabelEntries.length)return;
      if(!document.body.classList.contains('in-map')||window.__espilInside||typeof mapCamera==='undefined'||!mapCamera)return;
      var p=(typeof walkPlayer!=='undefined')?walkPlayer:null;
      if(!espilLabelV)espilLabelV=new THREE.Vector3();
      for(var i=0;i<espilLabelEntries.length;i++){
        var e=espilLabelEntries[i];
        var drop=(typeof espilGlobeDrop==='function')?espilGlobeDrop(e.ax,e.az):0;
        espilLabelV.set(e.ax,ESPIL_LABEL_HEAD_H-drop,e.az).project(mapCamera);
        if(espilLabelV.z>1||espilLabelV.z<-1||Math.abs(espilLabelV.x)>1.05||Math.abs(espilLabelV.y)>1.05){e.el.style.display='none';continue;}
        e.el.style.left=((espilLabelV.x*.5+.5)*window.innerWidth)+'px';
        e.el.style.top=((-espilLabelV.y*.5+.5)*window.innerHeight)+'px';
        e.el.style.display='block';
        var near=false;
        if(p&&p.pos)near=Math.hypot(p.pos.x-e.ax,p.pos.z-e.az)<=ESPIL_LABEL_INTERACT_R;
        e.el.classList.toggle('is-near',near);
      }
    }
    window.__espilStoreLabelState=function(){
      return {
        radius:ESPIL_LABEL_RADIUS, headH:ESPIL_LABEL_HEAD_H, interactR:ESPIL_LABEL_INTERACT_R,
        showR:ESPIL_LABEL_SHOW_R, anchorMode:'wall',
        nearAnchor:espilLabelNear?{d:+espilLabelNear.d.toFixed(2),x:+espilLabelNear.ax.toFixed(1),z:+espilLabelNear.az.toFixed(1)}:null,
        labels:espilLabelEntries.map(function(e){
          return {name:e.name,x:+e.ax.toFixed(1),z:+e.az.toFixed(1),d:+e.d.toFixed(1),ad:+e.ad.toFixed(2),visible:e.el.style.display!=='none'};
        })
      };
    };
    function updateBuildingProximity(px,pz,nowMs){
      var interactEl=document.getElementById('interact-prompt');
      if(nowMs-nearCheckT<400)return; /* throttle: 2.5 checks/sec */
      nearCheckT=nowMs;
      var best=null,bestD=1e9;
      for(var i=0;i<mapBuildings.length;i++){
        var b=mapBuildings[i];
        var dx=px-b.x,dz=pz-b.z;
        var d=Math.sqrt(dx*dx+dz*dz)-Math.max(b.w,b.d)/2;
        if(d<bestD){bestD=d;best=b;}
      }
      /* nearBldg is still tracked for the legacy (non-P1) store-modal
         fallback in tryInteract. The top-of-screen name pill it used
         to drive is retired (Han 2026-11-06): names now float on the
         buildings themselves (espilStoreLabelsRefresh below), and
         #building-name is never shown or written again. */
      nearBldg=(best&&bestD<14)?best:null;
      espilStoreLabelsRefresh(px,pz);
      /* Interact prompt: on the P1 line it follows the label-anchor
         gate (the Use judgment position is the ground point under
         the name label); the legacy line keeps the centre rule. */
      if(interactEl&&typeof ESPIL_P1!=='undefined'&&ESPIL_P1){
        var sm2=document.getElementById('store-modal');
        var modalOpen2=sm2&&!sm2.classList.contains('hidden');
        if(!modalOpen2&&espilLabelNear)interactEl.classList.remove('hidden');
        else if(!modalOpen2)interactEl.classList.add('hidden');
      }else if(interactEl){
        var sm=document.getElementById('store-modal');
        var modalOpen=sm&&!sm.classList.contains('hidden');
        if(!modalOpen&&nearBldg)interactEl.classList.remove('hidden');
        else if(!modalOpen)interactEl.classList.add('hidden');
      }
    }
    var mapDragId=null,mapLastX=0,mapLastY=0;
    var MAP_BOUND=15000,PLAYER_R=.55,PLAYER_H=1.9; /* Han 2026-10-10: 15km radius */
    /* 5km city radius (Han 2026-10-07): chunked procedural city extends from
       the detailed downtown core to 5km. Chunk size 250m, deterministic seeds. */
    var CHUNK_SIZE=250,CITY_RADIUS=15000; /* Han 2026-10-10: 15km */
    var chunkMap={}; /* "cx,cz" -> {group, colliders, buildings} */
    var chunkColliders={}; /* "cx,cz" -> collider array (spatial hash) */
    var walkAudioCtx=null;
    /* Tiny-planet curvature (x=50, y=55 — the EverPlanet look): a visual-only vertex-shader
       drop applied to static map geometry, evaluated relative to the player every frame.
       The ground stays flat under the player and curves down toward the horizon.
       Physics, collision and the character stay on the flat plane. */
    /* EverPlanet-style Globe View (Han 2026-10-27, espil.online room):
       the world stays flat for data, physics and collision; the GAME
       VIEW bends at render time only, per the NDC2011 EverPlanet deck
       Han designated - quadratic drop from the pole (the player):
       drop = min(k * d^2, cap), evaluated PER VERTEX in the vertex
       shader from the vertex's own world position, so a wide building
       follows the curve across its whole footprint instead of being
       sampled at its centre (the buried-building fault Han flagged
       on the Zealandia v4.2 build). Avatar models are exempt from
       the shader and are CPU-anchored to the bent ground instead
       (see the remote-avatar tick), so body, nameplate and bubble
       sink together. Sky (ShaderMaterial), sprites, points and
       lines are never patched. k is tunable live through
       window.__espilGlobeView.setK (rigs and Han's look verdict). */
    var ESPIL_GLOBE_K=0.0006, ESPIL_GLOBE_CAP=260;
    var espilGlobeU={pole:{value:new THREE.Vector3(0,0,0)},k:{value:ESPIL_GLOBE_K},cap:{value:ESPIL_GLOBE_CAP}};
    var espilGlobePatched=new WeakSet(), espilGlobePatchedCount=0;
    function espilGlobeDrop(x,z){
      var dx=x-espilGlobeU.pole.value.x, dz=z-espilGlobeU.pole.value.z;
      return Math.min(espilGlobeU.k.value*(dx*dx+dz*dz), espilGlobeU.cap.value);
    }
    function espilGlobePatchMat(m){
      if(!m||espilGlobePatched.has(m))return;
      if(m.isShaderMaterial||m.isSpriteMaterial||m.isPointsMaterial||m.isLineBasicMaterial||m.isShadowMaterial)return;
      if(m.userData&&m.userData.espilAvatarMat)return;
      espilGlobePatched.add(m); espilGlobePatchedCount++;
      var prev=m.onBeforeCompile;
      m.onBeforeCompile=function(shader){
        if(prev)prev.call(this,shader);
        shader.uniforms.uGlobePole=espilGlobeU.pole;
        shader.uniforms.uGlobeK=espilGlobeU.k;
        shader.uniforms.uGlobeCap=espilGlobeU.cap;
        shader.vertexShader=('uniform vec3 uGlobePole;\nuniform float uGlobeK;\nuniform float uGlobeCap;\n')+shader.vertexShader.replace('#include <project_vertex>',
          ['vec4 espilWp = vec4( transformed, 1.0 );',
           '#ifdef USE_INSTANCING',
           'espilWp = instanceMatrix * espilWp;',
           '#endif',
           'espilWp = modelMatrix * espilWp;',
           'vec2 espilGd = espilWp.xz - uGlobePole.xz;',
           'espilWp.y -= min( uGlobeK * dot( espilGd, espilGd ), uGlobeCap );',
           'vec4 mvPosition = viewMatrix * espilWp;',
           'gl_Position = projectionMatrix * mvPosition;'].join('\n'));
      };
      m.needsUpdate=true;
    }
    function espilGlobeSweep(){
      if(typeof mapScene==='undefined'||!mapScene)return;
      mapScene.traverse(function(o){
        if(!o||!o.material)return;
        if(Array.isArray(o.material))o.material.forEach(espilGlobePatchMat);
        else espilGlobePatchMat(o.material);
      });
    }
    setInterval(function(){ if(typeof mapBuilt!=='undefined'&&mapBuilt)espilGlobeSweep(); },800);
    window.__espilGlobeView={
      setK:function(k){ if(typeof k==='number'&&k>=0&&k<=0.01)espilGlobeU.k.value=k; return espilGlobeU.k.value; },
      dropAt:function(x,z){ return espilGlobeDrop(x,z); },
      state:function(){ return {k:espilGlobeU.k.value,cap:espilGlobeU.cap.value,pole:{x:espilGlobeU.pole.value.x,z:espilGlobeU.pole.value.z},patched:espilGlobePatchedCount}; }
    };
    /* Wall-occlusion CUTOUT (Han 2026-11-03): when a building wall
       between the camera and the LOCAL player hides the character,
       the wall's fragments inside a screen-space circle LARGER than
       the character are DISCARDED (cutoff / alpha clipping - a hard
       edge, never an opacity fade; the retired 2026-10-15 whole-
       object fade approach must not come back). A fragment is cut
       only when BOTH hold: (a) its gl_FragCoord position lies inside
       the circle around the character's projected screen centre, and
       (b) its window-space depth is closer to the camera than the
       character's centre depth (minus a small epsilon), i.e. the
       fragment is strictly IN FRONT of the character. Walls behind
       the character, the ground the character stands on (never
       patched), and everything outside the circle are untouched;
       when nothing occludes, nothing visible changes.
       Patched materials - BUILDINGS ONLY, applied at creation:
       the district registry wall+roof slots (espilDistrictMaterials),
       the downtown core bldgMat cache, and the chunk-city instanced
       building material in generateChunk. Terrain, water, nature,
       props, NPCs, remote players and the character itself are never
       patched. Scope: the LOCAL player only.
       Interiors: while __espilInside is set the cutout is DISABLED -
       indoors the enclosing room must stay whole; the in/outdoor
       transition is a door crossing, so no pop is visible.
       DITHER (Han 2026-11-14: "handle wall occlusion with the
       dither method"): the cutout's total discard is superseded -
       inside the SAME trigger region (the circle + the in-front
       depth test, unchanged) the wall now keeps a Bayer 4x4
       screen-door subset of its fragments (uOccKeep at the centre,
       feathering to full density at the rim), so the character
       reads THROUGH the stippled wall while the wall stays
       recognisable. Still fragment discard only - never an opacity
       fade. The trigger, the patched set and the tick are the
       2026-11-03 system's; only the fragment treatment changed.
       Layer mode note: in the Mapbox pipeline the buildings are
       fill-extrusions and the patched THREE materials are hidden
       (espilP1Hide), so this shader never reaches them - the
       extrusion side is treated separately by espilDitherLayerTick
       below (a stipple-pattern layer for the occluding features
       only, driven by the camera clamp's own segment law).
       RETIRED (Han 2026-11-26, item 7): both treatments in this
       lineage are superseded by the two-pass X-ray silhouette in
       the custom layer (espilXraySilhouette); the arming tick is
       disarmed and the layer twin is removed. This block stays as
       the lineage record. */
    var ESPIL_OCCLUDE_RADIUS_FACTOR=1.35; /* circle radius = projected character half-height x this (>1: the circle is larger than the character) */
    var ESPIL_OCCLUDE_CHAR_H=1.8; /* character height in metres used for the projection */
    var ESPIL_OCCLUDE_EPS=0.00002; /* window-depth epsilon: a fragment must be at least ~this much closer than the character centre to be cut */
    var ESPIL_DITHER_KEEP=0.30; /* dither (Han 2026-11-14): fraction of wall fragments KEPT at the circle centre on the THREE path (the rest are discarded - screen-door) */
    var ESPIL_DITHER_EXT_KEEP=0.3125; /* the same density law for the layer-mode extrusion stipple pattern (fraction of pattern texels opaque; 5/16 - tuned on the corner frames: at 0.5 the character ghosted too faintly through the wall) */
    var espilOccludeU={centre:{value:new THREE.Vector2(-10000,-10000)},radius:{value:0},charZ:{value:1},enabled:{value:0},keep:{value:ESPIL_DITHER_KEEP}};
    var espilOccludePatched=new WeakSet(), espilOccludePatchedCount=0;
    var espilOccludeMaster=true; /* probe/Han toggle via __espilOccludeState.setEnabled */
    var espilOccludeState={enabled:false,centrePx:null,radiusPx:0,charDepth:null,patchedMaterials:0};
    function espilOccludePatchMat(m){
      if(!m||espilOccludePatched.has(m))return;
      if(m.isShaderMaterial||m.isSpriteMaterial||m.isPointsMaterial||m.isLineBasicMaterial||m.isShadowMaterial)return;
      espilOccludePatched.add(m);
      var prev=m.onBeforeCompile;
      m.onBeforeCompile=function(shader){
        if(prev)prev.call(this,shader);
        shader.uniforms.uOccCentre=espilOccludeU.centre;
        shader.uniforms.uOccRadius=espilOccludeU.radius;
        shader.uniforms.uOccCharZ=espilOccludeU.charZ;
        shader.uniforms.uOccEnabled=espilOccludeU.enabled;
        shader.uniforms.uOccKeep=espilOccludeU.keep;
        var anchor='void main() {';
        if(shader.fragmentShader.indexOf(anchor)<0){ console.warn('[Occlude] fragment anchor missing, material not patched'); return; }
        shader.fragmentShader=('uniform vec2 uOccCentre;\nuniform float uOccRadius;\nuniform float uOccCharZ;\nuniform float uOccEnabled;\nuniform float uOccKeep;\n'+
          'float espilOccBayer2(vec2 a){ a=floor(a); return fract(a.x/2.0+a.y*a.y*0.75); }\n'+
          'float espilOccBayer4(vec2 a){ return espilOccBayer2(0.5*a)*0.25+espilOccBayer2(a); }\n')+
          shader.fragmentShader.replace(anchor,
            anchor+'\n  if(uOccEnabled>0.5){ vec2 espilOccD=gl_FragCoord.xy-uOccCentre; float espilOccD2=dot(espilOccD,espilOccD); if(espilOccD2<uOccRadius*uOccRadius && gl_FragCoord.z<uOccCharZ-'+ESPIL_OCCLUDE_EPS+'){ float espilOccKeep=mix(uOccKeep,1.0,smoothstep(0.70,1.0,sqrt(espilOccD2)/uOccRadius)); if(espilOccBayer4(gl_FragCoord.xy)>=espilOccKeep) discard; } }');
        espilOccludePatchedCount++;
      };
      m.needsUpdate=true;
    }
    var _espilOccV=new THREE.Vector3(), _espilOccFeet=new THREE.Vector3(), _espilOccHead=new THREE.Vector3();
    function espilOccludeTick(){
      /* RETIRED (Han 2026-11-26, item 7): the wall-dither treatments
         this tick armed - the THREE-side screen-door above and the
         layer-mode twin below - are superseded by the two-pass
         X-ray silhouette in the custom layer (espilXraySilhouette).
         The tick stays as a disarmed stub: the shared uniforms are
         pinned at enabled = 0, so the espilOccludePatchMat shader
         branch can never discard a fragment, and the probe seam
         keeps reporting the retired state honestly. The patch
         function and its material call sites stay in place
         (2026-11-03 lineage); espilP1FadeMat / espilP1Hide are a
         different system and are untouched. */
      if(espilOccludeU.enabled.value!==0)espilOccludeU.enabled.value=0;
      espilOccludeState.enabled=false;
      espilOccludeState.centrePx=null;
      espilOccludeState.radiusPx=0;
      espilOccludeState.charDepth=null;
      espilOccludeState.patchedMaterials=espilOccludePatchedCount;
    }
    window.__espilOccludeState=function(){
      return {enabled:espilOccludeState.enabled,master:espilOccludeMaster,centrePx:espilOccludeState.centrePx,radiusPx:espilOccludeState.radiusPx,charDepth:espilOccludeState.charDepth,patchedMaterials:espilOccludePatchedCount,factor:ESPIL_OCCLUDE_RADIUS_FACTOR,mode:'retired-xray',keep:espilOccludeU.keep.value};
    };
    window.__espilOccludeState.setEnabled=function(b){ espilOccludeMaster=!!b; return espilOccludeMaster; };
    /* ---- DITHER, layer mode - REMOVED (Han 2026-11-26) ----
       The twin extrusion layer this block drove
       ('espil-buildings-dither') is removed with the game's own
       building rendering (item 6c: the original Mapbox model
       renders the buildings now), and the occlusion treatment it
       carried is superseded by the two-pass X-ray silhouette
       (item 7). espilDitherLayerTick, its collectors and the
       __espilDitherState seam retire with it. */
    var curvedMatCache={};
    function curvedMat(color){
      var key='c'+color, m=curvedMatCache[key];
      if(!m){ m=new THREE.MeshLambertMaterial({color:color}); curvedMatCache[key]=m; }
      return m;
    }
    /* Real sky for the map: shares the landing's astronomical sun vector; daylight is the
       solar altitude over Vancouver, same formula as the landing's sky dome. */
    var mapSkyU=null,mapSkyDome=null,mapSunL=null,mapHemiL=null;
    var vanLocalN=null,vanWorldN=new THREE.Vector3(0,1,0),UPV=new THREE.Vector3(0,1,0);
    var sunEastW=new THREE.Vector3(1,0,0),sunNorthW=new THREE.Vector3(0,0,1),sunMapD=new THREE.Vector3(0,1,0);
    var fogDay=new THREE.Color(.42,.68,.82),fogNight=new THREE.Color(.018,.045,.09),fogTmp=new THREE.Color();
    function mapDaylight(){
      if(!vanLocalN)vanLocalN=latLon(49.2827,-123.1207,1).normalize();
      vanWorldN.copy(vanLocalN).applyAxisAngle(UPV,earthSpin.rotation.y);
      var alt=worldSunDirection.dot(vanWorldN);
      /* Sun direction in Vancouver's east/north/up frame, mapped to map space
         (map +x=east, +y=up, -z=north toward the waterfront). */
      sunEastW.crossVectors(UPV,vanWorldN).normalize();
      sunNorthW.crossVectors(vanWorldN,sunEastW).normalize();
      sunMapD.set(worldSunDirection.dot(sunEastW),alt,-worldSunDirection.dot(sunNorthW)).normalize();
      return Math.max(0,Math.min(1,(alt+.13)/.34));
    }
    function updateMapSky(){
      if(!mapBuilt||!mapSkyU)return;
      var dl=mapDaylight();
      mapSkyU.sunDirection.value.copy(sunMapD);
      /* Moon: opposite the sun (full moon) — rises at sunset, sets at sunrise, real-time. */
      mapSkyU.moonDirection.value.copy(sunMapD).multiplyScalar(-1);
      mapSkyU.daylight.value=dl;
      mapSkyDome.position.copy(mapCamera.position);
      if(sunMapD.y>-.05){
        mapSunL.position.copy(sunMapD).multiplyScalar(220);
        mapSunL.intensity=.12+.88*dl;
        mapSunL.color.setHex(dl>.25?0xfff1d8:0xcfd8ff);
      }else{
        /* Night: moonlight from the moon's direction — brighter when the moon is high. */
        var moonD=mapSkyU.moonDirection.value;
        mapSunL.position.copy(moonD).multiplyScalar(220);
        mapSunL.intensity=.1+.3*Math.max(0,moonD.y);
        mapSunL.color.setHex(0xa8c0ff);
      }
      mapHemiL.intensity=.18+.8*dl;
      fogTmp.copy(fogNight).lerp(fogDay,dl);
      mapScene.fog.color.copy(fogTmp);
    }
    /* 2D billboard prop system — Han's art direction: trees, lamps, traffic lights and
       other environmental props are camera-facing sprite planes, NOT 3D models.
       Characters stay 3D; buildings stay 3D. Placeholder canvas art marks positions
       until Han supplies real sprite images (then use setPropSprite to swap them in). */
    var billboardProps=[];
    function propTexture(kind){
      var c=document.createElement('canvas');c.width=64;c.height=96;
      var g=c.getContext('2d');g.clearRect(0,0,64,96);
      if(kind==='tree'){
        g.fillStyle='#6b4a2f';g.fillRect(29,60,6,36);
        g.fillStyle='#5d8f5f';g.beginPath();g.arc(32,34,22,0,7);g.fill();
        g.fillStyle='#79b879';g.beginPath();g.arc(24,26,10,0,7);g.fill();
      }else if(kind==='lamp'){
        g.fillStyle='#3a3f45';g.fillRect(30,14,4,82);
        g.fillRect(30,10,14,4);
        g.fillStyle='#ffe9a8';g.beginPath();g.arc(46,16,6,0,7);g.fill();
      }else{ /* signal */
        g.fillStyle='#2a2d33';g.fillRect(29,30,6,66);
        g.fillStyle='#16181c';g.fillRect(20,4,24,30);
        g.fillStyle='#e5484d';g.beginPath();g.arc(32,11,4.5,0,7);g.fill();
        g.fillStyle='#f5b301';g.beginPath();g.arc(32,19,4.5,0,7);g.fill();
        g.fillStyle='#46c46a';g.beginPath();g.arc(32,27,4.5,0,7);g.fill();
      }
      var t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
    }
    function addProp(kind,x,z,w,h,texUrl){
      var mat=new THREE.MeshBasicMaterial({map:texUrl?new THREE.TextureLoader().load(texUrl):propTexture(kind),transparent:true,side:THREE.DoubleSide,fog:true,depthWrite:false});
      var mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
      mesh.userData.prop={kind:kind,x:x,z:z,h:h};
      mesh.renderOrder=2;
      mesh.frustumCulled=false;
      mapScene.add(mesh);
      billboardProps.push(mesh);
      return mesh;
    }
    /* Swap placeholder art for Han's real sprite images when they arrive. */
    function setPropSprite(kind,url){
      var tex=new THREE.TextureLoader().load(url);
      for(var i=0;i<billboardProps.length;i++){
        var m=billboardProps[i];
        if(m.userData.prop.kind===kind){m.material.map=tex;m.material.needsUpdate=true;}
      }
    }
    /* The Google 3D Tiles layer was removed (Han 2026-10-20
       cleanup): the shipped line is the Mapbox world only, so the
       tile ground probe answers null and the ground law reads the
       record sources, exactly as it did while tiles stayed off. */
    function espilTileBase(x,z){ return null; }
    /* --- spawn resolution (prototype rules): real location inside the
       boundary plays there; outside resolves to the nearest boundary
       land point; water is always nudged to land; no geo = downtown. --- */
    var espilBoundary=null;
    try{ fetch('tiles/downtown-boundary.json').then(function(r){return r.json();}).then(function(j){
      /* The boundary file stores vertices as {lat,lng,x,z} objects;
         the spawn/gate math wants [x,z] pairs - normalize at load. */
      var raw=j.vertices||j.polygon||j;
      espilBoundary=(raw&&raw.map)?raw.map(function(v){return Array.isArray(v)?v:[v.x,v.z];}):raw;
    }).catch(function(){}); }catch(e){}
    function espilInBoundary(x,z,scale){
      if(!espilBoundary)return Math.hypot(x,z)<1500*(scale||1);
      var px=x/(scale||1),pz=z/(scale||1),inside=false,poly=espilBoundary;
      for(var i=0,k=poly.length-1;i<poly.length;k=i++){
        var xi=poly[i][0],zi=poly[i][1],xk=poly[k][0],zk=poly[k][1];
        if(((zi>pz)!==(zk>pz))&&(px<(xk-xi)*(pz-zi)/(zk-zi)+xi))inside=!inside;
      }
      return inside;
    }
    function espilNudgeToLand(x,z){
      if(!isWaterAt(x,z))return {x:x,z:z};
      for(var r=15;r<=240;r+=15){
        for(var a=0;a<8;a++){
          var nx=x+Math.cos(a*Math.PI/4)*r,nz=z+Math.sin(a*Math.PI/4)*r;
          if(!isWaterAt(nx,nz))return {x:nx,z:nz};
        }
      }
      var spFb=espilCityCfg().spawn; return {x:spFb.x,z:spFb.z}; /* city spawn (location summon generalization, 2026-11-18: was the Vancouver literal {x:3,z:31}, which IS Vancouver's cfg.spawn) */
    }
    function espilResolveSpawn(geo){
      if(!espilCityCfg().core){
        /* Offset city (generalized 2026-11-18, location summon):
           WITH a point, resolve it to the nearest land point
           inside this city's own bounds - the Vancouver law
           below, generalized; the out-of-bounds saved-position
           judgement that also calls this function stays
           consistent with it. WITHOUT a point, the phase-1 law
           stands: every fresh entry starts at the entry point. */
        var cfgO=espilCityCfg();
        if(!geo||!cfgO.bounds)return {x:cfgO.spawn.x,z:cfgO.spawn.z};
        var bO=cfgO.bounds;
        var cxO=Math.max(bO.x0,Math.min(bO.x1,geo.x)), czO=Math.max(bO.z0,Math.min(bO.z1,geo.z));
        return espilNudgeToLand(cxO,czO);
      }
      if(!geo)return {x:3,z:31};
      if(espilInBoundary(geo.x,geo.z,1))return espilNudgeToLand(geo.x,geo.z);
      /* nearest point on the boundary polygon edges */
      var best=null,bd=1e18,poly=espilBoundary;
      if(poly){
        for(var i=0,k=poly.length-1;i<poly.length;k=i++){
          var x1=poly[k][0],z1=poly[k][1],x2=poly[i][0],z2=poly[i][1];
          var dx=x2-x1,dz=z2-z1,L2=dx*dx+dz*dz||1;
          var t=Math.max(0,Math.min(1,((geo.x-x1)*dx+(geo.z-z1)*dz)/L2));
          var px=x1+dx*t,pz=z1+dz*t,dd=(geo.x-px)*(geo.x-px)+(geo.z-pz)*(geo.z-pz);
          if(dd<bd){bd=dd;best={x:px,z:pz};}
        }
      }
      if(!best)best={x:3,z:31};
      return espilNudgeToLand(best.x,best.z);
    }
    /* === LOCATION SUMMON SEAM __espilLocSummonSeam v1 (Han
       2026-11-18, location-summon/DESIGN.md sections 3.4-3.5) ===
       The entry gate (entry-flow) asks the location question
       BEFORE the dive and calls only this seam. The inverse of
       espilP1LngLat lives here so the conversion has exactly
       one home. Raw coordinates enter; a world point (or a
       judgement) leaves; nothing is stored and nothing leaves
       the device. */
    var ESPIL_GEO_MAX_ACCURACY_M=5000; /* a fix coarser than this is not a precise fix (design 2.3) */
    var ESPIL_GEO_CLAMP_MAX_M=25000; /* boundary clamp reach: the same living area, not another continent (design 3.4) */
    window.__espilGeoMaxAccuracyM=ESPIL_GEO_MAX_ACCURACY_M;
    function espilGeoCityPoint(key,lat,lng){
      var cfg=ESPIL_CITIES[key], a=ESPIL_P1_ANCHORS[key];
      if(!cfg||!a)return null;
      var lx=(lng-a.lng)*111320*Math.cos(a.lat*Math.PI/180);
      var lz=-(lat-a.lat)*111320;
      return {x:lx+(cfg.ox||0), z:lz+(cfg.oz||0)};
    }
    function espilGeoDistToBounds(b,x,z){
      if(!b)return null;
      var dx=0,dz=0;
      if(x<b.x0)dx=b.x0-x; else if(x>b.x1)dx=x-b.x1;
      if(z<b.z0)dz=b.z0-z; else if(z>b.z1)dz=z-b.z1;
      return Math.sqrt(dx*dx+dz*dz);
    }
    /* Judge a fix for the CURRENT city. Returns one of:
       {kind:'inside', point} - inside the selected city's
         playable extent; the point already went through the
         validity chain (edge rule, then water nudge).
       {kind:'clamped', point, distM} - outside but within
         ESPIL_GEO_CLAMP_MAX_M of the bounds; the point is
         resolved by espilResolveSpawn (the boundary law).
       {kind:'other-city', city} - inside another built
         city's extent; the dive still enters the selected
         city (city choice belongs to the landing).
       {kind:'far'} - unrelated to every built city. */
    window.__espilGeoJudge=function(lat,lng){
      try{
        if(typeof lat!=='number'||typeof lng!=='number'||!isFinite(lat)||!isFinite(lng))return {kind:'far'};
        var cur=espilCityKey(), cfg=espilCityCfg();
        var pt=espilGeoCityPoint(cur,lat,lng);
        if(!pt)return {kind:'far'};
        var b=cfg.bounds;
        var inside=b?(pt.x>=b.x0&&pt.x<=b.x1&&pt.z>=b.z0&&pt.z<=b.z1):espilInBoundary(pt.x,pt.z,1);
        if(inside){
          var ep=espilResumeEdgePoint(pt.x,pt.z);
          var q=ep||pt;
          return {kind:'inside', point:espilNudgeToLand(q.x,q.z)};
        }
        for(var k in ESPIL_CITIES){
          if(k===cur)continue;
          var b2=ESPIL_CITIES[k].bounds; if(!b2)continue;
          var p2=espilGeoCityPoint(k,lat,lng);
          if(p2&&p2.x>=b2.x0&&p2.x<=b2.x1&&p2.z>=b2.z0&&p2.z<=b2.z1)return {kind:'other-city', city:k};
        }
        var d=espilGeoDistToBounds(b,pt.x,pt.z);
        if(d!==null&&d<=ESPIL_GEO_CLAMP_MAX_M){
          var rp=espilResolveSpawn({x:pt.x,z:pt.z});
          var ep2=espilResumeEdgePoint(rp.x,rp.z);
          if(ep2)rp=espilNudgeToLand(ep2.x,ep2.z);
          return {kind:'clamped', point:rp, distM:Math.round(d)};
        }
        return {kind:'far'};
      }catch(e){ return {kind:'far'}; }
    };
    window.__espilGeoSpawn=function(lat,lng){
      var j=window.__espilGeoJudge(lat,lng);
      return (j&&j.point)?j.point:null;
    };
    /* Three start options (Han 2026-11-19): the gate's centre
       row asks for the CURRENT city's centre anchor. For the
       core city that anchor is the Art Gallery front pick
       (3, 33) the entry gate has used since Batch D3 - NOT
       cfg.spawn (3, 31), which is the world's cold-start
       point; for every offset city it is cfg.spawn, the
       anchor plaza espilEntryStart itself defaults to when
       no pick and no save exist. City data keeps exactly one
       home: this seam. */
    window.__espilCityCentre=function(){
      try{
        var cfg=espilCityCfg();
        if(cfg&&cfg.core)return {x:3,z:33};
        if(cfg&&cfg.spawn)return {x:cfg.spawn.x,z:cfg.spawn.z};
      }catch(e){}
      return {x:3,z:33};
    };
    /* The saved spot the world itself would resume at:
       loadLastPos's own verdict (the record parses, its city
       matches the active city, and it lies inside the active
       city's bounds with the same 50 m margin), as a point -
       or null when no acceptable save exists. The gate's
       last-place row shows only when this returns a point,
       and choosing it sets no pick: espilEntryStart's resume
       law (in-bounds dive at the spot with the footprint-
       edge rule; an out-of-bounds save resolves to the
       boundary) does the rest, exactly as it does today. */
    window.__espilSavedSpot=function(){
      try{ var d=loadLastPos(); return d?{x:d.x,z:d.z}:null; }catch(e){ return null; }
    };
    /* === END LOCATION SUMMON SEAM === */
    /* --- geolocation pre-prompt RETIRED (2026-11-18, location
       summon): the mid-dive prompt, its mid-fall retarget and
       its hide hooks are gone. The location question now sits
       in the entry chain (entry-flow's __espilEntryLocationGate)
       BEFORE the dive, with a device preference; asking again
       here would double the question. The seam the gate calls
       is __espilGeoJudge (location summon seam, above). --- */
    /* --- UI rise (production standard): panels start lowered + faded
       during the fall, then rise bottom -> top once the landing lands. --- */
    var espilStyleDone=false;
    function espilInjectStyle(){
      if(espilStyleDone)return; espilStyleDone=true;
      var st=document.createElement('style'); st.id='espil-bridge-style';
      st.textContent=
        '#minimap-wrap,#map-hint{transition:transform 1s cubic-bezier(.22,.9,.26,1),opacity 1s cubic-bezier(.22,.9,.26,1);}' +
        'body.espil-ui-pre #minimap-wrap{transform:translateY(30px);opacity:0;pointer-events:none;}' +
        'body.espil-ui-pre #map-hint{transform:translateY(30px);opacity:0;pointer-events:none;transition-delay:.26s;}' +
        '@media (prefers-reduced-motion: reduce){#minimap-wrap,#map-hint{transition:none;}}';
      document.head.appendChild(st);
    }
    function espilUiRise(){
      document.body.classList.remove('espil-ui-pre');
      setTimeout(function(){ /* settled: pointer events return with the class gone */ },1800);
    }
    /* --- entry arrival (Han 2026-10-19): the character no longer
       falls from the sky. The player is placed on the ground at the
       entry target and only the CAMERA dives in: walkCamDist sweeps
       the old descent envelope (60 -> the standing default) on a timer, which also
       leads the map zoom in P1 mode. The entry target itself (city
       spawn or the resolved boundary point) is unchanged, so the
       per-city spawn accuracy is exactly what the descent had. --- */
    /* --- GLOBE DIVE ARRIVAL (guide step 5, Han 2026-10-21; profile
       fixed with the Assets room: 25 m fall, about 1.4 s at the game's
       own gravity 26, existing dive/land clips - pose entry + clamp
       hold, land into recovery). Scope: EVERY city entry dives
       (Han, 2026-10-21, via the reporting room: "모든 도시 진입은
       다이브가 필요합니다") - fresh summons, direct visits, city
       switches, out-of-bounds saves resolved to the boundary, and
       in-bounds resumes at the saved spot alike; the earlier
       pending-city / fresh-spawn-only gating is removed. Seam
       contract with the UI room: espil-arrival and the guide arrival
       fire at FALL START so their 1.7 s cloud pierce plays over the
       fall; control unlocks when the 2.9 s envelope ends. --- */
    function espilBeginDiveArrival(tx,tz){
      var p=walkPlayer; if(!p)return;
      espilInjectStyle();
      document.body.classList.add('espil-ui-pre');
      var base=espilTileBase(tx,tz);
      if(base===null)base=espilOwnSurfaceY(tx,tz);
      if(base===null||base===undefined)base=0;
      p.pos.x=tx; p.pos.z=tz; p.pos.y=base+25;
      p.velY=0; p.onGround=false; p.jumps=0;
      p._espilArrive={dive:true,surf:base,velY:0,landed:false,startedAt:performance.now(),dur:2900};
      walkCamDist=60;
      if(typeof espilP1!=='undefined'&&espilP1)espilP1.zoomDrive=false;
      if(typeof walkAvatar!=='undefined'&&walkAvatar&&walkAvatar.playDive)walkAvatar.playDive();
      espilUiRise();
      window.__espilLastDive={city:espilCityKey(),at:Date.now()};
      window.__espilLastArrival={city:espilCityKey(),at:Date.now()};
      try{ window.dispatchEvent(new CustomEvent('espil-arrival',{detail:{city:espilCityKey()}})); }catch(e){}
      try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'arrival',city:espilCityKey()}})); }catch(e){}
    }
    function espilBeginArrival(tx,tz){
      var p=walkPlayer; if(!p)return;
      espilInjectStyle();
      document.body.classList.add('espil-ui-pre');
      p.pos.x=tx; p.pos.z=tz;
      var base=espilTileBase(tx,tz);
      if(base===null)base=espilOwnSurfaceY(tx,tz); /* own-city surface (tiles shelved) */
      if(base===null||base===undefined)base=0;
      p.pos.y=base;
      p.velY=0; p.onGround=true; p.jumps=0;
      p._espilArrive={surf:base,probeAt:0,startedAt:performance.now(),dur:1900};
      walkCamDist=60; /* wide sky framing; the step eases it to 5.5 */
      if(typeof espilP1!=='undefined'&&espilP1)espilP1.zoomDrive=false; /* the arrival envelope leads the map zoom for this entry */
    }
    function espilArrivalStep(p,dt){
      var a=p._espilArrive; if(!a)return;
      if(a.dive){
        var nowD=performance.now();
        if(!a.landed){
          a.velY-=26*dt; p.pos.y+=a.velY*dt;
          if(p.pos.y<=a.surf){ p.pos.y=a.surf; p.onGround=true; a.landed=true;
            if(typeof walkAvatar!=='undefined'&&walkAvatar&&walkAvatar.playLand)walkAvatar.playLand(); }
        }
        var td=Math.max(0,Math.min(1,(nowD-a.startedAt)/a.dur));
        var fd=1-td; walkCamDist=5.5+54.5*fd*fd;
        if(td>=1){ p._espilArrive=null; walkCamDist=5.5; }
        return;
      }
      var now=performance.now();
      if(now-a.probeAt>150){ a.probeAt=now; var y=espilTileBase(p.pos.x,p.pos.z); if(y===null)y=espilOwnSurfaceY(p.pos.x,p.pos.z); if(y!==null&&y!==undefined)a.surf=y; }
      if(a.surf!==null&&a.surf!==undefined){ p.pos.y=a.surf; p.onGround=true; }
      var t=Math.max(0,Math.min(1,(now-a.startedAt)/a.dur));
      var f=1-t; walkCamDist=5.5+54.5*f*f;
      if(t>=1){
        p._espilArrive=null;
        walkCamDist=5.5;
        espilUiRise();
        /* GUIDE HOOKS (joint guide project, 2026-10-21): the guide
           layer watches ACTIONS, not clicks, so the build reports the
           moments a taught action completes. Contract with the UI room:
           one event, 'espil-guide', with detail.type in arrival /
           interior / bought / stall-open / stall-listed. This site also
           fires 'espil-arrival' (the Time Machine quest's Dive hook)
           and sets the latch window.__espilLastArrival. Listeners can
           never break play: every dispatch is guarded. */
        window.__espilLastArrival={city:espilCityKey(),at:Date.now()};
        try{ window.dispatchEvent(new CustomEvent('espil-arrival',{detail:{city:espilCityKey()}})); }catch(e){}
        try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'arrival',city:espilCityKey()}})); }catch(e){}
      }
    }
    /* --- map loading screen (Han 2026-10-16): the standard water-
       glass loader covers the map loading interval. Sequence: the
       loader shows at entry and closes at the moment the descent
       starts, and the descent itself waits for own-city readiness -
       so the loader and the sky descent never overlap, and the
       descent never plays over an unbuilt city. Progress is driven
       by measured signals only: the avatar being ready and the OSM
       city build state. A 25 s hard cap keeps it from ever trapping
       the player. (Han 2026-10-16: re-pointed from the shelved
       tiles layer to the own city.) */
    var espilEntrySpawn=null, espilLoaderShownAt=0, espilLoaderIv=null, espilLoaderShown=0;
    /* Own-city readiness (Han 2026-10-16, self-replication pivot -
       the shelved tiles layer plays no part in entry anymore): the
       avatar is in, the OSM city build has run, and the procedural
       chunk at the entry point exists. */
    /* A chunk counts as summoned when it exists in chunkMap OR when
       generateChunk declines it by design (overlap with the core
       square, or a center beyond the city radius): declined chunks
       are covered by the district/core law instead. */
    function espilChunkSummoned(cx,cz){
      if(typeof chunkMap==='undefined'||!chunkMap)return false;
      if(chunkMap[cx+','+cz])return true;
      var x0=cx*CHUNK_SIZE,z0=cz*CHUNK_SIZE;
      if(x0<135&&x0+CHUNK_SIZE>-135&&z0<135&&z0+CHUNK_SIZE>-135)return true;
      var ccx=x0+CHUNK_SIZE/2,ccz=z0+CHUNK_SIZE/2;
      if(Math.sqrt(ccx*ccx+ccz*ccz)>15000+CHUNK_SIZE*0.7)return true;
      return false;
    }
    function espilCitySettled(){
      if(!walkPlayer)return false;
      if(!(walkPlayer.av&&walkPlayer.av.ready))return false;
      /* Han 2026-10-16 (PC feedback #16): gameplay starts only after
         EVERYTHING is summoned - the district data AND its meshes.
         (The descent clips gated this until 2026-10-19; with the
         fall removed they no longer gate entry.) */
      if(!espilDistrictBuilt||!window.__espilDistrictMeshesBuilt)return false;
      if(!espilCityCfg().core)return true; /* offset city: avatar + its district + clips */
      if(typeof osmCityBuilt==='undefined'||!osmCityBuilt)return false;
      if(espilEntrySpawn){
        /* the full 3x3 chunk neighborhood around the entry point */
        var pcx=Math.floor(espilEntrySpawn.x/CHUNK_SIZE),pcz=Math.floor(espilEntrySpawn.z/CHUNK_SIZE);
        for(var dx=-1;dx<=1;dx++)for(var dz=-1;dz<=1;dz++){
          if(!espilChunkSummoned(pcx+dx,pcz+dz))return false;
        }
      }
      return true;
    }
    function espilP1EntryLive(){
      /* Arrival gate (Han PC 2026-10-21): the camera envelope must not
         run before the map itself is on screen. espilCitySettled covers
         the game's own assets only; on a real connection the Mapbox
         style, the building source and the custom layer land later,
         and a 1.9 s envelope spent behind an unpainted map reads as an
         entry with no arrival at all. A failed map releases the gate -
         the banner carries that state; the entry is never held hostage. */
      if(typeof ESPIL_P1==='undefined'||!ESPIL_P1)return true;
      if(typeof espilP1==='undefined'||!espilP1)return true;
      if(espilP1.failed)return true;
      return !!(espilP1.ready&&espilP1.layerLive&&espilP1.buildingsAdded);
    }
    function espilCityProgress(){
      var f=0;
      if(walkPlayer&&walkPlayer.av&&walkPlayer.av.ready)f+=.25;
      if(!espilCityCfg().core){ if(espilDistrictBuilt)f+=.45; if(window.__espilDistrictMeshesBuilt)f+=.30; return Math.min(1,f); }
      if(typeof osmCityBuilt!=='undefined'&&osmCityBuilt)f+=.3;
      else if(typeof osmChunks!=='undefined'&&osmChunks)f+=.15;
      if(espilDistrictBuilt)f+=.3;
      if(window.__espilDistrictMeshesBuilt)f+=.15;
      return Math.min(1,f);
    }
    /* The game's OWN ground law at a point: 0 plus the highest
       building collider top whose footprint holds the point - the
       same surfaces the walker stands on. Used by the descent now
       that the tile probe is shelved. */
    function espilOwnSurfaceY(x,z){
      var best=0;
      var scan=function(list){
        if(!list)return;
        for(var i=0;i<list.length;i++){
          var c=list[i];
          if(x>=c.x0&&x<=c.x1&&z>=c.z0&&z<=c.z1&&c.top>best)best=c.top;
        }
      };
      if(!ESPIL_P1)scan(walkColliders); /* MAPBOX PHASE 1: collision authority is the prebuilt store alone */
      /* District strips (spatial hash): a query point within PLAYER_R
         of a strip's edge still belongs to that roof - the strips are
         1 m scanline rows, and an edge descent or spawn must resolve
         to the roof, not fall through to the street inside the
         building (Han PC rooftop-landing failure, 2026-10-16). */
      if(!ESPIL_P1){
      var sb=espilStripBucketAt(x,z);
      if(sb)for(var si=0;si<sb.length;si++){
        var sc2=sb[si];
        var qx=Math.max(sc2.x0,Math.min(sc2.x1,x)), qz=Math.max(sc2.z0,Math.min(sc2.z1,z));
        var ddx=x-qx, ddz=z-qz;
        if(ddx*ddx+ddz*ddz<=PLAYER_R*PLAYER_R&&sc2.top>best)best=sc2.top;
      }
      }
      if(ESPIL_P1){
        /* COLOR-KEY: the roof under the point is the record's own
           height - same polygon, same h as the drawn extrusion. */
        var pb2=espilPolyBucketAt(x,z);
        if(pb2)for(var qi=0;qi<pb2.length;qi++){
          var qr=pb2[qi]; if(qr.h<=best)continue;
          if(x<qr.x0-PLAYER_R||x>qr.x1+PLAYER_R||z<qr.z0-PLAYER_R||z>qr.z1+PLAYER_R)continue;
          if(espilPolyProbe(qr,x,z).d<=PLAYER_R)best=qr.h;
        }
      }
      if(!ESPIL_P1&&typeof chunkColliders!=='undefined'&&chunkColliders){
        var cx=Math.floor(x/CHUNK_SIZE),cz=Math.floor(z/CHUNK_SIZE);
        for(var i=-1;i<=1;i++)for(var j=-1;j<=1;j++)scan(chunkColliders[(cx+i)+','+(cz+j)]);
      }
      /* INSTANCE GROUND (entry/camera batch, 2026-11-10): the two
         instance discs are authored in local space with their
         floors at y = 0 (interior room floor; arena ground disc,
         r 26), and entry places the player at y = 0.05 - but the
         anchor regions hold NO baked records, so the scans above
         answer 0 there only by coincidence of the empty base, and
         any collider top the 8 km-south map area contributes would
         lift the instance surface off its own floor. Declare the
         instance ground explicitly: inside either disc the surface
         is exactly 0, ahead of every baked contribution. (The arena
         seam's in-space tick already clamps the player to the disc;
         this gives the surface/camera law the same ground.) */
      var idx=x-0, idz1=z-8000, idz2=z-8400;
      if(idx*idx+idz1*idz1<=30*30||idx*idx+idz2*idz2<=26*26)return 0;
      /* PLACE SPACE (Han 2026-11-16, design 5): the active place
         slot's room rectangle is instance ground too - the lobby
         floor is exactly 0 inside it. modules/place-space.js
         publishes the rectangle while a space stands. */
      var _psr=window.__espilPlaceSpaceRect;
      if(_psr&&x>=_psr.x0&&x<=_psr.x1&&z>=_psr.z0&&z<=_psr.z1)return 0;
      /* HOME SPACE (Han 2026-11-16, design 2.2): the player's own
         home rectangle is instance ground the same way - the room
         floor is exactly 0 inside it. The home module publishes
         the rectangle while the player is home. */
      var _hmr=window.__espilHomeRect;
      if(_hmr&&x>=_hmr.x0&&x<=_hmr.x1&&z>=_hmr.z0&&z<=_hmr.z1)return 0;
      return best;
    }
    /* ============ ESPIL DISTRICT BUILD (sample district, 2026-10-16) ============
       Han's approved plan: the sample district (downtown core + first
       OSM ring) is rebuilt from TRUE polygon footprints, and its
       collision comes from the PREBUILT stored map
       (assets/osm/vancouver_collision.json - 9-class mask + roof
       height layer + collider strips, made offline by
       tools/build_collision.py). The game loads the stored map and
       probes/registers it; it never generates masks at runtime.
       The hand-built core square keeps its own colliders and meshes
       in this sample; the ring is fully polygon + stored-map driven. */
    var espilDistrict=null, espilCollision=null, espilDistrictBuilt=false, espilDistrictLoading=false;
    function espilInCoreSq(x,z){ return Math.abs(x)<135&&Math.abs(z)<135; }
    function espilB64ToU8(b64){ var bin=atob(b64), out=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i); return out; }
    /* Spatial hash for the district strips (Han PC feedback
       2026-10-16: scanning the flat strip array every frame strained
       his PC). 25 m buckets; every strip is registered in each bucket
       its box (expanded by 2 m - more than any query reach) touches,
       so point queries only touch nearby strips. Strips no longer
       live in walkColliders at all. */
    var espilStripHash=null, ESPIL_STRIP_CELL=25, ESPIL_STRIP_MARGIN=2;
    function espilStripInsert(c){
      var bx0=Math.floor((c.x0-ESPIL_STRIP_MARGIN)/ESPIL_STRIP_CELL), bx1=Math.floor((c.x1+ESPIL_STRIP_MARGIN)/ESPIL_STRIP_CELL);
      var bz0=Math.floor((c.z0-ESPIL_STRIP_MARGIN)/ESPIL_STRIP_CELL), bz1=Math.floor((c.z1+ESPIL_STRIP_MARGIN)/ESPIL_STRIP_CELL);
      for(var bx=bx0;bx<=bx1;bx++)for(var bz=bz0;bz<=bz1;bz++){
        var k=bx+','+bz, arr=espilStripHash[k];
        if(!arr)arr=espilStripHash[k]=[];
        arr.push(c);
      }
    }
    function espilStripBucketAt(x,z){
      if(!espilStripHash)return null;
      return espilStripHash[Math.floor(x/ESPIL_STRIP_CELL)+','+Math.floor(z/ESPIL_STRIP_CELL)]||null;
    }
    /* ============ COLOR-KEY COLLISION (Han 2026-10-17) ============
       On the Mapbox line the building RECORDS are the collision: the
       same records (espilDistrict.buildings polygons + heights) that
       draw the green extrusions answer wall and rooftop queries, so
       the visible building IS the wall - no strip approximation, no
       scanline stair-step, no coverage gaps. The prebuilt strip store
       still loads for ground classes (water etc.); its wall/rooftop
       query paths are unwired in ESPIL_P1 mode. */
    var espilPolyHash=null, ESPIL_POLY_CELL=25;
    function espilPolyBuild(){
      espilPolyHash={};
      var cfg=espilCityCfg(), blds=(espilDistrict&&espilDistrict.buildings)||[], cnt=0;
      for(var i=0;i<blds.length;i++){
        var b=blds[i]; if(!b||b.w||!b.p||b.p.length<3)continue;
        var n=b.p.length-((b.p[0][0]===b.p[b.p.length-1][0]&&b.p[0][1]===b.p[b.p.length-1][1])?1:0);
        if(n<3)continue;
        var ring=[], x0=1e12,x1=-1e12,z0=1e12,z1=-1e12;
        for(var j=0;j<n;j++){
          var wx=b.p[j][0]+cfg.ox, wz=b.p[j][1]+cfg.oz;
          ring.push([wx,wz]);
          if(wx<x0)x0=wx; if(wx>x1)x1=wx; if(wz<z0)z0=wz; if(wz>z1)z1=wz;
        }
        var rec={ring:ring,h:b.h||0,x0:x0,x1:x1,z0:z0,z1:z1,cx:(x0+x1)/2,cz:(z0+z1)/2};
        var bx0=Math.floor((x0-2)/ESPIL_POLY_CELL), bx1=Math.floor((x1+2)/ESPIL_POLY_CELL);
        var bz0=Math.floor((z0-2)/ESPIL_POLY_CELL), bz1=Math.floor((z1+2)/ESPIL_POLY_CELL);
        for(var bx=bx0;bx<=bx1;bx++)for(var bz=bz0;bz<=bz1;bz++){
          var k=bx+','+bz, arr=espilPolyHash[k];
          if(!arr)arr=espilPolyHash[k]=[];
          arr.push(rec);
        }
        cnt++;
      }
      window.__espilPolyCount=cnt;
    }
    function espilPolyBucketAt(x,z){
      if(!espilPolyHash)return null;
      return espilPolyHash[Math.floor(x/ESPIL_POLY_CELL)+','+Math.floor(z/ESPIL_POLY_CELL)]||null;
    }
    /* Closest point on the ring + signed distance (negative inside)
       + that edge's outward unit normal (pointing away from the
       building, verified against the bbox centre). */
    function espilPolyProbe(rec,x,z){
      var ring=rec.ring, n=ring.length, best=1e18, bcx=0, bcz=0, bnx=0, bnz=0, inside=false;
      for(var i=0,j=n-1;i<n;j=i++){
        var ax=ring[j][0], az=ring[j][1], bx=ring[i][0], bz=ring[i][1];
        if(((az>z)!==(bz>z))&&(x<(bx-ax)*(z-az)/(bz-az)+ax))inside=!inside;
        var ex=bx-ax, ez=bz-az, L2=ex*ex+ez*ez;
        var t=L2>0?((x-ax)*ex+(z-az)*ez)/L2:0; t=t<0?0:(t>1?1:t);
        var px=ax+ex*t, pz=az+ez*t, dx=x-px, dz=z-pz, d2=dx*dx+dz*dz;
        if(d2<best){
          best=d2; bcx=px; bcz=pz;
          var el=Math.sqrt(L2)||1, enx=ez/el, enz=-ex/el;
          if((rec.cx-px)*enx+(rec.cz-pz)*enz>0){enx=-enx;enz=-enz;}
          bnx=enx; bnz=enz;
        }
      }
      var d=Math.sqrt(best);
      return {d:inside?-d:d, cx:bcx, cz:bcz, nx:bnx, nz:bnz, inside:inside};
    }
    /* --- Playable cities (2026-10-16): Vancouver (origin) and the
       Auckland Queen Street corridor, isolated at world offset
       (10000, 0) - outside the chunk-generation radius and the
       hand-built core, inside the 15 km world bound. One district
       loads per page session; the landing sets window.__espilCityKey
       at entry and a city switch reloads (see startCityEntry). --- */
    var ESPIL_CITIES={
      vancouver:{district:'assets/osm/vancouver_district_sample.json',collision:'assets/osm/vancouver_collision.json',ox:0,oz:0,core:true,bounds:{x0:-1799,z0:-2028,x1:2027,z1:1956},spawn:{x:3,z:31},landmark:{name:'Canada Place',x:694,z:-560,face:0,radius:800,activities:['photo','eat','swim','boat','fish','arena'],boatArea:{x0:600,x1:840,z0:-800,z1:-575},arrival:'boat',arrivalSpawn:{x:694,z:-795},landSummon:{x:746,z:-752},photo:{cx:694,cz:-560,camH:2,lx:694,lz:-649.8,lookH:16}}}, /* bounds = the district extent, added 2026-10-19 for the last-place resume rule (Han PC verdict #9): resume judges the full playable extent, not the smaller downtown boundary polygon. First-summon place (Han 2026-10-18): the Vancouver Art Gallery's Robson Square plaza - gallery record bbox x[-46.9..52.9] z[-57.6..16.8], the point sits 14.2 m south of its south face on its centre axis, inside no footprint */
      auckland:{district:'assets/osm/auckland_district.json',collision:'assets/osm/auckland_collision.json',ox:10000,oz:0,core:false,spawn:{x:10302.9,z:-1001.9},bounds:{x0:9243,z0:-1595,x1:11024,z1:1080},harbour:{w:3600,d:1750,dx:140,dz:-1865},landmark:{name:'Sky Tower',x:9904,z:-406,face:0.795,radius:800,activities:['photo','eat'],photo:{cx:9904,cz:-406,camH:2,lx:9882.8,lz:-426.8,lookH:110}}},
      tokyo:{district:'assets/osm/tokyo_district.json',collision:'assets/osm/tokyo_collision.json',ox:5000,oz:0,core:false,spawn:{x:4870,z:0},bounds:{x0:3010,z0:-2032,x1:7034,z1:2011},landmark:{name:'Tokyo Station',x:4870,z:0,face:-1.571,radius:800,activities:['photo','eat'],photo:{cx:4870,cz:0,camH:2,lx:5000,lz:0,lookH:12}}}, /* Tokyo (built 2026-10-18, restored to this tree 2026-10-19 after the production-mirror reset): OSM extract radius 2 km on Tokyo Station (35.68124, 139.76714), 18,002 buildings; spawn = local (-130, 0), the Marunouchi plaza in front of the station, 15.5 m clear of every footprint */
      newyork:{district:'assets/osm/newyork_district.json',collision:'assets/osm/newyork_collision.json',ox:-5000,oz:0,core:false,spawn:{x:-5000,z:0},bounds:{x0:-6906,z0:-2063,x1:-2972,z1:2058},landmark:{name:'Central Park South',x:-4701,z:-919,face:-1.700,radius:800,activities:['photo','eat'],photo:{cx:-4701,cz:-919,camH:2,lx:-4214,lz:-855,lookH:6}}}, /* New York (2026-10-19): OSM extract radius 2 km on Times Square (40.75800, -73.98554), 9,020 buildings; spawn = local (0, 0), the Times Square pedestrian plaza at the anchor itself, 17.8 m clear of every footprint (offline scan of the shipped district records) */
      paris:{district:'assets/osm/paris_district.json',collision:'assets/osm/paris_collision.json',ox:-10000,oz:0,core:false,spawn:{x:-10000,z:0},bounds:{x0:-12016,z0:-2049,x1:-7946,z1:2042},landmark:{name:'Eiffel Tower',x:-9492,z:590,face:0,radius:800,activities:['photo','eat'],photo:{cx:-9492,cz:686,camH:2,lx:-9491.7,lz:496.4,lookH:130}}}, /* Paris (2026-10-19): OSM extract radius 2 km on the Trocadero (48.86272, 2.28756), 11,957 buildings; spawn = local (0, 0), the Trocadero parvis at the anchor itself, 42.8 m clear of every footprint (offline scan of the shipped district records); about half of Paris footprints carry no OSM height tag, so many fall back to the default height */
      london:{district:'assets/osm/london_district.json',collision:'assets/osm/london_collision.json',ox:0,oz:-10000,core:false,spawn:{x:0,z:-10000},bounds:{x0:-1996,z0:-12051,x1:2074,z1:-7957},landmark:{name:'Big Ben',x:180,z:-9185,face:-1.587,radius:800,activities:['photo','eat','boat'],photo:{cx:180,cz:-9185,camH:2,lx:240,lz:-9184,lookH:40}}} /* London (2026-10-19): OSM extract radius 2 km on Trafalgar Square (51.50804, -0.12807), 13,911 buildings; spawn = local (0, 0), the square's centre between the fountains at the anchor itself, 22.5 m clear of every footprint (offline scan of the shipped district records); most London footprints carry no OSM height tag (86% in the default band), so the skyline reads flatter than the real city - height enrichment is future work */
    };
    function espilCityKeyFromPath(){
      /* LANDING PACKAGE (Han 2026-11-25, item 3): every playable
         city has its own path (/Paris, /NewYork, ...) - the first
         path segment, lowercased with punctuation stripped, IS
         the city key when it names a playable city. '/vancouver'
         and the /vancouver/store/<id> form resolve to vancouver
         by that same segment; '/vancouver.html' (the pair file's
         own name) resolves to nothing here, exactly as before. */
      try{
        var seg=(location.pathname.split('/')[1]||'').toLowerCase().replace(/[^a-z0-9]/g,'');
        return ESPIL_CITIES[seg]?seg:null;
      }catch(e){ return null; }
    }
    function espilCityKey(){
      /* The live entry decision (window.__espilCityKey, set by
         startCityEntry from the stored selection) wins once an
         entry has run; before any entry the PATH decides, so a
         direct arrival at /Paris is a Paris arrival. With no
         entry and no city path, the historical default stands. */
      var k=window.__espilCityKey;
      if(ESPIL_CITIES[k])return k;
      return espilCityKeyFromPath()||'vancouver';
    }
    function espilCityCfg(){ return ESPIL_CITIES[espilCityKey()]; }
    /* NAME-ONLY ENTRY (Han 2026-11-24): the landmark village.
       Every bundled city carries a landmark record (name / x / z /
       face / radius / activities [/ boatArea] / photo) on its
       ESPIL_CITIES entry above - world coordinates, radius the one
       800 m draft for all six cities. The village rules bind the
       ENTRANT population only: no espil_session_v1 record, the
       same code fact espilGuestNow() tests, so the village rules
       and the guest rules can never drift apart. An account
       session appearing in place lifts every village rule on the
       same signal (espilVillageActive re-reads the record every
       call). Place-space child windows are outside the rules (the
       mark test) - their own safeguard is the entry backstop in
       __espilPlaceEnterSpace. One entry is exempt by design: the
       landmark arena handoff (espilVillageSuspended, set when
       espilEntryStart consumes the handoff mark) is an ordinary
       gallery entry for that page load. */
    var espilVillageSuspended=false;
    function espilLandmark(){ var cfg=espilCityCfg(); return (cfg&&cfg.landmark)?cfg.landmark:null; }
    /* NAME-ONLY ENTRY package 2 (2026-11-24): the landmark read
       hook for lazy modules (the boat) - the registry above stays
       the only home of the landmark data; this only reads it out. */
    window.__espilLandmarkInfo=function(){
      var lm=espilLandmark(); if(!lm)return null;
      return {key:espilCityKey(),name:lm.name,x:lm.x,z:lm.z,face:lm.face,radius:lm.radius,
        activities:(lm.activities||[]).slice(),boatArea:lm.boatArea?{x0:lm.boatArea.x0,x1:lm.boatArea.x1,z0:lm.boatArea.z0,z1:lm.boatArea.z1}:null,
        arrival:lm.arrival||null,arrivalSpawn:lm.arrivalSpawn?{x:lm.arrivalSpawn.x,z:lm.arrivalSpawn.z}:null};
    };
    /* GUEST BOAT ARRIVAL (Han 2026-11-24): the placement hook
       the boat module steps the rider ashore through at a
       beaching. The walk player is owned here; a lazy module
       cannot move it without a seam, and the beaching rule
       needs exactly one: put the player at a world point on
       the surface there, standing, with any arrival fall
       cancelled. Returns false when there is no player. */
    window.__espilPlacePlayerAt=function(x,z){
      var p=walkPlayer; if(!p||!p.pos)return false;
      var base=espilTileBase(x,z);
      if(base===null||base===undefined)base=espilOwnSurfaceY(x,z);
      if(base===null||base===undefined)base=p.pos.y;
      p.pos.x=x; p.pos.z=z; p.pos.y=base;
      p.velY=0; p.onGround=true; p.jumps=0;
      if(p._espilArrive)p._espilArrive=null;
      return true;
    };
    function espilVillageActive(){
      if(espilVillageSuspended)return false;
      if(!espilGuestNow())return false;
      if(!espilLandmark())return false;
      try{ var mk=JSON.parse(sessionStorage.getItem('espil_store_space_v1')||'null'); if(mk&&mk.city&&mk.slug)return false; }catch(e){}
      return true;
    }
    function espilVillageDist(x,z){ var lm=espilLandmark(); if(!lm)return 0; var dx=x-lm.x,dz=z-lm.z; return Math.sqrt(dx*dx+dz*dz); }
    /* I18N GUESTBTN PACKAGE: the two village messages were
       load-time constants in Korean; their call sites now read
       espilTailT('villageClosed') / espilTailT('villageEdge')
       at notice time, in the language then in force. */
    function espilVillageNotice(msg){
      if(window.__espilToast){ window.__espilToast(msg); return; }
      var t=document.getElementById('toast');
      if(t){ t.textContent=msg; t.classList.add('show'); clearTimeout(t._vt); t._vt=setTimeout(function(){ t.classList.remove('show'); },2600); }
    }
    function espilVillageClamp(p){
      if(!espilVillageActive())return;
      var lm=espilLandmark();
      var dx=p.pos.x-lm.x, dz=p.pos.z-lm.z;
      var d=Math.sqrt(dx*dx+dz*dz);
      if(d>lm.radius){
        var s=lm.radius/d;
        p.pos.x=lm.x+dx*s; p.pos.z=lm.z+dz*s;
        var nowV=performance.now();
        if(p.moving&&nowV-(p._espilVillageNoteAt||0)>8000){ p._espilVillageNoteAt=nowV; espilVillageNotice(espilTailT('villageEdge')); }
      }
    }
    /* ---- Landmark activities (NAME-ONLY ENTRY, Han 2026-11-24) ----
       Offered at the landmark, in the landing's list grammar (one
       row per activity, the account line always last), to the
       entrant population while it stands within 60 m of the
       landmark centre. PHOTO and EAT exist at every landmark;
       SWIM is a guidance row (the mechanic is the patched water
       itself - no new code); the ARENA row (Vancouver) is the
       handoff of design section 5.2. The BOAT row is package 2
       (2026-11-24): a guidance row like swim, rendered only
       where the registry carries a boatArea (a city whose grid
       cannot support one keeps the activity in its list with
       no row and no craft - London in v1); the craft itself
       lives in the lazy boat.js module. */
    var espilPhotoMode=null;
    function espilLmGroundY(x,z){
      var y=null;
      try{ y=(typeof espilOwnSurfaceY==='function')?espilOwnSurfaceY(x,z):null; }catch(e){}
      if(y===null||y===undefined)y=(typeof walkPlayer!=='undefined'&&walkPlayer&&walkPlayer.pos)?walkPlayer.pos.y:0;
      return y;
    }
    function espilPhotoStart(){
      var lm=espilLandmark(); if(!lm||!lm.photo)return;
      var gy=espilLmGroundY(lm.photo.cx,lm.photo.cz);
      espilPhotoMode={cx:lm.photo.cx,cy:gy+lm.photo.camH,cz:lm.photo.cz,lx:lm.photo.lx,ly:gy+lm.photo.lookH,lz:lm.photo.lz};
      var bar=document.getElementById('espil-photo-bar');
      if(bar)bar.style.display='flex';
    }
    function espilPhotoEnd(){
      espilPhotoMode=null;
      var bar=document.getElementById('espil-photo-bar');
      if(bar)bar.style.display='none';
    }
    function espilPhotoCapture(){
      var finish=function(){
        try{
          var map=(typeof espilP1!=='undefined'&&espilP1)?espilP1.map:null;
          var src=(map&&map.getCanvas)?map.getCanvas():null;
          var over=(typeof renderer!=='undefined'&&renderer&&renderer.domElement)?renderer.domElement:null;
          /* The overlay canvas is captured in the same task as a
             forced render with the photo framing (its drawing
             buffer is not preserved between tasks). When the P1
             custom layer is live the map canvas already carries
             the world; both are composited in draw order. */
          if(over){ try{ renderer.render(mapScene,mapCamera); }catch(e){} }
          if(!src&&!over)return;
          var w=(src||over).width, h=(src||over).height;
          var c=document.createElement('canvas'); c.width=w; c.height=h;
          var g=c.getContext('2d');
          if(src)g.drawImage(src,0,0,w,h);
          if(over)g.drawImage(over,0,0,w,h);
          c.toBlob(function(b){
            if(!b)return;
            var a=document.createElement('a');
            a.href=URL.createObjectURL(b);
            a.download='espil-photo.png';
            document.body.appendChild(a); a.click();
            setTimeout(function(){ URL.revokeObjectURL(a.href); if(a.parentNode)a.parentNode.removeChild(a); },4000);
          },'image/png');
        }catch(e){}
      };
      var map=(typeof espilP1!=='undefined'&&espilP1)?espilP1.map:null;
      if(map&&typeof map.once==='function'){
        var done=false;
        var go=function(){ if(done)return; done=true; finish(); };
        try{ map.once('idle',go); if(map.triggerRepaint)map.triggerRepaint(); }catch(e){ go(); }
        setTimeout(go,1200);
      } else finish();
    }
    function espilLandmarkEat(){
      /* The existing held-food path, opened at the landmark: one
         unit of the first held food leaves espil_owned_items and
         the 'espil-item-used' event fires - panels' own listener
         applies the RECOVERY table through __espilApplyRecovery,
         exactly as the bag's Use button does. No new effects, no
         new tables. */
      var table=window.__espilFoodRestore;
      var owned=[];
      try{ owned=JSON.parse(localStorage.getItem('espil_owned_items')||'[]'); if(!Array.isArray(owned))owned=[]; }catch(e){ owned=[]; }
      if(table){
        for(var i=0;i<owned.length;i++){
          if(table[owned[i]]){
            var item=owned[i];
            owned.splice(i,1);
            try{ localStorage.setItem('espil_owned_items',JSON.stringify(owned)); }catch(e){}
            try{ window.dispatchEvent(new CustomEvent('espil-item-used',{detail:{item:item}})); }catch(e){}
            return;
          }
        }
      }
      espilVillageNotice(espilTailT('noFood'));
    }
    function espilLandmarkArena(){
      /* Design section 5.2: the gallery geography does not move -
         the row writes the handoff mark and reloads; the street
         page consumes the mark at the next arrival (espilEntryStart)
         and that one entry is an ordinary gallery entry. */
      try{ sessionStorage.setItem('espil_arena_handoff_v1',JSON.stringify({city:espilCityKey(),at:Date.now()})); }catch(e){}
      location.reload();
    }
    function espilLmUiBuild(){
      if(document.getElementById('espil-lm-btn'))return;
      var st=document.createElement('style');
      st.textContent='#espil-lm-btn{position:fixed;left:14px;bottom:118px;z-index:26;display:none;padding:8px 14px;border-radius:10px;background:linear-gradient(180deg,rgba(84,56,31,.93),rgba(36,22,8,.95));border:1.5px solid #a97e46;color:#f5e6c8;font:700 13px Manrope,"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.45)}'
        +'#espil-lm-panel{position:fixed;left:14px;bottom:162px;z-index:26;display:none;flex-direction:column;gap:6px;padding:10px;border-radius:12px;background:rgba(24,16,7,.94);border:1.5px solid #a97e46;box-shadow:0 6px 18px rgba(0,0,0,.5);min-width:210px}'
        +'#espil-lm-panel .espil-lm-title{color:#ffd97a;font:700 12px Manrope,"Segoe UI",sans-serif;letter-spacing:.04em;padding:0 2px 2px}'
        +'#espil-lm-panel button{display:block;width:100%;text-align:left;padding:8px 12px;border-radius:8px;background:rgba(84,56,31,.55);border:1px solid rgba(169,126,70,.65);color:#f5e6c8;font:600 13px Manrope,"Segoe UI",sans-serif;cursor:pointer}'
        +'#espil-lm-panel button:hover{border-color:#ffd97a}'
        +'#espil-photo-bar{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:27;display:none;gap:8px}'
        +'#espil-photo-bar button{padding:9px 18px;border-radius:10px;background:linear-gradient(180deg,rgba(84,56,31,.93),rgba(36,22,8,.95));border:1.5px solid #ffd97a;color:#f5e6c8;font:700 13px Manrope,"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.45)}';
      document.head.appendChild(st);
      var btn=document.createElement('button');
      btn.id='espil-lm-btn'; btn.type='button'; btn.textContent=espilTailT('lmButton');
      btn.addEventListener('click',function(){
        var panel=document.getElementById('espil-lm-panel');
        if(panel)panel.style.display=(panel.style.display==='flex')?'none':'flex';
      });
      document.body.appendChild(btn);
      var panel=document.createElement('div');
      panel.id='espil-lm-panel';
      document.body.appendChild(panel);
      var bar=document.createElement('div');
      bar.id='espil-photo-bar';
      var cap=document.createElement('button');
      cap.type='button'; cap.textContent=espilTailT('photoTake');
      cap.addEventListener('click',espilPhotoCapture);
      var close=document.createElement('button');
      close.type='button'; close.textContent=espilTailT('photoClose');
      close.addEventListener('click',espilPhotoEnd);
      bar.appendChild(cap); bar.appendChild(close);
      document.body.appendChild(bar);
    }
    function espilLmPanelFill(){
      var panel=document.getElementById('espil-lm-panel');
      var lm=espilLandmark();
      if(!panel||!lm)return;
      panel.innerHTML='';
      var title=document.createElement('div');
      title.className='espil-lm-title';
      title.textContent=lm.name;
      panel.appendChild(title);
      var acts=lm.activities||[];
      function row(label,fn){
        var b=document.createElement('button');
        b.type='button'; b.textContent=label;
        b.addEventListener('click',function(){ panel.style.display='none'; fn(); });
        panel.appendChild(b);
      }
      if(acts.indexOf('photo')>=0)row(espilTailT('photoTake'),espilPhotoStart);
      if(acts.indexOf('eat')>=0)row(espilTailT('lmEat'),espilLandmarkEat);
      if(acts.indexOf('swim')>=0)row(espilTailT('lmSwim'),function(){ espilVillageNotice(espilTailT('swimNotice')); });
      if(acts.indexOf('boat')>=0&&lm.boatArea)row(espilTailT('lmBoat'),function(){
        /* BOAT OWNERSHIP: the row's guidance is instruction -
           the boat is the entrant's own and comes out by
           itself in the water (guideToBoat); the module-absent
           fallback below says the same. */
        if(window.__espilBoat&&typeof window.__espilBoat.guideToBoat==='function'){ window.__espilBoat.guideToBoat(); }
        else if(window.__espilBoat&&typeof window.__espilBoat.guideMooring==='function'){ window.__espilBoat.guideMooring(); }
        else espilVillageNotice(espilTailT('boatAutoDeploy'));
      });
      if(acts.indexOf('fish')>=0)row(espilTailT('lmFish'),function(){
        /* FISHING (Han 2026-11-25, fishing/DESIGN.md section 3):
           the landmark row TEACHES the free action in the swim
           row's guidance grammar - the mechanic itself is the
           water at any shore, not this row. */
        if(window.__espilFishing&&typeof window.__espilFishing.guide==='function'){ window.__espilFishing.guide(); }
        else espilVillageNotice(espilTailT('fishGuideNotice'));
      });
      if(acts.indexOf('arena')>=0)row(espilTailT('lmArena'),espilLandmarkArena);
      /* The account line is always the last row (the upgrade door). */
      row(espilTailT('lmLogin'),function(){
        if(typeof window.__espilOpenAuth==='function'){ window.__espilOpenAuth(); }
        else espilVillageNotice(espilTailT('accountFallback'));
      });
    }
    setInterval(function(){
      try{
        if(!document.body||!document.body.classList.contains('in-map'))return;
        espilLmUiBuild();
        var btn=document.getElementById('espil-lm-btn');
        /* I18N GUESTBTN PACKAGE: the landmark button is built
           once; its label re-renders here so a language switch
           is honoured without a rebuild. */
        if(btn)btn.textContent=espilTailT('lmButton');
        var panel=document.getElementById('espil-lm-panel');
        var p=(typeof walkPlayer!=='undefined')?walkPlayer:null;
        var near=!!(espilVillageActive()&&p&&p.pos&&espilVillageDist(p.pos.x,p.pos.z)<=60);
        if(btn)btn.style.display=near?'block':'none';
        if(!near){
          if(panel)panel.style.display='none';
          if(espilPhotoMode)espilPhotoEnd();
        } else if(panel&&panel.style.display==='flex'){ /* rows already filled */ }
        if(near&&panel){
          var key=espilCityKey()+'|'+((espilLandmark()||{}).activities||[]).join(',');
          if(panel._lmKey!==key){ panel._lmKey=key; espilLmPanelFill(); }
        }
      }catch(e){}
    },1000);
    var ESPIL_CITY_KEYS={'Vancouver':'vancouver','Auckland':'auckland','Tokyo':'tokyo','New York':'newyork','Paris':'paris','London':'london'};
    /* LANDING PACKAGE (Han 2026-11-25, item 3): the canonical
       capitalised path segment per playable city key - the form
       Han wrote ('/Seoul'). startCityEntry navigates to the
       chosen city's own path; a Vercel rewrite serves this pair
       page there. */
    var ESPIL_CITY_PATHS={'vancouver':'Vancouver','auckland':'Auckland','tokyo':'Tokyo','newyork':'NewYork','paris':'Paris','london':'London'};
    var ESPIL_CITY_DISPLAY={vancouver:'Vancouver Downtown',auckland:'Auckland',tokyo:'Tokyo',newyork:'New York',paris:'Paris',london:'London'};
    /* EARLY DISTRICT FETCH (tiles loading package component 3,
       2026-11-20): the district + collision payloads (about
       6.7 MB of JSON) are the collision judges' only data -
       until they land, the record buckets are empty and no
       wall judgment exists at all (tiles-loading/DIAGNOSIS.md
       verdict 1, the loading window). Their fetch used to
       start at the dive click (espilPreloadCity /
       buildWalkMapOnce); on a fast machine the dive completes
       seconds after the game page loads, so the window stood
       open into the first walk. The fetch now starts when
       this script runs on the game page, for the city this
       load will enter: the landing handoff's pending city
       when one is set (read here, before intro-earth's boot
       poller consumes it - this classic script executes
       before that module), else the direct city-path
       entry's city (the same paths intro-earth's boot
       auto-enters). When neither holds, the city is not
       decided yet on this load and nothing starts early -
       the dive click starts the fetch exactly as before.
       Only the START moves: loadEspilDistrict consumes the
       started promise when its city matches, and the build,
       the consumers and the failure retry are unchanged. */
    var espilDistrictEarly=null;
    (function(){
      if(!window.__ESPIL_GAME_PAGE)return;
      var key=null;
      try{
        var pendingName=sessionStorage.getItem('espil_pending_city');
        if(pendingName&&ESPIL_CITY_KEYS[pendingName]&&ESPIL_CITIES[ESPIL_CITY_KEYS[pendingName]])key=ESPIL_CITY_KEYS[pendingName];
      }catch(e){}
      if(!key){
        try{ key=espilCityKeyFromPath(); }catch(e){}
      }
      if(!key)return;
      var started=espilDistrictFetchAll(ESPIL_CITIES[key]);
      started.catch(function(){}); /* held silently until loadEspilDistrict consumes it; its own catch owns the failure + retry */
      espilDistrictEarly={key:key,promise:started};
    })();
    function espilCityDisplayName(){ return ESPIL_CITY_DISPLAY[espilCityKey()]||'Vancouver Downtown'; }
    /* Ground for offset cities (Auckland phase 1): a land plane under
       the district plus a harbour plane north of the waterfront
       street. Gameplay reads the stored collision map; these planes
       are the visual surface only. */
    /* ==== WATER TEXTURE (Han 2026-11-26 item 6a; visible-water
       build 2026-11-27) ====
       The delivered seamless tile (assets/props/ground/
       water_tile_512.png) on the water a player actually
       sees. The diagnosis behind the shape (water-visible/
       BUILD-REPORT.md, all of it measured on the rig):
       in P1 mode the visible ground is the Mapbox basemap
       alone - espilP1Hide retires every THREE ground plane,
       and it retires any PlaneGeometry whose width is >= 400
       or whose material map image is not a CANVAS (the
       3600 m harbour slab and v1's IMG-textured planes were
       faded to opacity 0 and made invisible). The tile is
       therefore served through a CanvasTexture - canvas-
       backed maps are the hide pass's own exemption - its
       canvas pre-filled with the old flat colour 0x2a6a9e
       until the PNG lands.
       Vancouver has no single water plane: shoreline chunks
       generated none (the old all-water corner test) and the
       baked grid classes the inner harbour 'land' outside a
       thin dock strip. The chunk water is therefore a
       per-chunk overlay of 10 m quads whose corners read
       water on the union sampler (espilWaterCellAt): the
       baked grid first (its 'water'/swimmable classes paint,
       'building'/'roof' veto), then the game's own satellite
       photograph classified per pixel (the basin the grid
       misses: 98.7% photo-water against 3 grid-water samples
       in the measured cross-tab; downtown false positives
       0.000). Isolated single cells are dropped (despeckle).
       One tile covers ESPIL_WATER_TILE_M metres of world
       (DRAFT); the scroll advances every cached texture's
       offset by (+0.004, +0.0017)/s - a slow diagonal drift
       (DRAFT) - driven from animate(), no second rAF loop.
       The materials are Lambert, so the scene's day/night
       lighting treats the water like the character; the
       basemap night tint (a GL layer under the game layer)
       cannot reach these surfaces and is not needed. */
    var ESPIL_WATER_TILE_M=24;
    var espilWaterTexCache={};
    function espilWaterTileTex(rx,ry){
      var key=rx+'x'+ry;
      var t=espilWaterTexCache[key];
      if(t)return t;
      var cv=document.createElement('canvas'); cv.width=512; cv.height=512;
      var cx2=cv.getContext('2d');
      cx2.fillStyle='#2a6a9e'; cx2.fillRect(0,0,512,512);
      t=new THREE.CanvasTexture(cv);
      t.wrapS=t.wrapT=THREE.RepeatWrapping;
      t.repeat.set(rx,ry);
      t.colorSpace=THREE.SRGBColorSpace;
      var img=new Image();
      img.onload=function(){ cx2.drawImage(img,0,0,512,512); t.needsUpdate=true; };
      img.src='assets/props/ground/water_tile_512.png';
      espilWaterTexCache[key]=t;
      return t;
    }
    var espilWaterMatShared=null;
    function espilWaterMat(){
      if(espilWaterMatShared)return espilWaterMatShared;
      espilWaterMatShared=new THREE.MeshLambertMaterial({map:espilWaterTileTex(1,1),transparent:true,opacity:.92});
      return espilWaterMatShared;
    }
    function espilWaterScrollTick(dt){
      if(!(dt>0))return;
      for(var k in espilWaterTexCache){
        var t=espilWaterTexCache[k];
        t.offset.x=(t.offset.x+0.004*dt)%1;
        t.offset.y=(t.offset.y+0.0017*dt)%1;
      }
    }
    /* The satellite photograph as a water sampler. The image
       is the game's own baked ground (satellite_z15.jpg over
       x -5008..5356, z -5521..4854 - the buildWalkMapOnce
       bounds); it is drawn once to a 1664 px canvas when it
       lands (H5) and classified per sample: harbour water in
       this imagery is a dark teal whose green channel clears
       its red by a wide margin (measured: basin samples
       G-R 37..42 against 14 for forest, 5 for rooftops). */
    var espilWaterPhoto=null;
    function espilWaterPhotoArm(img){
      try{
        var S=1664;
        var cv=document.createElement('canvas'); cv.width=S; cv.height=S;
        var cx2=cv.getContext('2d');
        cx2.drawImage(img,0,0,S,S);
        espilWaterPhoto={data:cx2.getImageData(0,0,S,S).data,w:S,h:S};
      }catch(e){ espilWaterPhoto=null; }
    }
    function espilWaterPhotoAt(x,z){
      var P=espilWaterPhoto; if(!P)return false;
      var u=Math.floor((x+5008)/10364*P.w), v=Math.floor((z+5521)/10375*P.h);
      if(u<0||v<0||u>=P.w||v>=P.h)return false;
      var i=(v*P.w+u)*4, r=P.data[i], g=P.data[i+1], b=P.data[i+2];
      return (g-r>=25)&&(b-r>=12)&&(r<=80)&&(g<=130);
    }
    /* One overlay corner's water answer. The baked grid is
       the authority where it reaches: 'water'/swimmable
       paint, 'building'/'roof' veto (land is never painted),
       anything else falls to the photo sampler. Where the
       grid does not reach, isWaterAt's own answer (the
       legacy rectangles) and the photo sampler union. */
    function espilWaterCellAt(x,z){
      var probe=window.__espilCollisionProbe||null;
      var pr=probe?probe(x,z):null;
      if(pr){
        if(pr.cls==='building'||pr.cls==='roof')return false;
        if(pr.cls==='water'||pr.swimmable)return true;
        return espilWaterPhotoAt(x,z);
      }
      return isWaterAt(x,z)||espilWaterPhotoAt(x,z);
    }
    /* Chunk water overlay: quads over one 250 m chunk's water
       cells. A 10 m cell paints only when all four corners
       read water on the union sampler, so shorelines stay
       conservative; a painted cell with no painted neighbour
       is then dropped (despeckle). UVs are world-based
       (metres / ESPIL_WATER_TILE_M), so the tile runs
       continuous across cells and chunks. y = .2, the pre-P1
       chunk water height. */
    function espilBuildChunkWater(x0,z0){
      var N=25, cell=CHUNK_SIZE/N;
      var gw=[], j, i;
      for(j=0;j<=N;j++){
        gw.push([]);
        for(i=0;i<=N;i++)gw[j].push(espilWaterCellAt(x0+i*cell,z0+j*cell));
      }
      var paint=[];
      for(var cj=0;cj<N;cj++){
        paint.push([]);
        for(var ci=0;ci<N;ci++)
          paint[cj].push(!!(gw[cj][ci]&&gw[cj][ci+1]&&gw[cj+1][ci]&&gw[cj+1][ci+1]));
      }
      var pos=[],uv=[],nor=[],idx=[];
      for(var pj=0;pj<N;pj++)for(var pi=0;pi<N;pi++){
        if(!paint[pj][pi])continue;
        var nb=(pi>0&&paint[pj][pi-1])||(pi<N-1&&paint[pj][pi+1])||(pj>0&&paint[pj-1][pi])||(pj<N-1&&paint[pj+1][pi]);
        if(!nb)continue; /* despeckle: isolated single cell */
        var xa=x0+pi*cell, xb=xa+cell, za=z0+pj*cell, zb=za+cell;
        var b=pos.length/3;
        pos.push(xa,.2,za, xb,.2,za, xb,.2,zb, xa,.2,zb);
        uv.push(xa/ESPIL_WATER_TILE_M,za/ESPIL_WATER_TILE_M, xb/ESPIL_WATER_TILE_M,za/ESPIL_WATER_TILE_M, xb/ESPIL_WATER_TILE_M,zb/ESPIL_WATER_TILE_M, xa/ESPIL_WATER_TILE_M,zb/ESPIL_WATER_TILE_M);
        nor.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
        idx.push(b,b+2,b+1, b,b+3,b+2);
      }
      if(!idx.length)return null;
      var g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
      g.setIndex(idx);
      var m=new THREE.Mesh(g,espilWaterMat());
      m.frustumCulled=false;
      return m;
    }
    /* When the satellite photograph lands (H5), chunks that
       generated before it carry grid-only overlays; rebuild
       the loaded set once, the refreshOsmChunks pattern. */
    function refreshWaterChunks(){
      if(typeof chunkMap==='undefined'||!chunkMap)return;
      var keys=[];
      for(var k in chunkMap)keys.push(k);
      keys.forEach(function(key){
        var parts=key.split(',');
        var cx=parseInt(parts[0],10), cz=parseInt(parts[1],10);
        unloadChunk(cx,cz);
        generateChunk(cx,cz);
      });
    }
    function espilBuildCityGround(cfg){
      if(typeof mapScene==='undefined'||!mapScene)return;
      /* Generalized (Tokyo, 2026-10-18; restored with the New York
         wiring, 2026-10-19): the land plane is sized from the city's
         own bounds; the harbour slab is opt-in per city (cfg.harbour)
         - Auckland's numbers carried over exactly, other cities get
         no fake water (their water is the collision raster for
         gameplay and the basemap for looks). */
      var b=cfg.bounds||{x0:cfg.ox-1300,z0:cfg.oz-1600,x1:cfg.ox+1300,z1:cfg.oz+1600};
      var gmat=new THREE.MeshLambertMaterial({color:0x707a63});       var ground=new THREE.Mesh(new THREE.PlaneGeometry((b.x1-b.x0)+800,(b.z1-b.z0)+800,32,32),gmat);
      ground.rotation.x=-Math.PI/2; ground.position.set((b.x0+b.x1)/2,-0.02,(b.z0+b.z1)/2);
      ground.receiveShadow=true; ground.frustumCulled=false; mapScene.add(ground);
      if(cfg.harbour){
        var wmat=new THREE.MeshLambertMaterial({map:espilWaterTileTex(Math.max(1,Math.round(cfg.harbour.w/ESPIL_WATER_TILE_M)),Math.max(1,Math.round(cfg.harbour.d/ESPIL_WATER_TILE_M))),transparent:true,opacity:.92});         var water=new THREE.Mesh(new THREE.PlaneGeometry(cfg.harbour.w,cfg.harbour.d,32,8),wmat);
        water.rotation.x=-Math.PI/2; water.position.set(cfg.ox+cfg.harbour.dx,0.02,cfg.oz+cfg.harbour.dz);
        water.receiveShadow=true; water.frustumCulled=false; mapScene.add(water);
      }
    }
    function espilDistrictFetchAll(cfg){
      return Promise.all([
        fetch(cfg.district).then(function(r){return r.json();}),
        fetch(cfg.collision).then(function(r){return r.json();})
      ]);
    }
    function loadEspilDistrict(){
      if(espilDistrict||espilDistrictLoading)return; espilDistrictLoading=true;
      var cfg=espilCityCfg(); window.__espilLoadedCityKey=espilCityKey();
      var fetchPromise;
      if(espilDistrictEarly&&espilDistrictEarly.key===espilCityKey()){
        fetchPromise=espilDistrictEarly.promise; espilDistrictEarly=null; /* consumed once: the failure retry below fetches fresh */
      }else{
        fetchPromise=espilDistrictFetchAll(cfg);
      }
      fetchPromise.then(function(res){
        espilDistrict=res[0]; espilCollision=res[1];
        espilCollision.cls=espilB64ToU8(espilCollision.classes_b64);
        espilCollision.roof=new Uint16Array((espilCollision.roof_dm_b64?espilB64ToU8(espilCollision.roof_dm_b64):new Uint8Array(0)).buffer); /* slim files omit the roof layer (perf 2026-10-20): no live reader on the Mapbox line */
        var nStrips=0, strips=espilCollision.colliders||[];
        espilStripHash={};
        for(var i=0;i<strips.length;i++){
          var st=strips[i];
          /* Han 2026-10-16 (PC feedback #12): the core is NO LONGER
             excluded - the district law (polygon mesh + stored strips)
             covers the core too, so every visible roof is standable
             and nothing invisible holds the player up downtown. */
          espilStripInsert({x0:st[0]-st[2]+cfg.ox,x1:st[0]+st[2]+cfg.ox,z0:st[1]-st[3]+cfg.oz,z1:st[1]+st[3]+cfg.oz,bottom:0,top:st[4],espilStrip:true});
          nStrips++;
        }
        window.__espilStripCount=nStrips;
        espilPolyBuild();
        espilBuildDistrictMeshes();
        if(!cfg.core)espilBuildCityGround(cfg);
        espilDistrictBuilt=true;
        console.log('[District] sample built: '+espilDistrict.buildings.length+' polygon buildings in file, '+nStrips+' stored collision strips registered');
      }).catch(function(e){ console.warn('[District] load failed, will retry:',e); espilDistrictLoading=false; });
    }
    /* Probe the stored collision map (class + rules + roof height). */
    window.__espilCollisionProbe=function(x,z){
      if(!espilCollision||!espilCollision.cls)return null;
      var cfg=espilCityCfg(); x-=cfg.ox; z-=cfg.oz;
      var c=espilCollision, cx=Math.floor((x-c.origin[0])/c.cell), cz=Math.floor((z-c.origin[1])/c.cell);
      if(cx<0||cz<0||cx>=c.w||cz>=c.h)return null;
      var i=cz*c.w+cx, pal=c.palette[c.cls[i]]||{};
      return {cls:pal.name||c.cls[i], walkable:!!pal.walkable, blocked:!!pal.blocked, swimmable:!!pal.swimmable, roofH:(c.roof[i]||0)/10};
    };
    /* Texture-ready material registry (Han 2026-10-16): district
       materials are created ONCE per archetype and referenced by the
       merged meshes in two slots (wall / roof). Swapping a texture
       later is a pure map change on a registry entry - geometry is
       never rebuilt. Roof materials start on a 1x1 white placeholder
       map so the slot (and its shader) exists from day one; the
       baked vertex colors act as the tint layer under any future
       map. Exposed for tooling as window.__espilDistrictMaterials. */
    var espilDistrictMats=null;
    var ESPIL_TILE={tower:[28.8,24],midrise:[21.6,24],lowrise:[18,24],warehouse:[14.4,12],house:[10.8,12]}; /* sized to the building_texture kit facades (tools/compose_facades.py) */
    var ESPIL_ROOF_BASE={tower:0x4c4a48,midrise:0x5a4636,lowrise:0x8a6f4d,warehouse:0x55584e,house:0x7a5b40};
    function espilDistrictMaterials(){
      if(espilDistrictMats)return espilDistrictMats;
      var wc=document.createElement('canvas'); wc.width=wc.height=1;
      var wg2=wc.getContext('2d'); wg2.fillStyle='#ffffff'; wg2.fillRect(0,0,1,1);
      var whiteTex=new THREE.CanvasTexture(wc);
      var reg={};
      for(var k in ESPIL_ROOF_BASE){
        /* Han 2026-10-16: facade TEXTURES OFF - he judged the applied
           textures a defect and ordered the untextured build as the
           starting point. The registry structure (slots, world-scale
           UVs) stays in place dormant: ESPIL_FACADE_TEXTURES=false
           means no map is created or loaded; flipping it back
           re-enables textures with no geometry rework. */
        var wm=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
        var rm=new THREE.MeshLambertMaterial({map:whiteTex,vertexColors:true,side:THREE.DoubleSide});
        espilOccludePatchMat(wm); espilOccludePatchMat(rm); /* wall-occlusion cutout: buildings only (Han 2026-11-03) */
        reg[k]={wall:wm,roof:rm};
      }
      espilDistrictMats=reg; window.__espilDistrictMaterials=reg;
      return reg;
    }
    var espilMeshBuildState=null;
    function espilBuildDistrictMeshes(){
      if(window.__espilDistrictMeshesBuilt)return;
      if(espilMeshBuildState)return; /* a staged build is already running */
      if(!espilDistrict||typeof mapScene==='undefined'||!mapScene)return;
      var mats=espilDistrictMaterials();
      var palette=[0xd9b678,0xd4b183,0xcf9f6b,0xdbbd8a,0xd6a86f];
      var wallAcc={}, roofAcc={};
      function accFor(store,k){ if(!store[k])store[k]={pos:[],nor:[],col:[],uv:[]}; return store[k]; }
      function tri(acc,ax,ay,az,bx,by,bz,cx,cy,cz,nx,ny,nz,r,g,b,uvs){
        acc.pos.push(ax,ay,az,bx,by,bz,cx,cy,cz);
        acc.nor.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
        acc.col.push(r,g,b,r,g,b,r,g,b);
        acc.uv.push(uvs[0],uvs[1],uvs[2],uvs[3],uvs[4],uvs[5]);
      }
      function srcGeom(acc,geom,r,g,b){
        var g2=geom.toNonIndexed(), pa=g2.getAttribute('position'), na=g2.getAttribute('normal');
        for(var vi=0;vi<pa.count;vi++){
          acc.pos.push(pa.getX(vi),pa.getY(vi),pa.getZ(vi));
          acc.nor.push(na.getX(vi),na.getY(vi),na.getZ(vi));
          acc.col.push(r,g,b);
          acc.uv.push(pa.getX(vi)/10,pa.getZ(vi)/10); /* world-scale roof UV */
        }
        g2.dispose();
      }
      var blds=espilDistrict.buildings;
      /* Staged build (Han 2026-10-18, loader-lag verdict): the merged
         mesh build used to run as ONE synchronous block over all
         buildings inside the loader window, freezing the glass loader's
         own animation for its whole duration. It now advances ~200
         buildings per macrotask and yields in between, so the loader
         (and the page) keeps breathing; the completion contract is
         unchanged (window.__espilDistrictMeshesBuilt flips only when
         every mesh is in the scene). */
      var st={bi:0}; espilMeshBuildState=st;
      function step(){
      var tEnd=Math.min(blds.length,st.bi+200);
      for(var bi=st.bi;bi<tEnd;bi++){
        var b=blds[bi], ring=b.p, h=b.h;
        if(!ring||ring.length<3||h<=0)continue;
        var cx=0,cz=0,mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9,area2=0;
        for(var i0=0;i0<ring.length;i0++){ var q=ring[i0]; cx+=q[0]; cz+=q[1];
          if(q[0]<mnx)mnx=q[0]; if(q[0]>mxx)mxx=q[0]; if(q[1]<mnz)mnz=q[1]; if(q[1]>mxz)mxz=q[1]; }
        var npt=ring.length-((ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1])?1:0);
        cx/=npt; cz/=npt;
        if(b.w)continue; /* stands on water (>=50% footprint): not built (Han 2026-10-16) */
        /* (PC feedback #12, 2026-10-16): the core square is built too -
           one law everywhere: visible polygon = standable surface. */
        for(var i1=0;i1<ring.length-1;i1++)area2+=ring[i1][0]*ring[i1+1][1]-ring[i1+1][0]*ring[i1][1];
        var area=Math.abs(area2)/2, bw=mxx-mnx, bd=mxz-mnz;
        var kind=h>=60?'tower':(h>=25?'midrise':(h>=12?'lowrise':(area>=300?'warehouse':'house')));
        var tile=ESPIL_TILE[kind];
        var tint=new THREE.Color(palette[(bi*7)%palette.length]);
        var tv=.82+((bi*37)%20)/100;
        var wr=tint.r*tv*.55+.45*tv, wg=tint.g*tv*.55+.45*tv, wb=tint.b*tv*.55+.45*tv; /* untextured build: the sandy palette tints the walls directly (Han 2026-10-16, textures off) */
        /* walls: one quad per polygon edge, world-scale facade UVs */
        var acc=accFor(wallAcc,kind), cum=0;
        for(var ei=0;ei<ring.length-1;ei++){
          var ax=ring[ei][0],az=ring[ei][1],bx2=ring[ei+1][0],bz2=ring[ei+1][1];
          var ex=bx2-ax,ez=bz2-az,el=Math.hypot(ex,ez); if(el<.01)continue;
          var mxp=(ax+bx2)/2-cx,mzp=(az+bz2)/2-cz,ml=Math.hypot(mxp,mzp)||1;
          var nx=mxp/ml,nz=mzp/ml;
          var u0=cum/tile[0],u1=(cum+el)/tile[0]; cum+=el;
          var v1=h/tile[1];
          tri(acc, ax,0,az, bx2,0,bz2, bx2,h,bz2, nx,0,nz, wr,wg,wb, [u0,0, u1,0, u1,v1]);
          tri(acc, ax,0,az, bx2,h,bz2, ax,h,az, nx,0,nz, wr,wg,wb, [u0,0, u1,v1, u0,v1]);
        }
        /* roof slot: ONE flat cap at exactly h (Han 2026-10-16, PC
           feedback #12 - reconstruction). The parapet, penthouse and
           hip variants are removed: their visible surfaces disagreed
           with the collision plane (hip apex up to +2.2 m over the
           flat support at h), so roofs read as platforms where the
           walker had no matching foothold. Now the visible roof IS
           the standing surface, everywhere, at every angle. */
        var racc=accFor(roofAcc,kind);
        var rc=new THREE.Color(ESPIL_ROOF_BASE[kind]), rv=.9+((bi*29)%16)/100;
        var rr=rc.r*rv,rg=rc.g*rv,rb=rc.b*rv;
        var shape=new THREE.Shape();
        for(var si=0;si<npt;si++){ var sp=ring[si]; if(si===0)shape.moveTo(sp[0],-sp[1]); else shape.lineTo(sp[0],-sp[1]); }
        shape.closePath();
        var sg=new THREE.ShapeGeometry(shape); sg.rotateX(-Math.PI/2); sg.translate(0,h,0);
        srcGeom(racc,sg,rr,rg,rb); sg.dispose();
      }
      st.bi=bi;
      if(st.bi<blds.length){ setTimeout(step,0); return; }
      finishBuild();
      }
      function finishBuild(){
      function finishMesh(acc,mat){
        var g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(acc.pos,3));
        g.setAttribute('normal',new THREE.Float32BufferAttribute(acc.nor,3));
        g.setAttribute('color',new THREE.Float32BufferAttribute(acc.col,3));
        g.setAttribute('uv',new THREE.Float32BufferAttribute(acc.uv,2));
        var m=new THREE.Mesh(g,mat); m.castShadow=true; m.receiveShadow=true; m.userData.espilDistrict=1;
        mapScene.add(m); return m;
      }
      window.__espilDistrictMeshes=[];
      for(var kind2 in wallAcc){ if(wallAcc[kind2].pos.length)window.__espilDistrictMeshes.push(finishMesh(wallAcc[kind2],mats[kind2].wall)); }
      for(var kind3 in roofAcc){ if(roofAcc[kind3].pos.length)window.__espilDistrictMeshes.push(finishMesh(roofAcc[kind3],mats[kind3].roof)); }
      var dcfg=espilCityCfg();
      if(dcfg.ox||dcfg.oz)for(var dmi=0;dmi<window.__espilDistrictMeshes.length;dmi++)window.__espilDistrictMeshes[dmi].position.set(dcfg.ox,0,dcfg.oz);
      window.__espilDistrictMeshesBuilt=true;
      espilMeshBuildState=null;
      }
      step();
    }
    var espilPreloading=false;
    function espilPreloadCity(){
      /* Loading work only (Han PC verdict 2026-10-19 #2): the district
         fetch, mesh build, avatar/map preload and the progress signals
         start at the DIVE click, in parallel with the entry gate, so
         the wait after the last gate step is short and the glass -
         when it takes the screen at entry - already stands at the
         real progress. Idempotent: a second call changes nothing. */
      if(espilPreloading&&espilLoaderIv)return;
      if(!espilPreloading){
        espilPreloading=true;
        espilLoaderShownAt=Date.now();
        window.__espilCityProgress01=0; window.__espilCitySettledFlag=false;
        if(ESPIL_P1)window.__espilMapProgress01=0; /* UI-room loader contract (2026-10-17): the map signal resets with the other indicators */
        if(ESPIL_P1)espilP1Preload(); /* map preload (Han, 2026-10-17): Mapbox init runs parallel to the city preload from here */
      }
      if(espilLoaderIv)clearInterval(espilLoaderIv);
      espilLoaderIv=setInterval(function(){
        if(!espilDistrictBuilt)loadEspilDistrict();
        else if(!window.__espilDistrictMeshesBuilt)espilBuildDistrictMeshes(); /* data in, meshes pending (mapScene was not ready at fetch time) */
        window.__espilCityProgress01=espilCityProgress();
        if(espilCitySettled())window.__espilCitySettledFlag=true;
      },120);
    }
    window.__espilPreloadCityEntry=function(){ espilPreloadCity(); };
    function espilShowMapLoader(){
      var el=document.getElementById('loader'); if(!el)return;
      el.classList.remove('done'); el.classList.remove('seg-a'); el.classList.add('show');
      if(!espilPreloading){ el.style.setProperty('--p',0); }
      var pct=document.getElementById('loader-pct'); if(pct)pct.textContent='0';
      var st=document.getElementById('loader-status'); if(st)st.textContent='Opening the map';
      espilPreloadCity();
      /* the v10 standard driver + liquid physics, started by the bridge */
      if(window.__espilStartMapLoader)window.__espilStartMapLoader();
      if(window.__espilStartLoaderPhysics)window.__espilStartLoaderPhysics();
    }
    function espilHideMapLoader(){
      /* The v10 driver finishes itself once the settled flag is set
         (its own fade into .done); the bridge drops the visibility
         gate shortly after so the element leaves the screen. */
      window.__espilCitySettledFlag=true;
      if(espilLoaderIv){ clearInterval(espilLoaderIv); espilLoaderIv=null; }
      setTimeout(function(){ var el=document.getElementById('loader'); if(el)el.classList.remove('show'); },1200);
    }
    window.__espilMapLoaderDone=function(){
      var el=document.getElementById('loader'); if(el)el.classList.remove('show');
    };
    function espilWatchLoaderSettle(){
      var t0=Date.now();
      (function w(){
        if(espilCitySettled()&&Date.now()-espilLoaderShownAt>=800){ espilHideMapLoader(); return; }
        if(Date.now()-t0>25000){ espilHideMapLoader(); return; }
        setTimeout(w,250);
      })();
    }
    function espilEntryFullyLoaded(){
      /* Han 2026-10-28: the final glass loading sequence loads as
         much as possible before the dive - city settled (district
         data + meshes), the Mapbox layer live, AND the player's own
         avatar fully in - so play starts with the least lag. */
      try{
        if(!espilCitySettled()||!espilP1EntryLive())return false;
        if(walkPlayer&&walkPlayer.av&&!walkPlayer.av.ready)return false;
        return true;
      }catch(e){ return true; }
    }
    /* RESUME EDGE RULE (Han 2026-11-11): a saved resume point that
       lies inside a baked building footprint used to dive onto the
       ROOF (the surface law answers the record's h there - the
       "resume stall" the marketing captures showed was a normal
       rooftop landing read as a hang). Han's ruling: resume at the
       footprint's EDGE on the ground instead. Rule, exactly:
       - The lookup is the surface law's own store: the baked
         district records in espilPolyHash, probed with
         espilPolyProbe (signed distance, negative inside). A point
         needs relocation only when espilOwnSurfaceY(x, z) > 0,
         i.e. the dive base would be a roof.
       - Push out iteratively: probe the bucket at the current
         point; among records with h > 0 whose signed distance is
         <= PLAYER_R (the same reach the surface law's COLOR-KEY
         branch uses to claim the roof), take the one with the
         LARGEST d (nearest edge); move to that record's closest
         ring point (probe cx, cz) pushed outward along the probe's
         outward unit normal by PLAYER_R + 0.45 = 1.0 m - just past
         the roof-claim reach, so the surface law at the new point
         answers ground. Re-probe from the new point (a neighbour
         footprint can bind next); at most 8 pushes.
       - Accept only a point whose espilOwnSurfaceY is exactly 0
         and that stays inside cfg.bounds; otherwise return null
         and the resume proceeds exactly as before (roof included).
       Out-of-footprint points return null on the first surface
       check, so ordinary resumes and the guest pinned spawn are
       untouched. The witness window.__espilLastResumeRelocate is
       set only when a relocation actually happens. */
    function espilResumeEdgePoint(x,z){
      try{
        if(espilOwnSurfaceY(x,z)<=0)return null;
        var cfg=espilCityCfg(), b=cfg&&cfg.bounds;
        var px=x, pz=z;
        for(var step=0; step<8; step++){
          if(espilOwnSurfaceY(px,pz)<=0){
            if(b&&(px<b.x0||px>b.x1||pz<b.z0||pz>b.z1))return null;
            return {x:px, z:pz};
          }
          var pb=espilPolyBucketAt(px,pz); if(!pb)return null;
          var bind=null, bindD=-1e18;
          for(var i=0;i<pb.length;i++){
            var rec=pb[i]; if(!(rec.h>0))continue;
            var pr=espilPolyProbe(rec,px,pz);
            if(pr.d<=PLAYER_R&&pr.d>bindD){ bindD=pr.d; bind={rec:rec, pr:pr}; }
          }
          if(!bind)return null;
          px=bind.pr.cx+bind.pr.nx*(PLAYER_R+0.45);
          pz=bind.pr.cz+bind.pr.nz*(PLAYER_R+0.45);
        }
        if(espilOwnSurfaceY(px,pz)<=0){
          if(b&&(px<b.x0||px>b.x1||pz<b.z0||pz>b.z1))return null;
          return {x:px, z:pz};
        }
        return null;
      }catch(e){ return null; }
    }
    function espilEntryStart(){
      var p=walkPlayer; if(!p)return;
      /* PLACE SPACE (Han 2026-11-16, design 10-2): a place-space
         arrival (the boot shell's mark in this window's
         sessionStorage) skips the saved-position restore AND the
         dive - the player is placed on the ground at the arrival
         pick and the place-space module summons them into the
         building's own space from there. No espil-arrival /
         espil-guide 'arrival' event fires on this path, so the
         arrival-armed world systems stay down in the child window
         (design 9-5); presence never connects (its own lock in
         presence.js is the second bolt). */
      var placeMark=null;
      try{ placeMark=JSON.parse(sessionStorage.getItem('espil_store_space_v1')||'null'); }catch(e){}
      if(placeMark&&placeMark.city&&placeMark.slug){ espilPlaceEntryStart(); return; }
      var cfg=espilCityCfg();
      var target=null;
      var locPick=null; try{ locPick=window.__espilSpawnPick||null; window.__espilSpawnPick=null; }catch(e){}
      /* ENTRY FLOW V2 (Han 2026-11-24, entry-v2/DESIGN.md 6.3):
         entry never reads espil_last_pos. The location gate now
         hands every account entry an explicit city-centre pick,
         and the entrant branch below summons guests at the
         landmark without one - so the saved-position read runs
         only on the no-pick fallback (the gate module absent),
         where the pre-v2 resume stands exactly as before. The
         in-game WRITE (saveLastPos) is kept: the build-time
         census (entry-v2/BUILD-REPORT.md) found no other reader,
         and the design leaves a write-only record's retirement
         to a later cycle rather than this package. */
      var last=null; if(!locPick&&!espilGuestNow()){ try{ last=loadLastPos(); }catch(e){} }
      /* NAME-ONLY ENTRY (Han 2026-11-24): an entrant summons at the
         entered city's landmark on EVERY entry (Play and Shop
         alike - both dive through here): the saved-position resume
         and the location-options pick are account geography and
         are set aside for the entrant population. Account spawns
         are untouched. The one exemption is the landmark arena
         handoff: the activity list's arena row reloads with the
         handoff mark, and this entry is then an ordinary gallery
         entry (spawn at cfg.spawn, village rules suspended for
         this page load) so the portal 8 m away is reachable. */
      var lmTarget=null;
      if(espilGuestNow()){
        var arenaHandoff=false;
        try{
          var hm=JSON.parse(sessionStorage.getItem('espil_arena_handoff_v1')||'null');
          if(hm){ sessionStorage.removeItem('espil_arena_handoff_v1'); if(hm.city===espilCityKey()&&Date.now()-(hm.at||0)<5*60*1000)arenaHandoff=true; }
        }catch(e){}
        espilVillageSuspended=arenaHandoff;
        if(arenaHandoff){ last=null; locPick=null; lmTarget={x:cfg.spawn.x,z:cfg.spawn.z}; }
        else if(cfg.landmark&&cfg.landmark.arrival==='boat'&&cfg.landmark.boatArea&&cfg.landmark.landSummon){
          /* BOAT OWNERSHIP + DIRECTIVE 3 (Han 2026-11-25): the
             first summon is never on water. A boat-arrival
             city's guest now summons ON LAND at the registry's
             landSummon (the Canada Place promenade), their
             owned boat already in the bag; the water spawn and
             the __espilBoatArrival hand-off are retired as the
             entry path - the guest's first auto-board, at their
             own first water entry, is the arrival's successor,
             and boat.js's course stays dormant with no caller.
             The arena handoff above stays exempt - that entry
             is an ordinary gallery entry, not an arrival. */
          last=null; locPick=null; lmTarget={x:cfg.landmark.landSummon.x,z:cfg.landmark.landSummon.z};
        }
        else if(cfg.landmark){ last=null; locPick=null; lmTarget={x:cfg.landmark.x,z:cfg.landmark.z}; }
      }
      if(last&&!locPick){
        /* Returning player INSIDE the downtown boundary: resume at the
           saved spot, no descent (unchanged). The loader still covers
           the tile loading interval and closes on settle. */
        var inside=cfg.bounds?(last.x>=cfg.bounds.x0&&last.x<=cfg.bounds.x1&&last.z>=cfg.bounds.z0&&last.z<=cfg.bounds.z1):espilInBoundary(last.x,last.z,1); /* Han PC verdict 2026-10-19 #9: the resume test is the playable extent (cfg.bounds); the downtown boundary polygon now only resolves OUT-of-extent saves (option B below) */
        if(inside){
          /* Han 2026-10-21 (reporting room): ALL city entries dive -
             an in-bounds resume now also drops the last 25 m onto the
             saved spot once the city is ready (supersedes the
             2026-10-19 no-descent resume). */
          espilEntrySpawn={x:last.x,z:last.z};
          espilShowMapLoader();
          var rtries=0;
          var resumeDive=function(){
            /* Resume edge rule (Han 2026-11-11, espilResumeEdgePoint
               above): a saved point inside a building footprint
               dives to that footprint's edge at ground level, not
               onto its roof. Computed here, at dive time, when the
               district data the lookup needs is loaded; a null
               answer (out-of-footprint, or no ground point found)
               resumes at the saved spot exactly as before. */
            var rp=espilResumeEdgePoint(last.x,last.z);
            var dx=rp?rp.x:last.x, dz=rp?rp.z:last.z;
            if(rp){
              window.__espilLastResumeRelocate={from:{x:last.x,z:last.z},to:{x:dx,z:dz},at:Date.now()};
              espilEntrySpawn={x:dx,z:dz};
            }
            espilHideMapLoader();
            espilBeginDiveArrival(dx,dz);
          };
          (function resumeDiveWhenReady(){
            if(!walkPlayer)return;
            if(espilEntryFullyLoaded()){ resumeDive(); return; }
            if(++rtries>125){ resumeDive(); return; }
            setTimeout(resumeDiveWhenReady,200);
          })();
          return;
        }
        /* Han 2026-10-15 (option B): a saved position OUTSIDE the
           boundary is treated as a fresh entry - resolve to the
           nearest boundary land point and re-run the full descent
           (geolocation pre-prompt included) over it. */
        target=espilResolveSpawn({x:last.x,z:last.z});
      } else {
        target=lmTarget?lmTarget:(locPick?{x:locPick.x,z:locPick.z}:(cfg.core?{x:p.pos.x,z:p.pos.z}:{x:cfg.spawn.x,z:cfg.spawn.z})); /* Han 2026-10-28: an explicit arrival pick beats the default spawn; NAME-ONLY ENTRY (2026-11-24): the landmark target beats both, for the entrant population only */
      }
      /* Han 2026-10-15: on a cold first load the descent scene was
         over before the world had finished loading (the character and
         its dive clip stream in last). The descent now WAITS until
         the avatar is ready before it starts, UI held down meanwhile;
         a failsafe keeps a stuck load from ever blocking entry. */
      espilInjectStyle();
      document.body.classList.add('espil-ui-pre');
      p.pos.x=target.x; p.pos.z=target.z; p.pos.y=0;
      /* NAME-ONLY ENTRY: a landmark summon lands facing the
         landmark subject (the registry's face yaw); the handoff
         entry keeps the gallery's ordinary facing. */
      if(lmTarget&&cfg.landmark&&lmTarget.x===cfg.landmark.x&&lmTarget.z===cfg.landmark.z&&typeof cfg.landmark.face==='number')walkCamYaw=cfg.landmark.face;
      espilEntrySpawn={x:target.x,z:target.z};
      espilShowMapLoader();
      var tries=0;
      (function beginWhenReady(){
        if(!walkPlayer)return;
        /* Han 2026-10-16: the descent starts only when the own
           city is ready (avatar in, OSM city built, spawn chunk
           present) - the loader closes on this same tick, so the
           fall is the first thing seen. */
        if(espilEntryFullyLoaded()){ espilHideMapLoader(); espilBeginDiveArrival(target.x,target.z); return; }
        if(++tries>125){ espilHideMapLoader(); espilBeginDiveArrival(target.x,target.z); return; } /* 25 s failsafe */
        setTimeout(beginWhenReady,200);
      })();
    }
    /* --- wall climbing (Han 2026-10-15, approved draft): a slow
       crawl up building walls. Walls are the game's own building
       colliders (downtown list + nearby chunk lists); the tile layer
       stays visual only. Walking into a wall attaches; ArrowUp climbs
       at the character's ground run speed, ArrowLeft/Right move
       along the wall at 0.6 of that, ArrowDown slides down at the
       same speed; Space jumps off the wall, pushing away detaches;
       the top steps onto the roof. Colliders under
       4 m tall or thinner than 1.5 m are not walls. The Meshy climb
       clip wires in as the 'climb' action when the asset room
       delivers it; the step prefers it automatically. --- */
    function espilClimbCandidates(p){
      var out=[];
      if(!ESPIL_P1)for(var i=0;i<walkColliders.length;i++)out.push(walkColliders[i]); /* MAPBOX PHASE 1: store only */
      if(!ESPIL_P1){ var csb=espilStripBucketAt(p.pos.x,p.pos.z);
      if(csb)for(var ci2=0;ci2<csb.length;ci2++)out.push(csb[ci2]); } /* MAPBOX PHASE 1: polygon edges via espilTryAttachClimbPoly */
      if(!ESPIL_P1){
      var pcx=Math.floor(p.pos.x/CHUNK_SIZE),pcz=Math.floor(p.pos.z/CHUNK_SIZE);
      for(var ox=-1;ox<=1;ox++)for(var oz=-1;oz<=1;oz++){
        var arr=chunkColliders[(pcx+ox)+','+(pcz+oz)];
        if(arr)for(var j=0;j<arr.length;j++)out.push(arr[j]);
      }
      }
      return out;
    }
    function espilClimbTileOff(p){ return (p._tileBase!==null&&p._tileBase!==undefined)?(p._tileBase-.05):0; }
    /* COLOR-KEY CLIMB (Han 2026-10-17): on the Mapbox line a wall is
       a polygon EDGE of a building record. The climb state carries
       the edge's unit outward normal (nx,nz) and unit tangent
       (tx,tz); lo/hi are tangent coordinates (pos . t) widened
       across collinear edge chains of the same ring, so one real
       wall climbs as one wall, corners stop the travel. */
    function espilTryAttachClimbPoly(p,mx,mz){
      var off=espilClimbTileOff(p), base=p.pos.y;
      var bucket=espilPolyBucketAt(p.pos.x,p.pos.z);
      if(!bucket)return false;
      var best=null;
      for(var bi=0;bi<bucket.length;bi++){
        var rec=bucket[bi], eTop=off+rec.h;
        if(eTop-base<4)continue;
        if(0>base+.8)continue;
        var ring=rec.ring, n=ring.length;
        for(var ei=0;ei<n;ei++){
          var a=ring[ei], b=ring[(ei+1)%n];
          var ex=b[0]-a[0], ez=b[1]-a[1], L=Math.sqrt(ex*ex+ez*ez);
          if(L<1.5)continue;
          var tx=ex/L, tz=ez/L;
          var nx=ez/L, nz=-ex/L;
          if((rec.cx-a[0])*nx+(rec.cz-a[1])*nz>0){nx=-nx;nz=-nz;}
          var rx=p.pos.x-a[0], rz=p.pos.z-a[1];
          var s=rx*tx+rz*tz;
          if(s<.1||s>L-.1)continue;
          var dl=rx*nx+rz*nz;
          /* Attach window (Han PC QA 2026-10-18 follow-up): the low end
             was PLAYER_R-0.05 (0.50 m), but axis-separated collision
             leaves the centre at R*cos of the face angle on ANGLED
             walls - about 0.48-0.50 m - so airborne contact on diagonal
             faces never attached (measured: 12 attempts, 0 passes).
             The attach snaps the centre to PLAYER_R+0.02 along the
             normal, so accepting contact down to 0.25 m is safe. */
          if(dl<PLAYER_R-.30||dl>PLAYER_R+.45)continue;
          if(-(mx*nx+mz*nz)<.45)continue;
          if(!best||dl<best.dl)best={rec:rec,ei:ei,nx:nx,nz:nz,tx:tx,tz:tz,dl:dl,eTop:eTop};
        }
      }
      if(!best)return false;
      var rec2=best.rec, ring2=rec2.ring, n2=ring2.length;
      var a2=ring2[best.ei], s0=a2[0]*best.tx+a2[1]*best.tz;
      var sLo=0, sHi=0, guard=0;
      var idx=best.ei;
      var cur=ring2[idx], nxt=ring2[(idx+1)%n2];
      sHi=Math.sqrt((nxt[0]-cur[0])*(nxt[0]-cur[0])+(nxt[1]-cur[1])*(nxt[1]-cur[1]));
      var fwd=idx;
      while(guard++<64){
        var v=ring2[(fwd+1)%n2], w=ring2[(fwd+2)%n2];
        var e2x=w[0]-v[0], e2z=w[1]-v[1], L2=Math.sqrt(e2x*e2x+e2z*e2z);
        if(L2<.01)break;
        var cross=best.tx*(e2z/L2)-best.tz*(e2x/L2), dot=best.tx*(e2x/L2)+best.tz*(e2z/L2);
        if(Math.abs(cross)>.02||dot<.999)break;
        sHi+=L2; fwd=(fwd+1)%n2;
      }
      guard=0; var bwd=idx;
      while(guard++<64){
        var v2=ring2[bwd], w2=ring2[(bwd-1+n2)%n2];
        var e3x=v2[0]-w2[0], e3z=v2[1]-w2[1], L3=Math.sqrt(e3x*e3x+e3z*e3z);
        if(L3<.01)break;
        var cross3=best.tx*(e3z/L3)-best.tz*(e3x/L3), dot3=best.tx*(e3x/L3)+best.tz*(e3z/L3);
        if(Math.abs(cross3)>.02||dot3<.999)break;
        sLo-=L3; bwd=(bwd-1+n2)%n2;
      }
      p._espilClimb={poly:true,nx:best.nx,nz:best.nz,tx:best.tx,tz:best.tz,lo:s0+sLo,hi:s0+sHi,base:base,top:best.eTop,h:0};
      p.pos.x+=best.nx*((PLAYER_R+.02)-best.dl);
      p.pos.z+=best.nz*((PLAYER_R+.02)-best.dl);
      return true;
    }
    function espilTryAttachClimb(p,mx,mz){
      if(!ESPIL_ROOF_ACCESS)return false; /* COLLISION DISABLE (Han 2026-11-25, directive 5): no climb attach while roof access is off - see the flag at ESPIL_P1 */
      if(ESPIL_P1)return espilTryAttachClimbPoly(p,mx,mz);
      var off=espilClimbTileOff(p), base=p.pos.y, list=espilClimbCandidates(p), best=null;
      for(var i=0;i<list.length;i++){
        var c=list[i];
        if((c.x1-c.x0)<1.5&&(c.z1-c.z0)<1.5)continue; /* a pebble on both axes is not a wall; thin scanline strips (1 m rows) still present real faces - the face span itself is checked in the loop below (fix 2026-10-16: the both-axes test rejected every 1 m strip and made district walls unclimbable) */
        var eTop=off+c.top, eBot=off+c.bottom;
        if(eTop-base<4)continue;
        if(eBot>base+.8)continue;
        var faces=[
          {nx:-1,nz:0,plane:c.x0,axis:'x',lo:c.z0,hi:c.z1},
          {nx:1,nz:0,plane:c.x1,axis:'x',lo:c.z0,hi:c.z1},
          {nx:0,nz:-1,plane:c.z0,axis:'z',lo:c.x0,hi:c.x1},
          {nx:0,nz:1,plane:c.z1,axis:'z',lo:c.x0,hi:c.x1}
        ];
        for(var f=0;f<4;f++){
          var F=faces[f];
          if(F.hi-F.lo<1.5)continue; /* the presented face must span at least 1.5 m */
          var along=(F.axis==='x')?p.pos.z:p.pos.x;
          if(along<F.lo+.1||along>F.hi-.1)continue;
          var d=(F.axis==='x')?(p.pos.x-F.plane)*F.nx:(p.pos.z-F.plane)*F.nz;
          if(d<PLAYER_R-.05||d>PLAYER_R+.45)continue;
          if(-(mx*F.nx+mz*F.nz)<.45)continue;
          if(!best||d<best.d)best={F:F,d:d,eTop:eTop};
        }
      }
      if(!best)return false;
      var F=best.F;
      /* Widen the face span across coplanar seams: the stored-map
         strips segment one real wall into many boxes, and the climb
         must travel the whole wall, not one strip. */
      var wLo=F.lo,wHi=F.hi,widened=true,guard=0;
      while(widened&&guard++<24){
        widened=false;
        for(var wi=0;wi<list.length;wi++){
          var wc=list[wi];
          var wTop=off+wc.top;
          if(Math.abs(wTop-best.eTop)>.15)continue;
          var wPlane=(F.axis==='x')?((F.nx<0)?wc.x0:wc.x1):((F.nz<0)?wc.z0:wc.z1);
          if(Math.abs(wPlane-F.plane)>.03)continue;
          var wlo=(F.axis==='x')?wc.z0:wc.x0, whi=(F.axis==='x')?wc.z1:wc.x1;
          if(wlo<wLo+.01&&whi>wLo-2.3){wLo=wlo;widened=true;}
          if(whi>wHi-.01&&wlo<wHi+2.3){wHi=whi;widened=true;}
        }
      }
      p._espilClimb={nx:F.nx,nz:F.nz,axis:F.axis,plane:F.plane,lo:wLo,hi:wHi,base:base,top:best.eTop,h:0};
      if(F.axis==='x')p.pos.x=F.plane+F.nx*(PLAYER_R+.02); else p.pos.z=F.plane+F.nz*(PLAYER_R+.02);
      return true;
    }
    function espilClimbDetach(p,pop){
      var cl=p._espilClimb; if(!cl)return;
      p._espilClimb=null;
      p.pos.x+=cl.nx*.35; p.pos.z+=cl.nz*.35;
      p.velY=pop?7.5:0; p.onGround=false;
    }
    function espilClimbStep(p,dt){
      /* wall-jump outward drift (set by the jump branch below) */
      if(p._espilWallDrift){
        var wd=p._espilWallDrift; wd.t-=dt;
        p.pos.x+=wd.nx*5.5*dt; p.pos.z+=wd.nz*5.5*dt;
        if(wd.t<=0)p._espilWallDrift=null;
      }
      var ix=0,iz=0;
      if(walkKeys['arrowup'])iz-=1; if(walkKeys['arrowdown'])iz+=1;
      if(walkKeys['arrowleft'])ix-=1; if(walkKeys['arrowright'])ix+=1;
      if(window.__joyVec){ix+=window.__joyVec.x;iz+=window.__joyVec.y;}
      var fx=-Math.sin(walkCamYaw),fz=-Math.cos(walkCamYaw);
      var rx=-fz,rz=fx;
      var mx=fx*(-iz)+rx*ix, mz=fz*(-iz)+rz*ix;
      var cl=p._espilClimb;
      if(!cl){
        /* Han 2026-10-16: climbing starts ONLY from airborne wall
           contact - jump or fall into a wall while pressing toward
           it. Grounded walk-in contact just blocks (collideCircleAxis
           handles it); the old grounded grapple is discarded. */
        if(!p.onGround&&!p.swimming&&!p._espilArrive&&(ix||iz))espilTryAttachClimb(p,mx,mz);
        return;
      }
      /* Space wall jump: the trigger moved to the Space keydown
         (espilSpaceWallJump) on 2026-10-19 - Cauldron calls its wall
         jump from the keydown (EspilPort.onSpace) rather than polling
         a held key, so a press held since before the attach no longer
         fires it the instant the climb starts. */
      /* Detach-away must not eat the slide-down input: with the camera
         behind the character, ArrowDown points away from the wall AND
         means slide. Away-detach therefore requires an up-input (the
         camera is on the wall side and screen-up walks away) or a
         near-pure sideways push away. */
      var away=mx*cl.nx+mz*cl.nz;
      /* Raw vertical keys (Han 2026-10-16, PC feedback #14): holding
         ArrowDown must not cancel ArrowUp. With both held the summed
         iz is 0 and the climb froze in place; now UP always wins,
         DOWN alone slides, and the joystick follows the same rule. */
      var keyUp=!!walkKeys['arrowup']||(window.__joyVec&&window.__joyVec.y<-.3);
      var keyDown=!!walkKeys['arrowdown']||(window.__joyVec&&window.__joyVec.y>.3);
      if((away>.6&&keyUp)||(away>.8&&!keyUp&&!keyDown)){ espilClimbDetach(p,false); return; }
      /* Han 2026-10-16: climb speed = the character's actual ground
         movement speed (moveSpeeds().run - the one run mode), lateral
         at the draft's 0.6 ratio, slide capped at the same speed. This
         supersedes the 2026-10-16 option-3 value of 1.0 m/s. */
      var spd=(typeof moveSpeeds==='function')?moveSpeeds().run:8;
      if(keyUp)cl.h+=spd*dt; else if(keyDown)cl.h-=spd*dt;
      /* Screen-right mapped onto the wall: the tangent is the
         character's right hand while facing into the wall. */
      var txv=cl.nz, tzv=-cl.nx, side=mx*txv+mz*tzv;
      if(side){
        if(cl.poly){
          var alongP=p.pos.x*cl.tx+p.pos.z*cl.tz;
          var alongN=Math.max(cl.lo+.3,Math.min(cl.hi-.3,alongP+side*(spd*.6)*dt));
          var dAlong=alongN-alongP;
          p.pos.x+=cl.tx*dAlong; p.pos.z+=cl.tz*dAlong;
        }else{
          var along=(cl.axis==='x')?p.pos.z:p.pos.x;
          along=Math.max(cl.lo+.3,Math.min(cl.hi-.3,along+side*(spd*.6)*dt));
          if(cl.axis==='x')p.pos.z=along; else p.pos.x=along;
        }
      }
      if(cl.base+cl.h>=cl.top-.25){
        if(cl.poly){ p.pos.x-=cl.nx*(PLAYER_R+.52); p.pos.z-=cl.nz*(PLAYER_R+.52); }
        else if(cl.axis==='x')p.pos.x=cl.plane-cl.nx*(PLAYER_R+.5); else p.pos.z=cl.plane-cl.nz*(PLAYER_R+.5);
        p.pos.y=cl.top; p.velY=0; p.onGround=true; p._espilClimb=null;
        return;
      }
      if(cl.h<=0&&keyDown){ p.pos.y=cl.base; p.velY=0; p.onGround=true; p._espilClimb=null; return; }
      if(cl.h<0)cl.h=0;
      p.pos.y=cl.base+cl.h;
      p.velY=0; p.onGround=false; p.jumps=0;
      p.faceY=Math.atan2(cl.nx,cl.nz);
      p.moving=!!(ix||iz);
      if(p.av&&p.av.ready&&p.av.actions.climb&&p.av.curAnim!=='climb')p.av.playAnim('climb');
    }
    /* --- minimap pin navigation REMOVED (Han PC verdict 2026-10-19
       #8): the user-placed destination pin (Leaflet click to drop,
       guidance line, world beacon, arrival toast) is deleted as an
       unnecessary feature. The streamed-MB readout that shared this
       tick is unrelated and stays. --- */
    /* ============ MAPBOX MAIN LINE - PHASE 1 (Han 2026-10-17) ============
       Han's ruling: the main line is the Cauldron (Mapbox) way. In this
       build the Three.js building layers (district polygons, chunk
       instances, hand-built core) and the textured ground system
       (satellite, roads, grass/cobble) are set to opacity 0 - present
       but invisible, one switch (ESPIL_P1) restores them. The map is a
       Mapbox GL layer under the WebGL canvas, camera-synced to the
       character. Buildings on the map come from OUR OSM footprints and
       heights (the same source file the collision store was built
       from) as a flat fill-extrusion layer, so the visible height IS
       the collision height. Collision, rooftops and climbing run on
       the prebuilt store alone: walkColliders and chunkColliders are
       bypassed at every query while ESPIL_P1 is on. The token comes
       only from the repo-root .env (window.__ESPIL_ENV__.MAPBOX_TOKEN)
       and is never tracked; with no token, or if the map library or
       style fails to load, a visible guidance banner is shown instead
       of a silent skip. */
    var ESPIL_P1=true;
    /* COLLISION DISABLE (Han 2026-11-25, directive 5): wall-climbing
       and rooftop access were OFF until collision was properly fixed.
       COLLISION FIX (Han 2026-11-26, directive 7): the fix has landed
       (the record sweep is now the primary wall judge - see
       collideCircleAxis), so the flag is restored to true, exactly
       the one line the disable package pre-wrote. The flag now gates
       exactly the two ascent paths: the climb attach funnel
       (espilTryAttachClimb - gating it also starves the wall jump
       and the climb-top roof step, which both require the climb
       state) and the ROOF MANTLE block. The INSIDE-FOOTPRINT
       RECOVERY is no longer flag-gated: its edge push-out is
       permanent (see H7 in updateWalkMap), so a centre inside a
       footprint never resolves onto a roof again. Setting this flag
       back to false disables climb + mantle exactly as the disable
       package shipped; the push-out stays either way. */
    var ESPIL_ROOF_ACCESS=true;
    /* AVATAR SIZE HELD CONSTANT (Han 2026-11-05): the layer-mode
       avatar growth factor is FROZEN at its approved default-framing
       (zoom 19.3) value, 4.67 x 2^(-(19.3-18.3)/2) = 3.302. It used to
       be a function of the live zoom - F(z) = 4.67 x 2^(-(z-18.3)/2) -
       so zooming OUT grew the character's WORLD size (at zoom 16 the
       figure stood some 18.7 m tall against a 5.9 m default; Han:
       'when I zoom out the character grows with it - hold the
       character size'). With F constant the character keeps ONE world
       size at every zoom and its screen size scales with the map,
       like every other object in the world.
       HALVED (Han 2026-11-20): the web character is halved - the
       exponent steps one further power of two, 4.67 x 2^(-1.5) =
       1.6511, exactly half of the frozen 3.3022. Every consumer
       reads this constant or the published window.__espilAvatarScaleF,
       so the halving propagates from this one definition; physics,
       collision and support keep the true body as before. */
    var ESPIL_AVATAR_F=4.67*Math.pow(2,-1.5);
    var espilP1={map:null,ready:false,failed:null,hiddenApplied:false,initTried:false,bannerEl:null,mapEl:null,layerAdded:false,layerLive:false,layerRenderer:null,layerCam:null,gameCanvasHidden:false,layerSignaled:false,zoom:null,zoomT:null,zoomDrive:false,style3dOff:false,style3dTries:0};
    /* ARENA PLACE (Han 2026-11-18): the follow framing's default
       zoom target, as a variable instead of the 20.39 literal
       (20.39 = ZoomFromDist(5.5), the street default since the
       2026-11-23 tuning verdict; 19.95 = ZoomFromDist(7.0) before
       it). The arena
       place-space child raises its own document's default to the
       9.5 m draft through __espilSetFollowDist below; the street
       window never calls it and keeps 20.39 exactly. */
    var espilFollowZoomT=20.39;
    espilP1.envReady=false;
    (window.__ESPIL_ENV_READY__||Promise.resolve()).then(function(){espilP1.envReady=true;},function(){espilP1.envReady=true;});
    function espilP1Token(){
      /* Token channels (Han, 2026-10-17; production channel added
         2026-10-18): the token arrives in window.__ESPIL_ENV__ either
         from the repo-root .env (local/testing) or, on the production
         host only, from the /api/mapbox-token endpoint reading the
         Vercel env var - production has no /.env file. The value is
         never tracked in the repo. local-config.js is served as-is
         from the web root, so a key placed there is exposed in page
         source - it is not read for the token. */
      var e=window.__ESPIL_ENV__||{};
      return e.MAPBOX_TOKEN||'';
    }
    var ESPIL_P1_ANCHORS={vancouver:{lat:49.2827,lng:-123.1207},auckland:{lat:-36.8523,lng:174.7635},tokyo:{lat:35.68124,lng:139.76714},newyork:{lat:40.75800,lng:-73.98554},paris:{lat:48.86272,lng:2.28756},london:{lat:51.50804,lng:-0.12807}};
    function espilP1Anchor(){ return ESPIL_P1_ANCHORS[espilCityKey()]||ESPIL_P1_ANCHORS.vancouver; }
    /* The shipped framing curve, kept as a pure scale lock: the overlay
       camera distance is DERIVED from the operated map zoom with it,
       and the descent envelope still speaks it. Control no longer
       flows through it (Han 2026-10-17: operate the map's own zoom). */
    /* Bridge re-anchored 2026-11-08 (close default): intercept 21.97 ->
       23.44 so the P1 default zoom 21.5 maps to the same 2.95 m physical
       follow distance as the overlay default, and the distance floor
       3 -> 2 keeps the bridge unsaturated at that default (the occlusion
       cap reads its distance through here). Slope unchanged.
       Retied 2026-11-09 (Han proportion correction): intercept kept; the
       P1 default zoom is now 20.39, which the same bridge maps to the
       new 5.5 m overlay default (DistFromZoom(20.39) = 5.5), again
       unsaturated at both clamp ends.
       Retied again 2026-11-09 (Han: zoom out a little, same
       evening): the P1 default zoom is now 20.17 = ZoomFromDist(6.2)
       on the same curve, and DistFromZoom(20.17) = 6.2 - the identity
       holds at the new 6.2 m overlay default, again unsaturated at
       both ends.
       Retied again 2026-11-10 (Han: 줌레벨 좀 줌아웃해): the P1
       default zoom is now 19.95 = ZoomFromDist(7.0), and
       DistFromZoom(19.95) = 7.01 - the identity holds at the new
       7.0 m overlay default, again unsaturated at both ends.
       Retied again 2026-11-23 (Han tuning verdict: movement too
       fast, animation too fast, screen too far): the P1 default
       zoom is now 20.39 = ZoomFromDist(5.5), and
       DistFromZoom(20.39) = 5.5 - the identity holds at the 5.5 m
       overlay default, again unsaturated at both ends. The curve
       itself (intercept, slope, floors) is unchanged; the walk
       bases fall to 5.0 / 8.0 in the same batch (moveSpeeds). */
    function espilP1ZoomFromDist(d){ return Math.max(14.5,Math.min(23,23.44-1.242*Math.log2(Math.max(2,d)))); }
    function espilP1DistFromZoom(z){ return Math.max(2,Math.min(60,Math.pow(2,(23.44-z)/1.242))); }
    function espilP1LngLat(x,z){
      var cfg=espilCityCfg(), a=espilP1Anchor();
      var lx=x-(cfg.ox||0), lz=z-(cfg.oz||0);
      return [a.lng+lx/(111320*Math.cos(a.lat*Math.PI/180)), a.lat-lz/111320];
    }
    function espilP1Banner(msg){
      if(!espilP1.bannerEl){
        var d=document.createElement('div'); d.id='espil-map-guidance';
        d.style.cssText='position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:30;max-width:min(92vw,560px);background:rgba(16,20,26,.92);color:#f3e9d2;border:1px solid rgba(243,233,210,.45);border-radius:12px;padding:12px 16px;font-size:14px;line-height:1.5;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.45);';
        document.body.appendChild(d); espilP1.bannerEl=d;
      }
      espilP1.bannerEl.textContent=msg; espilP1.bannerEl.style.display='';
    }
    function espilP1FadeMat(m){
      if(!m)return;
      var mats=Array.isArray(m)?m:[m];
      for(var i=0;i<mats.length;i++){ var mt=mats[i]; if(!mt||mt.__espilP1Faded)continue; mt.__espilP1Faded=true; mt.transparent=true; mt.opacity=0; mt.depthWrite=false; }
    }
    function espilP1Hide(){
      if(!mapScene)return;
      var dm=window.__espilDistrictMeshes||[];
      /* Leak fix (2026-10-17, Han PC round 3 item 1): the one-time latch
         let every mesh created after the first pass stay fully opaque -
         chunk content regenerates around the moving player, so unfaded
         boxes trailed the character as floating shards. Re-run the pass
         whenever the scene/district population changes, and at least
         every ~4 s of frames regardless; between changes the cost is
         two counters. Fading itself is flag-guarded per material. */
      espilP1.hideTick=(espilP1.hideTick||0)+1;
      var sig=mapScene.children.length+'/'+dm.length;
      if(espilP1.hideSig===sig&&espilP1.hideTick%240!==0)return;
      espilP1.hideSig=sig;
      for(var i=0;i<dm.length;i++){ espilP1FadeMat(dm[i].material); dm[i].visible=false; } /* visible=false as well: an opacity-0 mesh still costs a draw call every frame (round 3 item 2) */
      if(typeof mapSkyDome!=='undefined'&&mapSkyDome)mapSkyDome.visible=false; /* its lower hemisphere would paint over the map */
      mapScene.traverse(function(o){
        if(!o.isMesh)return;
        var g=o.geometry, hide=false;
        if(o.isInstancedMesh)hide=true; /* chunk city */
        else if(g&&g.type==='BoxGeometry')hide=true; /* hand-built core + OSM AABB meshes */
        else if(g&&g.type==='PlaneGeometry'){
          var mt=Array.isArray(o.material)?o.material[0]:o.material;
          var img=mt&&mt.map?mt.map.image:null;
          var isCanvas=!!(img&&img.tagName==='CANVAS');
          var w=(g.parameters&&g.parameters.width)||0;
          if(!isCanvas&&(w>=400||(mt&&mt.map)))hide=true; /* satellite, roads, grass/cobble, base + city ground planes */
        }
        if(hide){ espilP1FadeMat(o.material); o.visible=false; }
      });
    }
    var espilP1BldCache=null; /* {feats, cents} - curve visual-height updates reuse the geometry */
    function espilP1BuildingsGeoJSON(){
      var feats=[], a=espilP1Anchor();
      var mLat=111320, mLng=111320*Math.cos(a.lat*Math.PI/180);
      var blds=(typeof espilDistrict!=='undefined'&&espilDistrict&&espilDistrict.buildings)||[];
      var cfg=espilCityCfg(), cents=[], wrings=[];
      for(var i=0;i<blds.length;i++){
        var b=blds[i]; if(!b||b.w||!b.p||b.p.length<3)continue;
        var n=b.p.length-((b.p[0][0]===b.p[b.p.length-1][0]&&b.p[0][1]===b.p[b.p.length-1][1])?1:0);
        if(n<3)continue;
        var ring=[], cx=0, cz=0, wr=[];
        for(var j=0;j<n;j++){ ring.push([a.lng+b.p[j][0]/mLng, a.lat-b.p[j][1]/mLat]); cx+=b.p[j][0]; cz+=b.p[j][1]; wr.push(b.p[j][0]+cfg.ox, b.p[j][1]+cfg.oz); }
        ring.push([ring[0][0],ring[0][1]]);
        cents.push([cx/n+cfg.ox, cz/n+cfg.oz]);
        wrings.push(wr);
        feats.push({type:'Feature',properties:{h:b.h,hv:b.h,i:feats.length},geometry:{type:'Polygon',coordinates:[ring]}});
      }
      espilP1BldCache={feats:feats,cents:cents,rings:wrings};
      espilP1PaintApply();
      return {type:'FeatureCollection',features:feats};
    }
    /* Curve 1400 on the extrusion (Han 2026-10-19; nearest-point law
       2026-10-19 PC verdict #5): each building's PAINT height (hv) is
       its record height minus the curve drop at the footprint point
       NEAREST the live anchor (the player) - a player standing inside
       the footprint measures the drop at their own position (zero),
       so hv == h exactly wherever the player can stand on or touch
       the building, and distant buildings fall away by their nearest
       edge. The first pass measured the drop at the ring centroid:
       any footprint reaching ~15 m or more from its centroid then
       rendered lower than its collision (k x d^2: 74% of Vancouver
       records by 0.3 m or more at the far corner, dozens per city
       vanishing entirely while their roofs still collided at h).
       The record height (h) is never touched - qRF wall judgment,
       the record sweep, rooftops and standing all keep reading it,
       so with the paint law fixed visible == collision holds. */
    var espilPaintMeta=null, espilPaintMetaCache=null;
    var espilPaintAnchor=new THREE.Vector2(0,0); /* player anchor for the paint pass; the walker tick keeps it current */
    /* Nearest-point Globe drop for one footprint ring (flat
       [x,z,...] world coords): 0 when the anchor is inside the
       ring, else espilGlobeDrop at the nearest ring-segment
       point - the nearest-point law of the design comment above,
       evaluated with the ONE shared Globe View law (Han
       2026-10-27: k = 0.0006, cap 260) so the extrusions sink in
       exact agreement with everything the THREE-material sweep
       bends (Han 2026-10-15: one shared displacement keeps
       tiles, buildings and characters aligned). */
    function espilGlobeNearestDrop(ring,px,pz){
      if(!ring||ring.length<4)return 0;
      var n=ring.length/2, inside=false, bd=Infinity, bnx=px, bnz=pz;
      for(var j=0;j<n;j++){
        var ax=ring[2*j], az=ring[2*j+1];
        var bx2=ring[2*((j+1)%n)], bz2=ring[2*((j+1)%n)+1];
        if((az>pz)!==(bz2>pz)){
          var xi=ax+(pz-az)*(bx2-ax)/(bz2-az);
          if(px<xi)inside=!inside;
        }
        var ex=bx2-ax, ez=bz2-az;
        var L2=ex*ex+ez*ez;
        var t=L2>0?((px-ax)*ex+(pz-az)*ez)/L2:0;
        if(t<0)t=0; else if(t>1)t=1;
        var qx=ax+ex*t, qz=az+ez*t;
        var dx=px-qx, dz=pz-qz, d2=dx*dx+dz*dz;
        if(d2<bd){ bd=d2; bnx=qx; bnz=qz; }
      }
      if(inside)return 0;
      return espilGlobeDrop(bnx,bnz);
    }
    function espilPaintMetaFor(){
      var cache=espilP1BldCache; if(!cache)return null;
      if(espilPaintMetaCache===cache&&espilPaintMeta)return espilPaintMeta;
      var rings=cache.rings, meta=[];
      for(var i=0;i<rings.length;i++){
        var r=rings[i], cx=0, cz=0, mnx=1e18, mnz=1e18, mxx=-1e18, mxz=-1e18, n=r.length/2;
        for(var j=0;j<n;j++){ var x=r[2*j], z=r[2*j+1]; cx+=x; cz+=z; if(x<mnx)mnx=x; if(x>mxx)mxx=x; if(z<mnz)mnz=z; if(z>mxz)mxz=z; }
        var area=0; for(var a2=0;a2<n;a2++){ var ax=r[2*a2], az=r[2*a2+1], bx2=r[2*((a2+1)%n)], bz2=r[2*((a2+1)%n)+1]; area+=ax*bz2-bx2*az; }
        meta.push({cx:cx/n,cz:cz/n,mnx:mnx,mnz:mnz,mxx:mxx,mxz:mxz,area:Math.abs(area)/2,lod:0});
      }
      espilPaintMetaCache=cache; espilPaintMeta=meta; return meta;
    }
    function espilP1PaintApply(){
      if(!espilP1BldCache)return 0;
      var t0=performance.now();
      var feats=espilP1BldCache.feats, rings=espilP1BldCache.rings;
      var meta=espilPaintMetaFor(); if(!meta)return 0;
      var px=espilPaintAnchor.x, pz=espilPaintAnchor.y;
      var py=(typeof walkPlayer!=='undefined'&&walkPlayer)?walkPlayer.pos.y:0;
      var scanned=0, changed=0, lodFlat=0;
      var zm=(typeof espilP1!=='undefined'&&espilP1&&typeof espilP1.zoom==='number')?espilP1.zoom:20.39;
      for(var i=0;i<feats.length;i++){
        var m=meta[i];
        var bx=px<m.mnx?m.mnx-px:(px>m.mxx?px-m.mxx:0), bz=pz<m.mnz?m.mnz-pz:(pz>m.mxz?pz-m.mxz:0);
        var prop=feats[i].properties;
        if(bx*bx+bz*bz>820*820&&!m.lod)continue;
        scanned++;
        var h=prop.h;
        var hv=h-espilGlobeNearestDrop(rings[i],px,pz); if(hv<0)hv=0; /* Globe View on the extrusion (restored 2026-11-17): the 2026-10-19 nearest-point law of the design comment above - removed by the 2026-10-20 flat cleanup before it ever shipped, and missed by the 2026-10-27 restoration, which only re-added the THREE-material sweep. Replaces the flat hv=h of the cleanup; the zoom LOD below may still flatten hv entirely. */
        /* Zoom LOD (perf, Han 2026-10-20): at overview zooms,
           small distant buildings flatten to their footprint -
           at the widest view roughly half the prisms Mapbox
           tessellates in the 820 m disc go flat (Vancouver 47%
           of features / 16% of wall area, Auckland 54% / 19%,
           measured on the shipped data), while anything near
           the player or large keeps its full height. hv only:
           properties.h - the truth collision reads - never
           changes. 30 m of hysteresis on the
           distance bands keeps the edge from flickering. */
        if(zm<18.5){
          var cdx=m.cx-px, cdz=m.cz-pz, cd=Math.sqrt(cdx*cdx+cdz*cdz);
          var want=false;
          if(zm>=17.5){ want=(cd>380&&h<10&&m.area<400); if(!want&&m.lod)want=(cd>350&&h<10&&m.area<400); }
          else { want=(cd>300&&h<14&&m.area<700)||(cd>550&&h<22&&m.area<1200);
                 if(!want&&m.lod)want=(cd>270&&h<14&&m.area<700)||(cd>520&&h<22&&m.area<1200); }
          if(want){ hv=0; m.lod=1; lodFlat++; } else m.lod=0;
        } else if(m.lod)m.lod=0;
        var dirty=false;
        if(Math.abs(hv-prop.hv)>0.05){ prop.hv=hv; dirty=true; }
        if(dirty)changed++;
      }
      window.__espilPaintStats={ms:Math.round((performance.now()-t0)*10)/10,scanned:scanned,changed:changed,total:feats.length,lodFlat:lodFlat,zoom:Math.round(zm*10)/10};
      return changed;
    }
    var espilP1PaintLast=null;
    function espilP1PaintUpdate(){
      if(!espilP1.buildingsAdded||!espilP1BldCache||!espilP1.map)return;
      var now=performance.now();
      var zm=(typeof espilP1.zoom==='number')?espilP1.zoom:20.39;
      if(espilP1PaintLast){
        var dx=espilPaintAnchor.x-espilP1PaintLast.x, dz=espilPaintAnchor.y-espilP1PaintLast.z;
        if(dx*dx+dz*dz<9&&Math.abs(zm-espilP1PaintLast.zm)<0.05)return; /* anchor still (3 m gate) and zoom steady */
        if(now-espilP1PaintLast.t<300)return; /* one cadence */
      }
      espilP1PaintLast={x:espilPaintAnchor.x,z:espilPaintAnchor.y,t:now,zm:zm};
      if(espilP1PaintApply()>0){
        try{ espilP1.map.getSource('espil-buildings').setData({type:'FeatureCollection',features:espilP1BldCache.feats}); }catch(e){}
      }
    }
    /* STYLE 3D - LEFT AS THE STYLE DEFINES IT (Han 2026-11-26,
       item 6c): until Han orders otherwise the buildings are the
       ORIGINAL Mapbox model. The 2026-10-17 STYLE 3D OFF switch
       (espilP1HideStyle3D, which wrote show3dObjects=false into
       the basemap import and was retried from the tick) is
       removed: the config is never written again, so the import
       renders its own 3D buildings per the style's config. */
    function espilP1AddBuildings(){
      if(!espilP1.map||espilP1.buildingsAdded)return;
      var blds=(typeof espilDistrict!=='undefined'&&espilDistrict&&espilDistrict.buildings)||[];
      if(!blds.length)return; /* district data not in yet - the tick retries */
      /* NATIVE BUILDINGS (Han 2026-11-26, item 6c): the
         2026-10-17 COLOR-KEY settlement is reversed - the base
         style's own building layers are NO LONGER hidden, and no
         game extrusion replaces them (see below). The style
         renders its buildings exactly as it defines them. */
      try{
        if(!espilP1.map.getSource('espil-buildings')){
          espilP1.map.addSource('espil-buildings',{type:'geojson',data:espilP1BuildingsGeoJSON()});
          /* Our fill-extrusion building layer
             ('espil-buildings-3d', #c9c4bb over the record
             heights) is REMOVED (Han 2026-11-26, item 6c): the
             buildings on screen are the style's own now. The
             'espil-buildings' source stays - the invisible
             collision helper layer below shares it. */
          /* COLLISION LAYER (Han 2026-10-17, CarInMap method): a flat,
             invisible fill over the same footprints - the wall judge
             queries THIS layer with queryRenderedFeatures. The
             extrusion itself is never queried: at pitch its drawn
             silhouette overhangs the footprint and would wall off open
             ground beside tall buildings. */
          espilP1.map.addLayer({id:'espil-buildings-collision',type:'fill',source:'espil-buildings',paint:{'fill-color':'#000000','fill-opacity':0}});
          /* The DITHER twin layer ('espil-buildings-dither' +
             the 'espil-dither-checker' pattern image) is REMOVED
             (Han 2026-11-26: the twin-drawn buildings go; item 7's
             X-ray replaces the treatment it carried). */
        }else{
          espilP1.map.getSource('espil-buildings').setData(espilP1BuildingsGeoJSON());
        }
        espilP1.buildingsAdded=true;
      }catch(e){}
    }
    /* ==== NIGHT GLOW (Mapbox layer paint) - REMOVED
       (Han 2026-11-26, item 6c) ====
       The glow block painted a lit-window pattern
       ('espil-night-windows') and an amber colour lerp onto the
       game's own extrusion layer at night. That layer is gone
       and the buildings are the style's own now, so nothing may
       paint a window texture or a glow colour onto them: the
       tick, the image builder, the __espilNightGlowState seam
       and its 1 s interval are removed whole. The NIGHT GROUND
       tint below is a separate block (the 2026-11-20
       night-uniformity fix) and stays byte-identical. */
    /* ==== NIGHT GROUND (Mapbox base tint) - BEGIN ====
       Night-mismatch fix (Han report 2026-11-20; diagnosis:
       night-mismatch/DIAGNOSIS.md). The character darkens TWICE
       at night - its scene lighting collapses with the
       astronomical daylight dl AND the #espil-daynight screen
       multiplies x0.5 on top - while the ground (the Mapbox base
       here) receives only the screen, so at the night plateau
       the ground keeps
       0.49-0.51 of its day value against the character's
       0.22-0.25 and the world reads half-lit. This block gives
       the BASE side the missing share: one background layer
       ('espil-night-ground-tint', pure black) inserted BELOW
       every game-owned ('espil-') layer and above the whole
       basemap, its opacity driven by the SAME state the glow
       above uses - window.__espilNightState().factor ONLY (the
       hemisphere-derived factor: 1 at the night plateau, 0 in
       day, forced 0 indoors, __espilNightForce seam shared).
       opacity = ESPIL_GROUND_NIGHT_DIM * f, so at the plateau
       the base's total is (1 - 0.53) x screen 0.5 = 0.235,
       inside the character's measured band; at f = 0 the
       opacity is exactly 0, the layer paints nothing, and the
       day appearance is the pre-fix one byte for byte. The
       game's own layers - the buildings extrusion with its
       glow paint, the dither twin, the collision query layer,
       the game layer, the tiles layer - all sit ABOVE the
       tint, so the glow's night read is never multiplied a
       second time: the tint darkens only the basemap it was
       aimed at. Driver cadence follows the glow: one 1 s
       interval, paint writes only on a >= 0.004 opacity move,
       a map identity change, or a layer-order repair (a style
       reload drops the layer; the same tick re-adds it below
       the lowest game layer) - zero writes at day steady
       state. */
    var ESPIL_GROUND_NIGHT_DIM=0.53; /* plateau share: 1 - 0.47 */
    var ESPIL_GROUND_TINT_ID='espil-night-ground-tint';
    var espilGroundNight={o:-1,applies:0,map:null,layerOk:false,orderOk:false};
    function espilGroundTintTick(){
      var st=null;
      try{ st=window.__espilNightState?window.__espilNightState():null; }catch(e){}
      if(!st||typeof st.factor!=='number')return;
      var f=st.factor; if(f<0)f=0; if(f>1)f=1;
      var map=null;
      try{ map=(typeof espilP1!=='undefined'&&espilP1)?espilP1.map:null; }catch(e){}
      if(!map)return;
      var G=espilGroundNight;
      var o=ESPIL_GROUND_NIGHT_DIM*f;
      try{
        var layers=(map.getStyle()||{}).layers||[];
        var tintIdx=-1, lowEspilIdx=-1, lowEspilId=null;
        for(var i=0;i<layers.length;i++){
          var lid=layers[i]&&layers[i].id;
          if(!lid)continue;
          if(lid===ESPIL_GROUND_TINT_ID){ tintIdx=i; continue; }
          if(lid.indexOf('espil-')===0){ lowEspilIdx=i; lowEspilId=lid; break; }
        }
        if(tintIdx<0){
          var spec={id:ESPIL_GROUND_TINT_ID,type:'background',paint:{'background-color':'#000000','background-opacity':o}};
          if(lowEspilId)map.addLayer(spec,lowEspilId); else map.addLayer(spec);
          G.o=o; G.applies++; G.map=map; G.layerOk=true; G.orderOk=true;
          return;
        }
        G.layerOk=true;
        G.orderOk=!(lowEspilIdx>=0&&tintIdx>lowEspilIdx);
        if(!G.orderOk&&lowEspilId){
          map.moveLayer(ESPIL_GROUND_TINT_ID,lowEspilId);
          G.orderOk=true;
        }
        if(map!==G.map||Math.abs(o-G.o)>=0.004){
          map.setPaintProperty(ESPIL_GROUND_TINT_ID,'background-opacity',o);
          G.o=o; G.map=map; G.applies++;
        }
      }catch(e){}
    }
    window.__espilGroundNightState=function(){ var G=espilGroundNight; return {opacity:G.o,g:1-G.o,applies:G.applies,layerOk:G.layerOk,orderOk:G.orderOk}; };
    setInterval(espilGroundTintTick,1000);
    /* ==== NIGHT GROUND (Mapbox base tint) - END ==== */
    /* ============ CUSTOM-LAYER INTEGRATION (CarInMap method, Han
       2026-10-17) ============
       The game scene renders INSIDE the map's own WebGL context as a
       Mapbox custom layer: one context, one pipeline. The slave
       canvas overlay, the second context and the sync-compositing
       retire; the map camera is set from the game camera each frame
       (espilP1Tick) and the map's render pass draws our scene through
       this layer with the map's projection, so map buildings and game
       objects share one depth buffer (true occlusion both ways).
       Placement: our world metres sit on the city anchor via the
       Mercator bridge - T(anchor) x S(s,-s,s) x Rx(90deg) maps our
       (x east, y up, z south) onto Mercator (x east, y south, z up).
       If anything in this path fails, layerLive stays false and the
       game renders on its own canvas exactly as before. */
    /* ==== X-RAY SILHOUETTE (Han 2026-11-26, item 7) ====
       Two-pass rendering of the LOCAL player inside this custom
       layer (renderingMode '3d', so the avatar already shares
       the Mapbox depth buffer): PASS 1 draws the avatar's meshes
       with an override material - depthFunc THREE.GreaterDepth,
       depthWrite false, a solid unlit colour - so the silhouette
       lands ONLY where building geometry already wrote nearer
       depth in front of the character; PASS 2 is the ordinary
       scene render below, which draws the normal model over the
       silhouette wherever the character is in the open. Draft
       look (Han retunes on his screen verdict): soft cyan-white
       0x9fe4ff at 0.88 opacity. Scope: walkPlayer.av.group only -
       remote players, monsters and NPCs keep their rendering.
       The material is marked espilAvatarMat so the
       globe-curvature patch exempts it like the avatar's own
       materials (the avatar is CPU-anchored to the bent ground;
       a bent silhouette would double-drop). skinning:true is
       REQUIRED: the bundled three is r128, where skinning is a
       material flag, and the avatar is a single SkinnedMesh - a
       plain basic material would draw its bind pose instead of
       the posed figure (measured 2026-11-27: no silhouette at
       all without the flag, at any depth setting). */
    var espilXrayMat=null;
    function espilXrayMaterial(){
      if(espilXrayMat)return espilXrayMat;
      var m=new THREE.MeshBasicMaterial({color:0x9fe4ff,transparent:true,opacity:0.88,depthTest:true,depthWrite:false,skinning:true});
      m.depthFunc=THREE.GreaterDepth;
      m.userData.espilAvatarMat=true;
      espilXrayMat=m;
      return m;
    }
    var _espilXrayMeshes=[], _espilXraySaved=[], _espilXrayHidden=[];
    function espilXraySilhouette(r, cam){
      var grp=null;
      try{ grp=(typeof walkPlayer!=='undefined'&&walkPlayer&&walkPlayer.av&&walkPlayer.av.group)?walkPlayer.av.group:null; }catch(e){}
      if(!grp||!grp.visible||typeof mapScene==='undefined'||!mapScene)return;
      if(!(document.body&&document.body.classList&&document.body.classList.contains('in-map')))return;
      var chain=[], n=grp;
      while(n&&n!==mapScene){ chain.push(n); n=n.parent; }
      if(n!==mapScene)return; /* the avatar is not in this scene */
      var meshes=_espilXrayMeshes, saved=_espilXraySaved, hidden=_espilXrayHidden;
      meshes.length=0; saved.length=0; hidden.length=0;
      grp.traverse(function(o){ if(o.isMesh)meshes.push(o); });
      if(!meshes.length)return;
      var mat=espilXrayMaterial();
      try{
        for(var i=0;i<meshes.length;i++){ saved.push([meshes[i],meshes[i].material]); meshes[i].material=mat; }
        for(var c=0;c<chain.length;c++){
          var sib=chain[c].parent.children;
          for(var j=0;j<sib.length;j++){ if(sib[j]!==chain[c]){ hidden.push([sib[j],sib[j].visible]); sib[j].visible=false; } }
        }
        r.render(mapScene, cam);
      }catch(e){}
      for(var k=0;k<saved.length;k++)saved[k][0].material=saved[k][1];
      for(var q=0;q<hidden.length;q++)hidden[q][0].visible=hidden[q][1];
    }
    function espilP1GameLayer(){
      return {
        id:'espil-game-layer', type:'custom', renderingMode:'3d',
        onAdd:function(map, gl){
          espilP1.layerCam=new THREE.Camera();
          try{
            espilP1.layerRenderer=new THREE.WebGLRenderer({canvas:map.getCanvas(), context:gl, antialias:false, alpha:true});
          }catch(e){ espilP1.layerRenderer=null; return; }
          espilP1.layerRenderer.autoClear=false;
          espilP1.layerRenderer.autoClearColor=false;
          espilP1.layerRenderer.autoClearDepth=false;
          espilP1.layerRenderer.autoClearStencil=false;
          espilP1.layerLive=true;
        },
        render:function(gl, matrix){
          var r=espilP1.layerRenderer; if(!r||!espilP1.layerCam||!espilP1.map)return;
          var cv=espilP1.map.getCanvas();
          if(r.domElement.width!==cv.width||r.domElement.height!==cv.height){
            try{ r.setSize(cv.width, cv.height, false); }catch(e){}
          }
          var a=espilP1Anchor();
          var mc=mapboxgl.MercatorCoordinate.fromLngLat({lng:a.lng, lat:a.lat}, 0);
          var s=mc.meterInMercatorCoordinateUnits();
          var cfgL=espilCityCfg();
          var l=new THREE.Matrix4()
            .makeTranslation(mc.x, mc.y, mc.z)
            .scale(new THREE.Vector3(s, -s, s))
            .multiply(new THREE.Matrix4().makeRotationX(Math.PI/2))
            /* City world-offset (Auckland activation, 2026-10-18):
               offset cities keep their world at +(ox, oz) inside the
               scene; re-origin the placement on the entered city's
               offset so the scene lands on ITS anchor, matching
               espilP1LngLat. Vancouver ox=oz=0 - identity there. */
            .multiply(new THREE.Matrix4().makeTranslation(-(cfgL.ox||0), 0, -(cfgL.oz||0)));
          var m=new THREE.Matrix4().fromArray(matrix);
          espilP1.layerCam.projectionMatrix=m.multiply(l);
          espilXraySilhouette(r, espilP1.layerCam); /* X-RAY pass 1 (Han 2026-11-26, item 7): the silhouette, against the basemap's depth */
          try{ r.render(mapScene, espilP1.layerCam); }catch(e){} /* pass 2: the normal scene */
          try{ r.state.reset(); }catch(e){}
          /* Loader contract under the conversion: the continuous
             repaint loop means the map may never go 'idle', so the
             signal completes on the layer's first real render - the
             same meaning (the map pipeline is drawing the game). */
          if(!espilP1.layerSignaled){ espilP1.layerSignaled=true; if(window.__espilMapProgress01<1)window.__espilMapProgress01=1; }
        },
        onRemove:function(){ espilP1.layerLive=false; }
      };
    }
    function espilP1AddLayer(){
      if(!espilP1.map||espilP1.layerAdded)return;
      try{
        if(espilP1.map.getLayer('espil-game-layer')){ espilP1.layerAdded=true; return; }
        espilP1.map.addLayer(espilP1GameLayer());
        espilP1.layerAdded=true;
      }catch(e){}
    }
    function espilP1Preload(){
      /* Map preload (Han, 2026-10-17): start Mapbox init in parallel with
         the entry sequence (the city preload window) instead of waiting
         for the city phase, so the style and tiles stream during loading
         and the map is ready when entry completes. Display stays hidden
         until the city phase (espilP1Tick owns visibility); the loader
         signal advances during entry; failures keep the banner path. */
      if(!ESPIL_P1||espilP1.initTried)return;
      if(espilP1.envReady){ espilP1Init(); return; }
      if(espilP1.preloadArmed)return; espilP1.preloadArmed=true;
      (window.__ESPIL_ENV_READY__||Promise.resolve()).then(function(){ if(!espilP1.initTried)espilP1Init(); },function(){ if(!espilP1.initTried)espilP1Init(); });
    }
    function espilP1Init(){
      if(espilP1.initTried)return; espilP1.initTried=true;
      window.__espilMapProgress01=0; /* UI-room loader contract (2026-10-17): 0 at init, .45 at style load, 1 at first idle; every failure path releases the gate with 1 (the banner carries the guidance) */
      var token=espilP1Token();
      if(typeof mapboxgl==='undefined'){ espilP1.failed='lib'; window.__espilMapProgress01=1; espilP1Banner('Could not load the Mapbox map library. Please check your network connection. Movement and collision run on the prebuilt store.'); return; }
      if(!token){ espilP1.failed='token'; window.__espilMapProgress01=1; espilP1Banner('No Mapbox token, so the map cannot be shown. Put MAPBOX_TOKEN in the .env file. Movement and collision run on the prebuilt store.'); return; }
      mapboxgl.accessToken=token;
      var el=document.createElement('div'); el.id='espil-mapbox';
      el.style.cssText='position:absolute;inset:0;z-index:0;';
      var cv=document.getElementById('globe-canvas');
      if(cv&&cv.parentNode){ cv.parentNode.insertBefore(el,cv); cv.style.zIndex='1'; }
      else document.body.appendChild(el);
      espilP1.mapEl=el;
      try{
        espilP1.map=new mapboxgl.Map({container:el,style:'mapbox://styles/quadclipse/cmvdcpdor000901sq8xq57eab',center:espilP1LngLat((espilCityCfg().spawn||{x:3,z:31}).x,(espilCityCfg().spawn||{x:3,z:31}).z),zoom:17.3,pitch:52,bearing:0,attributionControl:false,interactive:false,projection:'mercator',maxZoom:23}); /* projection forced (Han 2026-10-17): the designated style declares lambertConformalConic, under which Mapbox skips ALL 3D drawing ("Drawing 3D models for lambertConformalConic projection is not yet implemented") - the custom layer and our extrusions vanished on Han's PC while the mercator stub could not reproduce it. The game's math is Mercator throughout. maxZoom was the Mapbox default 22 (custom cap removed on Han's order); raised to 23 on 2026-11-08 so the close default zoom 21.5 kept wheel headroom above it; the 2026-11-09 default was 20.17 (6.2 m via the bridge; 20.39 = 5.5 m earlier the same day) and the 2026-11-10 default is 19.95 (7.0 m); 23 stays as the cap. */
      }catch(e){ espilP1.failed='init'; window.__espilMapProgress01=1; espilP1Banner('Could not start the Mapbox map. Please check the token.'); return; }
      espilP1.map.on('load',function(){
        /* the loaded style re-imposes its declared projection - force
           Mercator back before anything 3D is added (see constructor). */
        try{ var _pr=espilP1.map.getProjection&&espilP1.map.getProjection(); if(!_pr||_pr.name!=='mercator')espilP1.map.setProjection('mercator'); }catch(e){}
        espilP1.ready=true;
        window.__espilMapProgress01=0.45; /* loader contract: style loaded */
        if(espilP1.onFallback){
          /* Fallback base (round 3 item 6): Han rejected street-name labels -
             strip every symbol layer so the fallback reads as the clean map. */
          try{ var ls=espilP1.map.getStyle().layers||[]; for(var li=0;li<ls.length;li++){ if(ls[li].type==='symbol'){ try{ espilP1.map.setLayoutProperty(ls[li].id,'visibility','none'); }catch(e){} } } }catch(e){}
        }
        espilP1AddBuildings();
        espilP1AddLayer();
      });
      espilP1.map.on('idle',function(){
        if(espilP1.ready&&window.__espilMapProgress01<1)window.__espilMapProgress01=1; /* loader contract: first idle after load completes the map signal */
      });
      espilP1.map.on('error',function(){
        if(!espilP1.ready&&!espilP1.onFallback){
          /* Designated style unreadable with this token (round 3 item 6):
             fall back ONCE to the label-stripped streets base; the loader
             signal stays open while recovery is in progress. If the style
             is copied into Han's own account later, this path never runs. */
          espilP1.onFallback=true;
          espilP1.buildingsAdded=false; /* setStyle wipes sources - the load handler re-adds the buildings */
          espilP1.style3dOff=false; espilP1.style3dTries=0; /* style3d flags retired (Han 2026-11-26 item 6c) - inert fields, kept so the reset shape is unchanged */
          espilP1.layerAdded=false; /* setStyle also wipes custom layers - re-added on the same load */
          espilP1Banner('Could not read the designated style, so the base map is shown with street-name labels removed.');
          try{ espilP1.map.setStyle('mapbox://styles/mapbox/streets-v12'); }
          catch(e){ window.__espilMapProgress01=1; espilP1.failed='maperror'; }
          return;
        }
        window.__espilMapProgress01=1; /* loader contract: failures release the gate; the banner carries the guidance */
        if(!espilP1.ready){ espilP1.failed='maperror'; espilP1Banner('Could not load the Mapbox map. The token was refused or the style is not accessible.'); }
      });
    }
    function espilP1Tick(){
      if(!ESPIL_P1)return;
      if(!cityPhaseActive){ /* the tiles bridge that used to mirror this flag into a state object was removed (Han 2026-10-20 cleanup); the tick reads the game's own flag */
        if(espilP1.mapEl)espilP1.mapEl.style.display='none';
        if(espilP1.bannerEl)espilP1.bannerEl.style.display='none';
        if(espilP1.gameCanvasHidden){ espilP1.gameCanvasHidden=false; var cvEl2=document.getElementById('globe-canvas'); if(cvEl2)cvEl2.style.display=''; }
        return;
      }
      if(espilP1.mapEl)espilP1.mapEl.style.display='';
      if(espilP1.bannerEl&&espilP1.failed)espilP1.bannerEl.style.display='';
      /* CUSTOM LAYER: while the layer is live the game canvas becomes a
         transparent INPUT pane. Every camera listener (wheel zoom,
         drag rotate, touch) is bound to this canvas, so it must stay
         displayed and on top - but it is cleared once and never drawn
         to again (animate skips its render); the map canvas below is
         the only rendered surface. If the layer is not live the old
         overlay path renders on this canvas exactly as before. */
      var cvEl=document.getElementById('globe-canvas');
      if(cvEl){
        var wantPane=!!(espilP1.layerLive&&!espilP1.failed);
        if(wantPane!==espilP1.gameCanvasHidden){
          espilP1.gameCanvasHidden=wantPane;
          if(wantPane&&typeof renderer!=='undefined'&&renderer){ try{ renderer.setClearColor(0x000000,0); renderer.clear(true,true,true); }catch(e){} }
        }
      }
      if(!espilP1.initTried&&espilP1.envReady)espilP1Init();
      if(window.__espilDistrictMeshesBuilt&&typeof mapBuilt!=='undefined'&&mapBuilt)espilP1Hide();
      if(typeof renderer!=='undefined'&&renderer)renderer.setClearColor(0x000000,0);
      if(espilP1.ready&&!espilP1.buildingsAdded)espilP1AddBuildings(); /* preload case: district data may land after the map load */
      if(espilP1.ready&&!espilP1.layerAdded)espilP1AddLayer();
      if(espilP1.map&&espilP1.ready&&typeof walkPlayer!=='undefined'&&walkPlayer){
        /* CAMERA ANCHOR (Han PC QA 2026-10-18, round 2): the camera
           ALWAYS centres the character - hack-and-slash framing. The
           map centre is fed the ground point that the character's
           actual position projects from, using his ABSOLUTE height
           every frame and in every state (ground, rooftop, airborne,
           climbing): the centre is offset along the view forward by
           the ground-equivalent of his height, h x 1.72 / (1 + h/55)
           (calibrated on the rig at 3.4 / 7.6 / 12 m: a plain linear
           factor overshoots with height - 1.62 read +30 px low at
           12 m - while this perspective form holds the feet within
           ~5 px of centre at all three). The camera looks at the
           character; it does not track the movement keys. Descent
           keeps its own framing. */
        var _ccx=walkPlayer.pos.x, _ccz=walkPlayer.pos.z;
        if(!walkPlayer._espilArrive){
          var _hA=Math.max(0,Math.min(60,walkPlayer.pos.y));
          if(_hA>0.05){
            var _off=_hA*1.72/(1+_hA/55);
            _ccx+=-Math.sin(walkCamYaw)*_off;
            _ccz+=-Math.cos(walkCamYaw)*_off;
          }
        }
        var ll=espilP1LngLat(_ccx,_ccz);
        var brg=-walkCamYaw*180/Math.PI;
        var carFpvP1=espilCarFpvWanted();
        if(carFpvP1){ var _cfYaw=espilCarFpvFrameYaw(); if(_cfYaw!==null)brg=-(_cfYaw+espilCarFpv.lookYaw)*180/Math.PI; } /* CAR FP (P1 path): the map bearing follows the car heading + look offset, not the follow yaw */
        /* ZOOM OPERATION (Han 2026-10-17, CarInMap scope): the map's own
           zoom level is the operated quantity. The wheel moves the zoom
           TARGET (espilP1.zoomT, set in mapZoom) and the view eases to
           it; the overlay camera distance is derived from the zoom so
           both surfaces stay scale-locked. During descent the descent
           envelope leads the zoom (and the target tracks it), unless
           the player has taken the zoom over with the wheel. */
        if(espilP1.zoom===null){ espilP1.zoom=20.39; espilP1.zoomT=20.39; } /* default framing: 19.3 until 2026-11-08 (Han PC QA 2026-10-18), 21.5 during the 2026-11-08 close framing; Han 2026-11-09 corrected the proportion (MapleStory-like: character ~0.30 of viewport height, never screen-filling) at 20.39 = 5.5 m, then asked for a small step farther the same evening - 20.17 via the bridge = 6.2 m; Han 2026-11-10 asked to zoom out a little again - 19.95 via the bridge = the same 7.0 m physical distance as the overlay default; Han 2026-11-23 returns the default to 20.39 = 5.5 m (tuning verdict: screen too far) */
        var kbFpv=(typeof espilKbFpvActive==='function')&&espilKbFpvActive();
        if(kbFpv){
          /* KONBINIYA FPV (P1 path): while the Konbiniya FPV is
             active the map camera leaves the pitch-52 follow framing
             and drops to street level at the player's own spot -
             pitch at the Mapbox maximum, zoom at the FPV level;
             the avatar is hidden by the FPV application in
             updateWalkMap, so no character stands in frame. The
             user's outdoor zoom state is left untouched and the
             entry-saved zoom is restored on leave as before. */
          espilP1.zoomT=ESPIL_KB_P1_ZOOM;
          espilP1.zoom+=(espilP1.zoomT-espilP1.zoom)*0.35;
          if(Math.abs(espilP1.zoomT-espilP1.zoom)<0.001)espilP1.zoom=espilP1.zoomT;
        }else if(carFpvP1){
          /* CAR FIRST-PERSON (P1 path): the Konbiniya device with
             the car blend as the pitch sweep - the map camera
             drops to street level at the player's own spot, zoom
             at the FPV level, bearing on the car heading (set
             above); the pitch follows 52 + 33 x blend so the
             framing sweeps as the blend runs, reaching the
             interior's 85 at blend 1. The player's zoom state is
             restored by the ordinary branch when the drive view
             leaves FP (zoomT returns to the follow default unless
             the player holds the wheel). */
          espilP1.zoomT=ESPIL_KB_P1_ZOOM;
          espilP1.zoom+=(espilP1.zoomT-espilP1.zoom)*0.35;
          if(Math.abs(espilP1.zoomT-espilP1.zoom)<0.001)espilP1.zoom=espilP1.zoomT;
        }else if(walkPlayer._espilArrive&&!espilP1.zoomDrive){
          espilP1.zoom=espilP1.zoomT=espilP1ZoomFromDist(walkCamDist);
        }else{
          if(!espilP1.zoomDrive)espilP1.zoomT=espilFollowZoomT; /* until the player takes the wheel, the target is the default framing (espilFollowZoomT: 20.39 street, raised only inside an arena place child) */
          espilP1.zoom+=(espilP1.zoomT-espilP1.zoom)*0.2;
          if(Math.abs(espilP1.zoomT-espilP1.zoom)<0.001)espilP1.zoom=espilP1.zoomT;
          walkCamDist=espilP1DistFromZoom(espilP1.zoom);
        }
        var zoom=espilP1.zoom;
        /* OCCLUSION ZOOM REMOVED (Han 2026-11-26, item 11): the
           Batch 5 item 8 cap that raised this frame's zoom when a
           building capped the boom is deleted - the applied zoom
           is the player's zoom state, never an occlusion cap. */
        /* ZOOM-FPV (Han 2026-11-17): the pitch is the one P1
           framing term the zoom source touches - 52 + 33 x blend,
           reaching the interior's 85 only as the blend completes.
           The interior term stays the constant 85 (its entry is a
           fade; no blend is mixed into it), and the zoom source
           never writes espilP1.zoomT here or anywhere - the user's
           23 survives the whole first-person stay. */
        try{ espilP1.map.jumpTo({center:ll,bearing:brg,pitch:kbFpv?ESPIL_KB_P1_PITCH:(carFpvP1?52+33*espilCarFpv.blend:52+33*((typeof espilZoomFpv!=='undefined'&&espilZoomFpv)?espilZoomFpv.blend:0)),zoom:zoom}); }catch(e){}
        if(espilP1.layerLive){ try{ espilP1.map.triggerRepaint(); }catch(e){} } /* the map's render pass draws the game scene via the custom layer */
        /* AVATAR SCALE (Han 2026-10-17; SIZE HELD 2026-11-05): in
           layer mode the avatar draws at true map scale - about 11 px
           tall at the default zoom 18.3 (measured), which reads as
           invisible on a real map, so the visual root is grown by a
           factor over its base scale. That factor was zoom-linked,
           F(z) = 4.67 x 2^(-(z-18.3)/2), and zooming out visibly grew
           the character's world size - Han ordered the size HELD
           (2026-11-05), so F is now the constant ESPIL_AVATAR_F (the
           old formula's value at the approved 19.3 default framing,
           so the default look is unchanged): one world size at every
           zoom, screen height scaling with the map like everything
           else (about 75 px at 19.3, as approved in Han PC QA round
           2, 2026-10-18). Physics, collision and support keep the
           true 1.8 m body - only the drawing is grown; outside layer
           mode the base scale is restored. The contact shadow follows
           at a capped factor so it stays a contact shadow. */
        if(typeof walkPlayer!=='undefined'&&walkPlayer&&walkPlayer.av){
          var _av=walkPlayer.av,_vr=_av.__visualRoot;
          if(_vr){
            var _F=espilP1.layerLive&&!espilP1.failed?ESPIL_AVATAR_F:1;
            var _bs=_vr.userData.__avBaseScale||1.5;
            _vr.scale.setScalar(_bs*_F);
            _vr.position.y=(_vr.userData.__avBaseY||0)*_F;
            if(_av.shadow){ var _ss=Math.min(_F,4); _av.shadow.scale.set(_ss,_ss,1); }
            window.__espilAvatarScaleF=_F; /* QA readout: the applied factor */
            window.__espilAvatarState={anim:(walkPlayer.av&&walkPlayer.av.curAnim)||null,climb:!!walkPlayer._espilClimb,ground:!!walkPlayer.onGround,vy:walkPlayer.velY,jumps:walkPlayer.jumps,acts:(walkPlayer.av&&walkPlayer.av.actions)?Object.keys(walkPlayer.av.actions):null,gender:(walkPlayer.av&&walkPlayer.av.__gender)||null};
          }
        }
      }
    }
    /* ============ ESPIL CHAT + SPEECH BUBBLE (2026-10-15, per Han:
       chat must work in the map and a text bubble must appear over
       the character). Local display only - no multiplayer chat
       server exists yet. Enter opens/sends, Esc closes. ============ */
    (function(){
      var style=document.createElement('style');
      style.textContent=
        /* Chat placement per UI room spec 2026-10-15 (Han feedback 5):
           the wrapper's bottom edge sits ABOVE the skill cluster top
           (156px desktop / 154px mobile) so log and input never overlap
           the buttons in any state. */
        '#espil-chat{position:fixed;left:14px;bottom:calc(196px + env(safe-area-inset-bottom));width:min(350px,calc(100vw - 28px));z-index:55;display:none;pointer-events:none;}'+
        '#espil-chat-log{display:flex;flex-direction:column;justify-content:flex-end;gap:3px;max-height:168px;overflow:hidden;margin-bottom:6px;}'+
        '@media (pointer:coarse) and (orientation:landscape){'+
        '#espil-chat{left:12px;bottom:calc(170px + env(safe-area-inset-bottom));width:min(320px,calc(100vw - 24px));}'+
        '#espil-chat-log{max-height:clamp(28px,calc(100dvh - 330px),96px);}'+
        '}'+
        '.espil-chat-line{align-self:flex-start;max-width:100%;background:rgba(6,12,18,.66);border:1px solid rgba(134,238,228,.16);border-radius:9px;padding:3px 8px;font-size:12.5px;line-height:1.35;color:#eaf6f3;word-break:break-word;}'+
        '.espil-chat-line b{color:#6ee7d8;font-weight:600;}'+
        '.espil-chat-line.sys{opacity:.75;font-style:italic;}'+
        '#espil-chat-input{width:100%;box-sizing:border-box;background:rgba(6,12,18,.85);border:1px solid rgba(134,238,228,.45);border-radius:9px;padding:7px 9px;font-size:13px;color:#fff;outline:none;pointer-events:auto;display:none;}'+
        '#espil-bubble{position:fixed;z-index:56;transform:translate(-50%,-115%);background:rgba(255,255,255,.96);color:#12242b;border-radius:12px;padding:6px 10px;font-size:13px;line-height:1.35;max-width:230px;word-break:break-word;display:none;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.35);}'+
        '#espil-bubble:after{content:"";position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);border:6px solid transparent;border-top-color:rgba(255,255,255,.96);border-bottom:0;}';
      document.head.appendChild(style);
      var wrap=document.createElement('div'); wrap.id='espil-chat';
      var log=document.createElement('div'); log.id='espil-chat-log';
      var input=document.createElement('input'); input.id='espil-chat-input';
      input.type='text'; input.maxLength=200; input.placeholder='Message - Enter to send, Esc to close';
      input.setAttribute('aria-label','Chat message');
      wrap.appendChild(log); wrap.appendChild(input);
      document.body.appendChild(wrap);
      var bubble=document.createElement('div'); bubble.id='espil-bubble';
      document.body.appendChild(bubble);
      var typing=false, welcomed=false, bubbleUntil=0;
      function addLine(name,text,sys){
        var d=document.createElement('div'); d.className='espil-chat-line'+(sys?' sys':'');
        if(name){ var b=document.createElement('b'); b.textContent=name+' '; d.appendChild(b); }
        d.appendChild(document.createTextNode(text));
        log.appendChild(d);
        while(log.children.length>30)log.removeChild(log.firstChild);
      }
      function openChat(){
        typing=true; input.style.display='block'; input.value='';
        setTimeout(function(){ try{input.focus();}catch(e){} },0);
      }
      function closeChat(){ typing=false; input.style.display='none'; try{input.blur();}catch(e){} }
      function sendChat(){
        var text=input.value.trim(); closeChat();
        if(!text)return;
        addLine('Keeper',text,false);
        bubble.textContent=text;
        bubbleUntil=performance.now()+4500;
      }
      input.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Enter'){ e.preventDefault(); sendChat(); }
        else if(e.key==='Escape'){ e.preventDefault(); closeChat(); }
      });
      input.addEventListener('keyup',function(e){ e.stopPropagation(); });
      document.addEventListener('keydown',function(e){
        /* Retired 2026-10-16 (#7/#11): the .chat-window is the single chat
           surface now; this widget no longer opens. */
        return;
      });
      var _v=new THREE.Vector3();
      setInterval(function(){
        var inCity=!!cityPhaseActive;
        wrap.style.display='none'; /* retired 2026-10-16: single chat surface (.chat-window) */
        if(inCity&&!welcomed){ welcomed=true; } /* Han 2026-10-16 #7: the 'Chat ready' line is removed. */
        if(!inCity){ bubble.style.display='none'; if(typing)closeChat(); return; }
        if(performance.now()<bubbleUntil&&walkPlayer&&mapCamera){
          _v.set(walkPlayer.pos.x,walkPlayer.pos.y+2.15,walkPlayer.pos.z).project(mapCamera);
          if(_v.z<1&&_v.z>-1&&Math.abs(_v.x)<1.1&&Math.abs(_v.y)<1.1){
            bubble.style.left=((_v.x*.5+.5)*window.innerWidth)+'px';
            bubble.style.top=((-_v.y*.5+.5)*window.innerHeight)+'px';
            bubble.style.display='block';
          } else bubble.style.display='none';
        } else bubble.style.display='none';
      },50);
    })();
    /* Real-time navigation-style traffic engine — DATA ONLY (Han 2026-10-05).
    /* ---- Building occlusion fade (Han, 2026-10-15; merged from the tiles
       prototype after his PC confirmation) ----
       When a building blocks the camera-to-player sightline, ghost it to
       10% so the player stays visible; restore when clear. Buildings are
       instanced (archetype + chunk passes) or shared-material meshes
       (downtown core), so the fade is a screen-door discard driven per
       building: an instanced attribute for InstancedMeshes, a cloned
       material with a uniform for core meshes. No transparency sorting,
       depth stays correct, curved shading is preserved on clones.
       Scope note: the buildOsmCity archetype InstancedMeshes are NOT
       registered - production's CURVE_CHUNK replaces project_vertex
       without applying instanceMatrix, so those instances render
       collapsed at the mesh origin (latent defect, verified in isolation
       2026-10-15; fixing it is a separate project). The chunk pass
       (generateChunk) is not curve-patched, so its instances render at
       their matrices and fade correctly. */
    var EspilFader={registerMesh:function(){},registerInst:function(){},patchInstanced:function(){},attachInstanced:function(){},tick:function(){}};
    /* Occlusion fade REMOVED (Han 2026-10-16: the screen-door fade
       caused the near-black scene). The registry above is an inert
       no-op shell so existing call sites stay harmless; no material
       is patched and nothing fades. */
    /* Real-time navigation-style traffic engine — DATA ONLY (Han 2026-10-05).
       No visual overlay. Segment flow values simulate for navigation use. */
    var trafficSegs=[];
    var trafficTimer=0;
    function trafficLevel(flow){
      if(flow>.75)return 'clear';
      if(flow>.5)return 'slow';
      if(flow>.3)return 'heavy';
      return 'stopped';
    }
    /* Pedestrian feed (Han 2026-11-05): the walking-NPC module
       (modules/npcs.js) reads THE SAME live segment state and this
       level function through these read-only hooks, so the NPC
       population can never diverge from the traffic the game itself
       simulates. There is no second traffic source. */
    window.__espilTrafficSegs=function(){ return trafficSegs; };
    window.__espilTrafficLevel=trafficLevel;
    function updateTraffic(dt){
      if(!trafficSegs.length)return;
      trafficTimer+=dt;
      if(trafficTimer<3)return;
      trafficTimer=0;
      var now=new Date(),hr=now.getHours()+now.getMinutes()/60;
      var rush=((hr>=7.5&&hr<=9.5)||(hr>=16.5&&hr<=18.5))?.22:0;
      for(var i=0;i<trafficSegs.length;i++){
        var s=trafficSegs[i];
        s.flow+=(Math.random()-.5)*.16-rush*.05;
        var nf=0;
        for(var j=0;j<s.nb.length;j++)nf+=trafficSegs[s.nb[j]].flow;
        if(s.nb.length)nf/=s.nb.length;
        s.flow+=(nf-s.flow)*.2;
        if(Math.random()<.012){s.flow-=.35; s.incident=10;} /* incident: ~30s hazard marker */
        if(s.incident>0)s.incident--;
        if(s.flow<.05)s.flow=.05;
        if(s.flow>1)s.flow=1;
        /* Data-only: flow value simulates; no visual update (Han 2026-10-05). */
      }
      /* Traffic-car sprites removed (Han 2026-11-04, item 2): the flow simulation below keeps running for navigation data; nothing visual spawns from it. */
      syncIncidentMarkers();
    }
    /* Han 2026-10-10: incident hazard markers — flashing amber triangles above
       segments with an active incident (see updateTraffic). Capped at 12 nearest. */
    var incidentMarkers=[];
    var hazardTex=null;
    function getHazardTex(){
      if(hazardTex)return hazardTex;
      var c=document.createElement('canvas');c.width=64;c.height=64;
      var g=c.getContext('2d');
      g.fillStyle='#f5a623';
      g.beginPath();g.moveTo(32,6);g.lineTo(58,54);g.lineTo(6,54);g.closePath();g.fill();
      g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=4;g.stroke();
      g.fillStyle='#141414';g.font='bold 30px sans-serif';g.textAlign='center';
      g.fillText('!',32,47);
      hazardTex=new THREE.CanvasTexture(c);hazardTex.anisotropy=4;
      return hazardTex;
    }
    function syncIncidentMarkers(){
      var px=walkPlayer&&walkPlayer.pos?walkPlayer.pos.x:0,
          pz=walkPlayer&&walkPlayer.pos?walkPlayer.pos.z:0;
      var i,mk,s,mx,mz;
      for(i=incidentMarkers.length-1;i>=0;i--){
        mk=incidentMarkers[i]; s=trafficSegs[mk.si];
        mx=(s.x1+s.x2)/2; mz=(s.z1+s.z2)/2;
        if(!s.incident||(mx-px)*(mx-px)+(mz-pz)*(mz-pz)>450*450){
          mapScene.remove(mk.mesh);
          mk.mesh.geometry.dispose(); mk.mesh.material.dispose();
          incidentMarkers.splice(i,1);
        }else{
          mk.mesh.position.set(mx,3.2,mz);
        }
      }
      if(incidentMarkers.length>=12) return;
      for(var j=0;j<trafficSegs.length&&incidentMarkers.length<12;j++){
        s=trafficSegs[j];
        if(!s.incident) continue;
        var already=false;
        for(var k=0;k<incidentMarkers.length;k++)
          if(incidentMarkers[k].si===j){already=true;break;}
        if(already) continue;
        mx=(s.x1+s.x2)/2; mz=(s.z1+s.z2)/2;
        if((mx-px)*(mx-px)+(mz-pz)*(mz-pz)>450*450) continue;
        var mesh=new THREE.Mesh(new THREE.PlaneGeometry(3,3),
          new THREE.MeshBasicMaterial({map:getHazardTex(),transparent:true,
            depthWrite:false,fog:true}));
        mesh.renderOrder=3; mesh.frustumCulled=false;
        mesh.position.set(mx,3.2,mz);
        mapScene.add(mesh);
        incidentMarkers.push({mesh:mesh,si:j});
      }
    }
    /* Traffic-car sprites REMOVED (Han 2026-11-04, item 2 - the flat
       2D car billboards read as a floating car icon in the world): the
       texture painters, spawn/sync, blob shadows and the car pool are
       gone, and no writer remains for the hoisted carColliders array -
       it stays declared, permanently empty, because the generic
       collision sweep still reads it (the dead traffic-car
       declarations were dropped 2026-11-05). The flow simulation
       (updateTraffic) and the incident markers are data / signage
       features and stay. */
    function updateProps(){
      for(var i=0;i<billboardProps.length;i++){
        var m=billboardProps[i],u=m.userData.prop;
        m.position.set(u.x,u.h/2,u.z);
        m.quaternion.copy(mapCamera.quaternion);
      }
    }
    /* DNA imprint — per Han 2026-10-06: when we land, the Cauldron sticks its DNA on
       the city; the city evolves into something unique with Espil's design (cherry
       blossom trees, a lantern heart at the plaza, drifting petals). Full cinematic
       plays once per page load; the evolved state persists afterwards. */
    var dnaState=null,dnaDone=false;
    function blossomCanvas(){
      var c=document.createElement('canvas');c.width=64;c.height=96;
      var g=c.getContext('2d');g.clearRect(0,0,64,96);
      g.fillStyle='#6b4a2f';g.fillRect(29,60,6,36);
      g.fillStyle='#e8a0c8';g.beginPath();g.arc(32,34,22,0,7);g.fill();
      g.fillStyle='#f7c6e0';g.beginPath();g.arc(24,26,10,0,7);g.fill();
      g.fillStyle='#f2b8d8';g.beginPath();g.arc(41,30,8,0,7);g.fill();
      return c;
    }
    function petalTexture(){
      var c=document.createElement('canvas');c.width=32;c.height=32;
      var g=c.getContext('2d');
      var gr=g.createRadialGradient(16,16,2,16,16,15);
      gr.addColorStop(0,'rgba(255,205,230,1)');gr.addColorStop(1,'rgba(255,160,200,0)');
      g.fillStyle=gr;g.beginPath();g.ellipse(16,16,9,13,.6,0,7);g.fill();
      return new THREE.CanvasTexture(c);
    }
    function startDnaImprint(){
      if(dnaDone||!mapBuilt)return;dnaDone=true;
      var plaza={x:0,z:-95};
      var s=dnaState={t:0,plaza:plaza,group:new THREE.Group(),ambient:false,evolved:false};
      mapScene.add(s.group);
      /* descent beam */
      var beam=new THREE.Mesh(
        new THREE.CylinderGeometry(1.4,2.6,64,14,1,true),
        new THREE.MeshBasicMaterial({color:0xffd9ec,transparent:true,opacity:0,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false})
      );
      beam.position.set(plaza.x,32,plaza.z);s.group.add(beam);s.beam=beam;
      /* double-helix particle strands */
      var N=420,pos=new Float32Array(N*3),i;
      for(i=0;i<N;i++){
        var h=i/N,a=h*Math.PI*10+(i%2)*Math.PI,r=2.4*(1-h*.35);
        pos[i*3]=plaza.x+Math.cos(a)*r;pos[i*3+1]=2+h*60;pos[i*3+2]=plaza.z+Math.sin(a)*r;
      }
      var hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.BufferAttribute(pos,3));
      var helix=new THREE.Points(hg,new THREE.PointsMaterial({color:0xffb7dd,size:1.1,map:petalTexture(),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
      s.group.add(helix);s.helix=helix;
      /* imprint shockwave ring */
      var ring=new THREE.Mesh(new THREE.RingGeometry(.92,1,72),new THREE.MeshBasicMaterial({color:0xffc4e2,transparent:true,opacity:0,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
      ring.rotation.x=-Math.PI/2;ring.position.set(plaza.x,.25,plaza.z);s.group.add(ring);s.ring=ring;
      /* petal storm */
      var M=700,pp=new Float32Array(M*3),j;
      s.petalSeed=new Float32Array(M*2);
      for(j=0;j<M;j++){
        pp[j*3]=plaza.x+(Math.random()-.5)*220;pp[j*3+1]=Math.random()*36;pp[j*3+2]=plaza.z+(Math.random()-.5)*220;
        s.petalSeed[j*2]=Math.random()*Math.PI*2;s.petalSeed[j*2+1]=.5+Math.random()*1.5;
      }
      var pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
      var petals=new THREE.Points(pg,new THREE.PointsMaterial({color:0xf7b8d8,size:.85,map:petalTexture(),transparent:true,opacity:0,depthWrite:false}));
      s.group.add(petals);s.petals=petals;s.petalGeo=pg;
      var flash=document.getElementById('dna-flash');
      if(flash){flash.classList.add('on');setTimeout(function(){flash.classList.remove('on');},900);}
      if(window.__espilToast)window.__espilToast('the Cauldron\u2019s DNA takes root');
    }
    function driftPetals(s,dt){
      var posA=s.petalGeo.attributes.position.array,n=posA.length/3,j;
      for(j=0;j<n;j++){
        var sp=s.petalSeed[j*2+1];
        posA[j*3+1]-=dt*sp*1.6;
        posA[j*3]+=Math.sin(s.t*1.3+s.petalSeed[j*2])*dt*2.2;
        if(posA[j*3+1]<0){
          posA[j*3+1]=30+Math.random()*8;
          posA[j*3]=s.plaza.x+(Math.random()-.5)*220;
          posA[j*3+2]=s.plaza.z+(Math.random()-.5)*220;
        }
      }
      s.petalGeo.attributes.position.needsUpdate=true;
    }
    function updateDnaImprint(dt){
      var s=dnaState;if(!s)return;
      s.t+=dt;var t=s.t;
      driftPetals(s,dt);
      if(s.ambient){s.petals.material.opacity=.26;return;}
      /* beam + helix descend (0-3.2s) */
      var bk=Math.max(0,Math.min(1,t/1.2))*(t>3.2?Math.max(0,1-(t-3.2)/1.2):1);
      s.beam.material.opacity=.55*bk;
      s.helix.material.opacity=.9*bk;
      s.helix.rotation.y+=dt*2.2;
      s.helix.position.y=-t*14;
      /* shockwave (2.2-4.5s) */
      if(t>2.2){
        var rk=Math.min(1,(t-2.2)/2.3),e=rk*rk*(3-2*rk);
        s.ring.scale.setScalar(1+e*130);
        s.ring.material.opacity=.75*(1-rk);
      }
      /* petal storm builds, then settles */
      s.petals.material.opacity=t<6?.85*Math.min(1,t/2.5):Math.max(.26,.85*(1-(t-6)/8));
      /* the evolution locks in at t=4: trees bloom pink, lantern heart lights */
      if(t>=4&&!s.evolved){
        s.evolved=true;
        try{setPropSprite('tree',blossomCanvas().toDataURL());}catch(err){}
        var heart=new THREE.PointLight(0xffb7dd,1.5,60);
        heart.position.set(s.plaza.x,6,s.plaza.z);s.group.add(heart);
      }
      /* retire the transient pieces; petals + heart stay as the evolved city */
      if(t>9){
        s.group.remove(s.beam);s.group.remove(s.helix);s.group.remove(s.ring);
        s.beam=s.helix=s.ring=null;s.ambient=true;
      }
    }
    /* Han 2026-10-10: jump/double/land SFX go file-based (replaces the old
       WebAudio synth blips). Files: assets/sfx/movement/jump_whoosh.wav etc. */
    var JUMP_SFX_SRC={jump:'assets/sfx/movement/jump_whoosh.wav',double:'assets/sfx/movement/double_whoosh.wav',land:'assets/sfx/movement/land_thud.wav'};
    var jumpSfxCache={};
    function walkSfx(kind){
      try{
        var src=JUMP_SFX_SRC[kind]||JUMP_SFX_SRC.land;
        if(!jumpSfxCache[kind]){
          var a=new Audio(src); a.preload='auto'; a.volume=.5;
          jumpSfxCache[kind]=a;
        }
        /* Clone for overlap (double-jump chains, quick landings). */
        var c=jumpSfxCache[kind].cloneNode(); c.volume=.5; c.play().catch(function(){});
      }catch(e){}
    }
    /* Footstep SFX (walk_pavement.wav / run_pavement.wav) removed
       entirely (Han PC QA round 2, 2026-10-18) - see the trigger site
       in updateWalkMap. */
    /* Saved character gender (espil_character, written by the entry
       gate's confirm). 'male' unless a female save exists. */
    function espilSavedGender(){
      try{var s=JSON.parse(window.localStorage.getItem('espil_character')||'null');
        if(s&&(s.gender==='female'||s.gender==='male'))return s.gender;}catch(e){}
      return 'male';
    }
    /* ---- CHARACTER BODY SELECTION (Han 2026-11-16: selection
       fully open - guests AND signed-in users pick a body at the
       character gate). The choice rides the character record as
       espil_character.bodyChoice: 'master' (the in-tree GLB
       masters) or 'style1'..'style4' (the selling Chibi pack
       variants, per gender). Defaults keep every existing
       character exactly as it was: a guest with no saved choice
       is style1 (the landed dummy), a signed-in user with no
       saved choice is the master body. Storage is this device's
       localStorage for BOTH populations - the signed-in look's
       own live persistence is this same record (the custmerge
       account-adoption path is suspended with the customizer,
       CUSTMERGE_ENABLED=false); nothing is stored server-side.
       The presence join frame carries the choice as `body`
       (Worker-sanitised) so peers render the chosen body. ---- */
    var ESPIL_BODY_CHOICES=['master','style1','style2','style3','style4'];
    /* NAME-ONLY ENTRY (Han 2026-11-24): the entrant uniform's
       interim binding - see the neutral branch in
       buildPlayerAvatar. NOT a body choice: 'neutral' stands
       outside ESPIL_BODY_CHOICES (the customizer-once five) and
       is accepted only on the entrant paths. */
    var ESPIL_NEUTRAL_INTERIM_STYLE=1;
    function espilBodyChoiceSaved(){
      try{var s=JSON.parse(window.localStorage.getItem('espil_character')||'null');
        if(s&&ESPIL_BODY_CHOICES.indexOf(s.bodyChoice)>=0)return s.bodyChoice;
        if(s&&s.bodyChoice==='neutral')return 'neutral';}catch(e){}
      return null;
    }
    function espilBodyChoice(){
      var saved=espilBodyChoiceSaved();
      if(saved)return saved;
      return espilGuestNow()?'style1':'master';
    }
    function espilCbStyleNum(choice){
      var m=/^style([1-4])$/.exec(choice||'');
      return m?+m[1]:1;
    }
    /* Owner-only designated body (Han 2026-11-16, restated
       2026-11-17): the server designates ONE account's body -
       Lunaris for the owner's account - in its
       account_designations table; GET /auth/session carries it
       as designatedBody and entry-flow's sync mirrors it onto
       the server-marked session record read here. It is NOT a
       bodyChoice: it sits in no allowlist, no gate list, no
       store path, and the character endpoints reject it; the
       espil_character record never carries it. When present it
       supersedes bodyChoice for this account everywhere the
       body is built, keyed, or reported. The session record is
       rewritten from the server response at every sync, so a
       hand-planted mark in storage does not survive a reload,
       and the presence room independently requires the
       designated account's own handshake before it relays the
       value to anyone. */
    function espilDesignatedBody(){
      try{var s=JSON.parse(window.localStorage.getItem('espil_session_v1')||'null');
        if(s&&s.server===true&&s.designatedBody==='lunaris')return 'lunaris';}catch(e){}
      return null;
    }
    /* The body key buildPlayerAvatar would stamp for this gender
       right now - espilApplyAvatarGender rebuilds when the live
       avatar's key differs (a body change at the gate with the
       same gender must swap the body, not no-op). Under the
       guest-body revert modes the chibi choice is inert: guests
       render the single revert body, signed-in users the master. */
    function espilAvatarBodyKey(gender){
      if(espilDesignatedBody()==='lunaris')return 'lunaris';
      var mode=espilGuestBodyMode();
      if(espilGuestNow()){
        if(espilBodyChoice()==='neutral')return 'neutral'; /* NAME-ONLY ENTRY: the entrant slot's own key */
        if(mode==='chibi')return 'chibi:'+espilBodyChoice();
        if(mode==='kaykit')return 'kaykit';
        return 'sprite';
      }
      var bc=espilBodyChoice();
      if(bc!=='master'&&mode==='chibi')return 'chibi:'+bc;
      return 'master';
    }
    /* Rebuild the avatar in place when the confirmed gender differs
       from the one the current avatar was built with (the preload
       builds the avatar BEFORE a first-time player picks a gender,
       so the confirm path re-applies it). No-op when already right.
       The body key is compared too (Han 2026-11-16): a body change
       at the gate - master <-> chibi style, or style <-> style -
       rebuilds through the same path even when gender is unchanged. */
    window.__espilApplyAvatarGender=function(g){espilApplyAvatarGender(g);}; /* customizer edit mode re-applies a changed gender in place (Han 2026-10-28) */
    function espilApplyAvatarGender(gender){
      if(!walkPlayer||!walkPlayer.av||!mapScene)return;
      if(walkPlayer.av.__gender===gender&&walkPlayer.av.__bodyKey===espilAvatarBodyKey(gender))return;
      var old=walkPlayer.av;
      if(old.group&&old.group.parent)old.group.parent.remove(old.group);
      if(old.shadow&&old.shadow.parent)old.shadow.parent.remove(old.shadow);
      var av=buildPlayerAvatar(gender);
      walkPlayer.av=av;
      mapScene.add(av.group);mapScene.add(av.shadow);
      av.shadow.position.set(walkPlayer.pos.x,.03,walkPlayer.pos.z);
    }
    /* === FOOT-SLIDE SYNC (Han 2026-11-15, gamedevinspire reel
       "Fix Foot Sliding in Unity with Root Motion" adapted to the
       web build): sliding is a rate mismatch - code translates the
       character at one speed while the locomotion clip cycles at
       another. The reel's root motion does not exist here (root
       tracks are stripped; physics owns translation), so the same
       principle is applied in web form: each walk/run clip's
       natural STRIDE SPEED (the ground speed at which its stance
       foot is stationary, measured in-page from the foot bones at
       build time) is cached per clip, and the active locomotion
       action's timeScale is driven every tick to
       actualSpeed / strideSpeed, clamped to [0.2, 64]. The band:
       measured operating points run from ~0.44 (a remote crossing
       the 0.35 m/s walk threshold on the female walk clip) to ~29
       (street-boosted run on the masters run clip); 64 keeps more
       than 2x headroom over the highest legitimate point while a
       degenerate stride estimate can never demand an unbounded
       rate, and 0.2 keeps a near-zero speed from freezing the
       cycle outright. If a clip's stride cannot be measured (no
       foot bones), that clip keeps its previous behaviour -
       timeScale is never written for it. Idle and one-shots are
       never touched. === */
    var ESPIL_STRIDE_TS_MIN=0.2, ESPIL_STRIDE_TS_MAX=64;
    /* ANIMATION SPEED HALVED (Han direct order, 2026-11-16): the
       distance-proportional locomotion playback still read too
       fast on Han's screen, so every timeScale espilStrideSync
       computes is multiplied by ESPIL_ANIM_SPEED_F = 0.5 - walk
       and run, local and remote, every player body family
       together. Strides and movement speeds are unchanged. The
       factor is applied before the [0.2, 64] clamp; the measured
       operating band (~0.44 to ~29 unhalved, ~0.22 to ~14.5
       halved) never reaches either clamp end, so the halving is
       exact at every legitimate operating point. */
    var ESPIL_ANIM_SPEED_F=0.5;
    function espilStrideBone(model,wants){
      var norm=wants.map(function(w){ return String(w).replace(/[^a-z0-9]/gi,'').toLowerCase(); });
      var boneHit=null, anyHit=null;
      model.traverse(function(o){
        var n=(o.name||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
        if(norm.indexOf(n)<0)return;
        if(o.isBone){ if(!boneHit)boneHit=o; }
        else if(!anyHit)anyHit=o;
      });
      return boneHit||anyHit;
    }
    function espilMeasureStride(model,clip){
      if(!model||!clip||!(clip.duration>0))return null;
      if(typeof clip.__espilStride==='number')return clip.__espilStride>0?clip.__espilStride:null;
      try{
        var hips=espilStrideBone(model,['mixamorigHips','hips']);
        /* the plain names ('leftfoot' etc.) are the Chibi pack rig's
           unprefixed Mixamo names (Han 2026-11-16 guest body); the
           masters/KayKit names above match first for their families */
        var fl=espilStrideBone(model,['mixamorigLeftFoot','footl','leftfoot']);
        var fr=espilStrideBone(model,['mixamorigRightFoot','footr','rightfoot']);
        var tl=espilStrideBone(model,['mixamorigLeftToeBase','toesl','lefttoebase']);
        var tr=espilStrideBone(model,['mixamorigRightToeBase','toesr','righttoebase']);
        if(!hips||(!fl&&!fr))return null;
        var sm=new THREE.AnimationMixer(model);
        var act=sm.clipAction(clip);
        act.play();
        sm.update(0);
        /* Estimator (the rig lab's cross-validated method): sample
           one full cycle; per foot, stance = the flat-contact set
           (ankle AND toe in their low height bands, heights taken as
           model-local Y - hips-relative heights are polluted by the
           hips bob and misread the KayKit run stance entirely);
           stride speed = the mean central-difference velocity of
           the ankle/toe midpoint along the stride axis over the
           stance set, with the ankle-only estimator as fallback. */
        var N=200, dur=clip.duration, dt=dur/N, i, fi, t;
        var hv=new THREE.Vector3(), av3=new THREE.Vector3(), tv=new THREE.Vector3();
        var inv=new THREE.Matrix4();
        var feet=[['L',fl,tl],['R',fr,tr]];
        var series={L:[],R:[]};
        for(i=0;i<N;i++){
          t=dur*i/N;
          act.time=t;
          sm.update(0);
          model.updateMatrixWorld(true);
          /* Sample in the model's LOCAL frame: world-axis sampling
             understates the sweep by cos(faceY) whenever the avatar
             group stands rotated (spawn facing 0.5 rad cost the
             local KayKit a factor 0.878 on the rig). Local y is the
             up axis, so the stance height bands carry over. */
          inv.copy(model.matrixWorld).invert();
          hips.getWorldPosition(hv); hv.applyMatrix4(inv);
          for(fi=0;fi<2;fi++){
            var fb=feet[fi][1];
            if(!fb)continue;
            fb.getWorldPosition(av3); av3.applyMatrix4(inv);
            var rec={ax:av3.x-hv.x, ay:av3.y, az:av3.z-hv.z, tx:null, ty:null, tz:null};
            var tb=feet[fi][2];
            if(tb){
              tb.getWorldPosition(tv); tv.applyMatrix4(inv);
              rec.tx=tv.x-hv.x; rec.ty=tv.y; rec.tz=tv.z-hv.z;
            }
            series[feet[fi][0]].push(rec);
          }
        }
        sm.stopAllAction();
        try{ sm.uncacheRoot(model); }catch(_){}
        /* stride axis: the horizontal axis with the larger total
           foot excursion (facing conventions differ per family) */
        var rxSum=0, rzSum=0;
        ['L','R'].forEach(function(k){
          var s=series[k]; if(s.length<8)return;
          var mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;
          s.forEach(function(p){ if(p.ax<mnx)mnx=p.ax; if(p.ax>mxx)mxx=p.ax; if(p.az<mnz)mnz=p.az; if(p.az>mxz)mxz=p.az; });
          rxSum+=mxx-mnx; rzSum+=mxz-mnz;
        });
        var useX=rxSum>=rzSum;
        function fwd(p){ return useX?p.ax:p.az; }
        function stanceSpeed(s,midMode){
          var aMn=1e9,aMx=-1e9,tMn=1e9,tMx=-1e9;
          s.forEach(function(p){
            if(p.ay<aMn)aMn=p.ay; if(p.ay>aMx)aMx=p.ay;
            if(p.ty!==null){ if(p.ty<tMn)tMn=p.ty; if(p.ty>tMx)tMx=p.ty; }
          });
          var aThr=aMn+(midMode?0.35:0.30)*(aMx-aMn);
          var tThr=tMn+0.35*(tMx-tMn);
          var f=s.map(function(p){
            return (p.tx===null)?fwd(p):(fwd(p)+(useX?p.tx:p.tz))/2;
          });
          var sum=0,cnt=0;
          for(var j=0;j<s.length;j++){
            var p=s[j];
            var ok=midMode?(p.ay<=aThr&&(p.ty===null||p.ty<=tThr)):(p.ay<=aThr);
            if(!ok)continue;
            var d=(f[(j+1)%s.length]-f[(j-1+s.length)%s.length])/(2*dt);
            sum+=d; cnt++;
          }
          if(cnt<6)return null;
          var v=Math.abs(sum/cnt);
          return v>0.01?v:null;
        }
        var per=[];
        ['L','R'].forEach(function(k){
          var s=series[k]; if(s.length<8)return;
          var v=stanceSpeed(s,true);
          if(v===null)v=stanceSpeed(s,false);
          if(v!==null)per.push(v);
        });
        if(!per.length)return null;
        var stride=0;
        per.forEach(function(v){ stride+=v; });
        stride/=per.length;
        /* The samples above are model-LOCAL (GLB-native units):
           convert to base-scale metres with the builder's declared
           base scale. Registration timing vs the layer-mode growth
           (visual root x ESPIL_AVATAR_F, applied per frame) and the
           avatar group's facing therefore cannot leak into the
           cached value - both leaked on the rig before this frame
           discipline (async file-clip registration measured ~2.9x
           the lab stride; a rotated spawn facing cost a cos factor).
           espilStrideSync converts back with the visual root's
           live scale every tick. */
        var _base=(model.userData&&typeof model.userData.__avBaseScale==='number'&&model.userData.__avBaseScale>0)?model.userData.__avBaseScale:model.scale.x;
        if(_base>0)stride=stride*_base;
        if(!(stride>=0.05&&stride<=12))return null;
        clip.__espilStride=stride;
        return stride;
      }catch(_){ return null; }
    }
    function espilStrideRegister(av,model,actionName){
      if(actionName!=='walk'&&actionName!=='run')return;
      if(!av||!av.actions||!av.actions[actionName])return;
      var act=av.actions[actionName];
      var s=espilMeasureStride(model,act.getClip());
      if(s){
        act.__espilStride=s;
        if(actionName==='walk')av.__strideWalk=s; else av.__strideRun=s;
      }
    }
    function espilStrideSync(av,speed){
      if(!av||!av.mixer)return;
      var name=av.curAnim;
      if(name!=='walk'&&name!=='run')return;
      var act=av.actions[name];
      if(!act)return;
      var s=act.__espilStride;
      if(!(s>0))return;
      /* cached strides are base-scale metres - convert to the
         stride the rendered body actually sweeps right now */
      var vr=av.__visualRoot||av.visual;
      if(vr&&vr.userData&&typeof vr.userData.__avBaseScale==='number'&&vr.userData.__avBaseScale>0){
        s=s*(vr.scale.x/vr.userData.__avBaseScale);
      }
      var ts=(speed/s)*ESPIL_ANIM_SPEED_F;
      if(ts<ESPIL_STRIDE_TS_MIN)ts=ESPIL_STRIDE_TS_MIN;
      else if(ts>ESPIL_STRIDE_TS_MAX)ts=ESPIL_STRIDE_TS_MAX;
      act.timeScale=ts;
      av.__strideTs=ts;
      av.__strideSpeed=speed;
    }
    window.__espilStrideSyncState=function(){
      var out={local:null,remotes:[],clamp:[ESPIL_STRIDE_TS_MIN,ESPIL_STRIDE_TS_MAX]};
      try{
        var p=(typeof walkPlayer!=='undefined')?walkPlayer:null;
        if(p&&p.av){
          var av=p.av, ca=av.actions[av.curAnim];
          out.local={family:av.__lunaris?'lunaris':(av.__chibi?'chibi':(av.__kaykit?'kaykit':'master')),gender:av.__gender||null,anim:av.curAnim,
            walkStride:(typeof av.__strideWalk==='number')?av.__strideWalk:null,
            runStride:(typeof av.__strideRun==='number')?av.__strideRun:null,
            currentTimeScale:ca?ca.timeScale:null,
            currentSpeed:(typeof p._fsSpeed==='number')?p._fsSpeed:null};
        }
        if(typeof __espilRemotes!=='undefined'&&__espilRemotes){
          for(var id in __espilRemotes){
            var R=__espilRemotes[id];
            if(!R)continue;
            var ra=R.actions[R.curAnim];
            out.remotes.push({id:id,family:R.__lunaris?'lunaris':(R.__chibi?'chibi':(R.__kaykit?'kaykit':'master')),anim:R.curAnim,speed:R.speed,
              walkStride:(typeof R.__strideWalk==='number')?R.__strideWalk:null,
              runStride:(typeof R.__strideRun==='number')?R.__strideRun:null,
              currentTimeScale:ra?ra.timeScale:null});
          }
        }
      }catch(_){}
      return out;
    };
    function buildWalkerAvatar(gender){
      gender=(gender==='female')?'female':'male';
      /* Body + skeleton come from ONE GLB per gender (Mixamo 22-bone
         rig, 1.2 units, faces +z, textures embedded): male.glb for
         male; female_idle.glb for female - every female clip file
         embeds the same full skinned body (verified 2026-10-18:
         1 mesh, 1 skin, 25 nodes, height 1.2, same as male.glb, so
         the 1.5x scale and bbox grounding carry over unchanged).
         Clips: the body's embedded set seeds idle/walk/run, then
         per-action GLBs register the rest of the action table. */
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      var av={group:g,shadow:shadow,ready:false,mixer:null,actions:{},curAnim:null,__gender:gender};
      av.playAnim=function(name){
        if(!av.mixer||!av.actions[name]||av.curAnim===name)return;
        var prev=av.actions[av.curAnim],next=av.actions[name];
        av.curAnim=name;
        next.reset().fadeIn(.18).play();
        next.__espilGen=(next.__espilGen||0)+1;
        if(prev&&prev!==next){prev.fadeOut(.18);(function(pp,gg){setTimeout(function(){if(pp.__espilGen===gg)pp.stop();},220);})(prev,prev.__espilGen||0);}
      };
      try{
        if(typeof THREE.GLTFLoader==='undefined')throw new Error('no GLTFLoader');
        new THREE.GLTFLoader().load(gender==='female'?'assets/character/female_idle.glb':'assets/character/male.glb',function(gltf){
          var model=gltf.scene;
          /* The animation clips carry a baked-in half-turn on the hips vs the bind pose,
           so the model needs a PI counter-rotation to face the movement direction. */
        model.rotation.y=Math.PI;
          model.scale.setScalar(1.5); /* 1.2 -> 1.8 units, reads as a person in this downtown */
          var bbox=new THREE.Box3().setFromObject(model);
          model.position.y-=bbox.min.y; /* feet exactly on the ground */
          model.traverse(function(o){if(o.isMesh){o.castShadow=true;}});
          av.__visualRoot=model; model.userData.__avBaseScale=1.5; model.userData.__avBaseY=model.position.y; /* layer-mode avatar scale (below) grows from this base */
          g.add(model);
          var mixer=new THREE.AnimationMixer(model);
          av.mixer=mixer;
          var clips=gltf.animations||[];
          function findClip(rx){for(var i=0;i<clips.length;i++){if(rx.test(clips[i].name))return clips[i];}return null;}
          var idleClip=findClip(/baselayer|idle/i)||clips[0];
          var walkClip=findClip(/walking/i),runClip=findClip(/running/i);
          if(idleClip)av.actions.idle=mixer.clipAction(idleClip);
          if(walkClip)av.actions.walk=mixer.clipAction(walkClip);
          if(runClip)av.actions.run=mixer.clipAction(runClip);
          espilStrideRegister(av,model,'walk'); /* FOOT-SLIDE SYNC: embedded locomotion strides, measured once at build */
          espilStrideRegister(av,model,'run');
          try{ mixer.update(0); }catch(_){}
          av.ready=true;
          av.playAnim('idle');
          /* === 15-animation system (QA relay 2026-10-07): separate GLBs per clip.
             All Mixamo 22-bone, mixamorig:*. Male keeps π rotation (baked half-turn).
             Root motion stripped from all — game physics drives movement. */
          function stripRootMotion(clip){
            clip.tracks=clip.tracks.filter(function(t){
              var n=(t.name||'').toLowerCase();
              var isPos=n.indexOf('.position')>=0;
              var isRoot=/^(mixamorig[_:]?hips|hips|armature|root)/.test(n);
              return !(isPos&&isRoot);
            });
            return clip;
          }
          function loadAnimClip(file,actionName,loop){
            try{
              new THREE.GLTFLoader().load('assets/character/'+file,function(gltf){
                var cs=gltf.animations||[];
                if(!cs.length)return;
                var clip=stripRootMotion(cs[0]);
                var act=mixer.clipAction(clip);
                if(!loop){act.setLoop(THREE.LoopOnce);act.clampWhenFinished=true;}
                var oldAct=av.actions[actionName];
                av.actions[actionName]=act;
                if(actionName==='walk'||actionName==='run'){ espilStrideRegister(av,model,actionName); try{ mixer.update(0); }catch(_){} } /* FOOT-SLIDE SYNC: file clips (male walk/run) replace the embedded set - measure the clip that actually plays */
                /* Take over playback when the replaced action is the
                   one on stage (Han PC verdict 2026-10-19 #6): male.glb's
                   embedded 'baselayer' idle is a static bind pose (the
                   T-pose), and the real idle arrives as male_idle.glb -
                   the old code only swapped the table entry, so the
                   bind pose kept playing and playAnim('idle') early-
                   returned forever. The new clip now crossfades in. */
                if(oldAct&&oldAct!==act&&av.curAnim===actionName){
                  act.__espilGen=(act.__espilGen||0)+1;
                  act.reset().fadeIn(.15).play();
                  oldAct.fadeOut(.15);
                  (function(pp,gg){setTimeout(function(){if(pp.__espilGen===gg)pp.stop();},200);})(oldAct,oldAct.__espilGen||0);
                }
              });
            }catch(e){/* optional — fallback to built-in */}
          }
          if(gender==='female'){
            /* Female action table (activation, Han 2026-10-18;
               locomotion fix, Han 2026-10-19): idle/walk/run are NOT
               loaded from separate files anymore - the female body
               file (female_idle.glb) now embeds all three clips
               ('Idle', 'Walking', 'Running'), exactly like male.glb,
               and the body seeding above registers them the moment
               the body lands. The separate 16 MB walk/run files made
               the character slide in the idle pose for the whole
               download window on a real connection. The remaining
               actions load as animation-only files (KBs, not MBs). */
            loadAnimClip('female_stop.glb','stop',false);
            loadAnimClip('female_swim.glb','swim',true);
            loadAnimClip('female_swim_idle.glb','swimIdle',true);
            loadAnimClip('female_jump.glb','jump',false);
            loadAnimClip('female_jump_double.glb','doubleJump',false);
            loadAnimClip('female_climb.glb','climb',true);
            loadAnimClip('female_attack.glb','attack',false);
            loadAnimClip('female_checkout.glb','checkout',false);
            loadAnimClip('female_chat.glb','chat',false);
            /* Descent pair (dive/land) loads through a dedicated
               path with the SAME entry contract as the male merged
               file: the descent waits for these clips
               (__espilDescentClipsReady flips when both register),
               so a first-time female entry does not fall in the idle
               pose while 16 MB clips are still decoding. A bounded
               grace keeps a missing file from ever trapping the
               entry - the descent then falls back to plain physics,
               like the male path's failure mode. */
            var espilFemaleDescentPending=2;
            function espilFemaleDescentClip(file,actionName){
              function done(){
                if(--espilFemaleDescentPending<=0)window.__espilDescentClipsReady=true;
              }
              try{
                new THREE.GLTFLoader().load('assets/character/'+file,function(gltf){
                  var cs=gltf.animations||[];
                  if(cs.length){
                    var clip=stripRootMotion(cs[0]);
                    var act=mixer.clipAction(clip);
                    act.setLoop(THREE.LoopOnce);act.clampWhenFinished=true;
                    av.actions[actionName]=act;
                  }
                  done();
                },undefined,function(){ done(); });
              }catch(e){ done(); }
            }
            espilFemaleDescentClip('female_dive.glb','dive');
            espilFemaleDescentClip('female_land.glb','land');
            setTimeout(function(){ window.__espilDescentClipsReady=true; },120000);
          } else {
          /* Male: replace built-ins with new versions, add new states */
          loadAnimClip('male_idle.glb','idle',true);
          loadAnimClip('male_walk.glb','walk',true); /* asset-room verified Walk (Han original rig extraction, 2026-10-15) - the old male_walk_casual.glb conversion has a hand/neck twist defect and is NOT used (PC feedback #18) */
          loadAnimClip('male_run.glb','run',true); /* asset-room verified Run (Han original rig extraction, 2026-10-17) - the male_run_charge.glb conversion lost all Spine motion (0.0 deg deviation) with inflated hand/neck deviation; Han ruled the gait unnatural and ordered the original rig's embedded Running */
          loadAnimClip('male_stop.glb','stop',false);
          loadAnimClip('male_swim.glb','swim',true);
          loadAnimClip('male_swim_idle.glb','swimIdle',true);
          /* Default jump = the plain hop (Han's decision 2026-10-19,
             PC verdict batch 3 determination): male_jump_armsopen.glb
             is a 3.7 s acrobatic tumble that read as broken rigging
             when time-scaled 5.34x onto the 0.69 s hop, so 'jump'
             loads male_jump.glb (1.9 s plain hop, the same source the
             female jump uses). The armsopen file stays in the repo,
             unloaded by the table. */
          loadAnimClip('male_jump.glb','jump',false);
          loadAnimClip('male_jump_double.glb','doubleJump',false);
          loadAnimClip('male_climb.glb','climb',true); /* ESPIL CLIMB (self-city port, 2026-10-16): asset-room world-delta retarget */
          loadAnimClip('male_attack.glb','attack',false);
          loadAnimClip('male_checkout.glb','checkout',false);
          loadAnimClip('male_chat.glb','chat',false);
          /* jumpLegacy: the same plain hop, kept as playJump fallback if the primary load ever fails */
          loadAnimClip('male_jump.glb','jumpLegacy',false);
          loadAnimClip('male_jump_double.glb','doubleJump',false);
          loadAnimClip('male_attack.glb','attack',false);
          loadAnimClip('male_checkout.glb','checkout',false);
          loadAnimClip('male_chat.glb','chat',false);
          /* jumpLegacy: the same plain hop, kept as playJump fallback if the primary load ever fails */
          loadAnimClip('male_jump.glb','jumpLegacy',false);
          /* Sky-descent clips (Meshy action 508, wired for the tiles
             integration): ONE GLB holds dive (frames 0-19) + land
             (19-93) at 30fps. Split with subclip. The Hips position
             track is KEPT (the land crouch lives in it) but re-based
             so the final frame matches the idle clip's standing Hips
             height, with X/Z pinned to the first frame - descent
             physics owns the actual height and horizontal position. */
          (function loadDescentClips(){
            try{
              new THREE.GLTFLoader().load('tiles/male_dive_land_2.glb',function(gltf){
                var cs=gltf.animations||[]; if(!cs.length)return;
                var full=cs[0],hipsTrack=null,ti,ii;
                /* 2026-10-16 (asset room verified retarget): this GLB is
                   no longer the raw Meshy export - it was rebuilt on the
                   game skeleton with world-space delta retargeting, so
                   its tracks already carry game-rig names AND game-rig
                   rotation axes (world-delta error 0.01-0.06 deg). The
                   old NAME_MAP rename must NOT be applied: renaming the
                   raw export had left rotations in the source rig's
                   axes and the dive pose played broken (~100 deg avg,
                   180 worst). Keep every rotation track plus the Hips
                   position track; drop other position/scale tracks
                   (per-bone positions are bind offsets the rig has). */
                full.tracks=full.tracks.filter(function(t){
                  if(/\.quaternion$/.test(t.name))return true;
                  if(t.name==='mixamorigHips.position')return true;
                  return false;
                });
                for(ti=0;ti<full.tracks.length;ti++){
                  if(full.tracks[ti].name==='mixamorigHips.position'){hipsTrack=full.tracks[ti];break;}
                }
                if(hipsTrack){
                  var standY=null;
                  if(idleClip)for(ii=0;ii<idleClip.tracks.length;ii++){
                    if(idleClip.tracks[ii].name===hipsTrack.name){standY=idleClip.tracks[ii].values[1];break;}
                  }
                  var v=hipsTrack.values,n=v.length/3,lastY=v[(n-1)*3+1];
                  var off=(standY!==null?standY:lastY)-lastY,x0=v[0],z0=v[2];
                  for(var ki=0;ki<n;ki++){v[ki*3]=x0;v[ki*3+1]+=off;v[ki*3+2]=z0;}
                }
                var diveAct=mixer.clipAction(THREE.AnimationUtils.subclip(full,'espilDive',0,20,30));
                diveAct.setLoop(THREE.LoopOnce);diveAct.clampWhenFinished=true;
                av.actions.dive=diveAct;
                var landAct=mixer.clipAction(THREE.AnimationUtils.subclip(full,'espilLand',19,94,30));
                landAct.setLoop(THREE.LoopOnce);landAct.clampWhenFinished=true;
                av.actions.land=landAct;
                window.__espilDescentClipsReady=true; /* entry gate (PC feedback #16/#19): the descent waits for its clips */
              });
            }catch(e){/* descent falls back to plain physics landing */}
          })();
          /* The pre-activation female staging loads (av.femaleClips)
             were removed 2026-10-19: nothing consumed them since the
             female branch went live, and they cost four 16 MB loads
             on every male entry. */
          } /* end gender branch */
          /* One-shot animation player (for jump, attack, stop, checkout, chat).
             Plays the clip once, then returns to locomotion. */
          av.playOneShot=function(name,durMs){
            if(!av.mixer||!av.actions[name])return false;
            // Fallback to legacy jump if new jump not loaded yet
            if(name==='jump'&&!av.actions.jump&&av.actions.jumpLegacy)name='jumpLegacy';
            var act=av.actions[name];
            if(!act)return false;
            var cur=av.actions[av.curAnim];
            av.curAnim=name;
            /* Generation guard (Han jump-bug report, 2026-10-19): every
               scheduled stop below captures the action's generation and
               fires only if the action was not restarted meanwhile. The
               blind timers used to kill a live action whenever the same
               clip restarted inside the fade window (land -> selector
               crossfade schedules stop(jump) at +220 ms -> instant
               re-jump restarts that same action -> the stale stop fires
               mid-jump and the model slides with no driving action
               until the one-shot timer clears). */
            act.__espilGen=(act.__espilGen||0)+1;
            var actGen=act.__espilGen;
            act.reset().fadeIn(.12).play();
            if(cur&&cur!==act){
              cur.fadeOut(.12);
              (function(pp,gg){setTimeout(function(){if(pp.__espilGen===gg)pp.stop();},180);})(cur,cur.__espilGen||0);
            }
            var dur=durMs||((act.getClip().duration||2)*1000);
            setTimeout(function(){
              if(av.curAnim!==name)return;
              act.fadeOut(.15);
              setTimeout(function(){if(act.__espilGen===actGen)act.stop();},180);
              av.curAnim=null;
            },dur);
            return true;
          };
          /* Jump: single=jump, double=doubleJump. Han PC verdict
             2026-10-19 #4: the transition is quicker, and the clip
             must be FINISHED when the character lands - the raw clips
             run 1.9-3.7 s against a ~0.69 s hop (jumpV 9, gravity 26),
             so the action is time-scaled to the expected airtime at
             launch and the one-shot ends with the touchdown. */
          av.playJump=function(isDouble){
            var name=isDouble?'doubleJump':'jump';
            var act=av.actions[name]||(name==='jump'?av.actions.jumpLegacy:null);
            if(!act)return av.playOneShot(name);
            var dur=act.getClip().duration||1;
            var air=isDouble?1.15:(2*9/26);
            act.timeScale=Math.min(6,Math.max(1,dur/air));
            return av.playOneShot(name,Math.round(dur/act.timeScale*1000));
          };
        },undefined,function(err){
          if(window.__espilToast)window.__espilToast('Character failed to load');
        });
      }catch(e){
        if(window.__espilToast)window.__espilToast('Character failed to load');
      }
      return av;
    }
    function addCollider(x0,x1,z0,z1,bottom,top){
      walkColliders.push({x0:x0,x1:x1,z0:z0,z1:z1,bottom:bottom,top:top});
    }
    function buildWalkMapOnce(){
      if(mapBuilt)return;mapBuilt=true;
      /* #8: Start loading OSM real building data */
      if(typeof loadOsmChunks==='function')loadOsmChunks();
      if(typeof loadEspilDistrict==='function')loadEspilDistrict(); /* ESPIL DISTRICT BUILD (self-city port, 2026-10-16) */
      /* Han 2026-10-10 rebuild: Build OSM city when data ready */
      var osmBuildTimer=setInterval(function(){
        if(typeof osmChunks!=='undefined'&&osmChunks&&typeof buildOsmCity==='function'){
          clearInterval(osmBuildTimer);
          buildOsmCity();
        }
      },500);
      /* Timeout after 10s */
      setTimeout(function(){clearInterval(osmBuildTimer);},10000);
      mapScene=new THREE.Scene();
      mapScene.fog=new THREE.Fog(0x9ec8e8,200,1500);
      /* 5km city base ground: 10km x 10km plane at y=0, below downtown pads (.04)
         and chunk grounds (.03). Segmented for the curvature shader. */
      var baseGroundMat=new THREE.MeshLambertMaterial({color:0x6a7a5a});
            var baseGround=new THREE.Mesh(
        new THREE.PlaneGeometry(10200,10200,64,64),
        baseGroundMat
      );
      baseGround.rotation.x=-Math.PI/2;
      baseGround.position.set(0,0,0);
      baseGround.receiveShadow=true;
      mapScene.add(baseGround);
      /* #8b (Asset room 2026-10-09): Esri World Imagery satellite ground.
         Covers x:-5008~5356, z:-5521~4854. Replaces procedural grass/cobble/water/roads. */
      var satBounds={x0:-5008,x1:5356,z0:-5521,z1:4854};
      window.__satelliteReady=false;
      (function loadSatellite(){
        var url='assets/ground/satellite_z15.jpg';
        var w=satBounds.x1-satBounds.x0,h=satBounds.z1-satBounds.z0;
        /* Load texture FIRST, then create mesh with it (avoids material update issues) */
        new THREE.TextureLoader().load(url,
          function(tex){
            /* onLoad */
            console.log('[Satellite] Texture loaded: '+tex.image.width+'x'+tex.image.height);
            tex.anisotropy=4;
            tex.colorSpace=THREE.SRGBColorSpace;
            var smat=new THREE.MeshLambertMaterial({map:tex});
            /* 32x32 segments for globe curvature (Han 2026-10-10 #3) */
            var smesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h,32,32),smat);
            smesh.rotation.x=-Math.PI/2;
            smesh.position.set((satBounds.x0+satBounds.x1)/2,0.035,(satBounds.z0+satBounds.z1)/2);
            smesh.receiveShadow=true;
            smesh.frustumCulled=false;
            /* Apply globe curve */
                        mapScene.add(smesh);
            window.__satelliteReady=true;
            espilWaterPhotoArm(tex.image); refreshWaterChunks(); /* water overlay photo sampler (item 6a) */
            window.__satTexSize=tex.image.width+'x'+tex.image.height;
            if(window.__satelliteProgress)window.__satelliteProgress(100);
            console.log('[Satellite] Loaded');
          },
          function(prog){
            /* onProgress */
            if(prog.total>0){
              var pct=Math.min(99,Math.round(prog.loaded/prog.total*100));
              if(window.__satelliteProgress)window.__satelliteProgress(pct);
            }
          },
          function(err){
            /* onError */
            console.error('[Satellite] Failed:',err);
            if(window.__satelliteProgress)window.__satelliteProgress(-1);
          }
        );
      })();
      /* Esri attribution (required) */
      (function addSatAttribution(){
        var div=document.createElement('div');
        div.id='sat-attribution';
        div.textContent='Imagery © Esri World Imagery';
        div.style.cssText='position:fixed;bottom:8px;right:10px;z-index:35;'+
          'font:500 .65rem "Manrope",sans-serif;color:rgba(255,255,255,.55);'+
          'text-shadow:0 1px 3px rgba(0,0,0,.7);pointer-events:none;display:none;';
        document.body.appendChild(div);
        /* Show only in map */
        var obs=new MutationObserver(function(){
          div.style.display=document.body.classList.contains('in-map')?'block':'none';
        });
        obs.observe(document.body,{attributes:true,attributeFilter:['class']});
      })();
      /* The landing's real sky: sun-driven shader dome (daylight through twilight to night).
         Plus real-time moon (opposite the sun = full moon, rises at sunset) and
         procedural stars that fade in at night (Han 2026-10-05). */
      mapSkyU={
        sunDirection:{value:new THREE.Vector3(0,1,0)},
        moonDirection:{value:new THREE.Vector3(0,-1,0)},
        upDirection:{value:new THREE.Vector3(0,1,0)},
        daylight:{value:1}
      };
      mapSkyDome=new THREE.Mesh(new THREE.SphereGeometry(700,40,24),new THREE.ShaderMaterial({
        side:THREE.BackSide,depthWrite:false,fog:false,uniforms:mapSkyU,
        vertexShader:'varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
        fragmentShader:'uniform vec3 sunDirection;uniform vec3 moonDirection;uniform vec3 upDirection;uniform float daylight;varying vec3 vWorld;float hash13(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}void main(){vec3 ray=normalize(vWorld-cameraPosition);float h=clamp(dot(ray,normalize(upDirection)),0.0,1.0);vec3 nightH=vec3(.018,.045,.09);vec3 nightT=vec3(.004,.009,.025);vec3 dayH=vec3(.42,.68,.82);vec3 dayT=vec3(.035,.22,.48);vec3 base=mix(mix(nightH,nightT,pow(h,.55)),mix(dayH,dayT,pow(h,.48)),daylight);float sun=max(dot(ray,normalize(sunDirection)),0.0);base+=vec3(1.0,.56,.28)*pow(sun,56.0)*(1.0-daylight*.35);base+=vec3(1.0,.92,.7)*pow(sun,420.0);float nightF=1.0-daylight;'
        +'vec3 sc=ray*220.0;vec3 cellId=floor(sc);float sh=hash13(cellId);float star=smoothstep(.992,1.0,sh);vec3 cellPos=fract(sc)-.5;star*=smoothstep(.35,.08,length(cellPos));float tw=.75+.25*sin(sh*91.7);base+=vec3(.88,.93,1.0)*star*tw*nightF*smoothstep(.02,.25,h);'
        +'vec3 moonDir=normalize(moonDirection);float moonCos=dot(ray,moonDir);float moonAng=.032;float disk=smoothstep(cos(moonAng),cos(moonAng*.82),moonCos);vec3 mUp=abs(moonDir.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.);vec3 mRight=normalize(cross(moonDir,mUp));vec3 mUp2=cross(mRight,moonDir);vec2 mUV=vec2(dot(ray,mRight),dot(ray,mUp2))/moonAng;float maria=hash13(vec3(floor(mUV*7.0),3.7));float maria2=hash13(vec3(floor(mUV*13.0),9.1));vec3 moonCol=vec3(.93,.95,.98)*(.82+.18*smoothstep(.25,.75,maria));moonCol*= .9+.1*smoothstep(.3,.7,maria2);float limb=smoothstep(1.0,.55,length(mUV));moonCol*=.75+.25*limb;base=mix(base,moonCol,disk*nightF);base+=vec3(.75,.82,.95)*pow(max(moonCos,0.0),900.0)*.55*nightF;'
        +'gl_FragColor=vec4(base,1.0);}'
      }));
      mapSkyDome.frustumCulled=false;
      mapSkyDome.renderOrder=-10;
      mapScene.add(mapSkyDome);
      var fw=frame.clientWidth||window.innerWidth,fh=frame.clientHeight||window.innerHeight;
      mapCamera=new THREE.PerspectiveCamera(55,fw/Math.max(1,fh),.1,8000);
      var hemi=new THREE.HemisphereLight(0xcfe4ff,0x8a9078,.95);mapScene.add(hemi);
      var sun=new THREE.DirectionalLight(0xfff1d8,.95);
      mapHemiL=hemi;mapSunL=sun;
      sun.position.set(70,110,40);sun.castShadow=true;
      sun.shadow.mapSize.set(2048,2048);
      sun.shadow.camera.left=-130;sun.shadow.camera.right=130;
      sun.shadow.camera.top=130;sun.shadow.camera.bottom=-130;
      sun.shadow.camera.far=420;sun.shadow.bias=-.0004;
      mapScene.add(sun);mapScene.add(sun.target);
      renderer.shadowMap.enabled=true;
      renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      /* Plain ground — no texture, no pattern. Segmented so the vertex-shader curve stays smooth. */
      /* Han's real facades. Facade: mostly modern, sometimes art_deco/shop_terrace. */
      var facadeFiles=[
        {f:'081_modern.png',w:30},{f:'082_modern.png',w:30},
        {f:'031_art_deco.png',w:15},{f:'032_art_deco.png',w:10},
        {f:'091_shop_terrace.png',w:15}
      ];
      function pickFacade(){
        var r=rnd()*100,acc=0;
        for(var fi=0;fi<facadeFiles.length;fi++){acc+=facadeFiles[fi].w;if(r<acc)return facadeFiles[fi].f;}
        return facadeFiles[0].f;
      }
      var facadeMatCache={};
      function facadeMats(file,roofColor){
        var key='plain_'+roofColor;
        var fm=facadeMatCache[key];
        if(!fm){
          /* Han 2026-10-16 (PC verdict on the merged build): building
             TEXTURES REMOVED - walls render as palette tint only, no
             map and no emissive map is loaded or applied on any
             building path. The facade file list and pickFacade stay
             in place as dormant texture-ready structure. */
          var wallCol=new THREE.Color(roofColor); wallCol.lerp(new THREE.Color(0xffffff),.25);
          var fside=new THREE.MeshLambertMaterial({color:wallCol});
          /* slight flat emissive so buildings stay visible at night
             (placeholder until real window lights are implemented) */
          fside.emissive=new THREE.Color(0x2a3442);
          fside.emissiveIntensity=.5;
                    var froof=curvedMat(roofColor);
          fm=[fside,fside,froof,froof,fside,fside]; /* +x,-x,+y,-y,+z,-z */
          facadeMatCache[key]=fm;
        }
        return fm;
      }
      function buildingAt(w,h,d,x,y,z,color){
        var bm=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),facadeMats(pickFacade(),color));
        bm.position.set(x,y,z);bm.castShadow=true;bm.receiveShadow=true;mapScene.add(bm);return bm;
      }
      var ground=new THREE.Mesh(new THREE.PlaneGeometry(640,640,64,64),curvedMat(0xa7b198));
      ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;mapScene.add(ground);
      /* Han's modern-city road tiles: asphalt with lane dashes + curb edges. */
      function roadTexture(rot, plain, fourLane){
        var rt=new THREE.TextureLoader().load('assets/props/ground/'+(plain?'road_plain.png':(fourLane?'road_4lane.png':'road_lane.png')));
        /* QA #16 (2026-10-06): MirroredRepeat on the tiling axis hides seams between tiles. */
        rt.wrapS=THREE.RepeatWrapping;
        rt.wrapT=plain?THREE.RepeatWrapping:THREE.MirroredRepeatWrapping;
        if(rot&&!plain){rt.center.set(.5,.5);rt.rotation=Math.PI/2;}
        /* repeat applies after rotation in the UV transform, so rotated uses (1,22) */
        rt.repeat.set(1,plain?1:22);
        return rt;
      }
      var roadMatH4=new THREE.MeshLambertMaterial({map:roadTexture(true,false,true)});      var roadMatV4=new THREE.MeshLambertMaterial({map:roadTexture(false,false,true)});      var roadMatX=new THREE.MeshLambertMaterial({map:roadTexture(false,true,false)});      /* Han 2026-10-05 (corrected): minor streets are flat lawns, NOT asphalt.
         Flat grass COLOR only — no tile texture (seams visible). */
      var lawnMat=curvedMat(0x7fae62);
      var padMat=curvedMat(0xb9c1ac);
      var BLOCK=26,STREET=12,HALF=101;
      /* Han 2026-10-10 rebuild: Skip procedural grid, use OSM data instead */
      var USE_OSM_REBUILD=true;
      if(!USE_OSM_REBUILD){
      var streetC=[-95,-57,-19,19,57,95],blockC=[-76,-38,0,38,76];
      var si;
      for(si=0;si<streetC.length;si++){
        /* Major avenues only get 4-lane asphalt (Han 2026-10-05):
           east-west "Georgia St" (z=19, idx 3), north-south "Kingsway" (x=-19, idx 2).
           All other streets are flat grass lawns. */
        var isMajorH=(si===3), isMajorV=(si===2);
        /* #8b: Satellite shows real roads — stylized road planes removed */
        /*
        var rz=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,STREET,48,4),isMajorH?roadMatH4:lawnMat);
        rz.rotation.x=-Math.PI/2;rz.position.set(0,.02,streetC[si]);rz.receiveShadow=true;mapScene.add(rz);
        var rx=new THREE.Mesh(new THREE.PlaneGeometry(STREET,HALF*2,4,48),isMajorV?roadMatV4:lawnMat);
        rx.rotation.x=-Math.PI/2;rx.position.set(streetC[si],.021,0);rx.receiveShadow=true;mapScene.add(rx);
        */
      }
      /* Intersection squares: asphalt only where a major avenue crosses (keeps it continuous);
         all minor-minor crossings are lawn. */
      for(var xi=0;xi<streetC.length;xi++)for(var xj=0;xj<streetC.length;xj++){
        /* #8b: Satellite shows real roads — intersection planes removed */
        /*
        var majorXing=(xi===2||xj===3);
        var ix=new THREE.Mesh(new THREE.PlaneGeometry(STREET,STREET,4,4),majorXing?roadMatX:lawnMat);
        ix.rotation.x=-Math.PI/2;ix.position.set(streetC[xi],.022,streetC[xj]);
        ix.receiveShadow=true;mapScene.add(ix);
        */
      }
      /* Narrow alleys through block centers (Han 2026-10-05 — more interesting blocks).
         4-unit plain asphalt strips; buildings may partially overlap (colliders handle it). */
      var alleyMat=new THREE.MeshLambertMaterial({map:roadTexture(false,true,false)});
      alleyMat.map.repeat.set(1,3);      for(bi=0;bi<blockC.length;bi++)for(bj=0;bj<blockC.length;bj++){
        if(rnd()>.7)continue; /* not every block gets alleys */
        var abx=blockC[bi],abz=blockC[bj];
        var ah=new THREE.Mesh(new THREE.PlaneGeometry(26,4,8,2),alleyMat);
        ah.rotation.x=-Math.PI/2;ah.position.set(abx,.025,abz);ah.receiveShadow=true;mapScene.add(ah);
        var av=new THREE.Mesh(new THREE.PlaneGeometry(4,26,2,8),alleyMat);
        av.rotation.x=-Math.PI/2;av.position.set(abx,.026,abz);av.receiveShadow=true;mapScene.add(av);
      }
      /* Real-time navigation-style traffic engine — DATA ONLY.
         Road network -> segments between intersections. Each segment carries a
         flow value (1 = free). updateTraffic() ticks every few seconds. */
      function addTrafficSeg(x1,z1,x2,z2){
        var len=Math.hypot(x2-x1,z2-z1);
        var horiz=Math.abs(z2-z1)<.01;
        var segW=horiz?len:STREET,segD=horiz?STREET:len;
        /* Data-only: no visual mesh (Han 2026-10-05 — overlay looked off).
           Segment flow data still simulates for navigation use. */
        var seg={x1:x1,z1:z1,x2:x2,z2:z2,flow:.45+Math.random()*.55,mesh:null,nb:[]};
        trafficSegs.push(seg);
        return seg;
      }
      var tBounds=[-HALF].concat(streetC,[HALF]);
      for(si=0;si<streetC.length;si++){
        for(var tk=0;tk<tBounds.length-1;tk++){
          addTrafficSeg(tBounds[tk],streetC[si],tBounds[tk+1],streetC[si]);
          addTrafficSeg(streetC[si],tBounds[tk],streetC[si],tBounds[tk+1]);
        }
      }
      for(var ta=0;ta<trafficSegs.length;ta++)for(var tb=ta+1;tb<trafficSegs.length;tb++){
        var A=trafficSegs[ta],B=trafficSegs[tb];
        var touch=(Math.abs(A.x2-B.x1)<.01&&Math.abs(A.z2-B.z1)<.01)||
                   (Math.abs(A.x1-B.x2)<.01&&Math.abs(A.z1-B.z2)<.01)||
                   (Math.abs(A.x2-B.x2)<.01&&Math.abs(A.z2-B.z2)<.01)||
                   (Math.abs(A.x1-B.x1)<.01&&Math.abs(A.z1-B.z1)<.01);
        if(touch){A.nb.push(tb);B.nb.push(ta);}
      }
      /* Traffic lights (Han 2026-10-10): at each street intersection.
         Cycle 30s: 12s NS-green, 3s yellow, 12s EW-green, 3s yellow.
         Offset by index so adjacent lights desync. */
      var trafficLights=[];
      for(var tli=0;tli<streetC.length;tli++)for(var tlj=0;tlj<streetC.length;tlj++){
        trafficLights.push({x:streetC[tli],z:streetC[tlj],offset:(tli*7+tlj*13)%30});
      }
      var LIGHT_CYCLE=30;
      function lightStateAt(lx,lz,nowS){
        for(var i=0;i<trafficLights.length;i++){
          var L=trafficLights[i];
          if(Math.abs(L.x-lx)<1&&Math.abs(L.z-lz)<1){
            var t=(nowS+L.offset)%LIGHT_CYCLE;
            if(t<12)return 'NS';
            if(t<15)return 'Y';
            if(t<27)return 'EW';
            return 'Y';
          }
        }
        return null;
      }
      /* Visual traffic lights: small pole + colored light at each intersection.
         Updates color based on light cycle. */
      var trafficLightMeshes=[];
      function buildTrafficLightVisuals(){
        for(var i=0;i<trafficLights.length;i++){
          var L=trafficLights[i];
          /* Only build for intersections near downtown (avoid 100+ poles) */
          if(Math.abs(L.x)>150||Math.abs(L.z)>150)continue;
          var grp=new THREE.Group();
          /* Pole */
          var pole=new THREE.Mesh(
            new THREE.CylinderGeometry(0.12,0.12,4.5,8),
            new THREE.MeshLambertMaterial({color:0x2b2f36})
          );
          pole.position.y=2.25;
          grp.add(pole);
          /* Light housing */
          var housing=new THREE.Mesh(
            new THREE.BoxGeometry(0.6,1.2,0.6),
            new THREE.MeshLambertMaterial({color:0x1a1d22})
          );
          housing.position.y=4.8;
          grp.add(housing);
          /* Light bulb (color changes) */
          var bulb=new THREE.Mesh(
            new THREE.SphereGeometry(0.22,12,12),
            new THREE.MeshBasicMaterial({color:0x00ff00})
          );
          bulb.position.set(0,4.8,0.32);
          grp.add(bulb);
          grp.position.set(L.x+3,0,L.z+3); /* offset to corner */
          mapScene.add(grp);
          trafficLightMeshes.push({grp:grp,bulb:bulb,light:L});
        }
      }
      function updateTrafficLightVisuals(){
        var nowS=Date.now()/1000;
        for(var i=0;i<trafficLightMeshes.length;i++){
          var tm=trafficLightMeshes[i];
          var st=lightStateAt(tm.light.x,tm.light.z,nowS);
          var col=0x00ff00; /* green */
          if(st==='Y')col=0xffaa00; /* yellow */
          else if(st==='NS'||st==='EW'){
            /* Show red if this direction is stopped.
               Simplified: alternate based on state */
            col=(st==='NS')?0x00ff00:0xff0000;
          }
          /* Actually: green for the active direction, red for the other.
             We show the NS light; EW would be opposite. */
          if(st==='EW')col=0xff0000;
          else if(st==='NS')col=0x00ff00;
          else col=0xffaa00;
          tm.bulb.material.color.setHex(col);
        }
      }
      buildTrafficLightVisuals();
      /* Grass + cobblestone ground tiles (Han 2026-10-05). */
      function groundTexture(file,rx,ry){
        var gt=new THREE.TextureLoader().load('assets/props/ground/'+file);
        gt.wrapS=gt.wrapT=THREE.RepeatWrapping;
        gt.repeat.set(rx,ry);
        return gt;
      }
      var grassMat=new THREE.MeshLambertMaterial({map:groundTexture('grass_dark.png',3,3)});      var cobbleMat=new THREE.MeshLambertMaterial({map:groundTexture('cobble.png',5,5)});      var bi,bj;
      /* Park blocks: (bi,bj) indices into blockC — grass instead of plain pad. */
      var parkBlocks={ '2,1':1, '1,3':1 };
      /* Han 2026-10-09: downtown pads removed — satellite shows the real ground.
      for(bi=0;bi<blockC.length;bi++)for(bj=0;bj<blockC.length;bj++){
        var pad=new THREE.Mesh(new THREE.PlaneGeometry(BLOCK,BLOCK,8,8),padMat);
        pad.rotation.x=-Math.PI/2;pad.position.set(blockC[bi],.04,blockC[bj]);pad.receiveShadow=true;mapScene.add(pad);
      }
      */
      /* Deterministic pseudo-random for a stable downtown. */
      var seed=1234567;
      function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
      var palette=[0x8fa3b8,0x9aa5a8,0xb0a897,0x7d8b99,0xa89a8c,0x6f7f8e,0x93a7bb,0x8794a0];
      var bldgMatCache={};
      function bldgMat(color){
        /* Han 2026-10-10: MeshBasicMaterial (unlit) — always visible, day or night */
        var key='b'+color, m=bldgMatCache[key];
        if(!m){
          m=new THREE.MeshBasicMaterial({color:color});
          espilOccludePatchMat(m); /* wall-occlusion cutout: buildings only (Han 2026-11-03) */
          bldgMatCache[key]=m;
        }
        return m;
      }
      function boxAt(w,h,d,x,y,z,color){
        var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bldgMat(color));
        m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;mapScene.add(m);return m;
      }
      /* Buildings: 2x2 lots per block, taller toward the center. */
      var buildingRects=[];
      for(bi=0;bi<blockC.length;bi++)for(bj=0;bj<blockC.length;bj++){
        if(parkBlocks[bi+','+bj])continue; /* park blocks stay green */
        var bx=blockC[bi],bz=blockC[bj];
        for(var li=0;li<2;li++)for(var lj=0;lj<2;lj++){
          var lx=bx+(li?6.5:-6.5),lz=bz+(lj?6.5:-6.5);
          if(rnd()>.7)continue; /* some lots stay empty */
          var w=7+rnd()*5,d=7+rnd()*5;
          var x=lx+(rnd()-.5)*3,z=lz+(rnd()-.5)*3;
          /* Canada Place waterfront plaza stays clear. */
          if(x+w/2>-26&&x-w/2<26&&z+d/2>-102&&z-d/2<-87)continue;
          var distC=Math.sqrt(bx*bx+bz*bz);
          var h=9+rnd()*13+(1-Math.min(1,distC/110))*16;
          var color=palette[Math.floor(rnd()*palette.length)];
          var _coreMesh=buildingAt(w,h,d,x,.04+h/2,z,color);
          if(rnd()>.6)boxAt(w*.38,1.3,d*.38,x,.04+h+.65,z,0x5d6a72); /* rooftop unit */
          addCollider(x-w/2,x+w/2,z-d/2,z+d/2,.04,.04+h);
          buildingRects.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});
          var coreRec={x:x,z:z,w:w,d:d,h:h,name:null,id:'core:'+(coreBldgSeq++)};
          mapBuildings.push(coreRec); buildingIdIndex[coreRec.id]=coreRec;
          EspilFader.registerMesh(coreRec,_coreMesh);
        }
      }
      /* Grass patches in empty spaces inside building blocks (Han 2026-10-05).
         Not under buildings (checked against buildingRects), not on alleys. */
      function rectOverlap(a,b){return a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0;}
      for(bi=0;bi<blockC.length;bi++)for(bj=0;bj<blockC.length;bj++){
        if(parkBlocks[bi+','+bj])continue;
        var gbx=blockC[bi],gbz=blockC[bj];
        var candidates=[[0,9],[0,-9],[9,0],[-9,0],[9,9],[9,-9],[-9,9],[-9,-9]];
        for(var ci=0;ci<candidates.length;ci++){
          if(rnd()>.6)continue;
          var cx=gbx+candidates[ci][0],cz=gbz+candidates[ci][1];
          var gr={x0:cx-2.2,x1:cx+2.2,z0:cz-2.2,z1:cz+2.2};
          var clear=true;
          for(var ri=0;ri<buildingRects.length;ri++){
            if(rectOverlap(gr,buildingRects[ri])){clear=false;break;}
          }
          if(!clear)continue;
          /* #8b: Satellite shows real ground — grass alley patches removed */
          /*
          var gm=new THREE.Mesh(new THREE.PlaneGeometry(4.4,4.4,2,2),grassMat);
          gm.rotation.x=-Math.PI/2;gm.position.set(cx,.045,cz);gm.receiveShadow=true;mapScene.add(gm);
          */
        }
      }
      /* Street trees on block corners — REMOVED (Han 2026-10-09 #4: satellite shows real vegetation).
      var treeVariants=[
        {f:'assets/props/trees/pine_1.png',a:96/127},
        {f:'assets/props/trees/pine_2.png',a:55/116},
        {f:'assets/props/trees/pine_3.png',a:55/116}
      ];
      for(bi=0;bi<blockC.length;bi++)for(bj=0;bj<blockC.length;bj++){
        if(rnd()>.5)continue;
        var tx=blockC[bi]+(rnd()>.5?11:-11),tz=blockC[bj]+(rnd()>.5?11:-11);
        var tv=treeVariants[Math.floor(rnd()*treeVariants.length)],th=3.0+rnd()*0.9;
        addProp('tree',tx,tz,th*tv.a,th,tv.f);
        addCollider(tx-.35,tx+.35,tz-.35,tz+.35,0,2.8);
      }
      */
      /* Grass tufts and trees along the streets (Han 2026-10-05). */
      var grassVariants=[
        {f:'assets/props/trees/grass.png',a:101/89},
        {f:'assets/props/trees/plant_leaf.png',a:100/77}
      ];
      for(si=0;si<streetC.length;si++){
        for(var gp=-90;gp<=90;gp+=15){
          /* #8b: Satellite shows real vegetation — grass/tree billboards removed */
          /*
          if(rnd()>.55)continue;
          var side=rnd()>.5?1:-1;
          var gx=streetC[si]+side*(7+rnd()*2), gz=gp+(rnd()-.5)*6;
          if(Math.abs(gx)>MAP_BOUND||Math.abs(gz)>MAP_BOUND)continue;
          var gv=grassVariants[Math.floor(rnd()*grassVariants.length)],gh=1.0+rnd()*.6;
          addProp('grass',gx,gz,gh*gv.a,gh,gv.f);
          if(rnd()>.75){
            var stx=streetC[si]-side*(8+rnd()*2), stz=gp+(rnd()-.5)*8;
            if(Math.abs(stx)>MAP_BOUND||Math.abs(stz)>MAP_BOUND)continue;
            var stv=treeVariants[Math.floor(rnd()*treeVariants.length)],sth=2.8+rnd()*.8;
            addProp('tree',stx,stz,sth*stv.a,sth,stv.f);
            addCollider(stx-.35,stx+.35,stz-.35,stz+.35,0,2.6);
          }
          */
        }
        for(var gp2=-90;gp2<=90;gp2+=15){
          if(rnd()>.55)continue;
          var side2=rnd()>.5?1:-1;
          var gz2=streetC[si]+side2*(7+rnd()*2), gx2=gp2+(rnd()-.5)*6;
          if(Math.abs(gx2)>MAP_BOUND||Math.abs(gz2)>MAP_BOUND)continue;          var gv2=grassVariants[Math.floor(rnd()*grassVariants.length)],gh2=1.0+rnd()*.6;
          addProp('grass',gx2,gz2,gh2*gv2.a,gh2,gv2.f);
        }
      }
      /* QA #16 (2026-10-06): sparse grass tufts ON the lawn strips (former minor streets).
         Lawns are at streetC except the 2 majors (si=3 H, si=2 V). Sparse, not dense. */
      for(si=0;si<streetC.length;si++){
        var isLawnH=(si!==3), isLawnV=(si!==2);
        for(var lg=-95;lg<=95;lg+=7){
          if(rnd()>.3)continue; /* sparse: 30% chance */
          var gvx=grassVariants[Math.floor(rnd()*grassVariants.length)],ghx=.8+rnd()*.5;
          if(isLawnH){
            var lgx=lg+(rnd()-.5)*5, lgz=streetC[si]+(rnd()-.5)*8;
            if(Math.abs(lgx)<=MAP_BOUND&&Math.abs(lgz)<=MAP_BOUND)
              addProp('grass',lgx,lgz,ghx*gvx.a,ghx,gvx.f);
          }
          if(isLawnV){
            var lgx2=streetC[si]+(rnd()-.5)*8, lgz2=lg+(rnd()-.5)*5;
            if(Math.abs(lgx2)<=MAP_BOUND&&Math.abs(lgz2)<=MAP_BOUND)
              addProp('grass',lgx2,lgz2,ghx*gvx.a,ghx,gvx.f);
          }
        }
      }
      /* Street lamps along the avenues (placeholder positions). */
      for(si=0;si<streetC.length;si++)for(var sj=0;sj<streetC.length;sj++){
        if((si+sj)%2)continue;
        var lx=streetC[si]+7,lz=streetC[sj]+7;
        if(Math.abs(lx)>MAP_BOUND||Math.abs(lz)>MAP_BOUND)continue;
        addProp('lamp',lx,lz,1.0,4.2);
      }
      /* Traffic lights at major intersections (placeholder positions). */
      for(si=0;si<streetC.length;si+=2)for(var sj2=0;sj2<streetC.length;sj2+=2){
        var gx=streetC[si]-7,gz=streetC[sj2]-7;
        addProp('signal',gx,gz,0.9,3.6);
        addCollider(gx-.25,gx+.25,gz-.25,gz+.25,0,3.2);
      }
      /* Low planters around the plaza — hop-on-able (double jump reaches ~3). */
      var planterMat=curvedMat(0x9aa08e);
      [[-14,-84],[14,-84],[-18,-90],[18,-90]].forEach(function(p){
        boxAt(2.2,1,2.2,p[0],.5,p[1],0x9aa08e);
        addCollider(p[0]-1.1,p[0]+1.1,p[1]-1.1,p[1]+1.1,0,1);
      });
      /* Waterfront: water, seawall, Canada Place sails plaza. */
      /* QA #17 (2026-10-06): water texture + swimming mode. */
      /* #8b: Satellite shows real water — textured water plane removed (swimming still via WATER_Z) */
      /* var waterTex=new THREE.TextureLoader().load('assets/props/ground/water.png');
      waterTex.wrapS=waterTex.wrapT=THREE.RepeatWrapping;
      waterTex.repeat.set(8,2);
      var waterMat=new THREE.MeshLambertMaterial({map:waterTex});
            var water=new THREE.Mesh(new THREE.PlaneGeometry(640,170,64,16),waterMat);
      water.rotation.x=-Math.PI/2;water.position.set(0,.03,-186);mapScene.add(water); */
      /* Swimming state — set in updateWalkMap when player enters water.
         (WATER_Z/WATER_Y now live at IIFE scope.) */
      boxAt(208,1.6,2.4,0,-.2,-100,0x8b938a);
      addCollider(-104,104,-102,-98.8,-1,1.2); /* seawall: solid, cannot be climbed */
      var plaza=new THREE.Mesh(new THREE.CylinderGeometry(10,10,.12,36),cobbleMat);
      plaza.position.set(0,.06,-95);plaza.receiveShadow=true;mapScene.add(plaza);
      addCollider(-10,10,-101,-85,0,.12);
      var sails=landmarkModel('sails');
      sails.scale.setScalar(11);
      sails.position.set(0,.12,-95);
      sails.traverse(function(o){if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      mapScene.add(sails);
      addCollider(-5,5,-99.5,-90.5,.12,3.6);
      /* Invisible walls at the map edge (the north side is guarded by the seawall). */
      /* QA #10 (2026-10-06): Genshin-style invisible walls — direct clamping instead of
         huge collider boxes (which caused far-side teleport when moving inward). */
      /* (Boundary walls removed; clamping applied in updateWalkMap after collision.) */
      } /* end if(!USE_OSM_REBUILD) — procedural grid skipped */
      /* The walker. Batch 6 Item D: guests build the guest avatar
         (KayKit GLB placeholder since Han order 5, 2026-11-10; the
         2D sprite builder before that); the in-tree GLB builder
         stays for signed-in sessions. */
      var av=buildPlayerAvatar(espilSavedGender());
      mapScene.add(av.group);mapScene.add(av.shadow);
      walkPlayer={av:av,pos:new THREE.Vector3(3,.05,31),velY:0,onGround:true,jumps:0,faceY:.5,bobT:0,moving:false,flying:false,vehicle:null};
      av.shadow.position.set(3,.03,31);
    }
    /* Fly/ride (B key). Lineage: Han 2026-10-10 #8 test vehicle, reworked
       to Han's 2026-11-03 Batch G spec: B toggles fly/ride; while active
       the movement is fully 3D - the arrow keys (and the touch stick)
       stay the basic camera-relative movement, SHIFT ascends and SPACE
       descends (their ground roles, jump/interact, are gated off while
       flying - see the in-map keydown handler). B again RELEASES: the
       ride vanishes and the character falls under gravity; fall damage
       accumulates with the fall and is charged on ground impact only,
       so summoning never damages and re-summoning mid-fall cancels the
       fall. Terrain collision applies while airborne (the ground axis
       sweep is reused, no noclip), and mid-air contact with another
       player drops BOTH flyers. Tunables: */
    var ESPIL_FLY_H_SPEED=12;    /* m/s - the ground run speed (moveSpeeds) */
    var ESPIL_FLY_V_SPEED=9;     /* m/s vertical */
    var ESPIL_FLY_MAX_ALT=300;   /* m (the 2026-10-10 vehicle's own cap) */
    var ESPIL_FLY_HOVER=1.2;     /* m - descended feet rest this far above the support (the ride's body hangs below the feet datum) */
    var ESPIL_FALL_SAFE_M=6;     /* m of fall that never damages */
    var ESPIL_FALL_DMG_PER_M=6;  /* HP per metre fallen beyond the safe height */
    var espilLastFallDamage=0;
    function summonVehicle(){
      if(!walkPlayer||!mapScene)return;
      if(window.__espilInside)return; /* no summoning indoors (Batch G) */
      if(walkPlayer.flying){
        /* Release */
        dismountVehicle();
        return;
      }
      /* Build simple airplane */
      var grp=new THREE.Group();
      var mat=new THREE.MeshLambertMaterial({color:0x4f7ed9});
      /* Fuselage */
      var fus=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,5),mat);
      grp.add(fus);
      /* Wings */
      var wing=new THREE.Mesh(new THREE.BoxGeometry(8,0.2,1.5),mat);
      wing.position.z=0.5;
      grp.add(wing);
      /* Tail */
      var tail=new THREE.Mesh(new THREE.BoxGeometry(0.2,1.5,1),mat);
      tail.position.set(0,0.8,-2.2);
      grp.add(tail);
      /* Cockpit */
      var cock=new THREE.Mesh(new THREE.SphereGeometry(0.6,12,12),
        new THREE.MeshLambertMaterial({color:0xbcd6f5}));
      cock.position.set(0,0.7,1);
      grp.add(cock);
      grp.position.copy(walkPlayer.pos);
      mapScene.add(grp);
      walkPlayer.flying=true;
      walkPlayer.vehicle=grp;
      /* Batch G: summoning is instant and never damages. It cancels any
         fall in progress (no damage is charged for a cancelled fall),
         and the character stays VISIBLE, riding the vehicle - the
         flight update syncs the avatar onto it every frame. A small
         takeoff lift keeps the ride's body clear of the ground. */
      walkPlayer._fall=null;
      walkPlayer.velY=0;
      walkPlayer.onGround=false;
      walkPlayer.pos.y+=1.5;
      if(walkPlayer.av&&walkPlayer.av.group)walkPlayer.av.group.visible=true;
      if(walkPlayer.av&&walkPlayer.av.playAnim)try{walkPlayer.av.playAnim('idle');}catch(e){}
      console.log('[Vehicle] Summoned airplane — arrows move, SHIFT up, SPACE down, B releases');
      var t=document.getElementById('toast');
      if(t){t.textContent='✈️ Fly/ride on (SHIFT up, SPACE down, B to release)';t.classList.add('show');
        clearTimeout(t._it);t._it=setTimeout(function(){t.classList.remove('show');},2500);}
    }
    /* Batch G: clear the fly state WITHOUT a fall - used when an
       interior entry takes the body over (the interior teleports the
       player itself, so no fall may be armed across it). */
    function espilFlyClear(){
      var p=walkPlayer; if(!p)return;
      if(p.vehicle){ if(mapScene)mapScene.remove(p.vehicle); p.vehicle=null; }
      p.flying=false; p._fall=null; p.velY=0;
      if(p.av&&p.av.group)p.av.group.visible=true;
    }
    function dismountVehicle(){
      if(!walkPlayer||!walkPlayer.flying)return;
      if(walkPlayer.vehicle){
        mapScene.remove(walkPlayer.vehicle);
        walkPlayer.vehicle=null;
      }
      walkPlayer.flying=false;
      /* Batch G release (replaces the 2026-10-10 ground teleport): the
         character stays at the release point and FALLS under the ground
         pipeline's gravity. The fall is armed here - its height is
         measured at landing in updateWalkMap and charged there, and
         only there, so a mid-fall re-summon cancels it clean. */
      walkPlayer.velY=0;
      walkPlayer.onGround=false;
      walkPlayer._fall={fromY:walkPlayer.pos.y};
      /* Batch G fix (rig diag2, 2026-11-03): a deliberate release wins
         over a scripted arrival. The ESPIL TILES arrival state can arm
         while the player is airborne and then stays frozen - it only
         advances in the ground tail - so at the first ground frame it
         would own the body and the fall would be cancelled instead of
         charged (observed: the first release of a fly-first session
         landed free from 25.9 m). The entry arrival is over by the
         time a player can release, so dropping the state here is safe. */
      if(walkPlayer._espilArrive)walkPlayer._espilArrive=null;
      if(walkPlayer.av&&walkPlayer.av.group){
        walkPlayer.av.group.visible=true;
        walkPlayer.av.group.position.copy(walkPlayer.pos);
      }
      if(walkPlayer.av&&walkPlayer.av.playJump)try{walkPlayer.av.playJump(false);}catch(e){}
      console.log('[Vehicle] Released — falling from '+walkPlayer.pos.y.toFixed(1)+' m');
    }
    /* Batch G support query: the same law updateWalkMap lands by -
       the highest collider top at (x, z) that a body at refY could
       step onto (top at most .55 above refY). Sources mirror the
       ground code exactly: store colliders + cars always, strips and
       polygon records by phase. Default .05 (open ground). Used to
       floor a fly descent so the ride settles onto roofs instead of
       sinking into them. */
    function espilSupportAt(x,z,refY){
      var p=walkPlayer; if(!p)return .05;
      var support=.05;
      function consider(c){
        var cz=z<c.z0?c.z0:(z>c.z1?c.z1:z);
        var cx=x<c.x0?c.x0:(x>c.x1?c.x1:x);
        if(Math.abs(z-cz)>PLAYER_R||Math.abs(x-cx)>PLAYER_R)return;
        if(c.top<=refY+.55&&c.top>support)support=c.top;
      }
      if(!ESPIL_P1)for(var i=0;i<walkColliders.length;i++)consider(walkColliders[i]);
      for(var ci=0;ci<carColliders.length;ci++)consider(carColliders[ci]);
      if(!ESPIL_P1){ var ssb=espilStripBucketAt(x,z);
        if(ssb)for(var si=0;si<ssb.length;si++)consider(ssb[si]); }
      if(ESPIL_P1){
        var spb=espilPolyBucketAt(x,z);
        if(spb)for(var spi=0;spi<spb.length;spi++){
          var srec=spb[spi];
          if(srec.h<=refY+.55&&srec.h>support){
            if(x>=srec.x0-PLAYER_R&&x<=srec.x1+PLAYER_R&&z>=srec.z0-PLAYER_R&&z<=srec.z1+PLAYER_R&&espilPolyProbe(srec,x,z).d<=PLAYER_R)support=srec.h;
          }
        }
      }
      return support;
    }
    /* Batch G ceiling query (best effort, box colliders only): the
       lowest collider bottom above the body's head at (x, z), as the
       max feet height under it - or null when nothing is overhead. */
    function espilCeilingAt(x,z,refY){
      var ceil=null;
      function considerC(c){
        if(x<c.x0-PLAYER_R||x>c.x1+PLAYER_R||z<c.z0-PLAYER_R||z>c.z1+PLAYER_R)return;
        if(c.bottom>=refY+PLAYER_H){ var f=c.bottom-PLAYER_H; if(ceil===null||f<ceil)ceil=f; }
      }
      if(!ESPIL_P1)for(var i=0;i<walkColliders.length;i++)considerC(walkColliders[i]);
      for(var ci=0;ci<carColliders.length;ci++)considerC(carColliders[ci]);
      if(!ESPIL_P1){ var ssb=espilStripBucketAt(x,z);
        if(ssb)for(var si=0;si<ssb.length;si++)considerC(ssb[si]); }
      return ceil;
    }
    /* Batch G fall damage: charged ONLY at ground impact (called from
       updateWalkMap's landing branch with the measured fall). The
       build has no death handling anywhere, so HP clamps at 1. */
    function espilChargeFallDamage(dist){
      var over=dist-ESPIL_FALL_SAFE_M;
      var dmg=over>0?Math.round(over*ESPIL_FALL_DMG_PER_M):0;
      espilLastFallDamage=dmg;
      if(dmg<=0)return;
      skillState.hp=Math.max(1,skillState.hp-dmg);
      saveSkills(); paintStatus();
      if(window.__espilToast)window.__espilToast('💥 Fall damage -'+dmg+' HP');
      console.log('[Fly] Fall damage '+dmg+' HP (fell '+dist.toFixed(1)+' m, safe '+ESPIL_FALL_SAFE_M+' m)');
    }
    /* Batch G mid-air contact: flying into another player drops BOTH
       flyers. Detection is local, against the presence system's
       interpolated remote list - both clients run it over the same
       position stream, so both drop; a fly_bump frame is also sent to
       the other client as the fast path (see the receiver below). */
    function espilFlyBumpCheck(){
      var p=walkPlayer; if(!p||!p.flying)return;
      if(!window.__espilRemoteList)return;
      var list; try{ list=window.__espilRemoteList(); }catch(_){ return; }
      for(var i=0;i<list.length;i++){
        var q=list[i];
        var dy=p.pos.y-(q.y||0.05); if(dy>2.2||dy<-2.2)continue;
        var dx=p.pos.x-q.x, dz=p.pos.z-q.z;
        if(dx*dx+dz*dz>1.7*1.7)continue;
        try{ if(window.__espilSocialSend)window.__espilSocialSend({t:'fly_bump',to:q.id}); }catch(_){}
        if(window.__espilToast)window.__espilToast('💥 Mid-air collision — both falling!');
        console.log('[Fly] Mid-air contact with '+(q.id||'remote')+' — both drop');
        dismountVehicle();
        return;
      }
    }
    /* The bump's receiving half: a fly_bump frame addressed to this
       client drops its flyer too (same fall, own damage on landing).
       presence.js forwards fly_* frames to espil-party-frame. */
    window.addEventListener('espil-party-frame',function(e){
      var m=e&&e.detail; if(!m||m.t!=='fly_bump')return;
      if(walkPlayer&&walkPlayer.flying){
        if(window.__espilToast)window.__espilToast('💥 Mid-air collision — both falling!');
        dismountVehicle();
      }
    });
    window.__espilFlyState=function(){
      var p=walkPlayer;
      return { flying:!!(p&&p.flying), falling:!!(p&&p._fall),
               fallFrom:(p&&p._fall)?p._fall.fromY:null,
               x:p?p.pos.x:null, y:p?p.pos.y:null, z:p?p.pos.z:null,
               hp:skillState.hp, lastFallDamage:espilLastFallDamage,
               safeM:ESPIL_FALL_SAFE_M, dmgPerM:ESPIL_FALL_DMG_PER_M,
               hSpeed:ESPIL_FLY_H_SPEED, vSpeed:ESPIL_FLY_V_SPEED };
    };
    function updateVehicle(dt){
      var p=walkPlayer;
      if(!p||!p.flying||!p.vehicle)return;
      /* An interior entry takes the body over - never fly inside. */
      if(window.__espilInside){ espilFlyClear(); return; }
      /* --- horizontal: the ground input law (arrows + touch stick),
         camera-relative, at the ground run speed --- */
      var ix=0,iz=0;
      if(walkKeys['arrowup'])iz-=1;
      if(walkKeys['arrowdown'])iz+=1;
      if(walkKeys['arrowleft'])ix-=1;
      if(walkKeys['arrowright'])ix+=1;
      if(window.__joyVec){ix+=window.__joyVec.x;iz+=window.__joyVec.y;}
      var il=Math.sqrt(ix*ix+iz*iz);
      if(il>1){ix/=il;iz/=il;}
      var fx=-Math.sin(walkCamYaw),fz=-Math.cos(walkCamYaw);
      var rx=-fz,rz=fx;
      var mx=fx*(-iz)+rx*ix,mz=fz*(-iz)+rz*ix;
      p.moving=il>.12;
      p._dx=mx*ESPIL_FLY_H_SPEED*dt; p._dz=mz*ESPIL_FLY_H_SPEED*dt;
      /* Terrain applies airborne: the ground axis sweep, unchanged -
         walls block at altitude bands below their tops, roofs and
         open sky do not. */
      p.pos.x+=p._dx; collideCircleAxis(p,'x');
      p.pos.z+=p._dz; collideCircleAxis(p,'z');
      var distC=Math.sqrt(p.pos.x*p.pos.x+p.pos.z*p.pos.z);
      if(distC>MAP_BOUND){ var s=MAP_BOUND/distC; p.pos.x*=s; p.pos.z*=s; }
      /* --- vertical: SHIFT up, SPACE down (Han Batch G). Descending
         settles at the support + hover offset; ascending is capped
         by any overhead collider and by the altitude ceiling. --- */
      var vy=0;
      if(walkKeys['shift'])vy+=ESPIL_FLY_V_SPEED;
      if(walkKeys[' '])vy-=ESPIL_FLY_V_SPEED;
      if(vy!==0){
        var ny=p.pos.y+vy*dt;
        if(vy<0){ var sup=espilSupportAt(p.pos.x,p.pos.z,p.pos.y)+ESPIL_FLY_HOVER; if(ny<sup)ny=sup; }
        if(vy>0){ var ce=espilCeilingAt(p.pos.x,p.pos.z,p.pos.y); if(ce!==null&&ny>ce)ny=ce; }
        p.pos.y=Math.max(.05,Math.min(ESPIL_FLY_MAX_ALT,ny));
      }
      /* --- facing (the ground law) --- */
      if(p.moving){
        var targetFace=Math.atan2(-mx,-mz);
        var d=targetFace-p.faceY;
        while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
        p.faceY+=d*Math.min(1,dt*12);
      }
      /* --- visuals: p.pos stays the feet datum (the whole ground
         pipeline's convention); the ride hangs below the feet, the
         rider stands on it. A gentle bob is visual only. --- */
      var v=p.vehicle;
      var bob=Math.sin(performance.now()/450)*0.12;
      v.position.set(p.pos.x,p.pos.y-0.6+bob,p.pos.z);
      v.rotation.y=p.faceY;
      var g=p.av.group;
      g.visible=true;
      g.position.copy(p.pos);
      g.rotation.y=p.faceY;
      if(p.av.mixer)p.av.mixer.update(dt);
      /* CHAR SHADOW (2026-11-20): same support law as the ground
         write - the disc sits on the support below the ride and
         fades with height above it, instead of staying pinned to
         the baked datum .03 while the ride follows the terrain. */
      var shSup=espilSupportAt(p.pos.x,p.pos.z,p.pos.y);
      p.av.shadow.position.set(p.pos.x,shSup+.03,p.pos.z);
      p.av.shadow.material.opacity=Math.max(.08,.26-Math.max(0,p.pos.y-shSup)*.05);
      /* --- mid-air player contact drops both flyers --- */
      espilFlyBumpCheck();
    }
    /* QA #6 (2026-10-06): remember last location in localStorage (server sync later). */
    var LAST_POS_KEY='espil_last_pos';
    function saveLastPos(){
      if(!walkPlayer)return;
      /* PLACE SPACE (Han 2026-11-16, design 9-1): a place-space
         child window never writes the position save - the parent
         window owns the street position, and a save from inside
         the instance band (z >= 12000) would poison the street
         resume. The mark is this window's sessionStorage, written
         by the address boot shell. */
      try{ if(sessionStorage.getItem('espil_store_space_v1'))return; }catch(e){}
      /* HOME SPACE (Han 2026-11-16, design 7.2): a home stay never
         writes the position save either - the home sits in the
         instance band (z >= 24000), and a save from inside it
         would overwrite the street resume point the player
         returns to. The home is in-page, so there is no
         sessionStorage mark; the inside record is the test. */
      if(window.__espilInside&&window.__espilInside.home)return;
      try{
        localStorage.setItem(LAST_POS_KEY,JSON.stringify({
          x:walkPlayer.pos.x,y:walkPlayer.pos.y,z:walkPlayer.pos.z,
          yaw:walkCamYaw,ts:Date.now(),city:window.__espilCityKey||null
          /* Han PC verdict 2026-10-19 #9: the save names its city - the
             old save carried none, so only a coordinate-range accident
             kept one city's save from being read as another's. */
        }));
      }catch(e){}
    }
    function loadLastPos(){
      try{
        var s=localStorage.getItem(LAST_POS_KEY);
        if(!s)return null;
        var d=JSON.parse(s);
        /* City identity (Han PC verdict 2026-10-19 #9): a save belongs
           to the city it names; another city's save is not a resume
           candidate here (older saves without the field fall through
           to the bounds sanity below). */
        if(d.city&&window.__espilCityKey&&d.city!==window.__espilCityKey)return null;
        /* Sanity: must be within the ACTIVE city's playable bounds. The
           old origin-centred 5 km box predates offset cities - Auckland
           saves live near x=10000, so every one was discarded here and a
           returning Auckland player could never resume (found in the
           Auckland phase-1 verification, 2026-10-16). Offset cities use
           their cfg bounds (with a small margin); the origin rule below
           is unchanged for Vancouver. */
        var cfg=null; try{ cfg=espilCityCfg(); }catch(e){}
        if(cfg&&cfg.bounds){
          var b=cfg.bounds;
          if(d.x<b.x0-50||d.x>b.x1+50||d.z<b.z0-50||d.z>b.z1+50)return null;
          return d;
        }
        if(Math.abs(d.x)>5100||Math.abs(d.z)>5100)return null;
        return d;
      }catch(e){return null;}
    }
    /* ================= 5km CHUNKED CITY (Han 2026-10-07) =================
       The hand-built downtown core (|x|,|z| < 130) stays exactly as-is.
       Beyond that, deterministic procedural chunks fill to 5km radius.
       Chunk = 250m. Each chunk has a seed from its coords — same chunk
       always generates identically. 5x5 chunks load around the player. */
    function chunkSeed(cx,cz){
      var h=(cx*73856093)^(cz*19349663);
      h=Math.imul(h^(h>>>13),1274126177);
      return (h^(h>>>16))>>>0;
    }
    /* #8 (Han 2nd QA): OSM real building data. Loaded async; chunks use it when
       available, falling back to procedural. */
    var osmChunks=null,osmLoading=false;
    function loadOsmChunks(){
      if(osmChunks||osmLoading)return;
      osmLoading=true;
      fetch('assets/osm/vancouver_chunks.json')
        .then(function(r){return r.json();})
        .then(function(j){
          osmChunks=j.chunks||{};
          console.log('[OSM] Loaded '+Object.keys(osmChunks).length+' chunks, '+
            (j.meta?j.meta.building_count:0)+' buildings');
          /* Regenerate visible procedural chunks with real data */
          if(typeof refreshOsmChunks==='function')refreshOsmChunks();
        })
        .catch(function(e){console.warn('[OSM] Failed to load:',e);});
    }
    function refreshOsmChunks(){
      /* Unload and regenerate chunks that now have OSM data */
      if(!osmChunks)return;
      var toRefresh=[];
      for(var key in chunkMap){
        if(osmChunks[key]&&!chunkMap[key].isOsm)toRefresh.push(key);
      }
      toRefresh.forEach(function(key){
        var parts=key.split(',');
        var cx=parseInt(parts[0],10),cz=parseInt(parts[1],10);
        unloadChunk(cx,cz);
        generateChunk(cx,cz);
      });
      if(toRefresh.length>0)console.log('[OSM] Refreshed '+toRefresh.length+' chunks with real data');
    }
    /* Han 2026-10-10 rebuild: Build entire OSM city at once (no procedural grid).
       Real buildings, real positions, real heights. 2km radius for 3D. */
    var osmCityBuilt=false;
    function buildOsmCity(){
      if(osmCityBuilt)return;
      osmCityBuilt=true;
      if(!osmChunks){
        console.warn('[OSM City] No chunk data, retrying in 1s');
        setTimeout(buildOsmCity,1000);
        return;
      }
      console.log('[OSM City] Building from real OSM data…');
      /* Cauldron style (Han 2026-10-10): warm sandy buildings */
      var palette=[0xd9b678,0xd4b183,0xcf9f6b,0xdbbd8a,0xd6a86f];
      var items=[]; /* {x,z,w,d,h,color} */
      var RADIUS=2000; /* 2km radius for 3D buildings */

      for(var key in osmChunks){
        var c=osmChunks[key];
        if(!c.b)continue;
        for(var i=0;i<c.b.length;i++){
          var b=c.b[i];
          var bx=b[0],bz=b[1],bw=b[2],bd=b[3],bh=b[4];
          var dist=Math.sqrt(bx*bx+bz*bz);
          if(dist>RADIUS)continue;
          if(isWaterAt(bx,bz))continue;
          /* Skip tiny sheds */
          if(bw<3||bd<3)continue;
          var col=palette[(i*7)%palette.length];
          /* ESPIL DISTRICT BUILD (self-city port, 2026-10-16): ring buildings are drawn by the polygon builder and collide via the stored collision strips - no AABB instance or AABB collider for them (building-ID registration below still runs). */
          var espilRingB=Math.hypot(bx-19,bz+57)<=2000; /* (PC feedback #12): the core notch is gone - district-covered buildings never take an AABB collider, so no invisible boxes downtown */
          if(!espilRingB){
            items.push({x:bx,z:bz,w:bw,d:bd,h:bh,color:col});
            /* Collider */
            walkColliders.push({x0:bx-bw/2,x1:bx+bw/2,z0:bz-bd/2,z1:bz+bd/2,bottom:0,top:bh});
          }
          /* Proximity */
          if(typeof mapBuildings!=='undefined'){
            var obRec={x:bx,z:bz,w:bw,d:bd,h:bh,name:null,osm:true,id:'osm:'+key+':'+i};
            mapBuildings.push(obRec); buildingIdIndex[obRec.id]=obRec;
          }
        }
      }

      console.log('[OSM City] '+items.length+' buildings within 2km');

      /* Facade pass RETIRED (Han's decision via Architecture verdict,
         2026-10-15): this pass built one InstancedMesh per building
         archetype, but production's CURVE_CHUNK never applies
         instanceMatrix, so every instance rendered collapsed at the
         mesh origin - the layer was five 1 m cubes at the anchor, and
         reviving it would also contradict the Google-tiles-only
         building-visuals ruling and double-render ~70k buildings over
         the chunk pass. Mesh creation therefore stops here. The data
         work above stays: items, colliders and the mapBuildings /
         buildingIdIndex registration (the store flow and nameplates
         read them) are interaction data, not visuals. The visible city
         is the chunk pass plus the downtown core. */

      /* Build traffic on OSM roads */
      buildOsmTraffic();
      /* Han 2026-10-10: Street trees for urban feel (billboard sprites) */
      buildOsmTrees();
    }
    function buildOsmTrees(){
      if(!osmChunks||typeof addProp!=='function')return;
      var RADIUS=1200; /* trees within 1.2km */
      var count=0;
      var maxTrees=800; /* cap for performance */
      for(var key in osmChunks){
        if(count>=maxTrees)break;
        var c=osmChunks[key];
        if(!c.r)continue;
        for(var i=0;i<c.r.length;i+=3){ /* every 3rd segment */
          if(count>=maxTrees)break;
          var r=c.r[i];
          var x1=r[0],z1=r[1],x2=r[2],z2=r[3];
          var mx=(x1+x2)/2,mz=(z1+z2)/2;
          if(Math.sqrt(mx*mx+mz*mz)>RADIUS)continue;
          if(isWaterAt(mx,mz))continue;
          var len=Math.hypot(x2-x1,z2-z1);
          if(len<20)continue;
          /* Place tree offset from road center (sidewalk) */
          var dx=(x2-x1)/len,dz=(z2-z1)/len;
          var px=-dz,pz=dx; /* perpendicular */
          var side=(i%2===0)?1:-1;
          var tx=mx+px*6*side,tz=mz+pz*6*side;
          /* Don't place in buildings (simple check via colliders) */
          var inBldg=false;
          /* Skip detailed check for placeholder — roads are clear */
          var th=4+Math.random()*3; /* 4-7m tall */
          addProp('tree',tx,tz,th*0.67,th,null);
          count++;
        }
      }
      console.log('[OSM Trees] '+count+' street trees');
    }
    function buildOsmTraffic(){
      /* Clear existing procedural segments */
      trafficSegs.length=0;
      if(!osmChunks)return;
      var RADIUS=1500; /* traffic within 1.5km */
      var count=0;
      for(var key in osmChunks){
        var c=osmChunks[key];
        if(!c.r)continue;
        for(var i=0;i<c.r.length;i++){
          var r=c.r[i];
          var x1=r[0],z1=r[1],x2=r[2],z2=r[3];
          var mx=(x1+x2)/2,mz=(z1+z2)/2;
          if(Math.sqrt(mx*mx+mz*mz)>RADIUS)continue;
          if(isWaterAt(mx,mz))continue;
          var len=Math.hypot(x2-x1,z2-z1);
          if(len<10||len>500)continue; /* skip tiny/fake segments */
          trafficSegs.push({
            x1:x1,z1:z1,x2:x2,z2:z2,
            flow:.45+Math.random()*.55,
            mesh:null,nb:[]
          });
          count++;
        }
      }
      console.log('[OSM Traffic] '+count+' segments from real roads');
      /* Build neighbor links (for flow propagation) */
      for(var a=0;a<trafficSegs.length;a++)for(var b=a+1;b<trafficSegs.length;b++){
        var A=trafficSegs[a],B=trafficSegs[b];
        var touch=(Math.abs(A.x2-B.x1)<2&&Math.abs(A.z2-B.z1)<2)||
                   (Math.abs(A.x1-B.x2)<2&&Math.abs(A.z1-B.z2)<2)||
                   (Math.abs(A.x2-B.x2)<2&&Math.abs(A.z2-B.z2)<2)||
                   (Math.abs(A.x1-B.x1)<2&&Math.abs(A.z1-B.z1)<2);
        if(touch){A.nb.push(b);B.nb.push(a);}
      }
    }
    function chunkRNG(seed){
      var s=seed>>>0;
      return function(){
        s=(Math.imul(s,1664525)+1013904223)>>>0;
        return s/4294967296;
      };
    }
    function cityZone(dist){
      if(dist<600)return 0; /* downtown ring: towers 25-70m */
      if(dist<2000)return 1; /* urban: mid-rise 12-30m */
      return 2; /* suburban: houses 6-12m, more green */
    }
    var chunkPalette=[0x8fa3b8,0x9aa5a8,0xb0a897,0x7d8b99,0xa89a8c,0x6f7f8e,0x93a7bb,0x8794a0];
    function generateChunk(cx,cz){
      var key=cx+','+cz;
      if(chunkMap[key])return chunkMap[key];
      /* Auckland phase 1 (2026-10-16): while an offset city is the
         active city, the procedural chunk city never generates - the
         corridor is district-built only, no Vancouver-style random
         blocks may appear inside it. Found during the PC-feedback
         #16 gate work: the offset (10000, 0) sits INSIDE the 15 km
         generation radius, so without this guard the chunk pass
         would have grown a fake procedural city over the corridor. */
      try{ if(!espilCityCfg().core)return null; }catch(e){}
      var x0=cx*CHUNK_SIZE,z0=cz*CHUNK_SIZE;
      /* Skip outside city radius */
      var ccx=x0+CHUNK_SIZE/2,ccz=z0+CHUNK_SIZE/2;
      if(Math.sqrt(ccx*ccx+ccz*ccz)>CITY_RADIUS+CHUNK_SIZE*0.7)return null;
      /* Skip downtown core (hand-built, don't overwrite) */
      if(x0<135&&x0+CHUNK_SIZE>-135&&z0<135&&z0+CHUNK_SIZE>-135)return null;
      var group=new THREE.Group();
      var colliders=[];
      var buildings=[];
      var seed=chunkSeed(cx,cz);
      var rnd=chunkRNG(seed);
      var zone=cityZone(Math.sqrt(ccx*ccx+ccz*ccz));
      /* --- Ground: one plane per chunk. Water chunks get water, else land. --- */
      var allWater=isWaterAt(x0,z0)&&isWaterAt(x0+CHUNK_SIZE,z0)&&
                   isWaterAt(x0,z0+CHUNK_SIZE)&&isWaterAt(x0+CHUNK_SIZE,z0+CHUNK_SIZE);
      var wmesh=espilBuildChunkWater(x0,z0);
      if(wmesh)group.add(wmesh);
      if(!allWater){
        /* #8b: Satellite is the ground now — chunk ground planes removed.
           (Water chunks still get water plane below.) */
        /*
        var ggeo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,4,4);
        var gcol=zone===2?0x6a9a5a:(zone===1?0x8a8a7a:0x7a7a72);
        var gmat=new THREE.MeshLambertMaterial({color:gcol});
                var gmesh=new THREE.Mesh(ggeo,gmat);
        gmesh.rotation.x=-Math.PI/2;
        gmesh.position.set(x0+CHUNK_SIZE/2,.03,z0+CHUNK_SIZE/2);
        gmesh.receiveShadow=true;
        group.add(gmesh);
        */
        /* --- Buildings: OSM real data if available, else procedural. --- */
        var osmData=osmChunks&&osmChunks[key];
        var items=[]; /* {x,z,w,d,h,color} */
        var isOsmChunk=false;
        if(osmData&&osmData.b&&osmData.b.length>0){
          /* Real OSM buildings */
          for(var oi=0;oi<osmData.b.length;oi++){
            var ob=osmData.b[oi];
            var ox=ob[0],oz=ob[1],ow=ob[2],od=ob[3],oh=ob[4];
            if(isWaterAt(ox,oz))continue;
            var ocol=chunkPalette[(oi*7)%chunkPalette.length];
            items.push({x:ox,z:oz,w:ow,d:od,h:oh,color:ocol});
            colliders.push({x0:ox-ow/2,x1:ox+ow/2,z0:oz-od/2,z1:oz+od/2,bottom:0,top:oh});
            buildings.push({x:ox,z:oz,w:ow,d:od,h:oh,id:'osm:'+key+':'+oi});
          }
          isOsmChunk=true;
        }else{
          /* Procedural fallback */
          var blockSize=zone===0?38:(zone===1?60:100);
          for(var bx=x0+8;bx<x0+CHUNK_SIZE-8;bx+=blockSize){
            for(var bz=z0+8;bz<z0+CHUNK_SIZE-8;bz+=blockSize){
              var bcx=bx+blockSize/2,bcz=bz+blockSize/2;
              if(isWaterAt(bcx,bcz))continue;
              if(Math.sqrt(bcx*bcx+bcz*bcz)>CITY_RADIUS)continue;
              var lots=zone===2?1:4;
              for(var li=0;li<lots;li++){
                if(rnd()>.72)continue;
                var lx=bcx,bz2=bcz;
                if(lots>1){
                  lx=bcx+((li%2)?blockSize*0.22:-blockSize*0.22);
                  bz2=bcz+((li<2)?blockSize*0.22:-blockSize*0.22);
                }
                lx+=(rnd()-.5)*blockSize*.12;
                bz2+=(rnd()-.5)*blockSize*.12;
                var w,d,h;
                if(zone===0){w=10+rnd()*14;d=10+rnd()*14;h=25+rnd()*45;}
                else if(zone===1){w=8+rnd()*10;d=8+rnd()*10;h=12+rnd()*18;}
                else{w=7+rnd()*5;d=6+rnd()*5;h=6+rnd()*6;}
                var col=chunkPalette[Math.floor(rnd()*chunkPalette.length)];
                items.push({x:lx,z:bz2,w:w,d:d,h:h,color:col});
                colliders.push({x0:lx-w/2,x1:lx+w/2,z0:bz2-d/2,z1:bz2+d/2,bottom:0,top:h});
                buildings.push({x:lx,z:bz2,w:w,d:d,h:h});
              }
            }
          }
        }
        if(items.length>0){
          var bgeo=new THREE.BoxGeometry(1,1,1);
          bgeo.translate(0,.5,0); /* pivot at base */
          /* Han 2026-10-10: MeshBasicMaterial (unlit) — always visible.
             Han 2026-10-16: the facade sprite map is REMOVED - chunk
             buildings render as flat palette tints (instance colors),
             no texture on any building path.
             Han 2026-10-16 (PC feedback #13): the curvature patch now
             applies too - CURVE_CHUNK is instance-aware, so the chunk
             city curves with the ground instead of floating over the
             dropped horizon. */
          var bmat=new THREE.MeshBasicMaterial({color:0xffffff});
                    espilOccludePatchMat(bmat); /* wall-occlusion cutout: buildings only (Han 2026-11-03) */
                    EspilFader.patchInstanced(bmat);
          var inst=new THREE.InstancedMesh(bgeo,bmat,items.length);
          EspilFader.attachInstanced(inst);
          var m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sv=new THREE.Vector3(),pv=new THREE.Vector3();
          var cc=new THREE.Color();
          for(var ii=0;ii<items.length;ii++){
            var it=items[ii];
            pv.set(it.x,0,it.z);sv.set(it.w,it.h,it.d);q.identity();
            m4.compose(pv,q,sv);
            inst.setMatrixAt(ii,m4);
            inst.setColorAt(ii,cc.setHex(it.color));
          }
          inst.instanceMatrix.needsUpdate=true;
          if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
          inst.castShadow=true;inst.receiveShadow=true;
          group.add(inst);
        }
      }
      mapScene.add(group);
      var chunk={group:group,colliders:colliders,buildings:buildings,cx:cx,cz:cz,isOsm:isOsmChunk};
      chunkMap[key]=chunk;
      chunkColliders[key]=colliders;
      /* Register buildings for the proximity pill (mapBuildings). */
      for(var bi2=0;bi2<buildings.length;bi2++){
        var b2=buildings[bi2];
        var mbRec={x:b2.x,z:b2.z,w:b2.w,d:b2.d,h:b2.h,name:null,chunk:true};
        if(typeof inst!=='undefined'&&inst)EspilFader.registerInst(mbRec,inst,bi2);
        if(b2.id){mbRec.id=b2.id; buildingIdIndex[b2.id]=mbRec;}
        mapBuildings.push(mbRec);
      }
      return chunk;
    }
    function unloadChunk(cx,cz){
      var key=cx+','+cz;
      var chunk=chunkMap[key];
      if(!chunk)return;
      mapScene.remove(chunk.group);
      chunk.group.traverse(function(o){
        if(o.isMesh){
          if(o.geometry)o.geometry.dispose();
          /* Don't dispose shared materials */
        }
      });
      /* Remove only this chunk's buildings from mapBuildings (by reference). */
      var bset={};
      for(var i=0;i<chunk.buildings.length;i++){
        var b=chunk.buildings[i];
        bset[b.x+','+b.z]=1;
      }
      mapBuildings=mapBuildings.filter(function(mb){
        return !(mb.chunk&&bset[mb.x+','+mb.z]);
      });
      /* Drop this chunk's IDs from the building index too. */
      for(var i3=0;i3<chunk.buildings.length;i3++){
        var bid=chunk.buildings[i3].id;
        if(bid)delete buildingIdIndex[bid];
      }
      delete chunkMap[key];
      delete chunkColliders[key];
    }
    function updateChunks(px,pz){
      var pcx=Math.floor(px/CHUNK_SIZE),pcz=Math.floor(pz/CHUNK_SIZE);
      var R=2; /* 5x5 chunks = 1.25km view */
      var needed={};
      for(var dx=-R;dx<=R;dx++)for(var dz=-R;dz<=R;dz++){
        var cx=pcx+dx,cz=pcz+dz;
        var key=cx+','+cz;
        needed[key]=1;
        if(!chunkMap[key])generateChunk(cx,cz);
      }
      for(var k in chunkMap){
        if(!needed[k]){
          var parts=k.split(',');
          unloadChunk(parseInt(parts[0],10),parseInt(parts[1],10));
        }
      }
    }
    /* ================= END 5km CHUNKED CITY ================= */
    function resetWalkPlayer(){
      if(!walkPlayer)return;
      /* QA #6: restore last position if available, else default spawn.
         ENTRY FLOW V2 (Han 2026-11-24, entry-v2/DESIGN.md 6.3): on a
         gated entry the saved position is not read at all - an
         account carries the gate's explicit centre pick and a guest
         is summoned by espilEntryStart's landmark branch, and both
         override this reset position in espilEntryStart, which runs
         immediately after. The read survives only for the no-pick
         fallback (the gate module absent). */
      var last=null;
      try{ if(!window.__espilSpawnPick&&!espilGuestNow()) last=loadLastPos(); }catch(e){}
      if(last){
        walkPlayer.pos.set(last.x,last.y,last.z);
        if(typeof last.yaw==='number')walkCamYaw=last.yaw;
      }else{
        walkPlayer.pos.set(3,.05,31);
      }
      walkPlayer.velY=0;walkPlayer.onGround=true;
      walkPlayer.jumps=0;walkPlayer.faceY=.5;walkPlayer.bobT=0;
      walkCamPitch=.84;walkCamDist=5.5; /* Cauldron 48°; distance = the 2026-11-23 tuning default (5.5 m; 7.0 m before, 6.2 m before that) */
      walkPlayer.av.group.position.copy(walkPlayer.pos);
      walkPlayer.av.group.rotation.y=.5;
      /* Snap the follow camera behind the player on entry. */
      var cp0=Math.cos(walkCamPitch),sp0=Math.sin(walkCamPitch);
      mapCamera.position.set(
        walkPlayer.pos.x+Math.sin(walkCamYaw)*cp0*walkCamDist,
        walkPlayer.pos.y+sp0*walkCamDist+1.2,
        walkPlayer.pos.z+Math.cos(walkCamYaw)*cp0*walkCamDist);
      mapCamera.lookAt(walkPlayer.pos.x,walkPlayer.pos.y+1.7,walkPlayer.pos.z);
      /* ZOOM-FPV (Han 2026-11-17): entry folds the zoom-FPV state
         flat with the camera reset - a dive always starts from the
         third-person default framing, exactly as zoom itself
         resets to 5.5 here; nothing about the state is persisted. */
      if(typeof espilZoomFpv!=='undefined'&&espilZoomFpv)espilZoomFpvFold();
    }
    function enterWalkMap(){
      if(cityPhaseActive)return;
      gateActive=false;
      buildWalkMapOnce();
      resetWalkPlayer();
      /* 5km city: load initial chunks around spawn. */
      if(walkPlayer)updateChunks(walkPlayer.pos.x,walkPlayer.pos.z);
      cityPhaseActive=true;
      espilEntryStart(); /* ESPIL TILES BRIDGE (self-city port, 2026-10-16): entries arrive by sky descent; since Han 2026-10-21 ALL entries dive, in-bounds resumes included */
      targetDistance=1.34; /* continue the entry dive (2026-10-06 QA #3) */
      /* Han 2026-10-14: city name shows ONCE, big and front-center, on entry.
         PLACE SPACE (2026-11-16): not in a place-space child window -
         the visit is to one building, not a city arrival. */
      var ci=document.getElementById('city-intro'),cin=document.getElementById('city-intro-name');
      var placeArrival=false;
      try{ placeArrival=!!sessionStorage.getItem('espil_store_space_v1'); }catch(e){}
      if(ci&&cin&&!placeArrival){
        cin.textContent=selected?selected.userData.name:'Vancouver';
        ci.classList.remove('show');void ci.offsetWidth;ci.classList.add('show');
        setTimeout(function(){ci.classList.remove('show');},2700);
      }
      citySky.visible=false;
      cityPhaseName.textContent=selected?selected.userData.name:espilCityDisplayName();
      var hint=document.getElementById('map-hint');
      var coarse=window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
      if(hint)hint.textContent=coarse?
        'Left stick walks (full tilt = run) \u00B7 drag to look around \u00B7 JUMP to hop (twice = double jump)':
        'Arrow keys walk \u00B7 SHIFT jump (twice = double jump) \u00B7 SPACE interact \u00B7 Q punch \u00B7 W kick \u00B7 E quote tool \u00B7 R defense \u00B7 K skills \u00B7 drag to look \u00B7 ESC to leave';
      cityPhasePanel.setAttribute('aria-hidden','false');
      document.getElementById('city-status').classList.add('is-city');
      setCityStatusGateHidden(false); /* entry gates done: is-city + in-map CSS take over */
      document.body.classList.add('in-map');
      /* Landing/game separation (2026-10-07): hide city markers in 3D scene when in-game. */
      if(typeof markerGroup!=='undefined')markerGroup.visible=false;
      initSkillHud();
      status.textContent=(selected?selected.userData.name:espilCityDisplayName())+' \u2014 walk around';
      startDnaImprint(); /* the Cauldron sticks its DNA on the city: it evolves */
      if(window.EspilAudio&&window.EspilAudio.onCitySelect)window.EspilAudio.onCitySelect();
      if(window.EspilAudio&&window.EspilAudio.onMapEnter)window.EspilAudio.onMapEnter('vancouver');
      /* #17 (Han 2nd QA): Store deep link — /vancouver/store/{placeId}.
         Teleport to store location and open info panel. */
      try{
        var dce=window.__directCityEntry;
        if(dce&&dce.storePlaceId&&typeof fetchPlaceDetails==='function'){
          (function(pid){
            fetchPlaceDetails(pid,function(d){
              if(!d||!d.location){console.warn('[StoreLink] Place not found:',pid);return;}
              var lat=d.location.latitude,lng=d.location.longitude;
              var mx=(lng-MAP_LNG0)*111320*Math.cos(MAP_LAT0*Math.PI/180);
              var mz=-(lat-MAP_LAT0)*111320;
              if(walkPlayer){
                walkPlayer.pos.set(mx,0.05,mz);
                if(walkPlayer.av)walkPlayer.av.group.position.copy(walkPlayer.pos);
                if(typeof updateChunks==='function')updateChunks(mx,mz);
              }
              var store={id:pid,
                name:(d.displayName&&d.displayName.text)||'Store',
                type:d.primaryType||'',address:d.formattedAddress||'',
                rating:d.rating||0,ratingCount:d.userRatingCount||0};
              currentStores=[store];
              showStoreModal([store]);
              setTimeout(function(){showStoreDetail(0);showStoreInfo();},500);
            });
          })(dce.storePlaceId);
          window.__directCityEntry.storePlaceId=null;
        }
      }catch(e){console.warn('[StoreLink] Failed:',e);}
      if(selected&&selected.userData&&window.EspilAudio&&window.EspilAudio.onCityEnter)window.EspilAudio.onCityEnter(selected.userData.name);
      try{
        if(!walkAudioCtx)walkAudioCtx=new (window.AudioContext||window.webkitAudioContext)();
        if(walkAudioCtx.state==='suspended')walkAudioCtx.resume();
      }catch(e){}
      updateSunPosition();
    }
    function exitWalkMap(silent){
      if(!cityPhaseActive)return;
      saveLastPos(); /* QA #6: persist position on exit */
      cityPhaseActive=false;
      gateActive=false;
      document.body.classList.remove('in-map');
      /* Landing/game separation (2026-10-07): restore city markers when leaving game. */
      if(typeof markerGroup!=='undefined')markerGroup.visible=true;
      hideSkillHud();
      document.getElementById('city-status').classList.remove('is-city');
      cityPhasePanel.setAttribute('aria-hidden','true');
      walkKeys={};
      if(window.__joyVec){window.__joyVec.x=0;window.__joyVec.y=0;}
      mapDragId=null;
      if(window.EspilAudio&&window.EspilAudio.onMapExit)window.EspilAudio.onMapExit();
      if(!silent&&window.EspilAudio&&window.EspilAudio.onReturnToOrbit)window.EspilAudio.onReturnToOrbit();
    }
    function tryJump(){
      if(!cityPhaseActive||!walkPlayer)return;
      var p=walkPlayer;
      if(p.swimming){ /* Batch 6 #4: the full set applies in water too - a water leap on the jump clip (lower arc, no double jump); the selector resumes swim/swimIdle on landing. */
        if(p._espilArrive||p._espilLanding)return;
        p.velY=6.5; p.onGround=false; p.jumps=1;
        if(p.av&&p.av.playJump)try{p.av.playJump(false);}catch(e){}
        return;
      }
      if(p._espilArrive||p._espilLanding)return; /* ESPIL TILES BRIDGE: descent/landing owns the body */
      if(p.onGround||p.jumps<2){
        var _mj=moveSpeeds();
        p.velY=(p.jumps>0?_mj.djumpV:_mj.jumpV);p.onGround=false;p.jumps++;
        walkSfx(p.jumps>1?'double':'jump');
        /* QA #7: Mixamo jump motion hooks here when assets arrive (male/female). */
        if(p.av&&p.av.playJump)try{p.av.playJump(p.jumps>1);}catch(e){}
      }
    }
    /* QA #8 (2026-10-06): Space = interact when near a building. */
    /* #11-16 (Han 2nd QA): Store interaction system.
       Space near building → fetch nearby places → selection list →
       Info / Reviews / Photos / Enter. Uses Google Places API (New). */
    var storeCache={};
    function fetchNearbyStores(b,cb){
      var ll=mapToLatLng(b.x,b.z);
      /* Map room building ID (2026-10-14): store list is identified/cached by
         building id (osm:{cx},{cz}:{i} / core:{n}); coordinates only feed the query.
         (Re-applied 2026-10-14 after the working-copy overwrite.) */
      var key=b.id?('bldg:'+b.id):(ll.lat.toFixed(4)+','+ll.lng.toFixed(4));
      if(storeCache[key]){cb(storeCache[key]);return;}
      /* Baked open data (Han 2026-10-29): the stores inside this
         building, joined at build time. No Google Places. */
      if(window.__espilBakedFor){
        window.__espilBakedFor(b).then(function(bp){
          var st=(bp&&bp.stores)||[];
          storeCache[key]=st;cb(st);
        });
        return;
      }
      cb([]);
    }
    function fetchPlaceDetails(placeId,cb){
      /* Baked open data (Han 2026-10-29): details come from the
         baked record (name, type, street address). Reviews and
         photos are not part of the open data, so those views
         report none available. No Google Places. */
      if(window.__espilBakedDetail){
        window.__espilBakedDetail(placeId).then(function(d){cb(d||null);});
        return;
      }
      cb(null);
    }
    var currentStores=[],currentStore=null,storeSelIdx=0;
    function showStoreModal(stores,buildingName){
      /* Han 2026-10-10: never show store modal on landing page */
      if(!document.body.classList.contains('in-map')) return;
      /* Han 2026-10-27: this list is the stores INSIDE the building -
         the heading says so when the building is known. */
      var stH=document.querySelector('#store-list-view h3');
      if(stH)stH.textContent=buildingName?('Stores in '+buildingName):'Choose a place';
      var modal=document.getElementById('store-modal');
      modal.style.display='';
      var listView=document.getElementById('store-list-view');
      var detailView=document.getElementById('store-detail-view');
      var listEl=document.getElementById('store-list');
      if(!modal)return;
      currentStores=stores;storeSelIdx=0;
      listView.classList.remove('hidden');
      detailView.classList.add('hidden');
      listEl.innerHTML='';
      if(stores.length===0){
        listEl.innerHTML='<p style="color:#9fb3c8">No places found nearby.</p>';
      }else{
        stores.forEach(function(s,idx){
          var div=document.createElement('div');
          div.className='store-item'+(idx===0?' selected':'');
          div.setAttribute('data-idx',idx);
          var stars=s.rating>0?'★'.repeat(Math.round(s.rating))+' '+s.rating.toFixed(1):'';
          div.innerHTML='<div class="s-name">'+escapeHtml(s.name)+'</div>'+
            '<div class="s-meta">'+escapeHtml(s.type)+' · '+stars+
            (s.ratingCount>0?' ('+s.ratingCount+')':'')+'</div>';
          div.addEventListener('click',function(){showStoreDetail(idx);});
          div.addEventListener('mouseenter',function(){setStoreSel(idx);});
          listEl.appendChild(div);
        });
      }
      modal.classList.remove('hidden');
      /* Han: hide SPACE interact prompt while store modal is open */
      var ip=document.getElementById('interact-prompt');
      if(ip)ip.classList.add('hidden');
    }
    function setStoreSel(idx){
      if(idx<0||idx>=currentStores.length)return;
      storeSelIdx=idx;
      var items=document.querySelectorAll('#store-list .store-item');
      items.forEach(function(el,i){
        if(i===idx)el.classList.add('selected');
        else el.classList.remove('selected');
      });
    }
    function escapeHtml(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    function storeSlug(name){
      return encodeURIComponent(String(name||'store').trim().replace(/\s+/g,'-'));
    }
    function showStoreDetail(idx){
      currentStore=currentStores[idx];
      if(!currentStore)return;
      document.getElementById('store-list-view').classList.add('hidden');
      document.getElementById('store-detail-view').classList.remove('hidden');
      document.getElementById('store-detail-name').textContent=currentStore.name;
      document.getElementById('store-detail-content').innerHTML='<p style="color:#9fb3c8">Select an option above.</p>';
      /* Han 2026-10-14 #3: entering a store routes to /vancouver/{store-name}.
         (Re-applied 2026-10-14 after the working-copy overwrite.) */
      try{history.pushState({store:currentStore.id},'', '/vancouver/'+storeSlug(currentStore.name));}catch(e){}
    }
    function showStoreInfo(){
      if(!currentStore)return;
      var el=document.getElementById('store-detail-content');
      el.innerHTML='<p style="color:#9fb3c8">Loading…</p>';
      fetchPlaceDetails(currentStore.id,function(d){
        if(!d){el.innerHTML='<p>Details unavailable.</p>';return;}
        var html='<p><strong>Type:</strong> '+escapeHtml(d.primaryType||currentStore.type||'—')+'</p>';
        html+='<p><strong>Address:</strong> '+escapeHtml(d.formattedAddress||currentStore.address||'—')+'</p>';
        if(d.rating)html+='<p><strong>Rating:</strong> ★ '+d.rating.toFixed(1)+' ('+(d.userRatingCount||0)+' reviews)</p>';
        if(d.priceLevel)html+='<p><strong>Price:</strong> '+'$'.repeat(d.priceLevel)+'</p>';
        if(d.regularOpeningHours&&d.regularOpeningHours.weekdayDescriptions){
          html+='<p><strong>Hours:</strong><br>'+d.regularOpeningHours.weekdayDescriptions.map(escapeHtml).join('<br>')+'</p>';
        }
        el.innerHTML=html;
      });
    }
    function showStoreReviews(){
      if(!currentStore)return;
      var el=document.getElementById('store-detail-content');
      el.innerHTML='<p style="color:#9fb3c8">Loading reviews…</p>';
      fetchPlaceDetails(currentStore.id,function(d){
        if(!d||!d.reviews||!d.reviews.length){el.innerHTML='<p>No reviews available.</p>';return;}
        var html='';
        d.reviews.slice(0,5).forEach(function(r){
          var stars='★'.repeat(r.rating||0);
          html+='<div class="review"><div class="r-stars">'+stars+'</div>'+
            '<div><strong>'+escapeHtml((r.authorAttribution&&r.authorAttribution.displayName)||'Anonymous')+'</strong></div>'+
            '<div>'+escapeHtml((r.text&&r.text.text)||'').slice(0,300)+'</div></div>';
        });
        el.innerHTML=html;
      });
    }
    function showStorePhotos(){
      if(!currentStore)return;
      var el=document.getElementById('store-detail-content');
      el.innerHTML='<p style="color:#9fb3c8">Loading photos…</p>';
      fetchPlaceDetails(currentStore.id,function(d){
        if(!d||!d.photos||!d.photos.length){el.innerHTML='<p>No photos available.</p>';return;}
        var html='<div class="photo-grid">';
        d.photos.slice(0,6).forEach(function(p){
          if(p.name){
            var url=PLACES_PROXY?('/api/places-photo?name='+encodeURIComponent(p.name)+'&maxWidthPx=400'):('https://places.googleapis.com/v1/'+p.name+'/media?maxWidthPx=400&key='+GOOGLE_PLACES_KEY);
            html+='<img src="'+escapeHtml(url)+'" loading="lazy" alt="Place photo">';
          }
        });
        el.innerHTML=html+'</div>';
      });
    }
    function enterStoreWebsite(){
      if(!currentStore)return;
      fetchPlaceDetails(currentStore.id,function(d){
        var url=d&&d.websiteUri;
        if(url){window.open(url,'_blank');}
        else{
          var el=document.getElementById('store-detail-content');
          el.innerHTML='<p>No website available for this place.</p>';
        }
      });
    }
    /* Cauldron alignment (Han 2026-10-19): in Cauldron the Space
       keydown first offers the press to the wall jump (EspilPort
       .onSpace) and only then falls through to interact - the same
       order as the keydown below. The jump mechanics are Han's
       2026-10-16 wall jump unchanged: the game's own jump velocity
       plus an outward drift, one air jump left. */
    function espilSpaceWallJump(){
      var p=walkPlayer; if(!p||!p._espilClimb)return false;
      var cl=p._espilClimb;
      var jv=(typeof moveSpeeds==='function')?moveSpeeds().jumpV:9;
      espilClimbDetach(p,false);
      p.velY=jv; p.jumps=1; p.onGround=false;
      p._espilWallDrift={nx:cl.nx,nz:cl.nz,t:.22};
      return true;
    }
    /* Cauldron's no-target answer (interactWithNearestPoi shows this
       exact guidance when nothing resolves), carried on this build's
       toast channel instead of Cauldron's dialogue panel. */
    function espilSpaceTooFar(){
      var t=document.getElementById('toast'); if(!t)return;
      t.textContent='No building or shop is close enough to interact with. Move closer to a building or shop, then press Space.';
      t.classList.add('show');
      clearTimeout(t._sf);
      t._sf=setTimeout(function(){t.classList.remove('show');},3400);
    }
    function tryInteract(){
      if(!cityPhaseActive||!walkPlayer)return;
      /* Han 2026-10-14 #2: while the store list is open, SPACE confirms the
         selection (handled by the modal key handler) — never re-fetch here.
         (Re-applied 2026-10-14 after the working-copy overwrite.) */
      var _sm=document.getElementById('store-modal');
      if(_sm&&!_sm.classList.contains('hidden'))return;
      /* ARENA SEAM: the arena portal at the Art Gallery plaza
         (11, 33) - inside the safe zone, 8 m east of ESPIL_SPAWN.
         Space / INTERACT within 10 m opens the arena panel. */
      if(window.__espilArena&&walkPlayer&&walkPlayer.pos){
        var _adx=walkPlayer.pos.x-11,_adz=walkPlayer.pos.z-33;
        if(_adx*_adx+_adz*_adz<=100){ window.__espilArena.portalUse(); return; }
      }
      /* BUILDING INTERIOR (Han batch 6 #6): while inside, Space at
         the door leaves; Space anywhere else toggles the shop UI. */
      if(window.__espilInside&&espilInsideDoor){
        var _dd=Math.sqrt((walkPlayer.pos.x-espilInsideDoor.x)*(walkPlayer.pos.x-espilInsideDoor.x)+(walkPlayer.pos.z-espilInsideDoor.z)*(walkPlayer.pos.z-espilInsideDoor.z));
        /* PLACE SPACE (Han 2026-11-16): inside a building's own
           space, Space at the door exits the space (the window
           closes, or the same-window street return when there is
           no opener); Space anywhere else is the store-selection
           Use - the aimed bay's book opens. Both live in
           modules/place-space.js behind these two hooks. */
        if(window.__espilInside.placeSpace){
          if(_dd<1.8){ if(window.__espilPlaceSpaceExit)window.__espilPlaceSpaceExit(); return; }
          if(window.__espilPlaceSpaceUse)window.__espilPlaceSpaceUse();
          return;
        }
        /* HOME SPACE (Han 2026-11-16, design 8.1 hunk 5): inside
           the player's own home, Space at the door leaves; Space
           anywhere else does nothing - the home has no kiosk or
           shop surface for the press to fall through to. */
        if(window.__espilInside.home){
          if(_dd<1.8){ if(window.__espilHomeExitSpace)window.__espilHomeExitSpace(); return; }
          return;
        }
        if(_dd<1.8){ if(window.__espilInside.arena){ if(window.__espilArena)window.__espilArena.exitRun(); return; } espilLeaveBuilding(); return; }
        if(window.__espilInside.arena)return; /* ARENA SEAM: no kiosk/shop surface inside the arena space */
        /* v3 (Han 2026-10-26): inside, Space works the kiosk - near it,
           the kiosk hook fires; anywhere else only closes an open card. */
        var _ks=(typeof window.__espilKioskState==='function')?window.__espilKioskState():null;
        if(_ks&&_ks.d<2.2){ if(typeof window.__espilUseKiosk==='function')window.__espilUseKiosk(); return; }
        var _su=document.getElementById('shop-ui'); if(_su&&_su.classList.contains('open'))espilCloseShop();
        else if(window.__espilToast)window.__espilToast('Use the kiosk by the entrance to order');
        return;
      }
      /* Han PC verdict 2026-10-19 #7: interact executes only at the
         building face (record distance <= 2 m). Cauldron alignment
         (Han 2026-10-19): past that gate the press is no longer
         swallowed silently - Cauldron resolves in tiers (strict 14 m
         edge / loose 44 m / POI 120 m) and answers with the too-far
         guidance whenever nothing resolves; here the #7 execution
         gate stands and every press past it gets Cauldron's answer. */
      /* IN-PLACE INTERIOR (Han batch 5 #1): Space inside a building
         is handled by tryInteract's inside branch (the door leaves,
         anywhere else reopens the options panel) - no early return
         here, the normal wall-jump/interact flow decides. */
      /* Han 2026-11-06 (store-name rework): on the Mapbox line, Space
         works from the ground point UNDER the building's name label -
         the record whose label anchor is within ESPIL_LABEL_INTERACT_R
         (3.5 m) opens its building selection window; Enter goes
         inside (shops to their store page, other buildings to the
         interior room). Past every anchor, Cauldron's too-far answer
         stands. */
      if(typeof ESPIL_P1!=='undefined'&&ESPIL_P1){
        var _la=espilNearestLabelAnchor(walkPlayer.pos.x,walkPlayer.pos.z);
        if(!_la){
          /* FISHING (Han 2026-11-25, fishing/DESIGN.md section 5.1):
             the cast claims the Use press ONLY here, at the end of
             the chain where the too-far answer would fire - if a
             building anchor, the arena portal, a kiosk or the boat
             claimed the press above, fishing never sees it. When
             fishing's cast test also fails, tryUse() returns false
             and the too-far notice shows exactly as before. */
          if(!(window.__espilFishing&&window.__espilFishing.tryUse()))espilSpaceTooFar();
          return;
        }
        /* NAME-ONLY ENTRY (Han 2026-11-24): layered BEHIND the
           anchor judgement above - the prompt was presented and
           the press resolved exactly as today; only now, for an
           entrant, a building whose centre sits outside the
           village radius answers with the closed notice instead
           of opening its panel. The anchor judgement itself is
           untouched; in-village buildings behave exactly as
           today. */
        if(espilVillageActive()&&espilVillageDist(_la.rec.cx,_la.rec.cz)>espilLandmark().radius){
          espilVillageNotice(espilTailT('villageClosed'));
          return;
        }
        if(walkPlayer.av&&walkPlayer.av.playOneShot){
          walkPlayer.av.playOneShot(Math.random()>.5?'checkout':'chat');
        }
        openBuildingPanel(_la.rec);
        if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
        return;
      }
      /* Play checkout/chat animation */
      if(walkPlayer.av&&walkPlayer.av.playOneShot){
        var useCheckout=Math.random()>.5;
        walkPlayer.av.playOneShot(useCheckout?'checkout':'chat');
      }
      if(nearBldg){
        /* Han 2026-10-10: Only work at real stores, not all buildings */
        /* Map room ID (2026-10-14): resolve the canonical building via its id. */
        var targetBldg=(nearBldg.id&&typeof getBuildingById==='function'&&getBuildingById(nearBldg.id))||nearBldg;
        fetchNearbyStores(targetBldg,function(stores){
          if(stores&&stores.length>0){
            showStoreModal(stores,targetBldg.name||'');
          }else{
            /* Not a store — show toast */
            var t=document.getElementById('toast');
            if(t){
              var msg='Not a store';
              t.textContent=msg;
              t.classList.add('show');
              clearTimeout(t._it);
              t._it=setTimeout(function(){t.classList.remove('show');},2000);
            }
          }
        });
        if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
      }
    }
    /* Store modal wiring */
    (function initStoreModal(){
      function onReady(){
        var closeBtn=document.getElementById('store-modal-close');
        if(closeBtn)closeBtn.addEventListener('click',function(){
          document.getElementById('store-modal').classList.add('hidden');
          /* Han: restore SPACE prompt if still near a building (the
             top name pill is retired - names float on buildings now) */
          var ip=document.getElementById('interact-prompt');
          if(ip&&typeof nearBldg!=='undefined'&&nearBldg&&!(typeof ESPIL_P1!=='undefined'&&ESPIL_P1))ip.classList.remove('hidden'); /* P1: the proximity tick restores it under the anchor gate */
        });
        var backBtn=document.getElementById('store-back');
        if(backBtn)backBtn.addEventListener('click',function(){
          document.getElementById('store-detail-view').classList.add('hidden');
          document.getElementById('store-list-view').classList.remove('hidden');
        });
        var actions=document.querySelectorAll('#store-modal .store-actions button');
        actions.forEach(function(btn){
          btn.addEventListener('click',function(){
            var action=btn.getAttribute('data-action');
            if(action==='info')showStoreInfo();
            else if(action==='reviews')showStoreReviews();
            else if(action==='photos')showStorePhotos();
            else if(action==='enter')enterStoreWebsite();
          });
        });
        /* ESC closes modal; arrows + Enter navigate list */
        document.addEventListener('keydown',function(e){
          var m=document.getElementById('store-modal');
          if(!m||m.classList.contains('hidden'))return;
          var listView=document.getElementById('store-list-view');
          var isList=!listView.classList.contains('hidden');
          if(e.key==='Escape'){
            m.classList.add('hidden');
            /* Han: restore SPACE prompt if still near a building (the
               top name pill is retired - names float on buildings now) */
            var ip=document.getElementById('interact-prompt');
            if(ip&&typeof nearBldg!=='undefined'&&nearBldg&&!(typeof ESPIL_P1!=='undefined'&&ESPIL_P1))ip.classList.remove('hidden'); /* P1: the proximity tick restores it under the anchor gate */
          }else if(isList&&currentStores.length>0){
            if(e.key==='ArrowDown'){
              e.preventDefault();
              setStoreSel((storeSelIdx+1)%currentStores.length);
            }else if(e.key==='ArrowUp'){
              e.preventDefault();
              setStoreSel((storeSelIdx-1+currentStores.length)%currentStores.length);
            }else if(e.key==='Enter'||e.key===' '){
              /* Han 2026-10-14 #2: SPACEBAR confirms the highlighted store.
                 (Re-applied 2026-10-14 after the working-copy overwrite.) */
              e.preventDefault();
              showStoreDetail(storeSelIdx);
            }
          }
        });
      }
      if(document.readyState==='complete')onReady();
      else window.addEventListener('load',onReady);
    })();
    /* ================================================================
       Skill system — Keeper (the only class for now).
       No weapons exist yet, so the whole kit is unarmed: punch slash,
       kick, and a tool quotation. Each move carries its own damage, range,
       cooldown, arc effect and synthesized sound. MOVES is the single
       table new moves plug into later (weapons included, once forged).
       Skill points come from levels (EXP arrives with enemies); 3 starter
       points are granted so the tree works today.
       ================================================================ */
    var MOVE_ORDER=['punch','kick','throw','defense','dash','spin','wave','art'];
    /* FIX-7 item 6 (Han 2026-11-12): every skill's effect RANGE
       widened +50% (punch 2.2->3.3, kick 2.8->4.2, throw 8->12,
       dash 3.4->5.1, spin 2.6->3.9, wave 9->13.5, art base 3->4.5;
       the Weapon Art family forms in ESPIL_ART_MOVES widened the
       same way). Damage / cooldown / arc / MP untouched - ranges
       are Han's feel call; defense has no spatial effect and is
       unchanged. */
    var MOVES={
      punch:{name:'Punch',key:'Q',icon:'👊',color:0xbfe9ff,css:'#bfe9ff',
        dmg:8,range:3.3,cd:.45,arc:1.9,y:1.05,
        desc:'A quick punch.'},
      kick:{name:'Kick',key:'W',icon:'🦵',color:0x7dfce6,css:'#7dfce6',
        dmg:13,range:4.2,cd:.65,arc:2.2,y:.6,
        desc:'A heavy kick. Slower, longer reach.'},
      throw:{name:'Quote Tool',key:'E',icon:'「」',art:'quote',color:0xffd76e,css:'#ffd76e',
        dmg:10,range:12,cd:.9,arc:1.6,y:1.3,proj:true,
        desc:'Quote a tool from your knowledge. It flies forth and bursts on arrival.'},
      defense:{name:'Defense',key:'R',icon:'🛡️',color:0x9fe8b3,css:'#9fe8b3',
        dmg:0,range:0,cd:2.5,arc:0,y:1.0,guard:true,
        desc:'Raise your guard. Blocks while active.'},
      /* Batch 6 Item C: unlockable skills (character tree nodes
         m_dash / m_spin / m_wave gate them; 'art' is gated per
         weapon family in the weapon tree). MP cost stays 0 - Han
         decision D7 (MP costs) is undecided; do not invent costs. */
      dash:{name:'Dash Strike',key:'A',icon:'💨',art:'dash',color:0x9fd8ff,css:'#9fd8ff',
        dmg:11,range:5.1,cd:.8,arc:1.7,y:1.0,dashMove:true,
        desc:'Dash forward and strike whatever you reach.'},
      spin:{name:'Spinning Strike',key:'S',icon:'🌀',art:'spin',color:0x7dfce6,css:'#7dfce6',
        dmg:15,range:3.9,cd:1.4,arc:6.3,y:.9,
        desc:'A full-circle strike that hits everything around you.'},
      wave:{name:'Ranged Wave',key:'D',icon:'🌊',art:'wave',color:0x6fb7ff,css:'#6fb7ff',
        dmg:12,range:13.5,cd:1.1,arc:1.2,y:1.2,proj:true,
        desc:'A wave of force down the facing line.'},
      art:{name:'Weapon Art',key:'F',icon:'⚔️',art:'art',color:0xffd76e,css:'#ffd76e',
        dmg:0,range:4.5,cd:2.2,arc:2.4,y:1.05,
        desc:'Your equipped weapon\'s signature art. Its form follows the weapon family; unlocked per family in the weapon tree.'}
    };
    /* Skill bar slots, QWER row then ASDF row. Locked slots show a lock;
       empty ones are inert placeholders for future skills. */
    var SKILL_SLOTS=[
      {key:'q',move:'punch'},
      {key:'w',move:'kick'},
      {key:'e',move:'throw'},
      {key:'r',move:'defense'},
      {key:'a',move:'dash'},
      {key:'s',move:'spin'},
      {key:'d',move:'wave'},
      {key:'f',move:'art'}
    ];
    function skillSlotForKey(key){
      for(var i=0;i<SKILL_SLOTS.length;i++)if(SKILL_SLOTS[i].key===key)return SKILL_SLOTS[i];
      return null;
    }
    var SKILL_NODES=[
      {id:'m_walk',name:'Walking',max:20,art:'walk',desc:'+1.5% walk speed per rank. A good walker is a fast walker.'},
      {id:'m_run',name:'Running',max:20,art:'run',needNode:'m_walk',needRank:3,desc:'+2% run speed per rank. Requires Walking Lv 3.'},
      {id:'m_jump',name:'Jump',max:20,art:'jump',desc:'+1% jump velocity per rank.'},
      {id:'m_djump',name:'Double Jump',max:10,art:'djump',needNode:'m_jump',needRank:3,desc:'+2% double-jump velocity per rank. Requires Jump Lv 3.'},
      {id:'m_punch',name:'Punch',max:20,art:'punch',desc:'+5% Punch damage per rank.'},
      {id:'m_kick',name:'Kick',max:20,art:'kick',desc:'+5% Kick damage per rank.'},
      {id:'m_throw',name:'Quote Tool',max:20,art:'quote',desc:'+5% damage per rank.'},
      {id:'m_defense',name:'Defense',max:20,art:'defense',desc:'+0.06s guard duration per rank.'},
      {id:'m_dash',name:'Dash Strike',max:20,art:'dash',needNode:'m_kick',needRank:3,desc:'Unlocks Dash Strike (A key). +5% damage per rank. Requires Kick Lv 3.'},
      {id:'m_spin',name:'Spinning Strike',max:20,art:'spin',needNode:'m_punch',needRank:5,desc:'Unlocks Spinning Strike (S key). +5% damage per rank. Requires Punch Lv 5.'},
      {id:'m_wave',name:'Ranged Wave',max:20,art:'wave',needNode:'m_throw',needRank:5,desc:'Unlocks Ranged Wave (D key). +5% damage per rank. Requires Quote Tool Lv 5.'},
      {id:'swift',name:'Swift Forge',max:5,need:2,art:'swift',desc:'+5% attack speed per rank.'},
      {id:'reach',name:'Long Reach',max:3,need:2,art:'reach',desc:'+7% range per rank.'},
      {id:'toss',name:'Cauldron Toss',locked:true,art:'throw',desc:'Hurl a whole burning cauldron. Arrives with the combat update.'},
      {id:'guard',name:'Ember Guard',locked:true,art:'defense',desc:'A ring of forge-fire around you. Arrives with the combat update.'}
    ];
    /* The tree itself: node positions (percent) + branch parents. One page. */
    var TREE_LAYOUT=[
      {id:'keeper',x:50,y:90,root:true},
      {id:'m_walk',x:30,y:76,parent:'keeper'},
      {id:'m_run',x:20,y:58,parent:'m_walk'},
      {id:'swift',x:24,y:38,parent:'m_run'},
      {id:'m_jump',x:43,y:64,parent:'keeper'},
      {id:'m_djump',x:43,y:46,parent:'m_jump'},
      {id:'reach',x:57,y:32,parent:'m_djump'},
      {id:'m_defense',x:57,y:74,parent:'keeper'},
      {id:'m_punch',x:68,y:68,parent:'keeper'},
      {id:'m_kick',x:78,y:58,parent:'m_punch'},
      {id:'m_throw',x:88,y:68,parent:'keeper'},
      {id:'m_dash',x:64,y:48,parent:'m_kick'},
      {id:'m_spin',x:80,y:42,parent:'m_kick'},
      {id:'m_wave',x:90,y:50,parent:'m_throw'},
      {id:'toss',x:72,y:26,parent:null},
      {id:'guard',x:85,y:32,parent:null}
    ];
    var selectedSkillId='m_punch';
    function skillNodeById(id){
      for(var i=0;i<SKILL_NODES.length;i++)if(SKILL_NODES[i].id===id)return SKILL_NODES[i];
      return null;
    }
    function prereqMet(n){
      if(!n||n.locked||n.root)return true;
      if(n.need&&totalSpent()<n.need)return false;
      if(n.needNode&&(skillState.alloc[n.needNode]||0)<(n.needRank||0))return false;
      return true;
    }
    /* Movement skills feed back into the walk controller.
       Batch 6 Item C: the shoes tree stacks on top (s_swift all
       gaits, s_stride run only, s_leap jump power). */
    function moveSpeeds(){
      var a=skillState.alloc;
      var sw=espilTreeAlloc('s_swift'), st2=espilTreeAlloc('s_stride'), lp=espilTreeAlloc('s_leap');
      /* TUNING (Han 2026-11-23: movement too fast, animation too
         fast, screen too far): the street bases fall from walk
         13.5 / run 21.6 to walk 5.0 / run 8.0 - the 1.6 run/walk
         ratio is preserved exactly, and the stride sync divides
         the locomotion timeScale by the same 2.7x, so the legs
         slow WITH the body. ESPIL_ANIM_SPEED_F itself is NOT
         deepened: it is the foot-ground deviation Han set on
         2026-11-16, and cutting it further would add slide, not
         calm. Swim keeps 4 - it already sat inside the tuned band
         and its clip is not stride-synced. The skill multipliers
         below ride the bases unchanged. */
      var r={
        walk:5*(1+.015*(a['m_walk']||0))*(1+.015*sw),
        run:8*(1+.02*(a['m_run']||0))*(1+.015*sw+.03*st2),
        swim:4,
        jumpV:9*(1+.01*(a['m_jump']||0))*(1+.015*lp),
        djumpV:9*(1+.02*(a['m_djump']||0))*(1+.015*lp)
      };
      /* PLACE SPACE (Han 2026-11-16, design 5): inside a building's
         own space the street speeds are far too fast for a lobby -
         the walk tick reads these two constants instead (the same
         4.5 / 7.0 the sample store page walked at). */
      if(window.__espilInside&&window.__espilInside.placeSpace){ r.walk=ESPIL_PLACE_WALK; r.run=ESPIL_PLACE_RUN; }
      /* HOME SPACE (Han 2026-11-16, design 2.2): the home is a
         small room too - the same lobby-class speeds, on its own
         constants so the home pace can be tuned alone. */
      if(window.__espilInside&&window.__espilInside.home){ r.walk=ESPIL_HOME_WALK; r.run=ESPIL_HOME_RUN; }
      return r;
    }
    /* MapleStory-style pixel skill icons, drawn on a 16x16 canvas at runtime. */
    var SKILL_ICONS={};
    function pxIcon(art){
      if(SKILL_ICONS[art]!==undefined)return SKILL_ICONS[art];
      var url='';
      try{
        var c=document.createElement('canvas');c.width=c.height=16;
        var g=c.getContext('2d');if(!g)throw 0;
        var R=function(x,y,w,h,col){g.fillStyle=col;g.fillRect(x,y,w,h);};
        R(0,0,16,16,'#141a28');
        R(0,0,16,1,'#2c3a55');R(0,15,16,1,'#2c3a55');R(0,0,1,16,'#2c3a55');R(15,0,1,16,'#2c3a55');
        if(art==='punch'){
          R(4,5,2,2,'#f2c48d');R(7,4,2,3,'#f2c48d');R(10,4,2,3,'#f2c48d');
          R(4,7,8,4,'#eab276');R(3,8,1,3,'#eab276');R(12,8,1,3,'#eab276');
          R(4,11,8,1,'#c98f5f');R(5,5,1,1,'#fff3d6');
        }else if(art==='kick'){
          R(6,3,4,6,'#8a5a33');R(6,3,4,1,'#6e4525');
          R(5,9,7,3,'#a06a3c');R(5,12,7,1,'#4e3018');R(6,4,1,4,'#c98f5f');
        }else if(art==='throw'){
          R(6,11,4,3,'#d63a2a');R(7,8,3,4,'#ff7b2f');R(7,5,2,4,'#ffd23f');
          R(8,3,1,3,'#fff3b0');R(5,12,6,1,'#7a1f16');
        }else if(art==='defense'){
          R(4,3,8,2,'#9fe8b3');R(4,5,8,5,'#3fae6a');R(7,5,2,5,'#2e8b52');
          R(5,10,6,2,'#3fae6a');R(6,12,4,1,'#2e8b52');R(7,13,2,1,'#256b40');
          R(4,5,1,5,'#c9f5d8');
        }else if(art==='swift'){
          R(9,2,3,4,'#ffd23f');R(6,5,6,3,'#ffd23f');R(4,7,3,5,'#ffd23f');
          R(9,3,1,3,'#fff3b0');R(6,6,3,1,'#fff3b0');
        }else if(art==='reach'){
          R(2,7,8,2,'#7dfce6');R(2,7,8,1,'#d8fff9');
          R(10,5,2,6,'#7dfce6');R(12,6,2,4,'#7dfce6');R(14,7,1,2,'#e8fffd');
        }else if(art==='quote'){
          R(4,4,2,8,'#ffd76e');R(4,4,4,2,'#ffd76e');
          R(10,4,2,8,'#ffd76e');R(8,10,4,2,'#ffd76e');
          R(7,7,2,2,'#fff3b0');
        }else if(art==='walk'){
          R(7,6,3,5,'#8a5a33');R(6,10,5,2,'#a06a3c');R(6,12,5,1,'#4e3018');
          R(2,7,3,1,'#7dfce6');R(1,10,4,1,'#7dfce6');
        }else if(art==='run'){
          R(8,6,3,5,'#8a5a33');R(7,10,5,2,'#a06a3c');R(7,12,5,1,'#4e3018');
          R(1,5,4,1,'#ffd23f');R(2,8,4,1,'#ffd23f');R(1,11,4,1,'#ffd23f');
        }else if(art==='jump'){
          R(7,2,2,8,'#bfe9ff');R(5,4,2,3,'#bfe9ff');R(9,4,2,3,'#bfe9ff');
          R(7,2,1,8,'#e8f4ff');R(6,11,4,2,'#8a5a33');
        }else if(art==='djump'){
          R(3,7,2,5,'#7dfce6');R(2,5,2,3,'#7dfce6');R(4,5,2,3,'#7dfce6');
          R(10,7,2,5,'#7dfce6');R(9,5,2,3,'#7dfce6');R(11,5,2,3,'#7dfce6');
          R(3,7,1,5,'#d8fff9');R(10,7,1,5,'#d8fff9');
        }else if(art==='dash'){
          R(2,6,5,2,'#9fd8ff');R(1,9,6,2,'#9fd8ff');R(3,12,4,2,'#9fd8ff');
          R(9,5,4,6,'#e8f4ff');R(12,7,2,2,'#bfe9ff');
        }else if(art==='spin'){
          R(7,2,2,3,'#7dfce6');R(11,4,3,2,'#7dfce6');R(12,8,2,3,'#7dfce6');
          R(9,12,3,2,'#7dfce6');R(4,11,2,3,'#7dfce6');R(2,7,3,2,'#7dfce6');
          R(7,7,2,2,'#d8fff9');
        }else if(art==='wave'){
          R(3,4,2,8,'#6fb7ff');R(6,6,2,5,'#6fb7ff');R(9,7,2,3,'#6fb7ff');
          R(12,8,2,2,'#bfe9ff');
        }else if(art==='art'){
          R(4,11,7,2,'#8a5a33');R(9,3,3,9,'#ffd76e');R(10,2,1,3,'#fff3b0');
          R(3,12,3,1,'#ffd76e');
        }else if(art==='sword'){
          R(10,2,3,9,'#cfd8de');R(9,10,5,2,'#8a6a3f');R(10,12,2,3,'#5d4630');
        }else if(art==='staff'){
          R(7,5,2,10,'#8a6844');R(6,2,4,4,'#c9a6ff');R(7,3,2,2,'#efe6ff');
        }else if(art==='bow'){
          R(4,2,2,12,'#8a6844');R(4,2,8,1,'#e8e0cc');R(4,13,8,1,'#e8e0cc');R(11,7,2,1,'#ffd76e');
        }else if(art==='dagger'){
          R(10,3,3,7,'#e8eef2');R(9,10,4,2,'#7a4a8c');R(10,12,2,2,'#3a2a5e');
        }else if(art==='shield'){
          R(4,3,8,2,'#9fe8b3');R(4,5,8,5,'#3fae6a');R(7,5,2,5,'#2e8b52');
          R(5,10,6,2,'#3fae6a');R(6,12,4,1,'#2e8b52');
        }else if(art==='boot'){
          R(5,3,4,7,'#8a6844');R(5,10,8,3,'#a06a3c');R(5,13,8,1,'#4e3018');
        }else if(art==='vital'){
          R(7,4,2,8,'#e86a8a');R(4,7,8,2,'#e86a8a');R(5,5,1,1,'#ffd7e2');
        }else if(art==='regen'){
          R(7,3,2,9,'#58c96b');R(5,5,2,2,'#58c96b');R(10,5,2,2,'#58c96b');
          R(4,9,3,2,'#58c96b');R(9,9,3,2,'#58c96b');R(7,12,1,1,'#d8ffd2');
        }else if(art==='ward'){
          R(5,3,6,10,'#6fb7ff');R(6,5,4,2,'#bfe9ff');R(7,9,2,3,'#bfe9ff');
        }
        url=c.toDataURL();
      }catch(e){}
      SKILL_ICONS[art]=url;return url;
    }
    /* Knowledge cost to go from rank -> rank+1. */
    function rankCost(rank){ return 1+Math.floor(rank/4); }
    /* Progression is Knowledge, not levels: watching videos earns Knowledge,
       which is spent to raise each skill toward Lv 20. */
    var skillState={knowledge:10,alloc:{},hp:100,maxhp:100,mp:50,maxmp:50,exp:0,maxexp:100,cd:{punch:0,kick:0,throw:0,defense:0}};
    try{
      var _ss=JSON.parse(window.localStorage.getItem('espil_skills_v1')||'null');
      if(_ss){
        /* Drop allocations for nodes that no longer exist; clamp ranks to 20. */
        var _na={};
        if(_ss.alloc)for(var _k in _ss.alloc){
          for(var _ni=0;_ni<SKILL_NODES.length;_ni++){
            if(SKILL_NODES[_ni].id===_k){_na[_k]=Math.min(20,_ss.alloc[_k]);break;}
          }
        }
        skillState.alloc=_na;
        /* Old skill points convert to Knowledge. */
        skillState.knowledge=10+((_ss.points||0)*5)+(_ss.knowledge||0);
        if(typeof _ss.hp==='number')skillState.hp=_ss.hp;
        if(typeof _ss.maxhp==='number')skillState.maxhp=_ss.maxhp;
        if(typeof _ss.mp==='number')skillState.mp=_ss.mp;
        if(typeof _ss.maxmp==='number')skillState.maxmp=_ss.maxmp;
      }
    }catch(e){}
    /* Make sure every move has a cooldown slot (saves from older builds may not). */
    for(var _mi=0;_mi<MOVE_ORDER.length;_mi++){
      if(typeof skillState.cd[MOVE_ORDER[_mi]]!=='number')skillState.cd[MOVE_ORDER[_mi]]=0;
    }
    function saveSkills(){try{window.localStorage.setItem('espil_skills_v1',JSON.stringify(skillState));}catch(e){}}
    function totalSpent(){var s=0;for(var k in skillState.alloc)s+=skillState.alloc[k];return s;}
    /* Knowledge earned by watching videos (the video player calls gainKnowledge
       when a video completes; the tree's demo button simulates it for now). */
    function gainKnowledge(n,source){
      n=Math.max(0,Math.floor(n||0));
      if(!n)return;
      skillState.knowledge+=n;
      saveSkills();paintStatus();paintKnowledge();
      if(window.__espilToast)window.__espilToast('📚 +'+n+' Knowledge'+(source?' — '+source:''));
    }
    function moveStatsAt(id,rank){
      var m=(id==='art')?espilArtMoveDef():MOVES[id];
      var cd=m.cd/(1+.05*(skillState.alloc.swift||0));
      if(id==='dash')cd*=Math.max(.4,1-.06*espilTreeAlloc('s_dashcd')); /* shoes tree */
      return {
        m:m,
        dmg:Math.round(m.dmg*(1+.05*rank)*espilTreeDmgMul()),
        range:m.range*(1+.07*(skillState.alloc.reach||0))+espilTreeRangeBonus(m),
        cd:cd,
        guardDur:m.guard?(1.2+0.06*rank):0
      };
    }
    function moveStats(id){return moveStatsAt(id,skillState.alloc['m_'+id]||0);}
    /* Synthesized swing / impact sounds — no audio assets needed. */
    function skillSfx(kind){
      try{
        if(!walkAudioCtx)walkAudioCtx=new (window.AudioContext||window.webkitAudioContext)();
        if(walkAudioCtx.state==='suspended')walkAudioCtx.resume();
        var ctx=walkAudioCtx,t=ctx.currentTime;
        if(kind==='thud'){
          var o=ctx.createOscillator(),g=ctx.createGain();
          o.type='sine';o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(48,t+.12);
          g.gain.setValueAtTime(.28,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
          o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.18);
        }
        if(kind==='guard'){
          var og=ctx.createOscillator(),gg=ctx.createGain();
          og.type='square';og.frequency.setValueAtTime(220,t);og.frequency.exponentialRampToValueAtTime(110,t+.1);
          gg.gain.setValueAtTime(.16,t);gg.gain.exponentialRampToValueAtTime(.001,t+.15);
          og.connect(gg);gg.connect(ctx.destination);og.start(t);og.stop(t+.17);
        }
        var len=Math.floor(ctx.sampleRate*.25),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
        for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
        var src=ctx.createBufferSource();src.buffer=buf;
        var f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.1;
        var base=kind==='whoosh-hi'?2600:(kind==='whoosh-lo'?520:(kind==='thud'?700:(kind==='guard'?900:1400)));
        f.frequency.setValueAtTime(base,t);f.frequency.exponentialRampToValueAtTime(Math.max(80,base*.32),t+.2);
        var g2=ctx.createGain();g2.gain.setValueAtTime(.22,t);g2.gain.exponentialRampToValueAtTime(.001,t+.24);
        src.connect(f);f.connect(g2);g2.connect(ctx.destination);src.start(t);
      }catch(e){}
    }
    /* Slash arc effect pool. Horizontal ring-sectors, additive, expanding +
       fading; centered on the player's facing direction. */
    var fxPool=[];
    function spawnArc(colorHex,range,arc,y,life,s0,s1){
      if(!mapScene||!walkPlayer)return;
      var p=walkPlayer;
      var geo=new THREE.RingGeometry(Math.max(.3,range*.45),range,40,1,0,arc);
      var mat=new THREE.MeshBasicMaterial({color:colorHex,transparent:true,opacity:.9,
        side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
      var mesh=new THREE.Mesh(geo,mat);
      mesh.rotation.x=-Math.PI/2;
      mesh.renderOrder=5;mesh.frustumCulled=false;
      var grp=new THREE.Group();
      grp.add(mesh);
      grp.position.set(p.pos.x,y,p.pos.z);
      /* Ring theta starts at local +X; this yaw centers the arc on the facing dir. */
      grp.rotation.y=p.faceY+Math.PI/2-arc/2;
      mapScene.add(grp);
      fxPool.push({grp:grp,mat:mat,geo:geo,t:0,life:life,s0:s0,s1:s1,o0:.9,sprite:null});
    }
    function spawnFlash(colorHex,dist,px,pz,py){
      if(!mapScene||!walkPlayer||typeof glowTex==='undefined')return;
      var p=walkPlayer;
      var sm=new THREE.SpriteMaterial({map:glowTex,color:colorHex,transparent:true,opacity:.85,
        blending:THREE.AdditiveBlending,depthWrite:false});
      var sp=new THREE.Sprite(sm);
      var fx=-Math.sin(p.faceY),fz=-Math.cos(p.faceY);
      sp.position.set(
        (typeof px==='number')?px:p.pos.x+fx*dist,
        (typeof py==='number')?py:1.25,
        (typeof pz==='number')?pz:p.pos.z+fz*dist);
      sp.scale.set(.9,.9,1);
      mapScene.add(sp);
      fxPool.push({grp:sp,mat:sm,geo:null,t:0,life:.18,s0:.9,s1:2.6,o0:.85,sprite:sp});
    }
    function spawnProjectile(m){
      if(!mapScene||!walkPlayer||typeof glowTex==='undefined')return;
      var p=walkPlayer;
      var sm=new THREE.SpriteMaterial({map:glowTex,color:m.color,transparent:true,opacity:.95,
        blending:THREE.AdditiveBlending,depthWrite:false});
      var sp=new THREE.Sprite(sm);
      var fx=-Math.sin(p.faceY),fz=-Math.cos(p.faceY);
      sp.position.set(p.pos.x+fx*.8,m.y,p.pos.z+fz*.8);
      sp.scale.set(.7,.7,1);
      mapScene.add(sp);
      var speed=14,life=m.range/speed;
      fxPool.push({grp:sp,mat:sm,geo:null,t:0,life:life,s0:.7,s1:.7,o0:.95,sprite:sp,
        proj:{vx:fx*speed,vz:fz*speed}});
    }
    /* Guard bubble: follows the player while Defense is active. */
    function spawnGuard(m,dur){
      if(!mapScene||!walkPlayer)return;
      var p=walkPlayer;
      var geo=new THREE.SphereGeometry(1.7,24,16);
      var mat=new THREE.MeshBasicMaterial({color:m.color,transparent:true,opacity:.3,
        side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
      var mesh=new THREE.Mesh(geo,mat);
      mesh.renderOrder=5;mesh.frustumCulled=false;
      mesh.position.set(p.pos.x,1.1,p.pos.z);
      mapScene.add(mesh);
      fxPool.push({grp:mesh,mat:mat,geo:geo,t:0,life:dur,s0:.7,s1:1.02,o0:.3,sprite:null,follow:true,uniform:true});
      p.guarding=dur;
    }
    function updateSkillFx(dt){
      espilGameT+=dt; /* SURVIVAL S1: the combat clock is game time */
      var i;
      var anyCd=false;
      for(i=0;i<MOVE_ORDER.length;i++){
        var mid=MOVE_ORDER[i];
        if(skillState.cd[mid]>0){skillState.cd[mid]=Math.max(0,skillState.cd[mid]-dt);anyCd=true;}
      }
      if(anyCd)paintCooldowns();
      espilHealTick(dt); /* HEAL FX (2026-11-13): drives the heal bar/count animation + world FX */
      if(skillState.mp<skillState.maxmp){skillState.mp=Math.min(skillState.maxmp,skillState.mp+5*dt);paintStatus();}
      /* Batch 6: armour tree regeneration (a_regen) */
      var _rg=espilTreeAlloc('a_regen');
      if(_rg>0&&skillState.hp>0&&skillState.hp<skillState.maxhp){skillState.hp=Math.min(skillState.maxhp,skillState.hp+.4*_rg*dt);paintStatus();}
      if(walkPlayer&&walkPlayer.guarding>0)walkPlayer.guarding-=dt;
      for(i=fxPool.length-1;i>=0;i--){
        var f=fxPool[i];f.t+=dt;var k=f.t/f.life;
        if(k>=1){
          /* Cited tool bursts where it lands. */
          if(f.proj)spawnFlash(f.mat.color,0,f.grp.position.x,f.grp.position.z,f.grp.position.y);
          mapScene.remove(f.grp);
          if(f.geo)f.geo.dispose();
          if(f.mat)f.mat.dispose();
          fxPool.splice(i,1);continue;
        }
        if(f.proj){f.grp.position.x+=f.proj.vx*dt;f.grp.position.z+=f.proj.vz*dt;}
        if(f.follow&&walkPlayer){f.grp.position.set(walkPlayer.pos.x,1.1,walkPlayer.pos.z);}
        var s=f.s0+(f.s1-f.s0)*k;
        if(f.sprite){f.sprite.scale.set(s,s,1);}else if(f.uniform){f.grp.scale.set(s,s,s);}else{f.grp.scale.set(s,1,s);}
        f.mat.opacity=f.o0*(1-k);
      }
    }
    function doMove(id){
      if(typeof espilKbFpvActive==='function'&&espilKbFpvActive())return; /* KONBINIYA FPV: attack inputs are inert inside (Han 2026-11-08) - every attack entry point funnels through here */
      if(window.__espilEntryMode==='shop')return; /* SHOP MODE (landing flow, Han 2026-11-09): combat inputs are disabled for the whole session - the last input path of MONOLITH-SEAM item 1 (monsters.js already gates spawns/targets/hits; the DOM buttons are inert there) */
      if(!cityPhaseActive||!walkPlayer||skillTreeOpen)return;
      if(espilDead)return; /* SURVIVAL S1: the death choice owns the body */
      var m=MOVES[id];
      if(!m)return;
      /* Batch 6 Item C: tree-gated skills stay shut until learned */
      if(id==='dash'&&!(skillState.alloc.m_dash>0)){ if(window.__espilToast)window.__espilToast('Dash Strike is learned in the skill tree (K).'); return; }
      if(id==='spin'&&!(skillState.alloc.m_spin>0)){ if(window.__espilToast)window.__espilToast('Spinning Strike is learned in the skill tree (K).'); return; }
      if(id==='wave'&&!(skillState.alloc.m_wave>0)){ if(window.__espilToast)window.__espilToast('Ranged Wave is learned in the skill tree (K).'); return; }
      if(id==='art'){
        var _fam=espilFamilyEquipped();
        if(!_fam||!(espilTreeAlloc(_fam+'_art')>0)){ if(window.__espilToast)window.__espilToast('Weapon Art unlocks in the weapon tree (K) for the equipped weapon family.'); return; }
      }
      if(skillState.cd[id]>0)return;
      var st=moveStats(id),p=walkPlayer;
      skillState.cd[id]=st.cd;
      /* Batch 6: Dash Strike first closes the gap (collision-grid
         steps), then the strike lands from the new spot. */
      if(m.dashMove){
        var dfx=-Math.sin(p.faceY), dfz=-Math.cos(p.faceY), dleft=st.range*.8;
        while(dleft>0){
          var step=Math.min(.3,dleft), nx=p.pos.x+dfx*step, nz=p.pos.z+dfz*step, blocked=false;
          try{ var pr=window.__espilCollisionProbe?window.__espilCollisionProbe(nx,nz):null; if(pr&&pr.blocked)blocked=true; }catch(e){}
          try{ if(!blocked&&espilPolyPointBlocked(nx,nz,p.pos.y))blocked=true; }catch(e){} /* COLLISION FIX (Han 2026-11-26, directive 7): the dash also consults the building records, not only the class grid */
          if(blocked)break;
          p.pos.x=nx; p.pos.z=nz; dleft-=step;
        }
      }
      /* Play attack animation (male_attack.glb) — replaces procedural lunge */
      if(p.av&&p.av.playOneShot)p.av.playOneShot('attack');
      p.lungeT=(id==='throw'?.16:(id==='defense'?.12:.22)); /* fallback procedural motion */
      if(m.guard){
        espilDefenseAt=espilGameT; /* SURVIVAL S1: perfect-window clock */
        spawnGuard(m,st.guardDur);
        skillSfx('guard');
      }else if(st.m.proj){
        spawnArc(st.m.color,2.2,st.m.arc,st.m.y,.2,.5,1.1);
        spawnFlash(st.m.color,1.5);
        spawnProjectile(st.m);
        skillSfx('whoosh-hi');
      }else{
        spawnArc(st.m.color,st.range,st.m.arc,st.m.y,.24,.55,1.15);
        spawnFlash(st.m.color,st.range*.6);
        if(id==='kick'){skillSfx('whoosh-lo');skillSfx('thud');}
        else{skillSfx('whoosh');}
      }
      /* Batch 6 FEEL: the new skills also stamp their range mesh -
         a ground disc fading through a 50% gradient to the edge. */
      if(id==='dash'||id==='spin'||id==='wave'||id==='art')spawnRangeMesh(st);
      if(!m.guard)espilApplyMoveHit(id,st); /* SURVIVAL S1: hits land */
      paintCooldowns();
    }
    /* ---- HUD ---- */
    function paintStatus(){
      var lv=document.getElementById('ms-lv');
      if(lv)lv.textContent='KEEPER';
      paintKnowledge();
      /* Han 2026-10-14: HP/MP render into the glass potion flasks (--p fill).
         HEAL FX (Han 2026-11-13): while a heal animation runs, the
         flasks render the animation's display value (smooth fill +
         tick-up number) - hard-capped at true state, so a mid-window
         hit is never masked. Inactive = true state, byte-identical. */
      var _hfx=(typeof espilHealDisp!=='undefined')?espilHealDisp:null;
      var hpShow=(_hfx&&_hfx.hp.active)?Math.min(_hfx.hp.val,skillState.hp):skillState.hp;
      var mpShow=(_hfx&&_hfx.mp.active)?Math.min(_hfx.mp.val,skillState.mp):skillState.mp;
      var hpP=Math.max(0,Math.min(100,100*hpShow/skillState.maxhp));
      var hw=document.getElementById('hp-water'),hs=document.getElementById('hp-swirl'),
          hpc=document.getElementById('hp-pct'),hfv=document.getElementById('hp-flask-val'),
          hwrap=document.getElementById('hp-flask-wrap');
      if(hw)hw.style.setProperty('--p',hpP);
      if(hs)hs.style.setProperty('--p',hpP);
      if(hpc)hpc.textContent=Math.round(hpP);
      if(hfv)hfv.textContent=Math.round(hpShow)+'/'+skillState.maxhp;
      if(hwrap)hwrap.classList.toggle('low',hpP<=25);
      var mpP=Math.max(0,Math.min(100,100*mpShow/skillState.maxmp));
      var mw=document.getElementById('mp-water'),ms=document.getElementById('mp-swirl'),
          mpc=document.getElementById('mp-pct'),mfv=document.getElementById('mp-flask-val');
      if(mw)mw.style.setProperty('--p',mpP);
      if(ms)ms.style.setProperty('--p',mpP);
      if(mpc)mpc.textContent=Math.round(mpP);
      if(mfv)mfv.textContent=Math.round(mpShow)+'/'+skillState.maxmp;
      var exp=document.getElementById('ms-exp'),expt=document.getElementById('ms-exp-t');
      var expPct=skillState.maxexp>0?100*skillState.exp/skillState.maxexp:0;
      if(exp)exp.style.width=expPct+'%';
      if(expt)expt.textContent=Math.round(expPct)+'%';
    }
    function paintKnowledge(){
      var kn=document.getElementById('ms-kn');
      if(kn)kn.textContent='📚 '+skillState.knowledge;
      var stk=document.getElementById('st-kn');
      if(stk)stk.textContent='📚 Knowledge: '+skillState.knowledge;
    }
    function paintMoveSlots(){
      SKILL_SLOTS.forEach(function(s){
        if(!s.move)return;
        var st=moveStats(s.move);
        var b=document.getElementById('slot-'+s.key);
        if(b)b.title=st.m.name+' ('+s.key.toUpperCase()+'): '+st.dmg+' dmg · '+st.range.toFixed(1)+'m · '+st.cd.toFixed(2)+'s — '+st.m.desc;
      });
    }
    function paintCooldowns(){
      MOVE_ORDER.forEach(function(id){
        var el=document.getElementById('move-cd-'+id);
        if(!el)return;
        var st=moveStats(id);
        var pct=st.cd>0?Math.max(0,Math.min(1,skillState.cd[id]/st.cd))*100:0;
        el.style.setProperty('--cdp',pct+'%');
      });
    }
    function raiseSkill(id){
      var n=skillNodeById(id);
      if(!n||n.locked||n.root)return;
      if(n.need&&totalSpent()<n.need){
        if(window.__espilToast)window.__espilToast('Requires '+n.need+' ranks learned first.');
        return;
      }
      if(n.needNode){
        var pr=skillState.alloc[n.needNode]||0,pn=skillNodeById(n.needNode);
        if(pr<(n.needRank||0)){
          if(window.__espilToast)window.__espilToast((pn?pn.name:'Previous skill')+' Lv '+(n.needRank||0)+' required first.');
          return;
        }
      }
      var rank=skillState.alloc[id]||0;
      if(rank>=n.max)return;
      var c=rankCost(rank);
      if(skillState.knowledge<c){
        if(window.__espilToast)window.__espilToast('Not enough Knowledge — watch videos to earn more.');
        return;
      }
      skillState.knowledge-=c;skillState.alloc[id]=rank+1;
      saveSkills();
      if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
      renderSkillTree();paintStatus();paintMoveSlots();
    }
    function statLine(n,rank){
      var id=n.id;
      if(id==='m_walk')return (7.5*(1+.015*rank)).toFixed(1)+' m/s walk speed';
      if(id==='m_run')return (12*(1+.02*rank)).toFixed(1)+' m/s run speed';
      if(id==='m_jump')return (9*(1+.01*rank)).toFixed(1)+' jump velocity';
      if(id==='m_djump')return (9*(1+.02*rank)).toFixed(1)+' double-jump velocity';
      if(id.indexOf('m_')===0){
        var mid=id.slice(2),s=moveStatsAt(mid,rank);
        if(MOVES[mid].guard)return s.guardDur.toFixed(2)+'s guard · '+s.cd.toFixed(2)+'s cd';
        return s.dmg+' dmg · '+s.range.toFixed(1)+'m · '+s.cd.toFixed(2)+'s';
      }
      if(id==='swift')return '+'+(5*rank)+'% attack speed';
      if(id==='reach')return '+'+(7*rank)+'% range';
      return '';
    }
    function renderSkillDesc(){
      var d=document.getElementById('st-desc');
      if(!d)return;
      if(selectedSkillId==='keeper'){
        d.innerHTML='<h3>The Keeper\'s Tree</h3>'+
          '<p>Every branch is a human skill — walking, running, jumping, fighting. '+
          'Watch videos to earn Knowledge, then grow each branch toward mastery.</p>'+
          '<p class="cur">Ranks learned: '+totalSpent()+'</p>';
        return;
      }
      var n=skillNodeById(selectedSkillId);
      if(!n){d.innerHTML='';return;}
      var rank=skillState.alloc[n.id]||0;
      if(n.locked){
        d.innerHTML='<h3>'+n.name+'</h3><p>'+n.desc+'</p><p class="cost">🔒 Locked</p>';
        return;
      }
      var maxed=rank>=n.max;
      d.innerHTML='<h3>'+n.name+'</h3><p>'+n.desc+'</p>'+
        '<p class="cur">Current Lv '+rank+': '+statLine(n,rank)+'</p>'+
        (maxed?'<p class="cost">MAX LEVEL</p>'
              :'<p class="nxt">Next Lv '+(rank+1)+': '+statLine(n,rank+1)+'</p>'+
               '<p class="cost">Cost: 📚 '+rankCost(rank)+'</p>');
    }
    function branchPath(NS,x1,y1,x2,y2,w,col){
      var mx=(x1+x2)/2,my=(y1+y2)/2;
      var dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
      var cx=mx-dy/len*len*.12,cy=my+dx/len*len*.12;
      var p=document.createElementNS(NS,'path');
      p.setAttribute('d','M'+x1+','+y1+' Q'+cx.toFixed(1)+','+cy.toFixed(1)+' '+x2+','+y2);
      p.setAttribute('stroke',col);p.setAttribute('stroke-width',w);
      p.setAttribute('fill','none');p.setAttribute('stroke-linecap','round');
      return p;
    }
    function renderSkillTree(){
      paintKnowledge();
      espilEnsureTreeTabs();
      if(espilTreeLayer!=='character'){ renderLayerTree(); return; }
      var tv=document.getElementById('st-treeview');
      if(tv){
        tv.innerHTML='';
        var NS='http://www.w3.org/2000/svg';
        var svg=document.createElementNS(NS,'svg');
        svg.setAttribute('viewBox','0 0 100 100');
        svg.setAttribute('preserveAspectRatio','none');
        svg.setAttribute('class','branches');
        /* trunk + roots */
        svg.appendChild(branchPath(NS,50,101,50,86,3.4,'#5a3d26'));
        svg.appendChild(branchPath(NS,50,95,43,101,1.6,'#5a3d26'));
        svg.appendChild(branchPath(NS,50,95,57,101,1.6,'#5a3d26'));
        var byId={};
        TREE_LAYOUT.forEach(function(L){byId[L.id]=L;});
        TREE_LAYOUT.forEach(function(L,li){
          if(L.parent&&byId[L.parent]){
            var P=byId[L.parent];
            svg.appendChild(branchPath(NS,P.x,P.y,L.x,L.y,1.3,'#6b4a2f'));
            /* leaves along the branch (deterministic scatter) */
            for(var k=1;k<=2;k++){
              var t=k/3,lx=P.x+(L.x-P.x)*t,ly=P.y+(L.y-P.y)*t;
              var lf=document.createElementNS(NS,'ellipse');
              lf.setAttribute('cx',(lx+((li*7+k*13)%5-2)*.9).toFixed(1));
              lf.setAttribute('cy',(ly+((li*11+k*7)%5-2)*.9).toFixed(1));
              lf.setAttribute('rx','1.8');lf.setAttribute('ry','1.1');
              lf.setAttribute('fill','#3f7d44');lf.setAttribute('opacity','.85');
              lf.setAttribute('transform','rotate('+((li*37+k*53)%60-30).toFixed(0)+' '+lx.toFixed(1)+' '+ly.toFixed(1)+')');
              svg.appendChild(lf);
            }
          }else if(!L.parent&&!L.root){
            /* locked bud: dashed stem */
            var st=document.createElementNS(NS,'line');
            st.setAttribute('x1',L.x);st.setAttribute('y1',L.y+11);
            st.setAttribute('x2',L.x);st.setAttribute('y2',L.y+2.5);
            st.setAttribute('stroke','#5a5a5a');st.setAttribute('stroke-width','1');
            st.setAttribute('stroke-dasharray','1.5 1.2');
            svg.appendChild(st);
          }
        });
        tv.appendChild(svg);
        TREE_LAYOUT.forEach(function(L){
          var isRoot=!!L.root;
          var n=isRoot?{id:'keeper',name:'KEEPER',root:true}:skillNodeById(L.id);
          if(!n)return;
          var rank=isRoot?0:(skillState.alloc[n.id]||0);
          var maxed=!isRoot&&!n.locked&&rank>=n.max;
          var ok=isRoot||prereqMet(n);
          var d=document.createElement('div');
          d.className='tnode'+(isRoot?' tnode-root':'')+(n.locked?' is-locked':'')+
            (maxed?' is-maxed':'')+((!isRoot&&!ok)?' is-dim':'')+
            (selectedSkillId===n.id?' is-selected':'');
          d.style.left=L.x+'%';d.style.top=L.y+'%';
          d.setAttribute('role','button');
          var icon=isRoot?null:pxIcon(n.art||n.id);
          var inner='<span class="tnode-icon">'+(icon?'<img alt="" src="'+icon+'">':'\uD83C\uDF33')+'</span>'+
            '<span class="tnode-name">'+n.name+'</span>';
          if(!isRoot){
            inner+='<span class="tnode-lv'+(maxed?' is-max':'')+'">'+
              (n.locked?'\uD83D\uDD12':(maxed?'MASTER':'Lv '+rank+'/'+n.max))+'</span>';
            if(!n.locked&&!maxed&&ok)
              inner+='<button type="button" class="tnode-plus" aria-label="Raise '+n.name+'">+</button>';
          }
          d.innerHTML=inner;
          d.addEventListener('click',function(e){
            var t=e&&e.target;
            var isPlus=t&&(t.className==='tnode-plus'||(t.classList&&typeof t.classList.contains==='function'&&t.classList.contains('tnode-plus')));
            if(isRoot){selectedSkillId='keeper';renderSkillTree();return;}
            if(isPlus){raiseSkill(n.id);return;}
            selectedSkillId=n.id;
            if(n.locked&&window.__espilToast)window.__espilToast(n.name+' arrives with the combat update.');
            else if(!ok&&window.__espilToast){
              var req=n.needNode?(skillNodeById(n.needNode).name+' Lv '+n.needRank):(n.need+' ranks learned');
              window.__espilToast('Requires '+req+' first.');
            }
            renderSkillTree();
          });
          tv.appendChild(d);
        });
      }
      renderSkillDesc();
    }
    var skillTreeOpen=false;
    function toggleSkillTree(force){
      var panel=document.getElementById('skill-tree');
      if(!panel)return;
      var open=typeof force==='boolean'?force:!skillTreeOpen;
      skillTreeOpen=open;
      panel.setAttribute('aria-hidden',String(!open));
      if(open){renderSkillTree();if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();}
    }
    /* QA #14 (UI room, 2026-10-06): I/M/H/P hotkeys. K already bound above. */
    var inventoryOpen=false,characterOpen=false;
    function toggleInventory(force){
      var panel=document.getElementById('inventory-panel');
      if(!panel)return;
      var open=typeof force==='boolean'?force:!inventoryOpen;
      inventoryOpen=open;
      panel.setAttribute('aria-hidden',String(!open));
      if(open&&window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
    }
    /* Character custom is OUT for now (Han 2026-10-18): the CHAR
       button renders deactivated and the panel cannot be opened
       (closing still works). Flip this one flag to bring it back. */
    var espilCharCustomOff=true;
    function toggleCharacterPanel(force){
      if(espilCharCustomOff&&force!==false)return;
      var panel=document.getElementById('character-panel');
      if(!panel)return;
      var open=typeof force==='boolean'?force:!characterOpen;
      characterOpen=open;
      panel.setAttribute('aria-hidden',String(!open));
      if(open&&window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
    }
    /* QA #18 (UI room, 2026-10-09): friends/party panel. Local only — sync needs server. (Key: U since 2026-10-19; Y is the stall.) */
    var friendsOpen=false;
    /* Han 2026-10-14: Settings panel — city selection lives in Options, with
       the current city as the default selected value. */
    var settingsOpen=false;
    /* ESC OPTIONS (Han 2026-11-25, Package E): the settings
       panel's auth row is state-aware. Signed in, it is the
       existing Log out (label from the language dictionary;
       social.js owns its click - server revoke + local record
       removal). As a guest it reads Log in and its click opens
       the auth surface in place (the settings wiring below
       intercepts the click before social.js's handler, which
       would otherwise only toast). Painted on every open, so the
       label always matches the session that opened the panel.
       The login label is not a dictionary key; the four strings
       follow the dictionary's own logout row. */
    var ESPIL_LOGIN_LABEL={ko:'로그인',en:'Log in',fr:'Se connecter',zh:'登录'};
    function espilPaintAuthRow(){
      var lo=document.getElementById('set-logout');
      if(!lo)return;
      var s=null;
      try{ s=JSON.parse(localStorage.getItem('espil_session_v1')||'null'); }catch(e){}
      if(s&&s.server&&s.id){
        lo.setAttribute('data-i18n','logout');
        lo.textContent=(window.__espilT?window.__espilT('logout'):'Log out');
      }else{
        lo.removeAttribute('data-i18n');
        var lg=(window.__espilLang?window.__espilLang():'en');
        lo.textContent=ESPIL_LOGIN_LABEL[lg]||ESPIL_LOGIN_LABEL.en;
      }
    }
    function toggleSettingsPanel(force){
      var panel=document.getElementById('settings-panel');
      if(!panel)return;
      var open=typeof force==='boolean'?force:!settingsOpen;
      settingsOpen=open;
      panel.classList.toggle('open',open);
      panel.setAttribute('aria-hidden',String(!open));
      if(open){
        espilPaintAuthRow();
        var sel=document.getElementById('opt-city');
        if(sel){
          if(!sel.children.length&&typeof markers!=='undefined'){
            markers.forEach(function(mk){
              var o=document.createElement('option');
              o.value=mk.userData.name;o.textContent=mk.userData.name;
              sel.appendChild(o);
            });
          }
          var cur=(typeof selected!=='undefined'&&selected&&selected.userData)?selected.userData.name:null;
          if(cur)sel.value=cur;
        }
      }
    }
    /* ESC OPTIONS (Han 2026-11-25, Package E): window.__espilOpenAuth
       is DEFINED here for the first time. entry-flow's login step
       and the landmark panel's account row already call it behind
       typeof guards and fell back to a notice / a direct modal
       flip; this is the in-place opening they meant. Presentation
       is the product's own signal pair - the same two writes
       openLoginGate and landing-auth's openModal make: flip
       #signin-modal's aria-hidden to 'false' (landing-auth
       mirrors the signal into #city-status.auth-open, which is
       what renders #signin-div, and entry-flow re-claims the auth
       zone on the same flip) and mark the readout gate-hidden.
       No gate is armed and no flow step is touched: social.js's
       completion hides the modal after a sign-in, and the modal's
       own close paths (the x button, ESC - both landing-auth's)
       unwind the pair. */
    window.__espilOpenAuth=function(){
      var m=document.getElementById('signin-modal');
      if(m)m.setAttribute('aria-hidden','false');
      var cs=document.getElementById('city-status');
      if(cs)cs.classList.add('gate-hidden');
    };
    /* Settings menu wiring (Han batch 5 #3, 2026-10-20): gear,
       Return to Earth, button settings (rebindable Jump / Interact /
       Stall, persisted), sound settings (music volume + mute,
       persisted and honoured by the theme fades), developer info.
       Log out stays disabled in the guest build. */
    var espilKeybinds={jump:'Shift',interact:' ',stall:'y'};
    try{ var _kb=JSON.parse(localStorage.getItem('espil_keybinds')||'null'); if(_kb&&_kb.jump&&_kb.interact&&_kb.stall)espilKeybinds=_kb; }catch(e){}
    window.__espilBgmVol=(function(){ var v=parseFloat(localStorage.getItem('espil_bgm_vol')); return isNaN(v)?0.5:Math.max(0,Math.min(1,v)); })();
    var espilKbArm=null;
    function espilKbLabel(k){ return k===' '?'Space':(k&&k.length===1?k.toUpperCase():k); }
    function espilKbPaint(){
      var j=document.getElementById('kb-jump'), i=document.getElementById('kb-interact'), s=document.getElementById('kb-stall');
      if(j)j.textContent=espilKbArm==='jump'?'Press a key...':espilKbLabel(espilKeybinds.jump);
      if(i)i.textContent=espilKbArm==='interact'?'Press a key...':espilKbLabel(espilKeybinds.interact);
      if(s)s.textContent=espilKbArm==='stall'?'Press a key...':espilKbLabel(espilKeybinds.stall);
    }
    document.addEventListener('keydown',function(e){
      if(!espilKbArm)return;
      e.preventDefault(); e.stopPropagation();
      if(e.key!=='Escape'){
        /* IME fix (2026-11-23): store the NORMALIZED key - a rebind
           armed in Hangul mode would otherwise persist the jamo
           itself as the binding and never match again. */
        var nk=window.__espilNormKey?window.__espilNormKey(e):e.key;
        espilKeybinds[espilKbArm]=(espilKbArm==='stall'&&nk.length===1)?nk.toLowerCase():nk;
        try{ localStorage.setItem('espil_keybinds',JSON.stringify(espilKeybinds)); }catch(err){}
      }
      espilKbArm=null; espilKbPaint();
    },true);
    function espilApplyBgmVol(){
      var v=window.__espilBgmVol;
      document.querySelectorAll('audio').forEach(function(a){ try{a.volume=v;}catch(e){} });
      var sl=document.getElementById('set-vol'); if(sl)sl.value=Math.round(v*100);
      var mu=document.getElementById('set-mute'); if(mu)mu.checked=(v===0);
    }
    (function(){
      var closeBtn=document.getElementById('set-close');
      if(closeBtn)closeBtn.addEventListener('click',function(){toggleSettingsPanel(false);});
      var sel=document.getElementById('opt-city');
      if(sel)sel.addEventListener('change',function(){
        var name=sel.value;
        toggleSettingsPanel(false);
        if(typeof markers==='undefined')return;
        for(var i=0;i<markers.length;i++){
          if(markers[i].userData.name===name){selectCity(markers[i]);break;}
        }
      });
      var gear=document.getElementById('city-settings');
      if(gear)gear.addEventListener('click',function(){ toggleSettingsPanel(); });
      var ret=document.getElementById('set-return');
      if(ret)ret.addEventListener('click',function(){ if(window.__ESPIL_GAME_PAGE){ location.href='index.html'; return; } toggleSettingsPanel(false); if(window.__espilInside)espilLeaveBuilding(); clearSelection(true); });
      /* ESC OPTIONS (Han 2026-11-25, Package E): the auth row's
         guest half. This listener is registered at parse, before
         social.js (a lazy module) binds its own #set-logout
         handler, so for a guest it can stand in front of that
         handler: the press opens the auth surface in place
         instead of ending in the 'Sign in first' toast. The
         session is re-read at click time; a signed-in press
         returns at once and social.js's handler runs the logout
         exactly as before. */
      var lo=document.getElementById('set-logout');
      if(lo)lo.addEventListener('click',function(e){
        var s=null;
        try{ s=JSON.parse(localStorage.getItem('espil_session_v1')||'null'); }catch(_){}
        if(s&&s.server&&s.id)return;
        e.preventDefault(); e.stopImmediatePropagation();
        toggleSettingsPanel(false);
        if(typeof window.__espilOpenAuth==='function')window.__espilOpenAuth();
      });
      [['kb-jump','jump'],['kb-interact','interact'],['kb-stall','stall']].forEach(function(pair){
        var b=document.getElementById(pair[0]);
        if(b)b.addEventListener('click',function(){ espilKbArm=pair[1]; espilKbPaint(); });
      });
      var rs=document.getElementById('kb-reset');
      if(rs)rs.addEventListener('click',function(){ espilKeybinds={jump:'Shift',interact:' ',stall:'y'}; try{localStorage.setItem('espil_keybinds',JSON.stringify(espilKeybinds));}catch(e){} espilKbArm=null; espilKbPaint(); });
      var sl=document.getElementById('set-vol');
      if(sl)sl.addEventListener('input',function(){ window.__espilBgmVol=sl.value/100; try{localStorage.setItem('espil_bgm_vol',String(window.__espilBgmVol));}catch(e){} espilApplyBgmVol(); });
      var mu=document.getElementById('set-mute');
      if(mu)mu.addEventListener('change',function(){
        if(mu.checked){ window.__espilBgmPrev=(window.__espilBgmVol>0?window.__espilBgmVol:0.5); window.__espilBgmVol=0; }
        else window.__espilBgmVol=(window.__espilBgmPrev!=null?window.__espilBgmPrev:0.5);
        try{localStorage.setItem('espil_bgm_vol',String(window.__espilBgmVol));}catch(e){}
        espilApplyBgmVol();
      });
      var dv=document.getElementById('set-devinfo-btn');
      if(dv)dv.addEventListener('click',function(){ var d=document.getElementById('set-devinfo'); if(d)d.style.display=(d.style.display==='none'?'block':'none'); });
      espilKbPaint(); espilApplyBgmVol();
    })();
    function toggleFriendsPanel(force){
      var panel=document.getElementById('friends-panel');
      if(!panel)return;
      var open=typeof force==='boolean'?force:!friendsOpen;
      friendsOpen=open;
      panel.setAttribute('aria-hidden',String(!open));
      if(open){
        var un=document.getElementById('friends-username');
        if(un){
          var name=null;
          try{name=localStorage.getItem('espil_username');}catch(_){}
          un.textContent='Your name: '+(name||'(set in character customization)');
        }
        if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
      }
    }
    /* Stall system Phase A (Han, 2026-10-19): Y opens your stall at
       your spot; friends/party moved to U. Postings are local
       signboards (팝니다/구합니다 free-text offers) persisted per
       city in localStorage, shaped like the future server schema -
       no fee field: trading is person-to-person on trust. Real
       settlement arrives with the server (Phase B). */
    var stallOpen=false,stallVisitor=false,stallGroup=null,stallSignMat=null;
    /* --- TIME STONE (Time Machine quest, joint production 2026-10-21):
       the gateway beat before Zealandia. CANON (Han, 2026-10-29;
       storyline v1 sections 1 and 12): the stone reveals itself ON
       THE WATER of Waitemata Harbour, offshore Auckland - the old
       downtown fall-point placement (10382, -1018, land) is
       replaced. World (10298, -1210): open harbour water, 208 m
       from the spawn, a straight swim north up the channel from
       the waterfront shore, 46 m clear of every wharf and
       footprint on all sides; surface Y resolves to 0 over water,
       so the stone stands on the sea and Lunaris keeps her place
       4.7 m south of it, on the water too.
       Wiring contract with the UI room: 'espil-arrival' (detail.city)
       is the Dive entry point; entering 3.2 m fires
       'espil-timemachine-near' once per approach (re-arms past 4.5 m);
       the interact key within the 2 m execution range fires
       'espil-timemachine-interact' and records the completion flag
       espil_timemachine_done. The crack reveal is the UI layer's. The
       final stone mesh comes from the Plushy pipeline; this standing
       placeholder keeps the portal's teal language. --- */
    var ESPIL_TIMESTONE={x:10298,z:-1210};
    window.__espilTimeStonePos={x:ESPIL_TIMESTONE.x,z:ESPIL_TIMESTONE.z};
    window.__espilTimeStoneFootprint={w:3.27,d:2.96}; /* real Meshy asset footprint (Marketing via Zealandia room, 2026-10-21) - the placeholder matches it 1:1 */
    var espilTimeStoneGroup=null, espilTimeStoneNear=false, espilTimeStoneArmed=true;
    window.__espilTimeStoneNear=false;
    function espilBuildTimeStone(){
      if(espilTimeStoneGroup||typeof mapScene==='undefined'||!mapScene)return;
      var y=0; try{ var sy=espilOwnSurfaceY(ESPIL_TIMESTONE.x,ESPIL_TIMESTONE.z); if(typeof sy==='number')y=sy; }catch(e){}
      var g=new THREE.Group();
      var stoneMat=new THREE.MeshLambertMaterial({color:0x0f3f3a,emissive:0x14e5c5,emissiveIntensity:0.85});
      var stone=new THREE.Mesh(new THREE.OctahedronGeometry(0.95),stoneMat);
      stone.position.set(0,1.5,0); stone.name='espilTimeStoneCore';
      g.add(stone);
      var base=new THREE.Mesh(new THREE.BoxGeometry(3.27,0.35,2.96),new THREE.MeshLambertMaterial({color:0x14332e,emissive:0x0b3d33,emissiveIntensity:0.5}));
      base.position.y=0.18; g.add(base); /* plinth at the real asset's 3.27 x 2.96 m footprint */
      var ringMat=new THREE.MeshBasicMaterial({color:0x14e5c5,transparent:true,opacity:0.55,side:THREE.DoubleSide});
      var ring=new THREE.Mesh(new THREE.RingGeometry(1.7,2.15,40),ringMat);
      ring.rotation.x=-Math.PI/2; ring.position.y=0.06; ring.scale.set(1.105,1,1); /* ellipse matching the footprint ratio */
      g.add(ring);
      var beamMat=new THREE.MeshBasicMaterial({color:0x9ff5e6,transparent:true,opacity:0.16,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
      var beam=new THREE.Mesh(new THREE.CylinderGeometry(0.5,1.5,60,12,1,true),beamMat);
      beam.position.y=30;
      g.add(beam);
      g.position.set(ESPIL_TIMESTONE.x,y,ESPIL_TIMESTONE.z);
      mapScene.add(g);
      espilTimeStoneGroup=g;
      window.__espilTimeStoneBuilt=true;
      window.__espilTimeStoneGroup=g;
    }
    setInterval(function(){
      if(!document.body.classList.contains('in-map'))return;
      if(!espilTimeStoneGroup){
        if(espilCityKey()==='auckland'&&typeof mapScene!=='undefined'&&mapScene)espilBuildTimeStone();
        return;
      }
      var core=espilTimeStoneGroup.getObjectByName?espilTimeStoneGroup.getObjectByName('espilTimeStoneCore'):null;
      if(core){ core.rotation.y+=0.02; core.position.y=1.5+Math.sin(performance.now()/700)*0.12; }
      var p=walkPlayer; if(!p||espilCityKey()!=='auckland')return;
      var d=Math.hypot(p.pos.x-ESPIL_TIMESTONE.x,p.pos.z-ESPIL_TIMESTONE.z);
      if(d<=3.2&&!espilTimeStoneNear){
        espilTimeStoneNear=true; window.__espilTimeStoneNear=true;
        if(espilTimeStoneArmed){ espilTimeStoneArmed=false;
          try{ window.dispatchEvent(new CustomEvent('espil-timemachine-near',{detail:{x:ESPIL_TIMESTONE.x,z:ESPIL_TIMESTONE.z}})); }catch(e){} }
      }else if(d>4.5&&espilTimeStoneNear){
        espilTimeStoneNear=false; window.__espilTimeStoneNear=false; espilTimeStoneArmed=true;
      }
    },150);
    function espilTimeStoneCollide(p){
      if(!p||espilCityKey()!=='auckland')return;
      var dx=p.pos.x-ESPIL_TIMESTONE.x, dz=p.pos.z-ESPIL_TIMESTONE.z;
      var d=Math.hypot(dx,dz), min=2.2; /* footprint half-width 1.64 + player radius 0.55, rounded */
      if(d>0.001&&d<min){ p.pos.x=ESPIL_TIMESTONE.x+dx/d*min; p.pos.z=ESPIL_TIMESTONE.z+dz/d*min; }
    }
    document.addEventListener('keydown',function(e){
      if(e.repeat)return;
      if(!document.body.classList.contains('in-map'))return;
      var ae=document.activeElement,at=(ae&&ae.tagName)||'';
      if(/INPUT|TEXTAREA|SELECT/.test(at))return;
      var binds={}; try{ binds=JSON.parse(localStorage.getItem('espil_keybinds')||'{}'); }catch(_){}
      if((window.__espilNormKey?window.__espilNormKey(e):e.key)!==(binds.interact||' '))return; /* IME fix: the interact binding may be a letter */
      if(espilCityKey()!=='auckland'||!espilTimeStoneGroup)return;
      var p=walkPlayer; if(!p)return;
      if(Math.hypot(p.pos.x-ESPIL_TIMESTONE.x,p.pos.z-ESPIL_TIMESTONE.z)>3)return; /* execution range 3 m from centre (confirmed standard, Zealandia room 2026-10-21): the real footprint blocks approach at ~2.2 m */
      try{ localStorage.setItem('espil_timemachine_done','1'); }catch(_){}
      window.__espilTimeStoneDone=true;
      try{ window.dispatchEvent(new CustomEvent('espil-timemachine-interact',{detail:{x:ESPIL_TIMESTONE.x,z:ESPIL_TIMESTONE.z}})); }catch(_){}
    });
    /* --- AUCKLAND TIME STONE SCENE + WEB JOURNEY END (Han, 2026-10-23):
       (1) Entering Auckland plays the Time Machine cinematic until the
       Time Stone interact completes (espil_timemachine_done); after
       that it never replays. Skip is always offered and the player is
       pinned while it plays. (2) The Time Stone and Lunaris stand in
       Auckland as real 3D assets (the app payload's optimized GLBs) -
       the only placed 3D assets on the web. The stone GLB replaces the
       placeholder core and plinth inside the same group, so footprint,
       collision and events are unchanged; Lunaris stands 4.7 m south
       of the stone on her Idle loop, with a TimeCast every third
       cycle. (3) The web journey ENDS at the stone: the interact plays
       the crack reveal and opens the app guidance panel - Zealandia
       opens in the Espil Online app, never on the web. --- */
    var ESPIL_AUCK_STR={
      en:{skip:'Skip',play:'Play',cineTitle:'The Time Stone - Auckland',panelTitle:'The stone has spoken',panelBody:'The web journey ends here. Beyond this stone lies Zealandia - and Zealandia opens in the Espil Online app. Download the app, and the world past the stone begins.',close:'Close',nearHint:'Press Space - touch the Time Stone'},
      ko:{skip:'건너뛰기',play:'재생',cineTitle:'타임 스톤 - Auckland',panelTitle:'타임 스톤이 응답했습니다',panelBody:'웹에서의 여정은 여기까지입니다. 이 돌 너머에는 Zealandia가 있습니다. Zealandia는 Espil Online 앱에서 열립니다. 앱을 다운로드하시면 돌 너머의 세계가 시작됩니다.',close:'닫기',nearHint:'Space - 타임 스톤을 만지세요'},
      fr:{skip:'Passer',play:'Lire',cineTitle:'La Pierre du Temps - Auckland',panelTitle:'La pierre a parlé',panelBody:'Le voyage sur le web se termine ici. Au-delà de cette pierre se trouve Zealandia - et Zealandia s\'ouvre dans l\'application Espil Online. Téléchargez l\'application, et le monde au-delà de la pierre commence.',close:'Fermer',nearHint:'Espace - touchez la Pierre du Temps'},
      zh:{skip:'跳过',play:'播放',cineTitle:'时间之石 - Auckland',panelTitle:'时间之石已回应',panelBody:'网页之旅到此结束。这块石头之外是 Zealandia,而 Zealandia 在 Espil Online 应用中开启。下载应用,石头之外的世界就此开始。',close:'关闭',nearHint:'按空格 - 触摸时间之石'}
    };
    function espilAuckT(k){ var c='en'; try{ c=window.__espilLang()||'en'; }catch(e){} var l=ESPIL_AUCK_STR[c]||ESPIL_AUCK_STR.en; return l[k]||ESPIL_AUCK_STR.en[k]||k; }
    (function(){
      var st=document.createElement('style'); st.id='espil-auck-style';
      st.textContent='#espil-cine{position:fixed;inset:0;background:#000;z-index:100002;display:none;align-items:center;justify-content:center}'
      +'#espil-cine.show{display:flex}#espil-cine video{width:100%;height:100%;object-fit:contain;background:#000}'
      +'#espil-cine-title{position:absolute;left:22px;bottom:20px;color:#dff7f2;font:600 13px/1.4 "Avenir Next","Segoe UI",sans-serif;letter-spacing:.14em;text-transform:uppercase;opacity:.85}'
      +'#espil-cine-skip{position:absolute;right:22px;bottom:18px;padding:9px 18px;border-radius:999px;border:1px solid rgba(142,247,232,.55);background:rgba(10,16,22,.72);color:#eaf6ff;font:600 13.5px "Avenir Next","Segoe UI",sans-serif;cursor:pointer}'
      +'#espil-cine-skip:hover{background:rgba(20,40,44,.85)}'
      +'#espil-cine-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;padding:14px 30px;border-radius:999px;border:1px solid rgba(142,247,232,.7);background:rgba(10,16,22,.8);color:#eaf6ff;font:700 16px "Avenir Next","Segoe UI",sans-serif;cursor:pointer}'
      +'#espil-cine-play.show{display:block}'
      +'#espil-crack{position:fixed;inset:0;z-index:100003;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 50% 46%,rgba(210,255,246,.5),rgba(20,229,197,.12) 42%,transparent 68%)}'
      +'#espil-crack.show{animation:espilCrackIn 1.15s ease-out forwards}'
      +'#espil-crack svg{width:100%;height:100%;filter:drop-shadow(0 0 7px rgba(20,229,197,.95))}'
      +'@keyframes espilCrackIn{0%{opacity:0}12%{opacity:1}70%{opacity:1}100%{opacity:0}}'
      +'#espil-app-panel{position:fixed;inset:0;z-index:100004;display:none;align-items:center;justify-content:center;background:rgba(4,8,12,.45)}'
      +'#espil-app-panel.show{display:flex}'
      +'#espil-app-card{max-width:430px;width:calc(100% - 44px);background:rgba(13,19,27,.96);border:1px solid rgba(20,229,197,.4);border-radius:16px;padding:26px 26px 22px;color:#eaf6ff;box-shadow:0 24px 70px rgba(0,0,0,.55)}'
      +'#espil-app-title{font:700 20px/1.3 "Avenir Next","Segoe UI",sans-serif;margin-bottom:10px}'
      +'#espil-app-body{font:400 14.5px/1.65 "Avenir Next","Segoe UI",sans-serif;color:#cfd8e3}'
      +'#espil-app-chip{display:inline-block;margin-top:15px;padding:8px 13px;border-radius:10px;background:rgba(20,229,197,.12);color:#8ef7e8;font:700 13.5px "Avenir Next","Segoe UI",sans-serif}'
      +'#espil-app-close{display:block;width:100%;margin-top:18px;padding:11px 0;border-radius:11px;border:1px solid rgba(142,247,232,.5);background:rgba(20,229,197,.14);color:#eaf6ff;font:700 14px "Avenir Next","Segoe UI",sans-serif;cursor:pointer}';
      document.head.appendChild(st);
    })();
    /* (1) cinematic on Auckland entry */
    var espilCineShown=false, espilCinePlaying=false, espilCinePin=null, espilCinePinTimer=null;
    function espilCineBuild(){
      if(document.getElementById('espil-cine'))return;
      var wrap=document.createElement('div'); wrap.id='espil-cine';
      wrap.innerHTML='<video id="espil-cine-video" playsinline muted preload="none"><source src="assets/cinematic/timemachine.webm" type="video/webm"><source src="assets/cinematic/timemachine.mp4" type="video/mp4"></video><div id="espil-cine-title"></div><button id="espil-cine-skip" type="button"></button><button id="espil-cine-play" type="button"></button>';
      document.body.appendChild(wrap);
      document.getElementById('espil-cine-skip').addEventListener('click',espilCineStop);
      var v=document.getElementById('espil-cine-video');
      v.addEventListener('ended',espilCineStop);
      v.addEventListener('error',function(){ if(v.error)espilCineStop(); });
      document.getElementById('espil-cine-play').addEventListener('click',function(){ this.classList.remove('show'); try{ v.play(); }catch(e){} });
    }
    function espilCinePlay(){
      if(espilCineShown||espilCinePlaying)return;
      var done=false; try{ done=localStorage.getItem('espil_timemachine_done')==='1'; }catch(e){}
      if(done)return;
      espilCineBuild(); espilCineShown=true; espilCinePlaying=true; window.__espilCinematicPlaying=true;
      document.getElementById('espil-cine-title').textContent=espilAuckT('cineTitle');
      document.getElementById('espil-cine-skip').textContent=espilAuckT('skip');
      document.getElementById('espil-cine').classList.add('show');
      var p=walkPlayer; espilCinePin=(p&&p.pos)?{x:p.pos.x,z:p.pos.z}:null;
      espilCinePinTimer=setInterval(function(){ var q=walkPlayer; if(q&&q.pos&&espilCinePin){ q.pos.x=espilCinePin.x; q.pos.z=espilCinePin.z; } },100);
      var v=document.getElementById('espil-cine-video');
      var pb=document.getElementById('espil-cine-play'); pb.textContent='\u25B6 ' + espilAuckT('play'); pb.classList.remove('show');
      try{ var pr=v.play(); if(pr&&pr.catch)pr.catch(function(){ pb.classList.add('show'); }); }catch(e){ pb.classList.add('show'); }
      setTimeout(function(){ if(!espilCinePlaying)return; if(v.error){ espilCineStop(); return; } if(v.paused&&v.currentTime===0)pb.classList.add('show'); },25000);
    }
    function espilCineStop(){
      if(!espilCinePlaying)return;
      espilCinePlaying=false; window.__espilCinematicPlaying=false; window.__espilCinematicDone=true;
      var wrap=document.getElementById('espil-cine'); if(wrap)wrap.classList.remove('show');
      var v=document.getElementById('espil-cine-video'); if(v){ try{ v.pause(); }catch(e){} }
      if(espilCinePinTimer){ clearInterval(espilCinePinTimer); espilCinePinTimer=null; }
    }
    window.addEventListener('espil-arrival',function(e){ if(e&&e.detail&&e.detail.city==='auckland')espilCinePlay(); });
    (function(){ var n=0; var iv=setInterval(function(){ n++; var la=window.__espilLastArrival; if(la&&la.city==='auckland'){ espilCinePlay(); clearInterval(iv); } if(n>40)clearInterval(iv); },500); })();
    /* (2) the stone GLB and Lunaris */
    var espilStoneGlbBusy=false, espilLunarisBusy=false, espilLunarisState=null, espilLunarisCycle=0;
    function espilAuckLoader(){ var l=new THREE.GLTFLoader(); try{ if(window.MeshoptDecoder)l.setMeshoptDecoder(window.MeshoptDecoder); }catch(e){} return l; }
    function espilFitHeight(obj,h){ var b=new THREE.Box3().setFromObject(obj); var s=b.max.y-b.min.y; if(s>0)obj.scale.setScalar(h/s); var b2=new THREE.Box3().setFromObject(obj); obj.position.y-=b2.min.y; }
    function espilFitSkinnedHeight(obj,h){ obj.updateMatrixWorld(true); var mn=Infinity,mx=-Infinity,v=new THREE.Vector3(); obj.traverse(function(n){ if(n.isBone){ n.getWorldPosition(v); if(v.y<mn)mn=v.y; if(v.y>mx)mx=v.y; } }); var s=mx-mn; if(s>0&&isFinite(s))obj.scale.setScalar(h/s); }
    function espilNoCull(obj){ obj.traverse(function(n){ if(n.isMesh||n.isSkinnedMesh)n.frustumCulled=false; }); }
    function espilBuildStoneGlb(){
      if(espilStoneGlbBusy||window.__espilTimeStoneGlb||!espilTimeStoneGroup)return;
      espilStoneGlbBusy=true;
      espilAuckLoader().load('assets/zealandia/timestone.glb',function(gltf){
        var obj=gltf.scene; espilNoCull(obj); espilFitHeight(obj,5.52);
        espilTimeStoneGroup.children.slice().forEach(function(ch){ if(ch.name==='espilTimeStoneCore'||(ch.geometry&&ch.geometry.type==='BoxGeometry'))ch.visible=false; });
        espilTimeStoneGroup.add(obj);
        window.__espilTimeStoneGlb=true; window.__espilTimeStoneGlbObj=obj;
      },undefined,function(){ espilStoneGlbBusy=false; });
    }
    function espilBuildLunaris(){
      if(espilLunarisBusy||espilLunarisState||espilCityKey()!=='auckland'||typeof mapScene==='undefined'||!mapScene)return;
      espilLunarisBusy=true;
      espilAuckLoader().load('assets/zealandia/lunaris.glb',function(gltf){
        var obj=gltf.scene; espilNoCull(obj); espilFitSkinnedHeight(obj,1.8);
        var x=ESPIL_TIMESTONE.x, z=ESPIL_TIMESTONE.z+4.7;
        var y=0; try{ var sy=espilOwnSurfaceY(x,z); if(typeof sy==='number')y=sy; }catch(e){}
        obj.position.set(x,y,z); obj.lookAt(ESPIL_TIMESTONE.x,y,ESPIL_TIMESTONE.z);
        mapScene.add(obj);
        var mixer=new THREE.AnimationMixer(obj); var acts={};
        (gltf.animations||[]).forEach(function(clip){ acts[clip.name]=mixer.clipAction(clip); });
        espilLunarisState={obj:obj,mixer:mixer,acts:acts};
        if(acts.Idle){ acts.Idle.play(); }
        window.__espilLunarisBuilt=true; window.__espilLunarisPos={x:x,z:z}; window.__espilLunarisState=espilLunarisState;
        var clock=new THREE.Clock();
        (function tick(){ requestAnimationFrame(tick); if(espilLunarisState&&espilLunarisState.mixer)espilLunarisState.mixer.update(Math.min(clock.getDelta(),0.1)); })();
        setInterval(function(){
          if(!espilLunarisState||!espilLunarisState.acts.TimeCast||!espilLunarisState.acts.Idle)return;
          espilLunarisCycle++;
          if(espilLunarisCycle%3!==0)return;
          var tc=espilLunarisState.acts.TimeCast, id=espilLunarisState.acts.Idle;
          tc.reset(); tc.setLoop(THREE.LoopOnce,1); tc.clampWhenFinished=true; tc.fadeIn(0.3); tc.play(); id.fadeOut(0.3);
          setTimeout(function(){ if(!espilLunarisState)return; tc.fadeOut(0.3); id.reset().fadeIn(0.3).play(); },(tc.getClip().duration||3)*1000);
        },12000);
      },undefined,function(){ espilLunarisBusy=false; });
    }
    setInterval(function(){
      if(!document.body.classList.contains('in-map'))return;
      if(espilCityKey()!=='auckland')return;
      espilBuildStoneGlb(); espilBuildLunaris();
    },800);
    /* (3) crack reveal + app guidance panel: the web journey ends here */
    function espilCrackBuild(){
      if(document.getElementById('espil-crack'))return;
      var d=document.createElement('div'); d.id='espil-crack';
      d.innerHTML='<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice"><g stroke="#cffff5" stroke-width="3" fill="none" stroke-linejoin="round"><path d="M512,0 L496,96 L518,168 L488,262 L516,344 L492,452 L520,548 L504,700"/><path d="M516,344 L612,392 L668,378"/><path d="M488,262 L392,300 L344,286"/><path d="M492,452 L420,520 L428,586"/><path d="M518,168 L596,214 L652,204"/><path d="M516,344 L452,420 L462,486"/></g></svg>';
      document.body.appendChild(d);
      var p=document.createElement('div'); p.id='espil-app-panel';
      p.innerHTML='<div id="espil-app-card"><div id="espil-app-title"></div><div id="espil-app-body"></div><span id="espil-app-chip">Espil Online: A to Zealandia</span><button id="espil-app-close" type="button"></button></div>';
      document.body.appendChild(p);
      document.getElementById('espil-app-close').addEventListener('click',function(){ p.classList.remove('show'); window.__espilAppPanelOpen=false; });
    }
    window.addEventListener('espil-timemachine-near',function(){ try{ if(window.__espilToast)window.__espilToast(espilAuckT('nearHint')); }catch(e){} });
    window.addEventListener('espil-timemachine-interact',function(){
      espilCineStop();
      espilCrackBuild();
      var c=document.getElementById('espil-crack');
      c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); window.__espilCrackShown=true;
      setTimeout(function(){
        document.getElementById('espil-app-title').textContent=espilAuckT('panelTitle');
        document.getElementById('espil-app-body').textContent=espilAuckT('panelBody');
        document.getElementById('espil-app-close').textContent=espilAuckT('close');
        document.getElementById('espil-app-panel').classList.add('show'); window.__espilAppPanelOpen=true;
      },520);
      try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'timemachine-end'}})); }catch(e){}
    });
    /* --- NAV PATH (guide step 8, joint production 2026-10-21): a
       glowing green route on the ground from the player to a target,
       routed over the city's own walkable class grid (A* on the 2 m
       collision classes, then line-of-sight smoothing), with flow
       discs running toward a ring-and-beam destination marker.
       First target: Konbiniya Japan Centre, 1238 Robson St.
       Pin per Han's Google Maps link (2026-10-27): 49.2864265,
       -123.1279181; anchor-converted point (-524.2, -414.8) sits
       inside its footprint (collision-probe verified), so the route
       ends at that pin's nearest walkable street point below,
       (-518.2, -414.8) - the nav system's own snap, read live.
       Contract with the UI room:
       window.__espilNavShow({x,z,name}) / __espilNavToKonbiniya() /
       __espilNavHide(); arrival within 5 m fires espil-guide
       {type:'nav-arrived', name} once per showing. --- */
    var ESPIL_KONBINIYA={x:-518.2,z:-414.8};
    window.__espilKonbiniyaPos={x:ESPIL_KONBINIYA.x,z:ESPIL_KONBINIYA.z};
    /* Batch D8 (Han 2026-11-03): the Konbiniya building GLOWS - a
       permanent vertical light pillar rises from it, with a warm
       pool of light at its base, so the store reads as a light
       source and can be found from far away. Additive materials
       with depth-write off and fog off (so distance does not dim
       the beam); the only ongoing cost is a slow opacity pulse on
       a 150 ms interval. */
    var espilKbGlow=null;
    window.__espilKbGlowState=function(){ return { built: !!espilKbGlow, x: ESPIL_KONBINIYA.x, z: ESPIL_KONBINIYA.z, parts: espilKbGlow ? espilKbGlow.group.children.map(function(m){ return Math.round(m.material.opacity*100)/100; }) : [] }; };
    (function espilKbGlowInit(){
      function build(){
        if(espilKbGlow) return true;
        var sc=(typeof mapScene!=='undefined'&&mapScene)?mapScene:null;
        if(!sc||typeof THREE==='undefined') return false;
        var g=new THREE.Group();
        var cv=document.createElement('canvas'); cv.width=cv.height=128;
        var cx2=cv.getContext('2d');
        var gr=cx2.createRadialGradient(64,64,2,64,64,64);
        gr.addColorStop(0,'rgba(255,236,170,0.9)'); gr.addColorStop(0.4,'rgba(255,205,92,0.35)'); gr.addColorStop(1,'rgba(255,190,60,0)');
        cx2.fillStyle=gr; cx2.fillRect(0,0,128,128);
        var base=new THREE.Mesh(new THREE.PlaneGeometry(46,46),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
        base.rotation.x=-Math.PI/2; base.position.set(ESPIL_KONBINIYA.x,0.25,ESPIL_KONBINIYA.z); base.renderOrder=3;
        g.add(base);
        function beam(rTop,rBot,op){
          var m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBot,110,20,1,true),new THREE.MeshBasicMaterial({color:0xffdf8e,transparent:true,opacity:op,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false,fog:false}));
          m.position.set(ESPIL_KONBINIYA.x,55,ESPIL_KONBINIYA.z); m.renderOrder=3; return m;
        }
        g.add(beam(4.5,7,0.10)); g.add(beam(2,3.4,0.16));
        sc.add(g);
        espilKbGlow={group:g,base:base};
        return true;
      }
      var tries=0;
      var iv=setInterval(function(){
        if(!espilKbGlow){
          if(build()){ /* built - fall through to the pulse */ }
          else if(++tries>240){ clearInterval(iv); return; }
          else return;
        }
        var s=0.5+0.5*Math.sin(Date.now()/1400);
        espilKbGlow.group.children.forEach(function(m,i){ if(i===1)m.material.opacity=0.08+0.05*s; if(i===2)m.material.opacity=0.13+0.06*s; });
        espilKbGlow.base.material.opacity=0.45+0.18*s;
      },150);
    })();
    /* Batch 5 (Han 2026-11-07): entrance glow for EVERY enterable
       building, same treatment as the Konbiniya's. One reusable
       marker (light pool + beam, the Konbiniya glow's construction
       at a smaller scale) follows the ground anchor of the nearest
       label-carrying record within the label radius, so a player
       can see which buildings open before reaching the Use point.
       The Konbiniya keeps its own permanent glow - the marker
       hides when the nearest anchor is the Konbiniya's, and while
       the player is inside. */
    var espilEntryGlow=null, espilEntryGlowName=null;
    window.__espilEntryGlowState=function(){
      return { built: !!espilEntryGlow,
        visible: !!(espilEntryGlow&&espilEntryGlow.group.visible),
        x: espilEntryGlow?Math.round(espilEntryGlow.group.position.x*10)/10:null,
        z: espilEntryGlow?Math.round(espilEntryGlow.group.position.z*10)/10:null,
        name: espilEntryGlowName };
    };
    (function espilEntryGlowInit(){
      function build(){
        if(espilEntryGlow) return true;
        var sc=(typeof mapScene!=='undefined'&&mapScene)?mapScene:null;
        if(!sc||typeof THREE==='undefined') return false;
        var g=new THREE.Group();
        var cv=document.createElement('canvas'); cv.width=cv.height=128;
        var cx2=cv.getContext('2d');
        var gr=cx2.createRadialGradient(64,64,2,64,64,64);
        gr.addColorStop(0,'rgba(255,236,170,0.9)'); gr.addColorStop(0.4,'rgba(255,205,92,0.35)'); gr.addColorStop(1,'rgba(255,190,60,0)');
        cx2.fillStyle=gr; cx2.fillRect(0,0,128,128);
        var base=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
        base.rotation.x=-Math.PI/2; base.position.set(0,0.25,0); base.renderOrder=3;
        g.add(base);
        function beam(rTop,rBot,op){
          var m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBot,80,20,1,true),new THREE.MeshBasicMaterial({color:0xffdf8e,transparent:true,opacity:op,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false,fog:false}));
          m.position.set(0,40,0); m.renderOrder=3; return m;
        }
        g.add(beam(3,4.6,0.10)); g.add(beam(1.3,2.2,0.16));
        g.visible=false;
        sc.add(g);
        espilEntryGlow={group:g,base:base};
        return true;
      }
      var tries=0;
      setInterval(function(){
        if(!espilEntryGlow){
          if(build()){ /* fall through */ }
          else if(++tries>240){ return; }
          else return;
        }
        var show=false, ax=0, az=0, nm=null;
        try{
          if(document.body.classList.contains('in-map')&&!window.__espilInside&&typeof walkPlayer!=='undefined'&&walkPlayer&&espilPolyHash){
            var recs=espilCollectRecsNear(walkPlayer.pos.x,walkPlayer.pos.z,ESPIL_LABEL_RADIUS);
            var bestD=1e9;
            for(var i=0;i<recs.length;i++){
              var rec=recs[i];
              espilLabelResolveName(rec);
              if(!rec._espilLblName)continue;
              if(espilVillageActive()){ espilMarkResolve(rec); if(!espilMarkMarked(rec))continue; } /* entrants: the glow follows the marked set; accounts unchanged */
              var a=espilLabelAnchor(rec);
              var d=Math.hypot(walkPlayer.pos.x-a.x,walkPlayer.pos.z-a.z);
              if(d<bestD){bestD=d;ax=a.x;az=a.z;nm=rec._espilLblName;}
            }
            /* the Konbiniya's own glow covers its entrance */
            if(nm&&Math.hypot(ax-ESPIL_KONBINIYA.x,az-ESPIL_KONBINIYA.z)<40){ nm=null; }
            show=!!nm;
          }
        }catch(e){ show=false; }
        espilEntryGlow.group.visible=show;
        espilEntryGlowName=show?nm:null;
        if(show){
          espilEntryGlow.group.position.set(ax,0,az);
          var s=0.5+0.5*Math.sin(Date.now()/1400);
          espilEntryGlow.group.children.forEach(function(m,i){ if(i===1)m.material.opacity=0.08+0.05*s; if(i===2)m.material.opacity=0.13+0.06*s; });
          espilEntryGlow.base.material.opacity=0.45+0.18*s;
        }
      },300);
    })();
    var espilNavGroup=null, espilNavPath=null, espilNavPathCum=null, espilNavPathTotal=0, espilNavTarget=null, espilNavFlow=[], espilNavFlowT=0, espilNavArrived=false, espilNavArrivedAt=0, espilNavLastRoute=0;
    function espilNavWalkable(x,z){ var pr=window.__espilCollisionProbe?window.__espilCollisionProbe(x,z):null; return !!(pr&&pr.walkable); }
    function espilNavSnap(x,z){ if(espilNavWalkable(x,z))return {x:x,z:z};
      for(var r=2;r<=30;r+=2)for(var a=0;a<8;a++){ var nx=x+Math.cos(a*Math.PI/4)*r, nz=z+Math.sin(a*Math.PI/4)*r; if(espilNavWalkable(nx,nz))return {x:nx,z:nz}; }
      return null; }
    function espilNavLos(x1,z1,x2,z2){ var d=Math.hypot(x2-x1,z2-z1), n=Math.max(1,Math.ceil(d));
      for(var i=1;i<n;i++){ if(!espilNavWalkable(x1+(x2-x1)*i/n,z1+(z2-z1)*i/n))return false; } return true; }
    function espilNavRoute(sx,sz,tx,tz){
      var CELL=2, minx=Math.min(sx,tx)-80, maxx=Math.max(sx,tx)+80, minz=Math.min(sz,tz)-80, maxz=Math.max(sz,tz)+80;
      var W=Math.ceil((maxx-minx)/CELL), H=Math.ceil((maxz-minz)/CELL);
      if(W*H>400000)return null;
      var cost=new Float32Array(W*H).fill(-1), from=new Int32Array(W*H).fill(-1), closed=new Uint8Array(W*H);
      function cwalk(ix,iz){ if(ix<0||iz<0||ix>=W||iz>=H)return false; return espilNavWalkable(minx+(ix+0.5)*CELL,minz+(iz+0.5)*CELL); }
      var six=Math.max(0,Math.min(W-1,Math.round((sx-minx)/CELL-0.5))), siz=Math.max(0,Math.min(H-1,Math.round((sz-minz)/CELL-0.5)));
      var tix=Math.max(0,Math.min(W-1,Math.round((tx-minx)/CELL-0.5))), tiz=Math.max(0,Math.min(H-1,Math.round((tz-minz)/CELL-0.5)));
      var heap=[];
      function hpush(node,f){ heap.push([node,f]); var i=heap.length-1; while(i>0){ var par=(i-1)>>1; if(heap[par][1]<=heap[i][1])break; var t=heap[par]; heap[par]=heap[i]; heap[i]=t; i=par; } }
      function hpop(){ var top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; var i=0; for(;;){ var l=2*i+1, r=l+1, m=i; if(l<heap.length&&heap[l][1]<heap[m][1])m=l; if(r<heap.length&&heap[r][1]<heap[m][1])m=r; if(m===i)break; var t=heap[m]; heap[m]=heap[i]; heap[i]=t; i=m; } } return top; }
      var start=siz*W+six, goal=tiz*W+tix; cost[start]=0; hpush(start,0);
      var DIRS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
      var found=false;
      while(heap.length){ var cur=hpop()[0]; if(closed[cur])continue; closed[cur]=1; if(cur===goal){ found=true; break; }
        var cx=cur%W, cz=(cur/W)|0;
        for(var di=0;di<8;di++){ var nx=cx+DIRS[di][0], nz=cz+DIRS[di][1]; if(!cwalk(nx,nz))continue;
          if(DIRS[di][0]&&DIRS[di][1]&&(!cwalk(cx+DIRS[di][0],cz)||!cwalk(cx,cz+DIRS[di][1])))continue;
          var ni=nz*W+nx, nc=cost[cur]+DIRS[di][2];
          if(cost[ni]<0||nc<cost[ni]){ cost[ni]=nc; from[ni]=cur; hpush(ni,nc+Math.hypot(nx-tix,nz-tiz)); } } }
      if(!found)return null;
      var cells=[], cur2=goal;
      while(cur2>=0){ cells.push({x:minx+(cur2%W+0.5)*CELL, z:minz+(((cur2/W)|0)+0.5)*CELL}); if(cur2===start)break; cur2=from[cur2]; }
      cells.reverse(); cells[0]={x:sx,z:sz}; cells[cells.length-1]={x:tx,z:tz};
      var out=[cells[0]], anch=0;
      for(var i=2;i<cells.length;i++){ if(!espilNavLos(cells[anch].x,cells[anch].z,cells[i].x,cells[i].z)){ out.push(cells[i-1]); anch=i-1; } }
      out.push(cells[cells.length-1]);
      return out;
    }
    function espilNavClear(){ if(espilNavGroup){ try{ mapScene.remove(espilNavGroup); }catch(e){} espilNavGroup=null; }
      espilNavPath=null; espilNavTarget=null; espilNavFlow=[]; window.__espilNavActive=false; window.__espilNavTarget=null; }
    function espilNavShow(target){
      var p=walkPlayer; if(!p||!target||typeof mapScene==='undefined'||!mapScene)return false;
      var s=espilNavSnap(p.pos.x,p.pos.z), t=espilNavSnap(target.x,target.z);
      if(!s||!t)return false;
      var path=espilNavRoute(s.x,s.z,t.x,t.z); if(!path||path.length<2)return false;
      espilNavClear();
      espilNavTarget={x:t.x,z:t.z,name:target.name||''}; espilNavPath=path; espilNavArrived=false; espilNavLastRoute=performance.now();
      var cum=[0]; for(var i=1;i<path.length;i++)cum.push(cum[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z));
      espilNavPathCum=cum; espilNavPathTotal=cum[cum.length-1];
      /* NAV VISUALS OFF (Han 2026-10-31 - compass replacement, UI room):
         the floor ribbon, flow discs, arrival ring and light pillar are
         no longer rendered. Target state, route length, nav-shown and
         the 5 m nav-arrived contract below stay exactly as they were;
         the compass HUD reads window.__espilNavTarget. An empty group
         keeps the arrival tick alive. */
      var g=new THREE.Group();
      espilNavFlow=[];
      mapScene.add(g); espilNavGroup=g;
      window.__espilNavActive=true; window.__espilNavTarget=espilNavTarget; window.__espilNavPathLen=Math.round(espilNavPathTotal);
      try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'nav-shown',name:espilNavTarget.name}})); }catch(e){}
      return true;
    }
    function espilNavPointAt(d){
      var path=espilNavPath, cum=espilNavPathCum; if(!path||!cum)return null;
      if(d<=0)return path[0]; if(d>=espilNavPathTotal)return path[path.length-1];
      var i=1; while(cum[i]<d)i++;
      var f=(d-cum[i-1])/Math.max(0.001,cum[i]-cum[i-1]);
      return {x:path[i-1].x+(path[i].x-path[i-1].x)*f, z:path[i-1].z+(path[i].z-path[i-1].z)*f};
    }
    setInterval(function(){
      if(!espilNavGroup||!espilNavPath||!document.body.classList.contains('in-map'))return;
      var p=walkPlayer; if(!p)return;
      espilNavFlowT+=0.7;
      for(var i=0;i<espilNavFlow.length;i++){ var pt=espilNavPointAt((espilNavFlowT+i*espilNavPathTotal/espilNavFlow.length)%espilNavPathTotal);
        if(pt){ var y=0; try{ var sy=espilOwnSurfaceY(pt.x,pt.z); if(typeof sy==='number')y=sy; }catch(e){}
          espilNavFlow[i].position.set(pt.x,y+0.24,pt.z); } }
      var dT=Math.hypot(p.pos.x-espilNavTarget.x,p.pos.z-espilNavTarget.z);
      if(!espilNavArrived&&dT<=5){ espilNavArrived=true; espilNavArrivedAt=performance.now();
        try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'nav-arrived',name:espilNavTarget.name}})); }catch(e){} }
      if(espilNavArrived&&performance.now()-espilNavArrivedAt>2500){ espilNavClear(); return; }
      if(!espilNavArrived&&performance.now()-espilNavLastRoute>4000){
        var dMin=1e9; for(var v=0;v<espilNavPath.length;v++){ var dv=Math.hypot(p.pos.x-espilNavPath[v].x,p.pos.z-espilNavPath[v].z); if(dv<dMin)dMin=dv; }
        if(dMin>30){ var tgt=espilNavTarget; if(espilNavShow(tgt))return; }
        espilNavLastRoute=performance.now();
      }
    },100);
    window.__espilNavShow=espilNavShow;
    window.__espilNavHide=espilNavClear;
    window.__espilNavToKonbiniya=function(){ return espilNavShow({x:ESPIL_KONBINIYA.x,z:ESPIL_KONBINIYA.z,name:'Konbiniya'}); };
    function stallKey(){return 'espil_stall_'+(window.__espilCityKey||'vancouver');}
    function stallLoad(){try{var s=JSON.parse(localStorage.getItem(stallKey())||'null');return (s&&typeof s.x==='number'&&typeof s.z==='number')?s:null;}catch(_){return null;}}
    function stallSave(s){var __old=null; try{__old=stallLoad();}catch(_){}
      try{if(s)localStorage.setItem(stallKey(),JSON.stringify(s));else localStorage.removeItem(stallKey());}catch(_){}
      try{ var __oc=(__old&&__old.posts)?__old.posts.length:0;
        if(s&&s.posts&&s.posts.length>__oc){ var __np=s.posts[s.posts.length-1];
          window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'stall-listed',item:(__np&&__np.title)||''}})); } }catch(_){} /* guide hook: fires only when a NEW post lands in a slot */ }
    function stallToast(msg){if(window.__espilToast)window.__espilToast(msg);}
    function stallPatch(mat){return mat;} /* materials ship unpatched since the curve removal (Han 2026-10-20) */
    function stallRemoveVisual(){if(stallGroup){if(stallGroup.parent)stallGroup.parent.remove(stallGroup);stallGroup=null;stallSignMat=null;}}
    function stallSignTexture(s){
      var cv=document.createElement('canvas');cv.width=512;cv.height=128;
      var c=cv.getContext('2d');
      c.fillStyle='#54381e';c.fillRect(0,0,512,128);
      c.strokeStyle='#c9a15a';c.lineWidth=6;c.strokeRect(4,4,504,120);
      c.fillStyle='#ffe9a8';c.textAlign='center';c.textBaseline='middle';
      var posts=(s&&s.posts)||[];
      var line1=((s&&s.name)||'My Stall'),line2='Press Y to add a post';
      if(line1.length>26)line1=line1.slice(0,26)+'…';
      if(posts.length){
        var p=posts[0];
        line2=((p.side==='buy')?'Buying: ':'Selling: ')+(p.title||'')+(p.price?(' - '+String(p.price)+' Leo'):' - Negotiable');
        if(posts.length>1)line2+=' (+'+(posts.length-1)+' more)';
        if(line2.length>34)line2=line2.slice(0,34)+'…';
      }
      c.font='bold 42px sans-serif';c.fillText(line1,256,44);
      c.font='28px sans-serif';c.fillStyle='#f5d98a';c.fillText(line2,256,92);
      return new THREE.CanvasTexture(cv);
    }
    function stallBuildVisual(s){
      stallRemoveVisual();
      if(typeof THREE==='undefined'||typeof mapScene==='undefined'||!mapScene)return;
      var g=new THREE.Group();
      var wood=stallPatch(new THREE.MeshLambertMaterial({color:0x8a6844}));
      var dark=stallPatch(new THREE.MeshLambertMaterial({color:0x54381e}));
      var cloth=stallPatch(new THREE.MeshLambertMaterial({color:0xb8452e}));
      var table=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.08,0.9),wood);table.position.y=0.78;g.add(table);
      [[-0.82,-0.38],[0.82,-0.38],[-0.82,0.38],[0.82,0.38]].forEach(function(pt){
        var leg=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.78,0.08),dark);
        leg.position.set(pt[0],0.39,pt[1]);g.add(leg);
      });
      [-0.95,0.95].forEach(function(px){
        var pole=new THREE.Mesh(new THREE.BoxGeometry(0.07,2.02,0.07),dark);
        pole.position.set(px,1.01,-0.5);g.add(pole);
      });
      var canopy=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.06,1.4),cloth);
      canopy.position.set(0,2.05,-0.1);canopy.rotation.x=0.1;g.add(canopy);
      stallSignMat=stallPatch(new THREE.MeshLambertMaterial({map:stallSignTexture(s)}));
      var sign=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.44,0.05),stallSignMat);
      sign.position.set(0,1.52,0.47);g.add(sign);
      g.position.set(s.x,(typeof s.y==='number'?s.y:0),s.z);
      g.rotation.y=(typeof s.yaw==='number'?s.yaw:0);
      mapScene.add(g);stallGroup=g;
    }
    function stallRefreshSign(){var s=stallLoad();if(stallSignMat&&s){stallSignMat.map=stallSignTexture(s);stallSignMat.needsUpdate=true;}}
    function stallEnsureVisual(){var s=stallLoad();if(!s)return;if(!stallGroup||stallGroup.parent!==mapScene)stallBuildVisual(s);}
    function stallTryPlace(){
      if(!walkPlayer)return false;
      if(walkPlayer.swimming){stallToast('You cannot open a stall in the water');return false;}
      var x=walkPlayer.pos.x,z=walkPlayer.pos.z;
      if(espilRecordDistAt(x,z)<1.2){stallToast('Too close to a building. Please open it in an open space');return false;}
      var s=stallLoad()||{posts:[]};
      s.x=x;s.z=z;s.y=walkPlayer.pos.y;s.yaw=walkPlayer.faceY||0;s.ts=Date.now();
      stallSave(s);stallBuildVisual(s);stallRender();
      stallToast('Stall opened');return true;
    }
    function stallEsc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
    var stallEditIdx=-1; /* the grid slot loaded in the editor (-1 = none) */
    var STALL_SLOTS=10; /* the classic stall window: a 5 x 2 grid */
    function stallRender(){
      var s=stallLoad();
      var status=document.getElementById('stall-status');
      var placeBtn=document.getElementById('stall-place-btn');
      var removeBtn=document.getElementById('stall-remove-btn');
      var viewBtn=document.getElementById('stall-view-btn');
      var board=document.getElementById('stall-board');
      var form=document.getElementById('stall-form');
      var nameEl=document.getElementById('stall-name');
      if(!status||!board)return;
      var posts=(s&&s.posts)||[];
      status.textContent=s?('Your stall is open in this city. '+posts.length+' of '+STALL_SLOTS+' slots filled.'):'No stall open yet.';
      if(nameEl&&document.activeElement!==nameEl)nameEl.value=(s&&s.name)||'';
      if(placeBtn)placeBtn.textContent=s?'Move stall here':'Open stall here';
      if(removeBtn)removeBtn.style.display=s?'':'none';
      if(viewBtn){viewBtn.style.display=s?'':'none';viewBtn.textContent=stallVisitor?'Back to manage':'View as visitor';}
      if(form)form.style.display=(s&&!stallVisitor)?'':'none';
      if(stallEditIdx>=posts.length)stallEditIdx=-1;
      board.innerHTML='';
      if(!s){
        board.innerHTML='<p class="st-foot" style="grid-column:1/-1;">Open a stall to fill its grid with Selling and Buying posts.</p>';
        return;
      }
      if(stallVisitor){
        var vh=document.createElement('p'); vh.className='st-foot'; vh.style.gridColumn='1/-1';
        vh.textContent='This is how visitors see your stall.';
        board.appendChild(vh);
      }
      function slotEl(i){
        var p=posts[i];
        var el=document.createElement(stallVisitor?'div':'button');
        if(!stallVisitor)el.type='button';
        el.style.cssText='position:relative;min-height:86px;padding:7px 7px 20px;border-radius:8px;text-align:left;vertical-align:top;'
          +(p
            ?('border:1px solid '+(stallEditIdx===i?'#8ef7e8':'rgba(134,238,228,.3)')+';background:'+(p.kind==='service'?'rgba(70,50,110,.35)':'rgba(20,60,60,.35)')+';color:#ddfffc;cursor:'+(stallVisitor?'default':'pointer')+';')
            :'border:1px dashed rgba(134,238,228,.35);background:rgba(0,0,0,.18);color:rgba(221,255,252,.6);cursor:pointer;');
        if(p){
          el.innerHTML='<span style="position:absolute;top:5px;left:5px;padding:1px 6px;border-radius:99px;font-size:10px;background:'+(p.side==='buy'?'rgba(90,140,255,.5)':'rgba(255,150,60,.5)')+';color:#fff;">'+(p.side==='buy'?'BUYING':'SELLING')+'</span>'
            +'<span style="display:block;margin-top:17px;font-size:12px;line-height:1.25;word-break:break-word;">'+stallEsc(p.title)+'</span>'
            +'<span style="position:absolute;left:5px;bottom:5px;font-size:11px;color:#ffe9a8;">'+(p.price?stallEsc(p.price)+' Leo':'Negotiable')+'</span>'
            +(p.kind==='service'?'<span style="position:absolute;right:5px;bottom:5px;font-size:10px;opacity:.7;">SVC</span>':'');
          el.title=(p.note||'')+(stallVisitor?'':' (click to edit)');
          if(!stallVisitor)el.addEventListener('click',function(){ stallEditSlot(i); });
          else el.addEventListener('click',function(){ stallToast('Trading is face to face - settlement arrives with accounts. Speak to the stall keeper.'); });
        }else{
          el.innerHTML='<span style="display:block;text-align:center;font-size:18px;line-height:1;padding-top:12px;">+</span><span style="display:block;text-align:center;font-size:11px;">Empty slot</span>';
          el.addEventListener('click',function(){ stallEditSlot(-1); var t=document.getElementById('stall-title'); if(t)t.focus(); });
        }
        return el;
      }
      var n=stallVisitor?posts.length:STALL_SLOTS;
      for(var i2=0;i2<n;i2++)board.appendChild(slotEl(i2));
      var ft=document.getElementById('stall-form-title');
      if(ft)ft.textContent=stallEditIdx>=0?('Editing slot '+(stallEditIdx+1)+' - change the fields and Save, or Delete the post'):('Add a post - pick an empty slot, fill this in, and Post');
      var addB=document.getElementById('stall-add-btn'); if(addB)addB.textContent=stallEditIdx>=0?'Save':'Post';
      var delB=document.getElementById('stall-del-btn'); if(delB)delB.style.display=stallEditIdx>=0?'':'none';
    }
    function stallEditSlot(i){
      stallEditIdx=i;
      var s=stallLoad(); var p=(i>=0&&s&&s.posts)?s.posts[i]:null;
      function set(id,v){ var el=document.getElementById(id); if(el)el.value=v==null?'':v; }
      set('stall-side',p?p.side:'sell'); set('stall-kind',p?p.kind:'item');
      set('stall-title',p?p.title:''); set('stall-price',p?p.price:''); set('stall-note',p?p.note:'');
      stallRender();
    }
    function toggleStallPanel(force){
      var panel=document.getElementById('stall-panel');if(!panel)return;
      var open=typeof force==='boolean'?force:!stallOpen;
      if(open&&!stallLoad()){
        /* Y at a spot with no stall yet opens the stall right here
           (Han 2026-10-19). If the spot cannot hold one, the panel
           still opens so the reason (toast) and the retry are clear. */
        stallTryPlace();
      }
      stallOpen=open;panel.setAttribute('aria-hidden',String(!open));
      if(open){stallEnsureVisual();stallRender();
        try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'stall-open'}})); }catch(e){} /* guide hook */ }
    }
    (function stallWire(){
      var nameEl=document.getElementById('stall-name');
      if(nameEl)nameEl.addEventListener('change',function(){
        var s=stallLoad(); if(!s)return;
        s.name=nameEl.value.trim(); stallSave(s); stallRefreshSign(); stallToast('Stall name saved');
      });
      var del=document.getElementById('stall-del-btn');
      if(del)del.addEventListener('click',function(){
        var s=stallLoad(); if(!s||!s.posts||stallEditIdx<0)return;
        s.posts.splice(stallEditIdx,1); stallEditIdx=-1;
        stallSave(s); stallRefreshSign(); stallRender(); stallToast('Post deleted');
      });
      var close=document.getElementById('stall-close');
      if(close)close.addEventListener('click',function(){toggleStallPanel(false);});
      var place=document.getElementById('stall-place-btn');
      if(place)place.addEventListener('click',function(){stallTryPlace();});
      var rem=document.getElementById('stall-remove-btn');
      if(rem)rem.addEventListener('click',function(){stallSave(null);stallRemoveVisual();stallVisitor=false;stallRender();stallToast('Stall closed');});
      var view=document.getElementById('stall-view-btn');
      if(view)view.addEventListener('click',function(){stallVisitor=!stallVisitor;stallRender();});
      var add=document.getElementById('stall-add-btn');
      if(add)add.addEventListener('click',function(){
        var s=stallLoad();if(!s){stallToast('Open a stall first');return;}
        var titleEl=document.getElementById('stall-title');
        var title=(titleEl.value||'').trim();
        if(!title){stallToast('Please enter a title');return;}
        s.posts=s.posts||[];
        var rec={side:document.getElementById('stall-side').value,kind:document.getElementById('stall-kind').value,title:title,price:(document.getElementById('stall-price').value||'').trim(),note:(document.getElementById('stall-note').value||'').trim()};
        if(stallEditIdx>=0&&s.posts[stallEditIdx]){
          var old=s.posts[stallEditIdx]; rec.id=old.id; rec.ts=old.ts;
          s.posts[stallEditIdx]=rec; stallToast('Saved');
        }else{
          if(s.posts.length>=STALL_SLOTS){stallToast('The stall grid is full ('+STALL_SLOTS+' slots)');return;}
          rec.id='p'+Date.now().toString(36)+Math.floor(Math.random()*999); rec.ts=Date.now();
          s.posts.push(rec); stallToast('Posted');
        }
        stallSave(s);stallRefreshSign();stallEditSlot(-1);
        titleEl.value='';document.getElementById('stall-price').value='';document.getElementById('stall-note').value='';
      });
    })();
    setInterval(function(){
      if(!document.body.classList.contains('in-map')){if(stallGroup)stallRemoveVisual();return;}
      stallEnsureVisual();
    },1200);
    /* Espil Guide tutorial REMOVED (Han's standing order - first given
       2026-10-23 and executed on production 2026-10-24; the working and
       testing lineages had forked from a pre-removal base and kept
       re-shipping it, so it is removed here too, 2026-10-27). No-op
       stubs stay so existing callers never throw. */
    function espilOpenGuide(){}
    function espilCloseGuide(){}
    window.__espilOpenGuide=espilOpenGuide;
    window.__espilCloseGuide=espilCloseGuide;
    /* ============ BUILDING PANEL + INTERIOR (Han 2026-10-20 #5) ====
       Space at a building opens the selection window with the
       building's name (Cauldron-style). Enter resolves like this:
       a building with real stores opens its store page (the old
       tryInteract behaviour); any other building enters the shared
       interior room (v1) - one room at a far world offset, the
       building's name on its sign, the door on the south wall. */
    var espilBldgPanelRec=null, espilBldgPanelCand=null, espilBldgName='Building';
    /* Entry rule (Han 2026-11-04, SUPERSEDED by Han 2026-11-07
       batch 5): only the Konbiniya opened; every other building
       stayed shut. The 2026-11-07 rule below replaces it. */
    /* Entry rule (Han 2026-11-07): EVERY building with a rendered
       shape is enterable - in this build that is a baked district
       record whose places entry carries a displayable name (the
       label-carrying records: 2,655 of 2,712 in the Vancouver
       bake; the Art Gallery class). Entering any of them routes
       the player into the KONBINIYA interior (the shared interior
       room + shop fitout at ESPIL_INT), signed as the Konbiniya -
       the panel never pretends the destination is that building's
       own interior, and its Enter affordance says where it goes.
       Single-colour extrusions with no named baked record get no
       label, no panel and no entry, exactly as before. Identity
       rule for the Konbiniya itself matches modules/store.js and
       store-page-link.js: name or 1238 Robson address match, or
       the record anchor within 40 m of the fixed Konbiniya anchor;
       The Konbiniya itself is the one exception (Han 2026-11-11
       directive item 4, Phase 2): its in-world entry is retired -
       panel Enter click and keyboard entry alike open the
       standalone store page in a popup via the store-page-link
       module, and espilEnterInside refuses the record outright.
       Every other building keeps the routed interior below.
       PLACE EXPANSION (Han 2026-11-17): the routed interior below
       is now the REMAINDER path, not the rule - every building
       that owns its address slug opens its own place space in a
       popup instead (espilOpenPlacePopup in espilEnterBuilding,
       resolved by store-page-link against the baked places
       dataset). PLACE EXPANSION REMAINDER (Han 2026-11-18): the
       grammar is complete - every record owns a canonical slug
       (suffixed for shadowed records, name-derived for
       addressless ones, an ordinal token for stringless ones),
       so the interior below is reached only when the link module
       is switched off (PLACE_ALL_DEST) or a point matches no
       record at all. */
    function espilIsKonbiniyaRec(rec){
      if(!rec)return false;
      var nm=rec.name||rec.title||'';
      if(/konbiniya/i.test(nm)||/1238\s+robson/i.test(nm))return true;
      if(rec===espilBldgPanelRec&&espilBldgName&&(/konbiniya/i.test(espilBldgName)||/1238\s+robson/i.test(espilBldgName)))return true;
      var k=window.__espilKonbiniyaPos; if(!k)return false;
      var x=(typeof rec.cx==='number')?rec.cx:rec.x, z=(typeof rec.cz==='number')?rec.cz:rec.z;
      return (typeof x==='number'&&typeof z==='number')&&Math.hypot(x-k.x,z-k.z)<40;
    }
    function espilPaintEnterAffordance(){
      var e=document.getElementById('bldg-enter'); if(!e)return;
      /* Batch 5 (Han 2026-11-07): every rendered building shows
         Enter. A non-Konbiniya building's Enter was labelled with
         its real destination - the Konbiniya interior - so the
         panel never implied the building has its own interior.
         "KONBINIYA ENTER" PROMPT REMOVED (Han direct order,
         2026-11-16): the prompt shown when entering any building
         no longer names the Konbiniya - that label was the display
         part of every building reading as the Konbiniya. The
         button, its show path and the entry routing behind it are
         unchanged; only the Konbiniya naming is gone. */
      e.style.display='';
      e.textContent='Enter';
    }
    window.__espilInterior=null; window.__espilInteriorReturn=null;
    var ESPIL_INT={x:0,z:8000};
    /* ARENA SEAM (arena build, 2026-11-10): the arena instance
       space anchor - clear of the shop interior at ESPIL_INT
       (z 8000) by far more than the fitout depth. */
    var ESPIL_ARENA_INT={x:0,z:8400};
    function espilNearestRecord(px,pz){
      var pb=espilPolyBucketAt(px,pz); if(!pb)return null;
      var best=null,bestD=1e9;
      for(var i=0;i<pb.length;i++){ var d=espilPolyProbe(pb[i],px,pz).d; if(d<bestD){bestD=d;best=pb[i];} }
      return best?{rec:best,d:bestD}:null;
    }
    function espilBldgCandidate(rec){
      var best=null,bestD=1e18;
      for(var i=0;i<mapBuildings.length;i++){
        var b=mapBuildings[i], dx=b.x-rec.cx, dz=b.z-rec.cz, d=dx*dx+dz*dz;
        if(d<bestD){bestD=d;best=b;}
      }
      return (best&&bestD<3600)?best:null;
    }
    function openBuildingPanel(rec){
      espilBldgPanelRec=rec;
      espilBldgPanelCand=espilBldgCandidate(rec);
      espilBldgName='Building';
      var nameEl=document.getElementById('bldg-name'), metaEl=document.getElementById('bldg-meta');
      if(nameEl)nameEl.textContent='Locating...';
      if(metaEl)metaEl.textContent='Height '+Math.round(rec.h)+' m · about '+Math.max(1,Math.round(rec.h/3))+' floors · '+espilCityDisplayName();
      var panel=document.getElementById('bldg-panel');
      if(panel){panel.classList.add('open');panel.setAttribute('aria-hidden','false');}
      espilPaintEnterAffordance(); /* Batch 5: every rendered building; repainted when the name resolves below */
      /* Name resolution probes the record's own coordinates through
         the same Places/OSM name path as the building pill (the
         mapBuildings candidate only links stores on Enter - the
         chunk-system buildings do not align with district records). */
      fetchBuildingName({x:rec.cx,z:rec.cz},function(nm){
        if(espilBldgPanelRec!==rec&&espilInsideRec!==rec)return;
        if(!nm||(nm==='Downtown Vancouver'&&espilCityKey()!=='vancouver'))nm='Unnamed Building';
        espilBldgName=nm;
        if(nameEl)nameEl.textContent=espilBldgName;
        espilPaintEnterAffordance(); /* the resolved name can identify the Konbiniya */
        var on=document.getElementById('bldg-opts-name'); if(on)on.textContent=espilInsideRouted?'Konbiniya':espilBldgName;
        if(window.__espilInside)window.__espilInside.name=espilInsideRouted?'Konbiniya':espilBldgName;
      });
    }
    function closeBuildingPanel(){
      espilBldgPanelRec=null;
      var panel=document.getElementById('bldg-panel');
      if(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');}
    }
    function espilFadeThrough(mid){
      var f=document.getElementById('bldg-fade'); if(!f){mid();return;}
      f.style.opacity='1';
      setTimeout(function(){ mid(); f.style.opacity='0'; },210);
    }
    /* The Konbiniya popup opener (Han 2026-11-11 directive item 4,
       Phase 2 seam): reuses the store-page-link module's own
       contract - tryIntercept with the record first, openKonbiniya
       as the fallback - and invents no second opener. The module
       lazy-loads (its arming seams live in lazyload.js), so an
       Enter pressed before it lands is deferred until it arrives
       (150 ms poll, up to ~3 s) instead of falling through to the
       retired in-world entry; if it never arrives, the press ends
       at a toast, never at an interior. */
    var espilKbPopupWait=null;
    function espilOpenKonbiniyaPopup(rec){
      var link=window.__espilStorePageLink;
      if(link){
        if(espilKbPopupWait){clearInterval(espilKbPopupWait);espilKbPopupWait=null;}
        if(!link.tryIntercept(rec))link.openKonbiniya();
        return;
      }
      if(espilKbPopupWait)return;
      var tries=0;
      espilKbPopupWait=setInterval(function(){
        tries++;
        var l2=window.__espilStorePageLink;
        if(l2){ clearInterval(espilKbPopupWait); espilKbPopupWait=null; if(!l2.tryIntercept(rec))l2.openKonbiniya(); }
        else if(tries>=20){ clearInterval(espilKbPopupWait); espilKbPopupWait=null; if(window.__espilToast)window.__espilToast('The store page is still loading - try Enter again in a moment.'); }
      },150);
    }
    /* PLACE EXPANSION (Han 2026-11-17): every OTHER building that
       owns its address slug opens its own place space in a popup,
       through the same store-page-link contract as the Konbiniya
       seam above - the module resolves the panel record against
       the baked places dataset (the AABB fingerprint of the
       record's ring, or its centre). The press is consumed while
       the dataset is still loading (150 ms poll, up to ~3 s): a
       building whose place may exist never falls through to the
       shared interior on a load race. Since the remainder
       grammar landed (Han 2026-11-18) every record resolves
       under its canonical slug; a resolve of false now means the
       point matched no record, or the expansion flags are off -
       either way the press keeps the routed interior below,
       unchanged. If the link module never arrives the press ends
       at a toast, on the Konbiniya seam's rule. */
    var espilPlacePopupWait=null;
    function espilPlacePointOf(rec){
      var pt={x:rec.cx,z:rec.cz};
      if(rec.ring&&rec.ring.length>2){
        var mnx=1e18,mxx=-1e18,mnz=1e18,mxz=-1e18;
        for(var ri=0;ri<rec.ring.length;ri++){ var rp=rec.ring[ri]; if(rp[0]<mnx)mnx=rp[0]; if(rp[0]>mxx)mxx=rp[0]; if(rp[1]<mnz)mnz=rp[1]; if(rp[1]>mxz)mxz=rp[1]; }
        pt.x=(mnx+mxx)/2; pt.z=(mnz+mxz)/2; pt.w=mxx-mnx; pt.d=mxz-mnz;
      }
      return pt;
    }
    function espilOpenPlacePopup(rec){
      var link=window.__espilStorePageLink;
      if(link&&link.tryPlace){
        if(espilPlacePopupWait){clearInterval(espilPlacePopupWait);espilPlacePopupWait=null;}
        var r=link.tryPlace(espilPlacePointOf(rec));
        if(r===true)return true;
        if(r===false)return false;
        /* 'pending' falls into the wait below */
      }
      if(espilPlacePopupWait)return true;   /* a wait is already running: the press is consumed */
      var tries=0;
      espilPlacePopupWait=setInterval(function(){
        tries++;
        var l2=window.__espilStorePageLink;
        var done=false, opened=false, timedOut=false;
        if(l2&&l2.tryPlace){
          var r2=l2.tryPlace(espilPlacePointOf(rec));
          if(r2===true){done=true;opened=true;}
          else if(r2===false){done=true;}
        }
        if(!done&&tries>=20){ done=true; timedOut=true; if(window.__espilToast)window.__espilToast('The building spaces are still loading - try Enter again in a moment.'); }
        if(done){
          clearInterval(espilPlacePopupWait); espilPlacePopupWait=null;
          /* resolved false: no place of its own - the routed interior, as before.
             timed out: the press ends at the toast, never at an interior. */
          if(!opened&&!timedOut){ closeBuildingPanel(); espilEnterInside(rec); }
        }
      },150);
      return true;
    }
    function espilEnterBuilding(){
      var p=walkPlayer; if(!p||!espilBldgPanelRec)return;
      var rec=espilBldgPanelRec;
      /* KONBINIYA POPUP (Han 2026-11-11 directive item 4, Phase 2):
         the Konbiniya itself never enters the in-world interior -
         the panel Enter button and the keyboard Enter alike route
         to the standalone store page popup, exactly like the
         store-page-link click interception does for the button.
         The panel is left as it stands (the interception path
         never closes it either); the world pauses while the popup
         is open and resumes when it closes. */
      if(espilIsKonbiniyaRec(rec)){ espilOpenKonbiniyaPopup(rec); return; }
      /* PLACE EXPANSION (Han 2026-11-17): a building that owns its
         address slug opens its own place space instead of the
         shared interior - the panel is left as it stands, exactly
         as on the Konbiniya path. Only a building with no place of
         its own reaches the routed interior below. */
      if(espilOpenPlacePopup(rec))return;
      closeBuildingPanel();
      espilEnterInside(rec);
    }
    /* ============ BUILDING INTERIOR (Han batch 5 -> batch 6) =====
       Batch 5 put entry in-place inside the footprint on Han's
       word then; batch 6 reverses it on his new word: inside a
       building he wants an interior-ONLY screen, fitted as a
       classic shop. So entry returns to the dedicated interior
       (the fitted room at the far offset, espilBuildInterior +
       espilBuildShopFitout) - but the batch-5 exit machinery
       stays: the saved outside point, three synchronous ways out
       (the door, the shop UI's Leave button, the settings menu's
       Return to Earth), so the v1 stranding cannot recur. The
       shop UI opens on entry: the house stock grid (themed by the
       building's real stores), the purse, Contact, Leave. */
    var espilInsideRec=null, espilInsideDoor=null, espilInsideOutside=null, espilInsideHint=false;
    /* Batch 5: for a routed (non-Konbiniya) entry, the interior's
       public name - the Konbiniya's - regardless of which building
       was entered; null when the Konbiniya itself was entered. */
    var espilInsideRouted=null;
    /* KONBINIYA FPV (Han fixed rule 2026-11-07, restored 2026-11-09):
       entering the Konbiniya itself is TRUE FIRST-PERSON, exactly
       like the standalone store page (/vancouver/1238-robson-st):
       the camera sits at the player's own eye (1.6 m), the avatar
       is not drawn, A/D turn the camera (the store page's Batch H
       rate, 90 deg/s) and attack inputs stay inert. WIDENED by
       Han's decision (2026-11-10): FPV applies to EVERY interior,
       including routed interiors entered through another building
       (whose visit is routed into this same room) - the predicate
       no longer scopes to the Konbiniya entry alone; it was first
       restored scoped to espilInsideRouted === null (2026-11-09)
       and Han then unified all interiors to true first-person.
       The defect this restores: espilEnterInside never changed the
       camera model at all, so the overlay follow camera and the P1
       pitch-52 map framing both kept their outdoor third-person
       framing inside the store, avatar in frame. */
    var ESPIL_KB_EYE=1.6, ESPIL_KB_TURN=Math.PI/2, ESPIL_KB_P1_ZOOM=22.0, ESPIL_KB_P1_PITCH=85;
    var espilFpvApplied=false;
    function espilKbFpvActive(){
      /* HOME THIRD-PERSON (Han 2026-11-17, home design 9 Q2
         DECIDED): the home is the one interior that is NOT
         first-person - the player sees the character they
         picked. Every other interior keeps the FPV rule above.
         The inside record itself is untouched by this: monster
         safety, the position-save guard and the inside tick all
         read the record, never this predicate. With the
         predicate off, the home's A/D, attack and skill inputs
         take the street law, like the camera does. */
      if(window.__espilInside&&window.__espilInside.home)return false;
      return !!(window.__espilInside&&espilInsideRec&&typeof walkPlayer!=='undefined'&&walkPlayer);
    }
    window.__espilKbFpvState=function(){
      var cam=(typeof mapCamera!=='undefined'&&mapCamera&&mapCamera.position)?mapCamera.position:null;
      var p=(typeof walkPlayer!=='undefined'&&walkPlayer)?walkPlayer:null;
      return { active:espilKbFpvActive(), applied:espilFpvApplied, eye:ESPIL_KB_EYE,
        camPos:cam?{x:Math.round(cam.x*100)/100,y:Math.round(cam.y*100)/100,z:Math.round(cam.z*100)/100}:null,
        playerPos:(p&&p.pos)?{x:Math.round(p.pos.x*100)/100,y:Math.round(p.pos.y*100)/100,z:Math.round(p.pos.z*100)/100}:null,
        avatarVisible:(p&&p.av&&p.av.group)?!!p.av.group.visible:null,
        shadowVisible:(p&&p.av&&p.av.shadow)?!!p.av.shadow.visible:null,
        yaw:(typeof walkCamYaw==='number')?Math.round(walkCamYaw*1000)/1000:null,
        pitch:(typeof walkCamPitch==='number')?Math.round(walkCamPitch*1000)/1000:null,
        routedFrom:window.__espilInside?window.__espilInside.routedFrom:undefined };
    };
    /* ZOOM-FPV (Han 2026-11-17): zooming the third-person camera
       ALL the way in switches to first person; zooming back out
       returns to third person. The zoom source is a NEW activation
       source beside the interior one above, and the two never share
       input law - the split is the design's core rule:
         - INPUT law (A/D turn in updateWalkMap, the doMove block,
           the skill-row block) reads ONLY espilKbFpvActive() (the
           interior predicate). On the street A/D stay the skill
           keys (Dash / Wave) and attacks/skills stay live at full
           zoom; camera turning is drag-look's job, as outdoors.
         - CAMERA law (the eye framing in updateWalkMap, the P1
           pitch in espilP1Tick) reads the COMPOSITE predicate
           espilCamFpvActive() = interior OR zoom, with the two
           sources applied differently (interior = the copy branch
           above, unchanged; zoom = the 220 ms blend below).
       Engage/disengage are judged on accumulated wheel/pinch PUSH
       (mapZoom feeds it), never on zoomT: while the interior FPV
       is active the P1 tick overwrites zoomT every frame, so zoomT
       motion cannot carry the decision. The zoom source NEVER
       writes zoomT while engaged (the interior source does - that
       asymmetry is deliberate). State is page-memory only, like
       zoom itself: nothing is persisted, and entry resets it. */
    var espilZoomFpv={on:false,blend:0,push:0,applied:false};
    function espilZoomFpvActive(){ return espilZoomFpv.on; }
    function espilCamFpvActive(){ return espilKbFpvActive()||espilZoomFpvActive(); }
    /* The zoom source's own avatar ownership: 'applied' means the
       ZOOM source hid the avatar group + contact shadow (the
       interior source's flag is espilFpvApplied - never mixed).
       Restore defers to the vehicles module while it owns the hide
       (driving): boarding during zoom-FPV folds the zoom state in
       the same tick, and un-hiding there would put the rider back
       inside the car. */
    function espilZoomFpvSetApplied(b){
      var p=(typeof walkPlayer!=='undefined')?walkPlayer:null;
      if(b){
        if(p&&p.av&&p.av.group)p.av.group.visible=false;
        if(p&&p.av&&p.av.shadow)p.av.shadow.visible=false;
        espilZoomFpv.applied=true;
      }else{
        var vOwn=false;
        try{ vOwn=!!(window.__espilVehicles&&window.__espilVehicles.state&&window.__espilVehicles.state().avatarHidden); }catch(e){}
        if(!vOwn){
          if(p&&p.av&&p.av.group)p.av.group.visible=true;
          if(p&&p.av&&p.av.shadow)p.av.shadow.visible=true;
        }
        espilZoomFpv.applied=false;
      }
    }
    function espilZoomFpvFold(){
      espilZoomFpv.on=false; espilZoomFpv.blend=0; espilZoomFpv.push=0;
      if(espilZoomFpv.applied)espilZoomFpvSetApplied(false);
    }
    /* Force-off set: while any of these holds, the zoom state is
       folded flat the same tick (the interior takes the camera
       over - its entry is a fade teleport, so the snap is masked;
       flight and driving own their cameras). The HOME is NOT in
       this set: Han decided Q1 = ALLOW on 2026-11-17 (17:05, via
       COO), reversing the design's recommended default - the
       home's default camera stays third-person, but a deliberate
       full zoom-in may engage the zoom source there too, and the
       release blend returns to the home-contained boom point
       (espilCamClampUpdate's home branch caps the tracked point
       the blend falls back to). The interior predicate's own
       home exclusion (espilKbFpvActive) is a separate law and
       is untouched by this. */
    function espilZoomFpvForcedOff(){
      if(espilKbFpvActive())return 'interior';
      var p=(typeof walkPlayer!=='undefined')?walkPlayer:null;
      if(p&&p.flying)return 'flying';
      try{ if(window.__espilVehicles&&window.__espilVehicles.state&&window.__espilVehicles.state().driving)return 'driving'; }catch(e){}
      if(typeof cityPhaseActive!=='undefined'&&!cityPhaseActive)return 'no-city';
      return null;
    }
    /* Engage-block set: the force-off set plus the states whose
       steps own the body/camera (arrival envelope, landing, climb)
       and the store pause (the parent world is frozen). Push
       banked while blocked decays to 0, so a blocked build-up can
       never fire the frame the block lifts. */
    function espilZoomFpvBlocked(){
      if(espilZoomFpvForcedOff())return true;
      var p=(typeof walkPlayer!=='undefined')?walkPlayer:null;
      if(p&&(p._espilArrive||p._espilLanding||p._espilClimb))return true;
      if(window.__espilStorePaused)return true;
      return false;
    }
    function espilZoomFpvTick(dt){
      var Z=espilZoomFpv;
      if(espilZoomFpvForcedOff()){
        if(Z.on||Z.blend>0||Z.applied)espilZoomFpvFold();
        Z.push=0;
        return;
      }
      if(!Z.on){
        if(espilZoomFpvBlocked()){
          Z.push=Z.push>0?Math.max(0,Z.push-dt*4):Math.min(0,Z.push+dt*4);
        }else{
          /* Engage: half a notch of push PAST the zoom cap, while
             at the cap (layer: zoomT >= 22.99; fallback: the
             outdoor distance floor 1.8, with the same 0.01 slack). */
          var atCap=false;
          if(typeof ESPIL_P1!=='undefined'&&ESPIL_P1&&typeof espilP1!=='undefined'&&espilP1&&espilP1.map&&espilP1.ready&&!espilP1.failed){
            atCap=(espilP1.zoomT!==null&&espilP1.zoomT>=22.99);
          }else{
            atCap=(typeof walkCamDist==='number'&&walkCamDist<=1.81);
          }
          if(atCap&&Z.push>=0.5){ Z.on=true; Z.push=0; /* the disengage count starts from 0: one net notch out releases */ }
        }
      }else if(Z.push<=-1.0){
        /* Release: one net notch out. The restore point is FIXED
           (layer zoomT 22.60 / fallback 2.30 m) - the gap between
           the engage point (23.0 / 1.8) and the restore point is
           the hysteresis dead zone, so alternating +/-1 notch at
           the boundary toggles only on input, never on its own. */
        Z.on=false; Z.push=0;
        if(typeof ESPIL_P1!=='undefined'&&ESPIL_P1&&typeof espilP1!=='undefined'&&espilP1&&espilP1.map&&espilP1.ready&&!espilP1.failed){
          espilP1.zoomT=22.60;
        }else if(typeof walkCamDist==='number'){
          walkCamDist=2.30;
        }
      }
      /* The blend is dt-based (220 ms - the interior fade's 210 ms
         family), so it runs the same wall time at any frame rate.
         A world hit stop hands this tick dt = 0: the blend simply
         holds its value and resumes after - no catch-up, no jump. */
      if(Z.on)Z.blend=Math.min(1,Z.blend+dt/0.220);
      else Z.blend=Math.max(0,Z.blend-dt/0.220);
      /* Avatar timing: hide at blend >= 0.2, restore below it. The
         design's first draft hid at 0.5, but its own seam
         criterion (the avatar must already be hidden in every
         frame whose horizontal camera-player distance is under
         0.9 m) measures earlier: at the default pitch the tracked
         camera crosses 0.9 m horizontal at about a third of the
         approach covered, which the compounding lerp passes while
         blend is still near 0.23-0.45 depending on frame rate -
         0.2 is the threshold that precedes the crossing at both
         real and rig frame times (build report, deviation 1). */
      if(Z.blend>=0.2&&!Z.applied)espilZoomFpvSetApplied(true);
      else if(Z.blend<0.2&&Z.applied){
        /* The restore additionally waits until the camera is back
           outside the 0.9 m horizontal ring: on release the blend
           falls faster than the tracking lerp retreats the camera,
           so a blend-only restore pops the avatar back into view
           while the camera is still inside the ring (measured on
           the rig, probe L3: one release frame at 0.68 m with the
           avatar visible). The distance is last frame's, which is
           conservative on a retreating camera. The fold path above
           restores immediately - folds are teleports or hand-overs
           (interior, flight, driving, entry reset), never a
           blend-out, so they are not held by this condition. */
        var _zrOk=true;
        var _zp=(typeof walkPlayer!=='undefined')?walkPlayer:null;
        var _zc=(typeof mapCamera!=='undefined'&&mapCamera)?mapCamera.position:null;
        if(_zp&&_zp.pos&&_zc){
          var _zdx=_zc.x-_zp.pos.x, _zdz=_zc.z-_zp.pos.z;
          _zrOk=(_zdx*_zdx+_zdz*_zdz)>=0.81;
        }
        if(_zrOk)espilZoomFpvSetApplied(false);
      }
    }
    window.__espilZoomFpvState=function(){
      var cam=(typeof mapCamera!=='undefined'&&mapCamera&&mapCamera.position)?mapCamera.position:null;
      var p=(typeof walkPlayer!=='undefined'&&walkPlayer)?walkPlayer:null;
      return { on:espilZoomFpv.on, blend:Math.round(espilZoomFpv.blend*1000)/1000,
        push:Math.round(espilZoomFpv.push*100)/100, applied:espilZoomFpv.applied,
        interiorFpv:espilKbFpvActive(),
        camPos:cam?{x:Math.round(cam.x*100)/100,y:Math.round(cam.y*100)/100,z:Math.round(cam.z*100)/100}:null,
        avatarVisible:(p&&p.av&&p.av.group)?!!p.av.group.visible:null,
        shadowVisible:(p&&p.av&&p.av.shadow)?!!p.av.shadow.visible:null,
        zoomT:(typeof espilP1!=='undefined'&&espilP1)?espilP1.zoomT:null,
        walkCamDist:(typeof walkCamDist==='number')?Math.round(walkCamDist*100)/100:null };
    };
    /* CAR FIRST-PERSON (Han 2026-11-25 17:27 item 5 + the 17:28
       supplement; census + design: car-firstperson/CENSUS.md
       route B): while vehicles.js reports a drive whose viewMode
       is 'fp', the follow camera blends (220 ms, the zoom-FPV
       pattern) from the boom to the driver's eye - a point on the
       CAR pose: the driver-side offset rotated by the car
       heading, height the ESPIL_KB_EYE 1.6 m law - and looks
       along the car heading plus a drag look offset (clamped to
       +/-66 deg, springing back to centre in ~0.4 s once the drag
       ends). In first person the movement input frame reads the
       CAR heading (the input block below), never the look yaw,
       so looking around never steers; vehicles.js mirrors the
       same heading frame on its side. The toggle (V) and the
       per-drive view state live in vehicles.js; this block owns
       only the blend, the eye and the look offsets. Zoom input
       is ignored while FP is wanted (mapZoom), the street follow
       tuning is untouched, and third person resumes at the
       player's own zoom because walkCamYaw / walkCamPitch /
       walkCamDist are never written by this block. The own
       nameplate needs no rule here: it already follows the
       shared avatar-visibility predicate, and the avatar is
       hidden for the whole drive. */
    var ESPIL_CAR_EYE_X=0.62, ESPIL_CAR_EYE_Z=0.18; /* the census eye (sedan-local +0.34 / +0.10) in world metres at the loader's ~1.81 scale */
    var espilCarFpv={blend:0,lookYaw:0,lookPitch:0};
    function espilCarFpvWanted(){
      try{
        var V=window.__espilVehicles;
        if(!V||typeof V.state!=='function')return false;
        var s=V.state();
        return !!(s&&s.driving&&s.viewMode==='fp');
      }catch(e){ return false; }
    }
    function espilCarFpvHeading(){
      try{ var s=window.__espilVehicles.state(); if(s&&typeof s.heading==='number')return s.heading; }catch(e){}
      return null;
    }
    function espilCarFpvTick(dt){
      var want=espilCarFpvWanted()?1:0;
      if(dt>0){
        var step=dt/0.220; /* the zoom-FPV transition constant */
        if(espilCarFpv.blend<want)espilCarFpv.blend=Math.min(want,espilCarFpv.blend+step);
        else if(espilCarFpv.blend>want)espilCarFpv.blend=Math.max(want,espilCarFpv.blend-step);
        /* the look offset springs back to centre once no drag
           is live (~0.4 s to settle - the census draft) */
        var dragging=(typeof gameDragId!=='undefined'&&gameDragId!==null)||(typeof mapDragId!=='undefined'&&mapDragId!==null);
        if(!dragging&&(espilCarFpv.lookYaw||espilCarFpv.lookPitch)){
          var dec=Math.exp(-dt/0.13);
          espilCarFpv.lookYaw*=dec; espilCarFpv.lookPitch*=dec;
          if(Math.abs(espilCarFpv.lookYaw)<0.001)espilCarFpv.lookYaw=0;
          if(Math.abs(espilCarFpv.lookPitch)<0.001)espilCarFpv.lookPitch=0;
        }
      }
      if(!want&&espilCarFpv.blend<=0){ espilCarFpv.lookYaw=0; espilCarFpv.lookPitch=0; }
    }
    /* Drag routing: while car FP is wanted a drag feeds the look
       offset instead of walkCamYaw / walkCamPitch (the same
       rates and clamps the outdoor drag uses, the yaw clamp the
       census's +/-66 deg). Returns true when the drag was taken. */
    function espilCarLookDrag(dx,dy){
      if(!espilCarFpvWanted())return false;
      espilCarFpv.lookYaw=Math.max(-1.15,Math.min(1.15,espilCarFpv.lookYaw-dx*.0052));
      espilCarFpv.lookPitch=Math.max(-1.2,Math.min(1.2,espilCarFpv.lookPitch-dy*.004));
      return true;
    }
    function espilCarFpvEye(p){
      var h=espilCarFpvHeading();
      if(h===null)h=(typeof p.faceY==='number')?p.faceY:0;
      var ch=Math.cos(h), sh=Math.sin(h);
      var ex=p.pos.x+ESPIL_CAR_EYE_X*ch+ESPIL_CAR_EYE_Z*sh;
      var ez=p.pos.z-ESPIL_CAR_EYE_X*sh+ESPIL_CAR_EYE_Z*ch;
      var eye=new THREE.Vector3(ex,p.pos.y+ESPIL_KB_EYE,ez);
      var ly=h+espilCarFpv.lookYaw, cp=Math.cos(espilCarFpv.lookPitch);
      var tgt=new THREE.Vector3(eye.x+Math.sin(ly)*cp, eye.y+Math.sin(espilCarFpv.lookPitch), eye.z+Math.cos(ly)*cp);
      return {eye:eye,tgt:tgt,heading:h};
    }
    /* The monolith forward for a yaw is (-sin, -cos); the car
       forward for its heading is (sin, cos) - so the yaw whose
       forward IS the car forward is heading + PI. Non-null only
       while FP is wanted (the movement input frame). */
    function espilCarFpvFrameYaw(){
      if(!espilCarFpvWanted())return null;
      var h=espilCarFpvHeading();
      return (h===null)?null:h+Math.PI;
    }
    window.__espilCarFpvState=function(){
      var cam=(typeof mapCamera!=='undefined'&&mapCamera&&mapCamera.position)?mapCamera.position:null;
      return { wanted:espilCarFpvWanted(), blend:Math.round(espilCarFpv.blend*1000)/1000,
        lookYaw:Math.round(espilCarFpv.lookYaw*1000)/1000, lookPitch:Math.round(espilCarFpv.lookPitch*1000)/1000,
        heading:espilCarFpvHeading(),
        camPos:cam?{x:Math.round(cam.x*100)/100,y:Math.round(cam.y*100)/100,z:Math.round(cam.z*100)/100}:null };
    };
    /* ARENA PLACE follow-distance seam (Han 2026-11-18): set THIS
       document's default follow distance (fallback path:
       walkCamDist; Mapbox P1 path: the default zoom target the
       per-frame pin holds until the player takes the wheel). The
       arena place-space child calls it once with its 9.5 m draft
       after the summon; nothing on the street calls it, so the
       street default (5.5 m / zoom 20.39) is untouched. The
       player's own wheel zoom overrides the default from the
       first notch, exactly as on the street. */
    window.__espilSetFollowDist=function(d){
      if(typeof d!=='number'||!isFinite(d))return null;
      d=Math.max(1.8,Math.min(16,d));
      walkCamDist=d;
      espilFollowZoomT=espilP1ZoomFromDist(d);
      if(typeof espilP1!=='undefined'&&espilP1)espilP1.zoomT=espilFollowZoomT;
      return d;
    };
    function espilEnterInside(rec){
      var p=walkPlayer; if(!p||!rec)return;
      /* Batch 5 (Han 2026-11-07): no refusal - every rendered
         building enters, routed into the Konbiniya interior. */
      var isKb=espilIsKonbiniyaRec(rec);
      /* KONBINIYA POPUP hard stop (Phase 2): the Konbiniya's
         in-world entry is retired - no caller (the retired
         espilEnterInterior shim included) can put the player in
         the Konbiniya interior; the record routes to the popup
         instead. Routed buildings (isKb false) run byte-identical
         below this line. */
      if(isKb){ espilOpenKonbiniyaPopup(rec); return; }
      espilInsideRouted=isKb?null:(espilBldgName||'Building');
      var intName=isKb?espilBldgName:'Konbiniya';
      if(p.flying||p._fall)espilFlyClear(); /* Batch G: fly state clears on interior entry */
      if(!window.__espilInteriorBuilt)espilBuildInterior();
      if(!window.__espilShopBuilt)espilBuildShopFitout();
      if(window.__espilFitoutGroup)window.__espilFitoutGroup.visible=true;
      /* Footprint-derived room size (Han 2026-10-21 direction, staged
         2026-10-26): the room group scales with the entered building's
         footprint bbox, clamped so tiny kiosks and huge halls both stay
         walkable; door, spawn and the inside clamps follow the scale. */
      var sx=1,sz=1;
      if(rec.ring&&rec.ring.length>2){
        var mnx=1e18,mxx=-1e18,mnz=1e18,mxz=-1e18;
        for(var ri=0;ri<rec.ring.length;ri++){ var rp=rec.ring[ri]; if(rp[0]<mnx)mnx=rp[0]; if(rp[0]>mxx)mxx=rp[0]; if(rp[1]<mnz)mnz=rp[1]; if(rp[1]>mxz)mxz=rp[1]; }
        sx=Math.max(1,Math.min(2.2,(mxx-mnx)/24)); sz=Math.max(1,Math.min(2.2,(mxz-mnz)/16));
      }
      espilIntScale={x:sx,z:sz};
      if(espilIntGroup)espilIntGroup.scale.set(sx,1,sz);
      if(window.__espilFitoutGroup)window.__espilFitoutGroup.scale.set(sx,1,sz);
      /* Interior framing (v3): pull the map zoom out so the whole
         store map reads at once, Pokemon-store style; restored on leave.
         The Konbiniya itself is the exception (FPV fixed rule): its
         entry zoom target is the street-level FPV zoom, and the P1
         tick drives pitch/zoom from the FPV branch while inside. */
      if(typeof espilP1!=='undefined'&&espilP1&&espilP1.map){ espilIntPrevZoom=(typeof espilP1.zoomT==='number')?espilP1.zoomT:null; espilP1.zoomT=ESPIL_KB_P1_ZOOM; } /* ROUTED-INTERIOR VIEWPOINT UNIFICATION (entry/camera batch, 2026-11-10; Han: 일반 상점건물 들어가면 뷰포인트 이상해, 그냥 똑같이해): the routed entry used to assign 18.3 here while the Konbiniya assigned the FPV street zoom - the one pre-tick framing difference between the two entries. In layer mode the FPV branch of espilP1Tick drives zoomT to ESPIL_KB_P1_ZOOM on the first interior frame either way, but the entry assignment is what the first presented frames ease from, and on any path where the tick's FPV branch has not engaged yet the routed view sat at the wide 18.3 framing the Konbiniya never shows. Both entries now assign the identical FPV zoom, so a routed interior presents the Konbiniya's viewpoint from the first frame. */
      espilInsideRec=rec;
      espilInsideDoor={x:ESPIL_INT.x,z:ESPIL_INT.z+7.3*sz};
      espilInsideOutside={x:p.pos.x,y:p.pos.y,z:p.pos.z};
      espilInteriorSetSign(intName);
      espilFadeThrough(function(){
        p.pos.set(ESPIL_INT.x,0.05,ESPIL_INT.z+5.2*sz); p.velY=0; p.onGround=true;
        window.__espilInside={name:intName,interior:true,routedFrom:espilInsideRouted,door:{x:ESPIL_INT.x,z:ESPIL_INT.z+7.3*sz},x:rec.cx,z:rec.cz};
        /* v3: no shop on entry - orders start at the kiosk inside. */
        try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'interior',name:intName}})); }catch(e){} /* guide hook */
      });
    }
    function espilLeaveBuilding(){
      var p=walkPlayer; if(!p)return;
      /* PLACE SPACE (Han 2026-11-16): leaving from inside a
         building's own space is the place exit (the window closes,
         or the same-window street return) - never the street
         interior's return, which would drop the player at the
         building's street anchor inside the child window. */
      if(window.__espilInside&&window.__espilInside.placeSpace){ if(window.__espilPlaceSpaceExit)window.__espilPlaceSpaceExit(); return; }
      /* HOME SPACE (Han 2026-11-16, design 8.1 hunk 6): leaving
         from inside the player's own home is the home exit, for
         the same reason as the place guard above - the street
         interior's return would drop the player at the saved
         point without the home exit's cleanup (zoom, the home
         rectangle, the inside record's home shape). */
      if(window.__espilInside&&window.__espilInside.home){ if(window.__espilHomeExitSpace)window.__espilHomeExitSpace(); return; }
      if(espilIntPrevZoom!==null&&typeof espilP1!=='undefined'&&espilP1&&espilP1.map){ espilP1.zoomT=espilIntPrevZoom; }
      espilIntPrevZoom=null; espilKioskHint=false;
      var out=espilInsideOutside;
      espilInsideRec=null; espilInsideDoor=null; espilInsideOutside=null; espilInsideHint=false; espilInsideRouted=null;
      window.__espilInside=null;
      closeBuildingOpts();
      espilCloseShop();
      if(out){ p.pos.set(out.x,out.y,out.z); p.velY=0; }
    }
    /* ============ ARENA SPACE (arena build seam item 4) =====
       The run's ground: a personal instance on the interior
       pattern - own far-offset anchor (ESPIL_ARENA_INT), entry /
       exit teleports, saved outside point - but an outdoor-style
       combat ground, NOT a store interior: no building record is
       attached (espilInsideRec stays null, so the Konbiniya FPV
       predicate - which keys on the interior record - never
       engages here and the normal third-person follow camera
       applies), no shop fitout, no kiosk. While
       window.__espilInside.arena is set the indoors rules apply
       (monsters.js's field director pauses, no field summoning
       around the space, no NPC summoning, no flying).
       modules/arena.js picks these hooks up through its
       enterSpace()/exitSpace() adapters. */
    var espilArenaGroup=null;
    function espilBuildArenaSpace(){
      if(espilArenaGroup)return;
      var g=new THREE.Group(); g.position.set(ESPIL_ARENA_INT.x,0,ESPIL_ARENA_INT.z);
      espilArenaGroup=g;
      function M(geo,mat,x,y,z,ry){
        var m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(ry)m.rotation.y=ry;
        m.frustumCulled=false; g.add(m); return m;
      }
      var floorMat=new THREE.MeshLambertMaterial({color:0x3f4652});
      var fl=M(new THREE.CircleGeometry(26,56),floorMat,0,0.01,0); fl.rotation.x=-Math.PI/2;
      var innerMat=new THREE.MeshLambertMaterial({color:0x4a4238});
      var inn=M(new THREE.CircleGeometry(9,40),innerMat,0,0.03,0); inn.rotation.x=-Math.PI/2;
      /* rim ring in the zone-glow gold grammar (0xf2b63c) */
      var rimMat=new THREE.MeshBasicMaterial({color:0xf2b63c});
      var rim=M(new THREE.RingGeometry(25.1,26,72),rimMat,0,0.04,0); rim.rotation.x=-Math.PI/2;
      /* exit door marker at centre + (0, +9): frame posts + the
         EXIT sign, in the interior door convention */
      var postMat=new THREE.MeshLambertMaterial({color:0x6d5a41});
      M(new THREE.BoxGeometry(0.5,3.2,0.5),postMat,-1.4,1.6,9);
      M(new THREE.BoxGeometry(0.5,3.2,0.5),postMat,1.4,1.6,9);
      M(new THREE.BoxGeometry(3.3,0.5,0.5),postMat,0,3.2,9);
      var exitCvs=document.createElement('canvas'); exitCvs.width=256; exitCvs.height=96;
      var ectx=exitCvs.getContext('2d');
      ectx.fillStyle='#20242c'; ectx.fillRect(0,0,256,96);
      ectx.fillStyle='#f2b63c'; ectx.font='700 56px "Avenir Next","Segoe UI",sans-serif';
      ectx.textAlign='center'; ectx.textBaseline='middle'; ectx.fillText('EXIT',128,50);
      var exitMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(exitCvs)});
      var ex=M(new THREE.PlaneGeometry(1.5,0.56),exitMat,0,2.5,9); ex.rotation.y=Math.PI;
      mapScene.add(g);
    }
    window.__espilArenaCentre=function(){ return {x:ESPIL_ARENA_INT.x,z:ESPIL_ARENA_INT.z}; };
    window.__espilArenaEnterSpace=function(){
      var p=walkPlayer; if(!p)return null;
      if(p.flying||p._fall)espilFlyClear(); /* fly state clears on space entry, as on interior entry */
      espilBuildArenaSpace();
      espilInsideDoor={x:ESPIL_ARENA_INT.x,z:ESPIL_ARENA_INT.z+9};
      espilInsideOutside={x:p.pos.x,y:p.pos.y,z:p.pos.z};
      espilFadeThrough(function(){
        p.pos.set(ESPIL_ARENA_INT.x,0.05,ESPIL_ARENA_INT.z); p.velY=0; p.onGround=true;
        window.__espilInside={name:'Arena',interior:true,arena:true,routedFrom:null,door:{x:ESPIL_ARENA_INT.x,z:ESPIL_ARENA_INT.z+9},x:11,z:33};
      });
      return {x:ESPIL_ARENA_INT.x,z:ESPIL_ARENA_INT.z};
    };
    window.__espilArenaExitSpace=function(){
      var p=walkPlayer; if(!p)return;
      var out=espilInsideOutside;
      espilInsideDoor=null; espilInsideOutside=null; espilInsideHint=false;
      window.__espilInside=null;
      if(out){ p.pos.set(out.x,out.y,out.z); p.velY=0; }
    };
    /* ============ PLACE SPACE (building spaces, Han 2026-11-16) =====
       A building's OWN space, on the arena-space pattern: an
       instance slot in the store band (z >= 12000, derived by
       modules/place-space.js from the building's identity string),
       entry / exit teleports, a saved street point - but the entry
       record is an INTERIOR record (espilInsideRec is set), so the
       Konbiniya FPV predicate engages and the visit is true
       first-person with NO new camera code: eye 1.6 m, the avatar
       and its shadow hidden, A/D turn at the interior rate, attack
       inputs inert - all of it the existing interior machinery.
       modules/place-space.js builds the lobby, the signage and the
       storybook, and drives these two hooks. The space exists only
       in the child window the address boot shell hands over to;
       the street window never enters it. */
    var ESPIL_PLACE_WALK=4.5, ESPIL_PLACE_RUN=7.0;
    /* The place-mode entry start (called from espilEntryStart when
       the boot shell's mark is present): no saved-position restore,
       no dive, no arrival events - the player stands on the ground
       at the arrival pick until the city is loaded, the loader
       closes, and __espilPlaceSpaceReady tells the place-space
       module to summon the player into the lobby. */
    function espilPlaceEntryStart(){
      var p=walkPlayer; if(!p)return;
      espilInjectStyle();
      document.body.classList.add('espil-ui-pre');
      var pick=null; try{ pick=window.__espilSpawnPick||null; window.__espilSpawnPick=null; }catch(e){}
      var tx=pick?pick.x:3, tz=pick?pick.z:33;
      p.pos.x=tx; p.pos.z=tz; p.pos.y=0; p.velY=0; p.onGround=true; p.jumps=0;
      espilEntrySpawn={x:tx,z:tz};
      espilShowMapLoader();
      var tries=0;
      (function placeWhenReady(){
        if(!walkPlayer)return;
        if(espilEntryFullyLoaded()||++tries>125){
          espilHideMapLoader();
          espilUiRise();
          window.__espilPlaceSpaceReady=true;
          return;
        }
        setTimeout(placeWhenReady,200);
      })();
    }
    window.__espilPlaceEnterSpace=function(info){
      var p=walkPlayer; if(!p||!info)return null;
      /* NAME-ONLY ENTRY backstop (Han 2026-11-24): the child-window
         safeguard - this runs in the place child too, so a composed
         or directly-addressed child for an out-of-village building
         refuses the summon with the closed notice for the entrant
         population (no session record in this origin). Account
         sessions are never judged here. (An opener-less direct
         entry is the design's stated v1 limit: the child still
         boots its street arrival, it simply never enters the
         space.) */
      if(info.street&&espilGuestNow()){
        var cfgB=espilCityCfg();
        if(cfgB&&cfgB.landmark&&Math.hypot(info.street.x-cfgB.landmark.x,info.street.z-cfgB.landmark.z)>cfgB.landmark.radius){
          espilVillageNotice(espilTailT('villageClosed'));
          return null;
        }
      }
      if(p.flying||p._fall)espilFlyClear(); /* fly state clears on space entry, as on interior entry */
      /* The routed interior's entry framing: the FPV street zoom,
         restored on the same-window exit below. */
      if(typeof espilP1!=='undefined'&&espilP1&&espilP1.map){ espilIntPrevZoom=(typeof espilP1.zoomT==='number')?espilP1.zoomT:null; espilP1.zoomT=ESPIL_KB_P1_ZOOM; }
      espilInsideRec={cx:info.street.x, cz:info.street.z, name:info.name||'', placeSpace:true};
      espilInsideDoor={x:info.door.x, z:info.door.z};
      espilInsideOutside={x:info.street.x, y:0, z:info.street.z};
      var faceYaw=(typeof info.yaw==='number')?info.yaw:0;
      espilFadeThrough(function(){
        p.pos.set(info.spawn.x,0.05,info.spawn.z); p.velY=0; p.onGround=true;
        walkCamYaw=faceYaw;
        window.__espilInside={name:info.name||info.address||'Building',interior:true,placeSpace:true,place:{city:info.city,slug:info.slug},routedFrom:null,door:{x:info.door.x,z:info.door.z},x:info.street.x,z:info.street.z};
      });
      return {x:info.anchor.x, z:info.anchor.z};
    };
    /* The same-window exit (design 10-3c): only for a window with
       no opener (a direct address visit) - the space is released
       and the player steps back onto the street in front of the
       building. The child-window exit is a window close and never
       runs this. */
    window.__espilPlaceExitSpace=function(){
      var p=walkPlayer; if(!p)return;
      if(espilIntPrevZoom!==null&&typeof espilP1!=='undefined'&&espilP1&&espilP1.map){ espilP1.zoomT=espilIntPrevZoom; }
      espilIntPrevZoom=null;
      var out=espilInsideOutside;
      espilInsideRec=null; espilInsideDoor=null; espilInsideOutside=null; espilInsideHint=false;
      window.__espilInside=null;
      window.__espilPlaceSpaceRect=null;
      if(out&&p){
        var ep=(typeof espilResumeEdgePoint==='function')?espilResumeEdgePoint(out.x,out.z):null;
        var fx=ep?ep.x:out.x, fz=ep?ep.z:(out.z+8);
        p.pos.set(fx,0.05,fz); p.velY=0; p.onGround=true;
      }
    };
    /* ============ HOME SPACE (Han 2026-11-16) =====
       Every player's own home, on the arena-space pattern: an
       in-page instance teleport (the player really moves and
       presence follows - H is a repeated quick return, so the
       place space's child window and its per-press load do not
       fit), a slot derived purely from the player's identity,
       and an interior record, so the Konbiniya FPV predicate
       engages with no new camera code. The slot lives in its own
       band (z >= ESPIL_HOME_Z0, clear of the place band's end at
       22240) on a 128 x 128 grid at the place band's 320 m
       spacing; the hash input is namespaced ("home/<key>") so a
       home slot can never coincide with a place slot's input.
       Identity: a signed-in player's account UUID (the session
       record's uid, stored by entry-flow's serverSessionSync;
       a record written before uid existed falls back to its id -
       the display name - as the temporary key until the first
       sync rewrites it, design 8.1 hunk 9); a guest's device key
       (espil_home_key_v1, 128-bit random, made once on the first
       H press - guest data is device-scoped by canon). The name
       itself is never the key: names can change. Nothing is
       stored server-side in v1 - the slot is a pure derivation,
       so there is no Worker change and no migration. */
    var ESPIL_HOME_WALK=4.5, ESPIL_HOME_RUN=7.0;
    var ESPIL_HOME_Z0=24000, ESPIL_HOME_GRID=128, ESPIL_HOME_SPACING=320;
    var ESPIL_HOME_W=14, ESPIL_HOME_D=11, ESPIL_HOME_H=3.2;
    var ESPIL_HOME_KEY_LS='espil_home_key_v1';
    function espilHomeFnv1a(str){
      var h=2166136261;
      for(var i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);
      return h>>>0;
    }
    function espilHomeGuestKey(){
      try{
        var k=window.localStorage.getItem(ESPIL_HOME_KEY_LS);
        if(k)return k;
        var buf=new Uint8Array(16), hex='';
        if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(buf);
        else for(var i=0;i<16;i++)buf[i]=Math.floor(Math.random()*256);
        for(var j=0;j<16;j++){ var s=buf[j].toString(16); hex+=(s.length<2?'0':'')+s; }
        window.localStorage.setItem(ESPIL_HOME_KEY_LS,hex);
        return hex;
      }catch(e){ return 'volatile'; }
    }
    function espilHomeIdentityKey(){
      try{
        var s=JSON.parse(window.localStorage.getItem('espil_session_v1')||'null');
        if(s&&(s.uid||s.id))return 'acct:'+(s.uid||s.id);
      }catch(e){}
      return 'guest:'+espilHomeGuestKey();
    }
    function espilHomeSlotFor(key){
      var h=espilHomeFnv1a('home/'+key);
      var col=h%ESPIL_HOME_GRID, row=Math.floor(h/ESPIL_HOME_GRID)%ESPIL_HOME_GRID;
      return { x:(col-ESPIL_HOME_GRID/2)*ESPIL_HOME_SPACING, z:ESPIL_HOME_Z0+row*ESPIL_HOME_SPACING, slot:(row*ESPIL_HOME_GRID+col) };
    }
    function espilHomeOwnerName(){
      /* The sign over the door's opposite wall: the player's own
         display name, from the same sources presence.myName
         reads (the gate's name input, then the stored username).
         No name -> the sign just says Home. */
      try{
        var inp=document.getElementById('char-name');
        var v=inp?inp.value.trim():'';
        if(!v)v=(window.localStorage.getItem('espil_username')||'').trim();
        return v||null;
      }catch(e){ return null; }
    }
    var espilHomeGroup=null, espilHomeBuiltFor=null;
    function espilBuildHome(slot,key){
      if(espilHomeGroup&&espilHomeBuiltFor===key)return;
      if(espilHomeGroup&&typeof mapScene!=='undefined'&&mapScene){ mapScene.remove(espilHomeGroup); espilHomeGroup=null; }
      var g=new THREE.Group(); g.position.set(slot.x,0,slot.z);
      function M(geo,mat,x,y,z,ry){
        var m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(ry)m.rotation.y=ry;
        m.frustumCulled=false; g.add(m); return m;
      }
      function LM(c){ return new THREE.MeshLambertMaterial({color:c}); }
      var W=ESPIL_HOME_W, D=ESPIL_HOME_D, H=ESPIL_HOME_H;
      var fl=M(new THREE.PlaneGeometry(W,D),LM(0x8a6b4a),0,0.01,0); fl.rotation.x=-Math.PI/2;
      var rug=M(new THREE.PlaneGeometry(5,3.5),LM(0x74353a),0,0.03,0.6); rug.rotation.x=-Math.PI/2;
      var ce=M(new THREE.PlaneGeometry(W,D),LM(0xcfc9bb),0,H,0); ce.rotation.x=Math.PI/2;
      var lightMat=new THREE.MeshBasicMaterial({color:0xfff2cc});
      M(new THREE.PlaneGeometry(4,2),lightMat,0,H-0.05,0).rotation.x=Math.PI/2;
      var wallMat=LM(0xcfc8bb);
      M(new THREE.BoxGeometry(W,H,0.4),wallMat,0,H/2,-D/2);                 /* north */
      var segW=(W-2.4)/2;                                                   /* south, with the door gap */
      M(new THREE.BoxGeometry(segW,H,0.4),wallMat,-(1.2+segW/2),H/2,D/2);
      M(new THREE.BoxGeometry(segW,H,0.4),wallMat,(1.2+segW/2),H/2,D/2);
      M(new THREE.BoxGeometry(2.4,0.7,0.4),wallMat,0,H-0.35,D/2);           /* lintel */
      M(new THREE.BoxGeometry(0.4,H,D),wallMat,-W/2,H/2,0);                 /* west */
      M(new THREE.BoxGeometry(0.4,H,D),wallMat,W/2,H/2,0);                  /* east */
      var postMat=LM(0x6d5a41);
      M(new THREE.BoxGeometry(0.3,2.5,0.3),postMat,-1.2,1.25,D/2-0.1);      /* door frame */
      M(new THREE.BoxGeometry(0.3,2.5,0.3),postMat,1.2,1.25,D/2-0.1);
      var exitCvs=document.createElement('canvas'); exitCvs.width=256; exitCvs.height=96;
      var ectx=exitCvs.getContext('2d');
      ectx.fillStyle='#20242c'; ectx.fillRect(0,0,256,96);
      ectx.fillStyle='#8ef7e8'; ectx.font='700 56px "Avenir Next","Segoe UI",sans-serif';
      ectx.textAlign='center'; ectx.textBaseline='middle'; ectx.fillText('EXIT',128,50);
      var ex=M(new THREE.PlaneGeometry(1.5,0.56),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(exitCvs)}),0,2.15,D/2-0.25);
      ex.rotation.y=Math.PI;
      /* the owner's sign on the north wall, in the interior
         sign grammar (espilInteriorSetSign): drawn once, at
         build time, with the name the player carries now */
      var signCvs=document.createElement('canvas'); signCvs.width=1024; signCvs.height=256;
      var sctx=signCvs.getContext('2d');
      sctx.fillStyle='#20242c'; sctx.fillRect(0,0,1024,256);
      sctx.strokeStyle='rgba(142,247,232,.6)'; sctx.lineWidth=6; sctx.strokeRect(14,14,996,228);
      sctx.fillStyle='#eaf6ff'; sctx.font='600 84px "Avenir Next","Segoe UI",sans-serif';
      sctx.textAlign='center'; sctx.textBaseline='middle';
      var nm=espilHomeOwnerName();
      var label=nm?(nm+"'s Home"):'Home'; if(label.length>26)label=label.slice(0,25)+'...';
      sctx.fillText(label,512,128);
      M(new THREE.PlaneGeometry(6,1.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(signCvs)}),0,2.0,-D/2+0.25);
      /* fixed primitive props (design 5.1 - no furniture GLB
         exists in the tree): a low table on the rug, two bench
         sofas facing it, a two-tier shelf on the west wall, and
         a bed form in the north-east corner */
      var propMat=LM(0x6d5a41), softMat=LM(0x5a6b8a), shelfMat=LM(0x74563a);
      M(new THREE.BoxGeometry(1.8,0.45,0.9),propMat,0,0.23,0.6);
      M(new THREE.BoxGeometry(2.4,0.55,0.9),softMat,-1.5,0.28,-1.6);
      M(new THREE.BoxGeometry(2.4,0.55,0.9),softMat,1.5,0.28,-1.6);
      M(new THREE.BoxGeometry(0.45,0.07,2.6),shelfMat,-W/2+0.3,0.95,-2);
      M(new THREE.BoxGeometry(0.45,0.07,2.6),shelfMat,-W/2+0.3,1.55,-2);
      M(new THREE.BoxGeometry(0.45,1.9,0.07),shelfMat,-W/2+0.3,0.95,-3.28);
      M(new THREE.BoxGeometry(0.45,1.9,0.07),shelfMat,-W/2+0.3,0.95,-0.72);
      M(new THREE.BoxGeometry(2.1,0.4,1.2),propMat,5.2,0.2,-4.2);
      M(new THREE.BoxGeometry(1.2,0.06,1.24),softMat,5.55,0.43,-4.2);
      M(new THREE.BoxGeometry(0.5,0.18,0.8),LM(0xe8e2d2),4.35,0.49,-4.2);
      mapScene.add(g);
      espilHomeGroup=g; espilHomeBuiltFor=key;
    }
    window.__espilHomeEnterSpace=function(){
      var p=walkPlayer; if(!p)return null;
      if(p.flying||p._fall)espilFlyClear(); /* fly state clears on space entry, as on interior entry */
      var key=espilHomeIdentityKey();
      var slot=espilHomeSlotFor(key);
      espilBuildHome(slot,key);
      /* HOME THIRD-PERSON (Han 2026-11-17): no entry framing -
         the street third-person camera keeps its own zoom; the
         boom is contained in the room by the home branch of
         espilCamClampUpdate below. */
      espilInsideRec={cx:p.pos.x, cz:p.pos.z, name:'Home', home:true};
      espilInsideDoor={x:slot.x, z:slot.z+ESPIL_HOME_D/2-0.6};
      espilInsideOutside={x:p.pos.x, y:p.pos.y, z:p.pos.z};
      window.__espilHomeRect={x0:slot.x-ESPIL_HOME_W/2, z0:slot.z-ESPIL_HOME_D/2, x1:slot.x+ESPIL_HOME_W/2, z1:slot.z+ESPIL_HOME_D/2};
      espilFadeThrough(function(){
        p.pos.set(slot.x,0.05,slot.z+ESPIL_HOME_D/2-2.4); p.velY=0; p.onGround=true;
        walkCamYaw=0; /* the spawn stands inside the south door, facing into the room */
        window.__espilInside={name:'Home',interior:true,home:true,routedFrom:null,door:{x:slot.x,z:slot.z+ESPIL_HOME_D/2-0.6},x:espilInsideOutside.x,z:espilInsideOutside.z};
      });
      return {x:slot.x, z:slot.z};
    };
    /* The home exit: back to the exact point H was pressed at,
       through the approved footprint-edge relocation when that
       point now sits inside a footprint (the place exit's rule);
       a corrupt saved point falls back to the spawn pin (3, 33)
       so the exit never strands the player in the air. */
    window.__espilHomeExitSpace=function(){
      var p=walkPlayer; if(!p)return;
      var out=espilInsideOutside;
      espilInsideRec=null; espilInsideDoor=null; espilInsideOutside=null; espilInsideHint=false;
      window.__espilInside=null;
      window.__espilHomeRect=null;
      var fx=null, fz=null;
      if(out&&isFinite(out.x)&&isFinite(out.z)){
        var ep=null;
        try{ ep=(typeof espilResumeEdgePoint==='function')?espilResumeEdgePoint(out.x,out.z):null; }catch(e){ ep=null; }
        fx=ep?ep.x:out.x; fz=ep?ep.z:out.z;
      }
      if(fx===null){ fx=3; fz=33; }
      p.pos.set(fx,0.05,fz); p.velY=0; p.onGround=true;
    };
    window.__espilHomeState=function(){
      var ins=window.__espilInside||null;
      var key=null, slot=null;
      /* read-only peek: the guest key is made on the first H
         press (design 8.1 hunk 10), never by an inspection */
      try{
        var s=JSON.parse(window.localStorage.getItem('espil_session_v1')||'null');
        if(s&&(s.uid||s.id))key='acct:'+(s.uid||s.id);
        else{ var gk=window.localStorage.getItem(ESPIL_HOME_KEY_LS); if(gk)key='guest:'+gk; }
        if(key)slot=espilHomeSlotFor(key);
      }catch(e){}
      return { inside:!!(ins&&ins.home), identityKey:key,
        anchor:slot?{x:slot.x,z:slot.z,slot:slot.slot}:null,
        rect:window.__espilHomeRect||null,
        returnPoint:espilInsideOutside?{x:espilInsideOutside.x,z:espilInsideOutside.z}:null,
        builtFor:espilHomeBuiltFor };
    };
    function openBuildingOpts(){
      var o=document.getElementById('bldg-opts'); if(!o)return;
      var n=document.getElementById('bldg-opts-name'); if(n)n.textContent=espilInsideRouted?'Konbiniya':espilBldgName;
      var m=document.getElementById('bldg-opts-main'); if(m)m.style.display='flex';
      var c=document.getElementById('bldg-contact'); if(c)c.style.display='none';
      o.classList.add('open'); o.setAttribute('aria-hidden','false');
    }
    function closeBuildingOpts(){
      var o=document.getElementById('bldg-opts'); if(!o)return;
      o.classList.remove('open'); o.setAttribute('aria-hidden','true');
    }
    function espilInsideStores(){
      var rec=espilInsideRec; if(!rec)return;
      var cand=espilBldgCandidate(rec);
      var target=(cand&&cand.id&&typeof getBuildingById==='function'&&getBuildingById(cand.id))||cand||{x:rec.cx,z:rec.cz};
      closeBuildingOpts();
      if(typeof fetchNearbyStores==='function'){
        fetchNearbyStores(target,function(stores){
          if(stores&&stores.length>0){ showStoreModal(stores,espilBldgName||''); }
          else if(window.__espilToast)window.__espilToast('No stores found in this building');
        });
      }
    }
    function espilFetchContact(rec, done){
      var ll=mapToLatLng(rec.cx,rec.cz);
      /* Baked open data (Han 2026-10-29) names the building and
         gives its street address; phone, website and email are
         not part of the open data and stay unlisted. */
      if(window.__espilBakedFor){
        window.__espilBakedFor({x:rec.cx,z:rec.cz}).then(function(bp){
          if(bp&&(bp.name||bp.addr)){
            done([['Name',bp.name||espilBldgName],['Address',bp.addr||'Not listed'],['Phone','Not listed'],['Website','Not listed'],['Email','Not listed']]);
            return;
          }
          done([['Name',espilBldgName],['Address',ll.lat.toFixed(5)+', '+ll.lng.toFixed(5)],['Phone','Not listed'],['Website','Not listed'],['Email','Not listed']]);
        });
        return;
      }
      done([['Name',espilBldgName],['Address',ll.lat.toFixed(5)+', '+ll.lng.toFixed(5)],['Phone','Not listed'],['Website','Not listed'],['Email','Not listed']]);
    }
    function espilInsideContact(){
      var rec=espilInsideRec; if(!rec)return;
      var m=document.getElementById('bldg-opts-main'); if(m)m.style.display='none';
      var c=document.getElementById('bldg-contact'); if(c)c.style.display='block';
      var lines=document.getElementById('bldg-contact-lines'); if(lines)lines.textContent='Loading...';
      espilFetchContact(rec,function(rows){
        if(!window.__espilInside)return;
        if(lines)lines.innerHTML=rows.map(function(r){return '<b>'+r[0]+':</b> '+(r[1]||'Not listed');}).join('<br>');
      });
    }
    /* ============ INTERIOR RIGHTS (Han 2026-10-20, batch 6 #6
       adjustment) ================================================
       Interior decoration and shop operation belong to the
       building's side, never to visitors: decorating opens only
       to a designer the building owner has registered, and
       operating only to the owner/operator side. At this stage
       the operator (Han) is the sole registered designer AND the
       sole operator for every building, so no visitor path to
       decorate or operate exists - the shop UI's Design button
       renders disabled from espilInteriorRights(), and every
       future design/operate entry point must pass this gate
       first. Guests have no identity yet (espilCurrentIdentity
       returns null), so both rights read false for everyone
       until the account track lands; the registry then moves
       server-side with it. Buying as a customer is not
       operation and stays open to everyone. */
    var ESPIL_OPERATOR_ID='operator:han';
    var espilDesignerRegistry={}; /* building key -> designer id; empty = the operator's design stands */
    function espilCurrentIdentity(){ return null; }
    function espilBldgKeyOf(rec){
      if(!rec)return 'none';
      var cand=(typeof espilBldgCandidate==='function')?espilBldgCandidate(rec):null;
      if(cand&&cand.id)return cand.id;
      return 'osm:'+Math.round(rec.cx)+','+Math.round(rec.cz);
    }
    function espilInteriorRights(rec){
      var me=espilCurrentIdentity();
      var designer=espilDesignerRegistry[espilBldgKeyOf(rec)]||ESPIL_OPERATOR_ID;
      var isOperator=!!me&&me===ESPIL_OPERATOR_ID;
      return { design:isOperator||(!!me&&me===designer), operate:isOperator, designer:designer };
    }
    window.__espilInteriorRights=function(){ return espilInteriorRights(espilInsideRec); };
    /* ============ CLASSIC SHOP (Han batch 6 #6) ==================
       The interior's interface, laid out on the classic shop
       screen grammar Han pointed at (the Gamania-era convenience
       store / fast-food shop): a greeting from the shop, a grid of
       goods with prices, the player's purse, buy buttons, tabs.
       Goods and art are this build's own; the Leo purse is local
       until the backend track (Phase B) gives it a server home. */
    var ESPIL_SHOP_STOCK={
      convenience:[['Triangle Kimbap',120,'#e8e3d5'],['Cup Ramen',150,'#d96b4f'],['Cola',90,'#b3312c'],['Iced Coffee',110,'#6b4a2f'],['Banana Milk',110,'#f2d13c'],['Choco Bar',60,'#5a3a22'],['Umbrella',450,'#3c6e91'],['Batteries AA',210,'#7d8894'],['Hot Pack',80,'#c9532f'],['Mineral Water',50,'#7fb8d8']],
      fastfood:[['Burger Set',590,'#d98e2b'],['Cheeseburger',420,'#e0aa3c'],['Fries',180,'#e8c53a'],['Chicken Strips',460,'#c96a34'],['Cola',90,'#b3312c'],['Coffee',110,'#6b4a2f'],['Nuggets (6)',320,'#d9a03c'],['Sundae',150,'#e8e3d5']]
    };
    var espilShopBag=[];
    function espilLeoBalance(){ var v=parseInt(localStorage.getItem('espil_leo_balance'),10); return isNaN(v)?1000:v; }
    function espilLeoPaint(){ var p=document.getElementById('shop-purse'); if(p)p.textContent='Leo '+espilLeoBalance().toLocaleString('en-US'); }
    function espilLeoSet(v){ try{localStorage.setItem('espil_leo_balance',String(v));}catch(e){} espilLeoPaint(); }
    function espilShopTheme(stores){
      if(stores&&stores.length){
        var t=((stores[0].primaryType||'')+' '+(stores[0].name||'')).toLowerCase();
        if(/restaurant|fast_food|cafe|coffee|bakery|meal|food/.test(t))return 'fastfood';
      }
      return 'convenience';
    }
    function espilShopRender(stock){
      var grid=document.getElementById('shop-grid'); if(!grid)return;
      grid.innerHTML='';
      stock.forEach(function(it){
        var card=document.createElement('div');
        card.style.cssText='border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px;text-align:center;';
        var tile=document.createElement('div'); tile.style.cssText='height:34px;border-radius:6px;background:'+it[2]+';';
        var name=document.createElement('div'); name.textContent=it[0]; name.style.cssText='margin-top:6px;font-size:.82rem;';
        var price=document.createElement('div'); price.textContent='Leo '+it[1]; price.style.cssText='opacity:.75;font-size:.78rem;';
        var buy=document.createElement('button'); buy.className='pill-btn'; buy.textContent='Buy'; buy.style.cssText='margin-top:6px;';
        buy.addEventListener('click',function(){ espilShopBuy(it); });
        card.appendChild(tile); card.appendChild(name); card.appendChild(price); card.appendChild(buy);
        grid.appendChild(card);
      });
    }
    function espilShopBuy(it){
      var bal=espilLeoBalance();
      if(bal<it[1]){ if(window.__espilToast)window.__espilToast('Not enough Leo for '+it[0]); return; }
      espilLeoSet(bal-it[1]);
      espilShopBag.push(it[0]);
      var bag=document.getElementById('shop-bag'); if(bag)bag.textContent='Your bag: '+espilShopBag.join(', ');
      if(window.__espilToast)window.__espilToast('Bought '+it[0]+' for Leo '+it[1]);
      try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'bought',item:it[0]}})); }catch(e){} /* guide hook */
    }
    function espilShopShowTab(which){
      var g=document.getElementById('shop-grid'), c=document.getElementById('shop-contact');
      if(which==='contact'){ if(g)g.style.display='none'; if(c)c.style.display='block'; espilShopContact(); }
      else{ if(g)g.style.display='grid'; if(c)c.style.display='none'; }
    }
    function espilShopContact(){
      var lines=document.getElementById('shop-contact-lines'); if(!lines)return;
      var rec=espilInsideRec; if(!rec){ lines.textContent='No building selected.'; return; }
      lines.textContent='Loading...';
      espilFetchContact(rec,function(rows){
        if(!window.__espilInside)return;
        lines.innerHTML=rows.map(function(r){return '<b>'+r[0]+':</b> '+(r[1]||'Not listed');}).join('<br>');
      });
    }
    function espilOpenShop(){
      var o=document.getElementById('shop-ui'); if(!o)return;
      var nm=document.getElementById('shop-name'); if(nm)nm.textContent=espilBldgName;
      var gr=document.getElementById('shop-greet'); if(gr)gr.textContent='Welcome to '+espilBldgName+'. Take your time.';
      var db=document.getElementById('shop-design');
      if(db){ var r=espilInteriorRights(espilInsideRec); db.disabled=!r.design; db.title=r.design?'Open the interior design tools':'Only the designer registered by the building owner can decorate this interior'; }
      espilLeoPaint();
      espilShopShowTab('shop');
      espilShopRender(ESPIL_SHOP_STOCK.convenience);
      o.classList.add('open'); o.setAttribute('aria-hidden','false');
      var rec=espilInsideRec;
      if(rec&&typeof fetchNearbyStores==='function'){
        var cand=espilBldgCandidate(rec);
        var target=(cand&&cand.id&&typeof getBuildingById==='function'&&getBuildingById(cand.id))||cand||{x:rec.cx,z:rec.cz};
        fetchNearbyStores(target,function(stores){
          if(!window.__espilInside)return;
          espilShopRender(ESPIL_SHOP_STOCK[espilShopTheme(stores)]);
        });
      }
    }
    function espilCloseShop(){
      var o=document.getElementById('shop-ui'); if(!o)return;
      o.classList.remove('open'); o.setAttribute('aria-hidden','true');
    }
    function espilBuildShopFitout(){
      window.__espilShopBuilt=true;
      var g=new THREE.Group(); g.position.set(ESPIL_INT.x,0,ESPIL_INT.z);
      function M(geo,mat,x,y,z,ry){
        var m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(ry)m.rotation.y=ry;
        m.frustumCulled=false; g.add(m); return m;
      }
      function LM(c){ var m=new THREE.MeshLambertMaterial({color:c}); return m; }
      /* the serving counter across the back wall and the house
         sign's menu board above it - the classic shop arrangement,
         all original low-poly. (The clerk figure that stood behind
         the counter was removed with the NPCs, Han 2026-11-25.) */
      M(new THREE.BoxGeometry(12,1.05,1.1),LM(0x8a6f4d),0,0.53,-6.9);
      M(new THREE.BoxGeometry(12,0.08,1.3),LM(0xd8d2c4),0,1.09,-6.9);
      var mc=document.createElement('canvas'); mc.width=1024; mc.height=224;
      var mx2=mc.getContext('2d');
      mx2.fillStyle='#20242c'; mx2.fillRect(0,0,1024,224);
      mx2.strokeStyle='rgba(142,247,232,.55)'; mx2.lineWidth=5; mx2.strokeRect(10,10,1004,204);
      mx2.fillStyle='#ffd98a'; mx2.font='700 44px "Avenir Next","Segoe UI",sans-serif'; mx2.textAlign='left';
      mx2.fillText('MENU',36,58);
      mx2.fillStyle='#eaf6ff'; mx2.font='34px "Avenir Next","Segoe UI",sans-serif';
      mx2.fillText('Burger Set ........ Leo 590',36,118);
      mx2.fillText('Triangle Kimbap ... Leo 120',36,168);
      mx2.fillText('Cup Ramen ......... Leo 150',520,118);
      mx2.fillText('Iced Coffee ....... Leo 110',520,168);
      M(new THREE.PlaneGeometry(7.6,1.66),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(mc)}),0,2.45,-7.98);
      /* stocked product rows on both side shelves */
      var cols=[0xd96b4f,0x3c6e91,0xf2d13c,0x7fb069,0xb3312c,0xe8e3d5,0x6b4a2f,0x7fb8d8];
      [-12.2,12.2].forEach(function(sx){
        var px=sx<0?sx+0.48:sx-0.48;
        for(var s=0;s<3;s++){
          for(var i2=0;i2<7;i2++){
            M(new THREE.BoxGeometry(0.34,0.3,0.5),LM(cols[(s*7+i2)%cols.length]),px,0.62+s*0.62,-0.6+i2*0.85);
          }
        }
      });
      /* the fridge case on the east wall */
      M(new THREE.BoxGeometry(0.8,2.1,3.4),LM(0x9fb6c4),11.9,1.05,4.6);
      M(new THREE.PlaneGeometry(3.2,1.9),new THREE.MeshBasicMaterial({color:0xbfe6f5,transparent:true,opacity:0.35}),11.48,1.05,4.6,-Math.PI/2);
      /* the fast-food corner: two tables, four stools */
      [[-4.5,3.4],[3.8,3.8]].forEach(function(tp){
        M(new THREE.CylinderGeometry(0.55,0.55,0.05,14),LM(0xe8e3d5),tp[0],0.78,tp[1]);
        M(new THREE.CylinderGeometry(0.06,0.06,0.78,8),LM(0x8b8f96),tp[0],0.39,tp[1]);
        M(new THREE.CylinderGeometry(0.26,0.26,0.09,10),LM(0xb3312c),tp[0]-0.95,0.45,tp[1]);
        M(new THREE.CylinderGeometry(0.26,0.26,0.09,10),LM(0xb3312c),tp[0]+0.95,0.45,tp[1]);
      });
      /* the kiosk terminal by the entrance (v3) */
      M(new THREE.BoxGeometry(0.9,1.25,0.5),LM(0x2b3440),3.6,0.63,3.4);
      M(new THREE.BoxGeometry(1.0,0.06,0.62),LM(0x8ef7e8),3.6,1.28,3.4);
      var kbCvs=document.createElement('canvas'); kbCvs.width=256; kbCvs.height=320;
      var kx2=kbCvs.getContext('2d');
      kx2.fillStyle='#0d2b33'; kx2.fillRect(0,0,256,320);
      kx2.strokeStyle='#8ef7e8'; kx2.lineWidth=6; kx2.strokeRect(10,10,236,300);
      kx2.fillStyle='#8ef7e8'; kx2.font='800 44px "Avenir Next","Segoe UI",sans-serif'; kx2.textAlign='center';
      kx2.fillText('ORDER',128,110);
      kx2.font='700 30px "Avenir Next","Segoe UI",sans-serif'; kx2.fillStyle='#eaf6ff';
      kx2.fillText('KIOSK',128,160);
      kx2.fillStyle='#ffd23c'; kx2.beginPath(); kx2.arc(128,228,26,0,6.29); kx2.fill();
      var kbScr=M(new THREE.PlaneGeometry(0.72,0.9),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(kbCvs)}),3.6,1.33,3.67);
      kbScr.rotation.x=-0.18;
      mapScene.add(g); window.__espilFitoutGroup=g;
    }
    function espilInsideTick(p){
      if(!window.__espilInside)return;
      if(!document.body.classList.contains('in-map')){ espilInsideRec=null; espilInsideDoor=null; espilInsideOutside=null; window.__espilInside=null; espilCloseShop(); closeBuildingOpts(); return; }
      /* ARENA SEAM: inside the arena space the shop-room box clamp
         does not apply - the player is held on the arena disc
         (radius 26 around ESPIL_ARENA_INT) instead, and the door
         hint names the arena exit. */
      if(window.__espilInside.arena){
        var _acx=p.pos.x-ESPIL_ARENA_INT.x, _acz=p.pos.z-ESPIL_ARENA_INT.z, _acr=Math.sqrt(_acx*_acx+_acz*_acz);
        if(_acr>25.4){ p.pos.x=ESPIL_ARENA_INT.x+_acx/_acr*25.4; p.pos.z=ESPIL_ARENA_INT.z+_acz/_acr*25.4; }
        var _add=espilInsideDoor?Math.sqrt((p.pos.x-espilInsideDoor.x)*(p.pos.x-espilInsideDoor.x)+(p.pos.z-espilInsideDoor.z)*(p.pos.z-espilInsideDoor.z)):99;
        if(_add<1.8&&!espilInsideHint){ espilInsideHint=true; if(window.__espilToast)window.__espilToast('Press Space to leave the arena'); }
        if(_add>=1.8)espilInsideHint=false;
        return;
      }
      /* PLACE SPACE (Han 2026-11-16, design 5): inside a building's
         own space the shop-room box clamp does not apply - the
         player is held inside the lobby rectangle the place-space
         module published (0.6 m wall margin), and the door hint
         names the space exit. */
      if(window.__espilInside.placeSpace){
        var _pr=window.__espilPlaceSpaceRect;
        if(_pr){
          if(p.pos.x<_pr.x0+0.6)p.pos.x=_pr.x0+0.6;
          if(p.pos.x>_pr.x1-0.6)p.pos.x=_pr.x1-0.6;
          if(p.pos.z<_pr.z0+0.6)p.pos.z=_pr.z0+0.6;
          if(p.pos.z>_pr.z1-0.6)p.pos.z=_pr.z1-0.6;
        }
        var _pdd=espilInsideDoor?Math.sqrt((p.pos.x-espilInsideDoor.x)*(p.pos.x-espilInsideDoor.x)+(p.pos.z-espilInsideDoor.z)*(p.pos.z-espilInsideDoor.z)):99;
        if(_pdd<1.8&&!espilInsideHint){ espilInsideHint=true; if(window.__espilToast)window.__espilToast('Press Space to leave'); }
        if(_pdd>=1.8)espilInsideHint=false;
        return;
      }
      /* HOME SPACE (Han 2026-11-16, design 8.1 hunk 3): inside the
         player's own home the shop-room box clamp does not apply
         either - the player is held inside the home rectangle
         (0.6 m wall margin), and the door hint names the exit. */
      if(window.__espilInside.home){
        var _hr=window.__espilHomeRect;
        if(_hr){
          if(p.pos.x<_hr.x0+0.6)p.pos.x=_hr.x0+0.6;
          if(p.pos.x>_hr.x1-0.6)p.pos.x=_hr.x1-0.6;
          if(p.pos.z<_hr.z0+0.6)p.pos.z=_hr.z0+0.6;
          if(p.pos.z>_hr.z1-0.6)p.pos.z=_hr.z1-0.6;
        }
        var _hdd=espilInsideDoor?Math.sqrt((p.pos.x-espilInsideDoor.x)*(p.pos.x-espilInsideDoor.x)+(p.pos.z-espilInsideDoor.z)*(p.pos.z-espilInsideDoor.z)):99;
        if(_hdd<1.8&&!espilInsideHint){ espilInsideHint=true; if(window.__espilToast)window.__espilToast('Press Space to leave'); }
        if(_hdd>=1.8)espilInsideHint=false;
        return;
      }
      if(p.pos.x<ESPIL_INT.x-11.5*espilIntScale.x)p.pos.x=ESPIL_INT.x-11.5*espilIntScale.x;
      if(p.pos.x>ESPIL_INT.x+11.5*espilIntScale.x)p.pos.x=ESPIL_INT.x+11.5*espilIntScale.x;
      if(p.pos.z<ESPIL_INT.z-6.1*espilIntScale.z)p.pos.z=ESPIL_INT.z-6.1*espilIntScale.z;
      if(p.pos.z>ESPIL_INT.z+7.3*espilIntScale.z)p.pos.z=ESPIL_INT.z+7.3*espilIntScale.z;
      var doorD=espilInsideDoor?Math.sqrt((p.pos.x-espilInsideDoor.x)*(p.pos.x-espilInsideDoor.x)+(p.pos.z-espilInsideDoor.z)*(p.pos.z-espilInsideDoor.z)):99;
      if(doorD<1.8&&!espilInsideHint){ espilInsideHint=true; if(window.__espilToast)window.__espilToast('Press Space to leave the building'); }
      if(doorD>=1.8)espilInsideHint=false;
      var _ks2=(typeof window.__espilKioskState==='function')?window.__espilKioskState():null;
      if(_ks2&&_ks2.d<2.2&&!espilKioskHint){ espilKioskHint=true; if(window.__espilToast)window.__espilToast('Press Space to use the kiosk'); }
      if(_ks2&&_ks2.d>=2.2)espilKioskHint=false;
    }
    /* RETIRED (Han batch 5 #1): the shared-room teleport is gone -
       entering is in-place now (espilEnterInside). These remain as
       safety shims so no stale caller can strand the player. */
    function espilEnterInterior(){
      if(espilBldgPanelRec)espilEnterInside(espilBldgPanelRec);
    }
    function espilExitInterior(){ espilLeaveBuilding(); }
    var espilIntGroup=null, espilIntScale={x:1,z:1};
    var espilIntPrevZoom=null; /* map zoom before entry framing, restored on leave */
    var espilKioskHint=false;
    var espilIntSignCanvas=null;
    function espilInteriorSetSign(name){
      if(!espilIntSignCanvas)return;
      var ctx=espilIntSignCanvas.getContext('2d');
      ctx.fillStyle='#20242c'; ctx.fillRect(0,0,1024,256);
      ctx.strokeStyle='rgba(142,247,232,.6)'; ctx.lineWidth=6; ctx.strokeRect(14,14,996,228);
      ctx.fillStyle='#eaf6ff'; ctx.font='600 84px "Avenir Next","Segoe UI",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      var label=String(name||'Building'); if(label.length>26)label=label.slice(0,25)+'...';
      ctx.fillText(label,512,128);
      if(espilIntSignCanvas._tex)espilIntSignCanvas._tex.needsUpdate=true;
    }
    function espilBuildInterior(){
      window.__espilInteriorBuilt=true;
      var g=new THREE.Group(); g.position.set(ESPIL_INT.x,0,ESPIL_INT.z);
      espilIntGroup=g;
      function M(geo,mat,x,y,z,ry){
        var m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(ry)m.rotation.y=ry;
        m.frustumCulled=false; g.add(m); return m;
      }
      var floorMat=new THREE.MeshLambertMaterial({color:0x4a4238});       var fl=M(new THREE.PlaneGeometry(26,18),floorMat,0,0.01,0); fl.rotation.x=-Math.PI/2;
      var rugMat=new THREE.MeshLambertMaterial({color:0x74353a});       var rug=M(new THREE.PlaneGeometry(10,7),rugMat,0,0.03,0); rug.rotation.x=-Math.PI/2;
      var wallMat=new THREE.MeshLambertMaterial({color:0xcfc8bb});       M(new THREE.BoxGeometry(26,3.4,0.4),wallMat,0,1.7,-8.2);
      M(new THREE.BoxGeometry(11.2,3.4,0.4),wallMat,-7.4,1.7,8.2);
      M(new THREE.BoxGeometry(11.2,3.4,0.4),wallMat,7.4,1.7,8.2);
      M(new THREE.BoxGeometry(2.6,0.7,0.4),wallMat,0,3.05,8.2);
      M(new THREE.BoxGeometry(0.4,3.4,16),wallMat,-12.8,1.7,0);
      M(new THREE.BoxGeometry(0.4,3.4,16),wallMat,12.8,1.7,0);
      var propMat=new THREE.MeshLambertMaterial({color:0x6d5a41});       M(new THREE.BoxGeometry(4.4,1.05,1.2),propMat,-6,0.53,-6.9);
      M(new THREE.BoxGeometry(4.4,1.05,1.2),propMat,6,0.53,-6.9);
      M(new THREE.BoxGeometry(0.7,2.2,6),propMat,-12.2,1.1,2);
      M(new THREE.BoxGeometry(0.7,2.2,6),propMat,12.2,1.1,2);
      var lightMat=new THREE.MeshBasicMaterial({color:0xfff2cc});
      M(new THREE.PlaneGeometry(7,3),lightMat,0,3.35,0).rotation.x=Math.PI/2;
      espilIntSignCanvas=document.createElement('canvas');
      espilIntSignCanvas.width=1024; espilIntSignCanvas.height=256;
      var signTex=new THREE.CanvasTexture(espilIntSignCanvas);
      espilIntSignCanvas._tex=signTex;
      var signMat=new THREE.MeshBasicMaterial({map:signTex});
      M(new THREE.PlaneGeometry(8,2),signMat,0,2.0,-7.95);
      var exitCvs=document.createElement('canvas'); exitCvs.width=256; exitCvs.height=96;
      var ectx=exitCvs.getContext('2d');
      ectx.fillStyle='#20242c'; ectx.fillRect(0,0,256,96);
      ectx.fillStyle='#8ef7e8'; ectx.font='700 56px "Avenir Next","Segoe UI",sans-serif';
      ectx.textAlign='center'; ectx.textBaseline='middle'; ectx.fillText('EXIT',128,50);
      var exitMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(exitCvs)});
      var ex=M(new THREE.PlaneGeometry(1.5,0.56),exitMat,0,2.5,7.95); ex.rotation.y=Math.PI;
      mapScene.add(g);
      espilInteriorSetSign('Building');
    }
    var espilIntDoorHint=false;
    /* espilInteriorTick retired (batch 5): the shared-room clamp is
       gone; espilInsideTick (in the building module) owns the
       in-place interior now. */
    (function wireBldgPanel(){
      function onReady(){
        var e=document.getElementById('bldg-enter'), c=document.getElementById('bldg-cancel'), x=document.getElementById('bldg-close');
        if(e)e.addEventListener('click',espilEnterBuilding);
        /* Building entry by keyboard (Han 2026-10-28): while the
           building panel is open, Enter enters. Capture phase on
           document so it wins over the world keydown's
           Enter-opens-chat; the typing guard leaves chat and text
           fields on their own Enter. */
        document.addEventListener('keydown',function(ev){
          if(ev.key!=='Enter'||ev.repeat)return;
          var ae=document.activeElement,at=(ae&&ae.tagName)||'';
          if(/INPUT|TEXTAREA|SELECT/.test(at))return;
          var bp=document.getElementById('bldg-panel');
          if(bp&&bp.getAttribute('aria-hidden')==='false'&&espilBldgPanelRec){
            ev.preventDefault(); ev.stopPropagation();
            espilEnterBuilding();
          }
        },true);
        if(c)c.addEventListener('click',closeBuildingPanel);
        if(x)x.addEventListener('click',closeBuildingPanel);
        var sc=document.getElementById('shop-close'), sle=document.getElementById('shop-leave'), st1=document.getElementById('shop-tab-shop'), st2=document.getElementById('shop-tab-contact');
        var sd=document.getElementById('shop-design');
        if(sd)sd.addEventListener('click',function(){
          if(!espilInteriorRights(espilInsideRec).design)return; /* locked for everyone but the registered designer */
          if(window.__espilToast)window.__espilToast('The design tools arrive with the designer system');
        });
        if(sc)sc.addEventListener('click',espilCloseShop);
        if(sle)sle.addEventListener('click',espilLeaveBuilding);
        if(st1)st1.addEventListener('click',function(){espilShopShowTab('shop');});
        if(st2)st2.addEventListener('click',function(){espilShopShowTab('contact');});
        var os=document.getElementById('bldg-opt-stores'), oc=document.getElementById('bldg-opt-contact'), ol=document.getElementById('bldg-opt-leave'), ox=document.getElementById('bldg-opts-close'), ob=document.getElementById('bldg-contact-back');
        if(os)os.addEventListener('click',espilInsideStores);
        if(oc)oc.addEventListener('click',espilInsideContact);
        if(ol)ol.addEventListener('click',espilLeaveBuilding);
        if(ox)ox.addEventListener('click',closeBuildingOpts);
        if(ob)ob.addEventListener('click',function(){
          var m=document.getElementById('bldg-opts-main'); if(m)m.style.display='flex';
          var ct=document.getElementById('bldg-contact'); if(ct)ct.style.display='none';
        });
      }
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady); else onReady();
    })();

    function teleportHome(){
      /* HOME SPACE (Han 2026-11-16): H takes each player to their
         own home (the block above __espilHomeEnterSpace). Every
         guard lives here, in the one function both entry points
         call - the H key in the world key handler and the
         keyboard menu's HOME item - so both take the same rules.
         The matrix (design 7.1): already home -> leave (the
         toggle); inside any other instance (arena, a place
         space's child window, a routed interior) -> refuse, the
         street self is not in this window or the run owns the
         body; driving -> refuse, the car is a persistent object
         whose state machine a teleport would strand (building
         entry's auto-park belongs to arriving at a door on
         foot); dead -> refuse, the revive choice owns the body.
         Flying, swimming, an open stall and a guest's story in
         progress are NOT guards: flight clears on entry like
         every other space entry, and the rest never touch the
         home's mechanics. */
      /* Occupancy is read from the closure records, not only the
         published window record: every space entry sets
         espilInsideRec (interiors, place, home) and
         espilInsideOutside (all four, the arena included)
         synchronously, while window.__espilInside is published
         inside the entry fade - a guard that read the window
         record alone would stand open for the whole fade. */
      var ins=window.__espilInside, rec=(typeof espilInsideRec!=='undefined')?espilInsideRec:null;
      if((ins&&ins.home)||(rec&&rec.home)){ if(window.__espilHomeExitSpace)window.__espilHomeExitSpace(); return; }
      if(ins||rec||espilInsideOutside){ if(window.__espilToast)window.__espilToast('You cannot go home from here'); return; }
      if(espilDead){ if(window.__espilToast)window.__espilToast('You cannot go home right now'); return; }
      var veh=window.__espilVehicles;
      if(veh&&veh.state&&veh.state().driving){ if(window.__espilToast)window.__espilToast('You cannot go home while driving'); return; }
      if(window.__espilHomeEnterSpace)window.__espilHomeEnterSpace();
    }
    /* ---- Chat window (2026-10-11, Han 2026-10-05 spec): always-on log,
       high-transparency bg, text legible, Enter activates input.
       Local single-player only — real multiplayer needs the server. ---- */
    var chatWindow=null,chatLog=null,chatInput=null,chatTyping=false,chatWelcomed=false;
    function initChat(){
      chatWindow=document.getElementById('chat-window');
      chatLog=document.getElementById('chat-log');
      chatInput=document.getElementById('chat-input');
      if(!chatWindow||!chatLog||!chatInput)return;
      chatInput.addEventListener('keydown',function(e){
        e.stopPropagation(); /* game keys must not fire while typing */
        if(e.key==='Enter'){e.preventDefault();sendChat();}
        else if(e.key==='Escape'){e.preventDefault();setChatTyping(false);}
      });
      chatInput.addEventListener('blur',function(){setChatTyping(false);});
      var chips=chatWindow.querySelectorAll('.chat-channel');
      Array.prototype.forEach.call(chips,function(c){ c.addEventListener('click',function(){ Array.prototype.forEach.call(chips,function(x){x.classList.remove('is-active');}); c.classList.add('is-active'); }); });
      var expBtn=document.getElementById('chat-expand');
      if(expBtn)expBtn.addEventListener('click',function(){ chatWindow.classList.toggle('is-expanded'); expBtn.textContent=chatWindow.classList.contains('is-expanded')?'\u2212':'+'; });
      /* Mobile chat (Han 2026-11-05): on coarse pointers the chat sits
         at the TOP of the screen (pair.css coarse block) - tapping the
         window toggles the half-screen state (.is-expanded = 50dvh in
         the coarse CSS, log scrollable, input shown). Taps landing on
         the input or the head buttons keep their own job. Desktop is
         untouched: the expand button above stays its only toggle. */
      if(window.matchMedia&&matchMedia('(pointer:coarse)').matches){
        chatWindow.addEventListener('click',function(e){
          if(e.target&&e.target.closest&&e.target.closest('input,button'))return;
          chatWindow.classList.toggle('is-expanded');
          if(chatWindow.classList.contains('is-expanded'))chatLog.scrollTop=chatLog.scrollHeight;
        });
      }
    }
    function setChatTyping(on){
      chatTyping=!!on;
      if(chatWindow)chatWindow.classList.toggle('typing',chatTyping);
      if(chatInput){
        if(chatTyping){try{chatInput.focus({preventScroll:true});}catch(e){chatInput.focus();}}
        else chatInput.blur();
      }
    }
    function addChatMsg(who,text,sys){
      if(!chatLog)return;
      var d=document.createElement('div');
      d.className='chat-msg'+(sys?' sys':'');
      if(sys){d.textContent=text;}
      else{
        var w=document.createElement('span');w.className='who';w.textContent=who+': ';
        var t=document.createElement('span');t.className='txt';t.textContent=text;
        d.appendChild(w);d.appendChild(t);
      }
      chatLog.appendChild(d);
      while(chatLog.children.length>50)chatLog.removeChild(chatLog.firstChild);
      chatLog.scrollTop=chatLog.scrollHeight;
    }
    var chatBubble=null,chatBubbleUntil=0,chatBubbleV=null;
    function showChatBubble(text){
      if(!chatBubble)chatBubble=document.getElementById('chat-bubble');
      if(!chatBubble)return;
      chatBubble.textContent=text;
      chatBubbleUntil=performance.now()+4500;
    }
    setInterval(function(){
      if(!chatBubble)chatBubble=document.getElementById('chat-bubble');
      if(!chatBubble)return;
      if(performance.now()<chatBubbleUntil&&typeof walkPlayer!=='undefined'&&walkPlayer&&typeof mapCamera!=='undefined'&&mapCamera&&document.body.classList.contains('in-map')){
        if(!chatBubbleV)chatBubbleV=new THREE.Vector3();
        chatBubbleV.set(walkPlayer.pos.x,walkPlayer.pos.y+2.15,walkPlayer.pos.z).project(mapCamera);
        if(chatBubbleV.z<1&&chatBubbleV.z>-1&&Math.abs(chatBubbleV.x)<1.1&&Math.abs(chatBubbleV.y)<1.1){
          chatBubble.style.left=((chatBubbleV.x*.5+.5)*window.innerWidth)+'px';
          chatBubble.style.top=((-chatBubbleV.y*.5+.5)*window.innerHeight)+'px';
          chatBubble.style.display='block';
        } else chatBubble.style.display='none';
      } else chatBubble.style.display='none';
    },50);
    /* Guide (SELL) bubble (joint guide project, 2026-10-21): the UI
       guide layer writes the chat line and emits 'sell-bubble'; the
       world side shows the bubble over the character and marks it
       with the layer's .sell class for the bubble's own 4.5 s life. */
    function espilSellBubble(text){
      try{
        showChatBubble(text||'(SELL) Onigiri');
        if(!chatBubble)chatBubble=document.getElementById('chat-bubble');
        if(chatBubble){ chatBubble.classList.add('sell');
          setTimeout(function(){ try{ chatBubble.classList.remove('sell'); }catch(_){} },4500); }
      }catch(_){}
    }
    window.addEventListener('espil-chat-recv',function(e){
      if(e&&e.detail)addChatMsg(e.detail.who||'',e.detail.text||'',!!e.detail.sys);
    });
    var __espilRemoteMarkers={};
    window.__espilMinimapSet=function(id,x,z,info){
      if(typeof L==='undefined'||!leafletMap||typeof gameToLatLng!=='function')return;
      var ll=gameToLatLng(x,z);
      var mk=__espilRemoteMarkers[id];
      if(!mk){
        var nm=((info&&info.name)||'Guest').replace(/[<>&"']/g,'');
        var col=(info&&info.gender==='f')?'#e77fc0':'#7fc97f';
        mk=L.marker(ll,{interactive:false,icon:L.divIcon({className:'',html:'<div style="text-align:center;"><div style="width:12px;height:12px;margin:0 auto;border-radius:50%;background:'+col+';border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);"></div><div style="font-size:9px;color:#fff;text-shadow:0 1px 3px #000;white-space:nowrap;">'+nm+'</div></div>',iconSize:[42,26],iconAnchor:[21,6]})}).addTo(leafletMap);
        __espilRemoteMarkers[id]=mk;
      } else mk.setLatLng(ll);
    };
    window.__espilMinimapRemove=function(id){ var mk=__espilRemoteMarkers[id]; if(mk){ try{ leafletMap.removeLayer(mk); }catch(_){} delete __espilRemoteMarkers[id]; } };
    window.__espilMinimapClear=function(){ for(var k in __espilRemoteMarkers)window.__espilMinimapRemove(k); };
    window.__espilPlayerPose=function(){ if(typeof walkPlayer==='undefined'||!walkPlayer||!walkPlayer.pos)return null; return {x:walkPlayer.pos.x,y:walkPlayer.pos.y,z:walkPlayer.pos.z,a:(typeof walkPlayer.faceY==='number'?walkPlayer.faceY:0)}; };
    /* ============ INTERIOR CAMERA + FACING + GRAFFITI + OWNER (Han 2026-10-26, UI-room spec W2-W5) ============ */
    window.__espilOpenShop=function(){ espilOpenShop(); }; /* HUD hook for the UI bridge */
    /* KIOSK (Han 2026-10-26 v3): the order terminal stands at local
       (3.6, 3.4) in the interior; the world reports its distance and
       fires the UI's kiosk hook on interact (classic-shop fallback
       while the UI module is absent). */
    window.__espilKioskState=function(){
      if(!window.__espilInside||!walkPlayer||!walkPlayer.pos)return null;
      var kx=ESPIL_INT.x+3.6*espilIntScale.x, kz=ESPIL_INT.z+3.4*espilIntScale.z;
      var dx=walkPlayer.pos.x-kx, dz=walkPlayer.pos.z-kz;
      return {x:kx, z:kz, d:Math.sqrt(dx*dx+dz*dz)};
    };
    window.__espilUseKiosk=function(){
      window.__espilKioskOpened=(window.__espilKioskOpened||0)+1;
      if(window.__espilKb&&window.__espilKb.openKiosk){ try{ window.__espilKb.openKiosk(); return; }catch(_){} }
      espilOpenShop();
    };
    /* W3: the building the player faces within ~6 m (wall distance),
       or the current building while inside. {name, key, x, z} with
       x/z = the closest point on the building's wall. */
    var espilFacingNameCache={};
    window.__espilFacingBuilding=function(){
      var pose=window.__espilPlayerPose(); if(!pose)return null;
      if(window.__espilInside&&espilInsideRec){
        return {name:(typeof espilBldgName==='string'&&espilBldgName)?espilBldgName:'Building', key:espilBldgKeyOf(espilInsideRec), x:espilInsideRec.cx, z:espilInsideRec.cz};
      }
      var fx=-Math.sin(pose.a), fz=-Math.cos(pose.a);
      var cell=16; /* ESPIL_POLY_CELL */
      var bcx=Math.floor(pose.x/cell), bcz=Math.floor(pose.z/cell);
      var seen={}, best=null, bestD=1e18;
      for(var gx=bcx-1;gx<=bcx+1;gx++)for(var gz=bcz-1;gz<=bcz+1;gz++){
        var arr=espilPolyBucketAt(gx*cell+cell/2, gz*cell+cell/2); if(!arr)continue;
        for(var i=0;i<arr.length;i++){
          var rec=arr[i]; if(!rec||seen[rec.cx+','+rec.cz])continue; seen[rec.cx+','+rec.cz]=1;
          var pr=espilPolyProbe(rec,pose.x,pose.z); if(!pr)continue;
          if(pr.d>6.5||pr.d<-0.5)continue;
          if(pr.d>0.35){
            var dx=pr.cx-pose.x, dz=pr.cz-pose.z, L=Math.sqrt(dx*dx+dz*dz)||1;
            if((dx/L)*fx+(dz/L)*fz<0.45)continue; /* not in the facing half-plane */
          }
          if(pr.d<bestD){ bestD=pr.d; best={rec:rec, pr:pr}; }
        }
      }
      if(!best)return null;
      var key=espilBldgKeyOf(best.rec);
      var name=espilFacingNameCache[key]||null;
      if(!name&&typeof espilBldgName==='string'&&espilBldgName&&espilBldgName!=='Building'&&(espilBldgPanelRec===best.rec||espilInsideRec===best.rec))name=espilBldgName;
      if(!name){
        try{ var ll=mapToLatLng(best.rec.cx,best.rec.cz); var ck=ll.lat.toFixed(4)+','+ll.lng.toFixed(4); if(typeof bldgNameCache!=='undefined'&&bldgNameCache[ck])name=bldgNameCache[ck]; }catch(_){}
      }
      if(!name){
        name='Building';
        try{ fetchBuildingName({x:best.rec.cx,z:best.rec.cz},function(nm){ if(nm)espilFacingNameCache[key]=nm; }); }catch(_){}
      }
      return {name:name, key:key, x:best.pr.cx, z:best.pr.cz};
    };
    /* W4: graffiti tags on building walls. Entries {building, text,
       x, z, a, ts} arrive via the 'espil-graffiti' CustomEvent
       (placed/removed/sync) from the UI bridge's store; the world
       renders each entry's text as a tag on the wall at (x, z). */
    var espilGrafGroup=null, espilGrafTags=[];
    function espilGrafEnsure(){
      if(espilGrafGroup||typeof mapScene==='undefined'||!mapScene)return espilGrafGroup;
      espilGrafGroup=new THREE.Group(); espilGrafGroup.name='espil-graffiti';
      mapScene.add(espilGrafGroup); return espilGrafGroup;
    }
    function espilGrafSame(a,b){ return a&&b&&a.building===b.building&&a.text===b.text&&Math.abs(a.x-b.x)<0.6&&Math.abs(a.z-b.z)<0.6; }
    function espilGrafAdd(entry){
      if(!entry||!entry.text)return;
      for(var i=0;i<espilGrafTags.length;i++)if(espilGrafSame(espilGrafTags[i].entry,entry))return;
      if(!espilGrafEnsure())return;
      var cvs=document.createElement('canvas'); cvs.width=512; cvs.height=128;
      var c=cvs.getContext('2d');
      c.clearRect(0,0,512,128);
      c.translate(256,64); c.rotate(-0.035);
      c.font='900 italic 72px "Avenir Next","Segoe UI",sans-serif';
      c.textAlign='center'; c.textBaseline='middle';
      var tw=c.measureText(entry.text).width, maxW=480;
      if(tw>maxW)c.font='900 italic '+Math.floor(72*maxW/tw)+'px "Avenir Next","Segoe UI",sans-serif';
      c.lineWidth=10; c.strokeStyle='rgba(24,20,16,.92)'; c.lineJoin='round';
      c.strokeText(entry.text,0,0);
      c.fillStyle='#ffd23c'; c.fillText(entry.text,0,0);
      c.lineWidth=3; c.strokeStyle='rgba(255,255,255,.35)'; c.strokeText(entry.text,0,-2);
      var tex=new THREE.CanvasTexture(cvs);
      var mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
      var m=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.15),mat);
      /* orient on the wall: probe for the outward normal; the stored
         heading (the placer stood facing the wall) is the fallback */
      var nx=Math.sin(entry.a||0), nz=Math.cos(entry.a||0);
      try{
        var arr=espilPolyBucketAt(entry.x,entry.z);
        if(arr)for(var j=0;j<arr.length;j++){ var pr2=espilPolyProbe(arr[j],entry.x,entry.z); if(pr2&&pr2.d<2.5){ nx=pr2.nx; nz=pr2.nz; break; } }
      }catch(_){}
      m.position.set(entry.x+nx*0.22, 2.3, entry.z+nz*0.22);
      m.rotation.y=Math.atan2(nx,nz);
      m.frustumCulled=false; m.renderOrder=5;
      espilGrafGroup.add(m);
      espilGrafTags.push({entry:entry, mesh:m});
    }
    function espilGrafRemove(entry){
      for(var i=espilGrafTags.length-1;i>=0;i--){
        if(espilGrafSame(espilGrafTags[i].entry,entry)){
          var t=espilGrafTags.splice(i,1)[0];
          if(espilGrafGroup)espilGrafGroup.remove(t.mesh);
          try{ t.mesh.material.map.dispose(); t.mesh.material.dispose(); t.mesh.geometry.dispose(); }catch(_){}
        }
      }
    }
    function espilGrafSync(list){
      for(var i=espilGrafTags.length-1;i>=0;i--)espilGrafRemove(espilGrafTags[i].entry);
      (list||[]).forEach(espilGrafAdd);
    }
    window.addEventListener('espil-graffiti',function(e){
      var d=e&&e.detail; if(!d)return;
      if(d.type==='placed'&&d.entry)espilGrafAdd(d.entry);
      else if(d.type==='removed'&&d.entry)espilGrafRemove(d.entry);
      else if(d.type==='sync')espilGrafSync(d.list||[]);
    });
    window.__espilGraffitiRender={count:function(){ return espilGrafTags.length; }, sync:espilGrafSync, list:function(){ return espilGrafTags.map(function(t){ return {x:t.mesh.position.x, y:t.mesh.position.y, z:t.mesh.position.z, ry:t.mesh.rotation.y, text:t.entry.text}; }); }};
    (function espilGrafBoot(){
      var tries=0;
      var iv=setInterval(function(){
        tries++;
        if(window.__espilGraffiti&&window.__espilGraffiti.list){ espilGrafSync(window.__espilGraffiti.list()||[]); clearInterval(iv); return; }
        if(tries===2){
          try{ var mine=JSON.parse(localStorage.getItem('espil_graffiti_mine')||'[]'); if(mine&&mine.length)espilGrafSync(mine); }catch(_){}
        }
        if(tries>40)clearInterval(iv);
      },500);
    })();
    /* W5: OWNER chip above the avatar of the building's designer.
       Registry data rules when present; while a building has no
       registered designer (test phase, Han 2026-10-26) the player
       inside is its acting host and carries the chip. Own chip shows
       in third person (the avatar itself is hidden in first person). */
    var espilOwnerChip=null;
    function espilOwnerChipMake(){
      var cvs=document.createElement('canvas'); cvs.width=256; cvs.height=80;
      var c=cvs.getContext('2d');
      c.fillStyle='#c9962e'; c.strokeStyle='#ffe9a8'; c.lineWidth=4;
      c.beginPath();
      if(c.roundRect)c.roundRect(28,10,200,60,30); else c.rect(28,10,200,60);
      c.fill(); c.stroke();
      c.fillStyle='#fff7dd'; c.font='800 40px "Avenir Next","Segoe UI",sans-serif';
      c.textAlign='center'; c.textBaseline='middle'; c.fillText('OWNER',128,42);
      var tex=new THREE.CanvasTexture(cvs);
      /* A plane, not a THREE.Sprite: sprites do not render in the
         Mapbox custom layer (verified 2026-10-26 - chip state was
         healthy, visible, in-scene, yet nothing drew); planes do
         (the graffiti tags are planes). Billboarded to the camera
         every tick in espilOwnerChipTick. */
      var sp=new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.69),
        new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,side:THREE.DoubleSide}));
      sp.renderOrder=30; sp.visible=false; sp.frustumCulled=false;
      return sp;
    }
    function espilOwnerChipTick(fp){
      if(!espilOwnerChip){
        if(typeof mapScene==='undefined'||!mapScene)return;
        espilOwnerChip=espilOwnerChipMake(); mapScene.add(espilOwnerChip);
      }
      var show=false;
      if(window.__espilInside&&espilInsideRec&&!fp&&walkPlayer&&walkPlayer.pos){
        var rights=espilInteriorRights(espilInsideRec);
        var me=espilCurrentIdentity();
        if(!me){ try{ var un=(localStorage.getItem('espil_username')||'').trim(); if(un)me='guest:'+un; }catch(_){} }
        var registered=!!espilDesignerRegistry[espilBldgKeyOf(espilInsideRec)];
        show=(me&&rights.designer===me)||(!registered&&rights.designer===ESPIL_OPERATOR_ID);
        if(show){ /* Height alone does not clear the head in the steep
             interior view (vertical offsets project weakly), so the
             marker also steps 1.1 m away from the follow camera in
             the ground plane, which reads as up-screen. */
          var _awx=(typeof walkCamYaw==='number')?-Math.sin(walkCamYaw):0, _awz=(typeof walkCamYaw==='number')?-Math.cos(walkCamYaw):0;
          espilOwnerChip.position.set(walkPlayer.pos.x+_awx*1.1,walkPlayer.pos.y+5.0,walkPlayer.pos.z+_awz*1.1); /* +5.0: measured in the rig - the steep interior view compresses vertical offsets to ~14 px per metre at the avatar's depth, so a nominal 3 m float still landed on the face */
          if(typeof mapCamera!=='undefined'&&mapCamera)espilOwnerChip.quaternion.copy(mapCamera.quaternion); }
        window.__espilOwnerDbg={show:show, designer:rights.designer, me:me, registered:registered, fp:fp};
      }
      espilOwnerChip.visible=show;
    }
    window.__espilInsideDesigner=function(){ return espilInsideRec?espilInteriorRights(espilInsideRec).designer:null; };
    window.__espilOwnerChipState=function(){
      if(!espilOwnerChip)return null;
      var wp=new THREE.Vector3(); espilOwnerChip.getWorldPosition(wp);
      return {visible:espilOwnerChip.visible, x:wp.x, y:wp.y, z:wp.z,
        sx:espilOwnerChip.scale.x, sy:espilOwnerChip.scale.y,
        inScene:(typeof mapScene!=='undefined'&&mapScene)?mapScene.children.indexOf(espilOwnerChip)>=0:null,
        hasMap:!!(espilOwnerChip.material&&espilOwnerChip.material.map)};
    };

    /* LOCAL NAMEPLATE (Han 2026-11-25 17:27 item 1: names float
       above characters' heads). Peers have carried a plate from
       __espilMakeNameplate since 2026-10-24; the local player was
       the one avatar without one. This block builds the SAME plate
       for the local player from the SAME two inputs the peer path
       uses (espil_username + the own outfit accent through
       __espilOutfitHex), as a scene-level sprite - never parented
       to the visual root, which is scaled/rotated per frame; the
       owner chip above is the scene-level precedent. Positioned
       per frame in the walk tick beside the owner-chip tick:
         y = pos.y + 2.05 * F - espilGlobeDrop(x, z),
         scale = (0.6 * F * 3.4, 0.6 * F, 1),
       which is the remote law restated for a scene-level object
       (the remote plate is a group child at local y 2.05 * F over
       a group whose y already carries -drop). Occlusion matches
       the factory's own material: depthTest default true,
       depthWrite false, renderOrder 50.
       Visibility follows ONE shared predicate, espilAvatarVisible():
       every surface that hides the local avatar (interior FPV,
       zoom FPV, vehicles) does it by writing av.group.visible, so
       the plate reads that flag and hides with its avatar - the
       car first-person view (item 5 of the same batch) inherits
       the hide by construction, no per-mode checks here.
       Own plate is SHOWN in third person: every other client
       already draws this plate over this player, so the local
       view matches theirs. Per-frame cost is one position write
       and one scale write; the texture is built once per arrival
       and rebuilt only when an input changes (the tick re-reads
       the name/accent inputs at a throttled cadence and rebuilds
       on a difference - the accent helper is lazy-loaded, and the
       name input settles after the panel step).
       NAME SOURCE (measured on current bytes, supersedes the
       census's espil_username premise): v2 guests never write
       espil_username - entry-flow removes the key and the v2 path
       neither reads nor writes it. The name this player actually
       wears (the roster name peers draw, the chat sender name) is
       presence.myName(): the character panel's #char-name value
       first, espil_username as the returning-browser fallback,
       'Guest' as the floor. The plate mirrors that resolution
       exactly, so all surfaces keep showing one string. */
    var espilOwnPlate=null, espilOwnPlateName=null, espilOwnPlateAccentVal=null, espilOwnPlateCheckAt=0;
    function espilAvatarVisible(){
      var p=(typeof walkPlayer!=='undefined')?walkPlayer:null;
      return !!(p&&p.av&&p.av.group&&p.av.group.visible&&document.body&&document.body.classList&&document.body.classList.contains('in-map'));
    }
    function espilOwnPlateNameRead(){
      try{
        var inp=document.getElementById('char-name');
        var v=inp?String(inp.value||'').trim():'';
        if(!v){ try{ v=String(localStorage.getItem('espil_username')||'').trim(); }catch(_){ v=''; } }
        return (v||'Guest').slice(0,16);
      }catch(_){ return 'Guest'; }
    }
    function espilOwnPlateAccent(){
      try{
        if(!window.__espilOutfitHex)return null;
        var rec=JSON.parse(localStorage.getItem('espil_character')||'null');
        return window.__espilOutfitHex(rec&&rec.look?rec.look.outfit:null);
      }catch(_){ return null; }
    }
    function espilOwnPlateBuild(){
      var scene=__espilMapScene();
      if(!scene||typeof THREE==='undefined')return false;
      if(espilOwnPlate){
        try{ if(espilOwnPlate.parent)espilOwnPlate.parent.remove(espilOwnPlate); }catch(_){}
        try{ espilOwnPlate.material.map.dispose(); espilOwnPlate.material.dispose(); }catch(_){}
        espilOwnPlate=null;
      }
      espilOwnPlateName=espilOwnPlateNameRead();
      espilOwnPlateAccentVal=espilOwnPlateAccent();
      var sp=__espilMakeNameplate(espilOwnPlateName,espilOwnPlateAccentVal);
      if(!sp)return false;
      sp.visible=false; /* the tick decides from the next frame */
      scene.add(sp);
      espilOwnPlate=sp;
      return true;
    }
    window.__espilNameplateRefresh=function(){
      /* Rebuild after a name/accent change (a customizer re-colour
         funnels here); before arrival it simply builds, and the
         arrival build below covers the first entry. */
      return espilOwnPlateBuild();
    };
    function espilOwnPlateTick(){
      if(!espilOwnPlate){ if(!espilOwnPlateBuild())return; }
      var nowMs=performance.now();
      if(nowMs-espilOwnPlateCheckAt>700){
        espilOwnPlateCheckAt=nowMs;
        if(espilOwnPlateNameRead()!==espilOwnPlateName||espilOwnPlateAccent()!==espilOwnPlateAccentVal){
          if(!espilOwnPlateBuild())return;
        }
      }
      var p=(typeof walkPlayer!=='undefined')?walkPlayer:null;
      if(!p||!p.pos){ espilOwnPlate.visible=false; return; }
      var F=(typeof window.__espilAvatarScaleF==='number'&&window.__espilAvatarScaleF>0)?window.__espilAvatarScaleF:1;
      var drop=(typeof espilGlobeDrop==='function')?espilGlobeDrop(p.pos.x,p.pos.z):0;
      espilOwnPlate.position.set(p.pos.x,p.pos.y+2.05*F-drop,p.pos.z);
      var ph=0.6*F; espilOwnPlate.scale.set(ph*3.4,ph,1);
      espilOwnPlate.visible=espilAvatarVisible();
    }
    window.__espilNameplateState=function(){
      if(!espilOwnPlate)return {exists:false,visible:false,name:null,accent:null,x:null,y:null,z:null,scaleY:null,inScene:null,hasMap:null};
      var wp=new THREE.Vector3(); espilOwnPlate.getWorldPosition(wp);
      return {exists:true, visible:espilOwnPlate.visible, name:espilOwnPlateName, accent:espilOwnPlateAccentVal,
        x:wp.x, y:wp.y, z:wp.z, scaleY:espilOwnPlate.scale.y,
        inScene:(typeof mapScene!=='undefined'&&mapScene)?mapScene.children.indexOf(espilOwnPlate)>=0:null,
        hasMap:!!(espilOwnPlate.material&&espilOwnPlate.material.map)};
    };
    window.addEventListener('espil-arrival',function(){ espilOwnPlateBuild(); });

    /* ============ GEORGIA STREET BUSES + PLAYER COLLISION =========
       (Han's order, 2026-10-27, via COO.)
       Live buses: a JSON feed derived from TransLink GTFS-realtime
       vehicle positions (the API key lives only in the Worker proxy;
       Architecture owns that route) lists the buses currently
       traversing the Georgia Street corridor. Each one is drawn as a
       flat-textured box - the same 2D vehicle idiom as the traffic
       cars - and registered in carColliders, so the world's existing
       support law lands players on the roof and the carry law moves
       them with the bus. Positions between the feed's fixes are
       extrapolated along each bus's measured velocity and eased, the
       same treatment remote avatars get between their 1 s fixes.
       Player collision: after the axis moves, the local player is
       pushed out of every remote avatar's body circle - each client
       resolves only itself, the presence relay stays stateless. */
    /* Player-player collision: resolve the LOCAL player out of each
       remote avatar's body circle (two body radii). Remotes are
       interpolated ghosts on this client; their own clients resolve
       them in turn, so nobody is pushed twice for the same contact. */
    function espilPlayerCollide(p){
      if(!p||p.swimming||p._espilArrive||p._espilLanding)return;
      if(!window.__espilRemoteList)return;
      var list; try{ list=window.__espilRemoteList(); }catch(_){ return; }
      var R=0.8; /* two body radii of ~0.4 m (Architecture 2026-10-27) */
      for(var i=0;i<list.length;i++){
        var q=list[i];
        var dy=p.pos.y-(q.y||0.05); if(dy>1.7||dy<-1.7)continue;
        var dx=p.pos.x-q.x, dz=p.pos.z-q.z;
        var d2=dx*dx+dz*dz;
        if(d2>=R*R)continue;
        if(d2<0.0001){ if(!espilPolyPointBlocked(p.pos.x+R,p.pos.z,p.pos.y))p.pos.x+=R; continue; } /* COLLISION FIX (Han 2026-11-26, directive 7): never push the player into a building record */
        var d=Math.sqrt(d2), push=(R-d)/d;
        var tx=p.pos.x+dx*push, tz=p.pos.z+dz*push;
        if(!espilPolyPointBlocked(tx,tz,p.pos.y)){ p.pos.x=tx; p.pos.z=tz; }
      }
    }

    window.__espilMinimapCount=function(){ return Object.keys(__espilRemoteMarkers).length; };
    /* __espilRemoteAvatars v2 - in-world avatars for other connected
       users (Han's decision, 2026-10-24; perf revision 2026-10-24,
       live feedback item 1). Fed by the presence client:
       __espilAvatarSet runs on every relayed pos fix (1 s cadence).
       PERF MODEL: the body GLB is parsed ONCE per gender into a
       master; every remote CLONES the master (geometry, materials
       and textures are shared GPU resources - the clone only rebinds
       its skeleton to its own bones and gets its own mixer). Mixer
       updates are tiered by avatar count and distance so per-frame
       cost grows slowly with the room size. Movement between fixes
       is interpolated; locomotion uses only the body file's embedded
       Idle / Walking / Running clips. Removal on leave / disconnect;
       shared resources are NOT disposed per user (the masters are
       bounded at two per session) - only the per-user nameplate and
       contact shadow are. */
    var __espilRemotes={};
    var __espilRemoteTickOn=false;
    var __espilTickN=0;
    var __espilParses=0;
    var __espilMasters={
      m:{state:0,scene:null,clips:null,groundY:0,waiters:[]},
      f:{state:0,scene:null,clips:null,groundY:0,waiters:[]}
    };
    function __espilMapScene(){ try{ return (typeof mapScene!=='undefined'&&mapScene)?mapScene:null; }catch(_){ return null; } }
    function __espilMakeNameplate(name,accent){
      try{
        var cv=document.createElement('canvas'); cv.width=256; cv.height=64;
        var cx=cv.getContext('2d');
        cx.font='600 30px sans-serif'; cx.textAlign='center'; cx.textBaseline='middle';
        var nm=String(name||'Guest').slice(0,16);
        cx.lineWidth=6; cx.strokeStyle='rgba(0,0,0,.85)';
        cx.strokeText(nm,128,34); cx.fillStyle='#fff'; cx.fillText(nm,128,34);
        if(accent){ try{ cx.fillStyle=accent; var __bw=Math.max(38,Math.min(190,cx.measureText(nm).width)); cx.fillRect(128-__bw/2,54,__bw,5); }catch(_){} }
        var tex=new THREE.CanvasTexture(cv);
        var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
        sp.renderOrder=50;
        return sp;
      }catch(_){ return null; }
    }
    function __espilEnsureMaster(gender,cb){
      var key=(gender==='f'||gender==='female')?'f':'m';
      var M=__espilMasters[key];
      if(M.state===2){ cb(M); return; }
      M.waiters.push(cb);
      if(M.state===1)return;
      M.state=1;
      try{
        if(typeof THREE.GLTFLoader==='undefined')throw new Error('no GLTFLoader');
        new THREE.GLTFLoader().load(key==='f'?'assets/character/female_idle.glb':'assets/character/male.glb',function(gltf){
          __espilParses++;
          M.scene=gltf.scene;
          M.clips=gltf.animations||[];
          /* grounding offset measured once, at the render transform
             (rotation pi, scale 1.5), exactly like the local walker */
          M.scene.rotation.y=Math.PI;
          M.scene.scale.setScalar(1.5);
          M.scene.updateMatrixWorld(true);
          var bbox=new THREE.Box3().setFromObject(M.scene);
          M.groundY=-bbox.min.y;
          M.scene.rotation.y=0;
          M.scene.scale.setScalar(1);
          /* Globe View: avatar materials are CPU-anchored instead of
             shader-bent (remote tick), so the sweep must skip them. */
          M.scene.traverse(function(o){ if(o&&o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(function(mm){ mm.userData=mm.userData||{}; mm.userData.espilAvatarMat=true; }); } });
          M.state=2;
          var ws=M.waiters; M.waiters=[];
          for(var i=0;i<ws.length;i++){ try{ ws[i](M); }catch(_){} }
        },undefined,function(){ M.state=0; var ws=M.waiters; M.waiters=[]; for(var i=0;i<ws.length;i++){ try{ ws[i](null); }catch(_){} } });
      }catch(_){ M.state=0; var ws2=M.waiters; M.waiters=[]; for(var j=0;j<ws2.length;j++){ try{ ws2[j](null); }catch(__){} } }
    }
    function __espilCloneModel(M){
      var src=M.scene;
      var clone=src.clone(true);
      var srcNodes=[],cloneNodes=[];
      src.traverse(function(o){ srcNodes.push(o); });
      clone.traverse(function(o){ cloneNodes.push(o); });
      for(var i=0;i<cloneNodes.length;i++){
        var cn=cloneNodes[i], sn=srcNodes[i];
        if(sn&&cn&&sn.isSkinnedMesh&&cn.isSkinnedMesh&&cn.skeleton){
          var bones=cn.skeleton.bones.map(function(b){ return cloneNodes[srcNodes.indexOf(b)]; });
          cn.skeleton=new THREE.Skeleton(bones,cn.skeleton.boneInverses);
        }
      }
      return clone;
    }
    function __espilDrawBubble(R,text){
      try{
        if(!R.bubble){
          var cv=document.createElement('canvas'); cv.width=384; cv.height=128;
          var tex=new THREE.CanvasTexture(cv);
          var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
          sp.renderOrder=51; sp.visible=false;
          R.bubble=sp; R.bubbleCv=cv; R.bubbleTex=tex;
          R.group.add(sp);
        }
        var cx=R.bubbleCv.getContext('2d');
        cx.clearRect(0,0,384,128);
        var msg=String(text||'').slice(0,60);
        cx.font='600 34px sans-serif';
        var tw=Math.min(352,cx.measureText(msg).width+44);
        var x0=(384-tw)/2, y0=8, w=tw, h=82, r=24;
        cx.beginPath();
        cx.moveTo(x0+r,y0);
        cx.arcTo(x0+w,y0,x0+w,y0+h,r);
        cx.arcTo(x0+w,y0+h,x0,y0+h,r);
        cx.lineTo(204,y0+h);
        cx.lineTo(192,y0+h+18);
        cx.lineTo(180,y0+h);
        cx.arcTo(x0,y0+h,x0,y0,r);
        cx.arcTo(x0,y0,x0+w,y0,r);
        cx.closePath();
        cx.fillStyle='rgba(255,255,255,.96)'; cx.fill();
        cx.fillStyle='#16202c'; cx.textAlign='center'; cx.textBaseline='middle';
        cx.fillText(msg,192,y0+h/2+2,352);
        R.bubbleTex.needsUpdate=true;
        R.bubbleUntil=performance.now()+4500;
      }catch(_){ }
    }
    var __espilPhaseSeq=0;
    function __espilBuildRemoteAvatar(gender,info){
      /* The roster carries the Worker's single-letter gender
         ('m'/'f'); every avatar builder takes the full word (the
         local path passes espilSavedGender()'s). Normalise ONCE
         here, at the remote boundary (found by the selection
         build's real-relay two-client test, 2026-11-16: with
         live roster data a female peer otherwise fell through
         the builders' full-word check and rendered as the male
         body - the swap's synthetic rig calls passed the full
         word, so its remote leg never saw it). */
      gender=(gender==='f'||gender==='female')?'female':'male';
      /* Owner-only designated body (Han 2026-11-17): the room
         relays body:'lunaris' only for the designated account's
         handshake-authenticated sockets, so a roster record
         carrying it is server-vouched - render the Lunaris
         template whatever the viewer's population or guest-body
         mode. The value is not in ESPIL_BODY_CHOICES, so without
         this branch it would fall through to the default body;
         a forged frame never reaches here at all (the room
         drops it to null before relaying). */
      if(info&&info.body==='lunaris')return __espilBuildLunarisRemote(gender);
      /* Batch 6 Item D: peers are guests too (accounts disabled),
         so remotes take the same guest renderer as the local player.
         Guest body (Han 2026-11-16): the Chibi pack dummy by
         default, with the same revert switch as the local builder
         ('kaykit' restores the Han order 5 KayKit placeholder). */
      /* Per-peer body routing (Han 2026-11-16, selection fully
         open): the peer's carried body choice - the presence
         frame's `body`, sanitised by the Worker to 'master' or
         'style1'..'style4' - decides the renderer: a chosen chibi
         style renders from that style's template, 'master'
         renders the master clone below. With NO carried choice
         (an older client, or the Worker build without the field
         still serving) the pre-selection behaviour applies
         unchanged: a guest session renders every peer with the
         guest body, a signed-in session with the master clone.
         The revert modes keep their single body and ignore the
         style, exactly as they do for the local player. */
      var peerBody=(info&&typeof info.body==='string'&&ESPIL_BODY_CHOICES.indexOf(info.body)>=0)?info.body:null;
      var mode=espilGuestBodyMode();
      if(info&&info.body==='neutral'){
        /* NAME-ONLY ENTRY (Han 2026-11-24): an entrant peer wears
           the neutral slot - the same interim binding as the local
           builder (the chibi template at
           ESPIL_NEUTRAL_INTERIM_STYLE) until the monk asset lands;
           the id does not change. */
        if(mode==='chibi')return __espilBuildChibiRemote(gender,ESPIL_NEUTRAL_INTERIM_STYLE);
        if(mode==='kaykit')return __espilBuildKaykitRemote(gender);
        return __espilBuildSpriteRemote(gender);
      }
      if(peerBody&&peerBody!=='master'){
        if(mode==='chibi')return __espilBuildChibiRemote(gender,espilCbStyleNum(peerBody));
        if(mode==='kaykit')return __espilBuildKaykitRemote(gender);
        return __espilBuildSpriteRemote(gender);
      }
      if(!peerBody&&espilGuestNow()){
        if(mode==='chibi')return __espilBuildChibiRemote(gender,espilCbStyleNum(espilBodyChoice()));
        if(mode==='kaykit')return __espilBuildKaykitRemote(gender);
        return __espilBuildSpriteRemote(gender);
      }
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      var R={group:g,shadow:shadow,mixer:null,actions:{},curAnim:null,ready:false,visual:null,baseY:0,
             cur:{x:0,y:0,z:0},tgt:{x:0,y:0,z:0,a:0},faceY:0,speed:0,fixSpeed:0,fixAt:0,lastAt:0,plate:null,
             phase:(__espilPhaseSeq++)%7,acc:0,gone:false,bubble:null,bubbleCv:null,bubbleTex:null,bubbleUntil:0};
      R.playAnim=function(name){
        if(!R.mixer||!R.actions[name]||R.curAnim===name)return;
        var prev=R.actions[R.curAnim],next=R.actions[name];
        R.curAnim=name;
        next.reset().fadeIn(.18).play();
        next.__espilGen=(next.__espilGen||0)+1;
        if(prev&&prev!==next){ prev.fadeOut(.18); (function(pp,gg){ setTimeout(function(){ if(pp.__espilGen===gg)pp.stop(); },220); })(prev,prev.__espilGen||0); }
      };
      __espilEnsureMaster(gender,function(M){
        if(R.gone||!M||!M.scene)return;
        try{
          var model=__espilCloneModel(M);
          model.rotation.y=Math.PI;
          model.scale.setScalar(1.5);
          model.userData.__avBaseScale=1.5; /* FOOT-SLIDE SYNC: stride normalisation base (the remote tick grows this root by the layer factor) */
          model.position.y=M.groundY;
          model.traverse(function(o){ if(o.isMesh){ o.castShadow=true; } });
          R.visual=model; R.baseY=M.groundY;
          g.add(model);
          var mixer=new THREE.AnimationMixer(model);
          R.mixer=mixer;
          var clips=M.clips||[];
          function findClip(rx){ for(var i=0;i<clips.length;i++){ if(rx.test(clips[i].name))return clips[i]; } return null; }
          var idleClip=findClip(/baselayer|idle/i)||clips[0];
          var walkClip=findClip(/walking/i),runClip=findClip(/running/i);
          if(idleClip)R.actions.idle=mixer.clipAction(idleClip);
          if(walkClip)R.actions.walk=mixer.clipAction(walkClip);
          if(runClip)R.actions.run=mixer.clipAction(runClip);
          espilStrideRegister(R,model,'walk'); /* FOOT-SLIDE SYNC: stride cached on the shared master clip */
          espilStrideRegister(R,model,'run');
          try{ mixer.update(0); }catch(_){}
          R.ready=true;
          R.playAnim('idle');
        }catch(_){ }
      });
      return R;
    }
    function __espilStartRemoteTick(){
      if(__espilRemoteTickOn)return;
      __espilRemoteTickOn=true;
      var last=performance.now();
      (function tick(){
        requestAnimationFrame(tick);
        var now=performance.now();
        var dt=Math.min(0.05,(now-last)/1000); last=now;
        if(dt<=0)return;
        __espilTickN++;
        var F=(typeof window.__espilAvatarScaleF==='number'&&window.__espilAvatarScaleF>0)?window.__espilAvatarScaleF:1;
        var ids=Object.keys(__espilRemotes);
        var count=ids.length;
        var stride=count<=6?1:(count<=14?2:3);
        var pp=null;
        try{ pp=window.__espilPlayerPose?window.__espilPlayerPose():null; }catch(_){ pp=null; }
        for(var ii=0;ii<ids.length;ii++){
          var R=__espilRemotes[ids[ii]]; if(!R)continue;
          /* Velocity prediction (Architecture 2026-10-27): between
             fixes the target advances along the last fix's velocity
             (capped at 2 s of travel); the next fix corrects it. */
          var _el=Math.min(2.0,Math.max(0,(now-R.lastAt)/1000));
          var _tx=R.tgt.x+(R.vx||0)*_el, _tz=R.tgt.z+(R.vz||0)*_el;
          var dx=_tx-R.cur.x, dy=R.tgt.y-R.cur.y, dz=_tz-R.cur.z;
          var dist=Math.sqrt(dx*dx+dz*dz);
          if(dist>15||Math.abs(dy)>15){ R.cur.x=_tx; R.cur.y=R.tgt.y; R.cur.z=_tz; }
          else { var k=1-Math.exp(-dt*5); R.cur.x+=dx*k; R.cur.y+=dy*k; R.cur.z+=dz*k; }
          var goal=(now-R.lastAt>2200)?0:R.fixSpeed;
          R.speed+=(goal-R.speed)*Math.min(1,dt*5);
          var da=R.tgt.a-R.faceY;
          while(da>Math.PI)da-=Math.PI*2; while(da<-Math.PI)da+=Math.PI*2;
          R.faceY+=da*Math.min(1,dt*8);
          var rDrop=espilGlobeDrop(R.cur.x,R.cur.z);
          R.group.position.set(R.cur.x,R.cur.y-rDrop,R.cur.z);
          R.group.rotation.y=R.faceY;
          /* CHAR SHADOW (2026-11-20): same defect class as the local
             write - the remote body rides its reported height (tile
             surface included) while its disc stayed at the baked
             datum. Resolve this column's support with the same
             query the body law uses and put the disc on it. */
          var rSup=espilSupportAt(R.cur.x,R.cur.z,R.cur.y);
          R.shadow.position.set(R.cur.x,rSup+.03-rDrop,R.cur.z);
          var ss=Math.min(F,4); R.shadow.scale.set(ss,ss,1);
          R.shadow.material.opacity=Math.max(.08,.26-Math.max(0,R.cur.y-rSup)*.05);
          if(R.visual){ R.visual.scale.setScalar(1.5*F); R.visual.position.y=R.baseY*F; }
          if(R.plate){ R.plate.position.y=2.05*F; var ph=0.6*F; R.plate.scale.set(ph*3.4,ph,1); }
          if(R.bubble){
            var bvis=now<R.bubbleUntil;
            R.bubble.visible=bvis;
            if(bvis){ R.bubble.position.y=2.78*F; R.bubble.scale.set(2.1*F,0.7*F,1); }
          }
          if(R.ready&&R.mixer){
            /* tiered mixer updates: near avatars animate at full rate;
               far ones (> 80 m) and crowded rooms step down */
            var far=false;
            if(pp){ var pdx=R.cur.x-pp.x, pdz=R.cur.z-pp.z; far=(pdx*pdx+pdz*pdz)>6400; }
            var s=far?Math.max(stride,3):stride;
            R.acc+=dt;
            if(((__espilTickN+R.phase)%s)===0){
              var want=R.speed>6.5?'run':(R.speed>0.35?'walk':'idle');
              if(!R.actions[want])want='idle';
              R.playAnim(want);
              espilStrideSync(R,R.speed); /* FOOT-SLIDE SYNC: R.speed is the smoothed stream speed */
              R.mixer.update(R.acc);
              R.acc=0;
            }
          }
        }
      })();
    }
    window.__espilAvatarSet=function(id,x,y,z,a,info,vx,vz){
      var scene=__espilMapScene();
      if(typeof THREE==='undefined'||!scene)return;
      var now=performance.now();
      var R=__espilRemotes[id];
      if(!R){
        R=__espilBuildRemoteAvatar(info&&info.gender,info);
        R.cur={x:x,y:y,z:z}; R.tgt={x:x,y:y,z:z,a:(typeof a==='number'?a:0)}; R.vx=(typeof vx==='number')?vx:0; R.vz=(typeof vz==='number')?vz:0;
        R.faceY=R.tgt.a; R.fixAt=now; R.lastAt=now;
        R.plate=__espilMakeNameplate(info&&info.name,(info&&info.look&&window.__espilOutfitHex)?window.__espilOutfitHex(info.look.outfit):null); /* nameplate accent = the peer's outfit colour (Han 2026-10-28) */
        if(R.plate)R.group.add(R.plate);
        R.group.position.set(x,y,z);
        scene.add(R.group); scene.add(R.shadow);
        __espilRemotes[id]=R;
        __espilStartRemoteTick();
        __espilApplyPendingBubble(id,R);
      } else {
        var dtf=(now-(R.fixAt||now))/1000;
        if(dtf>0.2){
          var ddx=x-R.tgt.x, ddz=z-R.tgt.z;
          R.fixSpeed=Math.sqrt(ddx*ddx+ddz*ddz)/dtf;
          R.fixAt=now;
        }
        R.tgt.x=x; R.tgt.y=y; R.tgt.z=z;
        if(typeof vx==='number')R.vx=Math.max(-16,Math.min(16,vx)); if(typeof vz==='number')R.vz=Math.max(-16,Math.min(16,vz));
        if(typeof a==='number')R.tgt.a=a;
        R.lastAt=now;
      }
    };
    window.__espilAvatarRemove=function(id){
      var R=__espilRemotes[id]; if(!R)return;
      delete __espilRemotes[id];
      R.gone=true;
      try{ if(R.group.parent)R.group.parent.remove(R.group); }catch(_){}
      try{ if(R.shadow.parent)R.shadow.parent.remove(R.shadow); }catch(_){}
      try{ if(R.mixer)R.mixer.stopAllAction(); }catch(_){}
      /* The model's geometry/materials/textures are SHARED with the
         gender master and every other clone - disposing them here
         would break the remaining avatars. Only per-user resources
         (nameplate, contact shadow) are disposed. The two masters
         are bounded for the whole session, so nothing accumulates
         (perf revision of the v1 dispose rule, 2026-10-24). */
      try{ R.shadow.geometry.dispose(); R.shadow.material.dispose(); }catch(_){}
      if(R.plate){ try{ R.plate.material.map.dispose(); R.plate.material.dispose(); }catch(_){} }
      if(R.bubble){ try{ R.bubbleTex.dispose(); R.bubble.material.dispose(); }catch(_){} }
    };
    /* A chat can arrive before the sender's first pos frame creates
       their avatar (the mock's Mina chats 0.4 s before her first pos).
       Stash such bubbles and apply them when the avatar appears. */
    var __espilPendingBubbles={};
    window.__espilAvatarBubble=function(id,text){
      var R=__espilRemotes[id];
      if(R){ __espilDrawBubble(R,text); return; }
      __espilPendingBubbles[id]={text:String(text||''),at:performance.now()};
    };
    function __espilApplyPendingBubble(id,R){
      var p=__espilPendingBubbles[id]; if(!p)return;
      delete __espilPendingBubbles[id];
      if(performance.now()-p.at<8000) __espilDrawBubble(R,p.text);
    }
    window.__espilAvatarClear=function(){ for(var k in __espilRemotes)window.__espilAvatarRemove(k); __espilPendingBubbles={}; };
    window.__espilAvatarCount=function(){ return Object.keys(__espilRemotes).length; };
    window.__espilRemotePose=function(id){ var R=__espilRemotes[id]; return R?{x:R.cur.x,y:R.cur.y,z:R.cur.z,speed:R.speed,anim:R.curAnim,ready:R.ready,bubble:!!(R.bubble&&R.bubble.visible)}:null; };
    window.__espilRemoteList=function(){ var out=[]; for(var id in __espilRemotes){ var R=__espilRemotes[id]; if(R&&R.cur)out.push({id:id,x:R.cur.x,y:R.cur.y,z:R.cur.z}); } return out; }; /* player-player collision enumerates interpolated poses through here (map room, 2026-10-27) */
    window.__espilAvatarStats=function(){ return {parses:__espilParses,masters:{m:__espilMasters.m.state,f:__espilMasters.f.state},remotes:Object.keys(__espilRemotes).length}; };
    /* Bridges for __espilSocial (Han 2026-10-27): right-click picking
       projects avatar poses through the real map camera and inverts
       the Globe View drop, so the menu opens on the character as
       rendered, bent ground included. */
    window.__espilMapCameraObj=function(){ try{ return (typeof mapCamera!=='undefined'&&mapCamera)?mapCamera:null; }catch(_){ return null; } };
    window.__espilMapObj=function(){ try{ return (typeof espilP1!=='undefined'&&espilP1)?(espilP1.map||null):null; }catch(_){ return null; } };
    window.__espilBakedBuildingCents=function(){ try{ return (typeof espilP1BldCache!=='undefined'&&espilP1BldCache)?espilP1BldCache.cents:null; }catch(_){ return null; } };
    window.__espilOwnGroup=function(){ try{ return (typeof walkPlayer!=='undefined'&&walkPlayer&&walkPlayer.av&&walkPlayer.av.group)?walkPlayer.av.group:null; }catch(_){ return null; } };
    /* __espilRemoteAvatars END */
    window.addEventListener('sell-bubble',function(e){
      espilSellBubble(e&&e.detail&&e.detail.text);
    });
    window.addEventListener('espil-guide',function(e){
      if(e&&e.detail&&e.detail.type==='sell-bubble')espilSellBubble(e.detail.text);
    });
    function sendChat(){
      if(!chatInput)return;
      var t=chatInput.value.trim();
      chatInput.value='';
      setChatTyping(false);
      if(!t)return;
      if(window.__espilChatSend&&window.__espilChatSend(t)){ showChatBubble(t); return; }
      addChatMsg('You',t,false);
      showChatBubble(t); /* Han 2026-10-16 #11 */
    }
    function initSkillHud(){
      var row=document.getElementById('move-row');
      if(row&&!row.children.length){
        SKILL_SLOTS.forEach(function(s){
          var b=document.createElement('button');
          b.type='button';b.className='move-slot'+(s.move?'':' is-locked');b.id='slot-'+s.key;
          if(s.move){
            var m=MOVES[s.move];
            var sic=pxIcon(m.art||s.move);
            b.setAttribute('aria-label',m.name+', key '+s.key.toUpperCase());
            b.innerHTML='<span class="key">'+s.key.toUpperCase()+'</span>'+
              '<span class="sicon">'+(sic?'<img alt="" src="'+sic+'">':m.icon)+'</span>'+
              '<span class="mn">'+m.name.toUpperCase()+'</span>'+
              '<span class="cd" id="move-cd-'+s.move+'"></span>';
            (function(mid){b.addEventListener('pointerdown',function(e){e.preventDefault();doMove(mid);});})(s.move);
          }else{
            var lbl=s.locked?s.locked.split(' ')[1].toUpperCase():'\u2014';
            b.setAttribute('aria-label',(s.locked||'Empty')+' skill slot, key '+s.key.toUpperCase());
            b.title=s.locked?s.locked+' \u2014 arrives with the combat update.':'Empty skill slot';
            b.innerHTML='<span class="key">'+s.key.toUpperCase()+'</span>'+
              '<span class="sicon">'+(s.locked?'\uD83D\uDD12':'')+'</span>'+
              '<span class="mn">'+lbl+'</span>';
            if(s.locked)(function(nm){b.addEventListener('pointerdown',function(e){e.preventDefault();if(window.__espilToast)window.__espilToast(nm+' arrives with the combat update.');});})(s.locked);
          }
          row.appendChild(b);
        });
      }
      /* QA #13 (UI room, 2026-10-06): 1234 item slots. */
      var irow=document.getElementById('item-row');
      if(irow&&!irow.children.length){
        ['1','2','3','4'].forEach(function(k){
          var b=document.createElement('button');
          b.type='button';b.className='move-slot is-locked';b.id='item-'+k;
          b.setAttribute('aria-label','Empty item slot, key '+k);
          b.title='Empty item slot';
          b.innerHTML='<span class="key">'+k+'</span>'+
            '<span class="sicon"></span>'+
            '<span class="mn">\u2014</span>';
          irow.appendChild(b);
        });
      }
      /* QA (UI room, 2026-10-08): keyboard-style menu buttons on right (desktop only). */
      var kbm=document.getElementById('kb-menu');
      if(kbm&&!kbm.children.length){
        var menus=[
          {key:'K',label:'SKILL',fn:function(){toggleSkillTree();}},
          {key:'M',label:'MAP',fn:function(){if(window.__espilToast)window.__espilToast('Map stages arrive with the UI update.');}},
          {key:'I',label:'INV',fn:function(){toggleInventory();}},
          {key:'P',label:'CHAR',off:true,fn:function(){toggleCharacterPanel();}},
          {key:'H',label:'HOME',fn:function(){teleportHome();}},
          {key:'\u2699',label:'SET',fn:function(){toggleSettingsPanel();}}
        ];
        menus.forEach(function(m){
          var b=document.createElement('button');
          b.type='button';b.className='move-slot';
          b.setAttribute('aria-label',m.label+' ('+m.key+')');
          b.innerHTML='<span class="key">'+m.key+'</span><span class="mn">'+m.label+'</span>';
          if(m.off){ b.disabled=true; b.classList.add('is-off'); b.setAttribute('aria-disabled','true'); }
          else b.addEventListener('pointerdown',function(e){e.preventDefault();m.fn();});
          kbm.appendChild(b);
        });
      }
      ['map-status','skill-bar','chat-window','quickbar'].forEach(function(id){
        var el=document.getElementById(id);
        if(el)el.setAttribute('aria-hidden','false');
      });
      if(!chatWelcomed){chatWelcomed=true;addChatMsg('','— '+espilCityDisplayName()+' —',true);addChatMsg('','Press Enter to chat.',true);}
      paintStatus();paintMoveSlots();paintCooldowns();
    }
    function hideSkillHud(){
      skillTreeOpen=false;inventoryOpen=false;characterOpen=false;
      setChatTyping(false);
      ['map-status','skill-bar','skill-tree','inventory-panel','character-panel','chat-window','quickbar'].forEach(function(id){
        var el=document.getElementById(id);
        if(el)el.setAttribute('aria-hidden','true');
      });
    }
    /* ================================================================
       SURVIVAL S1 - canonical combat core (Han ruling 2026-11-06).
       Damage = fixed move damage (the MOVES table) x weapon factor:
       the panels __espilWeaponAtkMid mid-range / 5, clamped to
       0.8..3.0, factor 1 when the hook is absent. Crit is the
       Zealandia canon (FEEL.md item 3): 15% chance, x1.5, rolled
       here and passed to the monster as opts.crit. The MONSTER side
       then mitigates (defense / evasion / traits, in monsters.js);
       the number the player sees is the mitigated applied damage.
       Guard (ruling): leaving the strike point already fizzles a
       monster's strike (monsters.js wind-up); a Defense triggered
       inside the perfect window EVADES outright; guarding outside
       the window soaks max(0, monster ATK - player DEF), DEF from
       panels __espilPlayerDef(). Death is a CHOICE (ruling): return
       to the village (Art Gallery spawn) at HP/MP 10%, or spend a
       Revival Potion to revive in place at 50%/50%. The potion is a
       cash item (10 for $1 in the cash shop) - the cash shop is
       CLOSED by Han's order, so no purchase path exists; the item
       can be owned and used, nothing more. Falls still cannot kill
       (espilChargeFallDamage clamps at 1). MP costs stay 0. All
       combat timing runs on accumulated game time (espilGameT,
       advanced in updateSkillFx), the same dt-clamped clock the
       rest of the build lives on.
       ================================================================ */
    var ESPIL_CRIT_CHANCE=.15, ESPIL_CRIT_MULT=1.5;
    var ESPIL_PERFECT_WINDOW_S=.25;      /* Defense timing-evade window */
    var ESPIL_REVIVE_GRACE_S=1.5;        /* combat-damage grace after a revive */
    var ESPIL_SPAWN={x:3,z:33};          /* Art Gallery front (the village) */
    /* Leo per kill (Han: monster kills earn Leo): zone base + grade
       bonus. rat/wisp 1, stray 4, shambler 5, brute 9, wraith 10,
       hound 18, titan 20. */
    var ESPIL_LEO_ZONE={tutorial:1,low:3,mid:6,high:12};
    var ESPIL_LEO_GRADE={white:0,yellow:1,green:2,blue:3,purple:4,red:6,gold:8,pink:8};
    var espilGameT=0;
    var espilDead=false, espilGraceEnd=0, espilDefenseAt=-1e9, espilLastHit=null;
    function espilWeaponFactor(){
      var mid=null;
      try{ if(typeof window.__espilWeaponAtkMid==='function')mid=window.__espilWeaponAtkMid(); }catch(e){}
      if(typeof mid!=='number'||!isFinite(mid))return 1;
      return Math.max(.8,Math.min(3,mid/5));
    }
    function espilWeaponElementTag(){
      try{ if(typeof window.__espilWeaponElement==='function')return window.__espilWeaponElement()||'neutral'; }catch(e){}
      return 'neutral';
    }
    function espilPlayerDefValue(){
      var base=0;
      try{ if(typeof window.__espilPlayerDef==='function')base=window.__espilPlayerDef()||0; }catch(e){}
      return base+espilTreeDefBonus(); /* Batch 6: armour tree stacks */
    }
    function espilLeoBalance(){
      var v=parseInt(localStorage.getItem('espil_leo_balance'),10);
      return isNaN(v)?1000:v;
    }
    function espilGrantKillLeo(res){
      if(res&&res.instance)return; /* ARENA SEAM: instance kills are paid by the arena's per-round guarantee, never per kill */
      var amt=(ESPIL_LEO_ZONE[res.zone]||0)+(ESPIL_LEO_GRADE[res.grade]||0);
      if(amt<=0)return;
      try{ localStorage.setItem('espil_leo_balance',String(espilLeoBalance()+amt)); }catch(e){}
      try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'monster-kill',id:res.id,kind:res.kind,grade:res.grade,leo:amt}})); }catch(e){}
    }
    /* One move's hit application. Melee hits every target inside
       the move's range and frontal arc (the arc the FX draws);
       the thrown tool flies the facing ray and lands on the
       nearest target it would cross. */
    function espilApplyMoveHit(id,st){
      if(!walkPlayer)return;
      if(typeof window.__espilMonsterHit!=='function'||typeof window.__espilMonsterTargets!=='function')return;
      var p=walkPlayer;
      var factor=espilWeaponFactor(), element=espilWeaponElementTag();
      var fx=-Math.sin(p.faceY), fz=-Math.cos(p.faceY);
      var targets=[];
      try{ targets=window.__espilMonsterTargets()||[]; }catch(e){}
      var hits=[],i,t;
      if(st.m.proj){
        var best=null,bestAlong=1e12;
        for(i=0;i<targets.length;i++){
          t=targets[i];
          var vx=t.x-p.pos.x, vz=t.z-p.pos.z;
          var along=vx*fx+vz*fz;
          if(along<0||along>st.range)continue;
          var ox=t.x-(p.pos.x+fx*along), oz=t.z-(p.pos.z+fz*along);
          if(Math.sqrt(ox*ox+oz*oz)<=t.r+.45&&along<bestAlong){bestAlong=along;best=t;}
        }
        if(best)hits.push(best);
      }else{
        var cosLim=Math.cos((st.m.arc||1.9)/2+.3);
        for(i=0;i<targets.length;i++){
          t=targets[i];
          var wx=t.x-p.pos.x, wz=t.z-p.pos.z;
          var d=Math.sqrt(wx*wx+wz*wz);
          if(d>st.range+t.r)continue;
          if(d<.01||(wx*fx+wz*fz)/d>=cosLim)hits.push(t);
        }
      }
      for(i=0;i<hits.length;i++){
        var crit=Math.random()<ESPIL_CRIT_CHANCE;
        /* SKILL WIRING (menu overhaul step 1): st.dmg is the rank-adjusted
           value the skill window displays - it already carries the character
           tree rank (+5%/rank) and espilTreeDmgMul(). The old line used the
           base st.m.dmg, so rank investment raised only the shown number. */
        var raw=st.dmg*factor*(crit?ESPIL_CRIT_MULT:1);
        var res=null;
        try{ res=window.__espilMonsterHit(hits[i].id,raw,p.pos.x,p.pos.z,{crit:crit,element:element}); }catch(e){}
        if(res&&res.killed){ espilGrantKillLeo(res); espilTreeOnKill(); }
      }
    }
    /* ---- incoming damage: timing evade, guard soak, death ---- */
    window.__espilPlayerDamage=function(n,sx,sz){
      var out={applied:0,evaded:false,guarded:false,dead:espilDead,ignored:false,def:0};
      if(espilDead||!walkPlayer){out.ignored=true;espilLastHit=out;return out;}
      if(espilGameT<espilGraceEnd){out.ignored=true;espilLastHit=out;return out;}
      /* timing evade: Defense went up inside the perfect window */
      if(espilGameT-espilDefenseAt<=ESPIL_PERFECT_WINDOW_S){
        out.evaded=true; espilLastHit=out; espilShowEvade(); return out;
      }
      var dmg=Math.max(0,Math.round(n||0));
      if(walkPlayer.guarding>0){
        out.guarded=true; out.def=espilPlayerDefValue();
        dmg=Math.max(0,dmg-out.def);
      }
      out.applied=dmg;
      if(dmg>0){
        espilTreeOnHurt(); /* Batch 6: armour-tree use proficiency */
        espilHurtFeedback(dmg,sx,sz);
        skillState.hp-=dmg;
        if(skillState.hp<=0){
          skillState.hp=0; out.dead=true;
          saveSkills(); paintStatus();
          espilEnterDeath();
        }else{ saveSkills(); paintStatus(); }
      }
      espilLastHit=out;
      return out;
    };
    /* ---- Batch 5 item 7 (Han 2026-11-07): player being-hit feedback ----
       Pre-batch audit: an applied hit changed ONLY the HP flask fill
       (paintStatus) - no camera shake, no red vignette, no flask
       punch, no hit sound, and the source coords (sx, sz) were
       ignored, so no knockback. This block adds all five, driven
       from the applied-damage branch above; the canonical combat
       math is untouched. */
    var espilHurt={hits:0,lastDmg:0,shake:0,shakePeak:0,vig:0,vigPeak:0,punch:0,kb:0,sound:0};
    var espilHurtVigEl=null, espilHurtCtx=null, espilHurtCanvas=null, espilHurtLastTick=0;
    /* ================================================================
       HIT STOP + HIT SHAKE (Han 2026-11-17, via COO): step 4 of the
       enemy hit-feel reel - a landed hit freezes the world for a
       few frames and nudges the camera. There is NO global clock
       in this game (every module runs its own RAF loop with its
       own dt clamp), so the stop is a SHARED DEADLINE:
       window.__espilHitStopUntil (performance.now epoch, ms). The
       monsters tick, this file's main animate and the sprite-avatar
       stepper (espilAv2Step) each consult it and zero their own
       world dt while it runs. Damage numbers are exempt (the
       monsters tick steps them on real dt) - the reel's picture is
       the world held while the number pops. Presence/network is
       never stopped: remote players are other clients; only their
       local interpolation pauses, under the scope switch below.
       Requests come ONLY from inside __espilMonsterHit's body
       (monsters.js), graded by the hit: normal / crit / kill.
       Merge rules: the deadline is a max(), never a sum - a
       simultaneous multi-hit takes the highest grade ONCE; a
       re-request during a stop extends only past the current
       deadline, and only that real extension is charged to the
       rolling per-second budget, so chain hits cannot stun-lock
       the world. The camera shake reuses espilHurtFeedback's
       proven method (CSS transform on the largest canvas) on a
       SEPARATE state - the two shakes never write each other's
       channel state. */
    /* THE STOP-SCOPE SWITCH: 'world' = the main loop and the
       avatar stepper freeze too (the local player feels the hit
       land); 'monsters' = only the monsters tick honours the
       deadline. Flip this ONE line to change the scope. */
    var ESPIL_HIT_STOP_SCOPE='world';
    var ESPIL_HIT_STOP_DUR={hit:0.045,crit:0.07,kill:0.10};   /* s, by grade */
    var ESPIL_HIT_STOP_SHAKE={hit:3,crit:5,kill:6};           /* px, by grade */
    var ESPIL_HIT_STOP_CAP=0.25;  /* max ADDED stop per rolling 1 s */
    var espilHitStopLog=[];       /* {t, added} grants in the window */
    var espilHitStopStats={requests:0,granted:0,covered:0,denied:0,shakes:0,lastGrade:null};
    var espilHitShake={shake:0,peak:0};
    var espilHitShakeCanvas=null, espilHitShakeLastTick=0;
    window.__espilHitStopUntil=0;
    window.__espilHitStop=function(grade){
      var dur=ESPIL_HIT_STOP_DUR[grade];
      if(!dur)return;
      espilHitStopStats.requests++;
      espilHitStopStats.lastGrade=grade;
      var now=performance.now();
      while(espilHitStopLog.length&&now-espilHitStopLog[0].t>1000)espilHitStopLog.shift();
      var used=0;
      for(var i=0;i<espilHitStopLog.length;i++)used+=espilHitStopLog[i].added;
      var cur=window.__espilHitStopUntil||0;
      var newUntil=Math.max(cur,now+dur*1000);
      var added=(newUntil-Math.max(cur,now))/1000;
      if(added<=0){ espilHitStopStats.covered++; }
      else{
        if(used+added>ESPIL_HIT_STOP_CAP+1e-9){ espilHitStopStats.denied++; return; }
        espilHitStopLog.push({t:now,added:added});
        window.__espilHitStopUntil=newUntil;
        espilHitStopStats.granted++;
      }
      /* shake: the grade's peak, max-merged like the deadline -
         simultaneous hits shake once, at the highest grade */
      var px=ESPIL_HIT_STOP_SHAKE[grade]||0;
      if(px>espilHitShake.shake){ espilHitShake.shake=px; espilHitShake.peak=px; espilHitStopStats.shakes++; }
      espilHitShakeLastTick=now;
    };
    window.__espilHitStopState=function(){
      var now=performance.now(), used=0;
      for(var i=0;i<espilHitStopLog.length;i++)if(now-espilHitStopLog[i].t<=1000)used+=espilHitStopLog[i].added;
      return { scope:ESPIL_HIT_STOP_SCOPE,
        until:window.__espilHitStopUntil||0,
        remainingMs:Math.max(0,Math.round((window.__espilHitStopUntil||0)-now)),
        active:now<(window.__espilHitStopUntil||0),
        granted1s:Math.round(used*1000)/1000,
        cap:ESPIL_HIT_STOP_CAP,
        dur:{hit:ESPIL_HIT_STOP_DUR.hit,crit:ESPIL_HIT_STOP_DUR.crit,kill:ESPIL_HIT_STOP_DUR.kill},
        shakePx:{hit:ESPIL_HIT_STOP_SHAKE.hit,crit:ESPIL_HIT_STOP_SHAKE.crit,kill:ESPIL_HIT_STOP_SHAKE.kill},
        shake:Math.round(espilHitShake.shake*100)/100, shakePeak:espilHitShake.peak,
        stats:{requests:espilHitStopStats.requests,granted:espilHitStopStats.granted,
          covered:espilHitStopStats.covered,denied:espilHitStopStats.denied,
          shakes:espilHitStopStats.shakes,lastGrade:espilHitStopStats.lastGrade} };
    };
    /* shake decay driver: the espilHurtFeedback method (33 ms
       interval, largest canvas, random offsets, 26/s decay) on
       this block's own state */
    setInterval(function(){
      if(espilHitShake.shake<=0)return;
      var now=performance.now();
      var dt=Math.min(.1,(now-espilHitShakeLastTick)/1000||.033);
      espilHitShakeLastTick=now;
      espilHitShake.shake=Math.max(0,espilHitShake.shake-dt*26);
      try{
        if(!espilHitShakeCanvas||!espilHitShakeCanvas.isConnected){
          var cvs=document.querySelectorAll('canvas'), best=null, ba=0;
          for(var ci=0;ci<cvs.length;ci++){
            var a=cvs[ci].clientWidth*cvs[ci].clientHeight;
            if(a>ba){ ba=a; best=cvs[ci]; }
          }
          espilHitShakeCanvas=best;
        }
        if(espilHitShakeCanvas){
          if(espilHitShake.shake>.05){
            var ox=(Math.random()*2-1)*espilHitShake.shake, oy=(Math.random()*2-1)*espilHitShake.shake*.7;
            espilHitShakeCanvas.style.transform='translate('+ox.toFixed(1)+'px,'+oy.toFixed(1)+'px)';
          }else espilHitShakeCanvas.style.transform='';
        }
      }catch(e){}
    },33);
    function espilHurtEnsureVig(){
      if(espilHurtVigEl)return espilHurtVigEl;
      var el=document.createElement('div');
      el.id='espil-hurt-vignette';
      el.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9993;opacity:0;'+
        'background:radial-gradient(ellipse at center, rgba(190,10,10,0) 52%, rgba(190,10,10,.62) 100%);';
      document.body.appendChild(el);
      espilHurtVigEl=el; return el;
    }
    function espilHurtSound(){
      try{
        var AC=window.AudioContext||window.webkitAudioContext;
        if(!AC)return;
        if(!espilHurtCtx)espilHurtCtx=new AC();
        if(espilHurtCtx.state==='suspended'){ var rp=espilHurtCtx.resume(); if(rp&&rp.catch)rp.catch(function(){}); }
        var t=espilHurtCtx.currentTime;
        var o=espilHurtCtx.createOscillator(), g=espilHurtCtx.createGain();
        o.type='triangle';
        o.frequency.setValueAtTime(165,t);
        o.frequency.exponentialRampToValueAtTime(58,t+.16);
        g.gain.setValueAtTime(.28,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.2);
        o.connect(g); g.connect(espilHurtCtx.destination);
        o.start(t); o.stop(t+.22);
        espilHurt.sound++;
      }catch(e){}
    }
    function espilHurtFeedback(dmg,sx,sz){
      /* Batch 6 Item D: the sprite avatar plays its hit set (the
         GLB avatar has no 'hit' action, so this is a no-op there). */
      try{ if(walkPlayer&&walkPlayer.av&&walkPlayer.av.playOneShot)walkPlayer.av.playOneShot('hit',450); }catch(e){}
      espilHurt.hits++; espilHurt.lastDmg=dmg;
      espilHurt.shakePeak=Math.min(14,4+dmg*.7);    /* px offset amplitude, scales with damage */
      espilHurt.shake=espilHurt.shakePeak;
      espilHurt.vigPeak=Math.min(.92,.38+dmg*.022); /* vignette opacity peak */
      espilHurt.vig=espilHurt.vigPeak;
      espilHurtEnsureVig();
      espilHurt.punch++;
      try{
        var wrap=document.getElementById('hp-flask-wrap');
        if(wrap){
          wrap.style.transition='transform .16s ease-out';
          wrap.style.transform='scale(1.22)';
          setTimeout(function(){ wrap.style.transform='scale(1)'; },170);
        }
      }catch(e){}
      espilHurtSound();
      /* knockback: away from the hit source, collision-substepped */
      try{
        if(walkPlayer&&!walkPlayer.flying&&isFinite(sx)&&isFinite(sz)){
          var dx=walkPlayer.pos.x-sx, dz=walkPlayer.pos.z-sz;
          var dl=Math.sqrt(dx*dx+dz*dz);
          if(dl>.01){
            var total=Math.min(1.15,.45+dmg*.05), steps=5, moved=0;
            for(var si=0;si<steps;si++){
              var nx=walkPlayer.pos.x+dx/dl*(total/steps), nz=walkPlayer.pos.z+dz/dl*(total/steps);
              var pr=window.__espilCollisionProbe?window.__espilCollisionProbe(nx,nz):null;
              if(pr&&pr.blocked)break;
              if(espilPolyPointBlocked(nx,nz,walkPlayer.pos.y))break; /* COLLISION FIX (Han 2026-11-26, directive 7): knockback also consults the building records */
              walkPlayer.pos.x=nx; walkPlayer.pos.z=nz; moved+=total/steps;
            }
            espilHurt.kb=Math.round((espilHurt.kb+moved)*100)/100;
          }
        }
      }catch(e){}
      espilHurtLastTick=performance.now();
    }
    /* decay driver: shake the largest canvas (the map), fade the vignette */
    setInterval(function(){
      if(espilHurt.shake<=0&&espilHurt.vig<=0)return;
      var now=performance.now();
      var dt=Math.min(.1,(now-espilHurtLastTick)/1000||.033);
      espilHurtLastTick=now;
      espilHurt.shake=Math.max(0,espilHurt.shake-dt*26);
      espilHurt.vig=Math.max(0,espilHurt.vig-dt*1.5);
      try{
        if(!espilHurtCanvas||!espilHurtCanvas.isConnected){
          var cvs=document.querySelectorAll('canvas'), best=null, ba=0;
          for(var ci=0;ci<cvs.length;ci++){
            var a=cvs[ci].clientWidth*cvs[ci].clientHeight;
            if(a>ba){ ba=a; best=cvs[ci]; }
          }
          espilHurtCanvas=best;
        }
        if(espilHurtCanvas){
          if(espilHurt.shake>.05){
            var ox=(Math.random()*2-1)*espilHurt.shake, oy=(Math.random()*2-1)*espilHurt.shake*.7;
            espilHurtCanvas.style.transform='translate('+ox.toFixed(1)+'px,'+oy.toFixed(1)+'px)';
          }else espilHurtCanvas.style.transform='';
        }
        if(espilHurtVigEl)espilHurtVigEl.style.opacity=espilHurt.vig.toFixed(3);
      }catch(e){}
    },33);
    window.__espilHurtFxState=function(){
      return { hits:espilHurt.hits, lastDmg:espilHurt.lastDmg,
        shake:Math.round(espilHurt.shake*100)/100, shakePeak:espilHurt.shakePeak,
        vig:Math.round(espilHurt.vig*1000)/1000, vigPeak:espilHurt.vigPeak,
        punch:espilHurt.punch, kb:espilHurt.kb, sound:espilHurt.sound };
    };
    /* ================================================================
       HEAL FX (Han 2026-11-13, via COO): the 5-step healing-feel
       treatment, applied to EVERY HP-recovery moment:
         1. Fill it smoothly - the flask/HUD fill animates up instead
            of jumping (drives paintStatus display values).
         2. Rising pluses - small "+" signs rise from the player.
         3. Aura - a light pillar wraps the player (one reused THREE
            cylinder in mapScene).
         4. Big number - the recovered amount (+N) shows BIG above
            the head, with a confetti burst.
         5. Count it up - the HP number ticks up to the true value.
       ONE shared entry point: espilHealTrigger(dHp, dMp), called by
       __espilApplyRecovery (food/drink through panels' listener, and
       any future caller) and by espilReviveCommon (village revive,
       death-screen potion, arena stock + cash revives). No other
       heal presentation exists anywhere.
       PRESENTATION ONLY: HP/MP state changes instantly, in the same
       amounts as before (the D4 draft table is untouched); this layer
       only animates what is DISPLAYED, over 900 ms, and lands
       EXACTLY on true state. Rules:
       - Damage wins: if true state drops below an animation's
         target mid-window, that bar's animation cancels and state
         renders at once; the renderer also hard-caps the display at
         true state, so a heal can never mask a hit.
       - Trickle gains above the target (MP regen, armour a_regen)
         are absorbed into the target, so the count still lands
         exactly on state.
       - Rapid successive heals: no queue. The bar animation
         RESTARTS from the current display value toward the new true
         state with a fresh window; the world FX restarts with the
         LATEST event's amount (amounts are per-event, not summed).
       - Passive trickles are not events and never fire the FX -
         they already move the bars smoothly on their own.
       - An MP-only event (e.g. Canned Coffee) runs the same 5 steps
         on the MP bar in a blue palette, big number = the MP amount;
         when both rise, HP is the headline and MP rides as a sub-line.
       Cost: 23 pooled DOM nodes + 1 pooled THREE mesh, created once;
       per active frame <= 24 style writes + 3 projections + O(1)
       bar math; zero per-frame allocation; idle cost is one
       early-return per frame.
       ================================================================ */
    var ESPIL_HEAL_DUR_MS=900;    /* steps 1+5: fill + count-up window */
    var ESPIL_HEAL_FX_S=1.15;     /* steps 2-4: pluses/aura/number life */
    var espilHealDisp={
      hp:{active:false,from:0,to:0,t:0,val:0},
      mp:{active:false,from:0,to:0,t:0,val:0},
      triggers:0,lastHp:0,lastMp:0
    };
    function espilHealDispVal(bar){
      var b=espilHealDisp[bar];
      return b.active?b.val:((bar==='hp')?skillState.hp:skillState.mp);
    }
    /* mmo-hud.js reads this so its HP/MP bars share the same display
       values (its own state read stays the fallback when inactive -
       the values returned here already fall back to true state). */
    window.__espilHealDisplay=function(){
      return { active:espilHealDisp.hp.active||espilHealDisp.mp.active,
        hp:espilHealDispVal('hp'), mp:espilHealDispVal('mp'),
        maxhp:skillState.maxhp, maxmp:skillState.maxmp };
    };
    window.__espilHealFxState=function(){
      var f=espilHealFx;
      return { triggers:espilHealDisp.triggers,
        lastHp:espilHealDisp.lastHp, lastMp:espilHealDisp.lastMp,
        hpAnim:espilHealDisp.hp.active?{from:Math.round(espilHealDisp.hp.from*10)/10,to:espilHealDisp.hp.to,val:Math.round(espilHealDisp.hp.val*10)/10}:null,
        mpAnim:espilHealDisp.mp.active?{from:Math.round(espilHealDisp.mp.from*10)/10,to:espilHealDisp.mp.to,val:Math.round(espilHealDisp.mp.val*10)/10}:null,
        dispHp:Math.round(espilHealDispVal('hp')*10)/10, dispMp:Math.round(espilHealDispVal('mp')*10)/10,
        worldActive:f.active, worldT:Math.round(f.t*100)/100,
        pillarVisible:!!(f.pillar&&f.pillar.visible),
        numText:f.numBig?f.numBig.textContent:null };
    };
    function espilHealStartBar(bar,delta){
      var b=espilHealDisp[bar];
      var cur=(bar==='hp')?skillState.hp:skillState.mp;
      b.from=b.active?b.val:(cur-delta);
      b.to=cur; b.t=0; b.val=b.from; b.active=true;
    }
    function espilHealTickBar(bar,dt){
      var b=espilHealDisp[bar];
      if(!b.active)return false;
      var cur=(bar==='hp')?skillState.hp:skillState.mp;
      if(cur<b.to){ b.active=false; b.val=cur; return true; }  /* damage/death wins */
      if(cur>b.to)b.to=cur;                                   /* absorb trickle gains */
      b.t+=dt*1000;
      var k=Math.min(1,b.t/ESPIL_HEAL_DUR_MS), e=1-Math.pow(1-k,3);
      b.val=b.from+(b.to-b.from)*e;
      if(k>=1){ b.active=false; b.val=b.to; }
      return true;
    }
    function espilHealTick(dt){
      var dirty=false;
      if(espilHealTickBar('hp',dt))dirty=true;
      if(espilHealTickBar('mp',dt))dirty=true;
      if(dirty)paintStatus();
      espilHealFxTick(dt);
    }
    function espilHealTrigger(dHp,dMp){
      /* amounts RECOVERED: a revive can set MP below its pre-death
         value (50% of max < current) - that is not a negative heal. */
      dHp=Math.max(0,dHp||0); dMp=Math.max(0,dMp||0);
      if(dHp<=0&&dMp<=0)return;
      espilHealDisp.triggers++;
      espilHealDisp.lastHp=dHp; espilHealDisp.lastMp=dMp;
      if(dHp>0)espilHealStartBar('hp',dHp);
      if(dMp>0)espilHealStartBar('mp',dMp);
      espilHealFxStart(dHp,dMp);
      paintStatus();
    }
    /* ---- steps 2-4: player-anchored world FX (pooled) ---- */
    var espilHealFx={ active:false, t:0, dHp:0, dMp:0,
      layer:null, numWrap:null, numBig:null, numSub:null,
      pluses:[], confetti:[], plusSeed:[], confSeed:[],
      pillar:null, pillarMat:null, vec:null };
    function espilHealFxEnsure(){
      var f=espilHealFx;
      if(f.layer)return true;
      try{
        var layer=document.createElement('div');
        layer.id='espil-healfx';
        layer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9993;overflow:hidden;display:none;';
        var wrap=document.createElement('div');
        wrap.style.cssText='position:absolute;left:-600px;top:-600px;transform:translate(-50%,-50%);text-align:center;white-space:nowrap;';
        var big=document.createElement('div');
        big.style.cssText='font:900 46px Manrope,sans-serif;line-height:1;'+
          'text-shadow:0 0 16px rgba(105,240,174,.9),0 2px 6px rgba(0,0,0,.8);';
        var sub=document.createElement('div');
        sub.style.cssText='font:800 19px Manrope,sans-serif;line-height:1.25;'+
          'text-shadow:0 0 10px rgba(124,199,255,.9),0 2px 5px rgba(0,0,0,.8);';
        wrap.appendChild(big); wrap.appendChild(sub); layer.appendChild(wrap);
        var i,el;
        for(i=0;i<8;i++){
          el=document.createElement('div');
          el.textContent='+';
          el.style.cssText='position:absolute;left:-600px;top:-600px;transform:translate(-50%,-50%);'+
            'font:900 20px Manrope,sans-serif;text-shadow:0 0 8px rgba(105,240,174,.8),0 1px 4px rgba(0,0,0,.7);opacity:0;';
          layer.appendChild(el); f.pluses.push(el);
        }
        for(i=0;i<14;i++){
          el=document.createElement('div');
          el.style.cssText='position:absolute;left:-600px;top:-600px;width:7px;height:11px;border-radius:2px;opacity:0;';
          layer.appendChild(el); f.confetti.push(el);
        }
        document.body.appendChild(layer);
        f.layer=layer; f.numWrap=wrap; f.numBig=big; f.numSub=sub;
        return true;
      }catch(e){ return false; }
    }
    function espilHealPillarTex(){
      var cv=document.createElement('canvas'); cv.width=4; cv.height=256;
      var g=cv.getContext('2d');
      var gr=g.createLinearGradient(0,0,0,256);
      gr.addColorStop(0,'rgba(255,255,255,0)');
      gr.addColorStop(.35,'rgba(255,255,255,.38)');
      gr.addColorStop(.62,'rgba(255,255,255,.85)');
      gr.addColorStop(.85,'rgba(255,255,255,.55)');
      gr.addColorStop(1,'rgba(255,255,255,.12)');
      g.fillStyle=gr; g.fillRect(0,0,4,256);
      var tx=new THREE.CanvasTexture(cv);
      return tx;
    }
    function espilHealFxStart(dHp,dMp){
      var f=espilHealFx;
      if(!espilHealFxEnsure())return;
      var hpLed=dHp>0;
      var mainCol=hpLed?'#69f0ae':'#7cc7ff';
      f.dHp=dHp; f.dMp=dMp; f.t=0; f.active=true;
      f.numBig.textContent='+'+Math.round(hpLed?dHp:dMp);
      f.numBig.style.color=mainCol;
      f.numBig.style.textShadow=hpLed?
        '0 0 16px rgba(105,240,174,.9),0 2px 6px rgba(0,0,0,.8)':
        '0 0 16px rgba(124,199,255,.9),0 2px 6px rgba(0,0,0,.8)';
      f.numSub.textContent=(hpLed&&dMp>0)?('+'+Math.round(dMp)+' MP'):'';
      f.numSub.style.color='#7cc7ff';
      var i,r;
      f.plusSeed.length=0;
      for(i=0;i<f.pluses.length;i++){
        r=Math.random;
        var blue=(!hpLed)||(dMp>0&&i>=6);
        f.pluses[i].style.color=blue?'#7cc7ff':'#69f0ae';
        f.pluses[i].style.fontSize=(15+Math.floor(r()*10))+'px';
        f.plusSeed.push({dx:(r()*104-52),delay:i*0.05+r()*0.09,rise:0.68+r()*0.28});
      }
      var pal=hpLed?['#69f0ae','#ffd76a','#ffffff','#a7f3c9']:['#7cc7ff','#ffffff','#bfe3ff','#ffd76a'];
      f.confSeed.length=0;
      for(i=0;i<f.confetti.length;i++){
        r=Math.random;
        f.confetti[i].style.background=pal[i%pal.length];
        f.confSeed.push({vx:(r()*190-95),vy:-(60+r()*110),rot:r()*360,spin:(r()*520-260)});
      }
      if(mapScene&&typeof THREE!=='undefined'){
        try{
          if(!f.pillar){
            var geo=new THREE.CylinderGeometry(0.85,1.05,3.4,24,1,true);
            f.pillarMat=new THREE.MeshBasicMaterial({map:espilHealPillarTex(),color:0x69f0ae,
              transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
              depthWrite:false,fog:false});
            f.pillar=new THREE.Mesh(geo,f.pillarMat);
            f.pillar.renderOrder=6; f.pillar.frustumCulled=false; f.pillar.visible=false;
            mapScene.add(f.pillar);
          }
          f.pillarMat.color.set(hpLed?0x69f0ae:0x7cc7ff);
        }catch(e){}
      }
      f.layer.style.display='block';
    }
    function espilHealFxHide(){
      var f=espilHealFx,i;
      if(f.layer)f.layer.style.display='none';
      if(f.pillar)f.pillar.visible=false;
      for(i=0;i<f.pluses.length;i++)f.pluses[i].style.opacity='0';
      for(i=0;i<f.confetti.length;i++)f.confetti[i].style.opacity='0';
    }
    function espilHealFxTick(dt){
      var f=espilHealFx;
      if(!f.active)return;
      f.t+=dt;
      if(f.t>=ESPIL_HEAL_FX_S){ f.active=false; espilHealFxHide(); return; }
      var t=f.t;
      if(!walkPlayer||typeof mapCamera==='undefined'||!mapCamera||
         !document.body.classList.contains('in-map')){
        if(f.layer)f.layer.style.display='none';
        if(f.pillar)f.pillar.visible=false;
        return;
      }
      if(f.layer&&f.layer.style.display==='none')f.layer.style.display='block';
      if(!f.vec)f.vec=new THREE.Vector3();
      var v=f.vec, px=walkPlayer.pos.x, py=walkPlayer.pos.y, pz=walkPlayer.pos.z;
      function sx(h){ v.set(px,py+h,pz).project(mapCamera); return (v.x*.5+.5)*window.innerWidth; }
      function sy(h){ v.set(px,py+h,pz).project(mapCamera); return (-v.y*.5+.5)*window.innerHeight; }
      v.set(px,py+0.2,pz).project(mapCamera);
      if(v.z>1||v.z<-1||Math.abs(v.x)>1.15||Math.abs(v.y)>1.15){
        if(f.layer)f.layer.style.display='none';
        if(f.pillar)f.pillar.visible=false;
        return;
      }
      var X=sx(0.2), Ymid=sy(1.05), Ytop=sy(2.3), Ynum=sy(2.55);
      var i,el,lt,p;
      /* step 2: rising pluses */
      for(i=0;i<f.pluses.length;i++){
        el=f.pluses[i]; var sd=f.plusSeed[i];
        lt=t-sd.delay;
        if(lt<0||lt>sd.rise){ el.style.opacity='0'; continue; }
        p=lt/sd.rise;
        el.style.left=(X+sd.dx*(0.55+0.45*p))+'px';
        el.style.top=(Ymid+(Ytop-Ymid)*p)+'px';
        el.style.opacity=String(p<0.15?(p/0.15):(p>0.7?((1-p)/0.3):1));
      }
      /* step 4: big number (pop, settle, fade) + confetti burst */
      var popK=Math.min(1,t/0.16), scale=0.55+0.65*(1-Math.pow(1-popK,3));
      if(t>0.16)scale=1.2-0.2*Math.min(1,(t-0.16)/0.14);
      var nOp=t<0.8?1:Math.max(0,1-(t-0.8)/0.35);
      f.numWrap.style.left=X+'px';
      f.numWrap.style.top=(Ynum-t*14)+'px';
      f.numWrap.style.opacity=String(nOp);
      f.numWrap.style.transform='translate(-50%,-50%) scale('+scale.toFixed(3)+')';
      for(i=0;i<f.confetti.length;i++){
        el=f.confetti[i]; var cs=f.confSeed[i];
        if(t>0.95){ el.style.opacity='0'; continue; }
        el.style.left=(X+cs.vx*t)+'px';
        el.style.top=(Ynum+cs.vy*t+300*t*t)+'px';
        el.style.opacity=String(t<0.55?1:Math.max(0,1-(t-0.55)/0.4));
        el.style.transform='translate(-50%,-50%) rotate('+(cs.rot+cs.spin*t).toFixed(1)+'deg)';
      }
      /* step 3: aura pillar follows the player */
      if(f.pillar&&f.pillarMat){
        f.pillar.visible=true;
        f.pillar.position.set(px,py+1.65,pz);
        f.pillar.rotation.y+=dt*0.9;
        var pOp=t<0.12?(t/0.12)*0.5:(t>0.75?0.5*Math.max(0,1-(t-0.75)/0.4):0.5);
        f.pillarMat.opacity=pOp;
        var ps=1+0.1*Math.min(1,t/0.5);
        f.pillar.scale.set(ps,1,ps);
      }
    }
    /* ================================================================
       WATER-ENTRY FEEL (Han 2026-11-15, reel DfEo_LhxVRJ): the five
       steps as ONE shared treatment, fired ONLY from the swimming
       state transition in updateWalkMap (the game's single .swimming=
       assignment). Local player only: presence does not sync swim
       state, so remotes have no swim presentation to hang this on.
       1 splash crown + droplet rain (one pooled Points set - the
       falling half IS the rain), 2 ripple rings on the surface,
       3 fully synthesised splash + droplet ticks on a water bus
       (no audio files), 4 a bubble column FIXED at the entry point
       (it stays after the swimmer leaves - the reel's picture),
       5 a lowered swim camera whose intermittent dips under the
       surface drive a DOM tint + BGM/water-bus muffle together
       (Han's 2026-11-15 decision (a): near the surface with
       occasional submersion, NOT the reel's fully-under camera).
       Exit: small splash + ring + a .45 s procedural shake-off
       (no shake clip exists). All pools are built once; the tick
       allocates nothing per frame. Anchor drift vs DIAGNOSIS.md:
       swim transition 10604 -> 10655, camera floor ~10783 -> 10832,
       skillSfx 5934 -> 5984 (foot-slide hunks added ~+50 lines). */
    var ESPIL_WATER_SPLASH_N=90, ESPIL_WATER_BUBBLE_N=42, ESPIL_WATER_RING_N=3;
    var ESPIL_WATER_SOUND_DEBOUNCE_MS=300;
    var espilWater={
      entries:0, exits:0, lastKind:null, lastEntryAt:0, lastExitAt:0,
      splashBursts:0, ringsSpawned:0, bubbleEmitters:0,
      splashVoices:0, dropletTicks:0, exitSplashes:0, shakes:0,
      muffleOn:false, camUnder:false, camY:null, sinkPoint:null,
      t:0, shakeT:-1, shakePlayer:null, lastSoundAt:0, peak:0, peakArr:null,
      dropPts:null, dropPos:null, drops:[], dropTex:null,
      bubPts:null, bubPos:null, bub:[], bubTex:null, bubEmit:null,
      rings:[], tintEl:null,
      bus:null, busFilter:null, analyser:null, noiseBuf:null
    };
    function espilWaterDropTexture(){
      if(espilWater.dropTex)return espilWater.dropTex;
      var c=document.createElement('canvas'); c.width=c.height=64;
      var x=c.getContext('2d');
      var g=x.createRadialGradient(32,32,2,32,32,30);
      g.addColorStop(0,'rgba(255,255,255,.95)');
      g.addColorStop(.55,'rgba(212,240,252,.75)');
      g.addColorStop(1,'rgba(180,225,248,0)');
      x.fillStyle=g; x.fillRect(0,0,64,64);
      var t=new THREE.CanvasTexture(c); espilWater.dropTex=t; return t;
    }
    function espilWaterBubbleTexture(){
      if(espilWater.bubTex)return espilWater.bubTex;
      var c=document.createElement('canvas'); c.width=c.height=64;
      var x=c.getContext('2d');
      x.fillStyle='rgba(200,238,255,.18)';
      x.beginPath(); x.arc(32,32,24,0,Math.PI*2); x.fill();
      x.strokeStyle='rgba(232,248,255,.95)'; x.lineWidth=5;
      x.beginPath(); x.arc(32,32,24,0,Math.PI*2); x.stroke();
      x.fillStyle='rgba(255,255,255,.85)';
      x.beginPath(); x.arc(23,22,6,0,Math.PI*2); x.fill();
      var t=new THREE.CanvasTexture(c); espilWater.bubTex=t; return t;
    }
    function espilWaterEnsure(){
      var W=espilWater;
      if(W.dropPts)return true;
      if(typeof THREE==='undefined'||!mapScene)return false;
      try{
        var i;
        W.dropPos=new Float32Array(ESPIL_WATER_SPLASH_N*3);
        for(i=0;i<ESPIL_WATER_SPLASH_N;i++){
          W.drops.push({on:false,x:0,y:-999,z:0,vx:0,vy:0,vz:0,life:0,killY:WATER_Y-.05});
          W.dropPos[i*3+1]=-999;
        }
        var dg=new THREE.BufferGeometry();
        dg.setAttribute('position',new THREE.BufferAttribute(W.dropPos,3).setUsage(THREE.DynamicDrawUsage));
        W.dropPts=new THREE.Points(dg,new THREE.PointsMaterial({size:.34,map:espilWaterDropTexture(),
          transparent:true,opacity:.92,color:0x9fd4e8,depthWrite:false,sizeAttenuation:true}));
        W.dropPts.frustumCulled=false; W.dropPts.renderOrder=11;
        mapScene.add(W.dropPts);
        W.bubPos=new Float32Array(ESPIL_WATER_BUBBLE_N*3);
        for(i=0;i<ESPIL_WATER_BUBBLE_N;i++){
          W.bub.push({on:false,x:0,y:-999,z:0,vy:0,ph:0,life:0});
          W.bubPos[i*3+1]=-999;
        }
        var bg=new THREE.BufferGeometry();
        bg.setAttribute('position',new THREE.BufferAttribute(W.bubPos,3).setUsage(THREE.DynamicDrawUsage));
        W.bubPts=new THREE.Points(bg,new THREE.PointsMaterial({size:.17,map:espilWaterBubbleTexture(),
          transparent:true,opacity:.55,color:0xdff4ff,depthWrite:false,sizeAttenuation:true}));
        W.bubPts.frustumCulled=false; W.bubPts.renderOrder=9;
        mapScene.add(W.bubPts);
        for(i=0;i<ESPIL_WATER_RING_N;i++){
          var ring=new THREE.Mesh(new THREE.RingGeometry(.86,1,48),
            new THREE.MeshBasicMaterial({color:0xbfe6f5,transparent:true,opacity:0,
              depthWrite:false,side:THREE.DoubleSide,fog:false}));
          ring.rotation.x=-Math.PI/2; ring.visible=false; ring.renderOrder=10;
          ring.frustumCulled=false;
          mapScene.add(ring);
          W.rings.push({mesh:ring,t:0,life:1.4,maxR:3.2,on:false});
        }
        return true;
      }catch(e){ return false; }
    }
    function espilWaterSpawnSplash(x,z,count,pow,spread,y0,killY){
      var W=espilWater;
      if(!espilWaterEnsure())return;
      var spawned=0, i, d;
      function arm(d){
        var a=Math.random()*Math.PI*2, r=(.25+Math.random()*.75)*spread;
        d.on=true; d.life=0;
        d.x=x+Math.cos(a)*r*.35; d.z=z+Math.sin(a)*r*.35; d.y=y0;
        d.vx=Math.cos(a)*r*pow; d.vz=Math.sin(a)*r*pow;
        d.vy=(2.2+Math.random()*2.0)*pow;
        d.killY=killY;
      }
      for(i=0;i<W.drops.length&&spawned<count;i++){ d=W.drops[i]; if(d.on)continue; arm(d); spawned++; }
      /* pool busy: overwrite the oldest falling drops (design rule) */
      while(spawned<count){
        var old=null;
        for(i=0;i<W.drops.length;i++){ d=W.drops[i]; if(d.on&&(!old||d.life>old.life))old=d; }
        if(!old)break;
        arm(old); spawned++;
      }
      if(spawned>0)W.splashBursts++;
    }
    function espilWaterSpawnRings(x,z,count,maxR){
      var W=espilWater;
      if(!espilWaterEnsure())return;
      var spawned=0;
      for(var i=0;i<W.rings.length&&spawned<count;i++){
        var r=W.rings[i];
        if(r.on)continue;
        r.on=true; r.t=-spawned*.18; r.maxR=maxR;
        r.mesh.position.set(x,WATER_Y+.03,z);
        r.mesh.visible=false;
        spawned++; W.ringsSpawned++;
      }
    }
    function espilWaterStartBubbles(x,z){
      var W=espilWater;
      if(!espilWaterEnsure())return;
      W.bubEmit={x:x,z:z,until:W.t+2.8,acc:0};
      W.bubbleEmitters++;
      W.sinkPoint={x:x,z:z};
    }
    function espilWaterAudio(){
      var W=espilWater;
      try{
        if(!walkAudioCtx)walkAudioCtx=new (window.AudioContext||window.webkitAudioContext)();
        if(walkAudioCtx.state==='suspended')walkAudioCtx.resume();
        var ctx=walkAudioCtx;
        if(!W.bus){
          W.busFilter=ctx.createBiquadFilter(); W.busFilter.type='lowpass'; W.busFilter.frequency.value=18000;
          W.bus=ctx.createGain(); W.bus.gain.value=.9;
          W.analyser=ctx.createAnalyser(); W.analyser.fftSize=512;
          W.bus.connect(W.busFilter); W.busFilter.connect(W.analyser); W.analyser.connect(ctx.destination);
          var len=Math.floor(ctx.sampleRate*.5), buf=ctx.createBuffer(1,len,ctx.sampleRate), dd=buf.getChannelData(0);
          for(var i=0;i<len;i++)dd[i]=Math.random()*2-1;
          W.noiseBuf=buf;
        }
        return ctx;
      }catch(e){ return null; }
    }
    function espilWaterSplashSound(pow){
      var W=espilWater, ctx=espilWaterAudio();
      if(!ctx||!W.bus)return;
      var now=performance.now();
      if(now-W.lastSoundAt<ESPIL_WATER_SOUND_DEBOUNCE_MS)return;
      W.lastSoundAt=now;
      try{
        var t=ctx.currentTime;
        /* (a) deep sploosh: noise through a lowpass swept down */
        var src=ctx.createBufferSource(); src.buffer=W.noiseBuf; src.loop=true;
        var f=ctx.createBiquadFilter(); f.type='lowpass';
        f.frequency.setValueAtTime(2800,t);
        f.frequency.exponentialRampToValueAtTime(240,t+.45*pow);
        var g=ctx.createGain();
        g.gain.setValueAtTime(.5*pow,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.55*pow);
        src.connect(f); f.connect(g); g.connect(W.bus);
        src.start(t); src.stop(t+.6*pow+.05);
        /* (b) the low thump under it (skillSfx 'thud' precedent) */
        var o=ctx.createOscillator(), og=ctx.createGain();
        o.type='sine';
        o.frequency.setValueAtTime(130,t);
        o.frequency.exponentialRampToValueAtTime(44,t+.38);
        og.gain.setValueAtTime(.34*pow,t);
        og.gain.exponentialRampToValueAtTime(.001,t+.4);
        o.connect(og); og.connect(W.bus);
        o.start(t); o.stop(t+.42);
        W.splashVoices++;
        /* droplet patter while the crown falls back */
        var ticks=7+Math.floor(Math.random()*5);
        for(var i=0;i<ticks;i++){
          var tt=t+.15+Math.random()*.75;
          var ts=ctx.createBufferSource(); ts.buffer=W.noiseBuf;
          ts.playbackRate.value=.8+Math.random()*.5;
          var tf=ctx.createBiquadFilter(); tf.type='bandpass';
          tf.frequency.value=2200+Math.random()*2000; tf.Q.value=8;
          var tg=ctx.createGain();
          tg.gain.setValueAtTime(.05+Math.random()*.07,tt);
          tg.gain.exponentialRampToValueAtTime(.001,tt+.045);
          ts.connect(tf); tf.connect(tg); tg.connect(W.bus);
          ts.start(tt,Math.random()*.3); ts.stop(tt+.06);
          W.dropletTicks++;
        }
      }catch(e){}
    }
    function espilWaterEnter(p,preVy){
      var W=espilWater;
      var now=performance.now();
      var kind='walk';
      if(p._espilWaterLeapAt&&now-p._espilWaterLeapAt<1600&&preVy<-.5)kind='leap';
      else if(preVy<-5)kind='fall';
      p._espilWaterLeapAt=0;
      W.entries++; W.lastKind=kind; W.lastEntryAt=now;
      var pow=kind==='fall'?Math.min(1.6,Math.max(.8,Math.abs(preVy)/7)):(kind==='leap'?1:.45);
      espilWaterSpawnSplash(p.pos.x,p.pos.z,kind==='walk'?42:ESPIL_WATER_SPLASH_N,pow,1.25,WATER_Y+.05,WATER_Y-.05);
      espilWaterSpawnRings(p.pos.x,p.pos.z,kind==='walk'?2:3,kind==='walk'?1.6:3.2);
      if(kind!=='walk')espilWaterStartBubbles(p.pos.x,p.pos.z);
      espilWaterSplashSound(pow);
    }
    function espilWaterExit(p){
      var W=espilWater;
      var now=performance.now();
      W.exits++; W.lastExitAt=now;
      var leap=p.velY>2.5;
      if(leap)p._espilWaterLeapAt=now;
      /* Teleports (revive, arena, story jumps) also flip the state -
         a splash belongs only to a real exit near the last water
         point, so a far flip is counted but fires nothing. */
      var lx=(p._espilWaterX!=null)?p._espilWaterX:p.pos.x,
          lz=(p._espilWaterZ!=null)?p._espilWaterZ:p.pos.z;
      var dx=p.pos.x-lx, dz=p.pos.z-lz;
      if(dx*dx+dz*dz>900)return;
      W.exitSplashes++;
      espilWaterSpawnSplash(lx,lz,26,leap?.8:.5,.8,WATER_Y+.05,WATER_Y-.05);
      espilWaterSpawnRings(lx,lz,1,1.6);
      espilWaterSplashSound(.5);
      if(!leap){
        /* shake-off: no clip exists, so the rendered group gets a
           short damped roll; physics and position are untouched. */
        W.shakeT=0; W.shakePlayer=p; W.shakes++;
        espilWaterSpawnSplash(p.pos.x,p.pos.z,10,.35,.5,p.pos.y+.9,p.pos.y-.1);
      }
    }
    function espilWaterEnsureTint(){
      var W=espilWater;
      if(W.tintEl)return W.tintEl;
      var el=document.createElement('div');
      el.id='espil-water-tint';
      el.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9992;opacity:0;transition:opacity .25s;'+
        'background:linear-gradient(180deg, rgba(10,80,105,.34), rgba(6,52,78,.44));';
      document.body.appendChild(el);
      W.tintEl=el; return el;
    }
    function espilWaterSetMuffle(on){
      var W=espilWater;
      W.muffleOn=on;
      try{ if(window.EspilAudio&&window.EspilAudio.setMuffle)window.EspilAudio.setMuffle(on); }catch(e){}
      if(W.busFilter&&walkAudioCtx){
        try{
          /* mirror EspilAudio.setMuffle: a context left suspended
             (headless rigs, long-idle tabs) freezes currentTime and
             with it the ramp below - nudge it on every flip. */
          if(walkAudioCtx.state==='suspended')walkAudioCtx.resume();
          var t=walkAudioCtx.currentTime;
          W.busFilter.frequency.cancelScheduledValues(t);
          W.busFilter.frequency.setValueAtTime(W.busFilter.frequency.value,t);
          W.busFilter.frequency.linearRampToValueAtTime(on?1200:18000,t+.25);
        }catch(e){}
      }
    }
    function espilWaterFxTick(dt){
      var W=espilWater;
      W.t+=dt;
      var p=walkPlayer, i, d;
      /* step 5: submersion is read off the APPLIED camera (this tick
         runs after the follow-camera block in updateWalkMap). */
      var under=false;
      if(typeof mapCamera!=='undefined'&&mapCamera){
        W.camY=Math.round(mapCamera.position.y*100)/100;
        under=!!(p&&p.swimming)&&mapCamera.position.y<.06;
      }
      if(under!==W.camUnder){
        W.camUnder=under;
        espilWaterSetMuffle(under);
      }
      if(W.camUnder||W.tintEl)espilWaterEnsureTint().style.opacity=W.camUnder?'1':'0';
      /* step 1: droplets (burst up, gravity brings the rain) */
      if(W.dropPts){
        var anyDrop=false;
        for(i=0;i<W.drops.length;i++){
          d=W.drops[i];
          if(!d.on)continue;
          anyDrop=true;
          d.life+=dt;
          d.vy-=9.8*dt;
          d.x+=d.vx*dt; d.y+=d.vy*dt; d.z+=d.vz*dt;
          if((d.vy<0&&d.y<d.killY)||d.life>.95){ d.on=false; d.y=-999; }
          W.dropPos[i*3]=d.x; W.dropPos[i*3+1]=d.y; W.dropPos[i*3+2]=d.z;
        }
        if(anyDrop)W.dropPts.geometry.attributes.position.needsUpdate=true;
      }
      /* step 4: bubble column fixed at the sink point */
      if(W.bubPts){
        var em=W.bubEmit;
        if(em){
          if(W.t>=em.until)W.bubEmit=null;
          else{
            em.acc+=dt*14;
            while(em.acc>=1){
              em.acc-=1;
              for(i=0;i<W.bub.length;i++){
                var b=W.bub[i];
                if(b.on)continue;
                b.on=true; b.life=0;
                b.x=em.x+(Math.random()-.5)*.5;
                b.z=em.z+(Math.random()-.5)*.5;
                b.y=-.6+Math.random()*.2;
                b.vy=.55+Math.random()*.4;
                b.ph=Math.random()*6.28;
                break;
              }
            }
          }
        }
        var anyBub=false;
        for(i=0;i<W.bub.length;i++){
          var bb=W.bub[i];
          if(!bb.on)continue;
          anyBub=true;
          bb.life+=dt;
          bb.y+=bb.vy*dt;
          if(bb.y>=WATER_Y-.02||bb.life>6){ bb.on=false; bb.y=-999; }
          W.bubPos[i*3]=bb.x+Math.sin(W.t*3+bb.ph)*.07;
          W.bubPos[i*3+1]=bb.y;
          W.bubPos[i*3+2]=bb.z+Math.cos(W.t*2.6+bb.ph)*.07;
        }
        if(anyBub)W.bubPts.geometry.attributes.position.needsUpdate=true;
      }
      /* step 2: ripple rings */
      for(i=0;i<W.rings.length;i++){
        var r=W.rings[i];
        if(!r.on)continue;
        r.t+=dt;
        if(r.t<0){ r.mesh.visible=false; continue; }
        var k=r.t/r.life;
        if(k>=1){ r.on=false; r.mesh.visible=false; continue; }
        r.mesh.visible=true;
        var rad=.4+(r.maxR-.4)*k;
        r.mesh.scale.set(rad,rad,1);
        r.mesh.material.opacity=.55*(1-k);
      }
      /* exit shake-off (render group only) */
      if(W.shakeT>=0){
        var sp2=W.shakePlayer;
        if(sp2&&sp2.av&&sp2.av.group){
          W.shakeT+=dt;
          var sk=W.shakeT/.45;
          if(sk>=1){ W.shakeT=-1; sp2.av.group.rotation.z=0; }
          else sp2.av.group.rotation.z=Math.sin(sk*Math.PI*5)*(1-sk)*.06;
        }else W.shakeT=-1;
      }
      /* analyser peak for the sound legs (the rig cannot listen) */
      if(W.analyser){
        if(!W.peakArr)W.peakArr=new Float32Array(W.analyser.fftSize);
        W.analyser.getFloatTimeDomainData(W.peakArr);
        var pk=0;
        for(i=0;i<W.peakArr.length;i++){ var av=Math.abs(W.peakArr[i]); if(av>pk)pk=av; }
        if(pk>W.peak)W.peak=pk;
      }
    }
    window.__espilWaterFXState=function(){
      var W=espilWater;
      var da=0, ba=0, ra=0, i;
      for(i=0;i<W.drops.length;i++)if(W.drops[i].on)da++;
      for(i=0;i<W.bub.length;i++)if(W.bub[i].on)ba++;
      for(i=0;i<W.rings.length;i++)if(W.rings[i].on)ra++;
      var mf={on:false,freq:null,graph:false};
      try{ if(window.EspilAudio&&window.EspilAudio.muffleState)mf=window.EspilAudio.muffleState(); }catch(e){}
      return { entries:W.entries, exits:W.exits,
        lastKind:W.lastKind, lastEntryAt:W.lastEntryAt, lastExitAt:W.lastExitAt,
        splashBursts:W.splashBursts, ringsSpawned:W.ringsSpawned,
        bubbleEmitters:W.bubbleEmitters, splashVoices:W.splashVoices,
        dropletTicks:W.dropletTicks, exitSplashes:W.exitSplashes, shakes:W.shakes,
        dropletsAlive:da, bubblesAlive:ba, ringsActive:ra,
        bubbleEmitterOn:!!W.bubEmit,
        sinkPoint:W.sinkPoint?{x:Math.round(W.sinkPoint.x*10)/10,z:Math.round(W.sinkPoint.z*10)/10}:null,
        camY:W.camY, camUnder:W.camUnder,
        muffleOn:W.muffleOn, bgmMuffle:mf,
        busFreq:W.busFilter?Math.round(W.busFilter.frequency.value):null,
        peak:Math.round(W.peak*1000)/1000,
        shakeActive:W.shakeT>=0 };
    };
    /* S4 contract: panels' food-use listener restores through here. */
    window.__espilApplyRecovery=function(hp,mp){
      hp=Math.max(0,Math.floor(hp||0)); mp=Math.max(0,Math.floor(mp||0));
      var _hb=skillState.hp, _mb=skillState.mp;
      if(!espilDead&&(hp>0||mp>0)){
        skillState.hp=Math.min(skillState.maxhp,skillState.hp+hp);
        skillState.mp=Math.min(skillState.maxmp,skillState.mp+mp);
        saveSkills(); paintStatus();
      }
      /* HEAL FX: fire on the ACTUAL applied delta (post-clamp), so a
         full-bar use stays silent and state remains the only truth. */
      espilHealTrigger(skillState.hp-_hb,skillState.mp-_mb);
      return {hp:skillState.hp,mp:skillState.mp};
    };
    window.__espilCombatState=function(){
      /* Batch 5 merge: ONE definition - the canonical fields plus
         the mobile cluster's cooldown map. (A second definition
         added for item 3 briefly shadowed this one and dropped
         guardAge/graceLeft/potions; merged back the same day.) */
      var cds={};
      try{ for(var ck in skillState.cd) cds[ck]=Math.round(skillState.cd[ck]*100)/100; }catch(e){}
      return { dead:espilDead, hp:skillState.hp, maxhp:skillState.maxhp,
        mp:skillState.mp, maxmp:skillState.maxmp,
        guarding:(walkPlayer&&walkPlayer.guarding>0)?Math.round(walkPlayer.guarding*100)/100:0,
        guardAge:espilDefenseAt<0?null:Math.round((espilGameT-espilDefenseAt)*1000)/1000,
        graceLeft:Math.max(0,Math.round((espilGraceEnd-espilGameT)*1000)/1000),
        potions:espilPotionCount(), lastHit:espilLastHit, cd:cds };
    };
    /* ---- Revival Potion ownership (panels' bag list format) ---- */
    function espilOwnedList(){
      try{ var a=JSON.parse(localStorage.getItem('espil_owned_items')||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; }
    }
    function espilPotionCount(){
      var a=espilOwnedList(),c=0;
      for(var i=0;i<a.length;i++)if(a[i]==='Revival Potion')c++;
      return c;
    }
    function espilConsumePotion(){
      var a=espilOwnedList(),i=a.indexOf('Revival Potion');
      if(i<0)return false;
      a.splice(i,1);
      try{ localStorage.setItem('espil_owned_items',JSON.stringify(a)); }catch(e){}
      return true;
    }
    /* ---- death choice UI ---- */
    var espilDeathEl=null;
    function espilEnsureDeathUI(){
      if(espilDeathEl)return espilDeathEl;
      var el=document.createElement('div');
      el.id='espil-death-ui';
      el.setAttribute('aria-hidden','true');
      el.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;'+
        'background:rgba(10,6,4,.55);z-index:9995;';
      el.innerHTML='<div style="background:linear-gradient(180deg,#3a2a1c,#241a10);border:2px solid #8a6a44;'+
        'border-radius:14px;padding:26px 30px;text-align:center;color:#f2e3c2;max-width:420px;'+
        'box-shadow:0 12px 40px rgba(0,0,0,.6);font-family:sans-serif;">'+
        '<div style="font-size:26px;font-weight:800;margin-bottom:8px;">You have fallen</div>'+
        '<p style="margin:0 0 18px;font-size:14px;line-height:1.5;">The city still needs you, Keeper.<br>Choose how you return.</p>'+
        '<button id="espil-death-village" type="button" style="display:block;width:100%;margin:0 0 10px;padding:12px;'+
        'border-radius:9px;border:1px solid #8a6a44;background:#57402a;color:#ffe9bd;font-size:15px;font-weight:700;cursor:pointer;">'+
        '🏛 Return to the Village<br><span style="font-weight:400;font-size:12px;">Revive at the Art Gallery · HP 10% · MP 10%</span></button>'+
        '<button id="espil-death-potion" type="button" style="display:block;width:100%;padding:12px;'+
        'border-radius:9px;border:1px solid #8a6a44;background:#6d2f3f;color:#ffd7e0;font-size:15px;font-weight:700;cursor:pointer;">'+
        '🧪 Use a Revival Potion<br><span id="espil-death-potion-sub" style="font-weight:400;font-size:12px;">Revive here · HP 50% · MP 50%</span></button>'+
        '</div>';
      document.body.appendChild(el);
      el.querySelector('#espil-death-village').addEventListener('click',espilReviveVillage);
      el.querySelector('#espil-death-potion').addEventListener('click',espilRevivePotion);
      espilDeathEl=el;
      return el;
    }
    function espilShowDeathUI(){
      var el=espilEnsureDeathUI();
      var n=espilPotionCount();
      var btn=el.querySelector('#espil-death-potion');
      var sub=el.querySelector('#espil-death-potion-sub');
      if(btn){ btn.disabled=n<=0; btn.style.opacity=n>0?'1':'.45'; btn.style.cursor=n>0?'pointer':'not-allowed'; }
      if(sub)sub.textContent='Revive here · HP 50% · MP 50% · Owned: '+n;
      el.style.display='flex';
      el.setAttribute('aria-hidden','false');
    }
    function espilHideDeathUI(){
      if(!espilDeathEl)return;
      espilDeathEl.style.display='none';
      espilDeathEl.setAttribute('aria-hidden','true');
    }
    function espilEnterDeath(){
      espilDead=true;
      try{ if(walkPlayer&&walkPlayer.av&&walkPlayer.av.__espilSetState)walkPlayer.av.__espilSetState('dead'); }catch(e){} /* Batch 6 Item D: sprite death set */
      if(!window.__espilDeathUiHold)espilShowDeathUI(); /* ARENA SEAM: held during an arena run - modules/arena.js presents the death surface */
      try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'player-died'}})); }catch(e){}
    }
    function espilReviveCommon(frac){
      try{ if(walkPlayer&&walkPlayer.av&&walkPlayer.av.__espilSetState)walkPlayer.av.__espilSetState('idle'); }catch(e){} /* Batch 6 Item D */
      var _hb=skillState.hp, _mb=skillState.mp;
      skillState.hp=Math.max(1,Math.ceil(skillState.maxhp*frac));
      skillState.mp=Math.ceil(skillState.maxmp*frac);
      espilDead=false;
      espilGraceEnd=espilGameT+ESPIL_REVIVE_GRACE_S;
      espilHideDeathUI();
      saveSkills(); paintStatus();
      /* HEAL FX (2026-11-13): every revive flavour funnels through
         here, so the 5-step treatment fires for all of them; the
         pillar/number anchor at the (possibly teleported) body. */
      espilHealTrigger(skillState.hp-_hb,skillState.mp-_mb);
    }
    function espilReviveVillage(){
      if(!espilDead)return;
      if(walkPlayer){
        try{ if(walkPlayer.flying&&typeof dismountVehicle==='function')dismountVehicle(); }catch(e){}
        walkPlayer.pos.set(ESPIL_SPAWN.x,.05,ESPIL_SPAWN.z);
        walkPlayer.velY=0; walkPlayer.onGround=true;
      }
      espilReviveCommon(.10);
    }
    function espilRevivePotion(){
      if(!espilDead)return;
      if(!espilConsumePotion()){ espilShowDeathUI(); return; }
      espilReviveCommon(.50);
    }
    /* ARENA SEAM (arena build, 2026-11-09): programmatic revives.
       __espilPlayerRevivePotion consumes one Revival Potion from
       the shared stock and revives in place at 50% - exactly the
       death UI potion button's path, callable by modules/arena.js
       which counts the use against the run's 3-stock cap.
       __espilPlayerRevive(frac) revives in place WITHOUT consuming
       stock (the cash revive: arena settles the entitlement
       through the cash shop before calling). __espilPlayerReviveVillage
       is espilReviveVillage exposed for the arena exit path, used
       when the death UI is held (item 2) and its button is absent. */
    window.__espilPlayerRevivePotion=function(){
      if(!espilDead)return false;
      if(!espilConsumePotion())return false;
      espilReviveCommon(.50);
      return true;
    };
    window.__espilPlayerRevive=function(frac){
      if(!espilDead)return false;
      espilReviveCommon((typeof frac==='number'&&frac>0&&frac<=1)?frac:.50);
      return true;
    };
    window.__espilPlayerReviveVillage=function(){
      if(!espilDead)return false;
      espilReviveVillage();
      return true;
    };
    /* ---- evade indicator ---- */
    var espilEvadeEl=null, espilEvadeTimer=0;
    function espilShowEvade(){
      try{
        if(!espilEvadeEl){
          espilEvadeEl=document.createElement('div');
          espilEvadeEl.id='espil-evade-flash';
          espilEvadeEl.style.cssText='position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);'+
            'font-family:sans-serif;font-weight:900;font-size:30px;color:#bfe9ff;letter-spacing:2px;'+
            'text-shadow:0 2px 6px rgba(0,0,0,.8);pointer-events:none;z-index:9994;opacity:0;transition:opacity .18s;';
          espilEvadeEl.textContent='EVADED!';
          document.body.appendChild(espilEvadeEl);
        }
        espilEvadeEl.style.opacity='1';
        if(espilEvadeTimer)clearTimeout(espilEvadeTimer);
        espilEvadeTimer=setTimeout(function(){ if(espilEvadeEl)espilEvadeEl.style.opacity='0'; },650);
      }catch(e){}
    }
    window.__espilSkills={state:skillState,gainKnowledge:gainKnowledge,
      move:doMove,tree:toggleSkillTree};
    /* ================================================================
       BATCH 6 (Han 2026-11-07) - Item C gear skill trees + Item D
       2D guest avatars.
       ================================================================ */
    /* ---------------- guest determination ----------------
       Guests are sessions without espil_session_v1. The account
       system is disabled in this build (entry-flow GUEST_ONLY), so
       every local player and every peer is a guest in practice;
       the moment sessions exist, the same check routes signed-in
       players back to the GLB builder. */
    function espilGuestNow(){
      try{ return !window.localStorage.getItem('espil_session_v1'); }catch(e){ return true; }
    }
    function buildPlayerAvatar(gender){
      /* Guest body (Han 2026-11-16): guests ride the Chibi pack
         dummy by default. espilGuestBodyMode() carries the revert
         switch: window.__ESPIL_GUEST_BODY__ = 'kaykit' restores the
         Han order 5 (2026-11-10) KayKit GLB placeholder exactly,
         'sprite' returns to the 2D sprite builder. Signed-in
         sessions keep the in-tree masters. */
      /* Body selection (Han 2026-11-16, fully open): the saved
         bodyChoice routes both populations - a guest renders their
         chosen chibi style (default style1); a signed-in user
         renders the master body unless they picked a chibi style
         at the gate, in which case they ride that style's template
         exactly as a guest does. The revert modes keep their
         single body and ignore the choice. The built avatar is
         stamped with its body key so espilApplyAvatarGender can
         tell a body change from a no-op. */
      var av=null;
      if(espilDesignatedBody()==='lunaris'){
        /* Owner-only designated body (Han 2026-11-17): the
           designated account builds Lunaris whatever its saved
           bodyChoice or the guest-body mode says - the
           designation is server-side truth, not a selection. */
        av=buildLunarisAvatar(gender);
      }else if(espilGuestNow()){
        var mode=espilGuestBodyMode();
        if(espilBodyChoice()==='neutral'){
          /* NAME-ONLY ENTRY (Han 2026-11-24): the neutral slot.
             INTERIM BINDING, stated plainly: the monk GLB does not
             exist yet (the asset line is producing it), so until
             it lands the slot renders through the chibi builder at
             ESPIL_NEUTRAL_INTERIM_STYLE - the design's own
             proportion family (its section 4.3 puts the monk in
             the chibi family) and today's guest default. This is
             NOT the monk body. When the asset lands, THIS branch
             swaps to the monk builder; the 'neutral' id, the join
             frame and the body key do not change. */
          av=buildChibiAvatar(gender,ESPIL_NEUTRAL_INTERIM_STYLE);
        }
        else if(mode==='chibi')av=buildChibiAvatar(gender,espilCbStyleNum(espilBodyChoice()));
        else if(mode==='kaykit')av=buildKaykitAvatar(gender);
        else av=buildSpriteAvatar(gender);
      }else{
        var bc=espilBodyChoice();
        if(bc!=='master'&&espilGuestBodyMode()==='chibi')av=buildChibiAvatar(gender,espilCbStyleNum(bc));
        else av=buildWalkerAvatar(gender);
      }
      av.__bodyKey=espilAvatarBodyKey(gender);
      return av;
    }
    /* ---- gate preview avatar service (Han 2026-11-17: the
       character must be VISIBLE in the customizer gate) ----
       The gate's live preview (modules/customizer.js,
       __espilCustPreview v1) builds its chibi and KayKit display
       bodies through here, so the chibi template cache and the
       KayKit loader stay shared with the game instead of being
       forked into a second copy. The builders stamp their
       local-player slot (ESPIL_CB_LOCAL / ESPIL_KK_LOCAL) as a
       side effect; the slot is saved and restored around the
       call - a preview build never takes the local player's
       place (the slots feed only the guest-body state hook, but
       the preview does not move state it does not own).
       'master' and 'lunaris' return null ON PURPOSE: the
       preview loads those two itself. buildWalkerAvatar starts
       the entry-descent clip loads whose completion flips
       window.__espilDescentClipsReady - a gate preview must not
       fire entry machinery - and the Lunaris player builder
       belongs to the designation build, which the preview does
       not depend on (it reads the session record's server mark
       and loads the serving GLB directly). */
    window.__espilBuildGateAvatar=function(gender,bodyKey){
      try{
        if(bodyKey==='kaykit'){
          var keepKk=ESPIL_KK_LOCAL;
          var kav=buildKaykitAvatar(gender);
          ESPIL_KK_LOCAL=keepKk;
          return kav;
        }
        var cbm=/^style([1-4])$/.exec(bodyKey||'');
        if(cbm){
          var keepCb=ESPIL_CB_LOCAL;
          var cav=buildChibiAvatar(gender,+cbm[1]);
          ESPIL_CB_LOCAL=keepCb;
          return cav;
        }
      }catch(e){}
      return null;
    }

    /* ---------------- Item C: the three gear trees ----------------
       The character tree above spends Knowledge. The gear trees
       spend USE: GROWTH RULE (chosen for this batch, stated) -
       the weapon tree's currency is kills landed with that weapon
       family equipped, and its Mastery ranks are ADDITIONALLY
       gated by Item B crafting tiers (rank r needs an owned
       weapon of the family crafted to tier r); the armour tree's
       currency is applied hits weathered; the shoes tree's is
       metres travelled. One node belongs to exactly one tree;
       effects stack across trees; unequipping deactivates a gear
       tree (bonuses read the CURRENTLY equipped family / nothing)
       but spent points are never lost. */
    var ESPIL_TREES_KEY='espil_trees_v1';
    var espilTreesCache=null, espilTreesDirty=false;
    function espilTrees(){
      if(espilTreesCache)return espilTreesCache;
      var t={prof:{weapon:{},armour:0,shoes:0},spent:{weapon:{},armour:0,shoes:0},alloc:{}};
      try{
        var raw=JSON.parse(window.localStorage.getItem(ESPIL_TREES_KEY)||'null');
        if(raw){
          if(raw.prof){ if(raw.prof.weapon)t.prof.weapon=raw.prof.weapon; if(typeof raw.prof.armour==='number')t.prof.armour=raw.prof.armour; if(typeof raw.prof.shoes==='number')t.prof.shoes=raw.prof.shoes; }
          if(raw.spent){ if(raw.spent.weapon)t.spent.weapon=raw.spent.weapon; if(typeof raw.spent.armour==='number')t.spent.armour=raw.spent.armour; if(typeof raw.spent.shoes==='number')t.spent.shoes=raw.spent.shoes; }
          if(raw.alloc)t.alloc=raw.alloc;
        }
      }catch(e){}
      espilTreesCache=t;
      return t;
    }
    function espilTreesSave(){ espilTreesDirty=false; try{ window.localStorage.setItem(ESPIL_TREES_KEY,JSON.stringify(espilTrees())); }catch(e){} }
    function espilTreesMark(){ espilTreesDirty=true; }
    setInterval(function(){ if(espilTreesDirty)espilTreesSave(); },2500);
    function espilTreeAlloc(id){ try{ return espilTrees().alloc[id]||0; }catch(e){ return 0; } }
    function espilFamilyEquipped(){
      try{
        var eq=JSON.parse(window.localStorage.getItem('espil_equipped')||'null');
        if(!eq||!eq.weapon)return null;
        if(window.__espilGearWindow&&window.__espilGearWindow.itemOf){
          var it=window.__espilGearWindow.itemOf(eq.weapon);
          if(it&&it.app&&it.app.shape)return it.app.shape;
        }
      }catch(e){}
      return null;
    }
    function espilTreeDmgMul(){
      try{
        var fam=espilFamilyEquipped(); if(!fam)return 1;
        return 1+.04*espilTreeAlloc(fam+'_edge')+.03*espilTreeAlloc(fam+'_master');
      }catch(e){ return 1; }
    }
    function espilTreeRangeBonus(m){
      try{
        if(!m||m.guard||m.proj)return 0;
        var fam=espilFamilyEquipped(); if(!fam)return 0;
        return .1*espilTreeAlloc(fam+'_master');
      }catch(e){ return 0; }
    }
    function espilTreeDefBonus(){ return 2*espilTreeAlloc('a_guard'); }
    function espilTreeOnKill(){
      var fam=espilFamilyEquipped(); if(!fam)return;
      var t=espilTrees(); t.prof.weapon[fam]=(t.prof.weapon[fam]||0)+1; espilTreesMark();
    }
    function espilTreeOnHurt(){ var t=espilTrees(); t.prof.armour=(t.prof.armour||0)+1; espilTreesMark(); }
    function espilTreeOnMove(d){ if(!(d>0))return; var t=espilTrees(); t.prof.shoes=(t.prof.shoes||0)+d; espilTreesMark(); }
    /* Weapon Art forms, one per family (Item C). */
    var ESPIL_ART_MOVES={
      sword:{name:'Crescent Slash',icon:'⚔️',art:'art',color:0xffd76e,css:'#ffd76e',dmg:22,range:4.8,cd:2.0,arc:2.6,y:1.05,desc:'A wide crescent cut of the blade.'},
      bow:{name:'Piercing Shot',icon:'🏹',art:'art',color:0x7dfce6,css:'#7dfce6',dmg:20,range:18,cd:2.2,arc:.8,y:1.25,proj:true,desc:'A shot that pierces down the facing line.'},
      staff:{name:'Quote Burst',icon:'✨',art:'art',color:0xc9a6ff,css:'#c9a6ff',dmg:24,range:6.3,cd:2.4,arc:6.3,y:1.1,desc:'A burst of quoted force in every direction.'},
      dagger:{name:'Flurry',icon:'🗡️',art:'art',color:0xbfe9ff,css:'#bfe9ff',dmg:18,range:3.6,cd:1.4,arc:1.8,y:1.0,desc:'A flurry of close cuts.'}
    };
    function espilArtMoveDef(){
      var fam=espilFamilyEquipped();
      if(fam&&ESPIL_ART_MOVES[fam])return ESPIL_ART_MOVES[fam];
      return {name:'Weapon Art',icon:'⚔️',art:'art',color:0xffd76e,css:'#ffd76e',dmg:6,range:3.6,cd:2.2,arc:2.2,y:1.05,desc:'Equip a weapon to give the art its form.'};
    }
    var ESPIL_FAM_NAME={sword:'Sword',staff:'Staff',bow:'Bow',dagger:'Dagger'};
    var ESPIL_WEAPON_NODES=function(fam){
      var fn=ESPIL_FAM_NAME[fam]||fam;
      return [
        {id:fam+'_edge',layer:'weapon',name:fn+' Edge',art:fam,max:10,desc:'+4% damage with '+fam+' weapons per rank.'},
        {id:fam+'_art',layer:'weapon',name:(ESPIL_ART_MOVES[fam]?ESPIL_ART_MOVES[fam].name:'Weapon Art'),art:'art',max:1,desc:'Unlock the '+fam+' weapon art (F key).'},
        {id:fam+'_master',layer:'weapon',name:fn+' Mastery',art:fam,max:5,desc:'+3% damage and +0.1 m range per rank. Rank r requires an owned '+fam+' weapon crafted to tier r.'}
      ];
    };
    var ESPIL_ARMOUR_NODES=[
      {id:'a_vital',layer:'armour',name:'Vitality',art:'vital',max:10,desc:'+8 max HP per rank.'},
      {id:'a_guard',layer:'armour',name:'Guard Plate',art:'shield',max:10,desc:'+2 Defense while guarding per rank.'},
      {id:'a_regen',layer:'armour',name:'Second Wind',art:'regen',max:5,desc:'Regenerate +0.4 HP per second per rank.'},
      {id:'a_ward',layer:'armour',name:'Mind Ward',art:'ward',max:5,desc:'+4 max MP per rank.'}
    ];
    var ESPIL_SHOES_NODES=[
      {id:'s_swift',layer:'shoes',name:'Swift Steps',art:'boot',max:10,desc:'+1.5% move speed per rank.'},
      {id:'s_stride',layer:'shoes',name:'Long Stride',art:'run',max:5,desc:'+3% run speed per rank.'},
      {id:'s_leap',layer:'shoes',name:'Spring Heel',art:'jump',max:10,desc:'+1.5% jump power per rank.'},
      {id:'s_dashcd',layer:'shoes',name:'Dash Cycle',art:'dash',max:5,desc:'Dash Strike cooldown -6% per rank.'}
    ];
    function espilTreeNodeDef(id){
      var i,f,ns;
      for(i=0;i<ESPIL_ARMOUR_NODES.length;i++)if(ESPIL_ARMOUR_NODES[i].id===id)return ESPIL_ARMOUR_NODES[i];
      for(i=0;i<ESPIL_SHOES_NODES.length;i++)if(ESPIL_SHOES_NODES[i].id===id)return ESPIL_SHOES_NODES[i];
      var fams=['sword','staff','bow','dagger'];
      for(f=0;f<fams.length;f++){ ns=ESPIL_WEAPON_NODES(fams[f]); for(i=0;i<ns.length;i++)if(ns[i].id===id)return ns[i]; }
      return null;
    }
    function espilTreeCost(rank){ return 1+Math.floor(rank/3); }
    function espilTreeAvail(layer,fam){
      var t=espilTrees();
      if(layer==='weapon')return (t.prof.weapon[fam]||0)-(t.spent.weapon[fam]||0);
      if(layer==='armour')return (t.prof.armour||0)-(t.spent.armour||0);
      if(layer==='shoes')return Math.floor(t.prof.shoes||0)-(t.spent.shoes||0);
      return 0;
    }
    function espilMasteryMet(fam,nextRank){
      try{
        if(!window.__espilGear||!window.__espilGearWindow||!window.__espilCraftTier)return false;
        var owned=window.__espilGear.owned();
        for(var i=0;i<owned.length;i++){
          var it=window.__espilGearWindow.itemOf(owned[i].name);
          if(it&&it.slot==='weapon'&&it.app&&it.app.shape===fam&&window.__espilCraftTier(owned[i].name)>=nextRank)return true;
        }
      }catch(e){}
      return false;
    }
    function raiseTreeNode(id){
      var n=espilTreeNodeDef(id); if(!n)return {ok:false,why:'unknown'};
      var t=espilTrees(), rank=t.alloc[id]||0;
      if(rank>=n.max)return {ok:false,why:'maxed'};
      var fam=(n.layer==='weapon')?id.split('_')[0]:null;
      var avail=espilTreeAvail(n.layer,fam), cost=espilTreeCost(rank);
      if(avail<cost)return {ok:false,why:'currency',avail:avail,cost:cost};
      if(fam&&id===fam+'_master'&&!espilMasteryMet(fam,rank+1))return {ok:false,why:'craft-tier',need:rank+1};
      t.alloc[id]=rank+1;
      if(n.layer==='weapon')t.spent.weapon[fam]=(t.spent.weapon[fam]||0)+cost;
      else if(n.layer==='armour')t.spent.armour=(t.spent.armour||0)+cost;
      else t.spent.shoes=(t.spent.shoes||0)+cost;
      espilTreesSave();
      if(id==='a_vital'){ skillState.maxhp=100+8*(t.alloc.a_vital||0); saveSkills(); paintStatus(); }
      if(id==='a_ward'){ skillState.maxmp=50+4*(t.alloc.a_ward||0); saveSkills(); paintStatus(); }
      if(skillTreeOpen)renderSkillTree();
      return {ok:true,rank:rank+1};
    }
    (function espilTreesInit(){
      var t=espilTrees();
      skillState.maxhp=100+8*(t.alloc.a_vital||0);
      skillState.maxmp=50+4*(t.alloc.a_ward||0);
      if(skillState.hp>skillState.maxhp)skillState.hp=skillState.maxhp;
      if(skillState.mp>skillState.maxmp)skillState.mp=skillState.maxmp;
    })();
    window.__espilTrees={raise:raiseTreeNode,state:function(){
      var t=espilTrees(), fam=espilFamilyEquipped();
      return { layer:espilTreeLayer, prof:t.prof, spent:t.spent, alloc:t.alloc,
        avail:{ weapon:fam?espilTreeAvail('weapon',fam):0, armour:espilTreeAvail('armour'), shoes:espilTreeAvail('shoes') },
        family:fam, dmgMul:espilTreeDmgMul(), defBonus:espilTreeDefBonus(),
        maxhp:skillState.maxhp, maxmp:skillState.maxmp };
    }};
    /* ---- skill range mesh (FEEL spec): a ground disc whose
       gradient texture runs from 50% opacity at the centre to
       clear at the rim, stamped by the Batch 6 skills via fxPool. */
    var espilRangeTex=null;
    function espilRangeGradientTex(){
      if(espilRangeTex)return espilRangeTex;
      var cv=document.createElement('canvas'); cv.width=cv.height=128;
      var g=cv.getContext('2d');
      var gr=g.createRadialGradient(64,64,4,64,64,64);
      gr.addColorStop(0,'rgba(255,255,255,0.5)');
      gr.addColorStop(0.5,'rgba(255,255,255,0.25)');
      gr.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=gr; g.fillRect(0,0,128,128);
      espilRangeTex=new THREE.CanvasTexture(cv);
      return espilRangeTex;
    }
    function spawnRangeMesh(st){
      if(!walkPlayer||!mapScene)return;
      var geo=new THREE.CircleGeometry(1,40);
      var mat=new THREE.MeshBasicMaterial({color:st.m.color,transparent:true,opacity:.5,map:espilRangeGradientTex(),depthWrite:false,side:THREE.DoubleSide});
      var mesh=new THREE.Mesh(geo,mat);
      mesh.rotation.x=-Math.PI/2;
      var grp=new THREE.Group();
      grp.add(mesh);
      grp.position.set(walkPlayer.pos.x,.07,walkPlayer.pos.z);
      mapScene.add(grp);
      fxPool.push({grp:grp,mat:mat,geo:geo,t:0,life:.4,s0:st.range*.35,s1:st.range,o0:.5});
    }
    /* ---- four-layer tree UI. The character layer is the Keeper
       tree; the gear layers render here with the Asset spec's ring
       shapes (weapon hexagon, armour shield-square, shoes
       triangle; character keeps the circle of the base CSS).
       SKILL ICON STATUS: the Asset room delivered the icon SPEC
       (SKILL-ICON-SPEC-v1, files icon_<tree>_<skill>.png) but no
       icon files exist yet - nodes therefore carry the layer ring
       shape + the runtime pixel glyph + a text label as UI chrome,
       and the delivered icon set remains PENDING Asset delivery. */
    var espilTreeLayer='character';
    function espilEnsureTreeTabs(){
      var panel=document.getElementById('skill-tree'), tv=document.getElementById('st-treeview');
      if(!panel||!tv||!tv.parentNode)return;
      if(!document.getElementById('espil-trees-style')){
        var st=document.createElement('style'); st.id='espil-trees-style';
        st.textContent=
          '#espil-tree-tabs{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}'+
          '#espil-tree-tabs button{flex:1 1 auto;min-width:100px;padding:7px 8px;border-radius:9px;border:1px solid rgba(169,126,70,.6);background:rgba(28,22,14,.72);color:#e8dcc0;font:800 11.5px Manrope,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}'+
          '#espil-tree-tabs button.on{background:rgba(122,84,32,.85);color:#ffe9ad;border-color:#d8a94e}'+
          '#espil-tree-tabs .rg{width:14px;height:14px;flex:0 0 auto;background:#d8a94e;display:inline-block}'+
          '.rg-circle{border-radius:50%}'+
          '.rg-hex{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}'+
          '.rg-shield{clip-path:polygon(0 0,100% 0,100% 68%,50% 100%,0 68%)}'+
          '.rg-tri{clip-path:polygon(50% 100%,0 0,100% 0)}'+
          '.tnode-icon.ring-hex{border-radius:6px;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}'+
          '.tnode-icon.ring-shield{border-radius:4px;clip-path:polygon(0 0,100% 0,100% 68%,50% 100%,0 68%)}'+
          '.tnode-icon.ring-tri{border-radius:0;clip-path:polygon(50% 100%,0 0,100% 0)}'+
          '.espil-tree-note{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:78%;text-align:center;color:#e8dcc0;font:600 13px/1.5 Manrope,sans-serif;text-shadow:0 1px 3px #000}';
        document.head.appendChild(st);
      }
      var bar=document.getElementById('espil-tree-tabs');
      if(!bar){
        bar=document.createElement('div');
        bar.id='espil-tree-tabs';
        var defs=[['character','Character','rg-circle'],['weapon','Weapon','rg-hex'],['armour','Armour','rg-shield'],['shoes','Shoes','rg-tri']];
        defs.forEach(function(df){
          var b=document.createElement('button');
          b.type='button'; b.setAttribute('data-treelayer',df[0]);
          b.innerHTML='<span class="rg '+df[2]+'"></span>'+df[1];
          b.addEventListener('click',function(){
            espilTreeLayer=df[0];
            if(espilTreeLayer==='character')selectedSkillId='keeper';
            renderSkillTree();
          });
          bar.appendChild(b);
        });
        tv.parentNode.insertBefore(bar,tv);
      }
      var btns=bar.querySelectorAll('[data-treelayer]');
      for(var i=0;i<btns.length;i++)btns[i].classList.toggle('on',btns[i].getAttribute('data-treelayer')===espilTreeLayer);
    }
    function espilLayerNodes(){
      if(espilTreeLayer==='weapon'){
        var fam=espilFamilyEquipped();
        return fam?ESPIL_WEAPON_NODES(fam):[];
      }
      if(espilTreeLayer==='armour')return ESPIL_ARMOUR_NODES;
      if(espilTreeLayer==='shoes')return ESPIL_SHOES_NODES;
      return [];
    }
    function espilLayerCurrencyLine(){
      var t=espilTrees();
      if(espilTreeLayer==='weapon'){
        var fam=espilFamilyEquipped();
        if(!fam)return 'No weapon equipped.';
        return 'Kills with '+(ESPIL_FAM_NAME[fam]||fam)+' weapons: '+(t.prof.weapon[fam]||0)+' · unspent '+espilTreeAvail('weapon',fam);
      }
      if(espilTreeLayer==='armour')return 'Hits weathered: '+(t.prof.armour||0)+' · unspent '+espilTreeAvail('armour');
      if(espilTreeLayer==='shoes')return 'Metres travelled: '+Math.floor(t.prof.shoes||0)+' · unspent '+espilTreeAvail('shoes');
      return '';
    }
    function renderLayerTree(){
      var tv=document.getElementById('st-treeview');
      if(tv){
        tv.innerHTML='';
        var fam=espilTreeLayer==='weapon'?espilFamilyEquipped():null;
        var nodes=espilLayerNodes();
        var ringCls=espilTreeLayer==='weapon'?'ring-hex':(espilTreeLayer==='armour'?'ring-shield':'ring-tri');
        if(espilTreeLayer==='weapon'&&!fam){
          var note=document.createElement('div');
          note.className='espil-tree-note';
          note.textContent='Equip a weapon to open its tree. Each weapon family (sword, staff, bow, dagger) grows its own tree - swapping weapons swaps the active tree, and no points are ever lost.';
          tv.appendChild(note);
        }
        var root=document.createElement('div');
        root.className='tnode tnode-root';
        root.style.left='50%'; root.style.top='88%';
        var rootName=espilTreeLayer==='weapon'?(fam?((ESPIL_FAM_NAME[fam]||fam).toUpperCase()+' TREE'):'WEAPON TREE'):(espilTreeLayer==='armour'?'ARMOUR TREE':'SHOES TREE');
        var rootGlyph=espilTreeLayer==='weapon'?'⚔️':(espilTreeLayer==='armour'?'🛡️':'👢');
        root.innerHTML='<span class="tnode-icon '+ringCls+'" style="font-size:1.3rem">'+rootGlyph+'</span><span class="tnode-name">'+rootName+'</span>';
        tv.appendChild(root);
        var xs=nodes.length===3?[25,50,75]:(nodes.length===4?[16,38,62,84]:[50]);
        nodes.forEach(function(n,ix){
          var rank=espilTreeAlloc(n.id), maxed=rank>=n.max;
          var cost=espilTreeCost(rank);
          var avail=espilTreeAvail(n.layer,fam);
          var okk=!maxed&&avail>=cost;
          if(fam&&n.id===fam+'_master'&&!espilMasteryMet(fam,rank+1))okk=false;
          var d=document.createElement('div');
          d.className='tnode'+(maxed?' is-maxed':'')+(!okk&&!maxed?' is-dim':'')+(selectedSkillId===n.id?' is-selected':'');
          d.style.left=xs[ix]+'%'; d.style.top='46%';
          d.setAttribute('role','button');
          var icon=pxIcon(n.art||n.id);
          var inner='<span class="tnode-icon '+ringCls+'">'+(icon?'<img alt="" src="'+icon+'">':'')+'</span>'+
            '<span class="tnode-name">'+n.name+'</span>'+
            '<span class="tnode-lv'+(maxed?' is-max':'')+'">'+(maxed?'MASTER':'Lv '+rank+'/'+n.max)+'</span>';
          if(!maxed&&okk)inner+='<button type="button" class="tnode-plus" aria-label="Raise '+n.name+'">+</button>';
          d.innerHTML=inner;
          d.addEventListener('click',function(e){
            var tg=e&&e.target;
            var isPlus=tg&&(tg.className==='tnode-plus'||(tg.classList&&typeof tg.classList.contains==='function'&&tg.classList.contains('tnode-plus')));
            if(isPlus){
              var r=raiseTreeNode(n.id);
              if(!r.ok&&window.__espilToast){
                window.__espilToast(r.why==='craft-tier'?('Craft a '+(ESPIL_FAM_NAME[fam]||fam)+' weapon to tier '+r.need+' first.')
                  :r.why==='currency'?('Not enough '+(espilTreeLayer==='weapon'?'kills with this family':espilTreeLayer==='armour'?'hits weathered':'metres travelled')+'.')
                  :'Cannot raise this node yet.');
              }
              renderSkillTree();
              return;
            }
            selectedSkillId=n.id;
            renderSkillTree();
          });
          tv.appendChild(d);
        });
      }
      renderLayerDesc();
    }
    function renderLayerDesc(){
      var d=document.getElementById('st-desc');
      if(!d)return;
      var n=selectedSkillId?espilTreeNodeDef(selectedSkillId):null;
      if(!n||n.layer!==espilTreeLayer){
        var titles={weapon:'The Weapon Tree',armour:'The Armour Tree',shoes:'The Shoes Tree'};
        var bodies={
          weapon:'One tree per weapon family. Only the equipped weapon\'s tree is active; swapping weapons swaps the tree. Kills with the family earn its points, and crafted tiers deepen Mastery.',
          armour:'Defence and survival, grown by weathering hits. Its bonuses stack with every other tree and stay yours even with nothing equipped.',
          shoes:'Movement, grown by travelling. Speed, stride, leap and dash cycling - earned on foot, kept forever.'};
        d.innerHTML='<h3>'+(titles[espilTreeLayer]||'Tree')+'</h3><p>'+(bodies[espilTreeLayer]||'')+'</p><p class="cur">'+espilLayerCurrencyLine()+'</p>';
        return;
      }
      var rank=espilTreeAlloc(n.id), maxed=rank>=n.max;
      var fam=n.layer==='weapon'?n.id.split('_')[0]:null;
      var costLine=maxed?'<p class="cost">MAX LEVEL</p>'
        :'<p class="cost">Cost: '+espilTreeCost(rank)+' · '+espilLayerCurrencyLine()+'</p>';
      var extra='';
      if(fam&&n.id===fam+'_master')extra='<p class="cur">Crafted-tier gate: '+(espilMasteryMet(fam,rank+1)?'met for the next rank':'needs a '+(ESPIL_FAM_NAME[fam]||fam)+' weapon at tier '+(rank+1))+'</p>';
      d.innerHTML='<h3>'+n.name+'</h3><p>'+n.desc+'</p><p class="cur">Current Lv '+rank+' / '+n.max+'</p>'+extra+costLine;
    }
    /* Locked ASDF slots read as locked until their skill is learned. */
    setInterval(function(){
      try{
        var fam=espilFamilyEquipped();
        var locks={a:!(skillState.alloc.m_dash>0),s:!(skillState.alloc.m_spin>0),d:!(skillState.alloc.m_wave>0),
                   f:!(fam&&espilTreeAlloc(fam+'_art')>0)};
        for(var k in locks){ var b=document.getElementById('slot-'+k); if(b)b.classList.toggle('is-locked',!!locks[k]); }
      }catch(e){}
    },800);

    /* ---------------- Item D: the 2D sprite avatar ----------------
       Guests render as billboard sprites from the delivered motion
       sets, copied into assets/char2d/ with uniform fNN.webp names
       (source: the Zealandia customizer-v3 production tree).
       COVERAGE of the delivered sets:
       - FEMALE (textured 'under' look - the only textured look
         delivered): idle / walk in front+back+side; run, jump, hit,
         dead in front+back; attack front only. Side run/jump/hit/
         dead and back/side attack fall back to the front set of
         the same state.
       - MALE: walk front+back+side (walk sets); idle front+back+
         side (the production idle sets, side is the 45-degree set);
         attack per family front+back+side for sword / staff / bow;
         a generic attack front (unarmed and dagger fallback); hit
         front (the guard set; back/side fall back to it). Male run
         reuses the walk set at a faster rate, male jump the walk
         set; male death has NO delivered set - the body fades and
         sinks in place (the monsters' own fallback language).
       LOOK PARAMETERISATION: the delivered motion sets carry ONE
       look per gender. The saved customizer look therefore selects
       the GENDER only; skin tone / hair / eyes variants are not
       parameterised in the delivered sets (the EP-parts profile
       preview in panels remains the look-faithful surface). Side
       facing follows the customizer app's own convention (side
       art authored facing left; the mirrored side flips it). */
    var ESPIL_AV2_BASE='assets/char2d/';
    var ESPIL_AV2_SETS={
      female:{
        idle:{front:{d:'idle_front',n:22,f:6},back:{d:'idle_back',n:24,f:6},side:{d:'idle_side',n:28,f:6}},
        walk:{front:{d:'walk_front',n:24,f:10},back:{d:'walk_back',n:32,f:10},side:{d:'walk_side',n:8,f:12}},
        run:{front:{d:'run_front',n:28,f:13},back:{d:'run_back',n:20,f:13},side:{d:'run_front',n:28,f:13}},
        jump:{front:{d:'jump_front',n:16,f:12},back:{d:'jump_back',n:8,f:12},side:{d:'jump_front',n:16,f:12}},
        hit:{front:{d:'hit_front',n:8,f:12},back:{d:'hit_back',n:8,f:12},side:{d:'hit_front',n:8,f:12}},
        dead:{front:{d:'dead_front',n:7,f:6},back:{d:'dead_back',n:8,f:6},side:{d:'dead_front',n:7,f:6}},
        attack:{front:{d:'attack_front',n:13,f:14},back:{d:'attack_front',n:13,f:14},side:{d:'attack_front',n:13,f:14}}
      },
      male:{
        idle:{front:{d:'idle_front',n:28,f:6},back:{d:'idle_back',n:28,f:6},side:{d:'idle_side',n:24,f:6}},
        walk:{front:{d:'walk_front',n:28,f:10},back:{d:'walk_back',n:28,f:10},side:{d:'walk_side',n:28,f:10}},
        run:{front:{d:'walk_front',n:28,f:16},back:{d:'walk_back',n:28,f:16},side:{d:'walk_side',n:28,f:16}},
        jump:{front:{d:'walk_front',n:28,f:12},back:{d:'walk_back',n:28,f:12},side:{d:'walk_side',n:28,f:12}},
        hit:{front:{d:'hit_front',n:15,f:12},back:{d:'hit_front',n:15,f:12},side:{d:'hit_front',n:15,f:12}},
        attackFam:{
          sword:{front:{d:'attack_sword_front',n:20,f:14},back:{d:'attack_sword_back',n:14,f:14},side:{d:'attack_sword_side',n:20,f:14}},
          staff:{front:{d:'attack_staff_front',n:30,f:14},back:{d:'attack_staff_back',n:34,f:14},side:{d:'attack_staff_side',n:38,f:14}},
          bow:{front:{d:'attack_bow_front',n:48,f:12},back:{d:'attack_bow_back',n:48,f:12},side:{d:'attack_bow_side',n:48,f:12}}
        },
        attackGeneric:{front:{d:'attack_front',n:15,f:14},back:{d:'attack_front',n:15,f:14},side:{d:'attack_front',n:15,f:14}}
      }
    };
    var ESPIL_AV2_PLANE=1.97, ESPIL_AV2_CY=0.95;
    var espilAv2TexCache={};
    function espilAv2Textures(gender,setDir,n){
      var key=gender+'/'+setDir;
      var hit=espilAv2TexCache[key];
      if(hit)return hit;
      var arr=[], loader=new THREE.TextureLoader();
      for(var i=0;i<n;i++){
        var t=loader.load(ESPIL_AV2_BASE+gender+'/'+setDir+'/f'+(i<10?'0':'')+i+'.webp');
        try{ t.colorSpace=THREE.SRGBColorSpace; }catch(e){}
        arr.push(t);
      }
      espilAv2TexCache[key]=arr;
      return arr;
    }
    function espilAv2Resolve(gender,state,dir,fam){
      var G=ESPIL_AV2_SETS[gender]; if(!G)return null;
      if(state==='attack'&&gender==='male'){
        if(fam&&G.attackFam[fam])return G.attackFam[fam][dir]||G.attackFam[fam].front;
        return G.attackGeneric[dir]||G.attackGeneric.front;
      }
      var S=G[state];
      if(!S)return null;
      return S[dir]||S.front||null;
    }
    var ESPIL_SPRITES=[];
    function espilMakeSprite(gender){
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      var body=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false}));
      body.scale.set(ESPIL_AV2_PLANE,ESPIL_AV2_PLANE,1);
      body.position.y=ESPIL_AV2_CY;
      g.add(body);
      var weapon=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false}));
      weapon.scale.set(1.9,1.9,1);
      weapon.position.y=0.99;
      weapon.visible=false;
      g.add(weapon);
      return {group:g,shadow:shadow,body:body,weapon:weapon,gender:gender,
        state:'idle',dir:'front',flip:false,setKey:'',frames:null,setFps:8,frameT:0,frameIdx:-1,
        oneShot:null,dead:false,loco:'idle',weaponEp:null,weaponTex:null,fadeT:0};
    }
    function buildSpriteAvatar(gender){
      gender=(gender==='female')?'female':'male';
      var spr=espilMakeSprite(gender);
      var av={group:spr.group,shadow:spr.shadow,ready:true,mixer:null,actions:{},curAnim:null,__gender:gender,__sprite:true,__spr:spr};
      av.playAnim=function(name){
        var map={idle:'idle',walk:'walk',run:'run',swim:'walk',swimIdle:'idle',climb:'walk',stop:'idle',chat:'idle',checkout:'idle'};
        spr.loco=map[name]||'idle';
        av.curAnim=name;
      };
      av.playOneShot=function(name,durMs){
        if(name==='attack'){ spr.oneShot={state:'attack',t:0,dur:durMs?durMs/1000:2.5,byFrames:true}; av.curAnim='attack'; return true; }
        if(name==='hit'){ spr.oneShot={state:'hit',t:0,dur:durMs?durMs/1000:1.2,byFrames:true}; av.curAnim='hit'; return true; }
        return false;
      };
      av.playJump=function(isDouble){
        spr.oneShot={state:'jump',t:0,dur:isDouble?1.15:0.69,byFrames:false};
        av.curAnim=isDouble?'doubleJump':'jump';
        return true;
      };
      av.__espilSetState=function(s){
        if(s==='dead'){ spr.dead=true; spr.oneShot=null; spr.fadeT=0; }
        else{ spr.dead=false; spr.fadeT=0; if(spr.state==='dead')spr.state='idle'; }
      };
      ESPIL_SPRITES.push({spr:spr,local:true,R:null});
      return av;
    }
    function __espilBuildSpriteRemote(gender){
      gender=(gender==='female')?'female':'male';
      var spr=espilMakeSprite(gender);
      var R={group:spr.group,shadow:spr.shadow,mixer:{update:function(){}},actions:{},curAnim:null,ready:true,visual:null,baseY:0,
             cur:{x:0,y:0,z:0},tgt:{x:0,y:0,z:0,a:0},faceY:0,speed:0,fixSpeed:0,fixAt:0,lastAt:0,plate:null,
             phase:(__espilPhaseSeq++)%7,acc:0,gone:false,bubble:null,bubbleCv:null,bubbleTex:null,bubbleUntil:0,__sprite:true,__spr:spr};
      R.playAnim=function(name){
        spr.loco=(name==='run')?'run':(name==='walk')?'walk':'idle';
        R.curAnim=name;
      };
      ESPIL_SPRITES.push({spr:spr,local:false,R:R});
      return R;
    }
    /* ================================================================
       Han order 5 (2026-11-10) - KayKit GLB PLACEHOLDER for the
       guest (sprite-path) player avatars.
       The 2D guest sprites read too crude on Han's screen, so the
       guest's own avatar and remote guest avatars render a KayKit
       Adventurers character (Rogue, CC0 - licence file ships beside
       the model in assets/kaykit-placeholder/) as a stopgap while
       the 2D line is finished properly. This is NOT the final GLB
       source decision (glb-return plan, Track 1) and NOT the 2D
       handover: the sprite builders above stay in the tree dormant.
       REVERT: set ESPIL_KAYKIT_PLACEHOLDER to false (or set
       window.__ESPIL_KAYKIT_PLACEHOLDER__ = false before this file
       loads) and every guest goes back to buildSpriteAvatar /
       __espilBuildSpriteRemote with no other change.
       Signed-in sessions are untouched: buildWalkerAvatar and the
       in-tree masters keep their exact branch above.
       One placeholder character serves both guest genders - the
       set has no distinctly female character (Phase 0 note); the
       guest's stored gender/name and the landing flow are unchanged.
       The character's baked hand props (knives, crossbows) are
       hidden at setup so the punch reads as the game's own punch,
       at parity with the in-tree masters (which show no hand
       weapon either).
       ================================================================ */
    var ESPIL_KAYKIT_PLACEHOLDER=true;
    var ESPIL_KK_FILE='assets/kaykit-placeholder/rogue.glb';
    var ESPIL_KK_TARGET_H=1.7; /* the game's player height; the masters stand 1.8 */
    function espilKaykitPlaceholderOn(){
      if(window.__ESPIL_KAYKIT_PLACEHOLDER__===false)return false;
      if(window.__ESPIL_KAYKIT_PLACEHOLDER__===true)return true;
      return ESPIL_KAYKIT_PLACEHOLDER;
    }
    var ESPIL_KK_LOCAL=null,ESPIL_KK_REMOTES_BUILT=0;
    window.__espilKaykitPlaceholderState=function(){
      var L=ESPIL_KK_LOCAL;
      return {on:espilKaykitPlaceholderOn(),file:ESPIL_KK_FILE,targetH:ESPIL_KK_TARGET_H,
        local:L?{ready:!!L.ready,anim:L.curAnim||null,acts:Object.keys(L.actions||{}),dead:!!L.__kkDead}:null,
        remotesBuilt:ESPIL_KK_REMOTES_BUILT};
    };
    /* Game action name -> KayKit embedded clip name. The essentials
       Han's acceptance names (idle, walk, run, punch, hit, death)
       plus the jump pair and the store-interaction one-shot. No
       swim/climb clips exist in the set: those actions stay
       unregistered and the existing fallbacks (locomotion selector
       swim fallback, climb guard) cover them, exactly as the
       sprite path mapped them onto its own sets. */
    var ESPIL_KK_CLIPS={idle:'Idle',walk:'Walking_A',run:'Running_A',
      attack:'Unarmed_Melee_Attack_Punch_A',hit:'Hit_A',dead:'Death_A',
      jump:'Jump_Full_Short',doubleJump:'Jump_Full_Long',
      chat:'Interact',checkout:'Interact'};
    var ESPIL_KK_ONESHOT={attack:1,hit:1,dead:1,jump:1,doubleJump:1,chat:1,checkout:1};
    /* The clips are in-place; only the ground root bone's position
       track is stripped (the same root-motion discipline as
       buildWalkerAvatar's stripRootMotion), so game physics alone
       drives placement. Bone-local translations stay - the Blender
       rig's pose lives in them. */
    function espilKkStripRoot(clip){
      clip.tracks=clip.tracks.filter(function(t){
        return !/^root\.position$/i.test(t.name||'');
      });
      return clip;
    }
    /* Hide the baked hand props: every mesh hanging under the two
       handslot bones. The body meshes live under the character's
       own part nodes, never under the handslots. */
    function espilKkHideProps(model){
      model.traverse(function(o){
        if(/^handslot\.?[lr]$/i.test(o.name||'')){ /* the GLTF loader strips the dot: 'handslotl' / 'handslotr' in-page */
          o.traverse(function(c){ if(c!==o&&c.isMesh)c.visible=false; });
        }
      });
    }
    function espilKkSetup(av,model,clips){
      espilKkHideProps(model);
      /* FIX-7 item 3 (Han 2026-11-12, measured on the rig): the
         Rogue GLB is authored facing +z, but the avatar facing law
         (group rotation.y = faceY) expects the model's front on
         its local -z - so the guest ran VISUALLY BACKWARD (rig
         bone measurement: ankle->toe direction vs code forward,
         dot = -0.97). buildWalkerAvatar has always carried the
         same PI counter-rotation for the masters' +z bodies; the
         placeholder setup missed it. Rotate the model, never the
         group: physics, plates and shadows stay put. */
      model.rotation.y=Math.PI;
      model.traverse(function(o){ if(o.isMesh)o.castShadow=true; });
      /* Measure in the bind pose, scale to the player height, then
         ground the feet exactly (Box3 discipline copied from
         buildWalkerAvatar). */
      var bbox=new THREE.Box3().setFromObject(model);
      var h=Math.max(.01,bbox.max.y-bbox.min.y);
      var s=ESPIL_KK_TARGET_H/h;
      model.scale.setScalar(s);
      bbox=new THREE.Box3().setFromObject(model);
      model.position.y-=bbox.min.y;
      av.__visualRoot=model;
      model.userData.__avBaseScale=s;
      model.userData.__avBaseY=model.position.y;
      av.group.add(model);
      var mixer=new THREE.AnimationMixer(model);
      av.mixer=mixer;
      function findClip(name){ for(var i=0;i<clips.length;i++){ if(clips[i].name===name)return clips[i]; } return null; }
      for(var key in ESPIL_KK_CLIPS){
        var clip=findClip(ESPIL_KK_CLIPS[key]);
        if(!clip)continue;
        var act=mixer.clipAction(espilKkStripRoot(clip));
        if(ESPIL_KK_ONESHOT[key]){ act.setLoop(THREE.LoopOnce); act.clampWhenFinished=true; }
        av.actions[key]=act;
      }
      espilStrideRegister(av,model,'walk'); /* FOOT-SLIDE SYNC: KayKit locomotion strides (local + remote share this setup) */
      espilStrideRegister(av,model,'run');
      try{ mixer.update(0); }catch(_){}
      av.ready=true;
      av.playAnim('idle');
    }
    /* Crossfade locomotion player, mirroring buildWalkerAvatar's
       playAnim. Two placeholder guards: while dead, locomotion
       calls are ignored (the death pose holds until revive); while
       a hit one-shot is on stage, locomotion calls are ignored -
       'hit' is not in the walk tick selector's protected list, so
       without the hold the selector would stomp the hit clip the
       same frame it starts. */
    function espilKkPlayAnim(av,name){
      if(av.__kkDead)return;
      if(av.__kkHold&&name!==av.__kkHold)return;
      if(!av.mixer||!av.actions[name]||av.curAnim===name)return;
      var prev=av.actions[av.curAnim],next=av.actions[name];
      av.curAnim=name;
      next.reset().fadeIn(.18).play();
      next.__espilGen=(next.__espilGen||0)+1;
      if(prev&&prev!==next){ prev.fadeOut(.18); (function(pp,gg){ setTimeout(function(){ if(pp.__espilGen===gg)pp.stop(); },220); })(prev,prev.__espilGen||0); }
    }
    /* One-shot player, mirroring buildWalkerAvatar's playOneShot
       (generation guard included). Death routes to __espilSetState:
       its pose must hold past the clip instead of timing out back
       to locomotion. */
    function espilKkPlayOneShot(av,name,durMs){
      if(name==='dead'){ av.__espilSetState('dead'); return true; }
      if(av.__kkDead)return false;
      if(!av.mixer||!av.actions[name])return false;
      var act=av.actions[name];
      var cur=av.actions[av.curAnim];
      av.curAnim=name;
      act.__espilGen=(act.__espilGen||0)+1;
      var actGen=act.__espilGen;
      act.reset().fadeIn(.12).play();
      if(cur&&cur!==act){ cur.fadeOut(.12); (function(pp,gg){ setTimeout(function(){ if(pp.__espilGen===gg)pp.stop(); },180); })(cur,cur.__espilGen||0); }
      if(name==='hit')av.__kkHold='hit';
      var dur=durMs||((act.getClip().duration||1)*1000);
      setTimeout(function(){
        if(av.__kkHold===name)av.__kkHold=null;
        if(av.curAnim!==name)return;
        act.fadeOut(.15);
        setTimeout(function(){ if(act.__espilGen===actGen)act.stop(); },180);
        av.curAnim=null;
      },dur);
      return true;
    }
    function espilKkSetState(av,s){
      if(s==='dead'){
        av.__kkDead=true; av.__kkHold=null;
        var act=av.actions.dead;
        if(act&&av.mixer){
          var cur=av.actions[av.curAnim];
          av.curAnim='dead';
          act.__espilGen=(act.__espilGen||0)+1;
          act.reset().fadeIn(.12).play();
          if(cur&&cur!==act)cur.fadeOut(.12);
        }
      }else{
        av.__kkDead=false;
        if(av.curAnim==='dead'){
          var d=av.actions.dead;
          if(d)d.fadeOut(.15);
          av.curAnim=null;
        }
        espilKkPlayAnim(av,'idle');
      }
    }
    function espilKkPlayJump(av,isDouble){
      var name=isDouble?'doubleJump':'jump';
      var act=av.actions[name];
      if(!act)return espilKkPlayOneShot(av,name);
      var dur=act.getClip().duration||1;
      var air=isDouble?1.15:(2*9/26); /* same airtime model as buildWalkerAvatar's playJump */
      act.timeScale=Math.min(6,Math.max(1,dur/air));
      return espilKkPlayOneShot(av,name,Math.round(dur/act.timeScale*1000));
    }
    function espilKkLoad(av,onfail){
      try{
        if(typeof THREE.GLTFLoader==='undefined')throw new Error('no GLTFLoader');
        new THREE.GLTFLoader().load(ESPIL_KK_FILE,function(gltf){
          if(av.__kkGone)return;
          try{ espilKkSetup(av,gltf.scene,gltf.animations||[]); }
          catch(e){ if(onfail)onfail(); }
        },undefined,function(){ if(onfail)onfail(); });
      }catch(e){ if(onfail)onfail(); }
    }
    function buildKaykitAvatar(gender){
      gender=(gender==='female')?'female':'male';
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      var av={group:g,shadow:shadow,ready:false,mixer:null,actions:{},curAnim:null,__gender:gender,__kaykit:true};
      av.playAnim=function(name){ espilKkPlayAnim(av,name); };
      av.playOneShot=function(name,durMs){ return espilKkPlayOneShot(av,name,durMs); };
      av.playJump=function(isDouble){ return espilKkPlayJump(av,isDouble); };
      av.__espilSetState=function(s){ espilKkSetState(av,s); };
      ESPIL_KK_LOCAL=av;
      espilKkLoad(av,function(){ if(window.__espilToast)window.__espilToast('Character failed to load'); });
      return av;
    }
    function __espilBuildKaykitRemote(gender){
      gender=(gender==='female')?'female':'male';
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      /* Same field contract as the GLB remote: the remote tick
         drives playAnim + mixer.update with its tiered stride.
         visual stays null on purpose - the tick would force the
         masters' 1.5 scale onto R.visual; the placeholder model
         carries its own measured scale from espilKkSetup. */
      var R={group:g,shadow:shadow,mixer:null,actions:{},curAnim:null,ready:false,visual:null,baseY:0,
             cur:{x:0,y:0,z:0},tgt:{x:0,y:0,z:0,a:0},faceY:0,speed:0,fixSpeed:0,fixAt:0,lastAt:0,plate:null,
             phase:(__espilPhaseSeq++)%7,acc:0,gone:false,bubble:null,bubbleCv:null,bubbleTex:null,bubbleUntil:0,
             __kaykit:true,__gender:gender};
      Object.defineProperty(R,'__kkGone',{get:function(){ return R.gone; }});
      R.playAnim=function(name){ espilKkPlayAnim(R,name); };
      ESPIL_KK_REMOTES_BUILT++;
      espilKkLoad(R,null);
      return R;
    }
    /* ================================================================
       Han order (2026-11-16) - the guest dummy becomes Han's own
       selling asset: the itch "Chibi 3D Characters - 8 Animated GLB
       Pack", style1 per gender (the dummy is ONE placeholder look
       per gender, exactly as the KayKit dummy was one look for both
       genders). SELECTION OPENED the same day (Han 2026-11-16
       16:51/16:52): styles 1-4 per gender are all in-tree now and
       selectable at the character gate by guests and signed-in
       users alike - see espilBodyChoice and the gate body row.
       The files ship byte-identical in
       assets/chibi-guests/ (licence beside them; they are Espil's
       own commercial assets). Signed-in sessions are untouched.
       REVERT: window.__ESPIL_GUEST_BODY__ = 'kaykit' before this
       file loads (or ESPIL_GUEST_BODY below) restores the KayKit
       placeholder path exactly; 'sprite' returns to the 2D path.
       The KayKit files stay in the tree untouched.

       Container reality (measured on the rig, 2026-11-16): the
       pack files are gltfpack output. Geometry is meshopt-
       compressed - the pair pages already publish
       window.MeshoptDecoder, wired here the espilAuckLoader way.
       Textures are KTX2/Basis, which the bundled GLTFLoader
       refuses without a KTX2 loader, so a minimal loader below
       transcodes each mip level to RGBA32 with the Basis
       transcoder the tiles vendor tree already ships (the same
       wasm three's own KTX2Loader drives) and hands the parser
       plain DataTextures. Models are cached per gender as a
       template and cloned per avatar (the masters' pattern), so a
       room full of guests costs one parse per gender, not the
       KayKit path's fresh 3.6 MB parse per peer.

       Clip coverage is the pack's own: Idle / Walk / Run /
       WalkBasic / RunBasic, nothing else. The game locomotion
       slots map to WalkBasic / RunBasic - measured stride speeds
       (male 0.80 / 1.30, female 0.95 / 1.88 m/s) sit in the same
       band as the existing families, while Walk / Run measure as
       a slow-stroll / sprint pair (0.39 / 2.50, 0.62 / 2.90) whose
       walk would need frantic rate-ups in normal play; the unused
       pair stays embedded, harmless. Attack / jump / swim / hit /
       death have NO clips: hit and death are effect-carried (hurt
       FX + death UI - the signed-in masters have no death state
       handler at all), and the rest fall back to the current
       locomotion with the move FX and the procedural swing lunge
       carrying the read - the same contract as a master clip that
       has not loaded. No slot ever points at a missing clip.
       ================================================================ */
    var ESPIL_GUEST_BODY='chibi';
    function espilGuestBodyMode(){
      var w=window.__ESPIL_GUEST_BODY__;
      if(w==='chibi'||w==='kaykit'||w==='sprite')return w;
      if(window.__ESPIL_KAYKIT_PLACEHOLDER__===true)return 'kaykit'; /* the order-5 override still honoured */
      return ESPIL_GUEST_BODY;
    }
    var ESPIL_CB_FILES={male:'assets/chibi-guests/chibi_male_style1.glb',
                        female:'assets/chibi-guests/chibi_female_style1.glb'};
    /* Body selection (Han 2026-11-16): styles 1-4 per gender are
       all in-tree; the file for a (gender, style) pair is derived,
       never table-driven, so a style can never point at a missing
       file. ESPIL_CB_FILES above stays as the style1 pair (the
       state hook's original shape). */
    function espilCbFile(gender,style){
      var g=(gender==='female')?'female':'male';
      var n=(style===2||style===3||style===4)?style:1;
      return 'assets/chibi-guests/chibi_'+g+'_style'+n+'.glb';
    }
    function espilCbFilesAll(){
      var out={male:{},female:{}};
      for(var n=1;n<=4;n++){ out.male['style'+n]=espilCbFile('male',n); out.female['style'+n]=espilCbFile('female',n); }
      return out;
    }
    var ESPIL_CB_TARGET_H=1.7; /* the game's player height, as the KayKit dummy */
    var ESPIL_CB_BASIS_JS='modules/vendor/basis/basis_transcoder.js';
    var ESPIL_CB_BASIS_WASM='modules/vendor/basis/basis_transcoder.wasm';
    var ESPIL_CB_LOCAL=null,ESPIL_CB_REMOTES_BUILT=0;
    window.__espilGuestBodyState=function(){
      var L=ESPIL_CB_LOCAL;
      return {mode:espilGuestBodyMode(),files:ESPIL_CB_FILES,filesAll:espilCbFilesAll(),targetH:ESPIL_CB_TARGET_H,
        bodyChoice:(typeof espilBodyChoice==='function')?espilBodyChoice():null,
        local:L?{ready:!!L.ready,anim:L.curAnim||null,acts:Object.keys(L.actions||{}),dead:!!L.__cbDead,gender:L.__gender||null,style:L.__cbStyle||null,bodyKey:L.__bodyKey||null,lunaris:!!L.__lunaris}:null,
        remotesBuilt:ESPIL_CB_REMOTES_BUILT,
        kaykitOn:espilKaykitPlaceholderOn()};
    };
    /* Basis transcoder, initialised once (main thread; three
       textures per gender, once per page, is not worker work). */
    var espilCbBasisPromise=null;
    function espilCbBasis(){
      if(espilCbBasisPromise)return espilCbBasisPromise;
      espilCbBasisPromise=new Promise(function(resolve,reject){
        function withScript(){
          fetch(ESPIL_CB_BASIS_WASM).then(function(r){
            if(!r.ok)throw new Error('basis wasm '+r.status);
            return r.arrayBuffer();
          }).then(function(wasm){
            var mod={wasmBinary:wasm,onRuntimeInitialized:function(){
              try{ mod.initializeBasis(); }catch(e){ reject(e); return; }
              resolve(mod);
            }};
            try{ BASIS(mod); }catch(e){ reject(e); }
          }).catch(reject);
        }
        if(typeof BASIS!=='undefined'){ withScript(); return; }
        var s=document.createElement('script');
        s.src=ESPIL_CB_BASIS_JS;
        s.onload=function(){ withScript(); };
        s.onerror=function(){ reject(new Error('basis transcoder script failed to load')); };
        document.head.appendChild(s);
      });
      return espilCbBasisPromise;
    }
    function espilCbKtx2Loader(basisMod){
      return {load:function(url,onLoad,onProgress,onError){
        fetch(url).then(function(r){ return r.arrayBuffer(); }).then(function(buf){
          try{
            var f=new basisMod.KTX2File(new Uint8Array(buf));
            if(!f.isValid()){ try{ f.close(); f.delete(); }catch(_){} throw new Error('invalid KTX2 texture'); }
            var levels=f.getLevels(),w=f.getWidth(),h=f.getHeight();
            if(!levels||!w||!h||!f.startTranscoding()){ try{ f.close(); f.delete(); }catch(_){} throw new Error('KTX2 startTranscoding failed'); }
            var FMT=13; /* Basis cTFRGBA32: uncompressed - every GPU takes it */
            var mips=[];
            for(var mip=0;mip<levels;mip++){
              var info=f.getImageLevelInfo(mip,0,0);
              var mw=levels>1?info.origWidth:info.width;
              var mh=levels>1?info.origHeight:info.height;
              var dst=new Uint8Array(f.getImageTranscodedSizeInBytes(mip,0,0,FMT));
              if(!f.transcodeImage(dst,mip,0,0,FMT,0,-1,-1)){ try{ f.close(); f.delete(); }catch(_){} throw new Error('KTX2 transcode failed'); }
              mips.push({data:dst,width:mw,height:mh});
            }
            try{ f.close(); f.delete(); }catch(_){}
            var tex=new THREE.DataTexture(mips[0].data,w,h,THREE.RGBAFormat,THREE.UnsignedByteType);
            tex.mipmaps=mips;
            tex.generateMipmaps=false;
            tex.minFilter=THREE.LinearMipmapLinearFilter;
            tex.magFilter=THREE.LinearFilter;
            tex.needsUpdate=true;
            if(onLoad)onLoad(tex);
          }catch(e){ if(onError)onError(e); }
        }).catch(function(e){ if(onError)onError(e); });
      }};
    }
    function espilCbLoader(basisMod){
      var l=new THREE.GLTFLoader();
      try{ if(window.MeshoptDecoder)l.setMeshoptDecoder(window.MeshoptDecoder); }catch(e){}
      l.setKTX2Loader(espilCbKtx2Loader(basisMod));
      return l;
    }
    /* Root-motion discipline, mirrored from buildWalkerAvatar's
       stripRootMotion: the Hips position track is stripped once,
       on the template's clips - game physics owns placement.
       Rotations (the pose lives in them) and all other tracks stay. */
    function espilCbStripRoot(clip){
      clip.tracks=clip.tracks.filter(function(t){
        var n=(t.name||'').toLowerCase();
        var isPos=n.indexOf('.position')>=0;
        var isRoot=/^(mixamorig[_:]?hips|hips|armature|root)/.test(n);
        return !(isPos&&isRoot);
      });
      return clip;
    }
    /* True rendered bounds for this file family: a whole-model
       Box3 reads the quantized geometry box (0.017 m - meaningless),
       so the height is sampled through the skin itself
       (boneTransform after skeleton.update()). Measured on the rig
       for both style1 files: 433.5 skin units tall, feet at
       exactly 0, rendering as the pack's verified 1.70 m at
       scale 1 - the unit factor below is that measurement, and a
       future file whose span differs still self-corrects through
       the same formula. */
    var ESPIL_CB_NATIVE_SPAN=433.5, ESPIL_CB_NATIVE_H=1.70;
    function espilCbMeasure(model){
      var out={s:1,groundOff:0};
      var sk=null;
      model.traverse(function(o){ if(o.isSkinnedMesh&&!sk)sk=o; });
      if(!sk||!sk.geometry||!sk.geometry.attributes||!sk.geometry.attributes.position)return out;
      try{
        model.updateMatrixWorld(true);
        if(sk.skeleton)sk.skeleton.update();
        var pos=sk.geometry.attributes.position;
        var v=new THREE.Vector3();
        var mnY=Infinity,mxY=-Infinity;
        for(var i=0;i<pos.count;i++){
          v.fromBufferAttribute(pos,i);
          sk.boneTransform(i,v);
          v.applyMatrix4(sk.matrixWorld);
          if(v.y<mnY)mnY=v.y;
          if(v.y>mxY)mxY=v.y;
        }
        var h=mxY-mnY, unit=ESPIL_CB_NATIVE_H/ESPIL_CB_NATIVE_SPAN;
        if(h>1&&isFinite(h)){
          out.s=ESPIL_CB_TARGET_H/(h*unit);
          out.groundOff=-mnY*unit*out.s;
        }
      }catch(e){}
      return out;
    }
    /* Templates are keyed per (gender, style) since the selection
       opened (Han 2026-11-16): eight possible templates, each
       parsed at most once and cloned per avatar, exactly the
       masters' pattern the style1 pair established. */
    var __espilChibiTemplates={};
    (function(){
      ['m','f'].forEach(function(gk){
        for(var si=1;si<=4;si++){
          __espilChibiTemplates[gk+si]={state:0,scene:null,clips:null,waiters:[],s:1,groundOff:0,
            style:si,gender:(gk==='f'?'female':'male')};
        }
      });
    })();
    function __espilEnsureChibi(gender,style,cb){
      var key=((gender==='f'||gender==='female')?'f':'m')+((style===2||style===3||style===4)?style:1);
      var T=__espilChibiTemplates[key];
      if(T.state===2){ cb(T); return; }
      T.waiters.push(cb);
      if(T.state===1)return;
      T.state=1;
      function fail(){
        T.state=0;
        var ws=T.waiters; T.waiters=[];
        /* Fail-soft (selection): a style file that fails to load
           falls back to style1 of the same gender - the avatar
           still renders a chibi body, and espilCbSetup records
           the style actually built from the template it got.
           Style1 failing keeps the original behaviour: the
           waiters receive null and the builders report the miss. */
        if(T.style!==1){
          for(var i=0;i<ws.length;i++){ __espilEnsureChibi(gender,1,ws[i]); }
          return;
        }
        for(var i=0;i<ws.length;i++){ try{ ws[i](null); }catch(_){} }
      }
      try{
        if(typeof THREE.GLTFLoader==='undefined')throw new Error('no GLTFLoader');
        espilCbBasis().then(function(basisMod){
          espilCbLoader(basisMod).load(espilCbFile(T.gender,T.style),function(gltf){
            T.scene=gltf.scene;
            T.clips=(gltf.animations||[]).map(espilCbStripRoot);
            /* Globe View material tag, same as __espilEnsureMaster:
               avatar materials are CPU-anchored instead of
               shader-bent, so the sweep must skip them. */
            T.scene.traverse(function(o){ if(o&&o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(function(mm){ mm.userData=mm.userData||{}; mm.userData.espilAvatarMat=true; }); } });
            var meas=espilCbMeasure(T.scene);
            T.s=meas.s; T.groundOff=meas.groundOff;
            T.state=2;
            var ws=T.waiters; T.waiters=[];
            for(var i=0;i<ws.length;i++){ try{ ws[i](T); }catch(_){} }
          },undefined,fail);
        }).catch(fail);
      }catch(e){ fail(); }
    }
    var ESPIL_CB_CLIPS={idle:'Idle',walk:'WalkBasic',run:'RunBasic'};
    /* RUN PLAYBACK CORRECTION (Han screen verdict 2026-11-16:
       the chibi RUN reads too fast; RUNFIX-REPORT.md in
       guest-swap/). The stride estimator's flat-contact stance
       set - ankle AND toe inside the lowest 35% height bands -
       is cross-validated on the masters and the KayKit body,
       whose gaits keep a foot down through most of the cycle.
       RunBasic is a true run: it has a flight phase, and on
       these short-legged clips the 35% set still covers
       50-58% of the cycle, so the stance mean is diluted with
       swing-phase samples and the registered stride comes out
       low (male 1.203, female 1.626), which drives the run
       timeScale high by the same ratio. Measured with a tight
       near-ground contact band (15%: contact fraction
       0.33-0.46, a plausible running duty factor), the same
       clips read male 1.47 / female 2.03 across the ankle, toe
       and midpoint estimators - ratios 1.22 / 1.25 over the
       registered values. The run registration is therefore
       scaled by their mean, 1.23, which lowers the run
       timeScale by ~19% at every speed. The correction is
       applied to the shared template clip's cached stride
       (guarded, once per clip) so every clone - local and
       remote - inherits it, and the action/avatar readouts
       are re-derived from the corrected cache. Walk is NOT
       corrected: a walk's duty factor (over half the cycle
       per foot, with double support) matches the wide set,
       and Han's verdict names the run. Masters and KayKit
       registrations are untouched. */
    var ESPIL_CB_RUN_STRIDE_F=1.23;
    function espilCbRunStrideFix(av){
      var act=av&&av.actions&&av.actions.run;
      if(!act)return;
      var clip=act.getClip();
      if(!clip||typeof clip.__espilStride!=='number')return;
      if(!clip.__espilCbRunFixed){
        clip.__espilStride*=ESPIL_CB_RUN_STRIDE_F;
        clip.__espilCbRunFixed=true;
      }
      act.__espilStride=clip.__espilStride;
      av.__strideRun=clip.__espilStride;
    }
    function espilCbSetup(av,model,clips,T){
      av.__cbStyle=(T&&T.style)||1; /* the style actually built (post fail-soft) */
      /* Authored facing is +z (ankle->toe measured on the rig for
         both genders) against the facing law's -z front - the same
         PI counter-rotation the masters and the KayKit body carry.
         Rotate the model, never the group. */
      model.rotation.y=Math.PI;
      model.traverse(function(o){ if(o.isMesh)o.castShadow=true; });
      model.scale.setScalar(T.s||1);
      model.position.y+=(T.groundOff||0);
      av.__visualRoot=model;
      model.userData.__avBaseScale=T.s||1;
      model.userData.__avBaseY=model.position.y;
      av.group.add(model);
      var mixer=new THREE.AnimationMixer(model);
      av.mixer=mixer;
      function findClip(name){ for(var i=0;i<clips.length;i++){ if(clips[i].name===name)return clips[i]; } return null; }
      for(var key in ESPIL_CB_CLIPS){
        var clip=findClip(ESPIL_CB_CLIPS[key]);
        if(!clip)continue;
        av.actions[key]=mixer.clipAction(clip);
      }
      espilStrideRegister(av,model,'walk'); /* FOOT-SLIDE SYNC: strides cached on the shared template clips */
      espilStrideRegister(av,model,'run');
      espilCbRunStrideFix(av); /* RUN PLAYBACK CORRECTION (Han 2026-11-16): see ESPIL_CB_RUN_STRIDE_F above */
      try{ mixer.update(0); }catch(_){}
      av.ready=true;
      av.playAnim('idle');
    }
    /* Locomotion crossfade + one-shot player, mirroring the KayKit
       pair (generation guard included). While dead, locomotion
       calls are ignored; while a hit one-shot is on stage,
       locomotion calls are ignored - with this pack no one-shot
       clips exist, so playOneShot honestly reports the miss and
       the FX/lunge paths carry those reads (see the header). */
    function espilCbPlayAnim(av,name){
      if(av.__cbDead)return;
      if(av.__cbHold&&name!==av.__cbHold)return;
      if(!av.mixer||!av.actions[name]||av.curAnim===name)return;
      var prev=av.actions[av.curAnim],next=av.actions[name];
      av.curAnim=name;
      next.reset().fadeIn(.18).play();
      next.__espilGen=(next.__espilGen||0)+1;
      if(prev&&prev!==next){ prev.fadeOut(.18); (function(pp,gg){ setTimeout(function(){ if(pp.__espilGen===gg)pp.stop(); },220); })(prev,prev.__espilGen||0); }
    }
    function espilCbPlayOneShot(av,name,durMs){
      if(name==='dead'){ av.__espilSetState('dead'); return true; }
      if(av.__cbDead)return false;
      if(!av.mixer||!av.actions[name])return false;
      var act=av.actions[name];
      var cur=av.actions[av.curAnim];
      av.curAnim=name;
      act.__espilGen=(act.__espilGen||0)+1;
      var actGen=act.__espilGen;
      act.reset().fadeIn(.12).play();
      if(cur&&cur!==act){ cur.fadeOut(.12); (function(pp,gg){ setTimeout(function(){ if(pp.__espilGen===gg)pp.stop(); },180); })(cur,cur.__espilGen||0); }
      if(name==='hit')av.__cbHold='hit';
      var dur=durMs||((act.getClip().duration||1)*1000);
      setTimeout(function(){
        if(av.__cbHold===name)av.__cbHold=null;
        if(av.curAnim!==name)return;
        act.fadeOut(.15);
        setTimeout(function(){ if(act.__espilGen===actGen)act.stop(); },180);
        av.curAnim=null;
      },dur);
      return true;
    }
    function espilCbSetState(av,s){
      if(s==='dead'){
        av.__cbDead=true; av.__cbHold=null;
        /* No death clip exists in the pack: the body settles to
           idle and locomotion locks until revive; the death UI
           and the death FX carry the read (the signed-in masters
           register no death state at all). */
        var idle=av.actions.idle, cur=av.actions[av.curAnim];
        if(idle&&av.mixer&&cur&&cur!==idle){
          av.curAnim='idle';
          idle.__espilGen=(idle.__espilGen||0)+1;
          idle.reset().fadeIn(.12).play();
          cur.fadeOut(.12);
        }else if(idle&&av.mixer&&av.curAnim!=='idle'){
          av.curAnim='idle';
          idle.__espilGen=(idle.__espilGen||0)+1;
          idle.reset().fadeIn(.12).play();
        }
      }else{
        av.__cbDead=false;
        espilCbPlayAnim(av,'idle');
      }
    }
    function espilCbPlayJump(av,isDouble){
      /* No jump clips in the pack: the miss is reported and the
         hop is carried by physics + the current locomotion, the
         same contract as a master whose jump file has not landed. */
      return espilCbPlayOneShot(av,isDouble?'doubleJump':'jump');
    }
    function buildChibiAvatar(gender,style){
      gender=(gender==='female')?'female':'male';
      style=(style===2||style===3||style===4)?style:1;
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      var av={group:g,shadow:shadow,ready:false,mixer:null,actions:{},curAnim:null,__gender:gender,__chibi:true,__cbStyleWanted:style};
      av.playAnim=function(name){ espilCbPlayAnim(av,name); };
      av.playOneShot=function(name,durMs){ return espilCbPlayOneShot(av,name,durMs); };
      av.playJump=function(isDouble){ return espilCbPlayJump(av,isDouble); };
      av.__espilSetState=function(s){ espilCbSetState(av,s); };
      ESPIL_CB_LOCAL=av;
      __espilEnsureChibi(gender,style,function(T){
        if(!T||!T.scene){ if(window.__espilToast)window.__espilToast('Character failed to load'); return; }
        try{ espilCbSetup(av,__espilCloneModel(T),T.clips,T); }
        catch(e){ if(window.__espilToast)window.__espilToast('Character failed to load'); }
      });
      return av;
    }
    function __espilBuildChibiRemote(gender,style){
      gender=(gender==='female')?'female':'male';
      style=(style===2||style===3||style===4)?style:1;
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      /* Same field contract as the GLB remote: the remote tick
         drives playAnim + mixer.update with its tiered stride.
         visual stays null on purpose - the tick would force the
         masters' 1.5 scale onto R.visual; the chibi model carries
         its own measured scale from espilCbSetup. */
      var R={group:g,shadow:shadow,mixer:null,actions:{},curAnim:null,ready:false,visual:null,baseY:0,
             cur:{x:0,y:0,z:0},tgt:{x:0,y:0,z:0,a:0},faceY:0,speed:0,fixSpeed:0,fixAt:0,lastAt:0,plate:null,
             phase:(__espilPhaseSeq++)%7,acc:0,gone:false,bubble:null,bubbleCv:null,bubbleTex:null,bubbleUntil:0,
             __chibi:true,__gender:gender,__cbStyleWanted:style};
      R.playAnim=function(name){ espilCbPlayAnim(R,name); };
      ESPIL_CB_REMOTES_BUILT++;
      __espilEnsureChibi(gender,style,function(T){
        if(R.gone||!T||!T.scene)return;
        try{ espilCbSetup(R,__espilCloneModel(T),T.clips,T); }catch(e){}
      });
      return R;
    }
    /* ---- Lunaris player body (Han 2026-11-16, restated
       2026-11-17): the owner account's designated body, built on
       the Chibi pattern beside it. The file is the Auckland Time
       Stone NPC's serving copy (assets/zealandia/lunaris.glb,
       1,171,248 B, md5 f418db32) loaded through this SEPARATE
       player-body path - espilBuildLunaris (the NPC) is
       untouched and keeps its own load and behaviour; the two
       paths simply fetch the same bytes. Measured in the lab
       (lunaris/lab/measure-lunaris.mjs, the selection lab's
       verbatim harness): the skin span is exactly 1.7000 m with
       the feet at 0, so the player scale is 1 and the ground
       offset is 0 (espilLunarisMeasure still derives both from
       the file at load, the Chibi measure's shape with the
       direct calibration - the Chibi constant ESPIL_CB_NATIVE_
       SPAN belongs to that pack's files and is NOT reused);
       authored facing is +z (ankle->toe horizontal dot with +Z
       0.998), so the model takes the same PI counter-rotation
       as the masters and the Chibi bodies; the locomotion
       contract is Idle / WalkBasic / RunBasic (the file's full
       Walk, TimeCast and Wave clips ride along unused - attack,
       jump, swim, hit and death follow the standing fallback
       contract, exactly as on the Chibi bodies). ---- */
    var ESPIL_LUNARIS_FILE='assets/zealandia/lunaris.glb';
    var ESPIL_LUNARIS_TARGET_H=1.7;
    var ESPIL_LUNARIS_CLIPS={idle:'Idle',walk:'WalkBasic',run:'RunBasic'};
    /* RUN PLAYBACK CORRECTION (measured 2026-11-17, the runfix
       method): RunBasic has a flight phase (tight-band contact
       fraction 0.42-0.46), so the stride estimator's wide
       contact set dilutes the stance mean and the registered
       stride reads low - lab: game estimate 1.5626 against the
       tight band's 1.9987, ratio 1.2791. The registration is
       scaled by the measured ratio, 1.28, once per shared
       template clip, exactly like ESPIL_CB_RUN_STRIDE_F. Walk
       is NOT corrected: WalkBasic's tight/game ratio is 0.93
       (no dilution), and the wide set is the standing walk
       method on every body. */
    var ESPIL_LUNARIS_RUN_STRIDE_F=1.28;
    var __espilLunarisTemplate={state:0,scene:null,clips:null,waiters:[],s:1,groundOff:0};
    function espilLunarisMeasure(model){
      var out={s:1,groundOff:0};
      var sk=null;
      model.traverse(function(o){ if(o.isSkinnedMesh&&!sk)sk=o; });
      if(!sk||!sk.geometry||!sk.geometry.attributes||!sk.geometry.attributes.position)return out;
      try{
        model.updateMatrixWorld(true);
        if(sk.skeleton)sk.skeleton.update();
        var posA=sk.geometry.attributes.position;
        var idxA=sk.geometry.attributes.skinIndex;
        var wgtA=sk.geometry.attributes.skinWeight;
        if(!idxA||!wgtA||!sk.skeleton||!sk.skeleton.boneMatrices)return out;
        /* Quantized-attribute discipline (fix 2026-11-18): this
           file stores position and skinWeight as NORMALIZED
           integer attributes (KHR_mesh_quantization). The
           game's three (r128) attribute getters return the RAW
           integers for such attributes - and SkinnedMesh.
           boneTransform reads the attributes itself, so a
           boneTransform span here read ~8.4 million times too
           large (position x32767, weights x255) and the scale
           below collapsed to ~1.2e-07: the body rendered
           microscopic, and the stride estimator's base-scale
           conversion fell out of its valid range so no stride
           ever registered. Newer three denormalizes in the
           getter, which is why the lab measured the true
           1.7000 span with the original code. Sample manually
           instead: raw array reads denormalized by type, then
           the same bind-matrix + weighted bone-matrix sum
           boneTransform performs - real units under either
           getter behaviour. */
        function denormDiv(attr){
          if(!attr||!attr.normalized)return 1;
          var a=attr.array;
          if(a instanceof Int16Array)return 32767;
          if(a instanceof Uint16Array)return 65535;
          if(a instanceof Int8Array)return 127;
          if(a instanceof Uint8Array)return 255;
          return 1;
        }
        var pDiv=denormDiv(posA), wDiv=denormDiv(wgtA);
        var pArr=posA.array, iArr=idxA.array, wArr=wgtA.array;
        var boneMats=sk.skeleton.boneMatrices;
        var v=new THREE.Vector3(), acc=new THREE.Vector3(), wv=new THREE.Vector3();
        var bm=new THREE.Matrix4();
        var mnY=Infinity,mxY=-Infinity;
        for(var i=0;i<posA.count;i++){
          v.set(pArr[i*3]/pDiv,pArr[i*3+1]/pDiv,pArr[i*3+2]/pDiv);
          v.applyMatrix4(sk.bindMatrix);
          acc.set(0,0,0);
          for(var k=0;k<4;k++){
            var w=wArr[i*4+k]/wDiv;
            if(!w)continue;
            bm.fromArray(boneMats,iArr[i*4+k]*16);
            wv.copy(v).applyMatrix4(bm);
            acc.addScaledVector(wv,w);
          }
          acc.applyMatrix4(sk.matrixWorld);
          if(acc.y<mnY)mnY=acc.y;
          if(acc.y>mxY)mxY=acc.y;
        }
        var h=mxY-mnY;
        if(h>0.2&&isFinite(h)){
          out.s=ESPIL_LUNARIS_TARGET_H/h;
          out.groundOff=-mnY*out.s;
        }
      }catch(e){}
      return out;
    }
    function __espilEnsureLunaris(cb){
      var T=__espilLunarisTemplate;
      if(T.state===2){ cb(T); return; }
      T.waiters.push(cb);
      if(T.state===1)return;
      T.state=1;
      function fail(){
        T.state=0;
        var ws=T.waiters; T.waiters=[];
        for(var i=0;i<ws.length;i++){ try{ ws[i](null); }catch(_){} }
      }
      try{
        if(typeof THREE.GLTFLoader==='undefined')throw new Error('no GLTFLoader');
        espilCbBasis().then(function(basisMod){
          espilCbLoader(basisMod).load(ESPIL_LUNARIS_FILE,function(gltf){
            T.scene=gltf.scene;
            T.clips=(gltf.animations||[]).map(espilCbStripRoot);
            /* Globe View material tag, same as the Chibi loader. */
            T.scene.traverse(function(o){ if(o&&o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(function(mm){ mm.userData=mm.userData||{}; mm.userData.espilAvatarMat=true; }); } });
            var meas=espilLunarisMeasure(T.scene);
            T.s=meas.s; T.groundOff=meas.groundOff;
            T.state=2;
            var ws=T.waiters; T.waiters=[];
            for(var i=0;i<ws.length;i++){ try{ ws[i](T); }catch(_){} }
          },undefined,fail);
        }).catch(fail);
      }catch(e){ fail(); }
    }
    function espilLunarisRunStrideFix(av){
      var act=av&&av.actions&&av.actions.run;
      if(!act)return;
      var clip=act.getClip();
      if(!clip||typeof clip.__espilStride!=='number')return;
      if(!clip.__espilLunarisRunFixed){
        clip.__espilStride*=ESPIL_LUNARIS_RUN_STRIDE_F;
        clip.__espilLunarisRunFixed=true;
      }
      act.__espilStride=clip.__espilStride;
      av.__strideRun=clip.__espilStride;
    }
    function espilLunarisSetup(av,model,clips,T){
      /* Authored facing +z (lab-measured) against the facing
         law's -z front: the PI counter-rotation, on the model,
         never the group - the masters' and Chibi bodies' same
         treatment. */
      model.rotation.y=Math.PI;
      model.traverse(function(o){ if(o.isMesh)o.castShadow=true; });
      model.scale.setScalar(T.s||1);
      model.position.y+=(T.groundOff||0);
      av.__visualRoot=model;
      model.userData.__avBaseScale=T.s||1;
      model.userData.__avBaseY=model.position.y;
      av.group.add(model);
      var mixer=new THREE.AnimationMixer(model);
      av.mixer=mixer;
      function findClip(name){ for(var i=0;i<clips.length;i++){ if(clips[i].name===name)return clips[i]; } return null; }
      for(var key in ESPIL_LUNARIS_CLIPS){
        var clip=findClip(ESPIL_LUNARIS_CLIPS[key]);
        if(!clip)continue;
        av.actions[key]=mixer.clipAction(clip);
      }
      espilStrideRegister(av,model,'walk'); /* FOOT-SLIDE SYNC: strides cached on the shared template clips */
      espilStrideRegister(av,model,'run');
      espilLunarisRunStrideFix(av); /* RUN PLAYBACK CORRECTION: see ESPIL_LUNARIS_RUN_STRIDE_F above */
      try{ mixer.update(0); }catch(_){}
      av.ready=true;
      av.playAnim('idle');
    }
    function buildLunarisAvatar(gender){
      gender=(gender==='female')?'female':'male';
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      var av={group:g,shadow:shadow,ready:false,mixer:null,actions:{},curAnim:null,__gender:gender,__lunaris:true};
      av.playAnim=function(name){ espilCbPlayAnim(av,name); };
      av.playOneShot=function(name,durMs){ return espilCbPlayOneShot(av,name,durMs); };
      av.playJump=function(isDouble){ return espilCbPlayJump(av,isDouble); };
      av.__espilSetState=function(s){ espilCbSetState(av,s); };
      ESPIL_CB_LOCAL=av;
      __espilEnsureLunaris(function(T){
        if(!T||!T.scene){ if(window.__espilToast)window.__espilToast('Character failed to load'); return; }
        try{ espilLunarisSetup(av,__espilCloneModel(T),T.clips,T); }
        catch(e){ if(window.__espilToast)window.__espilToast('Character failed to load'); }
      });
      return av;
    }
    function __espilBuildLunarisRemote(gender){
      gender=(gender==='female')?'female':'male';
      var g=new THREE.Group();
      var shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,20),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      /* Same field contract as the Chibi remote: the remote
         tick drives playAnim + mixer.update; visual stays null
         (the model carries its own measured scale). */
      var R={group:g,shadow:shadow,mixer:null,actions:{},curAnim:null,ready:false,visual:null,baseY:0,
             cur:{x:0,y:0,z:0},tgt:{x:0,y:0,z:0,a:0},faceY:0,speed:0,fixSpeed:0,fixAt:0,lastAt:0,plate:null,
             phase:(__espilPhaseSeq++)%7,acc:0,gone:false,bubble:null,bubbleCv:null,bubbleTex:null,bubbleUntil:0,
             __lunaris:true,__gender:gender};
      R.playAnim=function(name){ espilCbPlayAnim(R,name); };
      ESPIL_CB_REMOTES_BUILT++;
      __espilEnsureLunaris(function(T){
        if(R.gone||!T||!T.scene)return;
        try{ espilLunarisSetup(R,__espilCloneModel(T),T.clips,T); }catch(e){}
      });
      return R;
    }
    /* Item B appearance half: the equipped weapon rides on the
       sprite as the EP weapon part layer (assets/ep-parts weapon
       frames - the only delivered per-weapon art), front view,
       locomotion states only. The male attack sets already carry
       their family weapon in-hand; during female attacks and all
       back/side views the overlay hides rather than misalign. */
    var espilAv2WeaponCache={};
    function espilAv2WeaponTick(spr,state,dir,isLocal,clock){
      var ep=null;
      if(isLocal&&!spr.dead&&!spr.oneShot&&dir==='front'&&(state==='idle'||state==='walk'||state==='run')){
        try{
          var eq=JSON.parse(window.localStorage.getItem('espil_equipped')||'null');
          if(eq&&eq.weapon&&window.__espilGearWindow){
            var it=window.__espilGearWindow.itemOf(eq.weapon);
            if(it&&it.ep)ep=it.ep.weapon||null;
          }
        }catch(e){}
      }
      if(!ep){ spr.weapon.visible=false; spr.weaponEp=null; return; }
      if(spr.weaponEp!==ep){
        spr.weaponEp=ep;
        if(!espilAv2WeaponCache[ep]){
          var arr=[], loader=new THREE.TextureLoader();
          for(var i=0;i<24;i++){
            var t=loader.load('assets/ep-parts/weapon/front/'+ep+'/f'+(i<10?'0':'')+i+'.webp');
            try{ t.colorSpace=THREE.SRGBColorSpace; }catch(e){}
            arr.push(t);
          }
          espilAv2WeaponCache[ep]=arr;
        }
        spr.weaponTex=espilAv2WeaponCache[ep];
      }
      var widx=Math.floor(clock*8)%24;
      if(spr.weaponTex&&spr.weaponTex[widx]){ spr.weapon.material.map=spr.weaponTex[widx]; spr.weapon.material.needsUpdate=true; }
      var wf=spr.layerF||1;
      spr.weapon.scale.set(1.9*wf,1.9*wf,1);
      spr.weapon.position.y=0.99*wf;
      spr.weapon.visible=true;
    }
    var espilAv2Last=0, espilAv2Clock=0;
    function espilAv2Step(now){
      requestAnimationFrame(espilAv2Step);
      var dt=Math.min(.05,Math.max(0,(now-espilAv2Last)/1000||0));
      espilAv2Last=now;
      /* HIT STOP (Han 2026-11-17): avatar animation/interpolation
         honours the same shared deadline under the world scope
         (espilAv2Last already advanced - no catch-up jump after) */
      if(ESPIL_HIT_STOP_SCOPE==='world'&&now<(window.__espilHitStopUntil||0))dt=0;
      if(dt<=0)return;
      espilAv2Clock+=dt;
      var camYaw=(typeof walkCamYaw==='number')?walkCamYaw:0;
      var F=1;
      try{ F=(espilP1.layerLive&&!espilP1.failed&&typeof ESPIL_AVATAR_F==='number')?ESPIL_AVATAR_F:1; }catch(e){}
      for(var i=ESPIL_SPRITES.length-1;i>=0;i--){
        var e=ESPIL_SPRITES[i], spr=e.spr, faceY=0;
        if(e.local){
          if(!walkPlayer||!walkPlayer.av||walkPlayer.av.__spr!==spr){ ESPIL_SPRITES.splice(i,1); continue; }
          faceY=walkPlayer.faceY;
        }else{
          var R=e.R;
          if(!R||R.gone){ ESPIL_SPRITES.splice(i,1); continue; }
          faceY=R.faceY;
        }
        spr.layerF=F;
        var state;
        if(spr.dead)state='dead';
        else if(spr.oneShot){
          spr.oneShot.t+=dt;
          state=spr.oneShot.state;
          if(spr.oneShot.byFrames){ if(spr.frames&&spr.frameT>=spr.frames.length)spr.oneShot=null; }
          else if(spr.oneShot.t>=spr.oneShot.dur)spr.oneShot=null;
          if(spr.oneShot&&spr.oneShot.t>3)spr.oneShot=null;
          /* GLB parity: a finished one-shot releases av.curAnim,
             or the walk loop's state selector stays skipped and
             locomotion freezes at its last state. */
          if(!spr.oneShot&&e.local&&walkPlayer&&walkPlayer.av&&walkPlayer.av.__spr===spr)walkPlayer.av.curAnim=null;
        }
        else state=spr.loco||'idle';
        var rel=faceY-camYaw;
        while(rel>Math.PI)rel-=Math.PI*2;
        while(rel<-Math.PI)rel+=Math.PI*2;
        var arel=Math.abs(rel), dir, flip=false;
        if(arel<Math.PI/4)dir='back';
        else if(arel>Math.PI*3/4)dir='front';
        else{ dir='side'; flip=rel<0; }
        spr.state=state; spr.dir=dir; spr.flip=flip;
        var fam=(state==='attack'&&spr.gender==='male')?(e.local?espilFamilyEquipped():null):null;
        var set=espilAv2Resolve(spr.gender,state,dir,fam);
        if(!set){
          /* male death fallback: fade and sink on the idle frame */
          spr.fadeT+=dt;
          spr.body.material.opacity=Math.max(.15,1-spr.fadeT*.8);
          spr.body.position.y=ESPIL_AV2_CY-Math.min(.5,spr.fadeT*.35);
          spr.weapon.visible=false;
          continue;
        }
        if(spr.body.material.opacity<1){ spr.body.material.opacity=1; spr.body.position.y=ESPIL_AV2_CY; }
        var key=spr.gender+'|'+state+'|'+dir+'|'+(fam||'');
        if(key!==spr.setKey){
          spr.setKey=key;
          spr.frames=espilAv2Textures(spr.gender,set.d,set.n);
          spr.setFps=set.f;
          spr.frameT=0; spr.frameIdx=-1;
        }
        spr.frameT+=dt*spr.setFps;
        var n2=spr.frames.length;
        var idx=(state==='dead'||state==='jump'||state==='hit'||state==='attack')
          ? Math.min(n2-1,Math.floor(spr.frameT))
          : (Math.floor(spr.frameT)%n2);
        if(idx!==spr.frameIdx){
          spr.frameIdx=idx;
          spr.body.material.map=spr.frames[idx];
          spr.body.material.needsUpdate=true;
        }
        spr.body.scale.x=(spr.flip?-1:1)*ESPIL_AV2_PLANE*(spr.layerF||1);
        spr.body.scale.y=ESPIL_AV2_PLANE*(spr.layerF||1);
        if(spr.state!=='dead')spr.body.position.y=ESPIL_AV2_CY*(spr.layerF||1);
        espilAv2WeaponTick(spr,state,dir,e.local,espilAv2Clock);
      }
    }
    requestAnimationFrame(espilAv2Step);
    window.__espilSpriteAvatarState=function(){
      var out={mode:'glb',spriteRemotes:0};
      for(var i=0;i<ESPIL_SPRITES.length;i++)if(!ESPIL_SPRITES[i].local)out.spriteRemotes++;
      try{
        var av=walkPlayer&&walkPlayer.av;
        if(av&&av.__sprite){
          var spr=av.__spr;
          out.mode='sprite'; out.gender=av.__gender;
          out.state=spr.state; out.dir=spr.dir; out.flip=spr.flip;
          out.set=spr.setKey; out.frame=spr.frameIdx; out.dead=spr.dead;
          out.weaponEp=spr.weaponEp||null; out.weaponVisible=!!(spr.weapon&&spr.weapon.visible);
        }
      }catch(e){}
      return out;
    };
    /* __espilCombatState lives by __espilApplyRecovery above (one
       merged definition - Batch 5). */
    initChat();
    (function wireSkillHud(){
      var atk=document.getElementById('map-attack');
      if(atk)atk.addEventListener('pointerdown',function(e){e.preventDefault();doMove('punch');});
      /* INTERACT button (Han 2026-10-20 mobile layout): the touch
         twin of Space - wall jump first while climbing, then the
         building/store interact, exactly the keydown order. */
      var itb=document.getElementById('map-interact');
      if(itb)itb.addEventListener('pointerdown',function(e){e.preventDefault();if(!espilSpaceWallJump())tryInteract();});
      var tt=document.getElementById('tree-toggle');
      if(tt)tt.addEventListener('click',function(e){e.stopPropagation();toggleSkillTree();});
      var sc=document.getElementById('st-close');
      if(sc)sc.addEventListener('click',function(){toggleSkillTree(false);});
      var st=document.getElementById('skill-tree');
      if(st)st.addEventListener('click',function(e){if(e.target===st)toggleSkillTree(false);});
      /* Demo: simulate finishing a video (+5 Knowledge). The real video
         player will call window.__espilSkills.gainKnowledge(n) instead. */
      var stb=document.getElementById('st-study');
      if(stb)stb.addEventListener('click',function(){gainKnowledge(5,'demo video');renderSkillTree();});
      /* QA #14 (UI room): inventory + character panel close handlers. */
      var ic=document.getElementById('inv-close');
      if(ic)ic.addEventListener('click',function(){toggleInventory(false);});
      var ip=document.getElementById('inventory-panel');
      if(ip)ip.addEventListener('click',function(e){if(e.target===ip)toggleInventory(false);});
      var cc=document.getElementById('char-close');
      if(cc)cc.addEventListener('click',function(){toggleCharacterPanel(false);});
      var cp=document.getElementById('character-panel');
      if(cp)cp.addEventListener('click',function(e){if(e.target===cp)toggleCharacterPanel(false);});
      /* QA #18 (UI room, 2026-10-09): friends panel close + add-friend (local only). */
      var fc=document.getElementById('friends-close');
      if(fc)fc.addEventListener('click',function(){toggleFriendsPanel(false);});
      var fp=document.getElementById('friends-panel');
      if(fp)fp.addEventListener('click',function(e){if(e.target===fp)toggleFriendsPanel(false);});
      var fab=document.getElementById('friend-add-btn');
      if(fab)fab.addEventListener('click',function(){
        var inp=document.getElementById('friend-add-input');
        var name=inp?inp.value.trim():'';
        if(!name)return;
        var list=document.getElementById('friends-list');
        if(list){
          var p=document.createElement('p');p.className='st-foot';p.textContent='\u2022 '+name+' (local — server sync pending)';
          list.appendChild(p);
        }
        if(inp)inp.value='';
        if(window.__espilToast)window.__espilToast(name+' added locally. Server sync coming.');
      });
      /* QA #7 (UI room, 2026-10-09): map zoom buttons. */
      /* Han 2026-10-11 #9: +/- adjusts SIZE (stage), not zoom. */
      var mzi=document.getElementById('map-zoom-in');
      if(mzi)mzi.addEventListener('click',function(e){e.stopPropagation();setMapStage(mapStage+1);});
      var mzo=document.getElementById('map-zoom-out');
      if(mzo)mzo.addEventListener('click',function(e){e.stopPropagation();setMapStage(mapStage-1);});
      /* Init Leaflet map when entering map mode. */
      var _origEnter=window.enterMapMode;
      if(typeof initLeafletMap==='function'){
        /* Defer: init on first in-map frame via updateLeafletMap guard. */
        setInterval(function(){
          if(document.body.classList.contains('in-map'))initLeafletMap();
        },1000);
      }
    }());
    /* Camera-look drag + pinch/wheel zoom, only while the map is open. */
    function mapPointerDown(e){
      mapDragId=e.pointerId;mapLastX=e.clientX;mapLastY=e.clientY;
      try{canvas.setPointerCapture(e.pointerId);}catch(err){}
    }
    /* Mobile revert (Han 2026-11-04): the Batch M1 forced rotation
       and its espilDragDelta pointer-frame conversion are REMOVED -
       drag deltas are used in plain screen axes again. */
    function mapPointerMove(e){
      if(e.pointerId!==mapDragId)return;
      var dx=e.clientX-mapLastX,dy=e.clientY-mapLastY;
      mapLastX=e.clientX;mapLastY=e.clientY;
      if(espilCarLookDrag(dx,dy))return; /* CAR FP: the drag is a look offset, the follow yaw stays put */
      walkCamYaw-=dx*.0052;
      walkCamPitch=Math.max(.12,Math.min(1.15,walkCamPitch+dy*.004));
    }
    function mapPointerUp(e){
      if(e.pointerId===mapDragId)mapDragId=null;
      try{canvas.releasePointerCapture(e.pointerId);}catch(err){}
    }
    /* Drag-look on the game surface (Batch A, Han 2026-11-02 #5):
       the handlers above only run while cityPhaseActive, through
       the landing canvas listeners; during play the pointer lands
       on #globe-canvas (z-index 1 over the Mapbox container, and
       the fallback renderer's canvas too) and the globe branch
       rotates the landing camera instead, so the in-game view could
       not be turned by mouse or touch at all. This drag drives the
       same walkCamYaw / walkCamPitch with the same rates as
       mapPointerMove, only while in-map, and only for drags that
       start on the render surface itself - never on a UI element
       (buttons, inputs, dialogs, the joystick, the minimap, the
       customizer overlay). Pointer events cover touch as well. */
    var gameDragId=null,gameDragX=0,gameDragY=0;
    function gameDragBlocked(t){
      if(!t||!t.closest)return true;
      return !!t.closest('button,input,textarea,select,a,[role="dialog"],.modal-backdrop,.joystick,#minimap-wrap,#espil-custmerge');
    }
    document.addEventListener('pointerdown',function(e){
      if(gameDragId!==null)return;
      if(!document.body.classList.contains('in-map'))return;
      var t=e.target;
      if(!t||t.tagName!=='CANVAS')return;
      if(t.id!=='globe-canvas'&&!t.closest('#espil-mapbox'))return;
      /* While cityPhaseActive the canvas's own mapPointer handlers
         already drive walkCamYaw/walkCamPitch with these exact rates
         (the game canvas is the designated input pane) - defer to
         them so a drag is never applied twice. This document-level
         path covers the cases that starve the legacy one: the
         pointer landing on the Mapbox canvas instead of the pane,
         or any in-map state where the legacy gate is off - the
         combination Han hit live, where no drag rotated the view. */
      if(t.id==='globe-canvas'&&cityPhaseActive)return;
      if(gameDragBlocked(t))return;
      gameDragId=e.pointerId;gameDragX=e.clientX;gameDragY=e.clientY;
    });
    document.addEventListener('pointermove',function(e){
      if(e.pointerId!==gameDragId)return;
      var dx=e.clientX-gameDragX,dy=e.clientY-gameDragY;
      gameDragX=e.clientX;gameDragY=e.clientY;
      if(espilCarLookDrag(dx,dy))return; /* CAR FP: the drag is a look offset, the follow yaw stays put */
      walkCamYaw-=dx*.0052;
      walkCamPitch=Math.max(.12,Math.min(1.15,walkCamPitch+dy*.004));
    });
    function gameDragEnd(e){ if(e.pointerId===gameDragId)gameDragId=null; }
    document.addEventListener('pointerup',gameDragEnd);
    document.addEventListener('pointercancel',gameDragEnd);
    window.__espilDragLookState=function(){ return {dragging:gameDragId!==null,yaw:walkCamYaw,pitch:walkCamPitch}; };
    function mapZoom(d){
      /* ZOOM OPERATION (Han 2026-10-17): in Mapbox mode the wheel and
         pinch move the MAP ZOOM target directly, in zoom units (range
         16 to 23 (Mapbox default max was 22, Han 2026-10-17; top raised
         2026-11-08; the 20.39 default since the 2026-11-23 tuning
         verdict (19.95 from the 2026-11-10 zoom-out before it,
         20.17 at 6.2 m before that) sits mid-range,
         clear of both clamp edges), 0.28
         per wheel notch) - not a camera distance
         translated through a curve. Outside Mapbox mode the legacy
         distance behaviour is unchanged. */
      if(espilCarFpvWanted())return; /* CAR FP: zoom input is ignored in first person (census 5.5) - the eye is fixed; third person resumes at the player's own zoom */
      if(ESPIL_P1&&typeof espilP1!=='undefined'&&espilP1&&espilP1.map&&espilP1.ready&&!espilP1.failed){
        if(espilP1.zoomT===null)espilP1.zoomT=20.39;
        /* ZOOM-FPV push (Han 2026-11-17): the part of a zoom-in
           input the 23 cap absorbs is banked as push (in notch
           units - overshoot zoom / 0.28); a zoom-out input bleeds
           the bank back, signed. Wheel and pinch both land here,
           so both surfaces feed the same accumulator. While the
           zoom-FPV is on, further zoom-in is ignored (the bank
           stays 0 from the engage reset) and one net notch out
           counts to the release at push <= -1.0. The bank is
           capped at +/-2.0 so a trackpad burst cannot bury the
           release. The zoomT clamp itself is unchanged. */
        var _ztWanted=espilP1.zoomT-d*0.28;
        if(typeof espilZoomFpv!=='undefined'&&espilZoomFpv){
          if(_ztWanted>23){ if(!espilZoomFpv.on)espilZoomFpv.push+=(_ztWanted-23)/0.28; }
          else if(d>0&&(espilZoomFpv.on||espilZoomFpv.push>0)){ espilZoomFpv.push-=d; }
          espilZoomFpv.push=Math.max(-2,Math.min(2,espilZoomFpv.push));
        }
        espilP1.zoomT=Math.max(16,Math.min(23,_ztWanted));
        espilP1.zoomDrive=true; /* a wheel during descent takes the zoom over from the envelope */
        return;
      }
      /* ZOOM-FPV push, fallback branch (Han 2026-11-17): the same
         accounting in metres (the legacy d IS metres) against the
         outdoor floor 1.8. Inside (floor 0.4) nothing is banked -
         an interior is already first-person. */
      var _wdFloor=window.__espilInside?0.4:1.8, _wdWanted=walkCamDist+d;
      if(typeof espilZoomFpv!=='undefined'&&espilZoomFpv&&!window.__espilInside){
        if(_wdWanted<_wdFloor){ if(!espilZoomFpv.on)espilZoomFpv.push+=(_wdFloor-_wdWanted); }
        else if(d>0&&(espilZoomFpv.on||espilZoomFpv.push>0)){ espilZoomFpv.push-=d; }
        espilZoomFpv.push=Math.max(-2,Math.min(2,espilZoomFpv.push));
      }
      walkCamDist=Math.max(_wdFloor,Math.min(16,_wdWanted)); /* floor 1.8 (was 3) since 2026-11-08 so the default (5.5 since the 2026-11-23 tuning verdict; 7.0 from the 2026-11-10 zoom-out before it) sits inside the wheel range; the inside-store 0.4 floor is unchanged */
    }
    /* Keyboard: tracked only while the map is open (globe keeps its own bindings). */
    document.addEventListener('keydown',function(e){
      if(!document.body.classList.contains('in-map'))return;
      /* Chat input guard (2026-10-11): game keys stay off while typing. */
      var _ae=document.activeElement,_at=(_ae&&_ae.tagName)||'';
      if(/INPUT|TEXTAREA|SELECT/.test(_at))return;
      var k=window.__espilNormKey?window.__espilNormKey(e):e.key; /* IME fix (2026-11-23): normalized AFTER the typing guard above - text fields never reach this line */
      if(k==='Enter'&&!e.repeat){setChatTyping(true);return;}
      /* Han 2026-10-14 #1: ESC in-map closes panels ONLY — never exits to landing.
         (Re-applied 2026-10-14 after the working-copy overwrite.)
         Amended 2026-11-25 (Han, Package E): a press that closes
         nothing opens the options surface (the settings panel)
         instead of doing nothing - see the branch. The 2026-10-14
         rule stands in form: ESC never exits to landing by itself;
         leaving is the panel's own Return row, a deliberate
         second step. */
      if(k==='Escape'&&!e.repeat){
        e.preventDefault();
        /* The snapshot reads every state this branch closes, plus
           two surfaces closed by their own listeners on the same
           press (the notice panel and the auth
           modal), so one press never both closes one of those and
           opens the options. */
        var _escAny=!!(skillTreeOpen||inventoryOpen||characterOpen||friendsOpen||stallOpen||espilBldgPanelRec||settingsOpen||window.__espilNoticeOpen);
        if(!_escAny){ var _bo=document.getElementById('bldg-opts'); if(_bo&&_bo.classList.contains('open'))_escAny=true; }
        if(!_escAny){ var _sh=document.getElementById('shop-ui'); if(_sh&&_sh.classList.contains('open'))_escAny=true; }
        if(!_escAny){ var _sm0=document.getElementById('store-modal'); if(_sm0&&!_sm0.classList.contains('hidden'))_escAny=true; }
        if(!_escAny){ var _am=document.getElementById('signin-modal'); if(_am&&_am.getAttribute('aria-hidden')==='false')_escAny=true; }
        if(skillTreeOpen)toggleSkillTree(false);
        if(inventoryOpen)toggleInventory(false);
        if(characterOpen)toggleCharacterPanel(false);
        if(friendsOpen)toggleFriendsPanel(false);
        if(stallOpen)toggleStallPanel(false);
        if(espilBldgPanelRec)closeBuildingPanel();
        closeBuildingOpts();
        espilCloseShop();
        espilCloseGuide();
        if(settingsOpen)toggleSettingsPanel(false);
        var _sm=document.getElementById('store-modal');
        if(_sm&&!_sm.classList.contains('hidden'))_sm.classList.add('hidden');
        if(!_escAny)toggleSettingsPanel(true);
        return;
      }
      if(k===' '||k==='ArrowUp'||k==='ArrowDown'||k==='ArrowLeft'||k==='ArrowRight')e.preventDefault();
      walkKeys[k.toLowerCase()]=true;
      /* QA #8 (2026-10-06): Shift=jump, Space=interact. Shift-run deprecated. */
      /* Batch G conflict resolution: while fly/ride is active, SHIFT is
         ascend and SPACE is descend (Han 2026-11-03), so the ground
         jump/interact bindings stay silent in the air. They are
         untouched on the ground. */
      if(k===espilKeybinds.jump&&!e.repeat&&!(walkPlayer&&walkPlayer.flying))tryJump();
      if(k===espilKeybinds.interact&&!e.repeat&&!(walkPlayer&&walkPlayer.flying)){ if(!espilSpaceWallJump())tryInteract(); }
      /* Han 2026-10-10 #8: B summons/dismounts fly vehicle */
      if(k.toLowerCase()==='b'&&!e.repeat){
        if(typeof summonVehicle==='function')summonVehicle();
      }
      /* Skill slots: QWER row, then ASDF row (1-4 are item slots — UI room).
         K opens the skill tree. */
      var ae=document.activeElement,atag=(ae&&ae.tagName)||'';
      if(!/INPUT|TEXTAREA|SELECT/.test(atag)){
        var lk=k.toLowerCase(),sl=skillSlotForKey(lk);
        if(sl&&espilKbFpvActive())sl=null; /* KONBINIYA FPV: the skill row never fires inside - A/D are camera turns here (Han 2026-11-08) */
        if(sl){
          if(!e.repeat){
            if(sl.move)doMove(sl.move);
            else if(sl.locked&&window.__espilToast)window.__espilToast(sl.locked+' arrives with the combat update.');
          }
        }else if(lk==='k'){
          if(!e.repeat)toggleSkillTree();
        }else if(lk==='i'){
          /* QA #14 (UI room): I toggles inventory. */
          if(!e.repeat)toggleInventory();
        }else if(lk==='h'){
          /* QA #14 (UI room): H teleports home (placeholder → spawn). */
          if(!e.repeat)teleportHome();
        }else if(lk==='p'){
          /* QA #14 (UI room): P toggles character status + outfit. */
          if(!e.repeat)toggleCharacterPanel();
        }else if(lk===espilKeybinds.stall){
          /* Stall system (Han, 2026-10-19): Y toggles the personal
             stall panel (and opens a stall at your spot if none is
             out yet). Friends/party is on O (Han 2026-11-03). */
          if(!e.repeat)toggleStallPanel();
        }else if(lk==='o'){
          /* QA #18 (UI room, 2026-10-09): friends/party - moved from
             Y to U on 2026-10-19 when Y became the stall key, then
             to O on 2026-11-03 (Han round 3 #5: P is the profile
             key; friends/party lives on O). */
          if(!e.repeat)toggleFriendsPanel();
        }else if(lk==='m'){
          /* QA #7 (UI room, 2026-10-09): M cycles map stages 1→2→3→1. */
          if(!e.repeat)cycleMapStage();
        }
        /* Note: M (map cycle 1→2→3→1) not applied — shared copy has no 3-stage map. */
      }
    });
    document.addEventListener('keyup',function(e){
      /* IME fix (2026-11-23): the SAME normalization as keydown,
         so a key pressed in one IME mode and released in the
         other still clears its walkKeys entry - never a stuck
         movement key. */
      walkKeys[(window.__espilNormKey?window.__espilNormKey(e):e.key).toLowerCase()]=false;
    });
    var jumpBtn=document.getElementById('map-jump');
    if(jumpBtn)jumpBtn.addEventListener('pointerdown',function(e){e.preventDefault();tryJump();});
    /* QRF WALLS (Han 2026-10-17, CarInMap collision method): the wall
       judgment reads the RENDERED footprint layer - the candidate next
       position is projected to a screen point and queried with
       queryRenderedFeatures; a hit rejects the axis move at the last
       free sub-step (0.8 m sampling, centre point plus the body's
       leading edge point). If the move's START is already inside a
       footprint (a step that arrived while tiles were unloaded), the
       records judge instead - they own the recovery. Height judgments
       (rooftops, climb, support) always stay with the records; when
       the map or the layer is unavailable this returns false and the
       record sweep below is the wall judge. */
    /* GROUND-REFERENCE HEIGHT GATE (tiles loading package
       component 1, 2026-11-20): the three wall judges here
       (espilP1QrfHit, espilP1QrfBakedAt, espilPolyResolveAxis)
       share the record law's height gate - a record counts
       only when its height clears the player's height by
       more than 0.55 m. The records are baked against the
       flat ground datum, so the reference is the player's
       own height py and the gate is the old law byte-for-byte.
       (A tiles-era variant of this gate once subtracted a
       live tile-surface sample from py; the Google tiles
       path was discarded on 2026-11-26, the sampler hook is
       gone, and the reference is py itself, as it already
       was on every entry since the street gate closed.)
       Only the comparison's reference is defined here - the
       0.55 threshold and every other law (roof overlap,
       support, safe zone) are untouched. */
    function espilP1GroundRefY(x,z,py){
      return py;
    }
    function espilP1QrfHit(x,z,py){
      var ll=espilP1LngLat(x,z);
      var pt=espilP1.map.project(ll);
      var fs=espilP1.map.queryRenderedFeatures(pt,{layers:['espil-buildings-collision']});
      for(var i=0;i<fs.length;i++){
        var h=(fs[i].properties&&fs[i].properties.h)||0;
        if(h-espilP1GroundRefY(x,z,py)>.55)return true; /* the record law's height gate, on the feature's own h, against the ground reference */
      }
      return false;
    }
    /* EMPTY-SOURCE GUARD (combined tiles package section 1,
       2026-11-19): the GeoJSON source behind the collision layer
       is built in-page and Mapbox needs time to tile it, so for a
       window after entry the layer EXISTS but every query comes
       back empty - and the axis pass below read that emptiness as
       "nothing blocks" and returned true, so the record sweep
       never ran and there were no walls at all (Han's "collision
       is entirely absent", 2026-11-19 22:20; the window and the
       hole are both measured in tiles-collision/DIAGNOSIS.md).
       The guard mirrors the query against the baked records,
       which are built from the SAME building set with the SAME
       filter as the GeoJSON (espilPolyBuild vs
       espilP1BuildingsGeoJSON): a point inside a record footprint
       past the same height gate is exactly where a loaded source
       would return a blocking feature. If the records say a wall
       stands at the point but the rendered query said nothing,
       the source is not loaded yet - the axis pass returns false
       and the record sweep judges, exactly as it does whenever
       the map or the layer is unavailable. Once the source is
       tiled the rendered query answers first at those points and
       this check is never reached, so the primary judgment is
       unchanged. */
    function espilP1QrfBakedAt(x,z,py){
      var pb=espilPolyBucketAt(x,z);
      if(!pb)return false;
      var refY=espilP1GroundRefY(x,z,py); /* component 1: the shared gate's ground reference */
      for(var i=0;i<pb.length;i++){
        var rec=pb[i];
        if(rec.h-refY<=.55)continue; /* the record law's height gate, same as QrfHit */
        if(x<rec.x0||x>rec.x1||z<rec.z0||z>rec.z1)continue;
        if(espilPolyProbe(rec,x,z).d<=0)return true; /* centre inside the footprint */
      }
      return false;
    }
    /* COLLISION FIX (Han 2026-11-26, directive 7): the record
       point test the non-walk movement writers (dash, knockback,
       player-player push, the car module) share - true when a circle
       of radius r (default PLAYER_R) at (x,z) would touch a record
       that clears the shared height gate. False until the records
       are built, matching the probe's pre-load behaviour. */
    function espilPolyPointBlocked(x,z,py,r){
      var pb=espilPolyBucketAt(x,z); if(!pb)return false;
      var rr=(typeof r==='number')?r:PLAYER_R;
      var refY=espilP1GroundRefY(x,z,py);
      for(var i=0;i<pb.length;i++){
        var rec=pb[i];
        if(rec.h-refY<=.55)continue;
        if(x<rec.x0-rr||x>rec.x1+rr||z<rec.z0-rr||z>rec.z1+rr)continue;
        if(espilPolyProbe(rec,x,z).d<rr)return true;
      }
      return false;
    }
    window.__espilPolyBlockedAt=espilPolyPointBlocked;
    function espilP1QrfAxis(p,axis,r){
      var qs=window.__espilQrfStats||(window.__espilQrfStats={calls:0,hits:0,fallbacks:0,ms:0});
      if(!espilP1.map||!espilP1.ready||espilP1.failed){ qs.fallbacks++; return false; }
      try{ if(!espilP1.map.getLayer('espil-buildings-collision'))return false; }catch(e){ return false; }
      var delta=(axis==='x'?p._dx:p._dz)||0;
      if(!delta)return true;
      var endA=(axis==='x'?p.pos.x:p.pos.z), startA=endA-delta;
      var sx=(axis==='x'?startA:p.pos.x), sz=(axis==='z'?startA:p.pos.z);
      try{ if(espilP1QrfHit(sx,sz,p.pos.y)){ qs.fallbacks++; return false; } }catch(e){ qs.fallbacks++; return false; }
      if(espilP1QrfBakedAt(sx,sz,p.pos.y)){ qs.fallbacks++; return false; } /* empty-source guard: records own the start point */
      var nSub=Math.max(1,Math.min(24,Math.ceil(Math.abs(delta)/0.8)));
      var sgn=delta>0?1:-1;
      for(var sw=1;sw<=nSub;sw++){
        var candA=startA+delta*sw/nSub;
        var cx=(axis==='x'?candA:p.pos.x), cz=(axis==='z'?candA:p.pos.z);
        var lx=cx+(axis==='x'?sgn*r:0), lz=cz+(axis==='z'?sgn*r:0);
        var hit=false, qt0=performance.now();
        try{ hit=espilP1QrfHit(cx,cz,p.pos.y)||espilP1QrfHit(lx,lz,p.pos.y); }catch(e){ qs.fallbacks++; return false; }
        qs.calls++; qs.ms+=performance.now()-qt0;
        if(!hit&&(espilP1QrfBakedAt(cx,cz,p.pos.y)||espilP1QrfBakedAt(lx,lz,p.pos.y))){ qs.fallbacks++; return false; } /* empty-source guard: the records judge this step */
        if(hit){ qs.hits++;
          var freeA=startA+delta*(sw-1)/nSub;
          if(axis==='x')p.pos.x=freeA; else p.pos.z=freeA;
          return true;
        }
      }
      return true;
    }
    /* One-point polygon wall resolution for the axis pass (see the
       sweep driver in collideCircleAxis). Centre inside a footprint
       is skipped: the support law owns that column (roof lift). */
    function espilPolyResolveAxis(p,axis,r){
      var pb=espilPolyBucketAt(p.pos.x,p.pos.z);
      if(!pb)return;
      var refY=espilP1GroundRefY(p.pos.x,p.pos.z,p.pos.y); /* component 1: the shared gate's ground reference */
      for(var pi=0;pi<pb.length;pi++){
        var rec=pb[pi];
        if(p.pos.y+PLAYER_H<=0||p.pos.y>=rec.h)continue;
        if(rec.h-refY<=.55)continue;
        if(p.pos.x<rec.x0-r||p.pos.x>rec.x1+r||p.pos.z<rec.z0-r||p.pos.z>rec.z1+r)continue;
        var pr=espilPolyProbe(rec,p.pos.x,p.pos.z);
        if(pr.d>=r||pr.d<0)continue;
        var ddx=(p.pos.x-pr.cx)/(pr.d||1), ddz=(p.pos.z-pr.cz)/(pr.d||1);
        if(axis==='x'){
          if(p._dx>0&&ddx<-.25)p.pos.x-=(r-pr.d)/(-ddx);
          else if(p._dx<0&&ddx>.25)p.pos.x+=(r-pr.d)/ddx;
        }else{
          if(p._dz>0&&ddz<-.25)p.pos.z-=(r-pr.d)/(-ddz);
          else if(p._dz<0&&ddz>.25)p.pos.z+=(r-pr.d)/ddz;
        }
      }
    }
    function collideCircleAxis(p,axis){
      var r=PLAYER_R;
      /* Check downtown colliders + nearby chunk colliders (spatial hash) + cars.
         MAPBOX PHASE 1 (ESPIL_P1): walk/chunk colliders are bypassed -
         the prebuilt store strips below are the only building collision. */
      var lists=ESPIL_P1?[carColliders]:[walkColliders,carColliders];
      var pcx=Math.floor(p.pos.x/CHUNK_SIZE),pcz=Math.floor(p.pos.z/CHUNK_SIZE);
      if(!ESPIL_P1)for(var ox=-1;ox<=1;ox++)for(var oz=-1;oz<=1;oz++){
        var key=(pcx+ox)+','+(pcz+oz);
        if(chunkColliders[key])lists.push(chunkColliders[key]);
      }
      var csb2=espilStripBucketAt(p.pos.x,p.pos.z);
      if(csb2&&!ESPIL_P1)lists.push(csb2); /* MAPBOX PHASE 1: walls are the building polygons below, not strips */
      for(var li=0;li<lists.length;li++){
        var arr=lists[li];
        for(var i=0;i<arr.length;i++){
        var c=arr[i];
        if(p.pos.y+PLAYER_H<=c.bottom||p.pos.y>=c.top)continue; /* no vertical overlap */
        if(c.top-p.pos.y<=.55)continue; /* low enough to step onto — the support logic lifts the player */
        var cz=p.pos.z<c.z0?c.z0:(p.pos.z>c.z1?c.z1:p.pos.z);
        var cx=p.pos.x<c.x0?c.x0:(p.pos.x>c.x1?c.x1:p.pos.x);
        if(Math.abs(p.pos.z-cz)>=r||Math.abs(p.pos.x-cx)>=r)continue;
        /* QA #10: slide, don't bounce. Only push out along movement direction;
           if not moving on this axis, leave position alone (avoid snap). */
        if(axis==='x'){
          if(p._dx>0)p.pos.x=c.x0-r;else if(p._dx<0)p.pos.x=c.x1+r;
          /* else: no X movement — don't snap, prevents bounce */
        }else{
          if(p._dz>0)p.pos.z=c.z0-r;else if(p._dz<0)p.pos.z=c.z1+r;
          /* else: no Z movement — don't snap, prevents bounce */
        }
        }
      }
      /* COLOR-KEY WALLS (Han 2026-10-17): the building polygons block
         exactly where they are drawn. Per-axis resolution uses the
         closest point on the ring: the axis exit distance that puts
         the circle exactly PLAYER_R from the true edge - diagonal
         walls included, no stair-step. The axis move is SWEPT: it is
         resolved in sub-steps of at most 0.25 m, so at low frame
         rates (frame steps of several metres) the circle can no
         longer tunnel through a thin building between samples -
         point sampling did exactly that on Han's PC (22:15). */
      if(ESPIL_P1){ /* COLLISION FIX (Han 2026-11-26, directive 7): the
         exact record sweep is the primary wall judge. The rendered-layer
         query (espilP1QrfAxis) no longer pre-empts it: it read an
         untiled layer as "no wall" at entry and after every paint
         setData, and its two-point sampling let the circle's diagonal
         edge into corners. The sweep below measures true ring distance
         at 0.25 m sub-steps, independent of map rendering. */
        var delta=(axis==='x'?p._dx:p._dz)||0;
        var nSub=Math.max(1,Math.min(64,Math.ceil(Math.abs(delta)/0.25)));
        var endA=(axis==='x'?p.pos.x:p.pos.z), startA=endA-delta;
        for(var sw=1;sw<=nSub;sw++){
          if(nSub>1){
            var tgt=startA+delta*sw/nSub;
            if(axis==='x')p.pos.x=tgt; else p.pos.z=tgt;
          }
          var beforeA=(axis==='x'?p.pos.x:p.pos.z);
          espilPolyResolveAxis(p,axis,r);
          var afterA=(axis==='x'?p.pos.x:p.pos.z);
          if(Math.abs(afterA-beforeA)>1e-9)break; /* contact: hold the resolved point */
        }
      }
    }
    /* ============ CAMERA OCCLUSION CLAMP (Batch 5 item 8, Han 2026-11-07) ============
       REPLACES the withdrawn colour-detector silhouette (removed
       above in this batch): instead of drawing the player through
       the building, the CAMERA pulls in along its own ray so the
       player stays visible. Each frame the desired camera segment
       (player chest -> desired camera position, from the CURRENT
       user yaw/pitch/distance) is marched against the baked
       collision volumes (the same grid movement uses): the first
       step whose point sits inside a building cell BELOW its roof
       height caps the distance at that step minus a margin. The
       effective distance clamps IN fast (never clip through the
       occluder) and releases SLOWLY back to the user's distance
       when the segment is clear (no snapping). User inputs are
       untouched - yaw/pitch/zoom keep their own state; only the
       applied distance is capped, and the cap also feeds the
       Mapbox zoom in layer mode (espilP1Tick), whose pitch is a
       fixed 52 degrees - the segment test uses that geometry
       there. Suppressed indoors, during scripted arrivals, and
       while the store page pauses the world. */
    var espilCamEff=99, espilCamDEff=99, espilCamAllowed=null, espilCamBlockedAt=null, espilCamChecks=0, espilCamSegClear=true;
    var ESPIL_CAM_MIN=2.2, ESPIL_CAM_MARGIN=0.7;
    /* ROOF MANTLE tunables (Han 2026-11-18, roof-climb line): the
       mantle in the vertical section below lets an airborne jumper
       claim a low roof at its wall. MAX_H bounds it to the 1-storey
       band (the data's lowest building height is 4.0 m; the next
       band starts at 5.0 m) even if jump skills later raise the
       jump. REACH covers the double-jump shortfall at every physics
       rate: the continuous apex is 3.17 m, the apex at the dt cap
       (0.05 s steps, measured on the rig) is 2.72 m, and the claim
       floor h-REACH = 2.5 m sits below both - while a single jump
       (apex 1.39-1.61 m) still cannot reach it at any rate. */
    var ESPIL_ROOF_MANTLE_MAX_H=4.5, ESPIL_ROOF_MANTLE_REACH=1.5;
    /* march A->B (B at distance dist along the ray): the first
       point inside a baked record's footprint BELOW its roof
       (rec.h + margin) blocks; returns that distance or null.
       The collision grid's building cells carry roofH 0 in this
       build, so the volumes tested are the district records
       themselves - the same records the game renders from. */
    function espilCamMarch(ax, ay, az, bx, by, bz, dist, recs){
      var steps=Math.max(2,Math.ceil(dist/0.4));
      for(var i=2;i<=steps;i++){
        var f=i/steps, s=dist*f;
        var x=ax+(bx-ax)*f, y=ay+(by-ay)*f, z=az+(bz-az)*f;
        for(var j=0;j<recs.length;j++){
          var rec=recs[j];
          if(x<rec.x0||x>rec.x1||z<rec.z0||z>rec.z1)continue;
          if(y>rec.h+0.35)continue;
          if(espilPolyProbe(rec,x,z).inside)return s;
        }
      }
      return null;
    }
    function espilCamSegAllowed(p){
      var layerLive=(typeof ESPIL_P1!=='undefined'&&ESPIL_P1&&ESPIL_P1.layerLive&&!ESPIL_P1.failed);
      var pitch=layerLive?0.9076:walkCamPitch; /* layer mode jumpTo pitch is fixed at 52 deg */
      var dist=walkCamDist;
      var cp=Math.cos(pitch), sp=Math.sin(pitch);
      var ax=p.pos.x, ay=p.pos.y+1.3, az=p.pos.z;
      var bx=p.pos.x+Math.sin(walkCamYaw)*cp*dist, by=p.pos.y+sp*dist+1.2, bz=p.pos.z+Math.cos(walkCamYaw)*cp*dist;
      if(dist<1||typeof espilPolyHash==='undefined'||!espilPolyHash)return dist;
      var recs=espilCollectRecsNear((ax+bx)/2,(az+bz)/2,dist/2+6);
      var hit=espilCamMarch(ax,ay,az,bx,by,bz,dist,recs);
      if(hit===null){ espilCamBlockedAt=null; return dist; }
      espilCamBlockedAt=Math.round(hit*100)/100;
      return Math.max(ESPIL_CAM_MIN,hit-ESPIL_CAM_MARGIN);
    }
    function espilHomeCamAllowed(p){
      /* HOME THIRD-PERSON (Han 2026-11-17): the street boom at
         full distance leaves the 14 x 11 m room through its
         walls and ceiling, and the baked-record march above has
         no volumes in the home band - so inside the home the
         boom is capped analytically at the room box shrunk by
         0.3 m (the walls are 0.4 thick centred on the rect edge,
         so the cap keeps the camera inside the inner face; the
         ceiling caps at the room height less the same margin).
         The ray is the follow camera's own: chest origin,
         walkCamYaw / walkCamPitch. The 0.6 floor keeps a close
         over-shoulder view instead of entering the avatar when
         the player backs flush against a wall. */
      var r=window.__espilHomeRect; if(!r)return walkCamDist;
      var m=0.3, x0=r.x0+m, x1=r.x1-m, z0=r.z0+m, z1=r.z1-m, y1=ESPIL_HOME_H-m;
      var ox=p.pos.x, oy=p.pos.y+1.3, oz=p.pos.z;
      var cp=Math.cos(walkCamPitch), sp=Math.sin(walkCamPitch);
      var dx=Math.sin(walkCamYaw)*cp, dy=sp, dz=Math.cos(walkCamYaw)*cp;
      var t=walkCamDist;
      if(dx>1e-6)t=Math.min(t,(x1-ox)/dx); else if(dx<-1e-6)t=Math.min(t,(x0-ox)/dx);
      if(dz>1e-6)t=Math.min(t,(z1-oz)/dz); else if(dz<-1e-6)t=Math.min(t,(z0-oz)/dz);
      if(dy>1e-6)t=Math.min(t,(y1-oy)/dy); else if(dy<-1e-6)t=Math.min(t,(0.3-oy)/dy);
      if(t<0.6)t=0.6;
      return t;
    }
    function espilCamClampUpdate(dt){
      var p=walkPlayer;
      if(!p||!p.pos)return;
      if(window.__espilInside&&window.__espilInside.home&&window.__espilHomeRect){
        espilCamChecks++;
        var hAllowed=espilHomeCamAllowed(p);
        espilCamAllowed=hAllowed;
        if(hAllowed<espilCamEff)espilCamEff=Math.max(hAllowed,espilCamEff-dt*30); /* clamp in fast */
        else espilCamEff=Math.min(walkCamDist,espilCamEff+dt*6);                /* release slowly */
        if(espilCamEff>walkCamDist)espilCamEff=walkCamDist;
        espilCamDEff=Math.min(walkCamDist,espilCamEff);
        var hd=espilCamDEff, hcp=Math.cos(walkCamPitch);
        espilCamPos={x:Math.round((p.pos.x+Math.sin(walkCamYaw)*hcp*hd)*100)/100,
                     y:Math.round((p.pos.y+Math.sin(walkCamPitch)*hd+1.2)*100)/100,
                     z:Math.round((p.pos.z+Math.cos(walkCamYaw)*hcp*hd)*100)/100};
        espilCamInside=false; espilCamSegClear=true;
        return;
      }
      if(window.__espilInside||window.__espilStorePaused||p._espilArrive||p._espilLanding){ espilCamDEff=walkCamDist; return; }
      espilCamChecks++;
      /* OCCLUSION ZOOM REMOVED (Han 2026-11-26, item 11): the
         boom is no longer capped by the buildings in its path -
         the effective distance is the follow distance itself, so
         the camera never dollies in when a building covers the
         character (the X-ray silhouette carries occlusion now).
         espilCamSegAllowed / espilCamMarch stay in place uncalled,
         like espilP1QrfAxis before them. The home branch above
         (the interior room cap) is a separate law, untouched;
         espilCamPos keeps its unclamped-ray formula so the probe
         seam's shape is unchanged, with clamped permanently
         false. */
      espilCamAllowed=walkCamDist;
      espilCamBlockedAt=null;
      espilCamEff=walkCamDist;
      espilCamDEff=walkCamDist;
      var cpx=p.pos.x+Math.sin(walkCamYaw)*Math.cos(walkCamPitch)*espilCamDEff,
          cpy=p.pos.y+Math.sin(walkCamPitch)*espilCamDEff+1.2,
          cpz=p.pos.z+Math.cos(walkCamYaw)*Math.cos(walkCamPitch)*espilCamDEff;
      espilCamPos={x:Math.round(cpx*100)/100,y:Math.round(cpy*100)/100,z:Math.round(cpz*100)/100};
      espilCamInside=false;
      espilCamSegClear=true;
    }
    var espilCamPos=null, espilCamInside=false;
    window.__espilCamClampState=function(){
      return { eff:Math.round(espilCamDEff*100)/100, allowed:(espilCamAllowed===null?null:Math.round(espilCamAllowed*100)/100),
        userDist:Math.round(walkCamDist*100)/100, clamped:espilCamDEff<walkCamDist-0.05,
        blockedAt:espilCamBlockedAt, checks:espilCamChecks, segClear:espilCamSegClear,
        camPos:espilCamPos, camInside:espilCamInside };
    };
    /* FIX BATCH 9 - COLD-LOAD JUDGE GAP (diagnosis 2c): the
       collision judges (the polygon record buckets and the baked
       guard's source) are built from the district + collision
       payloads, and until espilDistrictBuilt flips they are all
       empty - no wall judgment exists at all. The entry gates wait
       for the build, but their 25 s failsafe can release the dive
       first on a slow load, and nothing else ever gated movement
       on the build. The chosen shape is a movement hold in the
       ground input below: while the build is outstanding, input
       is zeroed exactly like the landing/climb/death holds beside
       it, so the player stands at the entry point (a plaza clear
       of footprints) instead of walking an unjudged world. The
       hold starts when free movement would begin (arrival and
       landing own the body before that) and is invisible in the
       normal case - the fetch starts at script run, so the build
       has landed long before the dive in all but pathological
       loads. Two bounded exits keep it from ever becoming a
       soft-lock: a failed fetch is retried (throttled) while the
       hold stands. COLLISION FIX (Han 2026-11-26, directive 7):
       the second bounded exit this comment used to record - a 30 s
       unconditional release into the unjudged state - is REMOVED:
       an unjudged world must hold, not silently open (the release
       re-opened the entry window the hold exists to close). If the
       district fetch permanently fails the hold never releases,
       but that session has no buildings, no collision and no
       ground classes at all - a broken session either way - and
       the retry loop below is unbounded. Interiors are exempt: the
       inside tick's footprint clamp, not the district records,
       judges movement there. The vehicle path needs no gate -
       boarding requires foot movement first, which the hold
       already freezes, and entry always arrives via the dive on
       foot. Test hook: window.__espilDistrictHoldState. */
    var espilDistrictHoldSince=0, espilDistrictHoldOver=false, espilDistrictHoldRetryAt=0;
    var ESPIL_DISTRICT_HOLD_CAP_MS=30000;
    function espilDistrictHold(p){
      if(espilDistrictBuilt){ espilDistrictHoldOver=true; return false; }
      if(espilDistrictHoldOver)return false;
      if(!p||p._espilLanding||p._espilArrive||p.flying)return false;
      if(window.__espilInside)return false; /* the inside clamp owns interiors, not the district records */
      var now=Date.now();
      if(!espilDistrictHoldSince)espilDistrictHoldSince=now;
      if(!espilDistrictLoading&&now>=espilDistrictHoldRetryAt){ espilDistrictHoldRetryAt=now+2000; loadEspilDistrict(); }
      return true;
    }
    window.__espilDistrictHoldState=function(){
      return { built:!!espilDistrictBuilt, holding:!!(espilDistrictHoldSince&&!espilDistrictHoldOver&&!espilDistrictBuilt),
        since:espilDistrictHoldSince||null, over:espilDistrictHoldOver, capMs:ESPIL_DISTRICT_HOLD_CAP_MS };
    };
    function updateWalkMap(dt,t){
      var p=walkPlayer;
      if(!p)return;
      espilCamClampUpdate(dt); /* Batch 5 item 8: occlusion-capped camera distance for this frame */
      espilZoomFpvTick(dt); /* ZOOM-FPV (Han 2026-11-17): the state machine runs before EVERY camera path in this function, the flight branch included - its force-off for flight/driving/interior can only bite if it runs before those branches take the frame (the home is deliberately NOT a force-off - Han Q1 = ALLOW, 2026-11-17) */
      espilCarFpvTick(dt); /* CAR FIRST-PERSON: the blend + look-offset spring ride the same pre-branch slot as the zoom-FPV machine */
      /* Fly/ride mode (Batch G): the flight update owns movement;
         the follow camera below uses the ground tail's own math (the
         updateWalkCamera this branch used to call never existed). */
      if(p.flying){
        if(typeof updateVehicle==='function')updateVehicle(dt);
        var fcp=Math.cos(walkCamPitch),fsp=Math.sin(walkCamPitch);
        var fwant=new THREE.Vector3(
          p.pos.x+Math.sin(walkCamYaw)*fcp*espilCamDEff,
          p.pos.y+fsp*espilCamDEff+1.2,
          p.pos.z+Math.cos(walkCamYaw)*fcp*espilCamDEff
        );
        if(fwant.y<1.4)fwant.y=1.4;
        mapCamera.position.lerp(fwant,Math.min(1,dt*7));
        mapCamera.lookAt(p.pos.x,p.pos.y+1.7,p.pos.z);
        espilVillageClamp(p); /* NAME-ONLY ENTRY: the village ring binds flight too */
        return;
      }
      /* Batch G: a scripted arrival/landing takes the body - a fall
         armed by a fly release is cancelled, never charged across it. */
      if(p._fall&&(p._espilArrive||p._espilLanding))p._fall=null;
      updateDnaImprint(dt);
      /* --- input: keys + touch stick, relative to camera yaw --- */
      if(espilKbFpvActive()){
        /* KONBINIYA FPV: A/D turn the CAMERA (Han 2026-11-08 - inside
           the Konbiniya A/D is camera movement, not attack), at the
           standalone store page's Batch H turn rate. The keydown
           skill dispatch and doMove are gated off while FPV is
           active, so these keys can never fire Dash/Wave here. */
        if(walkKeys['a'])walkCamYaw+=ESPIL_KB_TURN*dt;
        if(walkKeys['d'])walkCamYaw-=ESPIL_KB_TURN*dt;
      }
      var ix=0,iz=0;
      if(walkKeys['arrowup'])iz-=1;
      if(walkKeys['arrowdown'])iz+=1;
      if(walkKeys['arrowleft'])ix-=1;
      if(walkKeys['arrowright'])ix+=1;
      if(window.__joyVec){ix+=window.__joyVec.x;iz+=window.__joyVec.y;}
      if(p._espilLanding){ix=0;iz=0;} /* ESPIL TILES BRIDGE: the land clip owns input until it settles */
      if(p._espilClimb){ix=0;iz=0;} /* ESPIL CLIMB: the climb step owns movement while attached */
      if(espilDead){ix=0;iz=0;} /* SURVIVAL S1: input frozen while the death choice is open */
      if(espilDistrictHold(p)){ix=0;iz=0;} /* FIX BATCH 9: no movement while no collision judge exists (cold-load window, diagnosis 2c) */
      if(espilPhotoMode){ix=0;iz=0;} /* NAME-ONLY ENTRY: the photo framing holds the body still while photo mode is open */
      var il=Math.sqrt(ix*ix+iz*iz);
      if(il>1){ix/=il;iz/=il;}
      var _carYaw=espilCarFpvFrameYaw(); /* CAR FP: the input frame reads the car heading, never the look yaw */
      var _effYaw=(_carYaw===null)?walkCamYaw:_carYaw;
      var fx=-Math.sin(_effYaw),fz=-Math.cos(_effYaw);
      var rx=-fz,rz=fx;
      var mx=fx*(-iz)+rx*ix,mz=fz*(-iz)+rz*ix;
      var joyMag=window.__joyVec?Math.sqrt(window.__joyVec.x*window.__joyVec.x+window.__joyVec.y*window.__joyVec.y):0;
      /* 2026-10-12 (Han): one run mode — moving always runs. Sprint toggle removed. */
      p.running=p.moving;
      /* QA #17: swimming mode when in water. */
      var _wasSwim=p.swimming, _preVy=p.velY;
      p.swimming=isWaterAt(p.pos.x,p.pos.z)&&p.pos.y<1.5;
      /* Batch 6 #4: a real fall INTO water breaks into the swim
         stroke at once (the fall half of the in-water set). */
      if(p.swimming&&!_wasSwim&&_preVy<-5&&p.av&&p.av.actions&&p.av.actions.swim&&['jump','doubleJump'].indexOf(p.av.curAnim)<0){
        try{p.av.playAnim('swim');}catch(e){}
      }
      /* WATER-ENTRY FEEL (Han 2026-11-15): the five steps hang on
         this transition and nowhere else - no other code calls
         espilWaterEnter / espilWaterExit. The last water point is
         kept so an exit splash lands where the water actually was. */
      if(p.swimming&&!_wasSwim)espilWaterEnter(p,_preVy);
      else if(!p.swimming&&_wasSwim)espilWaterExit(p);
      if(p.swimming){p._espilWaterX=p.pos.x;p._espilWaterZ=p.pos.z;}
      var _ms=moveSpeeds();
      var SPEED=p.swimming?_ms.swim*((typeof window.__espilSwimBoost==='number')?window.__espilSwimBoost:1):((p.running?_ms.run:_ms.walk)*(window.__espilSpeedBoost||1)); /* fast track (Han 2026-10-28): street tiles x2. NAME-ONLY ENTRY package 2 (2026-11-24): the swim branch reads its own lever - __espilSwimBoost is the boat module's speed lever, the exact analogue of __espilSpeedBoost on the land branch; unset it reads 1 and every swimmer is unchanged. The read is typeof-based, NOT ||1: the boat module brakes the body with lever 0 at a harbour edge, and ||1 would read that 0 as 1 (full swim speed) - the P2 verification rig caught exactly that escape at the Canada Place shoreline */
      p._dx=mx*SPEED*dt;p._dz=mz*SPEED*dt;
      espilTreeOnMove(Math.sqrt(p._dx*p._dx+p._dz*p._dz)); /* Batch 6: shoes-tree metres */
      p.moving=il>.12;
      p.pos.x+=p._dx;collideCircleAxis(p,'x');
      p.pos.z+=p._dz;collideCircleAxis(p,'z');
      /* 5km city boundary: circular, 5000m radius from landmark (Han 2026-10-07).
         Genshin-style invisible wall — slide along the edge.
         HOME SPACE deviation (2026-11-17, BUILD-REPORT deviation 1):
         instance spaces stand outside the city disc by design (the
         home band starts at z 24,000, past the 15 km bound), so the
         boundary must not drag an in-instance player back toward
         the city - the fly tick above already returns early while
         inside for the same reason. In-instance holding is the
         inside tick's own clamp, below. */
      if(!window.__espilInside){
        var distC=Math.sqrt(p.pos.x*p.pos.x+p.pos.z*p.pos.z);
        if(distC>MAP_BOUND){
          var s=MAP_BOUND/distC;
          p.pos.x*=s;p.pos.z*=s;
        }
      }
      espilVillageClamp(p); /* NAME-ONLY ENTRY (Han 2026-11-24): the village ring - radial clamp + slide at the landmark radius, cadence-limited notice, no rendered wall (the helper carries the population + exemption tests) */
      espilPlayerCollide(p); /* player-player collision (2026-10-27) */
      espilInsideTick(p); /* IN-PLACE INTERIOR (Han batch 5 #1): footprint clamp + door state while inside a building */
      espilTimeStoneCollide(p);
      /* 5km city: stream chunks around the player. Throttle to every ~0.25s. */
      p._chunkT=(p._chunkT||0)+dt;
      if(p._chunkT>.25){p._chunkT=0;updateChunks(p.pos.x,p.pos.z);}
      /* QA #17: in water, float at surface; no gravity, no jump. */
      if(p.swimming){
        if(p._fall)p._fall=null; /* Batch G: water breaks the fall - no fall damage */
        p.pos.y+=(WATER_Y-p.pos.y)*Math.min(1,dt*5);
        p.velY=0;p.onGround=false;p.jumps=0;
      }
      /* --- vertical: gravity + landing on tops (rooftops, planters, plaza, cars) --- */
      p.velY-=26*dt;
      var yBeforeFall=p.pos.y;
      p.pos.y+=p.velY*dt;
      var support=.05,supportCar=null;
      function considerSupport(c){
        var cz=p.pos.z<c.z0?c.z0:(p.pos.z>c.z1?c.z1:p.pos.z);
        var cx=p.pos.x<c.x0?c.x0:(p.pos.x>c.x1?c.x1:p.pos.x);
        if(Math.abs(p.pos.z-cz)>PLAYER_R||Math.abs(p.pos.x-cx)>PLAYER_R)return;
        /* SWEPT (2026-10-17): tops are judged against the PRE-move
           height - a fast fall at low FPS used to step clean past a
           roof plane in one frame and land on the street inside the
           building; the crossing now counts. */
        if(c.top<=yBeforeFall+.55&&c.top>support){support=c.top;supportCar=c.car||null;}
      }
      if(!ESPIL_P1)for(var i=0;i<walkColliders.length;i++)considerSupport(walkColliders[i]); /* MAPBOX PHASE 1: store only */
      for(var ci=0;ci<carColliders.length;ci++)considerSupport(carColliders[ci]);
      if(!ESPIL_P1){ var ssb=espilStripBucketAt(p.pos.x,p.pos.z);
      if(ssb)for(var si2=0;si2<ssb.length;si2++)considerSupport(ssb[si2]); } /* MAPBOX PHASE 1: polygon roofs below */
      if(ESPIL_P1){
        var spb=espilPolyBucketAt(p.pos.x,p.pos.z);
        if(spb)for(var spi=0;spi<spb.length;spi++){
          var srec=spb[spi];
          if(srec.h<=yBeforeFall+.55&&srec.h>support){
            if(p.pos.x>=srec.x0-PLAYER_R&&p.pos.x<=srec.x1+PLAYER_R&&p.pos.z>=srec.z0-PLAYER_R&&p.pos.z<=srec.z1+PLAYER_R&&espilPolyProbe(srec,p.pos.x,p.pos.z).d<=PLAYER_R){support=srec.h;supportCar=null;}
          }
        }
        /* INSIDE-FOOTPRINT RECOVERY (Han 2026-10-20 #4): the design
           always promised that a step arriving INSIDE a footprint is
           recovered by the support law (the "roof lift" the qRF
           comment cites), but the 0.55 step gate above blocks exactly
           that lift when the player is deep below the top - leaving a
           stuck state with no wall and no support response (a bad
           resume state is one way in). If the centre is inside a
           record and below its top, that record's roof is the
           support. Buildings are solid on this line, so no legitimate
           state is displaced by the lift. */
        if(support<=.05&&!p._espilClimb&&!p._espilArrive&&!window.__espilInside&&spb){
          for(var sri=0;sri<spb.length;sri++){
            var rrec=spb[sri];
            if(rrec.h>p.pos.y+.55&&espilPolyProbe(rrec,p.pos.x,p.pos.z).inside){
              /* COLLISION FIX (Han 2026-11-26, directive 7): the
                 rescue resolves to the street, not the roof -
                 PERMANENTLY, no longer flag-gated. A centre inside
                 a footprint is a defect state, never a legitimate
                 one; lifting it onto a roof would mask exactly the
                 residual penetrations this fix must catch and would
                 re-open a rooftop door for every other writer
                 (teleport seam, village clamp, car carry) that can
                 place a centre inside. Push the centre to the
                 footprint edge at ground level, reusing the resume
                 edge rule's geometry (espilResumeEdgePoint). If no
                 edge point is acceptable, support stays at street
                 level and this block retries on the next frame
                 instead of lifting. */
              var ep3=espilResumeEdgePoint(p.pos.x,p.pos.z);
              if(ep3){p.pos.x=ep3.x;p.pos.z=ep3.z;}
              break;
            }
          }
        }
        /* === ROOF MANTLE BEGIN (Han 2026-11-18) ===
           A jump pressed against a 1-storey wall could never claim
           the roof: the lowest building band in the data is h=4.0,
           the claim gate above needs the feet at h-0.55 = 3.45, and
           a perfect double jump tops out at 3.17 in continuous
           physics (jumpV/djumpV 9, gravity 26, street support 0.05)
           and at 2.72 under the dt cap's discrete steps (measured)
           - short of the gate at every frame rate. So when an
           airborne jumper (p.jumps>0, so walking or falling past a
           wall never triggers it) is at a low roof's wall (centre
           within the climb attach window's outer edge, PLAYER_R+.45)
           with the feet inside the mantle reach below its top, the
           support law takes that roof and the landing step places
           the centre just inside the edge - the grab the jump was
           already reaching for. Height-bounded twice: the roof must
           be at most ESPIL_ROOF_MANTLE_MAX_H (the 1-storey band) and
           within ESPIL_ROOF_MANTLE_REACH below the pre-fall feet
           height, so every taller building keeps its exact old
           behaviour. */
        if(ESPIL_ROOF_ACCESS&&support<=.05&&p.jumps>0&&!p.onGround&&!p._espilClimb&&!p._espilArrive&&!window.__espilInside&&spb){ /* COLLISION DISABLE (Han 2026-11-25, directive 5): the mantle is gated by ESPIL_ROOF_ACCESS - see the flag at ESPIL_P1 */
          for(var smi=0;smi<spb.length;smi++){
            var mrec=spb[smi];
            if(mrec.h>ESPIL_ROOF_MANTLE_MAX_H||mrec.h<=yBeforeFall+.55||mrec.h-yBeforeFall>ESPIL_ROOF_MANTLE_REACH)continue;
            var mpr=espilPolyProbe(mrec,p.pos.x,p.pos.z);
            if(mpr.d>PLAYER_R+.45||mpr.d<=-PLAYER_R)continue;
            p.pos.x=mpr.cx-mpr.nx*.3; p.pos.z=mpr.cz-mpr.nz*.3;
            support=mrec.h; supportCar=null; break;
          }
        }
        /* === ROOF MANTLE END === */
      }
      if(p.pos.y<=support){
        /* Batch G: a fly/ride release fall is charged HERE, at impact,
           by the height between the release point and this support. */
        if(p._fall){ espilChargeFallDamage(p._fall.fromY-support); p._fall=null; }
        if(!p.onGround&&p.velY<-9)walkSfx('land');
        p.pos.y=support;p.velY=0;p.onGround=true;p.jumps=0;
      }else if(p.pos.y>support+.02){
        p.onGround=false;
      }
      /* ride moving cars: carry the player with the car's frame delta */
      if(p.onGround&&supportCar){
        var cu=supportCar.userData.car;
        p.pos.x+=cu.x-cu.px;p.pos.z+=cu.z-cu.pz;
      }
      if(p._espilArrive)espilArrivalStep(p,dt); /* ESPIL TILES BRIDGE */
      espilClimbStep(p,dt); /* ESPIL CLIMB */
      /* --- avatar pose --- */
      var g=p.av.group;
      g.position.copy(p.pos);
      /* Swim sink (Han 2026-10-20): while swimming the VISUAL body
         rides lower so about half of it sits under the waterline -
         the physics float (WATER_Y) is unchanged; only the rendered
         group sinks, eased in and out so water entry has no pop. */
      p._espilSwimSink=(p._espilSwimSink||0)+(((p.swimming)?1.02:0)-(p._espilSwimSink||0))*Math.min(1,dt*4);
      if(p._espilSwimSink>0.001)g.position.y=p.pos.y-p._espilSwimSink;
      if(p.moving){
        var targetFace=Math.atan2(-mx,-mz);
        var d=targetFace-p.faceY;
        while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
        p.faceY+=d*Math.min(1,dt*12);
        p.bobT+=dt*11;
      }
      g.rotation.y=p.faceY;
      /* Animation state machine: idle / walk / run / swim follow movement state.
         While a one-shot (jump, doubleJump, attack, etc.) is playing, don't override it. */
      if(p.av.ready&&!p._espilClimb&&['jump','doubleJump','attack','stop','checkout','chat'].indexOf(p.av.curAnim)<0){ /* ESPIL CLIMB: while attached, espilClimbStep owns the pose (it plays 'climb'); this selector ran after it in the same frame and stomped the climb clip with idle/run every frame - the reason no climb animation ever showed (Han PC QA 2026-10-18) */
        var wantAnim;
        if(p.swimming){
          wantAnim=!p.moving?'swimIdle':'swim';
        }else{
          /* Han 2026-10-17 (re-check #8): movement plays the RUN
             clip again - the 2026-10-16 #18 walk selection is
             reversed by his ruling. Speed stays the single run
             mode (2026-10-12). */
          wantAnim=!p.moving?'idle':'run';
        }
        /* Fallback to idle/run if swim clips not loaded yet */
        if((wantAnim==='swim'||wantAnim==='swimIdle')&&!p.av.actions[wantAnim]){
          wantAnim=!p.moving?'idle':'run';
        }
        p.av.playAnim(wantAnim);
      }
      /* FOOT-SLIDE SYNC (Han 2026-11-15): the actual ground speed is
         this tick's real horizontal displacement over dt - it already
         carries joystick magnitude, the run multiplier, the street
         speed boost and collision losses, so partial input syncs too. */
      if(!p._fsLast)p._fsLast={x:p.pos.x,z:p.pos.z};
      var _fsDx=p.pos.x-p._fsLast.x, _fsDz=p.pos.z-p._fsLast.z;
      p._fsLast.x=p.pos.x; p._fsLast.z=p.pos.z;
      p._fsSpeed=dt>0.0001?Math.sqrt(_fsDx*_fsDx+_fsDz*_fsDz)/dt:0;
      espilStrideSync(p.av,p._fsSpeed);
      if(p.av.mixer)p.av.mixer.update(dt);
      /* Procedural swing lunge — the GLB has no attack clip, so the slash
         reads through a quick forward lunge + torso twist. */
      if(p.lungeT>0){
        p.lungeT-=dt;
        var lq=1-Math.max(0,p.lungeT)/.22,ls=Math.sin(Math.min(1,lq)*Math.PI);
        g.position.x+=-Math.sin(p.faceY)*ls*.55;
        g.position.z+=-Math.cos(p.faceY)*ls*.55;
        g.rotation.y=p.faceY+ls*.55;
      }
      updateSkillFx(dt);
      /* CHAR SHADOW (2026-11-20): the contact disc shares the support
         this frame's landing law resolved for the body (the local
         `support` above, tile-surface follow included). The old
         write pinned the disc to the baked datum .03 while the
         shipped tile follow lifts the body 6.6-8.8 m above it, so
         the disc stayed buried under the terrain - and the opacity
         datum .05 faded it to the .08 floor at those heights.
         Tiles off, support is the baked datum and the outcome is
         the old one. */
      p.av.shadow.position.set(p.pos.x,support+.03,p.pos.z);
      p.av.shadow.material.opacity=Math.max(.08,.26-Math.max(0,p.pos.y-support)*.05);
      /* --- follow camera --- */
      if(espilPhotoMode){
        /* NAME-ONLY ENTRY photo framing (Han 2026-11-24): while
           photo mode is open the camera sits at the registry's
           photo point looking at the landmark subject; the follow
           camera resumes on the frame photo mode closes. */
        mapCamera.position.set(espilPhotoMode.cx,espilPhotoMode.cy,espilPhotoMode.cz);
        mapCamera.lookAt(espilPhotoMode.lx,espilPhotoMode.ly,espilPhotoMode.lz);
      }else if(espilKbFpvActive()){
        /* KONBINIYA FPV (overlay path): the camera sits at the
           player's own eye (1.6 m - the standalone store page's EYE)
           and looks along the view yaw; the avatar group and its
           contact shadow are not drawn while FPV is applied. The
           look pitch reuses the drag-look pitch, re-centred so the
           outdoor default (.84) looks level. On the first frame FPV
           is no longer active the outdoor follow camera resumes and
           the avatar is restored - nothing else keeps FPV state. */
        if(!espilFpvApplied){ espilFpvApplied=true;
          if(p.av&&p.av.group)p.av.group.visible=false;
          if(p.av&&p.av.shadow)p.av.shadow.visible=false; }
        var fEye=new THREE.Vector3(p.pos.x,p.pos.y+ESPIL_KB_EYE,p.pos.z);
        var fLp=Math.max(-1.2,Math.min(1.2,.84-walkCamPitch)), fCp=Math.cos(fLp);
        mapCamera.position.copy(fEye);
        mapCamera.lookAt(fEye.x-Math.sin(walkCamYaw)*fCp, fEye.y+Math.sin(fLp), fEye.z-Math.cos(walkCamYaw)*fCp);
      }else{
        if(espilFpvApplied){ espilFpvApplied=false;
          if(p.av&&p.av.group)p.av.group.visible=true;
          if(p.av&&p.av.shadow)p.av.shadow.visible=true; }
        var cp=Math.cos(walkCamPitch),sp=Math.sin(walkCamPitch);
        var want=new THREE.Vector3(
          p.pos.x+Math.sin(walkCamYaw)*cp*espilCamDEff,
          p.pos.y+sp*espilCamDEff+1.2,
          p.pos.z+Math.cos(walkCamYaw)*cp*espilCamDEff
        );
        if(p.swimming){
          /* WATER FEEL step 5 (Han decision (a), 2026-11-15): while
             swimming the 1.4 floor is NOT applied - the target drops
             toward the surface (pitch term at .38 weight, -.38 base)
             with a slow swell, so the camera skims the water and
             dips under only intermittently at low pitch. The dips
             are what espilWaterFxTick reads as submersion. On land
             the original floor returns unchanged. */
          want.y=p.pos.y+sp*espilCamDEff*.38-.38+Math.sin(espilWater.t*.85)*.22;
          if(want.y<-1.1)want.y=-1.1;
          /* ZOOM-FPV (Han 2026-11-17): zoom-FPV HOLDS in water -
             the surface dip is reverted in proportion to blend,
             so at blend 1 the eye (pos + 1.6, above the surface)
             wins outright and the submersion tint stays off, the
             honest read of a head-above-water first person. */
          if(espilZoomFpv.blend>0){
            var _zwY=p.pos.y+sp*espilCamDEff+1.2; if(_zwY<1.4)_zwY=1.4;
            want.y+=(_zwY-want.y)*espilZoomFpv.blend;
          }
        }
        else if(want.y<1.4)want.y=1.4;
        var k=Math.min(1,dt*7);
        mapCamera.position.lerp(want,k);
        /* ZOOM-FPV (Han 2026-11-17): with blend > 0 the tracked
           camera is blended to the player's own eye - position
           toward the eye point (pos + ESPIL_KB_EYE), look target
           from the third-person point (pos + 1.7) toward the FPV
           forward point (the interior branch's own formula, so at
           blend 1 the framing coincides with the interior's
           numerically). The interior branch above is byte-untouched
           and this branch is reached only when it is off.
           HIT STOP interplay (hit-feel batch, 2026-11-17): a world
           hit stop hands this function dt = 0. The position step is
           then skipped outright (the tracking lerp above already
           moves nothing at k = 0), so the camera freezes
           mid-blend; the blend value itself is frozen by the state
           machine, and on release the blend resumes from the same
           value - the first resumed frame is an ordinary blend
           frame, never a catch-up jump. The look target below is
           recomputed from the same frozen inputs, so it holds
           still through the stop as well. */
        var _zTgt=new THREE.Vector3(p.pos.x,p.pos.y+1.7,p.pos.z);
        if(espilZoomFpv.blend>0){
          var zEye=new THREE.Vector3(p.pos.x,p.pos.y+ESPIL_KB_EYE,p.pos.z);
          var zLp=Math.max(-1.2,Math.min(1.2,.84-walkCamPitch)), zCp=Math.cos(zLp);
          var zFwd=new THREE.Vector3(zEye.x-Math.sin(walkCamYaw)*zCp, zEye.y+Math.sin(zLp), zEye.z-Math.cos(walkCamYaw)*zCp);
          if(dt>0)mapCamera.position.lerp(zEye,espilZoomFpv.blend);
          _zTgt.lerp(zFwd,espilZoomFpv.blend);
        }
        /* CAR FIRST-PERSON: with the car blend > 0 the tracked
           camera blends from the follow boom to the driver's eye
           (car pose + driver offset, ESPIL_KB_EYE height) and the
           look target to the car-heading forward point (heading +
           look offset). The zoom source's blend is 0 while
           driving (its forced-off law), so the two blends never
           fight; at car blend 1 the framing is the eye law
           exactly. On the P1 path espilP1Tick carries the same
           blend into the Mapbox framing. */
        if(espilCarFpv.blend>0){
          var cFr=espilCarFpvEye(p);
          if(dt>0)mapCamera.position.lerp(cFr.eye,espilCarFpv.blend);
          _zTgt.lerp(cFr.tgt,espilCarFpv.blend);
        }
        mapCamera.lookAt(_zTgt);
      }
      espilWaterFxTick(dt); /* WATER-ENTRY FEEL: pools, tint, muffle, shake */
      if(typeof espilOwnerChipTick==='function')espilOwnerChipTick(false);
      if(typeof espilOwnPlateTick==='function')espilOwnPlateTick(); /* LOCAL NAMEPLATE (Han 2026-11-25): the local plate rides the same per-frame step as the owner chip */
      /* Building proximity: store-name labels + interact prompt. */
      updateBuildingProximity(p.pos.x,p.pos.z,performance.now());
      espilStoreLabelsTick();
      /* QA #6: save position every 5s (throttled). */
      if(!p._lastSave||performance.now()-p._lastSave>5000){
        p._lastSave=performance.now();
        saveLastPos();
      }
      /* Footstep SFX removed (Han PC QA round 2, 2026-10-18): no
         walking sounds. BGM themes are unaffected. */
    }
    /* City pins (2026-10-06, per Han): small HTML buttons with the city name above —
       the 3D landmark icons are gone. Positioned each frame by projection. */
    var pinsLayer=document.getElementById('city-pins');
    cityData.forEach(function(city,index){
      var pos=latLon(city[1],city[2],2.035);
      var marker=new THREE.Mesh(new THREE.SphereGeometry(.72,10,8),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));
      marker.position.copy(pos);
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pos.clone().normalize());
      marker.scale.setScalar(.17);
      marker.userData={name:city[0],normal:pos.clone().normalize(),landmark:city[4],type:city[3],baseScale:.11,index:index,glbApplied:false,glbURL:null};
      markerGroup.add(marker);markers.push(marker);
      var pin=document.createElement('button');
      pin.type='button';pin.className='city-pin';pin.style.display='none';
      pin.setAttribute('aria-label',city[0]+', '+city[4]);
      /* W2 badge label: seeded from the saved language at build
         time (the language module may run before or after the
         pins exist); data-i18n keeps it in step on later language
         switches. Strings mirror the comingSoon dictionary row. */
      var soonTxt='COMING SOON';
      try{ var _sl=localStorage.getItem('espil_lang');
        soonTxt={ko:'준비 중',fr:'BIENTÔT DISPONIBLE',zh:'即将推出'}[_sl]||'COMING SOON'; }catch(e){}
      /* Batch D1 (Han 2026-11-03): the COMING SOON badge belongs to
         the ACTIVE cities only - an inactive city's pin keeps its
         name and orb but is never badged. */
      pin.innerHTML='<span class="nm">'+city[0]+'</span><span class="orb"><span class="halo"></span><span class="ball"></span></span>'+((espilPlayableCity(city[0])||!ESPIL_SELECTABLE_CITIES[city[0]])?'':'<span class="soon" data-i18n="comingSoon">'+soonTxt+'</span>');
      pin.addEventListener('mouseenter',function(){hoverCity({object:marker});});
      pin.addEventListener('mouseleave',function(){if(!selected)hoverCity(null);});
      pin.addEventListener('focus',function(){hoverCity({object:marker});});
      pin.addEventListener('blur',function(){if(!selected)hoverCity(null);});
      pin.addEventListener('click',function(){centerReel(marker,true);selectCity(marker);});
      if(!ESPIL_SELECTABLE_CITIES[city[0]]){ pin.classList.add('is-inactive'); pin.disabled=true; }
      pinsLayer.appendChild(pin);marker.userData.pin=pin;
      var cityButton=document.createElement('button');
      cityButton.type='button';cityButton.className='city-name';cityButton.textContent=city[0];cityButton.title=city[0]+' — '+city[4];cityButton.setAttribute('aria-label',city[0]+', '+city[4]);
      if(!ESPIL_SELECTABLE_CITIES[city[0]]){ cityButton.classList.add('is-inactive'); cityButton.disabled=true; }
      cityButton.addEventListener('mouseenter',function(){hoverCity({object:marker});});
      cityButton.addEventListener('mouseleave',function(){if(!selected)hoverCity(null);});
      cityButton.addEventListener('focus',function(){hoverCity({object:marker});});
      cityButton.addEventListener('blur',function(){if(!selected)hoverCity(null);});
      cityButton.addEventListener('click',function(){centerReel(marker,true);selectCity(marker);});
      /* Batch D1 (Han 2026-11-03): the city TEXT list shows the
         active cities only - an inactive city gets no entry in the
         list at all (its button is never appended, and the reel
         code below skips markers whose button is null). */
      if(ESPIL_SELECTABLE_CITIES[city[0]]){ cityList.appendChild(cityButton); marker.userData.button=cityButton; }
      else marker.userData.button=null;
    });
    var pinV=new THREE.Vector3();
    var pinC=new THREE.Vector3(), pinCam=new THREE.Vector3();
    function updateCityPins(){
      var rect=canvas.getBoundingClientRect();
      earthSpin.getWorldPosition(pinC);
      pinCam.copy(camera.position).sub(pinC).normalize();
      for(var i=0;i<markers.length;i++){
        var marker=markers[i],pin=marker.userData.pin;
        if(!pin)continue;
        if(!marker.visible||window.__espilIntroActive){pin.style.display='none';continue;}
        marker.getWorldPosition(pinV);
        /* Far-side occlusion (Han 2026-10-20): a pin whose city sits
           on the back of the globe must be hidden BY the globe - the
           projection alone happily draws it mirrored over the front.
           Facing test: the marker's outward normal against the
           camera direction from the globe centre; a small positive
           threshold keeps pins from floating at the limb. */
        var facing=pinV.clone().sub(pinC).normalize().dot(pinCam);
        if(facing<0.03){pin.style.display='none';continue;}
        pinV.project(camera);
        if(pinV.z>1){pin.style.display='none';continue;}
        var x=rect.left+(pinV.x*.5+.5)*rect.width;
        var y=rect.top+(-pinV.y*.5+.5)*rect.height;
        pin.style.display='flex';
        pin.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-100%)';
        pin.classList.toggle('is-active',marker===selected);
      }
    }
    var centeredMarker=null,reelFrame=0,reelQuietUntil=0;
    function updateReelCenter(){
      reelFrame=0;
      var listRect=cityList.getBoundingClientRect(),center=listRect.top+listRect.height/2,closest=null,distance=Infinity;
      markers.forEach(function(marker){
        if(!marker.userData.button)return; /* Batch D1: inactive cities have no list entry */
        var rect=marker.userData.button.getBoundingClientRect(),next=Math.abs(rect.top+rect.height/2-center);
        if(next<distance){distance=next;closest=marker;}
      });
      var prev=centeredMarker;
      centeredMarker=closest;
      markers.forEach(function(marker){ if(marker.userData.button)marker.userData.button.classList.toggle('is-centered',marker===closest); });
      /* The city-name text follows the centered city (2026-10-06, per Han):
         every time the city changes, the readout shows the new city. */
      if(closest&&closest!==prev&&!selected&&!entryActive&&!cityPhaseActive){
        status.textContent=closest.userData.name+' — '+closest.userData.landmark;
        /* The Earth model turns to center the city (2026-10-06, per Han):
           rotating the reel brings that city to the front. */
        var cityDir=closest.position.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0),earthSpin.rotation.y);
        targetYaw=Math.atan2(cityDir.x,cityDir.z);
        targetPitch=Math.asin(Math.max(-1,Math.min(1,cityDir.y)));
        /* Zoom toward the reel-selected city (2026-10-06, per Han). Skipped
           while the intro is up so the entry glide is not disturbed. */
        if(!window.__espilIntroActive)targetDistance=4.2;
      }
      /* Tick when the user swipes/scrolls the reel onto a new city — touch, wheel and drag alike. */
      if(closest&&closest!==prev&&performance.now()>reelQuietUntil){
        if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
      }
    }
    function centerReel(marker,smooth){
      if(!marker||!marker.userData.button)return;
      centeredMarker=marker;
      markers.forEach(function(item){ if(item.userData.button)item.userData.button.classList.toggle('is-centered',item===marker); });
      reelQuietUntil=performance.now()+450; /* programmatic scrolls stay silent; the caller ticks */
      var button=marker.userData.button;
      cityList.scrollTo({top:button.offsetTop-cityList.clientHeight/2+button.offsetHeight/2,behavior:smooth&&!reduced?'smooth':'auto'});
    }
    cityList.addEventListener('scroll',function(){if(!reelFrame)reelFrame=requestAnimationFrame(updateReelCenter);},{passive:true});
    cityList.addEventListener('wheel',function(event){event.stopPropagation();},{passive:true});
    /* Landing arrows = reel scroll (Han 2026-11-25, item 2a,
       monolith half): an arrow press scrolls the city reel by
       one row - exactly what a wheel tick does - and the reel's
       own scroll listener runs updateReelCenter, so the centre,
       the facing and the readout follow precisely as they do
       for scrolling. stepCity's discrete step (clearSelection +
       instant facing snap onto the next selectable city) is no
       longer what the arrow keys drive. stepCity stays defined
       (nothing calls it after this change) so the seam is a
       one-line revert if Han ever wants the step back. */
    function scrollReelStep(dir){
      if(window.__espilNoticeOpen)return; /* notice panel open: no reel motion either */
      if(window.__espilIntroActive||cityPhaseActive||entryActive)return;
      var rowH=44;
      var b=cityList?cityList.querySelector('button'):null;
      if(b&&b.offsetHeight)rowH=b.offsetHeight;
      cityList.scrollTop+=dir*rowH;
    }
    /* Arrow / joystick city navigation: recenter on the city at the CURRENT zoom, no zoom change. */
    var navIndex=0;
    function stepCity(dir){
      if(window.__espilNoticeOpen)return; /* notice panel open (Han 2026-10-19): no city stepping either */
      if(window.__espilIntroActive||cityPhaseActive||entryActive)return;
      /* Stepping away from a zoomed-in city eases back out to orbit first. */
      if(selected||infoShown)clearSelection(true);
      var cur=markers.indexOf(centeredMarker);
      if(cur<0)cur=navIndex;
      /* Arrow navigation lands only on selectable cities (Han 2026-10-18). */
      for(var _step=0;_step<markers.length;_step++){
        cur=(cur+dir+markers.length)%markers.length;
        if(ESPIL_SELECTABLE_CITIES[markers[cur].userData.name])break;
      }
      navIndex=cur;
      var marker=markers[navIndex];
      centerReel(marker,true);
      var cityDirection=marker.position.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0),earthSpin.rotation.y);
      targetYaw=Math.atan2(cityDirection.x,cityDirection.z);
      targetPitch=Math.asin(Math.max(-1,Math.min(1,cityDirection.y)));
      status.textContent=marker.userData.name+' — '+marker.userData.landmark;
      if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();
    }
    function modalOpen(){
      var m=document.getElementById('signin-modal');
      return m&&m.getAttribute('aria-hidden')==='false';
    }
    document.addEventListener('keydown',function(e){
      if(window.__espilIntroActive||modalOpen())return;
      /* Han 2026-10-14 #1 (ESC bug): while in the map, this landing handler must
         never run — its ESC branch (clearSelection) exited the map to the globe.
         In-map keys (incl. ESC = close panels only) live in the map key handler.
         (Re-applied 2026-10-14 after the working-copy overwrite.) */
      if(document.body.classList.contains('in-map')||cityPhaseActive)return;
      /* City entry gate (2026-10-06 QA #4): any key enters, ESC goes back to the info panel. */
      if(entryActive){
        if(e.key==='Escape'){e.preventDefault();cancelCityEntry();}
        else{e.preventDefault();finishCityEntry();}
        return;
      }
      /* This scene takes Up/Down + Enter only (Han 2026-10-29):
         Left/Right do nothing here. */
      if(e.key==='ArrowDown'){e.preventDefault();scrollReelStep(1);}
      else if(e.key==='ArrowUp'){e.preventDefault();scrollReelStep(-1);}
      else if(e.key==='Enter'){
        if(infoShown||cityPhaseActive)return;
        var m=centeredMarker||markers[navIndex];
        if(m)selectCity(m);
      }
      else if(e.key==='Escape'){ if(skillTreeOpen){toggleSkillTree(false);} else if(selected){clearSelection(true);} }
    });
    /* Virtual joystick (touch devices): analog movement stick for the walkable map.
       Only live while the map is open; exposes a normalized -1..1 vector. */
    window.__joyVec={x:0,y:0};
    (function(){
      var joy=document.getElementById('joystick'),knob=document.getElementById('joy-knob');
      if(!joy)return;
      var joyActive=false,joyCX=0,joyCY=0,joyMax=44;
      function setKnob(dx,dy){
        var kc=joyMax*0.64;
        if(knob)knob.style.transform='translate('+Math.max(-kc,Math.min(kc,dx))+'px,'+Math.max(-kc,Math.min(kc,dy))+'px)';
      }
      joy.addEventListener('pointerdown',function(e){
        if(!document.body.classList.contains('in-map'))return;
        joyActive=true;
        joy.classList.add('joy-live');
        try{joy.setPointerCapture(e.pointerId);}catch(err){}
        var r=joy.getBoundingClientRect();joyCX=r.left+r.width/2;joyCY=r.top+r.height/2;
        joyMax=Math.max(30,r.width*0.32); /* knob travel scales with the stick (Han 2026-10-20: vmin-sized) */
        e.preventDefault();
      });
      joy.addEventListener('pointermove',function(e){
        if(!joyActive||!document.body.classList.contains('in-map'))return;
        var dx=e.clientX-joyCX,dy=e.clientY-joyCY;
        var len=Math.sqrt(dx*dx+dy*dy),max=joyMax;
        if(len>max){dx=dx/len*max;dy=dy/len*max;}
        setKnob(dx,dy);
        window.__joyVec.x=dx/max;window.__joyVec.y=dy/max;
        e.preventDefault();
      });
      function joyEnd(){
        joyActive=false;
        joy.classList.remove('joy-live');
        window.__joyVec.x=0;window.__joyVec.y=0;
        if(knob)knob.style.transform='';
      }
      joy.addEventListener('pointerup',joyEnd);
      joy.addEventListener('pointercancel',joyEnd);
    }());
    /* The selection ring around the city was removed (2026-10-06, per Han). */
    /* The aurora shimmer rings and halo glow sprites were removed (2026-10-06 QA #3):
       landmarks are plain 2D cutout billboards now — no rings, no blinking. */

    /* (The Cauldron station was removed 2026-10-06, per Han — see note above.) */

    var raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),hovered=null,selected=null;
    var orbitDistance=6.6,targetDistance=6.6,minDistance=2.1,maxDistance=12.2; /* minDistance keeps the camera outside the globe: max zoom-in is the city zoom level */
    var yaw=0,pitch=0,targetYaw=0,targetPitch=0;
    /* Han 2026-10-16: on first visit the globe starts oriented to
       Vancouver (same direction math as selectCity). */
    (function(){
      var d=latLon(49.2827,-123.1207,2.035).normalize();
      targetYaw=Math.atan2(d.x,d.z);
      targetPitch=Math.asin(Math.max(-1,Math.min(1,d.y)));
      yaw=targetYaw; pitch=targetPitch;
    })();
    var dragging=false,moved=false,lastX=0,lastY=0,hasInteracted=false;
    var cameraLook=new THREE.Vector3(),desiredCameraPosition=new THREE.Vector3(),desiredCameraLook=new THREE.Vector3();
    var navigationNormal=new THREE.Vector3(),navigationHeading=new THREE.Vector3(),navigationReady=false,navigationViewScale=1;
    function placeCamera(){
      var cosPitch=Math.cos(pitch);
      camera.position.set(orbitDistance*Math.sin(yaw)*cosPitch,orbitDistance*Math.sin(pitch),orbitDistance*Math.cos(yaw)*cosPitch);
      cameraLook.set(0,0,0);
      camera.lookAt(cameraLook);
    }
    function prepareNavigationView(marker){
      navigationNormal.copy(marker.position).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),earthSpin.rotation.y);
      navigationHeading.set(0,1,0).addScaledVector(navigationNormal,-navigationNormal.y);
      if(navigationHeading.lengthSq()<.0001){
        navigationHeading.set(0,0,-1).addScaledVector(navigationNormal,navigationNormal.z);
      }
      navigationHeading.normalize();
      skyUniforms.upDirection.value.copy(navigationNormal);
      navigationReady=true;
    }
    function updateCameraView(){
      var ease=.075; /* Han 2026-10-16 (PC feedback #1): the entry camera NEVER snaps - prefers-reduced-motion no longer turns the globe zoom/pan into a teleport; the flag still governs decorative motion elsewhere. */
      if(selected&&navigationReady){
        /* iPhone-Maps-flyover framing: camera near the land, low horizon, long view
           toward the skyline. Every offset scales together from city to street level. */
        var zoomProgress=Math.max(0,Math.min(1,(targetDistance-minDistance)/(3.38-minDistance)));
        navigationViewScale=.16+.84*zoomProgress;
        desiredCameraPosition.copy(navigationNormal).multiplyScalar(2.04+1.4*navigationViewScale).addScaledVector(navigationHeading,-1.8*navigationViewScale);
        desiredCameraLook.copy(navigationNormal).multiplyScalar(2.04).addScaledVector(navigationHeading,.80*navigationViewScale);
      }else{
        navigationViewScale=1;
        var cosPitch=Math.cos(pitch);
        desiredCameraPosition.set(orbitDistance*Math.sin(yaw)*cosPitch,orbitDistance*Math.sin(pitch),orbitDistance*Math.cos(yaw)*cosPitch);
        desiredCameraLook.set(0,0,0);
      }
      camera.position.lerp(desiredCameraPosition,ease);
      cameraLook.lerp(desiredCameraLook,ease);
      if(selected&&navigationReady)camera.up.lerp(navigationNormal,ease).normalize();
      else camera.up.lerp(new THREE.Vector3(0,1,0),ease).normalize();
      camera.lookAt(cameraLook);
    }
    function resize(){
      var w=frame.clientWidth,h=frame.clientHeight,oldDefault=Math.max(6.6,2.12/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
      if(typeof mapCamera!=='undefined'&&mapCamera){mapCamera.aspect=w/h;mapCamera.updateProjectionMatrix();}
      var nextDefault=Math.max(6.6,2.12/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
      maxDistance=Math.max(12.2,nextDefault*1.5);
      if(!hasInteracted||Math.abs(targetDistance-oldDefault)<.08){targetDistance=nextDefault;orbitDistance=nextDefault;placeCamera();}
    }
    resize();
    /* A privacy-preserving regional default: browser timezone needs no location permission or network lookup. */
    function centerFromTimezone(){
      var timezone='';
      try{timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(error){}
      var rules=[
        [/Vancouver|Tijuana|Los_Angeles|Whitehorse/,'Vancouver']
      ];
      var cityName='';
      for(var r=0;r<rules.length;r++){if(rules[r][0].test(timezone)){cityName=rules[r][1];break;}}
      if(!cityName)return;
      var marker=markers.filter(function(item){return item.userData.name===cityName;})[0];
      if(!marker)return;
      var direction=marker.position.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0),earthSpin.rotation.y);
      yaw=targetYaw=Math.atan2(direction.x,direction.z);
      pitch=targetPitch=Math.asin(Math.max(-1,Math.min(1,direction.y)));
      if(marker.userData.button){ marker.userData.button.classList.add('is-local');
      marker.userData.button.title+=' · centered from browser timezone'; }
      centerReel(marker,false);
      placeCamera();
    }
    centerFromTimezone();
    requestAnimationFrame(function(){if(!centeredMarker)centerReel(markers[0],false);updateReelCenter();});
    window.addEventListener('resize',function(){resize();centerReel(centeredMarker||markers[0],false);});
    function setPointer(event){var rect=canvas.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;}
    function pick(event){setPointer(event);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(markers.filter(function(marker){return marker.visible;}),false)[0];}
    function setActiveButton(marker){
      markers.forEach(function(item){ if(item.userData.button)item.userData.button.classList.toggle('is-active',item===marker); }); /* Batch D1: inactive cities have no list button */
    }
    function hoverCity(hit){
      hovered=hit?hit.object:null;
      if(hovered){
        if(textureReady&&reliefReady)status.textContent=hovered.userData.name+' — '+hovered.userData.landmark;
        else status.textContent=idleStatus();
        canvas.style.cursor='pointer';
      }
      else if(!selected){
        status.textContent=idleStatus();
        canvas.style.cursor=dragging?'grabbing':'grab';
      }
    }
    function selectCity(marker){
      if(window.__espilNoticeOpen)return; /* notice panel open (Han 2026-10-19): city selection is blocked while it is up */
      if(!marker||!ESPIL_SELECTABLE_CITIES[marker.userData.name])return; /* inactive city (Han 2026-10-18): displayed, never selectable */
      selected=marker; if(status)status.textContent=status.textContent; /* landing line: city name only */setActiveButton(marker);centerReel(marker,true);
      ensureLandmarkGLB(marker); /* start fetching the real 3D model; swaps in when ready */
      navIndex=markers.indexOf(marker);
      approachSlow=true;infoShown=false;hideCityInfo();
      cancelCityEntry();
      if(window.EspilAudio){window.EspilAudio.onCitySelect();window.EspilAudio.pop();}
      exitWalkMap(true); /* silent: leaving any previous map visit */
      cityPhaseActive=false;cityApproachStarted=performance.now();
      citySky.visible=false;
      cityPhasePanel.setAttribute('aria-hidden','true');
      document.getElementById('city-status').classList.remove('is-city');
      /* Smooth cinematic zoom (2026-10-06 QA #3, smoothed per Han): one continuous
         dive instead of three stepped drops. Labels still mark the thirds. */
      clearZoomStages();
      var cityName=marker.userData.name,cityLandmark=marker.userData.landmark;
      smoothZoomTo(1.9,4200,[
        '1/3 \u00B7 Locating '+cityName,
        '2/3 \u00B7 Approaching '+cityName,
        '3/3 \u00B7 Final approach \u2014 '+cityLandmark
      ]);
      var cityDirection=marker.position.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0),earthSpin.rotation.y);
      targetYaw=Math.atan2(cityDirection.x,cityDirection.z);
      targetPitch=Math.asin(Math.max(-1,Math.min(1,cityDirection.y)));
      prepareNavigationView(marker);
    }
    function nearestFacingMarker(){
      var dir=camera.position.clone().normalize(),best=null,bestDot=-2;
      var w=new THREE.Vector3();
      markers.forEach(function(m){
        m.getWorldPosition(w);w.normalize();
        var d=w.dot(dir);
        if(d>bestDot){bestDot=d;best=m;}
      });
      return best;
    }
    function clearSelection(returnToOrbit){
      window.__espilZoomEnterArmed=false; /* ENTRY CONFIRMATION (Han 2026-11-26): any native clear cancels a pending zoom-entry */
      var direction=camera.position.clone().normalize();
      yaw=targetYaw=Math.atan2(direction.x,direction.z);
      pitch=targetPitch=Math.asin(Math.max(-1,Math.min(1,direction.y)));
      orbitDistance=camera.position.length();
      if(returnToOrbit)targetDistance=Math.max(6.6,2.12/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
      selected=null;navigationReady=false;setActiveButton(null);
      clearZoomStages();cancelCityEntry();
      exitWalkMap(true); /* silent: back to the globe */
      cityPhaseActive=false;
      citySky.visible=false;
      starMaterial.opacity=1;
      cityPhasePanel.setAttribute('aria-hidden','true');
      if(typeof hideCityInfo==='function')hideCityInfo();
      document.getElementById('city-status').classList.remove('is-city');
      var charPanel=document.getElementById('char-custom');
      if(charPanel)charPanel.setAttribute('aria-hidden','true');
      gateActive=false;
      /* Keep the text div honest: highlight the city the camera is facing. */
      var facing=nearestFacingMarker();
      if(facing){centerReel(facing,false);navIndex=markers.indexOf(facing);}
      status.textContent=idleStatus();
      if(returnToOrbit&&window.EspilAudio)window.EspilAudio.onReturnToOrbit();
    }
    cityReturn.addEventListener('click',function(){clearSelection(true);});
    /* In-city EXIT button (Han 2026-10-18): same return-to-globe path
       as RETURN TO EARTH, from the top-right beside the music toggle. */
    /* The EXIT button is removed (Han batch 5 #3): the settings
       gear (wired in the settings module) opens the menu whose
       Return to Earth calls clearSelection(true). */
    /* City info panel: image, metro population, popular brands. ENTER dives into the street view. */
    var cityFacts={
      'Vancouver':{pop:'2.6M',brands:['Lululemon','Aritzia',"Arc'teryx"],img:'assets/cities/vancouver.webp'},
      'San Francisco':{pop:'4.7M',brands:["Levi's",'Gap','Salesforce'],img:'assets/cities/san-francisco.webp'},
      'Los Angeles':{pop:'12.5M',brands:['Disney','Warner Bros.','In-N-Out'],img:'assets/cities/los-angeles.webp'},
      'Chicago':{pop:'9.5M',brands:["McDonald's",'Boeing','Kraft Heinz'],img:'assets/cities/chicago.webp'},
      'Mexico City':{pop:'22M',brands:['Corona','Bimbo','Telcel'],img:'assets/cities/mexico-city.webp'},
      'New York':{pop:'20M',brands:["Macy's",'Estée Lauder','HBO'],img:'assets/cities/new-york.webp'},
      'Toronto':{pop:'6.4M',brands:['Tim Hortons','Canadian Tire','Loblaw'],img:'assets/cities/toronto.webp'},
      'Rio de Janeiro':{pop:'13.5M',brands:['Havaianas','Petrobras','Brahma'],img:'assets/cities/rio-de-janeiro.webp'},
      'São Paulo':{pop:'22M',brands:['Itaú','Natura','Embraer'],img:'assets/cities/sao-paulo.webp'},
      'Buenos Aires':{pop:'15M',brands:['Mercado Libre','Globant','Quilmes'],img:'assets/cities/buenos-aires.webp'},
      'London':{pop:'14.3M',brands:['Burberry','Harrods','BBC'],img:'assets/cities/london.webp'},
      'Paris':{pop:'11.1M',brands:['Chanel','Louis Vuitton',"L'Oréal"],img:'assets/cities/paris.webp'},
      'Madrid':{pop:'6.6M',brands:['El Corte Inglés','Real Madrid','Mahou'],img:'assets/cities/madrid.webp'},
      'Rome':{pop:'4.3M',brands:['Fendi','Bulgari','Enel'],img:'assets/cities/rome.webp'},
      'Berlin':{pop:'6M',brands:['Zalando','HelloFresh','N26'],img:'assets/cities/berlin.webp'},
      'Moscow':{pop:'13M',brands:['Aeroflot','GUM','Kaspersky'],img:'assets/cities/moscow.webp'},
      'Lagos':{pop:'16M',brands:['Dangote','Jumia','GTBank'],img:'assets/cities/lagos.webp'},
      'Nairobi':{pop:'5.1M',brands:['M-Pesa','Safaricom','Kenya Airways'],img:'assets/cities/nairobi.webp'},
      'Cairo':{pop:'21M',brands:['EgyptAir','Orascom','Juhayna'],img:'assets/cities/cairo.webp'},
      'Cape Town':{pop:'4.9M',brands:['Woolworths','Pick n Pay','Castle Lager'],img:'assets/cities/cape-town.webp'},
      'Istanbul':{pop:'16M',brands:['Turkish Airlines','Arçelik','Mavi'],img:'assets/cities/istanbul.webp'},
      'Dubai':{pop:'3.6M',brands:['Emirates','Emaar','Jumeirah'],img:'assets/cities/dubai.webp'},
      'Mumbai':{pop:'21M',brands:['Tata','Reliance','Bollywood'],img:'assets/cities/mumbai.webp'},
      'Delhi':{pop:'33M',brands:['Air India',"Haldiram's",'DLF'],img:'assets/cities/delhi.webp'},
      'Singapore':{pop:'6M',brands:['Singapore Airlines','DBS','Tiger Beer'],img:'assets/cities/singapore.webp'},
      'Bangkok':{pop:'10.7M',brands:['Thai Airways','CP Group','Red Bull'],img:'assets/cities/bangkok.webp'},
      'Shanghai':{pop:'29M',brands:['NIO','SAIC','Yum China'],img:'assets/cities/shanghai.webp'},
      'Hong Kong':{pop:'7.5M',brands:['HSBC','Cathay Pacific','Giordano'],img:'assets/cities/hong-kong.webp'},
      'Beijing':{pop:'22M',brands:['Lenovo','Baidu','Air China'],img:'assets/cities/beijing.webp'},
      'Seoul':{pop:'25M',brands:['Samsung','Hyundai','Kakao'],img:'assets/cities/seoul.webp'},
      'Tokyo':{pop:'37M',brands:['Sony','Uniqlo','Muji'],img:'assets/cities/tokyo.webp'},
      'Manila':{pop:'14.5M',brands:['Jollibee','SM','San Miguel'],img:'assets/cities/manila.webp'},
      'Jakarta':{pop:'33M',brands:['Garuda Indonesia','Tokopedia','Indomie'],img:'assets/cities/jakarta.webp'},
      'Sydney':{pop:'5.3M',brands:['Qantas','Atlassian','Bonds'],img:'assets/cities/sydney.webp'},
      'Melbourne':{pop:'5.2M',brands:['BHP','ANZ','Vegemite'],img:'assets/cities/melbourne.webp'},
      'Auckland':{pop:'1.7M',brands:['Air New Zealand','Fonterra',"Whittaker's"],img:'assets/cities/auckland.webp'}
    };
    var infoPanel=document.getElementById('city-info'),infoImg=document.getElementById('city-info-img'),
        infoName=document.getElementById('city-info-name'),infoPop=document.getElementById('city-info-pop'),
        infoBrands=document.getElementById('city-info-brands');
    /* TESTING BUILD (2026-10-06, per Han): only Vancouver entry works.
       2026-10-16 (Han): Auckland Queen Street corridor joins as the
       second playable city - entry opens for playable cities only. */
    var VANCOUVER_ONLY=true;
    /* Production config (Han 2026-10-18): Vancouver is the only city
       that dives; the other five selectable cities show COMING SOON
       with the button disabled. */
    function espilPlayableCity(name){return !!ESPIL_CITY_KEYS[name];} /* Wave 0 (Han 2026-11-18, all cities open): the six bundle cities dive; the 30 bundle-less cities stay unselectable (ESPIL_SELECTABLE_CITIES above) and keep the preparation panel. Supersedes the 2026-11-02 Vancouver-only deployment config. */
    function showCityInfo(marker){
      infoShown=true;approachSlow=false;
      var facts=cityFacts[marker.userData.name]||{pop:'—',brands:[],img:''};
      var canEnter=espilPlayableCity(marker.userData.name);
      if(infoEnter){
        infoEnter.disabled=!canEnter;
        infoEnter.classList.toggle('is-disabled',!canEnter);
        /* W2 (Han 2026-11-03 round 3 #1): the coming-soon label
           follows the site language via the language module's
           dictionary (data-i18n re-renders it on a language
           switch while the panel is open). */
        if(canEnter){ infoEnter.removeAttribute('data-i18n'); infoEnter.innerHTML='DIVE'; }
        else{ infoEnter.setAttribute('data-i18n','comingSoon'); infoEnter.innerHTML=(window.__espilT?window.__espilT('comingSoon'):'COMING SOON'); }
      }
      if(infoImg){infoImg.src=facts.img;infoImg.alt=marker.userData.landmark;}
      if(infoName)infoName.textContent=marker.userData.name;
      if(infoPop)infoPop.textContent='Metro population · approx '+facts.pop;
      if(infoBrands)infoBrands.innerHTML=facts.brands.map(function(b){return '<li>'+b+'</li>';}).join('');
      if(infoPanel)infoPanel.setAttribute('aria-hidden','false');
      var csEl=document.getElementById('city-status'); if(csEl)csEl.classList.add('gate-hidden'); /* Han 2026-10-16 #3: text div off while a city is selected */
      try{ if(!(history.state&&history.state.espilCityInfo))history.pushState({espilCityInfo:1},''); }catch(e){}
      updateModelCredit(marker);
      status.textContent=marker.userData.name+' — '+marker.userData.landmark;
      if(infoEnter)try{infoEnter.focus({preventScroll:true});}catch(e){}
    }
    function hideCityInfo(){ infoShown=false; if(infoPanel)infoPanel.setAttribute('aria-hidden','true'); var csEl=document.getElementById('city-status'); if(csEl)csEl.classList.remove('gate-hidden'); /* text div back on */ }
    var infoEnter=document.getElementById('city-info-enter'),infoBack=document.getElementById('city-info-back');
    /* City entry sequence (2026-10-06 QA #4): ENTER CITY starts a slow zoom toward the
       city while its name types out like the intro logo, then "press any key to enter". */
    var entryEl=document.getElementById('city-entry'),entryTyped=document.getElementById('city-entry-typed'),
        entryCaret=document.getElementById('city-entry-caret'),entrySub=document.getElementById('city-entry-sub');
    var entryActive=false,entryTypedDone=false,entrySubShown=false,entryTimers=[];
    function clearEntryTimers(){entryTimers.forEach(function(t){clearTimeout(t);});entryTimers=[];}
    var loginGateNext=null;
    function openLoginGate(prod){
      /* The login screen is an interaction, not a loading segment:
         the Dive-segment glass fades out and its driver sleeps until
         the character-confirm segment (Han 2026-10-19 #2). */
      var ldB=document.getElementById('loader');
      if(ldB&&ldB.classList.contains('seg-a')){ ldB.classList.remove('show'); ldB.classList.remove('seg-a'); ldB.classList.add('done'); }
      if(window.__espilSuspendMapLoader)window.__espilSuspendMapLoader();
      loginGateNext=function(){ entrySubShown=true; finishCityEntry(); }; /* Han 2026-10-28: no mid-flow loading bar on any host - gender follows sign-in directly; the single glass loading sequence runs at the end, after the location pick */
      /* The entry overlay (z 26) sits above the modal (z 20) and would
         swallow every click - hide it while the login gate is up. */
      if(entryEl)entryEl.setAttribute('aria-hidden','true');
      var m=document.getElementById('signin-modal');
      if(m)m.setAttribute('aria-hidden','false');
      var cs=document.getElementById('city-status'); if(cs)cs.classList.add('gate-hidden');
    }
    window.__espilLoginGatePending=function(){ return !!loginGateNext; };
    window.__espilLoginGateDone=function(){
      var n=loginGateNext; loginGateNext=null;
      var m=document.getElementById('signin-modal'); if(m)m.setAttribute('aria-hidden','true');
      var cs=document.getElementById('city-status'); if(cs)cs.classList.remove('gate-hidden');
      if(n)n();
    };
    window.__espilLoginBypass=function(){
      /* Han 2026-10-17: no backend yet - login is a pass-through. If the
         gate is armed, pass it. If an entry is in progress but the gate
         never armed (e.g. the typing chain wedged before
         maybeShowEntrySub), arm and pass in one step so the login page
         can never trap the entry. Outside an entry this is a no-op and
         the caller falls back to the informational toast. */
      if(loginGateNext){ window.__espilLoginGateDone(); return true; }
      if(entryActive){ openLoginGate(isProdHost()); window.__espilLoginGateDone(); return true; }
      return false;
    };
    window.__espilLoginGateCancel=function(){
      if(!loginGateNext)return; loginGateNext=null;
      setTimeout(function(){ cancelCityEntry(); },0);
    };
    function maybeShowEntrySub(){
      if(entryActive&&entryTypedDone&&!entrySubShown&&
         (Math.abs(orbitDistance-targetDistance)<.12||performance.now()-entryStartedAt>12000)){
        entrySubShown=true;
        /* #3 (Han 2nd QA): preload with progress bar, auto-enter (no keypress).
           On prod host, still show COMING SOON (no preload needed). */
        /* Han 2026-10-16 #6: no press-any-key stage - Dive goes straight to
           the login page; the entry continues once a provider is chosen. */
        openLoginGate(isProdHost());
      }
    }
    /* #3: Preload city assets with progress bar, then auto-enter. */
    function startCityPreload(){
      var loadingEl=document.getElementById('city-loading');
      var fillEl=document.getElementById('city-load-fill');
      var pctEl=document.getElementById('city-load-pct');
      if(loadingEl){loadingEl.classList.add('show');loadingEl.setAttribute('aria-hidden','false');}
      status.textContent='Loading '+(selected?selected.userData.name:'city')+'…';
      function setProgress(pct,label){
        if(fillEl)fillEl.style.width=pct+'%';
        if(pctEl)pctEl.textContent=Math.round(pct)+'%'+(label?' — '+label:'');
      }
      setProgress(5,'Initializing…');
      /* Stage 1: build map geometry (synchronous, but chunked to update UI) */
      setTimeout(function(){
        setProgress(20,'Building city…');
        try{
          if(typeof buildWalkMapOnce==='function')buildWalkMapOnce();
        }catch(e){console.warn('Preload map build failed:',e);}
        setProgress(50,'City built');
        /* Stage 1b: satellite imagery (async, with progress) */
        window.__satelliteProgress=function(pct){
          if(pct<0){
            /* Failed — continue without satellite */
            setProgress(55,'Satellite unavailable');
            startAvatarCheck();
          }else if(pct>=100){
            setProgress(60,'Satellite ready');
            startAvatarCheck();
          }else{
            /* Map satellite 0-100 to progress 50-60 */
            setProgress(50+pct*0.1,'Loading satellite… '+pct+'%');
          }
        };
        /* If satellite already loaded or failed, proceed */
        if(window.__satelliteReady){
          setProgress(60,'Satellite ready');
          startAvatarCheck();
        }
        var satTimeout=setTimeout(function(){
          /* Don't wait forever for satellite */
          if(!window.__satelliteReady)startAvatarCheck();
        },15000);
        var avatarStarted=false;
        function startAvatarCheck(){
          if(avatarStarted)return;avatarStarted=true;
          clearTimeout(satTimeout);
          setProgress(60,'Loading character…');
          /* Stage 2: wait for character avatar (async GLB loads) */
          var tries=0;
          function checkAvatar(){
            tries++;
            var ready=false;
            try{
              ready=!!(walkPlayer&&walkPlayer.av&&walkPlayer.av.ready);
            }catch(e){}
            var pct=Math.min(95,60+tries*1.5);
            setProgress(pct,ready?'Character ready':'Loading character…');
            if(ready||tries>60){
              setProgress(100,'Ready');
              setTimeout(function(){
                if(loadingEl)loadingEl.classList.remove('show');
                if(typeof finishCityEntry==='function')finishCityEntry();
              },400);
            }else{
              setTimeout(checkAvatar,250);
            }
          }
          setTimeout(checkAvatar,300);
        }
      },100);
    }
    var entryStartedAt=0;
    function typeEntryName(name){
      if(!entryTyped)return;
      entryTyped.innerHTML='';entryTypedDone=false;
      var spans=[],i;
      for(i=0;i<name.length;i++){
        var sp=document.createElement('span');sp.className='ch';sp.textContent=name[i];
        entryTyped.appendChild(sp);spans.push(sp);
      }
      entryTyped.appendChild(entryCaret);
      entryTyped.insertBefore(entryCaret,spans[0]||null); /* caret starts at the first letter */
      var idx=0;
      function step(){
        if(!entryActive)return;
        if(idx>=spans.length){entryTypedDone=true;maybeShowEntrySub();return;}
        spans[idx].classList.add('on');
        entryTyped.insertBefore(entryCaret,spans[idx+1]||null);
        idx++;
        entryTimers.push(setTimeout(step,95+Math.random()*95));
      }
      entryTimers.push(setTimeout(step,600));
    }
    function startCityEntry(){
      window.__espilZoomEnterArmed=false; /* ENTRY CONFIRMATION (Han 2026-11-26): an entry begun by any path spends the arm */
      if(!selected||entryActive||cityPhaseActive)return;
      if(!espilPlayableCity(selected.userData.name))return;
      var newCityKey=ESPIL_CITY_KEYS[selected.userData.name]||'vancouver';
      if(!window.__ESPIL_GAME_PAGE){
        /* Page split (Han 2026-10-20 #9): the landing page hands
           entry to the game page (served at the chosen city's
           own path - LANDING PACKAGE, Han 2026-11-25 item 3) - a real
           navigation, so the browser Back key returns to the
           landing as a page instead of stacking it over the game.
           The game page's boot poller re-selects this city and
           clicks through its ENTER button. */
        try{sessionStorage.setItem('espil_pending_city',selected.userData.name);}catch(e){}
        /* Globe dive (guide step 5, Han 2026-10-21): the Earth camera
           dives to the selected city over 2.6 s (accelerating) while
           the UI layer closes its clouds on espil-dive-start;
           navigation fires at the bottom of the dive, inside the
           cover. The game page starts covered and the character
           drops the last 25 m there (espilBeginDiveArrival). */
        try{ window.dispatchEvent(new CustomEvent('espil-dive-start',{detail:{city:newCityKey,ms:2600}})); }catch(e){}
        entryActive=true;
        hideCityInfo();
        (function(){
          var gen=++zoomStageGen;
          var fromD=targetDistance, startT=performance.now();
          (function diveTick(){
            if(gen!==zoomStageGen)return;
            var t=Math.min(1,(performance.now()-startT)/2600);
            targetDistance=fromD+(1.15-fromD)*t*t;
            if(t<1){ requestAnimationFrame(diveTick); return; }
            location.href='/'+(ESPIL_CITY_PATHS[newCityKey]||'Vancouver'); /* LANDING PACKAGE item 3: the chosen city's own path (was the hardcoded 'vancouver.html' for every city) */
          })();
        })();
        return;
      }
      if(window.__espilLoadedCityKey&&window.__espilLoadedCityKey!==newCityKey){
        /* One district per page load: switching cities reloads and
           re-selects the target city on boot (phase 1, 2026-10-16). */
        try{sessionStorage.setItem('espil_pending_city',selected.userData.name);}catch(e){}
        location.reload(); return;
      }
      window.__espilCityKey=newCityKey;
      if(window.__espilPreloadCityEntry)window.__espilPreloadCityEntry(); /* Han PC verdict 2026-10-19 #2: all city loading starts NOW, at the Dive click, in parallel with the entry gate - no dead time after the last gate step */
      /* Han 2026-10-28 (entry order ruling): NO glass over the Dive
         segment - the order is Dive, sign in/up, gender, location,
         and only then the glass loading sequence. The preload above
         still starts here and runs silently in parallel. */
      entryActive=true;entryTypedDone=false;entrySubShown=false;entryStartedAt=performance.now();
      clearZoomStages();
      if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
      hideCityInfo();
      if(window.__espilHandoffEntry){
        /* Handoff fast path (Han live-bug fix, 2026-10-21): this
           load continues a Dive (or a city switch) - the entry
           theatre already played on the previous page, so skip the
           glide and the typing, converge the orbit at once, and
           open the login gate immediately. With the cover rules
           above, the landing never repaints on this load. */
        window.__espilHandoffEntry=false;
        targetDistance=1.34; orbitDistance=1.34;
        entryTypedDone=true;
        status.textContent='Entering '+selected.userData.name+'…';
        maybeShowEntrySub();
        return;
      }
      /* Han 2026-10-30 #1: DIVE asks for login at once - no glide or
         typing theatre in front of the sign-in modal. The preload
         that started at the Dive click keeps running in parallel,
         and the single glass loading sequence still runs at the end
         of the gate chain (after the location pick). */
      targetDistance=1.34; orbitDistance=1.34;
      entryTypedDone=true;
      status.textContent='Entering '+selected.userData.name+'…';
      maybeShowEntrySub();
    }
    function finishCityEntry(){
      if(!entryActive||!entrySubShown)return;
      entryActive=false;entrySubShown=false;clearEntryTimers();
      if(entryEl)entryEl.setAttribute('aria-hidden','true');
      /* Han 2026-10-10: Vancouver goes to Mapbox version */
      /* Han 2026-10-11: COMING SOON gate removed - Vancouver accessible */
      
      activateCityPhase();
    }
    /* Production gate: espil.online / www.espil.online serve the testing-phase
       coming-soon; every other host (localhost, LAN, file) gets the full map. */
    function isProdHost(){try{return /^(www\.)?espil\.online$/.test(location.hostname);}catch(e){return false;}}
    function showComingSoon(){
      var city=document.getElementById('city-comingsoon-city');
      if(city)city.textContent=selected?selected.userData.name:'';
      var el=document.getElementById('city-comingsoon');
      if(el)el.setAttribute('aria-hidden','false');
    }
    function hideComingSoon(){
      var el=document.getElementById('city-comingsoon');
      if(el)el.setAttribute('aria-hidden','true');
    }
    function cancelCityEntry(){
      if(!entryActive)return;
      entryActive=false;entrySubShown=false;clearEntryTimers();
      if(entryEl)entryEl.setAttribute('aria-hidden','true');
      if(selected&&!cityPhaseActive){targetDistance=1.9;showCityInfo(selected);}
    }
    if(entryEl){
      entryEl.addEventListener('click',function(){finishCityEntry();});
      entryEl.addEventListener('touchend',function(e){e.preventDefault();finishCityEntry();},{passive:false});
      entryEl.addEventListener('keydown',function(e){
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelCityEntry();}
        /* stopPropagation: the document-level entry gate would otherwise see the same
           keypress with entryActive already false and fall through to its Enter branch. */
        else{e.preventDefault();e.stopPropagation();finishCityEntry();}
      });
    }
    if(infoEnter)infoEnter.addEventListener('click',function(){startCityEntry();});
    if(infoBack)infoBack.addEventListener('click',function(){if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();clearSelection(true);});
    /* Han 2026-10-16 #3: the browser back button also restores the text div. */
    window.addEventListener('popstate',function(){ if(infoShown){ if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop(); clearSelection(true); } });
    /* Coming-soon back button (2026-10-06): returns to the city info panel. */
    var csBack=document.getElementById('city-comingsoon-back');
    if(csBack)csBack.addEventListener('click',function(){
      if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
      hideComingSoon();
      if(selected&&!cityPhaseActive){targetDistance=1.9;showCityInfo(selected);}
    });
    function zoomBy(delta){
      hasInteracted=true;
      /* During city zoom, all manual zoom is locked: arrows switch city, Enter confirms, ESC exits. */
      if(selected&&!cityPhaseActive){
        if(window.__espilToast)window.__espilToast('Zoom locked \u2014 Enter confirms, ESC exits');
        return;
      }
      targetDistance=Math.max(minDistance,Math.min(maxDistance,targetDistance+delta));
      if(selected&&targetDistance>5.7)clearSelection();
    }
    canvas.addEventListener('wheel',function(event){event.preventDefault();if(cityPhaseActive){mapZoom(event.deltaY*.01);return;}zoomBy(event.deltaY*.006);},{passive:false});
    canvas.addEventListener('keydown',function(event){
      if(event.key==='+'||event.key==='='){event.preventDefault();zoomBy(-.7);}
      if(event.key==='-'||event.key==='_'){event.preventDefault();zoomBy(.7);}
    });
    canvas.addEventListener('pointerdown',function(event){
      if(cityPhaseActive){mapPointerDown(event);return;}
      if(event.cancelable)event.preventDefault();
      hasInteracted=true;dragging=true;moved=false;lastX=event.clientX;lastY=event.clientY;
      canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove',function(event){
      if(cityPhaseActive){mapPointerMove(event);return;}
      if(dragging){
        if(event.cancelable)event.preventDefault();
        var dx=event.clientX-lastX,dy=event.clientY-lastY;
        if(Math.abs(dx)+Math.abs(dy)>2){
          moved=true;
          if(selected&&cityPhaseActive){
            navigationHeading.applyAxisAngle(navigationNormal,-dx*.0045).normalize();
            targetDistance=Math.max(minDistance,Math.min(3.38,targetDistance+dy*.004));
          }else if(selected){
            /* City zoom is locked: swipes don't change the view. Enter confirms, ESC exits. */
          }else{
            targetYaw-=dx*.006;
            targetPitch=Math.max(-1.28,Math.min(1.28,targetPitch+dy*.0045));
          }
        }
        lastX=event.clientX;lastY=event.clientY;
      }else hoverCity(pick(event));
    });
    canvas.addEventListener('pointerup',function(event){
      if(cityPhaseActive){mapPointerUp(event);return;}
      dragging=false;canvas.classList.remove('is-dragging');canvas.releasePointerCapture(event.pointerId);
      if(!moved){if(window.__espilIntroActive)return;var hit=pick(event);if(hit)selectCity(hit.object);}
      else if(!window.__espilIntroActive&&!cityPhaseActive&&!selected){
        /* The text div always matches the map: after a manual rotate, re-sync the reel. */
        var facing=nearestFacingMarker();
        if(facing&&facing!==centeredMarker){centerReel(facing,false);navIndex=markers.indexOf(facing);}
      }
      canvas.style.cursor='grab';
    });
    canvas.addEventListener('pointercancel',function(){dragging=false;canvas.classList.remove('is-dragging');});
    canvas.addEventListener('pointerleave',function(){if(!dragging)hoverCity(null);});

    /* Own every touch that begins on the globe. This non-passive document guard is the
       WebKit fallback when CSS overscroll-behavior alone does not stop pull-to-refresh. */
    var globeTouchActive=false;
    canvas.addEventListener('touchstart',function(){globeTouchActive=true;},{passive:true});
    document.addEventListener('touchmove',function(event){if(globeTouchActive&&event.cancelable)event.preventDefault();},{passive:false});
    document.addEventListener('touchend',function(){globeTouchActive=false;},{passive:true});
    document.addEventListener('touchcancel',function(){globeTouchActive=false;},{passive:true});

    var pinchDistance=0;
    frame.addEventListener('touchstart',function(event){if(event.touches.length===2){var dx=event.touches[0].clientX-event.touches[1].clientX,dy=event.touches[0].clientY-event.touches[1].clientY;pinchDistance=Math.sqrt(dx*dx+dy*dy);}}, {passive:true});
    frame.addEventListener('touchmove',function(event){if(event.touches.length===2&&pinchDistance){event.preventDefault();hasInteracted=true;var dx=event.touches[0].clientX-event.touches[1].clientX,dy=event.touches[0].clientY-event.touches[1].clientY,next=Math.sqrt(dx*dx+dy*dy);if(cityPhaseActive){mapZoom(-(next-pinchDistance)*.05);}else{zoomBy(-(next-pinchDistance)*.012);}pinchDistance=next;}}, {passive:false});
    frame.addEventListener('touchend',function(){pinchDistance=0;},{passive:true});

    var worldPoint=new THREE.Vector3(),cameraDirection=new THREE.Vector3();
    function shortestAngle(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
    /* QA #7 (2026-10-09): minimap draw — player-centered, buildings from mapBuildings. */
    /* QA #7 (2026-10-09, Han): 3-stage Leaflet map — minimap → district → fullscreen.
       OSM tiles, +/- zoom, M key cycles stages. Game units = meters, center 49.2827,-123.1207. */
    var leafletMap=null,playerMarker=null,mapStage=1,lastMapCenter=0;
    var MAP_CENTER_LAT=49.2827,MAP_CENTER_LNG=-123.1207;
    /* Han 2026-10-10: Cauldron minimap (Mapbox) — replaces Leaflet */
    var mapboxMinimap=null, mapboxMarker=null;
    var CAULDRON_MINIMAP_LEVELS=[
      {label:'50m', zoom:18.35},
      {label:'100m', zoom:17.35},
      {label:'500m', zoom:15.05},
      {label:'1km', zoom:14.05},
      {label:'5km', zoom:11.75},
    ];
    var minimapLevelIdx=1; // 100m default
    function gameToLatLng(x,z){
      var lat=MAP_CENTER_LAT+(-z/111320);
      var lng=MAP_CENTER_LNG+(x/(111320*Math.cos(MAP_CENTER_LAT*Math.PI/180)));
      return [lat,lng];
    }
    /* ==== MINIMAP THEME (Mapbox navigation day/night) - BEGIN ====
       Han 2026-11-25 15:39 (option 1, decided): the minimap follows
       the game's clock - Mapbox NAVIGATION DAY tiles by day,
       NAVIGATION NIGHT tiles by night. Route B (census
       minimap-theme/CENSUS.md): the Leaflet map, its markers,
       stages and zoom ladder are untouched; only the TILE SUPPLY
       changes. The 2026-10-12 move to Leaflet + OSM happened
       because the in-code token was a placeholder; the token now
       arrives through the same channel the world map uses
       (window.__ESPIL_ENV__, read via espilP1Token() once
       __ESPIL_ENV_READY__ resolves), so the OSM layer stays as
       the permanent no-token floor: the minimap opens on OSM
       exactly as today, and if the token is empty, errors or
       never lands, OSM is what ships - never a blank box.
       Driver: window.__espilNightState().factor ONLY (the same
       hemisphere-derived state the night glow and the ground
       tint read; 0 = day, 1 = night plateau, forced 0 indoors).
       The swap is binary, so it borrows the glow pattern's
       hysteresis pair verbatim: night tiles at factor >= 0.45,
       day tiles back at factor <= 0.30 - between the two the
       current tiles stay, so dawn/dusk shimmer cannot flap the
       layer. The check rides updateLeafletMap's existing 200 ms
       cadence; a swap adds the new tile layer before removing
       the old one, so the frame is never empty, and markers
       (player dot, peer dots, the Konbiniya badge) live in the
       marker pane above the tile pane and are never touched.
       Tiles: the styles v1 endpoint serves 512 px tiles on the
       bare /tiles/{z}/{x}/{y} form (measured 2026-11-25), so the
       layers use the standard tileSize 512 + zoomOffset -1 pair -
       the ground scale on screen is exactly today's 256 px OSM
       read, only sharper. Attribution: the map was created with
       attributionControl:false and the tiles carried none; the
       theme adds Leaflet's attribution control (prefix off) and
       drives its string manually on every swap - Leaflet's own
       per-layer attribution tracking was measured in the rig to
       keep a removed layer's credit on the control (both credits
       showed after a swap), so the layers carry no attribution
       option and espilMinimapSetTiles moves the string itself:
       the frame credits exactly the ACTIVE source (Mapbox + OSM
       on Mapbox tiles, OSM alone on the fallback). */
    var ESPIL_MINIMAP_STYLE_DAY='navigation-day-v1', ESPIL_MINIMAP_STYLE_NIGHT='navigation-night-v1';
    var ESPIL_MINIMAP_NIGHT_ON=0.45, ESPIL_MINIMAP_NIGHT_OFF=0.30;
    var ESPIL_MINIMAP_ATTR_OSM='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
    var ESPIL_MINIMAP_ATTR_MB='&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    var espilMinimapTheme={mode:'osm',layer:null,osm:null,mbDay:null,mbNight:null,mbReady:false,armed:false,f:-1,swaps:0,attr:null,attrCtl:null};
    function espilMinimapTilesUrl(style,tok){
      return 'https://api.mapbox.com/styles/v1/mapbox/'+style+'/tiles/{z}/{x}/{y}?access_token='+tok;
    }
    function espilMinimapSetTiles(layer,mode){
      var T=espilMinimapTheme;
      if(!leafletMap||!layer||T.layer===layer)return;
      layer.addTo(leafletMap); /* new layer first: no blank frame while it loads */
      if(T.layer)leafletMap.removeLayer(T.layer);
      T.layer=layer; T.mode=mode; T.swaps++;
      if(T.attrCtl){
        var wantAttr=(mode==='osm')?ESPIL_MINIMAP_ATTR_OSM:ESPIL_MINIMAP_ATTR_MB;
        if(T.attr&&T.attr!==wantAttr)T.attrCtl.removeAttribution(T.attr);
        if(T.attr!==wantAttr)T.attrCtl.addAttribution(wantAttr);
        T.attr=wantAttr;
      }
    }
    function espilMinimapThemeTick(force){
      var T=espilMinimapTheme;
      if(!leafletMap||!T.mbReady)return;
      var st=null;
      try{ st=window.__espilNightState?window.__espilNightState():null; }catch(e){}
      if(!st||typeof st.factor!=='number'||st.factor<0)return;
      var f=st.factor; if(f>1)f=1;
      T.f=f;
      var night=(T.mode==='night')?(f>ESPIL_MINIMAP_NIGHT_OFF):(f>=ESPIL_MINIMAP_NIGHT_ON);
      var want=night?'night':'day';
      if(!force&&want===T.mode)return;
      espilMinimapSetTiles(night?T.mbNight:T.mbDay,want);
    }
    function espilMinimapThemeArm(){
      var T=espilMinimapTheme;
      if(T.armed)return;
      T.armed=true;
      var build=function(){
        if(T.mbReady||!leafletMap)return;
        var tok='';
        try{ tok=(typeof espilP1Token==='function')?String(espilP1Token()||''):''; }catch(e){}
        if(!tok)return; /* no token: OSM stays - the fallback IS the shipped behaviour */
        T.mbDay=L.tileLayer(espilMinimapTilesUrl(ESPIL_MINIMAP_STYLE_DAY,tok),{tileSize:512,zoomOffset:-1,maxZoom:19});
        T.mbNight=L.tileLayer(espilMinimapTilesUrl(ESPIL_MINIMAP_STYLE_NIGHT,tok),{tileSize:512,zoomOffset:-1,maxZoom:19});
        T.mbReady=true;
        espilMinimapThemeTick(true);
      };
      try{ (window.__ESPIL_ENV_READY__||Promise.resolve()).then(build,build); }catch(e){}
      build(); /* the env may already be populated - init can run after it landed */
    }
    window.__espilMinimapThemeState=function(){
      var T=espilMinimapTheme;
      var url=(T.layer&&T.layer._url)?String(T.layer._url):null;
      if(url)url=url.replace(/access_token=[^&]+/,'access_token=*');
      return {mode:T.mode,mbReady:T.mbReady,f:T.f,swaps:T.swaps,url:url};
    };
    /* ==== MINIMAP THEME - END ==== */
    function initLeafletMap(){
      /* 2026-10-12 fix (Han): the Mapbox minimap never rendered — the access
         token in code was the '__PUT_YOUR_MAPBOX_TOKEN_HERE__' placeholder
         (build_inject_tokens.py only patches cauldron/static-config.js, not
         this file), so the style request failed and the box stayed blank.
         The minimap now uses Leaflet + OpenStreetMap tiles: free, no token. */
      if(leafletMap||typeof L==='undefined')return;
      var el=document.getElementById('minimap');
      if(!el)return;
      leafletMap=L.map('minimap',{zoomControl:false,attributionControl:false,doubleClickZoom:false,scrollWheelZoom:false});
      /* MINIMAP THEME (2026-11-25): the OSM layer is created exactly
         as before and stays the floor - the Mapbox navigation pair
         replaces it only once the token lands (espilMinimapThemeArm),
         and any token failure leaves this layer up for good. */
      espilMinimapTheme.osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19});
      espilMinimapTheme.osm.addTo(leafletMap);
      espilMinimapTheme.layer=espilMinimapTheme.osm;
      espilMinimapTheme.attrCtl=L.control.attribution({prefix:false}).addTo(leafletMap);
      espilMinimapTheme.attrCtl.addAttribution(ESPIL_MINIMAP_ATTR_OSM);
      espilMinimapTheme.attr=ESPIL_MINIMAP_ATTR_OSM;
      espilMinimapThemeArm();
      var ll0=gameToLatLng(3,31);
      leafletMap.setView(ll0,CAULDRON_MINIMAP_LEVELS[minimapLevelIdx].zoom);
      playerMarker=L.marker(ll0,{interactive:false,icon:L.divIcon({className:'',
        html:'<div style="width:16px;height:16px;border-radius:50%;background:#4f7ed9;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);"></div>',
        iconSize:[16,16],iconAnchor:[8,8]})}).addTo(leafletMap);
      /* Batch D9 (Han 2026-11-03): the Konbiniya carries a distinct
         "?" marker on the map - this one Leaflet map serves the
         small minimap stages and the fullscreen stage alike, so the
         marker shows on both, at every zoom. Placed with the
         world's own gameToLatLng transform of the Konbiniya anchor
         (lat 49.2827 + (-z)/111320, lng -123.1207 + x/(111320 *
         cos(49.2827 deg))). */
      try{
        var kbLL=gameToLatLng(ESPIL_KONBINIYA.x,ESPIL_KONBINIYA.z);
        L.marker(kbLL,{interactive:false,icon:L.divIcon({className:'espil-kb-q',html:'<div style="width:22px;height:22px;border-radius:50%;background:#ffb020;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.55);color:#5a3200;font:800 14px/18px Manrope,sans-serif;text-align:center;">?</div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(leafletMap);
      }catch(e){}
      var zin=document.getElementById('map-zoom-in');
      var zout=document.getElementById('map-zoom-out');
      if(zin)zin.onclick=function(){
        minimapLevelIdx=Math.min(CAULDRON_MINIMAP_LEVELS.length-1,minimapLevelIdx+1);
        if(leafletMap)leafletMap.setZoom(CAULDRON_MINIMAP_LEVELS[minimapLevelIdx].zoom);
      };
      if(zout)zout.onclick=function(){
        minimapLevelIdx=Math.max(0,minimapLevelIdx-1);
        if(leafletMap)leafletMap.setZoom(CAULDRON_MINIMAP_LEVELS[minimapLevelIdx].zoom);
      };
      /* The wrap is display:none until in-map; Leaflet needs a size refresh
         once it becomes visible. */
      setTimeout(function(){if(leafletMap)leafletMap.invalidateSize();},350);
      setTimeout(function(){if(leafletMap)leafletMap.invalidateSize();},1500);
    }
    function updateLeafletMap(){
      if(!leafletMap||!walkPlayer||!walkPlayer.pos)return;
      var now=performance.now();
      if(now-lastMapCenter<200)return;
      lastMapCenter=now;
      espilMinimapThemeTick(false); /* MINIMAP THEME: day/night tile check on the same 200 ms cadence */
      var ll=gameToLatLng(walkPlayer.pos.x,walkPlayer.pos.z);
      leafletMap.setView(ll,leafletMap.getZoom(),{animate:false});
      if(playerMarker)playerMarker.setLatLng(ll);
    }
    /* Orientation is NEVER forced (Han 2026-11-05, correcting the
       2026-10-12 landscape lock): the old tryLandscapeLock() requested
       fullscreen plus an orientation lock to landscape on the ENTER
       CITY (DIVE) tap - the screen rotated on the tap and released
       again on the /vancouver navigation. It is removed outright:
       portrait stays portrait, landscape stays landscape, both pages. */
    function espilMinimapResize(){
      if(leafletMap){ try{ leafletMap.invalidateSize(); }catch(e){} }
    }
    var espilMinimapResizeT=null;
    window.addEventListener('resize',function(){
      if(espilMinimapResizeT)clearTimeout(espilMinimapResizeT);
      espilMinimapResizeT=setTimeout(espilMinimapResize,200);
    });
    function setMapStage(s){
      mapStage=Math.max(1,Math.min(3,s));
      var wrap=document.getElementById('minimap-wrap');
      if(wrap)wrap.setAttribute('data-stage',String(mapStage));
      if(leafletMap){
        /* Resize fix (2026-10-17, Han PC round 2 item 3): the single 320 ms
           call raced the .3 s CSS size transition - any main-thread jank
           made Leaflet lock in a mid-transition size and nothing ever
           re-measured, so the fullscreen stage stayed small. Re-measure on
           transition end plus a short ladder, and on window resize. A
           correct measure is also what makes Leaflet fetch the tiles the
           bigger stage needs. */
        if(wrap)wrap.addEventListener('transitionend',espilMinimapResize,{once:true});
        setTimeout(espilMinimapResize,60);
        setTimeout(espilMinimapResize,350);
        setTimeout(espilMinimapResize,800);
      }
    }
    function cycleMapStage(){
      /* Mobile revert (Han 2026-11-04): the Batch E coarse-pointer
         1<->3 toggle, the tap-to-expand handler and the minimize
         button are REMOVED - one stage ladder for every pointer. */
      setMapStage(mapStage>=3?1:mapStage+1);
    }
    var lastFrameT=performance.now();
    function animate(){
      requestAnimationFrame(animate);
      espilOccludeTick(); /* retired wall-dither tick (Han 2026-11-26 item 7): a disarmed stub kept for the probe seam */
      var nowMs=performance.now();
      var dt=Math.min(.05,(nowMs-lastFrameT)/1000);lastFrameT=nowMs;
      /* HIT STOP (Han 2026-11-17): the shared deadline - while it
         runs, the world's dt is 0 (lastFrameT already advanced, so
         the first frame after the stop is a normal frame, never a
         catch-up jump). Scope switch: ESPIL_HIT_STOP_SCOPE. */
      if(ESPIL_HIT_STOP_SCOPE==='world'&&nowMs<(window.__espilHitStopUntil||0))dt=0;
      if(cityPhaseActive){
        /* Walkable downtown map owns the frame. */
        updateWalkMap(dt,nowMs/1000);
        espilWaterScrollTick(dt); /* water texture drift (Han 2026-11-26 item 6a) */
        if(walkPlayer)espilPaintAnchor.set(walkPlayer.pos.x,walkPlayer.pos.z);
        if(typeof ESPIL_P1!=='undefined'&&ESPIL_P1)espilP1PaintUpdate(); /* extrusion paint pass (zoom LOD) gate */
        espilP1Tick(); /* MAPBOX PHASE 1 tick */
        espilGlobeU.pole.value.copy(walkPlayer.pos);
        if(typeof EspilFader!=='undefined')EspilFader.tick(dt,mapCamera,walkPlayer);
        updateMapSky();
        updateProps();
        updateTraffic(dt);
        if(typeof updateTrafficLightVisuals==='function')updateTrafficLightVisuals();
        updateLeafletMap();
        if(espilP1.layerLive&&espilP1.map&&!espilP1.failed){ /* CUSTOM LAYER: mapScene is drawn inside the map's render pass this frame - the game's own context stays idle (CarInMap conversion, 2026-10-17) */ }
        else renderer.render(mapScene,mapCamera);
        return;
      }
      /* Camera: plain orbit framing (the station reveal was removed 2026-10-06, per Han). */
      {
        yaw+=shortestAngle(yaw,targetYaw)*.075;
        pitch+=(targetPitch-pitch)*.075;
        orbitDistance+=(targetDistance-orbitDistance)*(selected&&approachSlow&&!cityPhaseActive?.03:.075);
        updateCameraView();
        cameraDirection.copy(camera.position).normalize();
      }
      markers.forEach(function(marker,index){
        marker.getWorldPosition(worldPoint);
        var facing=worldPoint.clone().normalize().dot(cameraDirection)>.08;
        marker.visible=!cityPhaseActive&&facing;
        /* Constant landmark size regardless of zoom; half size while its city is zoomed. No hover scaling. */
        marker.scale.setScalar(marker.userData.baseScale*(marker===selected?.5:1));
      });
      updateCityPins(); /* HTML pins follow the markers (2026-10-06, per Han) */
      if(entryActive)maybeShowEntrySub();
      if(selected&&!cityPhaseActive&&!infoShown&&!gateActive&&!entryActive&&performance.now()-cityApproachStarted>1200&&(Math.abs(orbitDistance-targetDistance)<.09||performance.now()-cityApproachStarted>9000)){
        /* ENTRY CONFIRMATION (Han 2026-11-26, directive 1): when the
           entry flow has armed a confirmed zoom-in, the approach's
           arrival IS the entry - spend the arm on startCityEntry
           instead of painting the info panel. Unarmed arrivals keep
           the panel exactly as before (native reel picks, the
           direct-entry and handoff paths). */
        if(window.__espilZoomEnterArmed){ window.__espilZoomEnterArmed=false; startCityEntry(); }
        else showCityInfo(selected);
      }
      renderer.render(scene,camera);
    }
    /* Hooks for the intro + city info panel scripts. */
    window.__espilGlobe={
      beginEarthReveal:function(){
        /* Seamless entry (2026-10-06, per Han): the camera starts high and far,
           then descends — Earth rises into view as the intro fades.
           (2026-10-09, Han 2차 QA #1): the descent was hidden behind the intro
           fade, so Earth "suddenly appeared". Now staged: jump to far/high
           while the intro is still opaque, then visibly pan down AFTER the
           0.8s fade completes. */
        var defaultD=Math.max(6.6,2.12/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
        /* Phase 1 — hidden behind the opaque intro: park far and high. */
        orbitDistance=defaultD*1.6;targetDistance=defaultD*1.6;
        pitch=.9;targetPitch=.9;targetYaw=yaw;
        placeCamera();
        /* Phase 2 — after the intro fade: visible pan down to Earth. */
        setTimeout(function(){
          targetDistance=defaultD;
          targetPitch=0;
        },900);
      },
      skipStationReveal:function(){/* no-op: the station reveal no longer exists */}
    };
    /* Cross-script city selection (2026-10-16): markers and
       selectCity live inside THIS IIFE, but the intro script (a
       separate <script>) drives both automatic entries - the
       /vancouver direct entry and the pending-city switch after a
       reload. Its typeof markers checks were 'undefined' forever,
       so neither automatic entry EVER fired and only manual reel
       clicks entered a city (found via the Auckland switch QA).
       This window function is the sanctioned crossing. */
    window.__espilSelectCityByName=function(name){
      if(typeof markers==='undefined'||!markers.length)return false;
      for(var i=0;i<markers.length;i++){
        if(markers[i].userData&&markers[i].userData.name===name){ selectCity(markers[i]); return true; }
      }
      return false;
    };
    /* Fix batch 8 item 5 (Han 2026-11-14) - MINIMAL DELTA, this
       hook only. The landing flow's city layer (entry-flow.js)
       lists its own buttons and hides this reel's, so
       updateReelCenter() above - the driver that turned the Earth
       to face the centred city (2026-10-06) - never sees the
       flow's centred city and the globe stopped following the
       swipe. This hook re-exposes exactly that facing step for
       the flow's centre tracker: same marker-direction math, same
       targets, same guards (no facing while a city is selected /
       entering), same intro-safe zoom. It selects nothing. */
    /* ENTRY CONFIRMATION (Han 2026-11-26, directive 1): the entry
       flow's zoom-phase cancel. Disarms the pending zoom-entry and
       returns the globe to orbit through the native clear - the
       same path the info panel's Back row takes. Inert when no
       selection stands or an entry / city phase is already live. */
    window.__espilGlobeCancelZoomEnter=function(){
      window.__espilZoomEnterArmed=false;
      if(selected&&!cityPhaseActive&&!entryActive)clearSelection(true);
    };
    window.__espilGlobeFaceCity=function(name){
      if(typeof markers==='undefined'||!markers.length)return false;
      if(selected||entryActive||cityPhaseActive)return false;
      for(var i=0;i<markers.length;i++){
        if(markers[i].userData&&markers[i].userData.name===name){
          var cityDir=markers[i].position.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0),earthSpin.rotation.y);
          targetYaw=Math.atan2(cityDir.x,cityDir.z);
          targetPitch=Math.asin(Math.max(-1,Math.min(1,cityDir.y)));
          if(!window.__espilIntroActive)targetDistance=4.2;
          return true;
        }
      }
      return false;
    };
    animate();
  }());
  