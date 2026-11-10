/* __espilGearWindow v2 - EverPlanet-style character window + bag.
   Successor of __espilPanels v1 (same storage keys, purchase
   mirror, P-key ownership and window.__espilGear surface): the
   profile (P) carries 13 equipment slots around the character,
   a separate fashion (치장) layer, and the EverPlanet stat
   blocks (기본 능력치 / 주요 능력치); the inventory (I) is a
   bag with category tabs, an icon grid and an item detail pane.
   v2 (Han, UI room 2026-11-04): the preview IS the customizer
   character - the EP customizer's part frames (skin / lower /
   upper / foot / face / hair / weapon, 24-frame idle) composited
   live from ~/workspace/ui-room/gear/ep-parts (512 px webp,
   served as assets/ep-parts/), with worn top and weapon mapped
   onto the real garment / weapon part sets; both windows wear
   the logwood concept (assets/tex/logwood.jpg, the same texture
   as the HUD tray). Spec: ~/workspace/ui-room/gear/SPEC.md.
   __espilGearWindow END */
(function () {
  'use strict';

  /* ---------------- storage (v1-compatible keys) ---------------- */
  var LS_OWN = 'espil_owned_items', LS_EQ = 'espil_equipped',
      LS_LOOK = 'espil_equipped_look', LS_SEED = 'espil_gear_seeded',
      LS_TITLE = 'espil_gear_title', LS_TITLES = 'espil_titles';
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function getJSON(k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? dflt : v; } catch (e) { return dflt; } }
  function setJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ownedList() { var a = getJSON(LS_OWN, []); return Array.isArray(a) ? a : []; }
  function saveOwned(a) { setJSON(LS_OWN, a); }
  function ownedCounts() { var m = {}, order = []; ownedList().forEach(function (n) { if (!(n in m)) order.push(n); m[n] = (m[n] || 0) + 1; }); return order.map(function (n) { return { name: n, n: m[n] }; }); }
  function equippedMap() { var o = getJSON(LS_EQ, {}); return o && typeof o === 'object' ? o : {}; }
  function lookMap() { var o = getJSON(LS_LOOK, {}); return o && typeof o === 'object' ? o : {}; }
  function saveEq(m) { setJSON(LS_EQ, m); }
  function saveLook(m) { setJSON(LS_LOOK, m); }

  /* ---------------- slots ---------------- */
  var SLOT_DEFS = [
    { key: 'head',     kr: '모자',   col: 'L' },
    { key: 'earring',  kr: '귀걸이', col: 'L' },
    { key: 'necklace', kr: '목걸이', col: 'L' },
    { key: 'glove',    kr: '장갑',   col: 'L' },
    { key: 'cape',     kr: '망토',   col: 'L' },
    { key: 'top',      kr: '상의',   col: 'R' },
    { key: 'bottom',   kr: '하의',   col: 'R' },
    { key: 'shoes',    kr: '신발',   col: 'R' },
    { key: 'belt',     kr: '벨트',   col: 'R' },
    { key: 'pet',      kr: '펫',     col: 'R' },
    { key: 'weapon',   kr: '무기',   col: 'B' },
    { key: 'ring1',    kr: '반지',   col: 'B' },
    { key: 'ring2',    kr: '반지',   col: 'B' }
  ];
  var SLOT_KR = {}; SLOT_DEFS.forEach(function (s) { SLOT_KR[s.key] = s.kr; });
  var SLOT_RE = [
    ['weapon', /sword|blade|bow|staff|wand|axe|dagger|spear|hammer|mace|gun|pistol|검|지팡이|활|단검/i],
    ['head', /hat|helm|hood|cap|crown|circlet|모자|투구|후드/i],
    ['top', /armor|armour|robe|coat|shirt|vest|outfit|suit|tunic|상의|갑옷|로브/i],
    ['bottom', /pants|trousers|skirt|하의|바지/i],
    ['shoes', /shoes|boots|boots|신발|부츠/i],
    ['glove', /glove|gauntlet|장갑/i],
    ['cape', /cape|cloak|망토/i],
    ['earring', /earring|귀걸이/i],
    ['necklace', /necklace|amulet|pendant|목걸이/i],
    ['belt', /belt|벨트/i],
    ['pet', /pet|펫/i],
    ['ring', /ring|반지/i],
    ['accessory', /charm|bracelet|gem/i]
  ];
  function slotOf(name) {
    var it = DB_LOOKUP[String(name).toLowerCase()];
    if (it) return it.slot;
    for (var i = 0; i < SLOT_RE.length; i++) if (SLOT_RE[i][1].test(name)) return SLOT_RE[i][0];
    return null;
  }

  /* ---------------- item DB ----------------
     app: {shape, c1, c2} - appearance descriptor for the preview
     painter and the bag icons. stats fields: str acc int dex vit
     wil; atk / matk are [min, max] ranges on weapons. */
  var GRADES = { '일반': '#b8c4c9', '고급': '#79c26a', '희귀': '#5ea9e6', '영웅': '#b07fe8', '전설': '#f2a93b' };
  var DB = [
    { name: 'Worn Wooden Sword', kr: '낡은 목검', slot: 'weapon', kind: 'equip', element: 'neutral', grade: '일반', atk: [3, 7], def: 0, mdef: 0, price: 30, ep: { weapon: 'greatsword' }, app: { shape: 'sword', c1: '#b08954', c2: '#7a5a34' }, desc: '연습용으로 깎은 목검. 가볍고 손에 익습니다.' },
    { name: 'Practice Staff', kr: '연습용 지팡이', slot: 'weapon', kind: 'equip', element: 'neutral', grade: '일반', matk: [4, 9], int: 2, def: 0, mdef: 0, price: 35, ep: { weapon: 'staff' }, app: { shape: 'staff', c1: '#8a6844', c2: '#57a7e8' }, desc: '끝에 작은 마력석이 박힌 연습용 지팡이.' },
    { name: 'Iron Sword', kr: '철검', slot: 'weapon', kind: 'equip', element: 'neutral', grade: '고급', atk: [9, 15], str: 2, def: 0, mdef: 0, price: 140, ep: { weapon: 'greatsword' }, app: { shape: 'sword', c1: '#cfd8de', c2: '#5d6d78' }, desc: '단단하게 벼린 철검. 균형이 좋습니다.' },
    { name: 'Hunter Bow', kr: '사냥꾼 활', slot: 'weapon', kind: 'equip', element: 'neutral', grade: '고급', atk: [7, 13], acc: 4, dex: 2, def: 0, mdef: 0, price: 130, ep: { weapon: 'bow' }, app: { shape: 'bow', c1: '#8a6844', c2: '#e8e0cc' }, desc: '사냥꾼들이 애용하는 단단한 활.' },
    { name: 'Silver Dagger', kr: '은 단검', slot: 'weapon', kind: 'equip', element: 'neutral', grade: '희귀', atk: [11, 17], dex: 3, acc: 3, def: 0, mdef: 0, price: 320, ep: { weapon: 'dagger' }, app: { shape: 'dagger', c1: '#e8eef2', c2: '#7a4a8c' }, desc: '은으로 날을 세운 단검. 빠르고 조용합니다.' },
    { name: 'Ember Saber', kr: '불꽃 세이버', slot: 'weapon', kind: 'equip', element: 'fire', grade: '희귀', atk: [13, 19], str: 2, def: 0, mdef: 0, price: 520, ep: { weapon: 'greatsword' }, app: { shape: 'sword', c1: '#e86a3a', c2: '#8f2f1a' }, desc: '날에 불꽃이 깃든 세이버. 이름처럼 붉게 타오릅니다.' },
    { name: 'Frostbrand', kr: '서리검 프로스트브랜드', slot: 'weapon', kind: 'equip', element: 'water', grade: '희귀', atk: [12, 18], int: 2, def: 0, mdef: 0, price: 540, ep: { weapon: 'ice_sword' }, app: { shape: 'sword', c1: '#bfe9ff', c2: '#4f9cf2' }, desc: '닿는 것을 얼리는 서리 날의 검.' },
    { name: 'Storm Bow', kr: '폭풍 활', slot: 'weapon', kind: 'equip', element: 'wind', grade: '영웅', atk: [15, 22], dex: 4, acc: 4, def: 0, mdef: 0, price: 890, ep: { weapon: 'bow' }, app: { shape: 'bow', c1: '#7dfce6', c2: '#2e8b74' }, desc: '시위를 당기면 바람이 운다는 활.' },
    { name: 'Thorn Staff', kr: '가시 지팡이', slot: 'weapon', kind: 'equip', element: 'earth', grade: '고급', matk: [10, 16], int: 4, def: 0, mdef: 0, price: 460, ep: { weapon: 'staff' }, app: { shape: 'staff', c1: '#6a8a4a', c2: '#58c96b' }, desc: '덩굴 가시가 휘감긴 지팡이. 대지의 기운이 서려 있습니다.' },
    { name: 'Moon Dagger', kr: '달빛 단검', slot: 'weapon', kind: 'equip', element: 'dark', grade: '영웅', atk: [16, 23], dex: 5, acc: 3, def: 0, mdef: 0, price: 920, ep: { weapon: 'dagger' }, app: { shape: 'dagger', c1: '#8f6fc9', c2: '#3a2a5e' }, desc: '달빛을 모아 벼린 단검. 어둠 속에서 더 빛납니다.' },
    { name: 'Dawn Blade', kr: '새벽검', slot: 'weapon', kind: 'equip', element: 'light', grade: '전설', atk: [19, 27], str: 4, wil: 2, def: 0, mdef: 0, price: 1600, ep: { weapon: 'greatsword' }, app: { shape: 'sword', c1: '#ffd23c', c2: '#f28ad0' }, desc: '새벽빛을 머금은 검. 전설의 등급에 걸맞은 위용입니다.' },
    { name: 'Cloth Cap', kr: '천 모자', slot: 'head', kind: 'equip', grade: '일반', def: 2, mdef: 0, price: 20, app: { shape: 'cap', c1: '#c95f4f', c2: '#8f3a30' }, desc: '부드러운 천으로 만든 모자.' },
    { name: 'Leather Hood', kr: '가죽 후드', slot: 'head', kind: 'equip', grade: '고급', def: 4, mdef: 1, dex: 1, price: 90, app: { shape: 'hood', c1: '#7a5a34', c2: '#54401f' }, desc: '비바람을 막아 주는 가죽 후드.' },
    { name: 'Knight Helm', kr: '기사단 투구', slot: 'head', kind: 'equip', grade: '희귀', def: 8, mdef: 2, vit: 2, price: 300, app: { shape: 'helm', c1: '#c7d0d6', c2: '#8f2f2f' }, desc: '기사단의 문양이 새겨진 투구.' },
    { name: 'Traveler Top', kr: '여행자 상의', slot: 'top', kind: 'equip', grade: '일반', def: 4, mdef: 1, price: 40, ep: { upper: 'leather' }, app: { shape: 'shirt', c1: '#57a773', c2: '#3c7a52' }, desc: '먼 길에도 끄떡없는 여행자 상의.' },
    { name: 'Padded Armor', kr: '누비 갑옷', slot: 'top', kind: 'equip', grade: '고급', def: 9, mdef: 2, vit: 2, price: 180, ep: { upper: 'plate' }, app: { shape: 'armor', c1: '#7d8a94', c2: '#4d565e' }, desc: '두툼하게 누빈 갑옷. 충격을 잘 흡수합니다.' },
    { name: 'Mage Robe', kr: '마법 로브', slot: 'top', kind: 'equip', grade: '희귀', def: 6, mdef: 6, int: 5, price: 340, ep: { upper: 'default' }, app: { shape: 'robe', c1: '#6a4a9e', c2: '#422a6e' }, desc: '마력이 실처럼 짜인 로브.' },
    { name: 'Traveler Bottom', kr: '여행자 하의', slot: 'bottom', kind: 'equip', grade: '일반', def: 3, mdef: 0, price: 35, app: { shape: 'pants', c1: '#5d6d78', c2: '#3e4a52' }, desc: '무릎이 튼튼한 여행자 하의.' },
    { name: 'Leather Pants', kr: '가죽 바지', slot: 'bottom', kind: 'equip', grade: '고급', def: 6, mdef: 1, dex: 1, price: 120, app: { shape: 'pants', c1: '#7a5a34', c2: '#54401f' }, desc: '질긴 가죽으로 만든 바지.' },
    { name: 'Leather Shoes', kr: '가죽 신발', slot: 'shoes', kind: 'equip', grade: '일반', def: 2, mdef: 0, dex: 1, price: 25, app: { shape: 'boots', c1: '#8a6844', c2: '#5d4630' }, desc: '발에 잘 맞는 가죽 신발.' },
    { name: 'Swift Boots', kr: '신속의 부츠', slot: 'shoes', kind: 'equip', grade: '희귀', def: 5, mdef: 2, dex: 5, acc: 2, price: 310, app: { shape: 'boots', c1: '#3f7fbf', c2: '#274d75' }, desc: '발놀림이 가벼워지는 부츠.' },
    { name: 'Work Gloves', kr: '작업 장갑', slot: 'glove', kind: 'equip', grade: '일반', def: 1, mdef: 0, str: 1, price: 15, app: { shape: 'glove', c1: '#a8a29a', c2: '#6e6a63' }, desc: '손바닥이 두꺼운 작업 장갑.' },
    { name: 'Old Cape', kr: '낡은 망토', slot: 'cape', kind: 'equip', grade: '일반', def: 2, mdef: 1, price: 45, app: { shape: 'cape', c1: '#7a6a58', c2: '#54483a' }, desc: '오래됐지만 정이 드는 망토.' },
    { name: 'Copper Ring', kr: '구리 반지', slot: 'ring', kind: 'equip', grade: '일반', def: 0, mdef: 0, acc: 2, price: 25, app: { shape: 'ring', c1: '#c47b4a', c2: '#8f5630' }, desc: '소박한 구리 반지.' },
    { name: 'Silver Ring', kr: '은 반지', slot: 'ring', kind: 'equip', grade: '고급', def: 0, mdef: 2, int: 3, wil: 1, price: 150, app: { shape: 'ring', c1: '#dfe6ea', c2: '#57a7e8' }, desc: '은은하게 빛나는 은 반지.' },
    { name: 'Shell Necklace', kr: '조개 목걸이', slot: 'necklace', kind: 'equip', grade: '일반', def: 0, mdef: 1, wil: 2, price: 30, app: { shape: 'necklace', c1: '#e8dcc8', c2: '#e88ca0' }, desc: '바닷가 조개로 엮은 목걸이.' },
    { name: 'Pearl Earring', kr: '진주 귀걸이', slot: 'earring', kind: 'equip', grade: '고급', def: 0, mdef: 1, acc: 2, int: 1, price: 110, app: { shape: 'earring', c1: '#f2ead8', c2: '#cfc4a8' }, desc: '작은 진주가 달린 귀걸이.' },
    { name: 'Leather Belt', kr: '가죽 벨트', slot: 'belt', kind: 'equip', grade: '일반', def: 2, mdef: 0, vit: 1, price: 20, app: { shape: 'belt', c1: '#7a5a34', c2: '#c9a227' }, desc: '버클이 단단한 가죽 벨트.' },
    { name: 'Mochi Pet', kr: '모찌 펫', slot: 'pet', kind: 'equip', grade: '희귀', def: 0, mdef: 0, wil: 3, price: 500, app: { shape: 'pet', c1: '#f2b8c6', c2: '#e88ca0' }, desc: '말랑말랑한 작은 친구. 늘 곁을 따라다닙니다.' },
    { name: 'Worn Iron Shard', kr: '낡은 철 파편', slot: null, kind: 'mat', grade: '일반', matLine: 'weapon', matGrade: 'white', def: 0, mdef: 0, price: 10, app: { shape: 'shard', c1: '#e8e8e8', c2: '#4a4238' }, desc: '무기 제작 재료 (white).' },
    { name: 'Brass Shard', kr: '황동 파편', slot: null, kind: 'mat', grade: '일반', matLine: 'weapon', matGrade: 'yellow', def: 0, mdef: 0, price: 15, app: { shape: 'shard', c1: '#f2d54b', c2: '#4a4238' }, desc: '무기 제작 재료 (yellow).' },
    { name: 'Copper Ingot', kr: '구리 주괴', slot: null, kind: 'mat', grade: '고급', matLine: 'weapon', matGrade: 'green', def: 0, mdef: 0, price: 25, app: { shape: 'shard', c1: '#58c96b', c2: '#4a4238' }, desc: '무기 제작 재료 (green).' },
    { name: 'Steel Ingot', kr: '강철 주괴', slot: null, kind: 'mat', grade: '희귀', matLine: 'weapon', matGrade: 'blue', def: 0, mdef: 0, price: 45, app: { shape: 'shard', c1: '#4f9cf2', c2: '#4a4238' }, desc: '무기 제작 재료 (blue).' },
    { name: 'Mithril Shard', kr: '미스릴 파편', slot: null, kind: 'mat', grade: '영웅', matLine: 'weapon', matGrade: 'purple', def: 0, mdef: 0, price: 85, app: { shape: 'shard', c1: '#a86fe0', c2: '#4a4238' }, desc: '무기 제작 재료 (purple).' },
    { name: 'Dragonsteel Shard', kr: '용강 파편', slot: null, kind: 'mat', grade: '영웅', matLine: 'weapon', matGrade: 'red', def: 0, mdef: 0, price: 140, app: { shape: 'shard', c1: '#e04b4b', c2: '#4a4238' }, desc: '무기 제작 재료 (red).' },
    { name: 'Sunsteel Shard', kr: '태양강 파편', slot: null, kind: 'mat', grade: '전설', matLine: 'weapon', matGrade: 'gold', def: 0, mdef: 0, price: 220, app: { shape: 'shard', c1: '#f2b63c', c2: '#4a4238' }, desc: '무기 제작 재료 (gold).' },
    { name: 'Lunaris Shard', kr: '루나리스 파편', slot: null, kind: 'mat', grade: '전설', matLine: 'weapon', matGrade: 'pink', def: 0, mdef: 0, price: 350, app: { shape: 'shard', c1: '#f28ad0', c2: '#4a4238' }, desc: '무기 제작 재료 (pink).' },
    { name: 'Worn Hide Scrap', kr: '낡은 가죽 조각', slot: null, kind: 'mat', grade: '일반', matLine: 'armour', matGrade: 'white', def: 0, mdef: 0, price: 10, app: { shape: 'plate', c1: '#e8e8e8', c2: '#4a4238' }, desc: '방어구 제작 재료 (white).' },
    { name: 'Brass Stud', kr: '황동 징', slot: null, kind: 'mat', grade: '일반', matLine: 'armour', matGrade: 'yellow', def: 0, mdef: 0, price: 15, app: { shape: 'plate', c1: '#f2d54b', c2: '#4a4238' }, desc: '방어구 제작 재료 (yellow).' },
    { name: 'Copper Plate', kr: '구리 판', slot: null, kind: 'mat', grade: '고급', matLine: 'armour', matGrade: 'green', def: 0, mdef: 0, price: 25, app: { shape: 'plate', c1: '#58c96b', c2: '#4a4238' }, desc: '방어구 제작 재료 (green).' },
    { name: 'Steel Plate', kr: '강철 판', slot: null, kind: 'mat', grade: '희귀', matLine: 'armour', matGrade: 'blue', def: 0, mdef: 0, price: 45, app: { shape: 'plate', c1: '#4f9cf2', c2: '#4a4238' }, desc: '방어구 제작 재료 (blue).' },
    { name: 'Mithril Plate', kr: '미스릴 판', slot: null, kind: 'mat', grade: '영웅', matLine: 'armour', matGrade: 'purple', def: 0, mdef: 0, price: 85, app: { shape: 'plate', c1: '#a86fe0', c2: '#4a4238' }, desc: '방어구 제작 재료 (purple).' },
    { name: 'Dragon Scale', kr: '용 비늘', slot: null, kind: 'mat', grade: '영웅', matLine: 'armour', matGrade: 'red', def: 0, mdef: 0, price: 140, app: { shape: 'plate', c1: '#e04b4b', c2: '#4a4238' }, desc: '방어구 제작 재료 (red).' },
    { name: 'Sunsteel Plate', kr: '태양강 판', slot: null, kind: 'mat', grade: '전설', matLine: 'armour', matGrade: 'gold', def: 0, mdef: 0, price: 220, app: { shape: 'plate', c1: '#f2b63c', c2: '#4a4238' }, desc: '방어구 제작 재료 (gold).' },
    { name: 'Lunaris Silk', kr: '루나리스 실크', slot: null, kind: 'mat', grade: '전설', matLine: 'armour', matGrade: 'pink', def: 0, mdef: 0, price: 350, app: { shape: 'plate', c1: '#f28ad0', c2: '#4a4238' }, desc: '방어구 제작 재료 (pink).' },
    { name: 'Cracked Bead', kr: '금이 간 구슬', slot: null, kind: 'mat', grade: '일반', matLine: 'accessory', matGrade: 'white', def: 0, mdef: 0, price: 10, app: { shape: 'bead', c1: '#e8e8e8', c2: '#4a4238' }, desc: '장신구 제작 재료 (white).' },
    { name: 'Brass Charm', kr: '황동 부적', slot: null, kind: 'mat', grade: '일반', matLine: 'accessory', matGrade: 'yellow', def: 0, mdef: 0, price: 15, app: { shape: 'bead', c1: '#f2d54b', c2: '#4a4238' }, desc: '장신구 제작 재료 (yellow).' },
    { name: 'Jade Bead', kr: '비취 구슬', slot: null, kind: 'mat', grade: '고급', matLine: 'accessory', matGrade: 'green', def: 0, mdef: 0, price: 25, app: { shape: 'bead', c1: '#58c96b', c2: '#4a4238' }, desc: '장신구 제작 재료 (green).' },
    { name: 'Sapphire Bead', kr: '사파이어 구슬', slot: null, kind: 'mat', grade: '희귀', matLine: 'accessory', matGrade: 'blue', def: 0, mdef: 0, price: 45, app: { shape: 'bead', c1: '#4f9cf2', c2: '#4a4238' }, desc: '장신구 제작 재료 (blue).' },
    { name: 'Amethyst Bead', kr: '자수정 구슬', slot: null, kind: 'mat', grade: '영웅', matLine: 'accessory', matGrade: 'purple', def: 0, mdef: 0, price: 85, app: { shape: 'bead', c1: '#a86fe0', c2: '#4a4238' }, desc: '장신구 제작 재료 (purple).' },
    { name: 'Ruby Bead', kr: '루비 구슬', slot: null, kind: 'mat', grade: '영웅', matLine: 'accessory', matGrade: 'red', def: 0, mdef: 0, price: 140, app: { shape: 'bead', c1: '#e04b4b', c2: '#4a4238' }, desc: '장신구 제작 재료 (red).' },
    { name: 'Topaz Bead', kr: '토파즈 구슬', slot: null, kind: 'mat', grade: '전설', matLine: 'accessory', matGrade: 'gold', def: 0, mdef: 0, price: 220, app: { shape: 'bead', c1: '#f2b63c', c2: '#4a4238' }, desc: '장신구 제작 재료 (gold).' },
    { name: 'Lunaris Bead', kr: '루나리스 구슬', slot: null, kind: 'mat', grade: '전설', matLine: 'accessory', matGrade: 'pink', def: 0, mdef: 0, price: 350, app: { shape: 'bead', c1: '#f28ad0', c2: '#4a4238' }, desc: '장신구 제작 재료 (pink).' },
    { name: 'Revival Potion', kr: '부활 포션', slot: null, kind: 'use', grade: '캐시', cash: true, def: 0, mdef: 0, price: 0, app: { shape: 'drink', c1: '#e86a8a', c2: '#ffd23c' }, desc: '캐시 아이템 (10개에 $1). 쓰러졌을 때 그 자리에서 HP/MP 50%로 부활합니다. 캐시상점에서 구매할 수 있습니다.' }
  ];
  var DB_LOOKUP = {};
  DB.forEach(function (it) { DB_LOOKUP[it.name.toLowerCase()] = it; });
  var FOOD_PRICE = { 'Kimbap': 120, 'Triangle Kimbap': 100, 'Cup Ramen': 130, 'Hotteok': 150, 'Tteokbokki': 220, 'Fish Cake Skewer': 90, 'Banana Milk': 110, 'Canned Coffee': 100, 'Orange Juice': 120, 'Water': 50, 'Burger': 350, 'Fries': 180, 'Cola': 120, 'Fried Chicken': 420, 'Pizza Slice': 300, 'Hot Dog': 260, 'Milkshake': 240, 'Salad': 200 };
  /* RECOVERY - HP/MP restored when a kind:'use' item is consumed
     from the bag. DRAFT VALUES ONLY (Han decision D4 pending):
     tuned for review, not final. Foods lean HP, drinks lean MP,
     magnitude roughly scales with FOOD_PRICE. Covers every
     FOOD_PRICE name plus the shop's Onigiri. Exposed as
     window.__espilFoodRestore - the table the S1 combat core's
     'espil-item-used' listener (monolith.js) reads to apply the
     restores; this module's own listener below uses it too. */
  var RECOVERY = {
    'Onigiri': { hp: 30 },
    'Triangle Kimbap': { hp: 25 },
    'Kimbap': { hp: 40 },
    'Cup Ramen': { hp: 35, mp: 5 },
    'Banana Milk': { hp: 10, mp: 20 },
    'Canned Coffee': { mp: 25 },
    'Orange Juice': { hp: 5, mp: 15 },
    'Water': { mp: 10 },
    'Hotteok': { hp: 20 },
    'Tteokbokki': { hp: 45 },
    'Fish Cake Skewer': { hp: 15 },
    'Cola': { mp: 12 },
    'Burger': { hp: 55 },
    'Fries': { hp: 18 },
    'Fried Chicken': { hp: 65 },
    'Pizza Slice': { hp: 48 },
    'Hot Dog': { hp: 38 },
    'Milkshake': { hp: 22, mp: 10 },
    'Salad': { hp: 28 }
  };
  /* DRAFT - Han decision D4 pending. */
  window.__espilFoodRestore = RECOVERY;
  function itemOf(name) {
    var it = DB_LOOKUP[String(name).toLowerCase()];
    if (it) return it;
    var slot = null; for (var i = 0; i < SLOT_RE.length; i++) if (SLOT_RE[i][1].test(name)) { slot = SLOT_RE[i][0]; break; }
    if (slot === 'accessory') slot = 'necklace';
    /* Foods/drinks are anything in FOOD_PRICE or in the restore
       table - the latter also catches Onigiri (shop price Leo 2,
       not a FOOD_PRICE entry), so a bought Onigiri lands in the
       bag's use tab like every other consumable. */
    var isFood = Object.prototype.hasOwnProperty.call(FOOD_PRICE, name) ||
      Object.prototype.hasOwnProperty.call(RECOVERY, name);
    var buyPrice = Object.prototype.hasOwnProperty.call(FOOD_PRICE, name) ? FOOD_PRICE[name] : (name === 'Onigiri' ? 2 : 0);
    var foodShape = /ramen/i.test(name) ? 'cup' : (/milk|cola|coffee|juice|water|shake/i.test(name) ? 'drink' : 'food');
    return { name: name, kr: name, slot: slot, kind: slot ? 'equip' : (isFood ? 'use' : 'etc'),
      grade: '일반', def: 0, mdef: 0, price: isFood ? Math.max(1, Math.floor(buyPrice / 3)) : 10,
      app: { shape: slot || (isFood ? foodShape : 'box'), c1: '#9aa7ad', c2: '#5d6d78' },
      desc: isFood ? '먹으면 기운이 나는 음식.' : '' };
  }
  var STARTER = ['Worn Wooden Sword', 'Cloth Cap', 'Traveler Top', 'Traveler Bottom', 'Leather Shoes'];
  function seedStarter() {
    try { if (localStorage.getItem(LS_SEED)) return; } catch (e) { return; }
    var a = ownedList(), have = {};
    a.forEach(function (n) { have[n] = 1; });
    STARTER.forEach(function (n) { if (!have[n]) a.push(n); });
    saveOwned(a);
    try { localStorage.setItem(LS_SEED, '1'); } catch (e) {}
  }

  /* ---------------- equip / unequip ---------------- */
  function resolveSlot(name) {
    var s = slotOf(name);
    if (s === 'ring') { var m = equippedMap(); return (m.ring1 && m.ring1 !== name) ? 'ring2' : 'ring1'; }
    return s;
  }
  function resolveLookSlot(name) {
    var s = slotOf(name);
    if (s === 'ring') { var m = lookMap(); return (m.ring1 && m.ring1 !== name) ? 'ring2' : 'ring1'; }
    return s;
  }
  function gearChanged() {
    try { window.dispatchEvent(new CustomEvent('espil-gear-changed', { detail: { equipped: equippedMap(), look: lookMap() } })); } catch (e) {}
  }
  function equip(name) { var s = resolveSlot(name); if (!s) return null; var m = equippedMap(); m[s] = name; saveEq(m); gearChanged(); renderAll(); return s; }
  function unequip(slot) { var m = equippedMap(); delete m[slot]; saveEq(m); gearChanged(); renderAll(); }
  function equipLook(name) { var s = resolveLookSlot(name); if (!s) return null; var m = lookMap(); m[s] = name; saveLook(m); gearChanged(); renderAll(); return s; }
  function unequipLook(slot) { var m = lookMap(); delete m[slot]; saveLook(m); gearChanged(); renderAll(); }
  window.__espilGear = { owned: ownedCounts, equipped: equippedMap, slotOf: slotOf, equip: equip, unequip: unequip };

  /* S4 weapon stat hook for the S1 damage path (consumed guarded):
     the mid-range of the equipped weapon's atk, or matk when its
     mid is higher - same 0.4 cross-conversion as computeStats().
     Null when no weapon is equipped (or it carries no atk/matk). */
  window.__espilWeaponAtkMid = function () {
    var wname = equippedMap().weapon;
    if (!wname) return null;
    var it = itemOf(wname); if (!it) return null;
    var atk = tieredAtk(it), matk = tieredMatk(it);
    if (!atk && !matk) return null;
    var wAtk = atk || [Math.round(matk[0] * 0.4), Math.round(matk[1] * 0.4)];
    var wMatk = matk || [Math.round(atk[0] * 0.4), Math.round(atk[1] * 0.4)];
    return Math.max((wAtk[0] + wAtk[1]) / 2, (wMatk[0] + wMatk[1]) / 2);
  };

  /* S1 weapon element hook (consumed guarded): the equipped
     weapon's element tag from its item data. All five current
     weapons are 'neutral' - the field exists so an elemental
     weapon only has to change its data. */
  window.__espilWeaponElement = function () {
    var wname = equippedMap().weapon;
    if (!wname) return 'neutral';
    var it = itemOf(wname); if (!it) return 'neutral';
    return it.element || 'neutral';
  };

  /* S1 player DEF hook (consumed guarded): the character sheet's
     own Defense figure - computeStats().def, i.e. the sum of the
     equipped pieces' def plus the VIT contribution
     (round(vit x 1.5)), exactly what the profile panel shows. */
  window.__espilPlayerDef = function () {
    try { return computeStats().def; } catch (e) { return 0; }
  };

  /* ================= Batch 6 Item B: crafting =================
     Storage espil_craft_v1 {tiers: {weaponName: tier}}. A crafted
     tier raises the weapon's atk range by +2 min / +3 max per
     tier (matk likewise) in every stat path (computeStats,
     __espilWeaponAtkMid, the bag stat lines) and is displayed as
     a '+t' suffix. The tier also feeds the weapon-tree depth in
     Item C (monolith reads window.__espilCraftTier).
     RECIPES (data constants):
       upgrade: weapon-line parts 2 + tier, armour-line parts
         1 + floor(tier / 2), accessory-line parts 1 once tier >= 2;
         every part must be at or above the weapon's minimum
         material grade (GRADE_MIN_LADDER below).
       convert: weapon 3 + armour 1 + accessory 1 parts of any
         grade; the target must be another weapon of the same
         family (app.shape); the converted weapon starts at tier 0. */
  var LS_CRAFT = 'espil_craft_v1';
  var MAT_LADDER = ['white', 'yellow', 'green', 'blue', 'purple', 'red', 'gold', 'pink'];
  var GRADE_MIN_LADDER = { '일반': 0, '고급': 2, '희귀': 3, '영웅': 5, '전설': 6 };
  var CRAFT_RECIPES = {
    upgrade: { weaponPerTier: 1, weaponBase: 2, armourBase: 1, armourPerTwoTiers: 1, accessoryFromTier: 2, accessoryCount: 1 },
    convert: { weapon: 3, armour: 1, accessory: 1 }
  };
  function craftMap() { var m = getJSON(LS_CRAFT, {}); return (m && typeof m === 'object' && m.tiers) ? m : { tiers: {} }; }
  function craftTierOf(name) { var t = craftMap().tiers[name]; return (typeof t === 'number' && t > 0) ? Math.floor(t) : 0; }
  window.__espilCraftTier = craftTierOf;
  function saveCraft(m) { setJSON(LS_CRAFT, m); }
  function tieredAtk(it) { if (!it || !it.atk) return null; var t = craftTierOf(it.name); return t ? [it.atk[0] + 2 * t, it.atk[1] + 3 * t] : it.atk; }
  function tieredMatk(it) { if (!it || !it.matk) return null; var t = craftTierOf(it.name); return t ? [it.matk[0] + 2 * t, it.matk[1] + 3 * t] : it.matk; }
  function familyOf(it) { return it && it.app ? (it.app.shape || null) : null; }
  function upgradeCost(name) {
    var t = craftTierOf(name), it = itemOf(name);
    return { weapon: CRAFT_RECIPES.upgrade.weaponBase + CRAFT_RECIPES.upgrade.weaponPerTier * t,
             armour: CRAFT_RECIPES.upgrade.armourBase + Math.floor(t / 2) * CRAFT_RECIPES.upgrade.armourPerTwoTiers,
             accessory: t >= CRAFT_RECIPES.upgrade.accessoryFromTier ? CRAFT_RECIPES.upgrade.accessoryCount : 0,
             minLadder: GRADE_MIN_LADDER[it.grade] != null ? GRADE_MIN_LADDER[it.grade] : 0, tier: t };
  }
  function convertCost() {
    return { weapon: CRAFT_RECIPES.convert.weapon, armour: CRAFT_RECIPES.convert.armour,
             accessory: CRAFT_RECIPES.convert.accessory, minLadder: 0 };
  }
  function matCounts(minLadder) {
    var c = { weapon: 0, armour: 0, accessory: 0 };
    ownedList().forEach(function (n) {
      var it = DB_LOOKUP[String(n).toLowerCase()];
      if (it && it.kind === 'mat' && it.matLine && MAT_LADDER.indexOf(it.matGrade) >= minLadder) c[it.matLine]++;
    });
    return c;
  }
  function canAffordCraft(cost) {
    var c = matCounts(cost.minLadder || 0);
    return c.weapon >= (cost.weapon || 0) && c.armour >= (cost.armour || 0) && c.accessory >= (cost.accessory || 0);
  }
  function consumeCraft(cost) {
    var need = { weapon: cost.weapon || 0, armour: cost.armour || 0, accessory: cost.accessory || 0 };
    var minLadder = cost.minLadder || 0;
    var a = ownedList();
    /* lowest qualifying grade first, so the best parts survive */
    var order = a.map(function (n, i) {
      var it = DB_LOOKUP[String(n).toLowerCase()];
      return { n: n, i: i, line: (it && it.kind === 'mat') ? it.matLine : null,
               lad: (it && it.kind === 'mat') ? MAT_LADDER.indexOf(it.matGrade) : -1 };
    }).filter(function (o) { return o.line && o.lad >= minLadder && need[o.line] > 0; })
      .sort(function (x, y) { return x.lad - y.lad; });
    var dropIdx = {};
    order.forEach(function (o) { if (need[o.line] > 0) { need[o.line]--; dropIdx[o.i] = 1; } });
    if (need.weapon > 0 || need.armour > 0 || need.accessory > 0) return false;
    saveOwned(a.filter(function (_, i) { return !dropIdx[i]; }));
    return true;
  }
  function upgradeWeapon(name) {
    var it = itemOf(name);
    if (!it || it.slot !== 'weapon') return { ok: false, why: 'not-a-weapon' };
    if (ownedList().indexOf(name) < 0) return { ok: false, why: 'not-owned' };
    var cost = upgradeCost(name);
    if (!canAffordCraft(cost)) return { ok: false, why: 'materials', cost: cost };
    if (!consumeCraft(cost)) return { ok: false, why: 'materials', cost: cost };
    var m = craftMap(); m.tiers[name] = (m.tiers[name] || 0) + 1; saveCraft(m);
    gearChanged(); renderAll();
    return { ok: true, tier: m.tiers[name], cost: cost };
  }
  function convertWeapon(name, target) {
    var it = itemOf(name), tg = itemOf(target);
    if (!it || it.slot !== 'weapon' || !tg || tg.slot !== 'weapon') return { ok: false, why: 'not-a-weapon' };
    if (target === name) return { ok: false, why: 'same-weapon' };
    if (familyOf(it) !== familyOf(tg)) return { ok: false, why: 'family-mismatch' };
    var a = ownedList(), ix = a.indexOf(name);
    if (ix < 0) return { ok: false, why: 'not-owned' };
    var cost = convertCost();
    if (!canAffordCraft(cost)) return { ok: false, why: 'materials', cost: cost };
    if (!consumeCraft(cost)) return { ok: false, why: 'materials', cost: cost };
    a = ownedList(); ix = a.indexOf(name); a.splice(ix, 1); a.push(target); saveOwned(a);
    var m = craftMap(); if (m.tiers[target]) { delete m.tiers[target]; saveCraft(m); }
    var eq = equippedMap();
    if (eq.weapon === name) { eq.weapon = target; saveEq(eq); }
    gearChanged(); renderAll();
    return { ok: true, from: name, to: target, cost: cost };
  }
  window.__espilCraft = { recipes: CRAFT_RECIPES, tierOf: craftTierOf, tiers: function () { return craftMap().tiers; },
    upgradeCost: upgradeCost, convertCost: convertCost, matCounts: matCounts, canAfford: canAffordCraft,
    upgrade: upgradeWeapon, convert: convertWeapon, familyOf: function (name) { return familyOf(itemOf(name)); } };

  /* purchase mirror (v1 semantics): the shop fires espil-guide
     'bought' - record the item so the bag shows it */
  /* Batch 6 Item B: monster drops land in the bag - the combat
     module fires espil-guide 'monster-drop' with items on the
     three separated lines (weapon / armour / accessory materials);
     items is authoritative, parts is the legacy weapon-line
     fallback for older emitters. */
  window.addEventListener('espil-guide', function (e) {
    var d = e.detail || {}; if (d.__fromGuide) return;
    if (d.type === 'bought' && d.item) { var a = ownedList(); a.push(String(d.item)); saveOwned(a); if (bagOpen()) renderBag(); }
    if (d.type === 'monster-drop') {
      var a2 = ownedList(), added = false;
      if (Array.isArray(d.items) && d.items.length) {
        d.items.forEach(function (it) {
          var cnt = Math.max(1, it.count || 1);
          for (var i = 0; i < cnt; i++) a2.push(String(it.name));
          added = true;
        });
      } else if (Array.isArray(d.parts)) {
        d.parts.forEach(function (pn) { a2.push(String(pn)); added = true; });
      }
      if (added) { saveOwned(a2); if (bagOpen()) renderBag(); }
    }
  });

  /* S4 recovery listener: the bag's 'use' action has already
     removed the item when this fires. Recovery goes through the
     S1 hook __espilApplyRecovery(hp, mp) when present; when the
     hook is absent the consumption still completes and only a
     neutral toast shows - no numbers are claimed. The RECOVERY
     values are DRAFTS pending Han's D4 decision. */
  window.addEventListener('espil-item-used', function (e) {
    var d = e.detail || {}; var name = d.item ? String(d.item) : '';
    if (name === 'Revival Potion') {
      /* cash item: its only use is the death choice in the combat
         core. The bag's generic use path has already removed it -
         hand it back and say why. */
      var back = ownedList(); back.push(name); saveOwned(back); renderAll();
      if (window.__espilToast) window.__espilToast('Revival Potion is used when you fall');
      return;
    }
    var rec = RECOVERY[name]; if (!rec) return;
    var applied = false;
    if (typeof window.__espilApplyRecovery === 'function') {
      try { window.__espilApplyRecovery(rec.hp, rec.mp); applied = true; } catch (err) {}
    }
    if (!window.__espilToast) return;
    if (!applied) { window.__espilToast(name + ' used'); return; }
    var parts = [];
    if (rec.hp) parts.push('+' + rec.hp + ' HP');
    if (rec.mp) parts.push('+' + rec.mp + ' MP');
    window.__espilToast(parts.length ? name + ': ' + parts.join(' · ') : name + ' used');
  });

  /* ---------------- character info + stats ---------------- */
  function myInfo() {
    var name = 'Guest'; try { name = localStorage.getItem('espil_username') || 'Guest'; } catch (e) {}
    var rec = getJSON('espil_character', null);
    var gender = rec && rec.gender === 'female' ? 'f' : 'm';
    var look = rec && rec.look ? rec.look : null;
    var leo = 1000; try { var v = parseInt(localStorage.getItem('espil_leo_balance'), 10); if (!isNaN(v)) leo = v; } catch (e) {}
    var level = 1; try { var lv = parseInt(localStorage.getItem('espil_level'), 10); if (!isNaN(lv) && lv > 0) level = lv; } catch (e) {}
    var cls = '모험가'; try { cls = localStorage.getItem('espil_class') || cls; } catch (e) {}
    var title = '모험가'; try { title = localStorage.getItem(LS_TITLE) || title; } catch (e) {}
    var city = null;
    try { var st = window.__espilChatState && window.__espilChatState(); if (st && st.room) city = st.room.charAt(0).toUpperCase() + st.room.slice(1); } catch (e) {}
    return { name: name, gender: gender, look: look, leo: leo, level: level, cls: cls, title: title, city: city };
  }
  var STAT_KEYS = ['str', 'acc', 'int', 'dex', 'vit', 'wil'];
  var STAT_KR = { str: '힘', acc: '정확함', int: '지능', dex: '민첩성', vit: '강인함', wil: '의지' };
  function computeStats() {
    var info = myInfo(), eq = equippedMap();
    var base = {}; STAT_KEYS.forEach(function (k) { base[k] = 8 + (info.level - 1) * 2; });
    var tot = {}; STAT_KEYS.forEach(function (k) { tot[k] = base[k]; });
    var def = 0, mdef = 0, meleeFlat = 0, magicFlat = 0, weapon = null;
    Object.keys(eq).forEach(function (slot) {
      var it = itemOf(eq[slot]); if (!it) return;
      STAT_KEYS.forEach(function (k) { if (typeof it[k] === 'number') tot[k] += it[k]; });
      def += it.def || 0; mdef += it.mdef || 0;
      meleeFlat += it.melee || 0; magicFlat += it.magic || 0;
      if (slot === 'weapon') weapon = it;
    });
    var wAtk = weapon ? (tieredAtk(weapon) || [Math.round(tieredMatk(weapon)[0] * 0.4), Math.round(tieredMatk(weapon)[1] * 0.4)]) : [1, 3];
    var wMatk = weapon ? (tieredMatk(weapon) || [Math.round(tieredAtk(weapon)[0] * 0.4), Math.round(tieredAtk(weapon)[1] * 0.4)]) : [1, 2];
    var mid = (wAtk[0] + wAtk[1]) / 2, mmid = (wMatk[0] + wMatk[1]) / 2;
    return { base: base, tot: tot, level: info.level,
      weaponAtk: wAtk,
      melee: Math.round(mid + tot.str * 0.6) + meleeFlat,
      magic: Math.round(mmid + tot.int * 0.6) + magicFlat,
      def: def + Math.round(tot.vit * 1.5),
      mdef: mdef + Math.round(tot.wil * 1.5 + tot.int * 0.2),
      gearDef: def, gearMdef: mdef };
  }

  /* ---------------- icons (SVG, one painter per shape) ---------------- */
  function iconSVG(it, size) {
    var a = (it && it.app) || { shape: 'box', c1: '#9aa7ad', c2: '#5d6d78' };
    var c1 = a.c1, c2 = a.c2, s = size || 36, b = '';
    function P(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra || '') + '/>'; }
    switch (a.shape) {
      case 'sword': b = P('M20 4 L24 6 L14 26 L11 33 L8 30 L15 27 Z', c1) + P('M6 26 L12 32', 'none', ' stroke="' + c2 + '" stroke-width="3" stroke-linecap="round"'); break;
      case 'dagger': b = P('M22 8 L25 10 L16 24 L12 30 L9 27 L14 22 Z', c1) + '<circle cx="9" cy="29" r="2.6" fill="' + c2 + '"/>'; break;
      case 'staff': b = '<rect x="15" y="12" width="3.4" height="20" rx="1.6" fill="' + c1 + '" transform="rotate(18 17 22)"/><circle cx="21" cy="9" r="5.4" fill="' + c2 + '"/><circle cx="21" cy="9" r="2.4" fill="#eaf6ff"/>'; break;
      case 'bow': b = P('M10 4 Q26 18 10 32 Q17 18 10 4 Z', 'none', ' stroke="' + c1 + '" stroke-width="3" fill="none"') + '<line x1="10" y1="4" x2="10" y2="32" stroke="' + c2 + '" stroke-width="1.4"/>'; break;
      case 'cap': b = P('M6 22 Q6 10 18 10 Q30 10 30 22 Z', c1) + P('M4 22 L32 22 L32 26 L4 26 Z', c2); break;
      case 'hood': b = P('M18 4 Q30 6 30 20 L30 30 L24 30 L24 20 Q24 13 18 13 Q12 13 12 20 L12 30 L6 30 L6 20 Q6 6 18 4 Z', c1); break;
      case 'helm': b = P('M7 26 L7 16 Q7 6 18 6 Q29 6 29 16 L29 26 L23 26 L23 18 L13 18 L13 26 Z', c1) + P('M18 2 L21 8 L15 8 Z', c2); break;
      case 'shirt': b = P('M12 6 L6 10 L9 17 L12 15 L12 30 L24 30 L24 15 L27 17 L30 10 L24 6 Q21 9 18 9 Q15 9 12 6 Z', c1) + '<rect x="12" y="24" width="12" height="3" fill="' + c2 + '"/>'; break;
      case 'armor': b = P('M12 5 L6 9 L9 16 L12 14 L12 30 L24 30 L24 14 L27 16 L30 9 L24 5 Q21 8 18 8 Q15 8 12 5 Z', c1) + P('M12 14 L24 14 L24 17 L12 17 Z', c2) + '<circle cx="18" cy="22" r="2.6" fill="' + c2 + '"/>'; break;
      case 'robe': b = P('M13 5 L7 9 L10 15 L12 13 L10 31 L26 31 L24 13 L26 15 L29 9 L23 5 Q20 8 18 8 Q16 8 13 5 Z', c1) + '<rect x="16.6" y="12" width="2.8" height="19" fill="' + c2 + '"/>'; break;
      case 'pants': b = P('M11 5 L25 5 L26 31 L20 31 L18 15 L16 31 L10 31 Z', c1) + '<rect x="11" y="5" width="14" height="3.4" fill="' + c2 + '"/>'; break;
      case 'boots': b = P('M9 5 L16 5 L16 20 L24 24 L24 29 L9 29 Z', c1) + P('M22 5 L29 5 L29 20 L33 24 L33 29 L22 29 Z', c1) + '<rect x="9" y="26" width="15" height="3" fill="' + c2 + '"/><rect x="22" y="26" width="11" height="3" fill="' + c2 + '"/>'; break;
      case 'glove': b = P('M13 30 L13 14 Q13 9 16 9 L16 5 L19 5 L19 10 L21 5 L24 6 L23 12 Q27 14 26 19 L24 30 Z', c1) + '<rect x="13" y="26" width="11" height="4" fill="' + c2 + '"/>'; break;
      case 'cape': b = P('M12 5 L24 5 L28 30 Q18 26 8 30 Z', c1) + P('M12 5 L24 5 L25 10 L11 10 Z', c2); break;
      case 'ring': b = '<circle cx="18" cy="21" r="8" fill="none" stroke="' + c1 + '" stroke-width="3.4"/><path d="M13 9 L23 9 L20.4 14 L15.6 14 Z" fill="' + c2 + '"/>'; break;
      case 'necklace': b = P('M8 6 Q18 22 28 6', 'none', ' stroke="' + c1 + '" stroke-width="2.4" fill="none"') + '<circle cx="18" cy="19" r="4" fill="' + c2 + '"/>'; break;
      case 'earring': b = '<circle cx="14" cy="12" r="3" fill="' + c1 + '"/><circle cx="14" cy="22" r="4" fill="' + c2 + '"/><circle cx="24" cy="12" r="3" fill="' + c1 + '"/><circle cx="24" cy="22" r="4" fill="' + c2 + '"/>'; break;
      case 'belt': b = '<rect x="4" y="14" width="28" height="7" rx="2" fill="' + c1 + '"/><rect x="15" y="12.6" width="6.4" height="9.6" rx="1.4" fill="none" stroke="' + c2 + '" stroke-width="2.2"/>'; break;
      case 'pet': b = '<ellipse cx="18" cy="21" rx="10" ry="8.4" fill="' + c1 + '"/><circle cx="14.6" cy="19" r="1.7" fill="#33302c"/><circle cx="21.4" cy="19" r="1.7" fill="#33302c"/><path d="M15.6 24 Q18 26 20.4 24" stroke="#33302c" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="11" cy="23" r="2.2" fill="' + c2 + '" opacity=".65"/><circle cx="25" cy="23" r="2.2" fill="' + c2 + '" opacity=".65"/>'; break;
      case 'food': b = '<path d="M18 5 L29 27 L7 27 Z" fill="#f2e3c2"/><path d="M18 5 L29 27 L7 27 Z" fill="none" stroke="' + c2 + '" stroke-width="2"/><circle cx="18" cy="19" r="3.4" fill="' + c1 + '"/>'; break;
      case 'drink': b = '<rect x="14" y="12" width="9" height="18" rx="2.4" fill="#f2e3c2"/><rect x="16" y="6" width="5" height="6" fill="' + c2 + '"/><rect x="14" y="18" width="9" height="5" fill="' + c1 + '"/>'; break;
      case 'cup': b = '<path d="M9 13 L27 13 L24.6 29 L11.4 29 Z" fill="#e8e0cc"/><rect x="9" y="10" width="18" height="3.6" rx="1.6" fill="' + c1 + '"/><path d="M13 7 Q14.6 4.6 13 2.6 M19 7 Q20.6 4.6 19 2.6" stroke="' + c2 + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>'; break;
      case 'shard': b = P('M18 3 L24 14 L20 30 L13 26 L10 12 Z', c1) + P('M18 3 L20 30', 'none', ' stroke="' + c2 + '" stroke-width="1.6"'); break;
      case 'plate': b = P('M8 7 L28 7 L26 29 L10 29 Z', c1) + '<rect x="12" y="12" width="12" height="3" fill="' + c2 + '"/><rect x="12" y="19" width="12" height="3" fill="' + c2 + '"/>'; break;
      case 'bead': b = '<circle cx="18" cy="18" r="10" fill="' + c1 + '"/><circle cx="14.6" cy="14" r="3.2" fill="#ffffff" opacity=".55"/><circle cx="18" cy="18" r="3.4" fill="' + c2 + '"/>'; break;
      default: b = '<rect x="8" y="9" width="20" height="18" rx="2.6" fill="' + c1 + '"/><rect x="8" y="15" width="20" height="3" fill="' + c2 + '"/>';
    }
    return '<svg viewBox="0 0 36 36" width="' + s + '" height="' + s + '" aria-hidden="true">' + b + '</svg>';
  }

  /* ---------------- the customizer character (EP parts) ----------------
     The preview composites the EP customizer's own part frames
     (~/workspace/ui-room/gear/ep-parts, 512 px webp served as
     assets/ep-parts/): skin (3 baked tones) -> lower -> upper ->
     foot -> face -> hair -> weapon, 24-frame idle, EP layer
     order. Hair / eye tinting reuses the EP page's luminance
     remap and gates. Worn top / weapon select the real garment /
     weapon part sets via each item's ep field; slots whose part
     sets do not exist yet (hat, cape, gloves, accessories, pet)
     show in their slot only, until the customizer / asset rooms
     ship those sets. */
  var PARTS_BASE = (typeof window.__espilGearPartsBase === 'string' && window.__espilGearPartsBase) || 'assets/ep-parts/';
  var FRAMES = 24;
  var HC_RGB = [[58, 42, 28], [122, 74, 43], [179, 118, 74], [227, 193, 136], [236, 236, 236], [35, 38, 43], [201, 79, 79], [74, 106, 201], [93, 168, 115]];
  var setCache = {};
  function loadSet(path, suffix) {
    var key = path + '|' + (suffix || '');
    if (setCache[key]) return setCache[key];
    var jobs = [];
    for (var f = 0; f < FRAMES; f++) {
      (function (src) {
        jobs.push(new Promise(function (res) {
          var i = new Image();
          i.onload = function () { res(i); };
          i.onerror = function () { res(null); };
          i.src = src;
        }));
      })(PARTS_BASE + path + '/f' + String(f).padStart(2, '0') + (suffix || '') + '.webp');
    }
    setCache[key] = Promise.all(jobs);
    return setCache[key];
  }
  function hairGate(p, i) { var lum = (p[i] + p[i + 1] + p[i + 2]) / 3; return lum >= 40; }
  function eyeGate(p, i) {
    var r = p[i], g = p[i + 1], b = p[i + 2], lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
    return lum >= 40 && lum <= 220 && sat > 20;
  }
  function tintFrame(src, rgb, gate) {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    var x = cv.getContext('2d'); x.drawImage(src, 0, 0, 512, 512);
    var d = x.getImageData(0, 0, 512, 512), p = d.data, lums = [], i, lum;
    for (i = 0; i < p.length; i += 4) if (p[i + 3] > 8 && gate(p, i)) lums.push((p[i] + p[i + 1] + p[i + 2]) / 3);
    lums.sort(function (a, b) { return a - b; });
    var ref = lums.length ? lums[Math.floor(lums.length / 2)] : 128;
    for (i = 0; i < p.length; i += 4) {
      if (p[i + 3] <= 8 || !gate(p, i)) continue;
      lum = (p[i] + p[i + 1] + p[i + 2]) / 3;
      var k = Math.min(lum / Math.max(ref, 1), 2.2);
      p[i] = Math.min(255, rgb[0] * k); p[i + 1] = Math.min(255, rgb[1] * k); p[i + 2] = Math.min(255, rgb[2] * k);
    }
    x.putImageData(d, 0, 0);
    return cv;
  }
  var tintCache = {};
  function tintSet(kind, frames, rgb, gate) {
    if (!rgb) return frames;
    var key = kind + '|' + rgb.join(',');
    if (tintCache[key]) return tintCache[key];
    var out = frames.map(function (fr) { return fr ? tintFrame(fr, rgb, gate) : null; });
    tintCache[key] = out;
    return out;
  }
  function epSelection() {
    var info = myInfo(), lk = info.look || {};
    var tone = '';
    if (typeof lk.skinTone === 'string') tone = lk.skinTone === 'light' ? '_light' : (lk.skinTone === 'deep' ? '_deep' : '');
    else if (typeof lk.skin === 'number') tone = ['_light', '', '', '_deep', '_deep'][lk.skin] || '';
    var hairRgb = null;
    if (Array.isArray(lk.hairDye)) hairRgb = lk.hairDye;
    else if (typeof lk.hairColor === 'number') hairRgb = HC_RGB[lk.hairColor] || null;
    var eyeRgb = Array.isArray(lk.eyeColor) ? lk.eyeColor : null;
    var eq = equippedMap(), lw = lookMap();
    var topIt = null, topName = lw.top || eq.top;
    if (topName) topIt = itemOf(topName);
    var wpnIt = null, wpnName = lw.weapon || eq.weapon;
    if (wpnName) wpnIt = itemOf(wpnName);
    return { tone: tone, hairRgb: hairRgb, eyeRgb: eyeRgb,
      upper: (topIt && topIt.ep && topIt.ep.upper) || 'default',
      weapon: (wpnIt && wpnIt.ep && wpnIt.ep.weapon) || null };
  }
  var pv = { frame: 0, timer: null, sets: null, key: '', error: false };
  function drawFrame() {
    var cv = document.getElementById('espil-gear-preview'); if (!cv) return;
    var x = cv.getContext('2d'); if (!x) return;
    x.clearRect(0, 0, 512, 512);
    var g = x.createRadialGradient(256, 210, 60, 256, 256, 330);
    g.addColorStop(0, '#3a2a18'); g.addColorStop(1, '#17100a');
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    if (pv.error) {
      x.fillStyle = '#d8c49a'; x.font = '600 17px Manrope, sans-serif'; x.textAlign = 'center';
      x.fillText('캐릭터 에셋을 불러오지 못했습니다.', 256, 248);
      x.font = '13px Manrope, sans-serif'; x.fillStyle = 'rgba(216,196,154,.7)';
      x.fillText('assets/ep-parts 가 필요합니다.', 256, 274);
      return;
    }
    if (!pv.sets) {
      x.fillStyle = 'rgba(216,196,154,.75)'; x.font = '600 15px Manrope, sans-serif'; x.textAlign = 'center';
      x.fillText('캐릭터를 불러오는 중입니다...', 256, 256);
      return;
    }
    var s = pv.sets, f = pv.frame % FRAMES;
    var order = [s.skin, s.lower, s.upper, s.foot, s.face, s.hair, s.weapon];
    for (var i = 0; i < order.length; i++) {
      var layer = order[i];
      if (layer && layer[f]) x.drawImage(layer[f], 0, 0, 512, 512);
    }
  }
  function ensurePreview() {
    var sel = epSelection();
    var key = [sel.tone, sel.upper, sel.weapon || '-', sel.hairRgb ? sel.hairRgb.join(',') : '-', sel.eyeRgb ? sel.eyeRgb.join(',') : '-'].join('|');
    if (key === pv.key && (pv.sets || pv.error)) { drawFrame(); return; }
    pv.key = key; pv.sets = null; pv.error = false;
    drawFrame();
    Promise.all([
      loadSet('skin/front', sel.tone), loadSet('lower/front/default'), loadSet('upper/front/' + sel.upper),
      loadSet('foot/front/default'), loadSet('face/front'), loadSet('hair/front'),
      sel.weapon ? loadSet('weapon/front/' + sel.weapon) : Promise.resolve(null)
    ]).then(function (r) {
      if (pv.key !== key) return;
      if (!r[0] || !r[0][0]) { pv.error = true; drawFrame(); return; }
      pv.sets = { skin: r[0], lower: r[1], upper: r[2], foot: r[3],
        face: tintSet('eye', r[4], sel.eyeRgb, eyeGate),
        hair: tintSet('hair', r[5], sel.hairRgb, hairGate),
        weapon: r[6] };
      drawFrame();
    });
  }
  function startPreviewLoop() {
    ensurePreview();
    if (pv.timer) return;
    pv.timer = setInterval(function () {
      if (!profileOpen() || !document.getElementById('espil-gear-preview')) {
        clearInterval(pv.timer); pv.timer = null; return;
      }
      pv.frame = (pv.frame + 1) % FRAMES;
      drawFrame();
    }, 130);
  }

  /* ---------------- styles ---------------- */
  var LOGWOOD_URL = (typeof window.__espilLogwoodUrl === 'string' && window.__espilLogwoodUrl) || 'assets/tex/logwood.jpg';
  var WOOD_BG = 'background-image:linear-gradient(rgba(26,17,9,.86),rgba(26,17,9,.90)),url("' + LOGWOOD_URL + '");background-size:cover,340px;';
  var WOOD_PANEL = 'background-image:linear-gradient(rgba(30,20,11,.90),rgba(30,20,11,.93)),url("' + LOGWOOD_URL + '");background-size:cover,300px;';
  var CSS = [
    '.espil-gear{grid-column:1/-1;color:#f5e6c8;font:12px Manrope,system-ui,sans-serif;padding:10px;border:2px solid #6b4a2f;border-radius:15px}',
    '.espil-gear *{box-sizing:border-box}',
    '.eg-head{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:5px}',
    '.eg-name{font-size:16px;font-weight:800;color:#ffd97a;letter-spacing:.02em}',
    '.eg-lv{font-size:12px;opacity:.92}',
    '.eg-title{font-size:12px;color:#e8b04b;font-weight:700}',
    '.eg-titlebtn{margin-left:auto;padding:4px 11px;border-radius:6px;border:1px solid #a97e46;background:linear-gradient(#8a2f23,#6e241b);color:#ffe9b0;font:700 11.5px Manrope,sans-serif;cursor:pointer}',
    '.eg-tabs{display:flex;gap:5px;margin:4px 0 7px}',
    '.eg-tab{padding:5px 10px;border-radius:8px 8px 0 0;border:1px solid rgba(169,126,70,.55);border-bottom:none;background:rgba(59,42,28,.55);color:#d8c49a;font:700 11.5px Manrope,sans-serif;cursor:pointer}',
    '.eg-tab.on{background:#8a2f23;color:#ffe9b0;border-color:#a97e46}',
    '.eg-main{display:flex;gap:7px;justify-content:center;align-items:flex-start}',
    '.eg-col{display:flex;flex-direction:column;gap:6px}',
    '.eg-slot{width:47px;padding:3px 1px 2px;border-radius:8px;border:1.6px solid rgba(169,126,70,.5);background:rgba(30,20,12,.66);text-align:center;color:#d8c49a}',
    '.eg-slot.filled{cursor:pointer;background:rgba(59,42,28,.9)}',
    '.eg-slot .eg-slotlab{display:block;font-size:9px;letter-spacing:.05em;opacity:.75;margin-top:1px}',
    '.eg-slot .eg-itemlab{display:block;font-size:8.5px;line-height:1.15;color:#ffe9b0;min-height:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.eg-stage{flex:none;border:1.6px solid rgba(169,126,70,.5);border-radius:10px;overflow:hidden;background:#1a120b}',
    '.eg-bottom{display:flex;gap:6px;justify-content:center;margin-top:5px}',
    '.eg-stats{display:flex;gap:10px;margin-top:7px;flex-wrap:wrap}',
    '.eg-statbox{flex:1;min-width:128px;border:1px solid rgba(169,126,70,.5);border-radius:10px;background:rgba(30,20,12,.55);padding:6px 8px}',
    '.eg-statbox h4{margin:0 0 4px;font-size:11px;letter-spacing:.1em;color:#e8b04b}',
    '.eg-statrow{display:flex;justify-content:space-between;padding:1.2px 0;border-bottom:1px dashed rgba(216,196,154,.14)}',
    '.eg-statrow:last-child{border-bottom:none}',
    '.eg-statrow b{color:#fff3d6;font-variant-numeric:tabular-nums}',
    '.eg-foot{margin:7px 0 0;font-size:11px;opacity:.85}',
    '.eg-custom{margin-left:8px;padding:4px 11px;border-radius:999px;border:1px solid rgba(201,168,106,.85);background:rgba(201,168,106,.16);color:#ffd97a;font:700 11.5px Manrope,sans-serif;cursor:pointer}',
    '.eg-mount{padding:18px 6px;text-align:center;opacity:.8}',
    /* bag */
    '.espil-bag{grid-column:1/-1;color:#f5e6c8;font:12px Manrope,system-ui,sans-serif}',
    '.espil-bag *{box-sizing:border-box}',
    '.bag-tabs{display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap}',
    '.bag-tab{padding:5px 11px;border-radius:8px;border:1px solid rgba(169,126,70,.55);background:rgba(59,42,28,.55);color:#d8c49a;font:700 11.5px Manrope,sans-serif;cursor:pointer}',
    '.bag-tab.on{background:#8a2f23;color:#ffe9b0}',
    '.bag-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:5px}',
    '.bag-cell{position:relative;border:1.6px solid rgba(169,126,70,.45);border-radius:7px;background:rgba(30,20,12,.66);aspect-ratio:1;display:flex;align-items:center;justify-content:center;cursor:pointer}',
    '.bag-cell.sel{outline:2px solid #ffd97a}',
    '.bag-cell .bag-n{position:absolute;right:2px;bottom:1px;font-size:9.5px;font-weight:800;color:#fff3d6;text-shadow:0 1px 2px #000}',
    '.bag-cell .bag-e{position:absolute;left:2px;top:1px;font-size:8.5px;font-weight:800;color:#ffd97a}',
    '.bag-cell.empty{cursor:default;opacity:.35}',
    '.bag-detail{display:flex;gap:10px;margin-top:9px;border:1px solid rgba(169,126,70,.5);border-radius:10px;background:rgba(30,20,12,.55);padding:8px 10px;min-height:74px}',
    '.bag-dicon{flex:none;width:48px;height:48px;border-radius:8px;border:1.6px solid rgba(169,126,70,.5);display:flex;align-items:center;justify-content:center;background:rgba(59,42,28,.8)}',
    '.bag-dbody{flex:1;min-width:0}',
    '.bag-dname{font-size:13.5px;font-weight:800;color:#fff3d6}',
    '.bag-dmeta{font-size:11px;opacity:.85;margin:2px 0 3px}',
    '.bag-dstats{font-size:11.5px;color:#ffd97a}',
    '.bag-ddesc{font-size:11.5px;opacity:.9;margin-top:2px}',
    '.bag-dbtns{flex:none;display:flex;flex-direction:column;gap:5px;justify-content:center}',
    '.bag-dbtn{padding:5px 11px;border-radius:7px;border:1px solid #a97e46;background:linear-gradient(#8a5a2b,#6e4520);color:#ffe9b0;font:700 11.5px Manrope,sans-serif;cursor:pointer}',
    '.bag-dbtn.sub{background:rgba(59,42,28,.8);color:#d8c49a}',
    '.bag-foot{margin:7px 0 0;font-size:11px;opacity:.85;display:flex;justify-content:space-between}',
    /* Item 5 (Han 2026-11-04): smaller cards, and when the profile
       and the bag are open together they sit side by side (each
       overlay takes one half) instead of stacking full-screen;
       under 1020px they split top/bottom so neither is hidden. */
    '.skill-tree#character-panel .st-card{width:min(408px,calc(100% - 20px));padding:13px 15px}',
    '.skill-tree#character-panel .st-head{margin-bottom:7px;padding-bottom:7px}',
    '.skill-tree#inventory-panel .st-card{width:min(440px,calc(100% - 20px))}',
    'body.espil-panels-both #character-panel{left:0;right:auto;width:50%}',
    'body.espil-panels-both #inventory-panel{left:auto;right:0;width:50%}',
    'body.espil-panels-both #character-panel .st-card,body.espil-panels-both #inventory-panel .st-card{max-width:calc(100% - 14px)}',
    '@media (max-width:1020px){' +
      'body.espil-panels-both #character-panel{left:0;right:0;width:auto;top:0;bottom:auto;height:50%}' +
      'body.espil-panels-both #inventory-panel{left:0;right:0;width:auto;top:auto;bottom:0;height:50%}' +
      'body.espil-panels-both .st-card{max-height:calc(100% - 10px)}' +
      'body.espil-panels-both #character-panel .st-grid{overflow-y:auto;scrollbar-width:thin}}'
  ].join('\n');
  var WOOD_CSS = [
    '.espil-gear,.espil-bag{' + WOOD_BG + '}',
    '.espil-bag{padding:10px;border:2px solid #6b4a2f;border-radius:15px}',
    '.eg-slot{background:radial-gradient(circle at 50% 40%,rgba(146,102,56,.5),rgba(43,29,17,.94) 70%);box-shadow:inset 0 0 0 2px #54381f,inset 0 0 0 4px rgba(170,124,70,.45),inset 0 0 16px rgba(0,0,0,.55)}',
    '.eg-slot.filled{background:radial-gradient(circle at 50% 40%,rgba(178,128,70,.62),rgba(56,38,20,.95) 72%);box-shadow:inset 0 0 0 2px #6e4c2a,inset 0 0 0 4px rgba(190,142,84,.5),inset 0 0 16px rgba(0,0,0,.5)}',
    '.eg-tab,.bag-tab{background-image:linear-gradient(rgba(96,64,34,.88),rgba(70,47,24,.92)),url("' + LOGWOOD_URL + '");background-size:cover,200px}',
    '.eg-tab.on,.bag-tab.on{background-image:linear-gradient(rgba(122,44,32,.9),rgba(94,32,22,.93)),url("' + LOGWOOD_URL + '");background-size:cover,200px}',
    '.eg-statbox,.bag-detail,.bag-dicon{' + WOOD_PANEL + '}',
    '.bag-cell{background-image:linear-gradient(rgba(38,26,14,.9),rgba(38,26,14,.93)),url("' + LOGWOOD_URL + '");background-size:cover,170px}',
    '.bag-cell.empty{background-image:linear-gradient(rgba(24,16,9,.94),rgba(24,16,9,.96)),url("' + LOGWOOD_URL + '");background-size:cover,170px}',
    '.eg-stage{border:3px solid #6b4a2f;box-shadow:inset 0 0 0 2px #38260f,inset 0 0 34px rgba(0,0,0,.65)}',
    '.eg-titlebtn,.bag-dbtn{background-image:linear-gradient(rgba(122,79,40,.94),rgba(92,58,27,.96)),url("' + LOGWOOD_URL + '");background-size:cover,180px}',
    '.bag-dbtn.sub{background-image:linear-gradient(rgba(56,38,20,.94),rgba(43,29,17,.96)),url("' + LOGWOOD_URL + '");background-size:cover,180px}'
  ].join('\n');
  function ensureStyle() {
    if (!document.getElementById('espil-gear-style')) {
      var s = document.createElement('style'); s.id = 'espil-gear-style'; s.textContent = CSS;
      document.head.appendChild(s);
    }
    if (!document.getElementById('espil-gear-wood')) {
      var w = document.createElement('style'); w.id = 'espil-gear-wood'; w.textContent = WOOD_CSS;
      document.head.appendChild(w);
    }
  }

  /* ---------------- profile ---------------- */
  var profTab = 'equip';
  function charPanel() { return document.getElementById('character-panel'); }
  function invPanel() { return document.getElementById('inventory-panel'); }
  function profileOpen() { var p = charPanel(); return !!p && p.getAttribute('aria-hidden') === 'false'; }
  function bagOpen() { var p = invPanel(); return !!p && p.getAttribute('aria-hidden') === 'false'; }
  function slotCell(slot, name, fashion) {
    var it = name ? itemOf(name) : null;
    var gradeCol = it ? (GRADES[it.grade] || '#a97e46') : 'rgba(169,126,70,.5)';
    return '<div class="eg-slot' + (it ? ' filled' : '') + '" data-gear-slot="' + slot + '"' +
      (it ? ' title="' + esc(it.kr || it.name) + '"' : '') +
      ' style="border-color:' + gradeCol + '">' +
      (it ? iconSVG(it, 22) : '<span style="display:block;height:22px;line-height:22px;font-size:12px;opacity:.4">·</span>') +
      '<span class="eg-itemlab">' + (it ? esc(it.kr || it.name) + (slot === 'weapon' && craftTierOf(name) ? ' +' + craftTierOf(name) : '') : '') + '</span>' +
      '<span class="eg-slotlab">' + SLOT_KR[slot] + '</span></div>';
  }
  function statRows(pairs) {
    return pairs.map(function (p) { return '<div class="eg-statrow"><span>' + p[0] + '</span><b>' + p[1] + '</b></div>'; }).join('');
  }
  function renderProfile() {
    var g = document.getElementById('char-grid'); if (!g) return;
    ensureStyle(); seedStarter();
    var info = myInfo();
    var map = profTab === 'look' ? lookMap() : equippedMap();
    var st = computeStats();
    var wrap = document.createElement('div');
    wrap.className = 'espil-gear';
    var left = SLOT_DEFS.filter(function (s) { return s.col === 'L'; }).map(function (s) { return slotCell(s.key, map[s.key], profTab === 'look'); }).join('');
    var right = SLOT_DEFS.filter(function (s) { return s.col === 'R'; }).map(function (s) { return slotCell(s.key, map[s.key], profTab === 'look'); }).join('');
    var bottom = SLOT_DEFS.filter(function (s) { return s.col === 'B'; }).map(function (s) { return slotCell(s.key, map[s.key], profTab === 'look'); }).join('');
    var stage = profTab === 'mount'
      ? '<div class="eg-stage"><div class="eg-mount">탈것은 준비 중입니다.<br><span style="font-size:11.5px">이동 수단이 생기면 이곳에 표시됩니다.</span></div></div>'
      : '<div class="eg-stage"><canvas id="espil-gear-preview" width="512" height="512" style="display:block;width:172px;height:172px"></canvas></div>';
    wrap.innerHTML =
      '<div class="eg-head"><span class="eg-name">' + esc(info.name) + '</span>' +
      '<span class="eg-lv">레벨 ' + info.level + ' ' + esc(info.cls) + '</span>' +
      '<span class="eg-title">' + esc(info.title) + '</span>' +
      '<button class="eg-titlebtn" id="eg-titlebtn" type="button">칭호</button></div>' +
      '<div class="eg-tabs">' +
      '<button class="eg-tab' + (profTab === 'equip' ? ' on' : '') + '" data-egtab="equip" type="button">장비 아이템</button>' +
      '<button class="eg-tab' + (profTab === 'look' ? ' on' : '') + '" data-egtab="look" type="button">치장 아이템</button>' +
      '<button class="eg-tab' + (profTab === 'mount' ? ' on' : '') + '" data-egtab="mount" type="button">탈것</button></div>' +
      '<div class="eg-main"><div class="eg-col">' + left + '</div>' + stage + '<div class="eg-col">' + right + '</div></div>' +
      '<div class="eg-bottom">' + bottom + '</div>' +
      (profTab === 'look' ? '<p class="eg-foot">치장 아이템은 외형만 바꿉니다. 능력치는 장비 아이템 기준으로 계산됩니다.</p>' : '') +
      '<p class="eg-foot" style="font-size:10px;opacity:.65;margin-top:3px">캐릭터는 커스터마이저 캐릭터이며 상의와 무기는 실제 부품으로 반영됩니다. 모자, 망토, 장갑, 장신구, 펫은 부품이 준비되는 대로 연결됩니다.</p>' +
      '<div class="eg-stats"><div class="eg-statbox"><h4>기본 능력치</h4>' +
      statRows(STAT_KEYS.map(function (k) { return [STAT_KR[k], st.tot[k]]; })) +
      '</div><div class="eg-statbox"><h4>주요 능력치</h4>' +
      statRows([['무기 공격력', st.weaponAtk[0] + ' ~ ' + st.weaponAtk[1]], ['근접 공격력', st.melee], ['방어력', st.def], ['마법 공격력', st.magic], ['마법 방어력', st.mdef]]) +
      '</div></div>' +
      '<p class="eg-foot">Leo Coin: ' + info.leo + (info.city ? ' · Now in: ' + esc(info.city) : '') +
      '<button class="eg-custom" id="eg-custom" type="button">Customize</button></p>';
    g.innerHTML = ''; g.appendChild(wrap);
    if (document.getElementById('espil-gear-preview')) startPreviewLoop();
    wrap.querySelectorAll('[data-egtab]').forEach(function (b) {
      b.addEventListener('click', function () { profTab = b.getAttribute('data-egtab'); renderProfile(); });
    });
    wrap.querySelectorAll('[data-gear-slot]').forEach(function (el) {
      el.addEventListener('click', function () {
        var s = el.getAttribute('data-gear-slot');
        if (profTab === 'look') { if (lookMap()[s]) unequipLook(s); }
        else if (profTab === 'equip') { if (equippedMap()[s]) unequip(s); }
      });
    });
    var tb = document.getElementById('eg-titlebtn');
    if (tb) tb.addEventListener('click', function () {
      var titles = getJSON(LS_TITLES, ['모험가']); if (!Array.isArray(titles) || !titles.length) titles = ['모험가'];
      var cur = titles.indexOf(info.title); var next = titles[(cur + 1) % titles.length];
      try { localStorage.setItem(LS_TITLE, next); } catch (e) {}
      renderProfile();
    });
    var cb = document.getElementById('eg-custom');
    if (cb) cb.addEventListener('click', function () { toggleProfile(false); if (window.__espilOpenCustomizer) window.__espilOpenCustomizer(); });
  }

  /* ---------------- bag ---------------- */
  var bagTab = 'equip', bagSel = null;
  var BAG_TABS = [['equip', '장비'], ['use', '소비'], ['mat', '재료'], ['quest', '퀘스트'], ['etc', '기타']];
  function itemStatLines(it) {
    var out = [];
    var ta = tieredAtk(it), tm = tieredMatk(it), tier = craftTierOf(it.name);
    if (ta) out.push('무기 공격력 ' + ta[0] + ' ~ ' + ta[1]);
    if (tm) out.push('마법 공격력 ' + tm[0] + ' ~ ' + tm[1]);
    if (tier > 0 && (ta || tm)) out.push('강화 +' + tier);
    if (it.def) out.push('방어력 +' + it.def);
    if (it.mdef) out.push('마법 방어력 +' + it.mdef);
    STAT_KEYS.forEach(function (k) { if (typeof it[k] === 'number' && it[k]) out.push(STAT_KR[k] + ' +' + it[k]); });
    var rec = RECOVERY[it.name];
    if (rec && (rec.hp || rec.mp)) {
      var rp = [];
      if (rec.hp) rp.push('HP +' + rec.hp);
      if (rec.mp) rp.push('MP +' + rec.mp);
      out.push('회복 ' + rp.join(' · '));
    }
    return out;
  }
  function renderBag() {
    var g = document.getElementById('inv-grid'); if (!g) return;
    ensureStyle(); seedStarter();
    var panel = invPanel();
    if (panel) { var h2 = panel.querySelector('.st-head h2'); if (h2) h2.textContent = '가방'; }
    var counts = ownedCounts();
    var eq = equippedMap(), lk = lookMap();
    var eqNames = {}; Object.keys(eq).forEach(function (s) { eqNames[eq[s]] = s; });
    var lkNames = {}; Object.keys(lk).forEach(function (s) { lkNames[lk[s]] = s; });
    var items = counts.filter(function (c) { return itemOf(c.name).kind === bagTab; });
    if (bagSel && !items.some(function (c) { return c.name === bagSel; })) bagSel = null;
    if (!bagSel && items.length) bagSel = items[0].name;
    var wrap = document.createElement('div');
    wrap.className = 'espil-bag';
    var cells = items.map(function (c) {
      var it = itemOf(c.name);
      var badge = eqNames[c.name] ? '<span class="bag-e">E</span>' : (lkNames[c.name] ? '<span class="bag-e">치장</span>' : '');
      return '<div class="bag-cell' + (bagSel === c.name ? ' sel' : '') + '" data-bag-item="' + esc(c.name) + '" title="' + esc(it.kr || it.name) + '" style="border-color:' + (GRADES[it.grade] || 'rgba(169,126,70,.45)') + '">' +
        iconSVG(it, 26) + badge + (c.n > 1 ? '<span class="bag-n">' + c.n + '</span>' : '') + '</div>';
    });
    var total = Math.max(40, Math.ceil(items.length / 8) * 8);
    for (var i = items.length; i < total; i++) cells.push('<div class="bag-cell empty"></div>');
    var detail = '<div class="bag-dbody"><div class="bag-dname">아이템을 선택하세요</div><div class="bag-ddesc">가방의 아이템을 누르면 정보가 표시됩니다.</div></div>';
    var btns = '';
    if (bagSel) {
      var sit = itemOf(bagSel);
      var lines = itemStatLines(sit);
      var meta = (sit.kind === 'equip' ? SLOT_KR[resolveSlot(bagSel)] + ' · ' : '') +
        BAG_TABS.filter(function (t) { return t[0] === sit.kind; }).map(function (t) { return t[1]; })[0] + ' · ' + sit.grade;
      detail = '<div class="bag-dicon">' + iconSVG(sit, 38) + '</div><div class="bag-dbody">' +
        '<div class="bag-dname">' + esc(sit.kr || sit.name) + '</div>' +
        '<div class="bag-dmeta">' + esc(meta) + ' · 판매 가격: ' + sit.price + ' Leo</div>' +
        (lines.length ? '<div class="bag-dstats">' + esc(lines.join(' · ')) + '</div>' : '') +
        (sit.desc ? '<div class="bag-ddesc">' + esc(sit.desc) + '</div>' : '') + '</div>';
      if (sit.kind === 'equip') {
        var isEq = !!eqNames[bagSel], isLk = !!lkNames[bagSel];
        btns = '<div class="bag-dbtns">' +
          '<button class="bag-dbtn" data-bag-act="equip" type="button">' + (isEq ? '해제' : '착용') + '</button>' +
          '<button class="bag-dbtn sub" data-bag-act="look" type="button">' + (isLk ? '치장 해제' : '치장 착용') + '</button></div>';
      } else if (sit.kind === 'use') {
        btns = '<div class="bag-dbtns"><button class="bag-dbtn" data-bag-act="use" type="button">사용</button></div>';
      }
    }
    /* ---- Batch 6 Item B: crafting strip (selected weapon) ---- */
    var craftHtml = '';
    if (bagSel) {
      var cit = itemOf(bagSel);
      if (cit.slot === 'weapon') {
        var ct = craftTierOf(bagSel);
        var uc = upgradeCost(bagSel), cc = convertCost();
        var costTxt = function (c) {
          var parts = [];
          if (c.weapon) parts.push('무기 재료 ×' + c.weapon);
          if (c.armour) parts.push('방어구 재료 ×' + c.armour);
          if (c.accessory) parts.push('장신구 재료 ×' + c.accessory);
          return parts.join(' · ') + ' (' + MAT_LADDER[c.minLadder] + ' 등급 이상)';
        };
        var famTargets = DB.filter(function (w) { return w.slot === 'weapon' && w.name !== bagSel && familyOf(w) === familyOf(cit); });
        craftHtml = '<div class="bag-craft" style="margin-top:8px;padding:8px 10px;border:1px solid rgba(169,126,70,.55);border-radius:8px;background:rgba(46,32,16,.35)">' +
          '<div style="font:800 12px Manrope,sans-serif;color:#f2d492">제작 · ' + esc(cit.kr || cit.name) + (ct ? ' +' + ct : '') + '</div>' +
          '<div style="font-size:11px;margin-top:4px">강화 비용: ' + esc(costTxt(uc)) + ' → 공격 범위 +2~+3' +
          ' <button class="bag-dbtn" data-craft-act="upgrade" type="button"' + (canAffordCraft(uc) ? '' : ' disabled style="opacity:.45"') + '>강화</button></div>' +
          '<div style="font-size:11px;margin-top:4px">변환 비용: ' + esc(costTxt(cc)) +
          ' <select id="eg-craft-target" style="max-width:150px">' + famTargets.map(function (w) { return '<option value="' + esc(w.name) + '">' + esc(w.kr || w.name) + '</option>'; }).join('') + '</select>' +
          ' <button class="bag-dbtn" data-craft-act="convert" type="button"' + (famTargets.length && canAffordCraft(cc) ? '' : ' disabled style="opacity:.45"') + '>변환</button></div>' +
          '<div style="font-size:10px;opacity:.7;margin-top:3px">재료는 몬스터 사냥 드랍으로 모읍니다. 변환하면 강화 단계는 초기화됩니다.</div></div>';
      }
    }
    var info = myInfo();
    wrap.innerHTML =
      '<div class="bag-tabs">' + BAG_TABS.map(function (t) { return '<button class="bag-tab' + (bagTab === t[0] ? ' on' : '') + '" data-bagtab="' + t[0] + '" type="button">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="bag-grid">' + cells.join('') + '</div>' +
      '<div class="bag-detail">' + detail + btns + '</div>' + craftHtml +
      '<p class="bag-foot"><span>가방 ' + counts.reduce(function (a, c) { return a + c.n; }, 0) + ' / 96</span><span>Leo Coin: ' + info.leo + '</span></p>';
    g.innerHTML = ''; g.appendChild(wrap);
    wrap.querySelectorAll('[data-bagtab]').forEach(function (b) {
      b.addEventListener('click', function () { bagTab = b.getAttribute('data-bagtab'); bagSel = null; renderBag(); });
    });
    wrap.querySelectorAll('[data-bag-item]').forEach(function (el) {
      el.addEventListener('click', function () { bagSel = el.getAttribute('data-bag-item'); renderBag(); });
    });
    wrap.querySelectorAll('[data-craft-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!bagSel) return;
        var act = b.getAttribute('data-craft-act'), res = null;
        if (act === 'upgrade') res = upgradeWeapon(bagSel);
        else if (act === 'convert') {
          var sel = document.getElementById('eg-craft-target');
          if (sel) res = convertWeapon(bagSel, sel.value);
        }
        if (window.__espilToast) {
          if (res && res.ok && act === 'upgrade') window.__espilToast('강화 성공: +' + res.tier);
          else if (res && res.ok) window.__espilToast('변환 완료: ' + res.to);
          else window.__espilToast('재료가 부족합니다');
        }
        renderBag();
      });
    });
    wrap.querySelectorAll('[data-bag-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-bag-act'); if (!bagSel) return;
        if (act === 'equip') { var s = eqNames[bagSel]; if (s) unequip(s); else equip(bagSel); }
        else if (act === 'look') { var s2 = lkNames[bagSel]; if (s2) unequipLook(s2); else equipLook(bagSel); }
        else if (act === 'use') {
          var a = ownedList(), ix = a.indexOf(bagSel);
          if (ix >= 0) { a.splice(ix, 1); saveOwned(a); try { window.dispatchEvent(new CustomEvent('espil-item-used', { detail: { item: bagSel } })); } catch (e) {} }
          renderAll();
        }
      });
    });
  }

  /* ---------------- wiring ---------------- */
  function renderAll() { if (profileOpen()) renderProfile(); if (bagOpen()) renderBag(); }
  /* Item 5 (Han 2026-11-04): the profile and the bag are INDEPENDENT -
     opening one no longer closes the other. When both are open the
     body carries .espil-panels-both and the CSS above lays the two
     overlays side by side. */
  function syncBoth() {
    if (document.body) document.body.classList.toggle('espil-panels-both', profileOpen() && bagOpen());
  }
  function watch(panelId, fn) {
    var p = document.getElementById(panelId); if (!p) return;
    new MutationObserver(function () { syncBoth(); if (p.getAttribute('aria-hidden') === 'false') fn(); })
      .observe(p, { attributes: true, attributeFilter: ['aria-hidden'] });
  }
  watch('inventory-panel', renderBag);
  watch('character-panel', renderProfile);
  function toggleProfile(force) {
    var p = charPanel(); if (!p) return;
    var open = typeof force === 'boolean' ? force : p.getAttribute('aria-hidden') !== 'false';
    if (open) renderProfile();
    p.setAttribute('aria-hidden', String(!open));
    syncBoth();
  }
  document.addEventListener('keydown', function (e) {
    var ae = document.activeElement, tag = (ae && ae.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'p' && !e.repeat) toggleProfile();
    if (k === 'escape') { var p = charPanel(); if (p && p.getAttribute('aria-hidden') === 'false') toggleProfile(false); }
  });
  window.__espilPanelsState = function () {
    return { owned: ownedCounts(), equipped: equippedMap(),
             profileOpen: (charPanel() || {}).getAttribute ? charPanel().getAttribute('aria-hidden') === 'false' : false };
  };
  window.__espilOpenSelfProfile = function () { toggleProfile(true); };
  window.__espilGearWindow = {
    stats: computeStats, itemOf: itemOf, slots: SLOT_DEFS,
    openProfile: function () { toggleProfile(true); },
    openBag: function () { var ip = invPanel(); if (ip) { ip.setAttribute('aria-hidden', 'false'); renderBag(); } },
    state: function () { var sel = epSelection(); return { equipped: equippedMap(), look: lookMap(), stats: computeStats(), bagTab: bagTab, profTab: profTab,
      parts: { ready: !!pv.sets, error: pv.error, upper: sel.upper, weapon: sel.weapon, frame: pv.frame } }; },
    previewFrame: function (i) { pv.frame = ((i % FRAMES) + FRAMES) % FRAMES; drawFrame(); }
  };
  seedStarter();
})();
