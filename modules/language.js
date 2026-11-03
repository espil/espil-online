
  /* Language selection (Han 2026-10-23). The selector sits beside the
     BGM button and shows the current language; the settings panel
     carries the same choice. Static chrome is tagged data-i18n /
     data-i18n-ph and re-rendered from this table; the two dynamic
     writers (character sub-line, ENTER AS ...) read through
     window.__espilT. City names, brand names, user content and
     JS-rendered editorial bodies are not translated. The choice
     persists in localStorage 'espil_lang'; the first visit follows
     the browser language. */
  (function(){
    "use strict";
    var NAMES={ko:'한국어',fr:'Français',en:'English',zh:'中文'};
    var ORDER=['ko','fr','en','zh'];
    var DICT={
noticeBtn:{en:'Notice',ko:'공지',fr:'Avis',zh:'通知'},
signinTitle:{en:'ENTER ESPIL ONLINE',ko:'ESPIL ONLINE 입장',fr:'ENTRER DANS ESPIL ONLINE',zh:'进入 ESPIL ONLINE'},
signinSub:{en:"Choose how you'd like to arrive.",ko:'어떻게 입장하시겠습니까?',fr:'Choisissez comment vous souhaitez arriver.',zh:'请选择您的进入方式。'},
guestEnter:{en:'ENTER AS GUEST',ko:'게스트로 입장',fr:'ENTRER EN INVITÉ',zh:'以访客身份进入'},
comingSoon:{en:'COMING SOON',ko:'준비 중',fr:'BIENTÔT DISPONIBLE',zh:'即将推出'},
noticeTitle:{en:'Notices',ko:'공지사항',fr:'Avis',zh:'公告'},
noticeSub:{en:'Espil Online news and updates',ko:'Espil Online 소식과 업데이트',fr:"Actualités et mises à jour d'Espil Online",zh:'Espil Online 新闻与更新'},
tabAnnounce:{en:'Announcements',ko:'공지',fr:'Annonces',zh:'公告'},
tabUpdates:{en:'Updates',ko:'업데이트',fr:'Mises à jour',zh:'更新'},
tabPlanned:{en:'Planned',ko:'예정',fr:'À venir',zh:'计划中'},
tabIssues:{en:'Known Issues & Bug Reports',ko:'알려진 문제와 버그 제보',fr:'Problèmes connus et rapports de bugs',zh:'已知问题与错误报告'},
introContinue:{en:'TAP OR PRESS ANY KEY TO CONTINUE',ko:'탭하거나 아무 키나 눌러 계속',fr:'TOUCHEZ OU APPUYEZ SUR UNE TOUCHE POUR CONTINUER',zh:'点按或按任意键继续'},
charTitle:{en:'CHOOSE YOUR CHARACTER',ko:'캐릭터 선택',fr:'CHOISISSEZ VOTRE PERSONNAGE',zh:'选择您的角色'},
charSub:{en:'Your traveler for {city}.',ko:'{city} 여행을 함께할 캐릭터입니다.',fr:'Votre voyageur pour {city}.',zh:'您在{city}的旅行者。'},
male:{en:'Male',ko:'남성',fr:'Homme',zh:'男性'},
female:{en:'Female',ko:'여성',fr:'Femme',zh:'女性'},
readyM:{en:'Ready',ko:'준비 완료',fr:'Prêt',zh:'已就绪'},
readyF:{en:'Ready',ko:'준비 완료',fr:'Prête',zh:'已就绪'},
enterAsMale:{en:'ENTER AS MALE',ko:'남성으로 입장',fr:'ENTRER EN HOMME',zh:'以男性身份进入'},
enterAsFemale:{en:'ENTER AS FEMALE',ko:'여성으로 입장',fr:'ENTRER EN FEMME',zh:'以女性身份进入'},
returnEarth:{en:'RETURN TO EARTH',ko:'지구로 돌아가기',fr:'RETOUR À LA TERRE',zh:'返回地球'},
storeChoose:{en:'Choose a place',ko:'장소를 선택하세요',fr:'Choisissez un lieu',zh:'选择一个地点'},
storeHint:{en:'↑↓ to select, Enter to interact, ESC to cancel',ko:'↑↓ 선택, Enter 상호작용, ESC 취소',fr:'↑↓ pour choisir, Entrée pour interagir, Échap pour annuler',zh:'↑↓ 选择，Enter 互动，ESC 取消'},
storeBack:{en:'← Back',ko:'← 뒤로',fr:'← Retour',zh:'← 返回'},
storeInfo:{en:'Info',ko:'정보',fr:'Infos',zh:'信息'},
storeReviews:{en:'Reviews',ko:'리뷰',fr:'Avis',zh:'评价'},
storePhotos:{en:'Photos',ko:'사진',fr:'Photos',zh:'照片'},
storeEnter:{en:'Enter →',ko:'입장 →',fr:'Entrer →',zh:'进入 →'},
sprintOn:{en:'SPRINT ON',ko:'질주 켜짐',fr:'SPRINT ACTIVÉ',zh:'疾跑开启'},
sprint:{en:'SPRINT',ko:'질주',fr:'SPRINT',zh:'疾跑'},
interact:{en:'Interact',ko:'상호작용',fr:'Interagir',zh:'互动'},
dive:{en:'DIVE',ko:'다이브',fr:'PLONGER',zh:'潜入'},
entryTap:{en:'TAP OR PRESS ANY KEY TO ENTER',ko:'탭하거나 아무 키나 눌러 입장',fr:'TOUCHEZ OU APPUYEZ SUR UNE TOUCHE POUR ENTRER',zh:'点按或按任意键进入'},
loadingCity:{en:'LOADING CITY…',ko:'도시 불러오는 중…',fr:'CHARGEMENT DE LA VILLE…',zh:'正在加载城市…'},
csKicker:{en:'TESTING PHASE',ko:'테스트 단계',fr:'PHASE DE TEST',zh:'测试阶段'},
csTitle:{en:'COMING SOON',ko:'곧 공개',fr:'BIENTÔT',zh:'即将推出'},
csBack:{en:'← BACK TO EARTH',ko:'← 지구로 돌아가기',fr:'← RETOUR À LA TERRE',zh:'← 返回地球'},
setTitle:{en:'SETTINGS',ko:'설정',fr:'PARAMÈTRES',zh:'设置'},
setSub:{en:'Options for your walk in the world.',ko:'이 세계를 걷는 여정을 위한 옵션입니다.',fr:'Options pour votre voyage dans ce monde.',zh:'为您在这个世界的旅程提供的选项。'},
citySelect:{en:'CITY SELECT',ko:'도시 선택',fr:'CHOIX DE LA VILLE',zh:'城市选择'},
langLabel:{en:'LANGUAGE',ko:'언어',fr:'LANGUE',zh:'语言'},
setReturn:{en:'Return to Earth',ko:'지구로 돌아가기',fr:'Retour à la Terre',zh:'返回地球'},
setGuide:{en:'Guide - learn the world with Espil',ko:'가이드 - Espil과 함께 세계 배우기',fr:'Guide - découvrez le monde avec Espil',zh:'指南 - 与 Espil 一起了解世界'},
buttonSettings:{en:'BUTTON SETTINGS',ko:'버튼 설정',fr:'PARAMÈTRES DES TOUCHES',zh:'按键设置'},
kbJump:{en:'Jump',ko:'점프',fr:'Saut',zh:'跳跃'},
kbInteract:{en:'Interact',ko:'상호작용',fr:'Interagir',zh:'互动'},
kbStall:{en:'Stall',ko:'노점',fr:'Étal',zh:'摊位'},
kbReset:{en:'Reset buttons',ko:'버튼 초기화',fr:'Réinitialiser les touches',zh:'重置按键'},
kbNote:{en:'Choose a button, then press the new key. Movement stays on the arrow keys and the joystick.',ko:'버튼을 고른 뒤 새 키를 누르세요. 이동은 방향키와 조이스틱을 그대로 씁니다.',fr:'Choisissez une touche, puis appuyez sur la nouvelle. Le déplacement reste aux flèches et au joystick.',zh:'选择一个按键，然后按下新键。移动仍使用方向键和摇杆。'},
soundSettings:{en:'SOUND SETTINGS',ko:'소리 설정',fr:'PARAMÈTRES SONORES',zh:'声音设置'},
musicVol:{en:'Music volume',ko:'음악 볼륨',fr:'Volume de la musique',zh:'音乐音量'},
mute:{en:'Mute',ko:'음소거',fr:'Muet',zh:'静音'},
logout:{en:'Log out',ko:'로그아웃',fr:'Se déconnecter',zh:'退出登录'},
devInfo:{en:'Developer info',ko:'개발자 정보',fr:'Infos développeur',zh:'开发者信息'},
chatChannel:{en:'Channel',ko:'채널',fr:'Canal',zh:'频道'},
chatLocal:{en:'Local',ko:'주변',fr:'Local',zh:'本地'},
chatParty:{en:'Party',ko:'파티',fr:'Groupe',zh:'队伍'},
chatPh:{en:'Press Enter to chat…',ko:'Enter를 눌러 채팅…',fr:'Appuyez sur Entrée pour discuter…',zh:'按 Enter 聊天…'},
keeperTitle:{en:'KEEPER',ko:'키퍼',fr:'GARDIEN',zh:'守护者'},
keeperSub:{en:"Espil's own craft — the cauldron is both forge and weapon.",ko:'Espil 본인의 기예입니다. 가마솥은 대장간이자 무기입니다.',fr:"L'art propre d'Espil — le chaudron est à la fois forge et arme.",zh:'Espil 本人的技艺——大锅既是锻炉，也是武器。'},
studyBtn:{en:'▶ Watch a video (demo) +5',ko:'▶ 영상 보기 (데모) +5',fr:'▶ Regarder une vidéo (démo) +5',zh:'▶ 观看视频（演示）+5'},
keeperNote:{en:'Knowledge comes from watching videos — not from leveling up. Spend it to grow each branch toward mastery.',ko:'지식은 영상을 보며 얻습니다. 레벨업으로는 얻지 못합니다. 지식을 써서 각 가지를 숙련으로 키우세요.',fr:'Le savoir vient des vidéos — pas des niveaux. Dépensez-le pour faire grandir chaque branche vers la maîtrise.',zh:'知识来自观看视频，而不是升级。用知识让每个分支走向精通。'},
keeperFoot:{en:'Walking, running, jumping — every human movement is a skill. New branches grow with the combat update.',ko:'걷기, 달리기, 점프까지 사람의 모든 움직임이 스킬입니다. 새 가지는 전투 업데이트와 함께 자랍니다.',fr:'Marcher, courir, sauter — chaque mouvement humain est une compétence. De nouvelles branches viendront avec la mise à jour combat.',zh:'行走、奔跑、跳跃——人的每个动作都是技能。新分支将随战斗更新到来。'},
invTitle:{en:'INVENTORY',ko:'인벤토리',fr:'INVENTAIRE',zh:'物品栏'},
invSub:{en:'Your belongings. Press I to close.',ko:'소지품입니다. I를 눌러 닫습니다.',fr:'Vos affaires. Appuyez sur I pour fermer.',zh:'您的物品。按 I 关闭。'},
invEmpty:{en:'Empty for now.',ko:'아직 비어 있습니다.',fr:'Vide pour le moment.',zh:'目前是空的。'},
charPanelTitle:{en:'CHARACTER',ko:'캐릭터',fr:'PERSONNAGE',zh:'角色'},
charPanelSub:{en:'Status and outfit. Press P to close.',ko:'상태와 복장입니다. P를 눌러 닫습니다.',fr:'État et tenue. Appuyez sur P pour fermer.',zh:'状态与服装。按 P 关闭。'},
charPanelFoot:{en:'Outfit system arrives with the character update.',ko:'복장 시스템은 캐릭터 업데이트와 함께 옵니다.',fr:'Le système de tenues arrivera avec la mise à jour des personnages.',zh:'服装系统将随角色更新到来。'},
friendsTitle:{en:'FRIENDS / PARTY',ko:'친구 / 파티',fr:'AMIS / GROUPE',zh:'好友 / 队伍'},
friendsSub:{en:'Press P to close. Right-click a character to invite or add a friend.',ko:'P를 눌러 닫습니다. 캐릭터를 우클릭하면 파티 초대와 친구 등록을 할 수 있습니다.',fr:'Appuyez sur P pour fermer. Clic droit sur un personnage pour inviter ou ajouter un ami.',zh:'按 P 关闭。右键单击角色可邀请或添加好友。'},
humanMark:{en:'\u2713 Human-checked \u00b7 every page is read by me before it goes live',ko:'\u2713 사람이 직접 확인합니다 \u00b7 올라가기 전에 한 페이지씩 읽고 올립니다',fr:'\u2713 V\u00e9rifi\u00e9 par un humain \u00b7 chaque page est relue avant publication',zh:'\u2713 真人确认 \u00b7 每页发布前都由真人阅读'},
friendsNone:{en:'No friends yet. Add by username:',ko:'아직 친구가 없습니다. 사용자 이름으로 추가하세요:',fr:"Pas encore d'amis. Ajoutez par nom d'utilisateur :",zh:'还没有好友。通过用户名添加：'},
usernamePh:{en:'Username',ko:'사용자 이름',fr:"Nom d'utilisateur",zh:'用户名'},
add:{en:'ADD',ko:'추가',fr:'AJOUTER',zh:'添加'},
friendsLocal:{en:'Friend list is local only until the server is ready.',ko:'친구 목록은 서버가 열리기 전까지 이 기기에만 저장됩니다.',fr:"La liste d'amis reste locale tant que le serveur n'est pas prêt.",zh:'在服务器就绪之前，好友列表仅保存在本地。'},
partyHead:{en:'PARTY',ko:'파티',fr:'GROUPE',zh:'队伍'},
partyNote:{en:'Party invites need the server - they arrive when the server opens.',ko:'파티 초대에는 서버가 필요합니다. 서버가 열리면 옵니다.',fr:'Les invitations de groupe nécessitent le serveur — elles arriveront à son ouverture.',zh:'队伍邀请需要服务器——服务器开放后即可使用。'},
stallTitle:{en:'My Stall',ko:'내 노점',fr:'Mon étal',zh:'我的摊位'},
stallSub:{en:'Press Y to close. You can open one stall per city.',ko:'Y를 눌러 닫습니다. 도시마다 노점 하나를 열 수 있습니다.',fr:'Appuyez sur Y pour fermer. Un étal par ville.',zh:'按 Y 关闭。每个城市可以开设一个摊位。'},
stallNameLabel:{en:'Stall name',ko:'노점 이름',fr:"Nom de l'étal",zh:'摊位名称'},
stallNamePh:{en:'My Stall',ko:'내 노점',fr:'Mon étal',zh:'我的摊位'},
stallOpen:{en:'Open stall here',ko:'여기에 노점 열기',fr:"Ouvrir l'étal ici",zh:'在这里摆摊'},
stallCloseBtn:{en:'Close stall',ko:'노점 닫기',fr:"Fermer l'étal",zh:'关闭摊位'},
stallView:{en:'View as visitor',ko:'방문자 시점으로 보기',fr:'Voir en visiteur',zh:'以访客视角查看'},
stallFormTitle:{en:'Add a post - pick an empty slot, fill this in, and Post',ko:'게시물 추가 - 빈 칸을 고르고 내용을 채운 뒤 게시하세요',fr:'Ajouter une annonce - choisissez un emplacement vide, remplissez et publiez',zh:'添加帖子——选择一个空位，填写后发布'},
selling:{en:'Selling',ko:'판매 중',fr:'Vente',zh:'出售'},
buying:{en:'Buying',ko:'구매 중',fr:'Achat',zh:'求购'},
kindItem:{en:'Item',ko:'아이템',fr:'Objet',zh:'物品'},
kindService:{en:'Service',ko:'서비스',fr:'Service',zh:'服务'},
stallTitlePh:{en:'Title (e.g. Espil House model)',ko:'제목 (예: Espil House 모형)',fr:'Titre (ex. modèle Espil House)',zh:'标题（例如 Espil House 模型）'},
stallPricePh:{en:'Price (Leo amount, blank = negotiable)',ko:'가격 (Leo 금액, 비우면 협의 가능)',fr:'Prix (montant en Leo, vide = négociable)',zh:'价格（Leo 金额，留空 = 可协商）'},
stallNotePh:{en:'Note (optional)',ko:'메모 (선택)',fr:'Note (optionnel)',zh:'备注（可选）'},
post:{en:'Post',ko:'게시',fr:'Publier',zh:'发布'},
deletePost:{en:'Delete post',ko:'게시물 삭제',fr:"Supprimer l'annonce",zh:'删除帖子'},
stallFoot:{en:'The stall window is a grid, the way the classic merchant stalls did it: every post takes one slot with its price tag. No fees, ever - trading here runs on trust. Real item trading and Leo settlement arrive when the server opens.',ko:'노점 창은 고전 상인 노점처럼 칸으로 나뉩니다. 게시물 하나가 가격표를 달고 한 칸을 차지합니다. 수수료는 영원히 없습니다. 이곳의 거래는 신뢰로 돌아갑니다. 실제 아이템 거래와 Leo 정산은 서버가 열리면 옵니다.',fr:"La fenêtre de l'étal est une grille, comme les étals marchands classiques : chaque annonce occupe un emplacement avec son prix. Aucun frais, jamais — ici, le commerce repose sur la confiance. Le vrai échange d'objets et le règlement en Leo arriveront avec le serveur.",zh:'摊位窗口是网格状的，就像经典的商人摊位：每个帖子占一个格子并带有价格标签。永远不收取费用——这里的交易靠信任运转。真正的物品交易和 Leo 结算将在服务器开放后到来。'},
guideBack:{en:'Back',ko:'뒤로',fr:'Retour',zh:'返回'},
guideNext:{en:'Next',ko:'다음',fr:'Suivant',zh:'下一步'},
bldgEnter:{en:'Enter',ko:'입장',fr:'Entrer',zh:'进入'},
bldgClose:{en:'Close',ko:'닫기',fr:'Fermer',zh:'关闭'},
bldgFoot:{en:'You step inside this building, at its real size and place.',ko:'실제 크기와 자리 그대로 이 건물 안으로 들어갑니다.',fr:'Vous entrez dans ce bâtiment, à sa taille et à sa place réelles.',zh:'您将按真实大小和位置进入这座建筑。'},
bldgInsideSub:{en:'You are inside this building.',ko:'이 건물 안에 있습니다.',fr:'Vous êtes dans ce bâtiment.',zh:'您正在这座建筑内。'},
findStores:{en:'Find stores',ko:'상점 찾기',fr:'Trouver des boutiques',zh:'查找商店'},
contact:{en:'Contact',ko:'연락',fr:'Contact',zh:'联系'},
leaveBuilding:{en:'Leave building',ko:'건물 나가기',fr:'Quitter le bâtiment',zh:'离开建筑'}
    };
    var cur='en';
    try{
      var saved=localStorage.getItem('espil_lang');
      if(saved&&NAMES[saved])cur=saved;
      else{
        var nav=(navigator.language||'en').slice(0,2).toLowerCase();
        if(NAMES[nav])cur=nav;
      }
    }catch(e){}
    function t(key){
      var row=DICT[key];
      if(!row)return key;
      return row[cur]||row.en||key;
    }
    window.__espilT=t;
    window.__espilLang=function(){ return cur; };
    function apply(){
      document.documentElement.setAttribute('lang',cur==='zh'?'zh-CN':cur);
      var els=document.querySelectorAll('[data-i18n]');
      for(var i=0;i<els.length;i++){
        var k=els[i].getAttribute('data-i18n');
        if(DICT[k])els[i].textContent=t(k);
      }
      var phs=document.querySelectorAll('[data-i18n-ph]');
      for(var j=0;j<phs.length;j++){
        var k2=phs[j].getAttribute('data-i18n-ph');
        if(DICT[k2])phs[j].setAttribute('placeholder',t(k2));
      }
      var btn=document.getElementById('lang-toggle');
      if(btn)btn.textContent=NAMES[cur];
      var opts=document.querySelectorAll('.lang-opt');
      for(var m=0;m<opts.length;m++){
        var on=opts[m].getAttribute('data-lang')===cur;
        opts[m].classList.toggle('on',on);
        opts[m].setAttribute('aria-selected',on?'true':'false');
      }
      var sel=document.getElementById('opt-lang');
      if(sel&&sel.value!==cur)sel.value=cur;
      /* the character panel's dynamic lines follow the language too */
      var panel=document.getElementById('char-custom');
      if(panel&&panel.getAttribute('aria-hidden')==='false'){
        var csub=panel.querySelector('.char-sub');
        if(csub&&typeof window.espilCityDisplayName==='function')
          csub.textContent=t('charSub').replace('{city}',window.espilCityDisplayName());
        var conf=document.getElementById('char-confirm');
        var maleCard=document.getElementById('char-male');
        if(conf)
          conf.innerHTML=t(maleCard&&maleCard.classList.contains('is-selected')?'enterAsMale':'enterAsFemale')+' &rarr;';
      }
    }
    window.__espilSetLang=function(code){
      if(!NAMES[code])return;
      cur=code;
      try{ localStorage.setItem('espil_lang',code); }catch(e){}
      apply();
    };
    var toggle=document.getElementById('lang-toggle');
    var menu=document.getElementById('lang-menu');
    function closeMenu(){
      if(menu){ menu.classList.remove('open'); menu.setAttribute('aria-hidden','true'); }
      if(toggle)toggle.setAttribute('aria-expanded','false');
    }
    if(toggle&&menu){
      toggle.addEventListener('click',function(e){
        e.stopPropagation();
        var open=menu.classList.toggle('open');
        menu.setAttribute('aria-hidden',open?'false':'true');
        toggle.setAttribute('aria-expanded',open?'true':'false');
      });
      var opts=menu.querySelectorAll('.lang-opt');
      for(var i=0;i<opts.length;i++){
        (function(b){
          b.addEventListener('click',function(){
            window.__espilSetLang(b.getAttribute('data-lang'));
            closeMenu();
          });
        })(opts[i]);
      }
      document.addEventListener('pointerdown',function(e){
        if(menu.classList.contains('open')&&!e.target.closest('#lang-wrap'))closeMenu();
      });
      document.addEventListener('keydown',function(e){ if(e.key==='Escape')closeMenu(); });
    }
    var sel=document.getElementById('opt-lang');
    if(sel)sel.addEventListener('change',function(){ window.__espilSetLang(sel.value); });
    apply();
  })();
