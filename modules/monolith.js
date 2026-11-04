
  (function(){
    var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var status=document.getElementById('city-message');
    /* Han 2026-10-16 (landing text rules): the landing message line
       carries the CITY NAME ONLY - no status copy, no hints, no
       loading or progress text. Every existing status write is
       funnelled through this setter and rendered as the current
       city name (selected city, else the reel-centred city, else
       Vancouver). */
    (function(){
      if(!status)return;
      var d=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
      if(!d||!d.set)return;
      function landingCityName(){
        var m=null;
        if(typeof selected!=='undefined'&&selected)m=selected;
        else if(typeof centeredMarker!=='undefined'&&centeredMarker)m=centeredMarker;
        return (m&&m.userData&&m.userData.name)||'Vancouver';
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
    var ESPIL_SELECTABLE_CITIES={'Tokyo':true,'Vancouver':true,'New York':true,'Paris':true,'London':true,'Auckland':true};
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
      if(window.__espilCustMergeGate && window.__espilCustMergeGate()){ return; } /* Han 2026-10-30: character creation is the Character Customizer room's v3 window (embedded by the custmerge module); the pair's basic choice below remains as its fallback */
      var saved=null;
      try{saved=window.localStorage.getItem('espil_character');}catch(e){}
      if(saved){ espilApplyAvatarGender(espilSavedGender()); } /* Han 2026-10-30 #2: the character screen opens after EVERY login, guests included - a returning traveler's saved gender and look come pre-selected below, so ENTER simply continues. */
      var panel=document.getElementById('char-custom');
      var note=document.getElementById('char-bypass');
      var csub=panel?panel.querySelector('.char-sub'):null;
      if(csub)csub.textContent=(window.__espilT?window.__espilT('charSub').replace('{city}',espilCityDisplayName()):'Your traveler for '+espilCityDisplayName()+'.');
      setChosen(saved?espilSavedGender():'male');
      if(note)note.hidden=true; /* no auto-entry note in the production flow */
      if(panel)panel.setAttribute('aria-hidden','false');
      if(window.EspilAudio&&window.EspilAudio.pop)window.EspilAudio.pop();
      /* Production flow (Han 2026-10-18): the player CHOOSES male or
         female and presses ENTER - no timed auto-confirm. */
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
    function confirmCharacter(gender){
      try{var __rec={gender:gender,ts:Date.now()}; try{var __lk=window.__espilPendingLook?window.__espilPendingLook():null; if(__lk)__rec.look=__lk;}catch(_){} window.localStorage.setItem('espil_character',JSON.stringify(__rec));}catch(e){} /* customizer look rides the character record (Han 2026-10-28) */
      espilApplyAvatarGender(gender); /* the preload may have built the other gender's avatar before this first-time pick */
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
      if(male)male.addEventListener('click',function(){setChosen('male');if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();});
      if(female)female.addEventListener('click',function(){setChosen('female');if(window.EspilAudio&&window.EspilAudio.tick)window.EspilAudio.tick();});
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
    var trafficCars=[],carTextures=[],carColliders=[]; /* hoisted from buildWalkMapOnce (2026-10-08): used by collideCircleAxis/updateWalkMap */
    var updateTrafficCars=function(dt){}; /* replaced by buildWalkMapOnce */
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
    var walkCamYaw=0,walkCamPitch=.84,walkCamDist=14; /* Cauldron style: 48° pitch */
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
    function updateBuildingProximity(px,pz,nowMs){
      var bldgNameEl=document.getElementById('building-name');
      var bldgNameText=document.getElementById('building-name-text');
      var interactEl=document.getElementById('interact-prompt');
      if(!bldgNameEl||!bldgNameText)return;
      if(nowMs-nearCheckT<400)return; /* throttle: 2.5 checks/sec */
      nearCheckT=nowMs;
      var best=null,bestD=1e9;
      for(var i=0;i<mapBuildings.length;i++){
        var b=mapBuildings[i];
        var dx=px-b.x,dz=pz-b.z;
        var d=Math.sqrt(dx*dx+dz*dz)-Math.max(b.w,b.d)/2;
        if(d<bestD){bestD=d;best=b;}
      }
      if(best&&bestD<14){
        /* Han: don't show pill/prompt while store modal is open */
        var sm=document.getElementById('store-modal');
        var modalOpen=sm&&!sm.classList.contains('hidden');
        if(nearBldg!==best){
          nearBldg=best;
          bldgNameText.textContent='Locating…';
          if(!modalOpen){
            bldgNameEl.classList.remove('hidden');
            if(interactEl)interactEl.classList.remove('hidden'); /* QA #8: interact active */
          }
          fetchBuildingName(best,function(nm){
            if(nearBldg===best)bldgNameText.textContent=nm;
          });
        }
      }else{
        nearBldg=null;
        bldgNameEl.classList.add('hidden');
        if(interactEl)interactEl.classList.add('hidden');
      }
      /* P1: the interact prompt follows the tight record gate, not
         the loose centre rule above (the name pill keeps its own). */
      if(interactEl&&typeof ESPIL_P1!=='undefined'&&ESPIL_P1){
        var sm2=document.getElementById('store-modal');
        var modalOpen2=sm2&&!sm2.classList.contains('hidden');
        if(!modalOpen2&&espilRecordDistAt(px,pz)<=2)interactEl.classList.remove('hidden');
        else if(!modalOpen2)interactEl.classList.add('hidden');
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
      return {x:3,z:31};
    }
    function espilResolveSpawn(geo){
      if(!espilCityCfg().core){ var sp=espilCityCfg().spawn; return {x:sp.x,z:sp.z}; } /* offset city: every fresh entry starts at its entry point (phase 1) */
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
    /* --- geolocation pre-prompt (fresh entries only, during the fall) --- */
    var espilGeoEl=null;
    function espilHideGeoPrompt(){ if(espilGeoEl){espilGeoEl.style.display='none';} }
    function espilShowGeoPrompt(){
      if(espilGeoEl){espilGeoEl.style.display='block';return;}
      var d=document.createElement('div');
      d.style.cssText='position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:65;display:block;background:rgba(10,14,20,.9);color:#e8eef4;padding:12px 16px;border-radius:12px;font:500 .85rem "Manrope",sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.45);';
      d.innerHTML='<div style="margin-bottom:9px;">Start from your real location?</div>';
      var b1=document.createElement('button');
      b1.textContent='\uD83D\uDCCD Use my location';
      b1.style.cssText='margin-right:8px;padding:7px 12px;border-radius:8px;border:0;background:#e8b34a;color:#14100a;font:600 .82rem "Manrope",sans-serif;cursor:pointer;';
      var b2=document.createElement('button');
      b2.textContent='Start downtown';
      b2.style.cssText='padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:transparent;color:#e8eef4;font:600 .82rem "Manrope",sans-serif;cursor:pointer;';
      b1.onclick=function(){
        espilHideGeoPrompt();
        if(!navigator.geolocation)return;
        navigator.geolocation.getCurrentPosition(function(pos){
          var p=walkPlayer; if(!p||!p._espilArrive)return; /* arrival over - too late to retarget */
          var gx=(pos.coords.longitude+123.1207)*111320*Math.cos(49.2827*Math.PI/180);
          var gz=-(pos.coords.latitude-49.2827)*111320;
          var pt=espilResolveSpawn({x:gx,z:gz});
          p.pos.x=pt.x; p.pos.z=pt.z;
          if(p._espilArrive)p._espilArrive.surf=null; /* re-probe at the new target */
        },function(){}, {timeout:8000,maximumAge:60000});
      };
      b2.onclick=function(){ espilHideGeoPrompt(); };
      d.appendChild(b1); d.appendChild(b2);
      document.body.appendChild(d);
      espilGeoEl=d;
      setTimeout(espilHideGeoPrompt,25000);
    }
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
       the old descent envelope (60 -> 14) on a timer, which also
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
      espilShowGeoPrompt();
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
      walkCamDist=60; /* wide sky framing; the step eases it to 14 */
      if(typeof espilP1!=='undefined'&&espilP1)espilP1.zoomDrive=false; /* the arrival envelope leads the map zoom for this entry */
      espilShowGeoPrompt();
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
        var fd=1-td; walkCamDist=14+46*fd*fd;
        if(td>=1){ p._espilArrive=null; walkCamDist=14; espilHideGeoPrompt(); }
        return;
      }
      var now=performance.now();
      if(now-a.probeAt>150){ a.probeAt=now; var y=espilTileBase(p.pos.x,p.pos.z); if(y===null)y=espilOwnSurfaceY(p.pos.x,p.pos.z); if(y!==null&&y!==undefined)a.surf=y; }
      if(a.surf!==null&&a.surf!==undefined){ p.pos.y=a.surf; p.onGround=true; }
      var t=Math.max(0,Math.min(1,(now-a.startedAt)/a.dur));
      var f=1-t; walkCamDist=14+46*f*f;
      if(t>=1){
        p._espilArrive=null;
        walkCamDist=14;
        espilHideGeoPrompt();
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
      vancouver:{district:'assets/osm/vancouver_district_sample.json',collision:'assets/osm/vancouver_collision.json',ox:0,oz:0,core:true,bounds:{x0:-1799,z0:-2028,x1:2027,z1:1956},spawn:{x:3,z:31}}, /* bounds = the district extent, added 2026-10-19 for the last-place resume rule (Han PC verdict #9): resume judges the full playable extent, not the smaller downtown boundary polygon. First-summon place (Han 2026-10-18): the Vancouver Art Gallery's Robson Square plaza - gallery record bbox x[-46.9..52.9] z[-57.6..16.8], the point sits 14.2 m south of its south face on its centre axis, inside no footprint */
      auckland:{district:'assets/osm/auckland_district.json',collision:'assets/osm/auckland_collision.json',ox:10000,oz:0,core:false,spawn:{x:10302.9,z:-1001.9},bounds:{x0:9243,z0:-1595,x1:11024,z1:1080},harbour:{w:3600,d:1750,dx:140,dz:-1865}},
      tokyo:{district:'assets/osm/tokyo_district.json',collision:'assets/osm/tokyo_collision.json',ox:5000,oz:0,core:false,spawn:{x:4870,z:0},bounds:{x0:3010,z0:-2032,x1:7034,z1:2011}}, /* Tokyo (built 2026-10-18, restored to this tree 2026-10-19 after the production-mirror reset): OSM extract radius 2 km on Tokyo Station (35.68124, 139.76714), 18,002 buildings; spawn = local (-130, 0), the Marunouchi plaza in front of the station, 15.5 m clear of every footprint */
      newyork:{district:'assets/osm/newyork_district.json',collision:'assets/osm/newyork_collision.json',ox:-5000,oz:0,core:false,spawn:{x:-5000,z:0},bounds:{x0:-6906,z0:-2063,x1:-2972,z1:2058}}, /* New York (2026-10-19): OSM extract radius 2 km on Times Square (40.75800, -73.98554), 9,020 buildings; spawn = local (0, 0), the Times Square pedestrian plaza at the anchor itself, 17.8 m clear of every footprint (offline scan of the shipped district records) */
      paris:{district:'assets/osm/paris_district.json',collision:'assets/osm/paris_collision.json',ox:-10000,oz:0,core:false,spawn:{x:-10000,z:0},bounds:{x0:-12016,z0:-2049,x1:-7946,z1:2042}}, /* Paris (2026-10-19): OSM extract radius 2 km on the Trocadero (48.86272, 2.28756), 11,957 buildings; spawn = local (0, 0), the Trocadero parvis at the anchor itself, 42.8 m clear of every footprint (offline scan of the shipped district records); about half of Paris footprints carry no OSM height tag, so many fall back to the default height */
      london:{district:'assets/osm/london_district.json',collision:'assets/osm/london_collision.json',ox:0,oz:-10000,core:false,spawn:{x:0,z:-10000},bounds:{x0:-1996,z0:-12051,x1:2074,z1:-7957}} /* London (2026-10-19): OSM extract radius 2 km on Trafalgar Square (51.50804, -0.12807), 13,911 buildings; spawn = local (0, 0), the square's centre between the fountains at the anchor itself, 22.5 m clear of every footprint (offline scan of the shipped district records); most London footprints carry no OSM height tag (86% in the default band), so the skyline reads flatter than the real city - height enrichment is future work */
    };
    function espilCityKey(){ var k=window.__espilCityKey||'vancouver'; return ESPIL_CITIES[k]?k:'vancouver'; }
    function espilCityCfg(){ return ESPIL_CITIES[espilCityKey()]; }
    var ESPIL_CITY_KEYS={'Vancouver':'vancouver','Auckland':'auckland','Tokyo':'tokyo','New York':'newyork','Paris':'paris','London':'london'};
    var ESPIL_CITY_DISPLAY={vancouver:'Vancouver Downtown',auckland:'Auckland',tokyo:'Tokyo',newyork:'New York',paris:'Paris',london:'London'};
    function espilCityDisplayName(){ return ESPIL_CITY_DISPLAY[espilCityKey()]||'Vancouver Downtown'; }
    /* Ground for offset cities (Auckland phase 1): a land plane under
       the district plus a harbour plane north of the waterfront
       street. Gameplay reads the stored collision map; these planes
       are the visual surface only. */
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
        var wmat=new THREE.MeshLambertMaterial({color:0x2a6a9e,transparent:true,opacity:.92});         var water=new THREE.Mesh(new THREE.PlaneGeometry(cfg.harbour.w,cfg.harbour.d,32,8),wmat);
        water.rotation.x=-Math.PI/2; water.position.set(cfg.ox+cfg.harbour.dx,0.02,cfg.oz+cfg.harbour.dz);
        water.receiveShadow=true; water.frustumCulled=false; mapScene.add(water);
      }
    }
    function loadEspilDistrict(){
      if(espilDistrict||espilDistrictLoading)return; espilDistrictLoading=true;
      var cfg=espilCityCfg(); window.__espilLoadedCityKey=espilCityKey();
      Promise.all([
        fetch(cfg.district).then(function(r){return r.json();}),
        fetch(cfg.collision).then(function(r){return r.json();})
      ]).then(function(res){
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
    function espilEntryStart(){
      var p=walkPlayer; if(!p)return;
      var cfg=espilCityCfg();
      var last=null; try{ last=loadLastPos(); }catch(e){}
      var target=null;
      var locPick=null; try{ locPick=window.__espilSpawnPick||null; window.__espilSpawnPick=null; }catch(e){}
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
          (function resumeDiveWhenReady(){
            if(!walkPlayer)return;
            if(espilEntryFullyLoaded()){ espilHideMapLoader(); espilBeginDiveArrival(last.x,last.z); return; }
            if(++rtries>125){ espilHideMapLoader(); espilBeginDiveArrival(last.x,last.z); return; }
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
        target=locPick?{x:locPick.x,z:locPick.z}:(cfg.core?{x:p.pos.x,z:p.pos.z}:{x:cfg.spawn.x,z:cfg.spawn.z}); /* Han 2026-10-28: an explicit arrival pick beats the default spawn */
      }
      /* Han 2026-10-15: on a cold first load the descent scene was
         over before the world had finished loading (the character and
         its dive clip stream in last). The descent now WAITS until
         the avatar is ready before it starts, UI held down meanwhile;
         a failsafe keeps a stuck load from ever blocking entry. */
      espilInjectStyle();
      document.body.classList.add('espil-ui-pre');
      p.pos.x=target.x; p.pos.z=target.z; p.pos.y=0;
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
      var spd=(typeof moveSpeeds==='function')?moveSpeeds().run:12;
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
    var espilP1={map:null,ready:false,failed:null,hiddenApplied:false,initTried:false,bannerEl:null,mapEl:null,layerAdded:false,layerLive:false,layerRenderer:null,layerCam:null,gameCanvasHidden:false,layerSignaled:false,zoom:null,zoomT:null,zoomDrive:false,style3dOff:false,style3dTries:0};
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
    function espilP1ZoomFromDist(d){ return Math.max(14.5,Math.min(22,21.97-1.242*Math.log2(Math.max(3,d)))); }
    function espilP1DistFromZoom(z){ return Math.max(3,Math.min(60,Math.pow(2,(21.97-z)/1.242))); }
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
      var zm=(typeof espilP1!=='undefined'&&espilP1&&typeof espilP1.zoom==='number')?espilP1.zoom:19.3;
      for(var i=0;i<feats.length;i++){
        var m=meta[i];
        var bx=px<m.mnx?m.mnx-px:(px>m.mxx?px-m.mxx:0), bz=pz<m.mnz?m.mnz-pz:(pz>m.mxz?pz-m.mxz:0);
        var prop=feats[i].properties;
        if(bx*bx+bz*bz>820*820&&!m.lod)continue;
        scanned++;
        var h=prop.h;
        var hv=h; /* flat world (Han 2026-10-20 cleanup): the visual height is the record height, except the zoom LOD below */
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
      var zm=(typeof espilP1.zoom==='number')?espilP1.zoom:19.3;
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
    /* STYLE 3D OFF (Han 2026-10-17): a Standard-based style serves its
       own 3D buildings through an IMPORT - those layers never appear
       in getStyle().layers, so the layer scan in espilP1AddBuildings
       cannot see or hide them, and the style's city would render under
       ours (the double-render suspect of the 22:13 diagnosis). The
       import carries its own config switch: show3dObjects=false turns
       the style's 3D objects off at the source. Retried from the tick
       until it lands (an import may settle after 'load'). */
    function espilP1HideStyle3D(){
      if(!espilP1.map||espilP1.style3dOff)return;
      var done=true;
      try{
        var st=espilP1.map.getStyle();
        var imps=(st&&st.imports)||[];
        for(var ii=0;ii<imps.length;ii++){
          var iid=(imps[ii]&&imps[ii].id)||'basemap';
          try{ espilP1.map.setConfigProperty(iid,'show3dObjects',false); }
          catch(e){ done=false; }
        }
      }catch(e){ done=false; }
      if(done)espilP1.style3dOff=true;
    }
    function espilP1AddBuildings(){
      if(!espilP1.map||espilP1.buildingsAdded)return;
      var blds=(typeof espilDistrict!=='undefined'&&espilDistrict&&espilDistrict.buildings)||[];
      if(!blds.length)return; /* district data not in yet - the tick retries */
      /* COLOR-KEY (Han 2026-10-17): exactly ONE building rendering -
         the base style's own building layers (which carry their own
         zoom band and made the color vanish at high and low zoom)
         are hidden; our extrusion below is the only buildings, keyed
         green at every zoom (the layer has no minzoom/maxzoom). */
      try{
        var lys=espilP1.map.getStyle().layers||[];
        for(var li2=0;li2<lys.length;li2++){
          var LL=lys[li2];
          if(LL.id==='espil-buildings-3d'||LL.id==='espil-buildings-collision')continue;
          if(LL['source-layer']==='building'||/building/i.test(LL.id)){
            try{espilP1.map.setLayoutProperty(LL.id,'visibility','none');}catch(e){}
          }
        }
      }catch(e){}
      try{
        if(!espilP1.map.getSource('espil-buildings')){
          espilP1.map.addSource('espil-buildings',{type:'geojson',data:espilP1BuildingsGeoJSON()});
          /* Building colour (Han 2026-10-18): the fixed key green
             (#00c853) pin is RELEASED - buildings render in a neutral
             tone, #c9c4bb (light greige). The green was only the
             contract's display marker; collision is record-polygon
             based and colour-independent, unchanged. */
          espilP1.map.addLayer({id:'espil-buildings-3d',type:'fill-extrusion',source:'espil-buildings',paint:{'fill-extrusion-color':'#c9c4bb','fill-extrusion-height':['get','hv'],'fill-extrusion-base':0,'fill-extrusion-opacity':1}}); /* paint height is hv (the record height, or 0 for a zoom-LOD-flattened feature); the record h stays in properties for collision */
          /* COLLISION LAYER (Han 2026-10-17, CarInMap method): a flat,
             invisible fill over the same footprints - the wall judge
             queries THIS layer with queryRenderedFeatures. The
             extrusion itself is never queried: at pitch its drawn
             silhouette overhangs the footprint and would wall off open
             ground beside tall buildings. */
          espilP1.map.addLayer({id:'espil-buildings-collision',type:'fill',source:'espil-buildings',paint:{'fill-color':'#000000','fill-opacity':0}});
        }else{
          espilP1.map.getSource('espil-buildings').setData(espilP1BuildingsGeoJSON());
        }
        espilP1.buildingsAdded=true;
      }catch(e){}
      espilP1HideStyle3D();
    }
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
          try{ r.render(mapScene, espilP1.layerCam); }catch(e){}
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
        espilP1.map=new mapboxgl.Map({container:el,style:'mapbox://styles/quadclipse/cmvdcpdor000901sq8xq57eab',center:espilP1LngLat((espilCityCfg().spawn||{x:3,z:31}).x,(espilCityCfg().spawn||{x:3,z:31}).z),zoom:17.3,pitch:52,bearing:0,attributionControl:false,interactive:false,projection:'mercator',maxZoom:22}); /* projection forced (Han 2026-10-17): the designated style declares lambertConformalConic, under which Mapbox skips ALL 3D drawing ("Drawing 3D models for lambertConformalConic projection is not yet implemented") - the custom layer and our extrusions vanished on Han's PC while the mercator stub could not reproduce it. The game's math is Mercator throughout. maxZoom = the Mapbox default 22 (custom cap removed on Han's order). */
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
          espilP1.style3dOff=false; espilP1.style3dTries=0; /* the fallback style gets its own 3D-off attempt */
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
      if(espilP1.ready&&!espilP1.style3dOff&&espilP1.style3dTries<1200){ espilP1.style3dTries++; espilP1HideStyle3D(); }
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
        /* ZOOM OPERATION (Han 2026-10-17, CarInMap scope): the map's own
           zoom level is the operated quantity. The wheel moves the zoom
           TARGET (espilP1.zoomT, set in mapZoom) and the view eases to
           it; the overlay camera distance is derived from the zoom so
           both surfaces stay scale-locked. During descent the descent
           envelope leads the zoom (and the target tracks it), unless
           the player has taken the zoom over with the wheel. */
        if(espilP1.zoom===null){ espilP1.zoom=19.3; espilP1.zoomT=19.3; } /* default framing (Han PC QA 2026-10-18): pulled a full level closer, MapleStory-like presence */
        if(walkPlayer._espilArrive&&!espilP1.zoomDrive){
          espilP1.zoom=espilP1.zoomT=espilP1ZoomFromDist(walkCamDist);
        }else{
          if(!espilP1.zoomDrive)espilP1.zoomT=19.3; /* until the player takes the wheel, the target is the default framing */
          espilP1.zoom+=(espilP1.zoomT-espilP1.zoom)*0.2;
          if(Math.abs(espilP1.zoomT-espilP1.zoom)<0.001)espilP1.zoom=espilP1.zoomT;
          walkCamDist=espilP1DistFromZoom(espilP1.zoom);
        }
        var zoom=espilP1.zoom;
        try{ espilP1.map.jumpTo({center:ll,bearing:brg,pitch:52,zoom:zoom}); }catch(e){}
        if(espilP1.layerLive){ try{ espilP1.map.triggerRepaint(); }catch(e){} } /* the map's render pass draws the game scene via the custom layer */
        /* AVATAR SCALE (Han 2026-10-17): in layer mode the avatar draws
           at true map scale - about 11 px tall at the default zoom
           18.3 (measured), which reads as invisible on a real map.
           Layer mode ONLY, the visual root is grown by a zoom-linked
           factor F(z) = 4.67 x 2^(-(z-18.3)/2), chosen so the screen
           height follows H(z) = 52 x 2^((z-18.3)/2) px: about 75 px
           at the 19.3 default framing (Han PC QA round 2, 2026-10-18:
           the 227 px figure read too big against the map - one third
           of it; the 19.3 default zoom itself was approved and stays),
           about 183 px at the max 22, about 23 px at 16. Physics, collision
           and support keep the
           true 1.8 m body - only the drawing grows; outside layer mode
           the base scale is restored. The contact shadow follows at a
           capped factor so it stays a contact shadow. */
        if(typeof walkPlayer!=='undefined'&&walkPlayer&&walkPlayer.av){
          var _av=walkPlayer.av,_vr=_av.__visualRoot;
          if(_vr){
            var _F=espilP1.layerLive&&!espilP1.failed?4.67*Math.pow(2,-((espilP1.zoom||19.3)-18.3)/2):1;
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
      syncTrafficCars(); /* 2D car placeholders mirror the new flow levels */
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
    /* Han 2026-10-11: hoisted from buildWalkMapOnce() to outer scope.
       syncTrafficCars() is called from updateTraffic() (outer scope); the nested
       definition was invisible there -> ReferenceError every traffic tick. */
    var CAR_COLORS=['#d94f4f','#4f7ed9','#e8e8e8','#2b2f36','#f2b134','#7ed957','#9b59b6'];
    var CAR_W=4.6,CAR_H=1.6,CAR_TOP=1.6; /* single jump apex ~1.56 + .55 step grace -> landable */
    /* Han 2026-10-09: soft blob shadow under cars for 3D feel */
    var carShadowTex=(function(){
      var c=document.createElement('canvas');c.width=128;c.height=64;
      var g=c.getContext('2d');
      var grad=g.createRadialGradient(64,32,8,64,32,60);
      grad.addColorStop(0,'rgba(0,0,0,0.45)');
      grad.addColorStop(0.7,'rgba(0,0,0,0.25)');
      grad.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=grad;
      g.fillRect(0,0,128,64);
      var t=new THREE.CanvasTexture(c);return t;
    })();
    function carTexture(variant,color){
      var c=document.createElement('canvas');c.width=72;c.height=25;
      var g=c.getContext('2d');g.clearRect(0,0,72,25);
      g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(36,22,30,3,0,0,7);g.fill();
      g.fillStyle=color;
      if(variant===2){ /* van */
        g.beginPath();g.roundRect(8,6,56,13,3);g.fill();
        g.fillStyle='#bcd6f5';g.fillRect(50,8,10,6);
      }else{
        g.beginPath();g.roundRect(8,11,56,9,4);g.fill();
        g.fillStyle=color;g.beginPath();g.roundRect(22,5,28,9,4);g.fill();
        g.fillStyle='#bcd6f5';g.beginPath();g.roundRect(25,7,22,6,2);g.fill();
        if(variant===3){g.fillStyle='#2b2f36';g.fillRect(32,2,8,4);} /* taxi sign */
      }
      g.fillStyle='#1c1e22';
      g.beginPath();g.arc(20,20,4.5,0,7);g.fill();
      g.beginPath();g.arc(52,20,4.5,0,7);g.fill();
      g.fillStyle='#8a8f98';
      g.beginPath();g.arc(20,20,2,0,7);g.fill();
      g.beginPath();g.arc(52,20,2,0,7);g.fill();
      var t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
    }
    function initCarTextures(){
      /* Batch D4 (Han 2026-11-03): the van variant (v===2) is OUT of
         the traffic pool - its tall boxy side profile on the traffic
         billboard plane reads as a strange BUS IMAGE in front of the
         Art Gallery (Georgia St runs along the gallery front). The
         Georgia-St live-bus feature itself is long removed (comment
         only); this van sprite was the only bus-like image left in
         the build. Cars and the taxi variant remain. */
      for(var v=0;v<4;v++){ if(v===2)continue; for(var k=0;k<3;k++)
        carTextures.push(carTexture(v,CAR_COLORS[(v*3+k)%CAR_COLORS.length])); }
    }
    /* #5 (Han 2nd QA): top-view car sprite for N/S movement.
       Simple top-down: body, windshield at front (+x), roof. */
    var carTopTextures=[];
    function carTopTexture(color){
      var c=document.createElement('canvas');c.width=144;c.height=60;
      var g=c.getContext('2d');g.clearRect(0,0,144,60);
      g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(72,52,60,6,0,0,7);g.fill();
      /* Han 2026-10-09: vibrant colors for N/S cars */
      g.fillStyle=color;
      g.beginPath();g.roundRect(12,10,120,40,16);g.fill(); /* body from top */
      g.fillStyle='#cfe4ff';g.beginPath();g.roundRect(88,18,28,24,6);g.fill(); /* windshield (front) */
      g.fillStyle=color;g.globalAlpha=.9;
      g.beginPath();g.roundRect(24,18,52,24,8);g.fill(); /* roof */
      g.globalAlpha=1;
      /* dark outline for pop */
      g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=3;
      g.beginPath();g.roundRect(12,10,120,40,16);g.stroke();
      g.fillStyle='#ffe9a8';g.fillRect(128,16,6,8);g.fillRect(128,36,6,8); /* headlights */
      g.fillStyle='#ff2d2d';g.fillRect(12,16,6,8);g.fillRect(12,36,6,8); /* taillights */
      var t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
    }
    function initCarTopTextures(){
      for(var k=0;k<CAR_COLORS.length;k++)
        carTopTextures.push(carTopTexture(CAR_COLORS[k]));
    }
    function carCountFor(flow,len){
      /* #4 (Han 2nd QA): reduced from 10 to 5 max per segment for perf */
      var want=Math.round(5-4*flow); /* flow 1 -> 1 car, flow 0 -> 5 cars */
      return Math.max(1,Math.min(want,Math.max(1,Math.floor(len/8))));
    }
    /* #4: object pool for car meshes (avoid create/dispose churn) */
    var carPool=[];
    function getCarMesh(){
      if(carPool.length>0)return carPool.pop();
      return null;
    }
    function releaseCarMesh(mesh){
      mesh.visible=false;
      if(mesh.userData.shadow)mesh.userData.shadow.visible=false;
      carPool.push(mesh);
    }
    function spawnCar(si){
      /* #4: distance culling — only spawn cars near player (400m) */
      if(walkPlayer&&walkPlayer.pos){
        var seg=trafficSegs[si];
        var scx=(seg.x1+seg.x2)/2,scz=(seg.z1+seg.z2)/2;
        var pdx=scx-walkPlayer.pos.x,pdz=scz-walkPlayer.pos.z;
        if(pdx*pdx+pdz*pdz>400*400)return;
      }
      /* #4: total cap — max 80 cars */
      if(trafficCars.length>=80)return;
      var seg=trafficSegs[si],len=Math.hypot(seg.x2-seg.x1,seg.z2-seg.z1);
      var lane=Math.random()<.5?1:-1;
      var texIdx=(Math.random()*carTextures.length)|0;
      var colorIdx=texIdx%carTopTextures.length;
      var mesh=getCarMesh();
      if(mesh){
        /* Reuse pooled mesh */
        mesh.material.map=carTextures[texIdx];
        mesh.material.needsUpdate=true;
        mesh.visible=true;
        if(mesh.userData.shadow)mesh.userData.shadow.visible=true;
      }else{
        var mat=new THREE.MeshBasicMaterial({map:carTextures[texIdx],transparent:true,side:THREE.DoubleSide,fog:true,depthWrite:false});
        mesh=new THREE.Mesh(new THREE.PlaneGeometry(CAR_W,CAR_H),mat);
        mesh.renderOrder=2;mesh.frustumCulled=false;
        /* Han 2026-10-09: blob shadow for 3D feel */
        var shMat=new THREE.MeshBasicMaterial({map:carShadowTex,transparent:true,depthWrite:false});
        var shMesh=new THREE.Mesh(new THREE.PlaneGeometry(CAR_W*1.3,CAR_H*2.2),shMat);
        shMesh.rotation.x=-Math.PI/2;
        shMesh.renderOrder=1;shMesh.frustumCulled=false;
        mapScene.add(shMesh);
        mesh.userData.shadow=shMesh;
        mapScene.add(mesh);
      }
      var t0=Math.random(),dx=seg.x2-seg.x1,dz=seg.z2-seg.z1;
      var off=1.4*lane,x0=seg.x1+dx*t0+(-dz/len)*off,z0=seg.z1+dz*t0+(dx/len)*off;
      mesh.userData.car={si:si,t:t0,lane:lane,dir:lane>0?1:-1,len:len,x:x0,px:x0,z:z0,pz:z0,
        sideTex:carTextures[texIdx],topTex:carTopTextures[colorIdx]};
      var col={x0:0,x1:0,z0:0,z1:0,bottom:0,top:CAR_TOP,car:mesh};
      mesh.userData.car.col=col;carColliders.push(col);
      /* scale.x flip now handled per-frame in updateTrafficCars (screen-space direction) */
      trafficCars.push(mesh);
    }
    function syncTrafficCars(){
      var counts={};
      for(var i=0;i<trafficCars.length;i++){var s=trafficCars[i].userData.car.si;counts[s]=(counts[s]||0)+1;}
      for(var si=0;si<trafficSegs.length;si++){
        var seg=trafficSegs[si],len=Math.hypot(seg.x2-seg.x1,seg.z2-seg.z1);
        var want=carCountFor(seg.flow,len),have=counts[si]||0,diff=want-have;
        var step=Math.max(-2,Math.min(2,diff));
        if(step>0)for(var k=0;k<step;k++)spawnCar(si);
        else if(step<0){
          var removed=0;
          for(var j=trafficCars.length-1;j>=0&&removed<-step;j--){
            if(trafficCars[j].userData.car.si===si){
              /* #4: pool instead of dispose */
              var mesh=trafficCars[j];
              var ci=carColliders.indexOf(mesh.userData.car.col);
              if(ci>=0)carColliders.splice(ci,1);
              releaseCarMesh(mesh);
              trafficCars.splice(j,1);removed++;
            }
          }
        }
      }
      /* #4: despawn cars that drifted too far from player (>500m) */
      if(walkPlayer&&walkPlayer.pos){
        for(var k=trafficCars.length-1;k>=0;k--){
          var cm=trafficCars[k],cu=cm.userData.car;
          var ddx=cu.x-walkPlayer.pos.x,ddz=cu.z-walkPlayer.pos.z;
          if(ddx*ddx+ddz*ddz>500*500){
            var ci2=carColliders.indexOf(cu.col);
            if(ci2>=0)carColliders.splice(ci2,1);
            releaseCarMesh(cm);
            trafficCars.splice(k,1);
          }
        }
      }
    }
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
    /* Rebuild the avatar in place when the confirmed gender differs
       from the one the current avatar was built with (the preload
       builds the avatar BEFORE a first-time player picks a gender,
       so the confirm path re-applies it). No-op when already right. */
    window.__espilApplyAvatarGender=function(g){espilApplyAvatarGender(g);}; /* customizer edit mode re-applies a changed gender in place (Han 2026-10-28) */
    function espilApplyAvatarGender(gender){
      if(!walkPlayer||!walkPlayer.av||!mapScene)return;
      if(walkPlayer.av.__gender===gender)return;
      var old=walkPlayer.av;
      if(old.group&&old.group.parent)old.group.parent.remove(old.group);
      if(old.shadow&&old.shadow.parent)old.shadow.parent.remove(old.shadow);
      var av=buildWalkerAvatar(gender);
      walkPlayer.av=av;
      mapScene.add(av.group);mapScene.add(av.shadow);
      av.shadow.position.set(walkPlayer.pos.x,.03,walkPlayer.pos.z);
    }
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
      /* 2D traffic cars — Han 2026-10-07: placeholder 2D car sprites visualizing
         live traffic level per segment. Jammed = many slow cars; clear = few fast
         cars. Camera-facing billboards like other props (no 3D models). Random
         models/colors; Han can swap art later via setCarSprite(). */
      trafficCars.length=0;carTextures.length=0;carColliders.length=0; /* reset (hoisted vars) */
      updateTrafficCars=function(dt){
        /* Reusable temporaries (avoid per-car allocation) */
        if(!updateTrafficCars._cr)updateTrafficCars._cr=new THREE.Vector3();
        if(!updateTrafficCars._cu)updateTrafficCars._cu=new THREE.Vector3();
        if(!updateTrafficCars._qz)updateTrafficCars._qz=new THREE.Quaternion();
        if(!updateTrafficCars._zAxis)updateTrafficCars._zAxis=new THREE.Vector3(0,0,1);
        var camRight=updateTrafficCars._cr.set(1,0,0).applyQuaternion(mapCamera.quaternion);
        var camUp=updateTrafficCars._cu.set(0,1,0).applyQuaternion(mapCamera.quaternion);
        for(var i=0;i<trafficCars.length;i++){
          var m=trafficCars[i],u=m.userData.car,seg=trafficSegs[u.si];
          /* Han 2026-10-10: traffic realism.
             - Jam: flow<0.25 → stopped; 0.25-0.5 → crawl; else normal.
             - Red light: stop before intersection. */
          var nowS=Date.now()/1000;
          var baseSpeed;
          if(seg.flow<0.25)baseSpeed=0; /* jammed: stopped */
          else if(seg.flow<0.5)baseSpeed=1.0+seg.flow*4; /* heavy: crawl */
          else baseSpeed=1.5+seg.flow*16; /* normal */
          /* Traffic light check: approaching intersection? */
          var dx0=seg.x2-seg.x1,dz0=seg.z2-seg.z1;
          var segLen=u.len;
          /* Position along segment (0-1). Intersections at t=0 and t=1. */
          var distToEnd=u.dir>0?(1-u.t)*segLen:u.t*segLen;
          var speed=baseSpeed;
          if(distToEnd<14&&distToEnd>2){
            /* Near intersection — check light */
            var ix=u.dir>0?seg.x2:seg.x1, iz=u.dir>0?seg.z2:seg.z1;
            var ls=lightStateAt(ix,iz,nowS);
            if(ls){
              var isHoriz=Math.abs(dz0)<.01;
              var myDir=isHoriz?'EW':'NS';
              /* Yellow: stop if far, go if very close (can't stop safely) */
              if(ls==='Y'){
                if(distToEnd>6)speed=0;
              }else if(ls!==myDir){
                speed=0; /* red: stop */
              }
            }
          }
          /* Car queuing: don't drive through stopped car ahead */
          if(speed>0){
            for(var q=0;q<trafficCars.length;q++){
              if(q===i)continue;
              var ou=trafficCars[q].userData.car;
              if(ou.si!==u.si||ou.lane!==u.lane)continue;
              /* Same segment+lane: check distance ahead */
              var ahead=(ou.t-u.t)*u.dir; /* >0 means ou is ahead in travel dir */
              if(ahead>0&&ahead*segLen<9){
                /* Car ahead within 9m — match its speed (stop if stopped) */
                var ouSpeed=(ou._speed!==undefined)?ou._speed:0;
                if(ouSpeed<0.5){speed=0;break;}
                speed=Math.min(speed,ouSpeed);
              }
            }
          }
          u._speed=speed; /* store for queuing */
          u.t+=u.dir*speed*dt/segLen;
          if(u.t>1)u.t-=1;else if(u.t<0)u.t+=1;
          var dx=seg.x2-seg.x1,dz=seg.z2-seg.z1;
          var px=-dz/u.len,pz=dx/u.len,off=1.4*u.lane;
          var x=seg.x1+dx*u.t+px*off,z=seg.z1+dz*u.t+pz*off;
          u.px=u.x;u.pz=u.z;u.x=x;u.z=z;
          m.position.set(x,CAR_H/2,z);
          /* #5 (Han 2nd QA, revised): N/S = top view LAID FLAT on ground
             (wheels on ground, hood/roof to sky), rotated to heading.
             E/W = side view billboard with horizontal flip. */
          var vx=x-u.px,vz=z-u.pz;
          var screenVX=vx*camRight.x+vz*camRight.z;
          var screenVY=vx*camUp.x+vz*camUp.z;
          var spd=Math.sqrt(screenVX*screenVX+screenVY*screenVY);
          if(spd>0.005){
            var ang=Math.atan2(screenVY,screenVX);
            var useTop=Math.abs(screenVY)>Math.abs(screenVX);
            /* Swap texture if view changed */
            var wantTex=useTop?u.topTex:u.sideTex;
            if(m.material.map!==wantTex){m.material.map=wantTex;m.material.needsUpdate=true;}
            if(useTop){
              /* Flat on ground: rotation.x=-PI/2, heading via rotation.z.
                 World heading: nose (+x) points along (vx,vz).
                 After Rx(-90°), local +x stays +x, local +y → -z.
                 So heading angle = atan2(-vz, vx). */
              /* Han 2026-10-09: bigger N/S cars */
              m.scale.set(1.6,1.6,1);
              m.rotation.set(-Math.PI/2,0,Math.atan2(-vz,vx));
              /* Lift slightly above ground */
              m.position.y=CAR_H/2+0.15;
            }else{
              /* Side view: billboard, stay level, flip for leftward */
              m.quaternion.copy(mapCamera.quaternion);
              m.scale.x=(ang>Math.PI/2||ang<-Math.PI/2)?-1:1;
              m.position.y=CAR_H/2;
              updateTrafficCars._qz.setFromAxisAngle(updateTrafficCars._zAxis,0);
              m.quaternion.multiply(updateTrafficCars._qz);
            }
          }else{
            /* Stationary: default to side-view billboard */
            m.quaternion.copy(mapCamera.quaternion);
            m.position.y=CAR_H/2;
          }
          /* axis-aligned AABB collider follows the car */
          var horiz=Math.abs(dz)<.01,ax=horiz?CAR_W/2:0.9,az=horiz?0.9:CAR_W/2;
          var col=u.col;col.x0=x-ax;col.x1=x+ax;col.z0=z-az;col.z1=z+az;
          /* Han 2026-10-09: shadow follows car on ground */
          var sh=m.userData.shadow;
          if(sh){
            sh.position.set(x,0.06,z);
            sh.visible=m.visible;
          }
        }
      }
      /* Han 2026-10-10: incident markers face camera + flash */
      if(typeof incidentMarkers!=='undefined'&&incidentMarkers.length){
        var _fl=Math.floor(Date.now()/500)%2===0;
        for(var _mi=0;_mi<incidentMarkers.length;_mi++){
          var _mk=incidentMarkers[_mi].mesh;
          _mk.quaternion.copy(mapCamera.quaternion);
          _mk.visible=_fl;
        }
      }
      /* Han 2026-10-10: AI car sprites — loads Plushy-generated PNGs from
         assets/sprites/manifest.json (generated by tools/generate_sprites.py
         through the Plushy sprite API). Falls back to procedural canvas:
         any missing/failed texture keeps its procedural version, and a
         missing manifest is a silent no-op. Orientation contract for the
         PNGs: side views nose pointing +x (right), top views nose +x. */
      var CAR_SPRITE_COLORS=['red','blue','white','black','yellow','green','purple'];
      function loadCarSprites(){
        fetch('assets/sprites/manifest.json').then(function(r){
          if(!r.ok) throw new Error('no sprite manifest');
          return r.json();
        }).then(function(m){
          var byName={};
          (m.sprites||[]).forEach(function(e){
            if(e.status!=='failed'&&e.file) byName[e.name]='assets/sprites/'+e.file;
          });
          var colors=CAR_SPRITE_COLORS, n=colors.length, i;
          var newSides=[], newTops=[];
          for(i=0;i<n;i++){ newSides.push(null); newTops.push(null); }
          var remaining=n*2;
          var loader=new THREE.TextureLoader();
          function done(){
            if(--remaining>0) return;
            if(!newSides.every(Boolean)||!newTops.every(Boolean)) return;
            carTextures=newSides; carTopTextures=newTops;
            for(var k=0;k<trafficCars.length;k++){
              var u=trafficCars[k].userData.car;
              var ti=(Math.random()*carTextures.length)|0;
              u.sideTex=carTextures[ti];
              u.topTex=carTopTextures[ti%carTopTextures.length];
            }
            /* per-frame swap logic picks up u.sideTex/u.topTex automatically */
          }
          colors.forEach(function(c,idx){
            [['car_side_'+c,newSides],['car_top_'+c,newTops]].forEach(function(pair){
              var url=byName[pair[0]], arr=pair[1];
              if(!url){ done(); return; }
              loader.load(url,
                function(t){ t.anisotropy=4; arr[idx]=t; done(); },
                undefined,
                function(){ done(); });
            });
          });
        }).catch(function(){ /* keep procedural canvas sprites */ });
      }
      function setCarSprite(url){ /* legacy single-texture hook; prefer loadCarSprites() */
        var tex=new THREE.TextureLoader().load(url);
        carTextures=[tex];
        for(var i=0;i<trafficCars.length;i++){trafficCars[i].material.map=tex;trafficCars[i].material.needsUpdate=true;}
      }
      initCarTextures();initCarTopTextures();syncTrafficCars();
      loadCarSprites();
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
      /* The walker. */
      var av=buildWalkerAvatar(espilSavedGender());
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
      p.av.shadow.position.set(p.pos.x,.03,p.pos.z);
      p.av.shadow.material.opacity=Math.max(.08,.26-Math.max(0,p.pos.y-.05)*.05);
      /* --- mid-air player contact drops both flyers --- */
      espilFlyBumpCheck();
    }
    /* QA #6 (2026-10-06): remember last location in localStorage (server sync later). */
    var LAST_POS_KEY='espil_last_pos';
    function saveLastPos(){
      if(!walkPlayer)return;
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
      /* Init car textures (was in skipped procedural block) */
      if(typeof initCarTextures==='function'&&carTextures.length===0){
        initCarTextures();
        initCarTopTextures();
      }
      if(typeof syncTrafficCars==='function')syncTrafficCars();
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
      if(allWater){
        var wgeo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,1,1);
        var wmat=new THREE.MeshLambertMaterial({color:0x2a6a9e,transparent:true,opacity:.92});
                var wmesh=new THREE.Mesh(wgeo,wmat);
        wmesh.rotation.x=-Math.PI/2;
        wmesh.position.set(x0+CHUNK_SIZE/2,.2,z0+CHUNK_SIZE/2);
        group.add(wmesh);
      }else{
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
      /* QA #6: restore last position if available, else default spawn. */
      var last=loadLastPos();
      if(last){
        walkPlayer.pos.set(last.x,last.y,last.z);
        if(typeof last.yaw==='number')walkCamYaw=last.yaw;
      }else{
        walkPlayer.pos.set(3,.05,31);
      }
      walkPlayer.velY=0;walkPlayer.onGround=true;
      walkPlayer.jumps=0;walkPlayer.faceY=.5;walkPlayer.bobT=0;
      walkCamPitch=.84;walkCamDist=14; /* Cauldron 48° */
      walkPlayer.av.group.position.copy(walkPlayer.pos);
      walkPlayer.av.group.rotation.y=.5;
      /* Snap the follow camera behind the player on entry. */
      var cp0=Math.cos(walkCamPitch),sp0=Math.sin(walkCamPitch);
      mapCamera.position.set(
        walkPlayer.pos.x+Math.sin(walkCamYaw)*cp0*walkCamDist,
        walkPlayer.pos.y+sp0*walkCamDist+1.2,
        walkPlayer.pos.z+Math.cos(walkCamYaw)*cp0*walkCamDist);
      mapCamera.lookAt(walkPlayer.pos.x,walkPlayer.pos.y+1.7,walkPlayer.pos.z);
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
      /* Han 2026-10-14: city name shows ONCE, big and front-center, on entry. */
      var ci=document.getElementById('city-intro'),cin=document.getElementById('city-intro-name');
      if(ci&&cin){
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
      /* Han: hide SPACE interact prompt and location pill while store modal is open */
      var ip=document.getElementById('interact-prompt');
      if(ip)ip.classList.add('hidden');
      var bn=document.getElementById('building-name');
      if(bn)bn.classList.add('hidden');
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
      /* BUILDING INTERIOR (Han batch 6 #6): while inside, Space at
         the door leaves; Space anywhere else toggles the shop UI. */
      if(window.__espilInside&&espilInsideDoor){
        var _dd=Math.sqrt((walkPlayer.pos.x-espilInsideDoor.x)*(walkPlayer.pos.x-espilInsideDoor.x)+(walkPlayer.pos.z-espilInsideDoor.z)*(walkPlayer.pos.z-espilInsideDoor.z));
        if(_dd<1.8){ espilLeaveBuilding(); return; }
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
      /* Han 2026-10-20 #5: on the Mapbox line, Space at a building
         (record distance <= 2 m, Han's #7 gate) opens the building
         selection window with its name; Enter goes inside (shops to
         their store page, other buildings to the interior room). Past
         the gate, Cauldron's too-far answer stands. */
      if(typeof ESPIL_P1!=='undefined'&&ESPIL_P1){
        var _nr=espilNearestRecord(walkPlayer.pos.x,walkPlayer.pos.z);
        if(!_nr||_nr.d>2){espilSpaceTooFar();return;}
        if(walkPlayer.av&&walkPlayer.av.playOneShot){
          walkPlayer.av.playOneShot(Math.random()>.5?'checkout':'chat');
        }
        openBuildingPanel(_nr.rec);
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
          /* Han: restore SPACE prompt and location pill if still near a building */
          var ip=document.getElementById('interact-prompt');
          if(ip&&typeof nearBldg!=='undefined'&&nearBldg&&!(typeof ESPIL_P1!=='undefined'&&ESPIL_P1))ip.classList.remove('hidden'); /* P1: the proximity tick restores it under the tight gate */
          var bn=document.getElementById('building-name');
          if(bn&&typeof nearBldg!=='undefined'&&nearBldg)bn.classList.remove('hidden');
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
            /* Han: restore SPACE prompt and location pill if still near a building */
            var ip=document.getElementById('interact-prompt');
            if(ip&&typeof nearBldg!=='undefined'&&nearBldg&&!(typeof ESPIL_P1!=='undefined'&&ESPIL_P1))ip.classList.remove('hidden'); /* P1: the proximity tick restores it under the tight gate */
            var bn=document.getElementById('building-name');
            if(bn&&typeof nearBldg!=='undefined'&&nearBldg)bn.classList.remove('hidden');
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
    var MOVE_ORDER=['punch','kick','throw','defense'];
    var MOVES={
      punch:{name:'Punch',key:'Q',icon:'👊',color:0xbfe9ff,css:'#bfe9ff',
        dmg:8,range:2.2,cd:.45,arc:1.9,y:1.05,
        desc:'A quick punch.'},
      kick:{name:'Kick',key:'W',icon:'🦵',color:0x7dfce6,css:'#7dfce6',
        dmg:13,range:2.8,cd:.65,arc:2.2,y:.6,
        desc:'A heavy kick. Slower, longer reach.'},
      throw:{name:'Quote Tool',key:'E',icon:'「」',art:'quote',color:0xffd76e,css:'#ffd76e',
        dmg:10,range:8,cd:.9,arc:1.6,y:1.3,proj:true,
        desc:'Quote a tool from your knowledge. It flies forth and bursts on arrival.'},
      defense:{name:'Defense',key:'R',icon:'🛡️',color:0x9fe8b3,css:'#9fe8b3',
        dmg:0,range:0,cd:2.5,arc:0,y:1.0,guard:true,
        desc:'Raise your guard. Blocks while active.'}
    };
    /* Skill bar slots, QWER row then ASDF row. Locked slots show a lock;
       empty ones are inert placeholders for future skills. */
    var SKILL_SLOTS=[
      {key:'q',move:'punch'},
      {key:'w',move:'kick'},
      {key:'e',move:'throw'},
      {key:'r',move:'defense'},
      {key:'a',locked:'Cauldron Toss'},
      {key:'s',locked:'Ember Guard'},
      {key:'d',locked:null},
      {key:'f',locked:null}
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
    /* Movement skills feed back into the walk controller. */
    function moveSpeeds(){
      var a=skillState.alloc;
      return {
        walk:7.5*(1+.015*(a['m_walk']||0)),
        run:12*(1+.02*(a['m_run']||0)),
        swim:4,
        jumpV:9*(1+.01*(a['m_jump']||0)),
        djumpV:9*(1+.02*(a['m_djump']||0))
      };
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
      var m=MOVES[id];
      return {
        m:m,
        dmg:Math.round(m.dmg*(1+.05*rank)),
        range:m.range*(1+.07*(skillState.alloc.reach||0)),
        cd:m.cd/(1+.05*(skillState.alloc.swift||0)),
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
      var i;
      var anyCd=false;
      for(i=0;i<MOVE_ORDER.length;i++){
        var mid=MOVE_ORDER[i];
        if(skillState.cd[mid]>0){skillState.cd[mid]=Math.max(0,skillState.cd[mid]-dt);anyCd=true;}
      }
      if(anyCd)paintCooldowns();
      if(skillState.mp<skillState.maxmp){skillState.mp=Math.min(skillState.maxmp,skillState.mp+5*dt);paintStatus();}
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
      if(!cityPhaseActive||!walkPlayer||skillTreeOpen)return;
      var m=MOVES[id];
      if(!m)return;
      if(skillState.cd[id]>0)return;
      var st=moveStats(id),p=walkPlayer;
      skillState.cd[id]=st.cd;
      /* Play attack animation (male_attack.glb) — replaces procedural lunge */
      if(p.av&&p.av.playOneShot)p.av.playOneShot('attack');
      p.lungeT=(id==='throw'?.16:(id==='defense'?.12:.22)); /* fallback procedural motion */
      if(m.guard){
        spawnGuard(m,st.guardDur);
        skillSfx('guard');
      }else if(m.proj){
        spawnArc(m.color,2.2,m.arc,m.y,.2,.5,1.1);
        spawnFlash(m.color,1.5);
        spawnProjectile(m);
        skillSfx('whoosh-hi');
      }else{
        spawnArc(m.color,st.range,m.arc,m.y,.24,.55,1.15);
        spawnFlash(m.color,st.range*.6);
        if(id==='kick'){skillSfx('whoosh-lo');skillSfx('thud');}
        else{skillSfx('whoosh');}
      }
      paintCooldowns();
    }
    /* ---- HUD ---- */
    function paintStatus(){
      var lv=document.getElementById('ms-lv');
      if(lv)lv.textContent='KEEPER';
      paintKnowledge();
      /* Han 2026-10-14: HP/MP render into the glass potion flasks (--p fill). */
      var hpP=Math.max(0,Math.min(100,100*skillState.hp/skillState.maxhp));
      var hw=document.getElementById('hp-water'),hs=document.getElementById('hp-swirl'),
          hpc=document.getElementById('hp-pct'),hfv=document.getElementById('hp-flask-val'),
          hwrap=document.getElementById('hp-flask-wrap');
      if(hw)hw.style.setProperty('--p',hpP);
      if(hs)hs.style.setProperty('--p',hpP);
      if(hpc)hpc.textContent=Math.round(hpP);
      if(hfv)hfv.textContent=Math.round(skillState.hp)+'/'+skillState.maxhp;
      if(hwrap)hwrap.classList.toggle('low',hpP<=25);
      var mpP=Math.max(0,Math.min(100,100*skillState.mp/skillState.maxmp));
      var mw=document.getElementById('mp-water'),ms=document.getElementById('mp-swirl'),
          mpc=document.getElementById('mp-pct'),mfv=document.getElementById('mp-flask-val');
      if(mw)mw.style.setProperty('--p',mpP);
      if(ms)ms.style.setProperty('--p',mpP);
      if(mpc)mpc.textContent=Math.round(mpP);
      if(mfv)mfv.textContent=Math.round(skillState.mp)+'/'+skillState.maxmp;
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
    function toggleSettingsPanel(force){
      var panel=document.getElementById('settings-panel');
      if(!panel)return;
      var open=typeof force==='boolean'?force:!settingsOpen;
      settingsOpen=open;
      panel.classList.toggle('open',open);
      panel.setAttribute('aria-hidden',String(!open));
      if(open){
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
        espilKeybinds[espilKbArm]=(espilKbArm==='stall'&&e.key.length===1)?e.key.toLowerCase():e.key;
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
      if(e.key!==(binds.interact||' '))return;
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
    window.__espilInterior=null; window.__espilInteriorReturn=null;
    var ESPIL_INT={x:0,z:8000};
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
      /* Name resolution probes the record's own coordinates through
         the same Places/OSM name path as the building pill (the
         mapBuildings candidate only links stores on Enter - the
         chunk-system buildings do not align with district records). */
      fetchBuildingName({x:rec.cx,z:rec.cz},function(nm){
        if(espilBldgPanelRec!==rec&&espilInsideRec!==rec)return;
        if(!nm||(nm==='Downtown Vancouver'&&espilCityKey()!=='vancouver'))nm='Unnamed Building';
        espilBldgName=nm;
        if(nameEl)nameEl.textContent=espilBldgName;
        var on=document.getElementById('bldg-opts-name'); if(on)on.textContent=espilBldgName;
        if(window.__espilInside)window.__espilInside.name=espilBldgName;
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
    function espilEnterBuilding(){
      var p=walkPlayer; if(!p||!espilBldgPanelRec)return;
      var rec=espilBldgPanelRec;
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
    function espilEnterInside(rec){
      var p=walkPlayer; if(!p||!rec)return;
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
         store map reads at once, Pokemon-store style; restored on leave. */
      if(typeof espilP1!=='undefined'&&espilP1&&espilP1.map){ espilIntPrevZoom=(typeof espilP1.zoomT==='number')?espilP1.zoomT:null; espilP1.zoomT=18.3; }
      espilInsideRec=rec;
      espilInsideDoor={x:ESPIL_INT.x,z:ESPIL_INT.z+7.3*sz};
      espilInsideOutside={x:p.pos.x,y:p.pos.y,z:p.pos.z};
      espilInteriorSetSign(espilBldgName);
      espilFadeThrough(function(){
        p.pos.set(ESPIL_INT.x,0.05,ESPIL_INT.z+5.2*sz); p.velY=0; p.onGround=true;
        window.__espilInside={name:espilBldgName,interior:true,door:{x:ESPIL_INT.x,z:ESPIL_INT.z+7.3*sz},x:rec.cx,z:rec.cz};
        /* v3: no shop on entry - orders start at the kiosk inside. */
        try{ window.dispatchEvent(new CustomEvent('espil-guide',{detail:{type:'interior',name:espilBldgName}})); }catch(e){} /* guide hook */
      });
    }
    function espilLeaveBuilding(){
      var p=walkPlayer; if(!p)return;
      if(espilIntPrevZoom!==null&&typeof espilP1!=='undefined'&&espilP1&&espilP1.map){ espilP1.zoomT=espilIntPrevZoom; }
      espilIntPrevZoom=null; espilKioskHint=false;
      var out=espilInsideOutside;
      espilInsideRec=null; espilInsideDoor=null; espilInsideOutside=null; espilInsideHint=false;
      window.__espilInside=null;
      closeBuildingOpts();
      espilCloseShop();
      if(out){ p.pos.set(out.x,out.y,out.z); p.velY=0; }
    }
    function openBuildingOpts(){
      var o=document.getElementById('bldg-opts'); if(!o)return;
      var n=document.getElementById('bldg-opts-name'); if(n)n.textContent=espilBldgName;
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
      convenience:[['Triangle Kimbap',120,'#e8e3d5'],['Cup Ramen',150,'#d96b4f'],['Cola',90,'#b3312c'],['Iced Coffee',110,'#6b4a2f'],['Banana Milk',95,'#f2d13c'],['Choco Bar',60,'#5a3a22'],['Umbrella',450,'#3c6e91'],['Batteries AA',210,'#7d8894'],['Hot Pack',80,'#c9532f'],['Mineral Water',50,'#7fb8d8']],
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
      /* the serving counter across the back wall, the house sign's
         menu board above it, and the clerk behind the counter -
         the classic shop arrangement, all original low-poly */
      M(new THREE.BoxGeometry(12,1.05,1.1),LM(0x8a6f4d),0,0.53,-6.9);
      M(new THREE.BoxGeometry(12,0.08,1.3),LM(0xd8d2c4),0,1.09,-6.9);
      M(new THREE.CylinderGeometry(0.21,0.26,0.78,10),LM(0x3c6e91),0,1.5,-7.6);
      M(new THREE.BoxGeometry(0.34,0.42,0.06),LM(0xf0ead8),0,1.48,-7.36);
      M(new THREE.SphereGeometry(0.17,12,10),LM(0xd9a37e),0,2.06,-7.6);
      M(new THREE.CylinderGeometry(0.18,0.19,0.07,12),LM(0xb3312c),0,2.22,-7.6);
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
      /* QA #14 placeholder: no home set yet → go to spawn, toast notice. */
      if(window.__espilToast)window.__espilToast('No home location set yet');
      if(typeof resetToSpawn==='function'){try{resetToSpawn();}catch(_){}}
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
        if(d2<0.0001){ p.pos.x+=R; continue; }
        var d=Math.sqrt(d2), push=(R-d)/d;
        p.pos.x+=dx*push; p.pos.z+=dz*push;
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
    function __espilBuildRemoteAvatar(gender){
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
          R.shadow.position.set(R.cur.x,.03-rDrop,R.cur.z);
          var ss=Math.min(F,4); R.shadow.scale.set(ss,ss,1);
          R.shadow.material.opacity=Math.max(.08,.26-Math.max(0,R.cur.y-.05)*.05);
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
        R=__espilBuildRemoteAvatar(info&&info.gender);
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
    window.__espilSkills={state:skillState,gainKnowledge:gainKnowledge,
      move:doMove,tree:toggleSkillTree};
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
    /* Batch M1 (Han 2026-11-03): pair.css rotates the whole body 90
       degrees on touch devices in portrait viewports (landscape
       always). Pointer deltas arrive in PHYSICAL screen axes; in
       the rotated frame a physical delta (dx, dy) is the content
       delta (dy, -dx). Every drag handler converts through here. */
    function espilDragDelta(dx,dy){
      if(window.matchMedia&&matchMedia('(pointer:coarse) and (orientation:portrait)').matches) return [dy,-dx];
      return [dx,dy];
    }
    function mapPointerMove(e){
      if(e.pointerId!==mapDragId)return;
      var dx=e.clientX-mapLastX,dy=e.clientY-mapLastY;
      mapLastX=e.clientX;mapLastY=e.clientY;
      var dd=espilDragDelta(dx,dy);
      walkCamYaw-=dd[0]*.0052;
      walkCamPitch=Math.max(.12,Math.min(1.15,walkCamPitch+dd[1]*.004));
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
      var dd=espilDragDelta(dx,dy); /* Batch M1: rotated-frame deltas */
      walkCamYaw-=dd[0]*.0052;
      walkCamPitch=Math.max(.12,Math.min(1.15,walkCamPitch+dd[1]*.004));
    });
    function gameDragEnd(e){ if(e.pointerId===gameDragId)gameDragId=null; }
    document.addEventListener('pointerup',gameDragEnd);
    document.addEventListener('pointercancel',gameDragEnd);
    window.__espilDragLookState=function(){ return {dragging:gameDragId!==null,yaw:walkCamYaw,pitch:walkCamPitch}; };
    function mapZoom(d){
      /* ZOOM OPERATION (Han 2026-10-17): in Mapbox mode the wheel and
         pinch move the MAP ZOOM target directly, in zoom units (range
         16 to 22 (Mapbox default max, Han 2026-10-17), 0.28 per wheel notch) - not a camera distance
         translated through a curve. Outside Mapbox mode the legacy
         distance behaviour is unchanged. */
      if(ESPIL_P1&&typeof espilP1!=='undefined'&&espilP1&&espilP1.map&&espilP1.ready&&!espilP1.failed){
        if(espilP1.zoomT===null)espilP1.zoomT=19.3;
        espilP1.zoomT=Math.max(16,Math.min(22,espilP1.zoomT-d*0.28));
        espilP1.zoomDrive=true; /* a wheel during descent takes the zoom over from the envelope */
        return;
      }
      walkCamDist=Math.max(window.__espilInside?0.4:3,Math.min(16,walkCamDist+d));
    }
    /* Keyboard: tracked only while the map is open (globe keeps its own bindings). */
    document.addEventListener('keydown',function(e){
      if(!document.body.classList.contains('in-map'))return;
      /* Chat input guard (2026-10-11): game keys stay off while typing. */
      var _ae=document.activeElement,_at=(_ae&&_ae.tagName)||'';
      if(/INPUT|TEXTAREA|SELECT/.test(_at))return;
      var k=e.key;
      if(k==='Enter'&&!e.repeat){setChatTyping(true);return;}
      /* Han 2026-10-14 #1: ESC in-map closes panels ONLY — never exits to landing.
         (Re-applied 2026-10-14 after the working-copy overwrite.) */
      if(k==='Escape'&&!e.repeat){
        e.preventDefault();
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
      walkKeys[e.key.toLowerCase()]=false;
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
    function espilP1QrfHit(x,z,py){
      var ll=espilP1LngLat(x,z);
      var pt=espilP1.map.project(ll);
      var fs=espilP1.map.queryRenderedFeatures(pt,{layers:['espil-buildings-collision']});
      for(var i=0;i<fs.length;i++){
        var h=(fs[i].properties&&fs[i].properties.h)||0;
        if(h-py>.55)return true; /* the record law's height gate, on the feature's own h */
      }
      return false;
    }
    function espilP1QrfAxis(p,axis,r){
      var qs=window.__espilQrfStats||(window.__espilQrfStats={calls:0,hits:0,fallbacks:0,ms:0});
      if(!espilP1.map||!espilP1.ready||espilP1.failed){ qs.fallbacks++; return false; }
      try{ if(!espilP1.map.getLayer('espil-buildings-collision'))return false; }catch(e){ return false; }
      var delta=(axis==='x'?p._dx:p._dz)||0;
      if(!delta)return true;
      var endA=(axis==='x'?p.pos.x:p.pos.z), startA=endA-delta;
      var sx=(axis==='x'?startA:p.pos.x), sz=(axis==='z'?startA:p.pos.z);
      try{ if(espilP1QrfHit(sx,sz,p.pos.y)){ qs.fallbacks++; return false; } }catch(e){ qs.fallbacks++; return false; }
      var nSub=Math.max(1,Math.min(24,Math.ceil(Math.abs(delta)/0.8)));
      var sgn=delta>0?1:-1;
      for(var sw=1;sw<=nSub;sw++){
        var candA=startA+delta*sw/nSub;
        var cx=(axis==='x'?candA:p.pos.x), cz=(axis==='z'?candA:p.pos.z);
        var lx=cx+(axis==='x'?sgn*r:0), lz=cz+(axis==='z'?sgn*r:0);
        var hit=false, qt0=performance.now();
        try{ hit=espilP1QrfHit(cx,cz,p.pos.y)||espilP1QrfHit(lx,lz,p.pos.y); }catch(e){ qs.fallbacks++; return false; }
        qs.calls++; qs.ms+=performance.now()-qt0;
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
      for(var pi=0;pi<pb.length;pi++){
        var rec=pb[pi];
        if(p.pos.y+PLAYER_H<=0||p.pos.y>=rec.h)continue;
        if(rec.h-p.pos.y<=.55)continue;
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
      if(ESPIL_P1&&(window.__espilInside||!espilP1QrfAxis(p,axis,r))){
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
    function updateWalkMap(dt,t){
      var p=walkPlayer;
      if(!p)return;
      /* Fly/ride mode (Batch G): the flight update owns movement;
         the follow camera below uses the ground tail's own math (the
         updateWalkCamera this branch used to call never existed). */
      if(p.flying){
        if(typeof updateVehicle==='function')updateVehicle(dt);
        var fcp=Math.cos(walkCamPitch),fsp=Math.sin(walkCamPitch);
        var fwant=new THREE.Vector3(
          p.pos.x+Math.sin(walkCamYaw)*fcp*walkCamDist,
          p.pos.y+fsp*walkCamDist+1.2,
          p.pos.z+Math.cos(walkCamYaw)*fcp*walkCamDist
        );
        if(fwant.y<1.4)fwant.y=1.4;
        mapCamera.position.lerp(fwant,Math.min(1,dt*7));
        mapCamera.lookAt(p.pos.x,p.pos.y+1.7,p.pos.z);
        return;
      }
      /* Batch G: a scripted arrival/landing takes the body - a fall
         armed by a fly release is cancelled, never charged across it. */
      if(p._fall&&(p._espilArrive||p._espilLanding))p._fall=null;
      updateDnaImprint(dt);
      /* --- input: keys + touch stick, relative to camera yaw --- */
      var ix=0,iz=0;
      if(walkKeys['arrowup'])iz-=1;
      if(walkKeys['arrowdown'])iz+=1;
      if(walkKeys['arrowleft'])ix-=1;
      if(walkKeys['arrowright'])ix+=1;
      if(window.__joyVec){ix+=window.__joyVec.x;iz+=window.__joyVec.y;}
      if(p._espilLanding){ix=0;iz=0;} /* ESPIL TILES BRIDGE: the land clip owns input until it settles */
      if(p._espilClimb){ix=0;iz=0;} /* ESPIL CLIMB: the climb step owns movement while attached */
      var il=Math.sqrt(ix*ix+iz*iz);
      if(il>1){ix/=il;iz/=il;}
      var fx=-Math.sin(walkCamYaw),fz=-Math.cos(walkCamYaw);
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
      var _ms=moveSpeeds();
      var SPEED=p.swimming?_ms.swim:((p.running?_ms.run:_ms.walk)*(window.__espilSpeedBoost||1)); /* fast track (Han 2026-10-28): street tiles x2 */
      p._dx=mx*SPEED*dt;p._dz=mz*SPEED*dt;
      p.moving=il>.12;
      p.pos.x+=p._dx;collideCircleAxis(p,'x');
      p.pos.z+=p._dz;collideCircleAxis(p,'z');
      /* 5km city boundary: circular, 5000m radius from landmark (Han 2026-10-07).
         Genshin-style invisible wall — slide along the edge. */
      var distC=Math.sqrt(p.pos.x*p.pos.x+p.pos.z*p.pos.z);
      if(distC>MAP_BOUND){
        var s=MAP_BOUND/distC;
        p.pos.x*=s;p.pos.z*=s;
      }
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
            if(rrec.h>p.pos.y+.55&&espilPolyProbe(rrec,p.pos.x,p.pos.z).inside){support=rrec.h;supportCar=null;break;}
          }
        }
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
      p.av.shadow.position.set(p.pos.x,.03,p.pos.z);
      p.av.shadow.material.opacity=Math.max(.08,.26-Math.max(0,p.pos.y-.05)*.05);
      /* --- follow camera --- */
      var cp=Math.cos(walkCamPitch),sp=Math.sin(walkCamPitch);
      var want=new THREE.Vector3(
        p.pos.x+Math.sin(walkCamYaw)*cp*walkCamDist,
        p.pos.y+sp*walkCamDist+1.2,
        p.pos.z+Math.cos(walkCamYaw)*cp*walkCamDist
      );
      if(want.y<1.4)want.y=1.4;
      var k=Math.min(1,dt*7);
      mapCamera.position.lerp(want,k);
      mapCamera.lookAt(p.pos.x,p.pos.y+1.7,p.pos.z);
      if(typeof espilOwnerChipTick==='function')espilOwnerChipTick(false);
      /* Building name pill when near a building. */
      updateBuildingProximity(p.pos.x,p.pos.z,performance.now());
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
      if(e.key==='ArrowDown'){e.preventDefault();stepCity(1);}
      else if(e.key==='ArrowUp'){e.preventDefault();stepCity(-1);}
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
        var dd=espilDragDelta(dx,dy); dx=dd[0]; dy=dd[1]; /* Batch M1: the knob + vector live in the rotated frame */
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
    function espilPlayableCity(name){return name==='Vancouver';} /* Han 2026-11-02: the next deployment opens VANCOUVER ONLY - the other cities stay visible on the globe but do not open (previous six-city activation, 2026-10-18/19, is superseded for this deployment) */
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
      if(!selected||entryActive||cityPhaseActive)return;
      if(!espilPlayableCity(selected.userData.name))return;
      var newCityKey=ESPIL_CITY_KEYS[selected.userData.name]||'vancouver';
      if(!window.__ESPIL_GAME_PAGE){
        /* Page split (Han 2026-10-20 #9): the landing page hands
           entry to the game page (vancouver.html) - a real
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
            location.href='vancouver.html';
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
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(leafletMap);
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
      var ll=gameToLatLng(walkPlayer.pos.x,walkPlayer.pos.z);
      leafletMap.setView(ll,leafletMap.getZoom(),{animate:false});
      if(playerMarker)playerMarker.setLatLng(ll);
    }
    /* 2026-10-12 (Han): mobile starts in landscape — try to lock it on the
       ENTER CITY tap (a user gesture); the rotate overlay covers the rest. */
    function tryLandscapeLock(){
      try{
        if(!window.matchMedia||!matchMedia('(pointer:coarse)').matches)return;
        var de=document.documentElement;
        if(de.requestFullscreen){var fp=de.requestFullscreen();if(fp&&fp.catch)fp.catch(function(){});}
        if(screen.orientation&&screen.orientation.lock){var op=screen.orientation.lock('landscape');if(op&&op.catch)op.catch(function(){});}
      }catch(e){}
    }
    var __infoEnterBtn=document.getElementById('city-info-enter');
    if(__infoEnterBtn)__infoEnterBtn.addEventListener('click',tryLandscapeLock);
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
      /* Batch E (Han 2026-11-03, MOBILE ONLY): on touch devices the
         map toggles small <-> fullscreen, matching the tap behaviour
         below; the desktop 1->2->3->1 ladder is unchanged. */
      if(window.matchMedia&&matchMedia('(pointer:coarse)').matches){ setMapStage(mapStage>=3?1:3); return; }
      setMapStage(mapStage>=3?1:mapStage+1);
    }
    /* Batch E (Han 2026-11-03, MOBILE ONLY): tapping the small
       minimap expands it to the fullscreen stage; a minimize button
       rides the wrap's top-right corner while expanded and returns
       to the small minimap. Coarse pointers only - on desktop the
       button never renders and taps keep the old behaviour. */
    (function(){
      var wrap=document.getElementById('minimap-wrap');
      if(!wrap)return;
      var st=document.createElement('style');
      st.textContent=
        '#minimap-wrap .map-min-btn{display:none;position:absolute;z-index:12;top:8px;right:8px;'+
        'width:34px;height:34px;border-radius:50%;border:2px solid #d9b678;background:rgba(8,8,12,.72);'+
        'color:#fff4cf;font:800 17px/1 "Manrope",sans-serif;cursor:pointer;place-items:center;padding:0}'+
        '@media (pointer:coarse){'+
        '#minimap-wrap[data-stage="3"]{transform:none}'+
        '#minimap-wrap[data-stage="3"] .map-min-btn{display:grid}'+
        '#minimap-wrap[data-stage="3"] .map-zoom-controls{right:52px}}';
      document.head.appendChild(st);
      var mb=document.createElement('button');
      mb.type='button'; mb.className='map-min-btn'; mb.id='map-min-btn';
      mb.setAttribute('aria-label','Minimize map'); mb.textContent='\u2212';
      mb.addEventListener('click',function(e){ e.stopPropagation(); setMapStage(1); });
      wrap.appendChild(mb);
      var pd=null;
      wrap.addEventListener('pointerdown',function(e){ pd={x:e.clientX,y:e.clientY}; });
      wrap.addEventListener('click',function(e){
        if(!(window.matchMedia&&matchMedia('(pointer:coarse)').matches))return;
        if(mapStage!==1)return;
        if(e.target&&e.target.closest&&(e.target.closest('.map-zoom-controls')||e.target.closest('.map-min-btn')))return;
        if(pd&&Math.hypot(e.clientX-pd.x,e.clientY-pd.y)>8)return; /* a drag, not a tap */
        setMapStage(3);
      });
    })();
    var lastFrameT=performance.now();
    function animate(){
      requestAnimationFrame(animate);
      var nowMs=performance.now();
      var dt=Math.min(.05,(nowMs-lastFrameT)/1000);lastFrameT=nowMs;
      if(cityPhaseActive){
        /* Walkable downtown map owns the frame. */
        updateWalkMap(dt,nowMs/1000);
        if(walkPlayer)espilPaintAnchor.set(walkPlayer.pos.x,walkPlayer.pos.z);
        if(typeof ESPIL_P1!=='undefined'&&ESPIL_P1)espilP1PaintUpdate(); /* extrusion paint pass (zoom LOD) gate */
        espilP1Tick(); /* MAPBOX PHASE 1 tick */
        espilGlobeU.pole.value.copy(walkPlayer.pos);
        if(typeof EspilFader!=='undefined')EspilFader.tick(dt,mapCamera,walkPlayer);
        updateMapSky();
        updateProps();
        updateTraffic(dt);
        updateTrafficCars(dt);
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
        showCityInfo(selected);
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
    animate();
  }());
  