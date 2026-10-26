/**
 * D2R-HUD v1.3 Self-Contained Asset & Data Extractor
 * Extracts authentic D2R HD rune sprites (SPa1 RGBA -> PNG), Runeword dictionary,
 * Horadric Cube recipes, and Quest Timeline guides into web/src and web/public.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const WEB_SRC = path.join(PROJECT_ROOT, 'web', 'src');
const WEB_PUBLIC = path.join(PROJECT_ROOT, 'web', 'public');
const RUNE_OUT_DIR = path.join(WEB_PUBLIC, 'data', 'portal-master', 'images', 'items', 'socketables', 'rune');
const GEM_OUT_DIR = path.join(WEB_PUBLIC, 'data', 'portal-master', 'images', 'items', 'socketables', 'gem');
const AMULET_OUT_DIR = path.join(WEB_PUBLIC, 'data', 'portal-master', 'images', 'items', 'amulet');
const RING_OUT_DIR = path.join(WEB_PUBLIC, 'data', 'portal-master', 'images', 'items', 'ring');
const CHARM_OUT_DIR = path.join(WEB_PUBLIC, 'data', 'portal-master', 'images', 'items', 'charms');

const D2R_EXTRACTED = 'C:/Users/icand/Downloads/D2R-Seonhee-20261025/extracted/seonhee/seonhee.mpq';

for (const dir of [WEB_SRC, WEB_PUBLIC, RUNE_OUT_DIR, GEM_OUT_DIR, AMULET_OUT_DIR, RING_OUT_DIR, CHARM_OUT_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// --- Minimal PNG Encoder (Pure Node.js with zlib) ---
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodeRGBAtoPNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const rawData = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    rawData[rowStart] = 0; // filter type 0
    rgbaBuffer.copy(rawData, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// 1. Convert all 33 D2R Rune .sprite files to PNG
const RUNE_LIST = [
  'El', 'Eld', 'Tir', 'Nef', 'Eth', 'Ith', 'Tal', 'Ral', 'Ort', 'Thul',
  'Amn', 'Sol', 'Shael', 'Dol', 'Hel', 'Io', 'Lum', 'Ko', 'Fal', 'Lem',
  'Pul', 'Um', 'Mal', 'Ist', 'Gul', 'Vex', 'Ohm', 'Lo', 'Sur', 'Ber',
  'Jah', 'Cham', 'Zod'
];

const spriteDir = path.join(D2R_EXTRACTED, 'data/hd/global/ui/items/misc/rune');
let convertedRunes = 0;
for (const runeName of RUNE_LIST) {
  const spriteFile = path.join(spriteDir, `${runeName.toLowerCase()}_rune.sprite`);
  const outPng = path.join(RUNE_OUT_DIR, `${runeName}_Rune.png`);
  if (fs.existsSync(spriteFile)) {
    const buf = fs.readFileSync(spriteFile);
    const width = buf.readUInt32LE(8);
    const height = buf.readUInt32LE(12);
    const rgba = buf.slice(40, 40 + width * height * 4);
    fs.writeFileSync(outPng, encodeRGBAtoPNG(width, height, rgba));
    convertedRunes++;
  }
}
console.log(`Converted ${convertedRunes}/33 D2R HD rune sprites to PNG.`);

// 2. Generate procedural D2R-styled Gem / Ring / Amulet / Charm PNG icons & Favicon
function createGemIcon(r, g, b, shape = 'diamond') {
  const w = 48, h = 48;
  const rgba = Buffer.alloc(w * h * 4, 0);
  const cx = 23.5, cy = 23.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      let dist = 0;
      if (shape === 'diamond') {
        dist = (Math.abs(dx) * 1.15 + Math.abs(dy)) / 18;
      } else if (shape === 'circle') {
        dist = Math.hypot(dx, dy) / 16;
      } else if (shape === 'ring') {
        const d = Math.hypot(dx, dy);
        dist = (d >= 9 && d <= 16) ? 0.6 : 2.0;
      } else if (shape === 'rect') {
        dist = Math.max(Math.abs(dx) / 12, Math.abs(dy) / 16);
      }
      if (dist <= 1.0) {
        const idx = (y * w + x) * 4;
        const facet = ((x + y) % 7 === 0) ? 1.25 : (1.15 - dist * 0.55);
        const spec = (dx < -2 && dy < -2 && dist < 0.55) ? 70 : 0;
        const border = dist > 0.86 ? 0.45 : 1.0;
        rgba[idx] = Math.min(255, Math.max(0, Math.round(r * facet * border + spec)));
        rgba[idx + 1] = Math.min(255, Math.max(0, Math.round(g * facet * border + spec)));
        rgba[idx + 2] = Math.min(255, Math.max(0, Math.round(b * facet * border + spec)));
        rgba[idx + 3] = 255;
      }
    }
  }
  return encodeRGBAtoPNG(w, h, rgba);
}

const GEM_COLORS = {
  Amethyst: [182, 88, 245],
  Ruby: [232, 42, 58],
  Sapphire: [56, 126, 245],
  Topaz: [245, 204, 52],
  Emerald: [48, 212, 92],
  Diamond: [225, 240, 255],
  Skull: [204, 195, 176]
};

for (const [gem, [r, g, b]] of Object.entries(GEM_COLORS)) {
  const shape = gem === 'Skull' ? 'circle' : 'diamond';
  for (const prefix of ['Perfect_', 'Flawless_', '']) {
    fs.writeFileSync(path.join(GEM_OUT_DIR, `${prefix}${gem}.png`), createGemIcon(r, g, b, shape));
  }
}
fs.writeFileSync(path.join(AMULET_OUT_DIR, 'Amulet_1.png'), createGemIcon(199, 179, 119, 'circle'));
fs.writeFileSync(path.join(RING_OUT_DIR, 'Ring_1.png'), createGemIcon(215, 186, 124, 'ring'));
fs.writeFileSync(path.join(CHARM_OUT_DIR, 'charm1u.png'), createGemIcon(156, 122, 74, 'rect'));

// Generate valid ICO file wrapping Jah_Rune.png (or 48x48 gold emblem)
const iconPng = fs.existsSync(path.join(RUNE_OUT_DIR, 'Jah_Rune.png'))
  ? fs.readFileSync(path.join(RUNE_OUT_DIR, 'Jah_Rune.png'))
  : createGemIcon(199, 179, 119, 'diamond');
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // ICO type
icoHeader.writeUInt16LE(1, 4); // 1 image
icoHeader[6] = 98; // width
icoHeader[7] = 98; // height
icoHeader[8] = 0;  // palette
icoHeader[9] = 0;  // reserved
icoHeader.writeUInt16LE(1, 10); // color planes
icoHeader.writeUInt16LE(32, 12); // bpp
icoHeader.writeUInt32LE(iconPng.length, 14);
icoHeader.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(WEB_PUBLIC, 'favicon.ico'), Buffer.concat([icoHeader, iconPng]));

// 3. Extract Runewords from D2R RunewordSubAPanelhd.json ~ F + bnet.json + item-runes.json
const bnetPath = path.join(D2R_EXTRACTED, 'data/local/lng/strings/bnet.json');
const bnetArr = JSON.parse(fs.readFileSync(bnetPath, 'utf8').replace(/^\uFEFF/, ''));
const bnetMap = {};
for (const item of bnetArr) {
  bnetMap[item.Key] = item;
}

function stripD2ColorCodes(str) {
  if (!str) return '';
  return str.replace(/ÿc[0-9a-zA-Z:;\/]/g, '').trim();
}

// Map dictRuneword key -> English name & farming recommendation from helpRuneword
const HELP_MAP = {
  dictRunewordSteel: 'helpRunewordSteel',
  dictRunewordSpiritSword: 'helpRunewordSplitSword',
  dictRunewordSpiritShield: 'helpRunewordSpiritShield',
  dictRunewordCrescentMoon: 'helpRunewordCrescentMoon',
  dictRunewordOath: 'helpRunewordOath',
  dictRunewordKingslayer: 'helpRunewordKingslayer',
  dictRunewordCallToArms: 'helpRunewordCalltoArms',
  dictRunewordGrief: 'helpRunewordGrief',
  dictRunewordLastWish: 'helpRunewordLastWish',
  dictRunewordDoom: 'helpRunewordDoom',
  dictRunewordBreathoftheDying: 'helpRunewordBreathoftheDying',
  dictRunewordEdge: 'helpRunewordEdge',
  dictRunewordHarmony: 'helpRunewordHarmony',
  dictRunewordFaith: 'helpRunewordFaith',
  dictRunewordLeaf: 'helpRunewordLeaf',
  dictRunewordWhite: 'helpRunewordWhite',
  dictRunewordHeartoftheOak: 'helpRunewordHeartoftheOak',
  dictRunewordInsight: 'helpRunewordInsight',
  dictRunewordObedience: 'helpRunewordObedience',
  dictRunewordInfinity: 'helpRunewordInfinity',
  dictRunewordDestruction: 'helpRunewordDestruction',
  dictRunewordPride: 'helpRunewordPride',
  dictRunewordDeath: 'helpRunewordDeath',
  dictRunewordStealth: 'helpRunewordStealth',
  dictRunewordSmoke: 'helpRunewordSmoke',
  dictRunewordTreachery: 'helpRunewordTreachery',
  dictRunewordDuress: 'helpRunewordDuress',
  dictRunewordStone: 'helpRunewordStone',
  dictRunewordGloom: 'helpRunewordGloom',
  dictRunewordPrudence: 'helpRunewordPrudence',
  dictRunewordFortitudeWeapon: 'helpRunewordFortitude',
  dictRunewordFortitudeArmor: 'helpRunewordFortitude',
  dictRunewordChainsofHonor: 'helpRunewordChainsofHonor',
  dictRunewordEnigma: 'helpRunewordEnigma',
  dictRunewordLore: 'helpRunewordLore',
  dictRunewordDreamHelm: 'helpRunewordDreamHelm',
  dictRunewordDreamShield: 'helpRunewordDreamHelm',
  dictRunewordAncientsPledge: 'helpRunewordAncientsPledge',
  dictRunewordRhyme: 'helpRunewordRhyme',
  dictRunewordSanctuary: 'helpRunewordSanctuaty',
  dictRunewordExile: 'helpRunewordExile',
  dictRunewordPhoenixWeapon: 'helpRunewordPhoenixShield',
  dictRunewordPhoenixShield: 'helpRunewordPhoenixShield',
  dictRunewordPattern: 'helpRunewordPattern',
  dictRunewordWisdom: 'helpRunewordWisdom',
  dictRunewordUnbendingWill: 'helpRunewordUnbendingWill',
  dictRunewordFlickeringFlame: 'helpRunewordFlickeringFlame',
  dictRunewordMist: 'helpRunewordMist',
  dictRunewordPlague: 'helpRunewordPlague',
  dictRunewordObsession: 'helpRunewordObsession'
};

function formatEnglishName(dictKey) {
  const raw = dictKey.replace(/^dictRuneword/, '')
    .replace(/(Weapon|Armor|Helm|Shield|Sword)$/, ' ($1)');
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ofthe/g, ' of the ').replace(/of/g, ' of ').replace(/\s+/g, ' ').trim();
}

const runewords = [];
const panels = ['A', 'B', 'C', 'D', 'E', 'F'];
for (const p of panels) {
  const panelPath = path.join(D2R_EXTRACTED, `data/global/ui/layouts/RunewordSub${p}Panelhd.json`);
  const panelJson = JSON.parse(fs.readFileSync(panelPath, 'utf8').replace(/^\uFEFF/, ''));
  const rows = panelJson.children[1].children[0].children;
  let currentCategory = `${p}그룹`;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const texts = [];
    const tooltips = [];
    JSON.stringify(row, (k, v) => {
      if (k === 'text') texts.push(v);
      if (k === 'tooltipString') tooltips.push(v);
      return v;
    });

    if (row.name === 'Row Gameplay Options' && texts.length === 1) {
      currentCategory = texts[0];
      continue;
    }

    if (tooltips.length > 0 && tooltips[0].startsWith('@dictRuneword')) {
      const dictKey = tooltips[0].slice(1);
      const nameKr = texts[0] || dictKey;
      const runeStr = texts[1] || '';
      const runes = runeStr.split('+').map(s => s.trim()).filter(Boolean);

      // Next row holds item types and level req
      let itemTypes = [];
      let level = 1;
      let isLadder = false;
      if (i + 1 < rows.length) {
        const nextTexts = [];
        JSON.stringify(rows[i + 1], (k, v) => {
          if (k === 'text') nextTexts.push(v);
          return v;
        });
        if (nextTexts.length > 0) {
          const lines = nextTexts[0].split('\n').map(s => s.trim());
          if (lines[0]) itemTypes = [lines[0]];
          if (lines[1]) {
            const m = lines[1].match(/(\d+)/);
            if (m) level = parseInt(m[1], 10);
            if (lines[1].includes('래더')) isLadder = true;
          }
          i++; // consume next row
        }
      }

      const rawStats = bnetMap[dictKey]?.koKR || '';
      const stats = stripD2ColorCodes(rawStats)
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      let materialSources = `${itemTypes.join(', ')} (요구 레벨 ${level}${isLadder ? ' · 래더/싱글' : ''})`;
      const helpKey = HELP_MAP[dictKey];
      if (helpKey && bnetMap[helpKey]?.koKR) {
        const helpLines = stripD2ColorCodes(bnetMap[helpKey].koKR).split('\n').map(s => s.trim());
        const recIdx = helpLines.findIndex(l => l.startsWith('추천'));
        if (recIdx !== -1) {
          materialSources = helpLines.slice(recIdx).join(' ');
        }
      }

      runewords.push({
        name: nameKr,
        original_name: formatEnglishName(dictKey),
        runes,
        item_types: itemTypes,
        level,
        stats,
        category: currentCategory,
        material_sources: materialSources
      });
    }
  }
}

// Add D2R 2.6 Runewords (Hustle, Mosaic, Metamorphosis, Ground, Temper, Hearth, Cure, Bulwark)
const D2R_26_RUNEWORDS = [
  {
    name: '투지 (무기)',
    original_name: 'Hustle (Weapon)',
    runes: ['샤엘', '코', '엘드'],
    item_types: ['3홈 무기'],
    level: 39,
    stats: [
      '타격 시 5% 확률로 1레벨 폭발적인 속도 시전',
      '장착 시 1레벨 광신 오라 효과 적용',
      '공격 속도 +30%',
      '피해 +180~200% 증가 (변함)',
      '언데드에게 주는 피해 +75%',
      '언데드에 대한 명중률 +50',
      '민첩 +10'
    ],
    category: '3홈 룬어 (무기)',
    material_sources: '추천 장비 : 페이즈 블레이드, 메이트리어컬 보우 (용병/물리 캐릭터 가성비 보조 무기)'
  },
  {
    name: '투지 (갑옷)',
    original_name: 'Hustle (Armor)',
    runes: ['샤엘', '코', '엘드'],
    item_types: ['3홈 갑옷'],
    level: 39,
    stats: [
      '달리기/걷기 속도 +65%',
      '공격 속도 +40%',
      '타격 회복 속도 +20%',
      '모든 저항 +10',
      '민첩 +6',
      '지구력 고갈 속도 50% 감소'
    ],
    category: '3홈 룬어 (방어구)',
    material_sources: '추천 장비 : 메이지 플레이트, 더스크 슈라우드 (맨땅 육성 및 물리 캐릭터 기동성 갑옷)'
  },
  {
    name: '모자이크',
    original_name: 'Mosaic',
    runes: ['말', '굴', '앰'],
    item_types: ['3홈 클로'],
    level: 53,
    stats: [
      '마무리 일격으로 공격 시 50% 확률로 충전 소모하지 않음 (쌍클 착용 시 100%)',
      '이 룬어가 부여된 무기로 마무리 일격 적중 시 충전 유지 시간 초기화',
      '모든 무술 기술 +2',
      '공격 속도 +20%',
      '피해 +200~250% 증가 (변함)',
      '명중률 보너스 +20%',
      '냉기 기술 피해 +8~15% (변함)',
      '번개 기술 피해 +8~15% (변함)',
      '화염 기술 피해 +8~15% (변함)',
      '적중당 생명력 7% 훔침',
      '괴물 회복 저지'
    ],
    category: '3홈 룬어 (무기)',
    material_sources: '추천 장비 : 루닉 탤런, 그레이터 탤런 (+3 불사조 일격 베이스 최상)'
  },
  {
    name: '치료',
    original_name: 'Cure',
    runes: ['샤엘', '이오', '탈'],
    item_types: ['3홈 투구'],
    level: 35,
    stats: [
      '장착 시 1레벨 정화 오라 효과 적용 (저주 및 독 지속시간 단축)',
      '타격 회복 속도 +20%',
      '방어력 +75~100% 증가 (변함)',
      '활력 +10',
      '최대 생명력 +5% 증가',
      '독 저항 +40~60% (변함)',
      '독 지속시간 50% 감소'
    ],
    category: '3홈 룬어 (방어구)',
    material_sources: '추천 장비 : 에테리얼 데몬헤드, 본 비지즈 (2막 기도+통찰+치료 3중 시너지 용병 투구)'
  },
  {
    name: '방벽',
    original_name: 'Bulwark',
    runes: ['샤엘', '이오', '솔'],
    item_types: ['3홈 투구'],
    level: 35,
    stats: [
      '타격 회복 속도 +20%',
      '적중당 생명력 4~6% 훔침 (변함)',
      '방어력 +75~100% 증가 (변함)',
      '활력 +10',
      '최대 생명력 5% 증가',
      '생명력 회복 +30',
      '피해 7 감소',
      '받는 물리 피해 10~15% 감소 (변함)'
    ],
    category: '3홈 룬어 (방어구)',
    material_sources: '추천 장비 : 3홈 엘리트 투구 (초중반 용병 생존용 가성비 투구)'
  },
  {
    name: '화로',
    original_name: 'Hearth',
    runes: ['샤엘', '이오', '주울'],
    item_types: ['3홈 투구'],
    level: 35,
    stats: [
      '타격 회복 속도 +20%',
      '방어력 +75~100% 증가 (변함)',
      '활력 +10',
      '최대 생명력 5% 증가',
      '냉기 저항 +40~60% (변함)',
      '냉기 흡수 +10~15% (변함)',
      '빙결되지 않음'
    ],
    category: '3홈 룬어 (방어구)',
    material_sources: '추천 장비 : 3홈 투구 (빙결 방지 및 냉기 파괴참 페널티 상쇄용)'
  },
  {
    name: '접지',
    original_name: 'Ground',
    runes: ['샤엘', '이오', '오르트'],
    item_types: ['3홈 투구'],
    level: 35,
    stats: [
      '타격 회복 속도 +20%',
      '방어력 +75~100% 증가 (변함)',
      '활력 +10',
      '최대 생명력 5% 증가',
      '번개 저항 +40~60% (변함)',
      '번개 흡수 +10~15% (변함)'
    ],
    category: '3홈 룬어 (방어구)',
    material_sources: '추천 장비 : 3홈 투구 (번개 파괴참 페널티 상쇄 및 버닝소울 대비용)'
  },
  {
    name: '담금질',
    original_name: 'Temper',
    runes: ['샤엘', '이오', '랄'],
    item_types: ['3홈 투구'],
    level: 35,
    stats: [
      '타격 회복 속도 +20%',
      '방어력 +75~100% 증가 (변함)',
      '활력 +10',
      '최대 생명력 5% 증가',
      '화염 저항 +40~60% (변함)',
      '화염 흡수 +10~15% (변함)'
    ],
    category: '3홈 룬어 (방어구)',
    material_sources: '추천 장비 : 3홈 투구 (화염 파괴참 상쇄 및 트라빈칼 하이드라 대비용)'
  },
  {
    name: '탈태',
    original_name: 'Metamorphosis',
    runes: ['이오', '참', '팔'],
    item_types: ['3홈 투구'],
    level: 67,
    stats: [
      '늑대인간 공격 적중 시 180초 동안 늑대의 징표 부여 (공격 속도 +30%, 최대 생명력 +20%)',
      '곰인간 공격 적중 시 180초 동안 곰의 징표 부여 (공격 속도 +25%, 받는 물리 피해 20% 감소)',
      '변신 기술 +5 (드루이드 전용)',
      '강타 확률 +25%',
      '방어력 +50~80% 증가 (변함)',
      '힘 +10, 활력 +10',
      '모든 저항 +10',
      '빙결되지 않음'
    ],
    category: '3홈 룬어 (방어구)',
    material_sources: '추천 장비 : +3 분노 / +3 변신술 드루이드 전용 3홈 다이어 울프 투구'
  }
];

runewords.push(...D2R_26_RUNEWORDS);
fs.writeFileSync(path.join(WEB_SRC, 'runewords.json'), JSON.stringify(runewords, null, 2), 'utf8');
console.log(`Generated web/src/runewords.json with ${runewords.length} runewords.`);

// 4. Generate comprehensive Horadric Cube Recipes (cubing.json)
const cubingRecipes = [
  // --- 장비 홈(소켓) 뚫기 ---
  {
    name: '일반 갑옷 홈 뚫기',
    category: '장비 홈 뚫기',
    recipe: '탈 + 주울 + 최상급 토파즈 + 일반 갑옷',
    result: '무작위 홈(1~최대)이 뚫린 갑옷',
    description: '슈페리어(고급)/로우퀄리티(저급) 장비에는 사용할 수 없습니다.',
    runes: ['탈', '주울']
  },
  {
    name: '일반 무기 홈 뚫기',
    category: '장비 홈 뚫기',
    recipe: '랄 + 앰 + 최상급 자수정 + 일반 무기',
    result: '무작위 홈(1~6)이 뚫린 무기',
    description: '폴암/쓰레셔/크립틱 액스 등 용병용 에테리얼 4소켓 작에 필수 사용됩니다.',
    runes: ['랄', '앰']
  },
  {
    name: '일반 투구 홈 뚫기',
    category: '장비 홈 뚫기',
    recipe: '랄 + 주울 + 최상급 사파이어 + 일반 투구',
    result: '무작위 홈(1~3)이 뚫린 투구',
    description: '치료/방벽/꺼져가는 불길 등 3홈 투구 재료 제작에 사용됩니다.',
    runes: ['랄', '주울']
  },
  {
    name: '일반 방패 홈 뚫기',
    category: '장비 홈 뚫기',
    recipe: '탈 + 앰 + 최상급 루비 + 일반 방패',
    result: '무작위 홈(1~4)이 뚫린 방패',
    description: '모너크 또는 성기사 방패(망명/영혼 재료) 홈 뚫기에 사용됩니다.',
    runes: ['탈', '앰']
  },
  {
    name: '홈에 박힌 보석/룬 제거',
    category: '장비 홈 뚫기',
    recipe: '헬 + 타운 포탈 스크롤 + 홈에 아이템이 박힌 장비',
    result: '홈이 비워진 장비 (박혀 있던 룬/주얼/보석은 소멸)',
    description: '정신(영혼) 35패캐 리롤이나 통찰 17명상 리롤 시 베이스 장비를 재활용합니다.',
    runes: ['헬']
  },

  // --- 유니크/레어 업그레이드 ---
  {
    name: '노멀 유니크 무기 → 익셉셔널 업그레이드',
    category: '유니크 업그레이드',
    recipe: '랄 + 솔 + 최상급 에메랄드 + 노멀 유니크 무기',
    result: '익셉셔널 등급으로 승급된 유니크 무기',
    description: '베이스 공격력과 착용 요구치(힘/민첩/레벨)가 상승합니다.',
    runes: ['랄', '솔']
  },
  {
    name: '익셉셔널 유니크 무기 → 엘리트 업그레이드',
    category: '유니크 업그레이드',
    recipe: '룸 + 풀 + 최상급 에메랄드 + 익셉셔널 유니크 무기',
    result: '엘리트 등급으로 승급된 유니크 무기',
    description: '타이탄의 복수, 늑대갈퀴, 립크래커 등을 엘리트 베이스로 승급합니다.',
    runes: ['룸', '풀']
  },
  {
    name: '노멀 유니크 방어구 → 익셉셔널 업그레이드',
    category: '유니크 업그레이드',
    recipe: '탈 + 샤엘 + 최상급 다이아몬드 + 노멀 유니크 방어구',
    result: '익셉셔널 등급으로 승급된 유니크 방어구',
    description: '마수(메이지피스트), 금박 허리띠(벨트 4줄 확장), 고블린 발가락 등에 사용합니다.',
    runes: ['탈', '샤엘']
  },
  {
    name: '익셉셔널 유니크 방어구 → 엘리트 업그레이드',
    category: '유니크 업그레이드',
    recipe: '코 + 렘 + 최상급 다이아몬드 + 익셉셔널 유니크 방어구',
    result: '엘리트 등급으로 승급된 유니크 방어구',
    description: '선혈기수(고어 라이더), 독사마술사의 가죽(소서 교복), 자카룸의 전령 등에 사용합니다.',
    runes: ['코', '렘']
  },
  {
    name: '노멀 세트 무기 → 익셉셔널 업그레이드',
    category: '세트/레어 업그레이드',
    recipe: '랄 + 솔 + 최상급 에메랄드 + 노멀 세트 무기',
    result: '익셉셔널 등급 세트 무기',
    description: 'D2R 패치로 추가된 세트 아이템 베이스 승급 공식입니다.',
    runes: ['랄', '솔']
  },
  {
    name: '노멀 세트 방어구 → 익셉셔널 업그레이드',
    category: '세트/레어 업그레이드',
    recipe: '탈 + 샤엘 + 최상급 다이아몬드 + 노멀 세트 방어구',
    result: '익셉셔널 등급 세트 방어구',
    description: '죽음의 위장 벨트(벨트 슬롯 16칸 확장), 천사의 옷 등을 승급합니다.',
    runes: ['탈', '샤엘']
  },
  {
    name: '노멀 레어 무기 → 익셉셔널 업그레이드',
    category: '세트/레어 업그레이드',
    recipe: '오르트 + 앰 + 최상급 사파이어 + 노멀 레어 무기',
    result: '익셉셔널 등급 레어 무기',
    description: '크리스탈 소드/차원검 에테리얼 레어 무기 승급에 활용됩니다.',
    runes: ['오르트', '앰']
  },
  {
    name: '익셉셔널 레어 무기 → 엘리트 업그레이드',
    category: '세트/레어 업그레이드',
    recipe: '팔 + 우움 + 최상급 사파이어 + 익셉셔널 레어 무기',
    result: '엘리트 등급 레어 무기',
    description: '에테리얼 디멘셔널 블레이드 → 페이즈 블레이드(내구도 무한) 변환 등에 사용됩니다.',
    runes: ['팔', '우움']
  },
  {
    name: '노멀 레어 방어구 → 익셉셔널 업그레이드',
    category: '세트/레어 업그레이드',
    recipe: '랄 + 주울 + 최상급 자수정 + 노멀 레어 방어구',
    result: '익셉셔널 등급 레어 방어구',
    description: '레어 부츠/벨트/장갑의 방어력과 벨트 슬롯을 확장합니다.',
    runes: ['랄', '주울']
  },
  {
    name: '익셉셔널 레어 방어구 → 엘리트 업그레이드',
    category: '세트/레어 업그레이드',
    recipe: '코 + 풀 + 최상급 자수정 + 익셉셔널 레어 방어구',
    result: '엘리트 등급 레어 방어구',
    description: '착용 제한(힘)이 크게 증가하므로 업그레이드 전 필요 힘을 확인하세요.',
    runes: ['코', '풀']
  },

  // --- 크래프트 (Craft) 핵심 공식 ---
  {
    name: '캐스터 아뮬렛 (시전 속도 목걸이)',
    category: '크래프트',
    recipe: '랄 + 최상급 자수정 + 주얼 + 매직 아뮬렛',
    result: '시전 속도 +5~10%, 마나 +10~20, 마나 재생 +4~10% 고정 옵션 크래프트 목걸이',
    description: '캐릭터 레벨 93 이상에서 도박한 매직 아뮬렛 사용 시 +2 모든 기술이 항상 등장 가능합니다.',
    runes: ['랄']
  },
  {
    name: '캐스터 링 (시전 반지)',
    category: '크래프트',
    recipe: '앰 + 최상급 자수정 + 주얼 + 매직 링',
    result: '마나 +10~20, 마나 재생 +4~10%, 에너지 +1~5 고정 옵션 크래프트 반지',
    description: '접미사로 +10% 시전 속도가 붙으면 광패 링으로 활용됩니다.',
    runes: ['앰']
  },
  {
    name: '캐스터 벨트 (미스릴/뱀파이어팽/샤크스킨)',
    category: '크래프트',
    recipe: '아이드 + 최상급 자수정 + 주얼 + 매직 라이트/샤크스킨/뱀파이어팽 벨트',
    result: '시전 속도 +5~10%, 마나 +10~20, 마나 재생 +4~10% 크래프트 벨트',
    description: '거미 그물띠(스웹) 입수 전 10패캐 및 패힛/힘/저항 벨트로 유용합니다.',
    runes: ['아이드']
  },
  {
    name: '블러드 장갑 (강타 장갑)',
    category: '크래프트',
    recipe: '네프 + 최상급 루비 + 주얼 + 매직 헤비글러브/샤크스킨/뱀파이어본 글러브',
    result: '강타 확률 +5~10%, 생명력 흡수 +1~3%, 생명력 +10~20 크래프트 장갑',
    description: '+20% 공격 속도 및 +2 자벨린/무술 스킬이 함께 붙으면 종결급 장갑이 됩니다.',
    runes: ['네프']
  },
  {
    name: '블러드 링 (듀얼/피흡 반지)',
    category: '크래프트',
    recipe: '솔 + 최상급 루비 + 주얼 + 매직 링',
    result: '적중당 생명력 1~3% 훔침, 힘 +1~5, 생명력 +10~20 크래프트 반지',
    description: '최대 11% 생명력 흡수, 힘 +25, 생명력 +60까지 중첩될 수 있는 물리 반지입니다.',
    runes: ['솔']
  },
  {
    name: '히트파워 장갑 (넉백 활아마 장갑)',
    category: '크래프트',
    recipe: '오르트 + 최상급 사파이어 + 주얼 + 매직 체인글러브/헤비브레이서/뱀브레이스',
    result: '밀쳐내기(넉백), 공격자가 피해 3~7 받음, 피격 시 프로스트 노바 시전 크래프트 장갑',
    description: '활 아마존에게 필수인 밀쳐내기(Knockback) + 20% 공속 장갑 제작 공식입니다.',
    runes: ['오르트']
  },

  // --- 수리 / 리롤 / 특수 조합 ---
  {
    name: '무기 수리 및 스킬 충전 회복',
    category: '수리/리롤',
    recipe: '오르트 + 최상급 깨진 보석(아무 종류) + 무기',
    result: '내구도 100% 수리 및 충전(차지) 스킬 횟수 완전 회복',
    description: '오르트 룬만 넣으면 내구도만 수리됩니다. 에테리얼 장비는 수리 불가합니다.',
    runes: ['오르트']
  },
  {
    name: '방어구 수리 및 스킬 충전 회복',
    category: '수리/리롤',
    recipe: '랄 + 하급 보석(아무 종류) + 방어구',
    result: '내구도 100% 수리 및 충전 스킬 완전 회복',
    description: '수수께끼나 인내 등 고급 갑옷의 수리비가 부담될 때 랄 룬 하나로 해결합니다.',
    runes: ['랄']
  },
  {
    name: '매직 참(부적) / 매직 아이템 옵션 리롤',
    category: '수리/리롤',
    recipe: '최상급 보석 3개 (해골 포함) + 매직 아이템 (거대 부적 등)',
    result: '동일 아이템 레벨(ilvl)로 옵션이 재설정된 매직 아이템',
    description: '공포의 영역(TZ 91+) 또는 디아블로/바알/니라트하크 드랍 거대 부적으로 45피 스킬참을 노립니다.'
  },
  {
    name: '면죄의 징표 (스탯/스킬 초기화)',
    category: '특수 조합',
    recipe: '고통의 정수(안다리엘) + 증오의 정수(메피스토) + 공포의 정수(디아블로) + 파괴의 정수(바알)',
    result: '면죄의 징표 1개',
    description: '지옥(Hell) 난이도 보스 4종이 드랍하는 정수를 조합하여 스탯과 스킬을 무제한 초기화합니다.'
  },
  {
    name: '비밀 카우 레벨 포탈 열기',
    category: '특수 조합',
    recipe: '워트의 의족 + 타운 포탈의 고서(책)',
    result: '젖소방(비밀 카우 레벨) 붉은 포탈 생성',
    description: '해당 난이도 바알을 처치한 캐릭터로 1막 자매단 야영지 안에서 조합해야 열립니다.'
  },
  {
    name: '횃불 퀘스트 1단계: 장기 포탈 3종 열기',
    category: '특수 조합',
    recipe: '공포의 열쇠(백작) + 증오의 열쇠(소환술사) + 파괴의 열쇠(니라트하크)',
    result: '여제의 소굴 / 고통의 용광로 / 잊힌 사막 포탈 중 1개 생성',
    description: '지옥 난이도 5막 해로개스에서 한 게임 안에 3세트를 각각 다른 위치에서 열어야 중복되지 않습니다.'
  },
  {
    name: '횃불 퀘스트 2단계: 우버 트리스트럼 포탈 열기',
    category: '특수 조합',
    recipe: '디아블로의 뿔 + 바알의 눈 + 메피스토의 뇌',
    result: '혼돈의 트리스트럼 포탈 생성 (처치 시 지옥불 횃불 획득)',
    description: '지옥 난이도 5막 해로개스에서 조합합니다.'
  },

  // --- 룬 업그레이드 (El -> Zod 전체) ---
  { name: '#01 엘 → #02 엘드', category: '룬 합성', recipe: '엘 + 엘 + 엘', result: '엘드 룬 (#2)', runes: ['엘', '엘드'] },
  { name: '#02 엘드 → #03 티르', category: '룬 합성', recipe: '엘드 + 엘드 + 엘드', result: '티르 룬 (#3)', runes: ['엘드', '티르'] },
  { name: '#03 티르 → #04 네프', category: '룬 합성', recipe: '티르 + 티르 + 티르', result: '네프 룬 (#4)', runes: ['티르', '네프'] },
  { name: '#04 네프 → #05 에드', category: '룬 합성', recipe: '네프 + 네프 + 네프', result: '에드 룬 (#5)', runes: ['네프', '에드'] },
  { name: '#05 에드 → #06 아이드', category: '룬 합성', recipe: '에드 + 에드 + 에드', result: '아이드 룬 (#6)', runes: ['에드', '아이드'] },
  { name: '#06 아이드 → #07 탈', category: '룬 합성', recipe: '아이드 + 아이드 + 아이드', result: '탈 룬 (#7)', runes: ['아이드', '탈'] },
  { name: '#07 탈 → #08 랄', category: '룬 합성', recipe: '탈 + 탈 + 탈', result: '랄 룬 (#8)', runes: ['탈', '랄'] },
  { name: '#08 랄 → #09 오르트', category: '룬 합성', recipe: '랄 + 랄 + 랄', result: '오르트 룬 (#9)', runes: ['랄', '오르트'] },
  { name: '#09 오르트 → #10 주울', category: '룬 합성', recipe: '오르트 + 오르트 + 오르트', result: '주울 룬 (#10)', runes: ['오르트', '주울'] },
  { name: '#10 주울 → #11 앰', category: '룬 합성', recipe: '주울 + 주울 + 주울 + 최상급 깨진 토파즈', result: '앰 룬 (#11)', runes: ['주울', '앰'] },
  { name: '#11 앰 → #12 솔', category: '룬 합성', recipe: '앰 + 앰 + 앰 + 최상급 깨진 자수정', result: '솔 룬 (#12)', runes: ['앰', '솔'] },
  { name: '#12 솔 → #13 샤엘', category: '룬 합성', recipe: '솔 + 솔 + 솔 + 최상급 깨진 사파이어', result: '샤엘 룬 (#13)', runes: ['솔', '샤엘'] },
  { name: '#13 샤엘 → #14 돌', category: '룬 합성', recipe: '샤엘 + 샤엘 + 샤엘 + 최상급 깨진 루비', result: '돌 룬 (#14)', runes: ['샤엘', '돌'] },
  { name: '#14 돌 → #15 헬', category: '룬 합성', recipe: '돌 + 돌 + 돌 + 최상급 깨진 에메랄드', result: '헬 룬 (#15)', runes: ['돌', '헬'] },
  { name: '#15 헬 → #16 이오', category: '룬 합성', recipe: '헬 + 헬 + 헬 + 최상급 깨진 다이아몬드', result: '이오 룬 (#16)', runes: ['헬', '이오'] },
  { name: '#16 이오 → #17 룸', category: '룬 합성', recipe: '이오 + 이오 + 이오 + 하급 토파즈', result: '룸 룬 (#17)', runes: ['이오', '룸'] },
  { name: '#17 룸 → #18 코', category: '룬 합성', recipe: '룸 + 룸 + 룸 + 하급 자수정', result: '코 룬 (#18)', runes: ['룸', '코'] },
  { name: '#18 코 → #19 팔', category: '룬 합성', recipe: '코 + 코 + 코 + 하급 사파이어', result: '팔 룬 (#19)', runes: ['코', '팔'] },
  { name: '#19 팔 → #20 렘', category: '룬 합성', recipe: '팔 + 팔 + 팔 + 하급 루비', result: '렘 룬 (#20)', runes: ['팔', '렘'] },
  { name: '#20 렘 → #21 풀', category: '룬 합성', recipe: '렘 + 렘 + 렘 + 하급 에메랄드', result: '풀 룬 (#21)', runes: ['렘', '풀'] },
  { name: '#21 풀 → #22 우움', category: '룬 합성', recipe: '풀 + 풀 + 토파즈', result: '우움 룬 (#22)', runes: ['풀', '우움'] },
  { name: '#22 우움 → #23 말', category: '룬 합성', recipe: '우움 + 우움 + 자수정', result: '말 룬 (#23)', runes: ['우움', '말'] },
  { name: '#23 말 → #24 이스트', category: '룬 합성', recipe: '말 + 말 + 사파이어', result: '이스트 룬 (#24)', runes: ['말', '이스트'] },
  { name: '#24 이스트 → #25 굴', category: '룬 합성', recipe: '이스트 + 이스트 + 루비', result: '굴 룬 (#25)', runes: ['이스트', '굴'] },
  { name: '#25 굴 → #26 벡스', category: '룬 합성', recipe: '굴 + 굴 + 에메랄드', result: '벡스 룬 (#26)', runes: ['굴', '벡스'] },
  { name: '#26 벡스 → #27 오움', category: '룬 합성', recipe: '벡스 + 벡스 + 다이아몬드', result: '오움 룬 (#27)', runes: ['벡스', '오움'] },
  { name: '#27 오움 → #28 로', category: '룬 합성', recipe: '오움 + 오움 + 상급 토파즈', result: '로 룬 (#28)', runes: ['오움', '로'] },
  { name: '#28 로 → #29 수르', category: '룬 합성', recipe: '로 + 로 + 상급 자수정', result: '수르 룬 (#29)', runes: ['로', '수르'] },
  { name: '#29 수르 → #30 베르', category: '룬 합성', recipe: '수르 + 수르 + 상급 사파이어', result: '베르 룬 (#30)', runes: ['수르', '베르'] },
  { name: '#30 베르 → #31 자', category: '룬 합성', recipe: '베르 + 베르 + 상급 루비', result: '자 룬 (#31)', runes: ['베르', '자'] },
  { name: '#31 자 → #32 참', category: '룬 합성', recipe: '자 + 자 + 상급 에메랄드', result: '참 룬 (#32)', runes: ['자', '참'] },
  { name: '#32 참 → #33 조드', category: '룬 합성', recipe: '참 + 참 + 상급 다이아몬드', result: '조드 룬 (#33)', runes: ['참', '조드'] }
];

fs.writeFileSync(path.join(WEB_SRC, 'cubing.json'), JSON.stringify(cubingRecipes, null, 2), 'utf8');
console.log(`Generated web/src/cubing.json with ${cubingRecipes.length} recipes.`);

// 5. Generate Quest Timeline & Leveling Guides (quest_timeline.json & warlock_guide.json)
const questTimeline = {
  meta: {
    id: 'default-quest-timeline',
    title: '성역 원정대 — 액트 1~5 필수 퀘스트 & 동선',
    author_id: 'D2R-HUD',
    original_source_id: null,
    version: '1.3.0',
    last_updated: '2026-10-27',
    class: 'All Classes',
    source_type: 'library'
  },
  steps: [
    {
      index: 0,
      condition: { type: 'ACT', value: 'Act 1-1' },
      location: '1막 — 자매단 야영지 ~ 케인 구출',
      route: '핏빛 황무지 → 악의 소굴(스킬+1) → 차가운 평야(WP) → 바위 벌판(케인 돌기둥) → 어둠숲(이주얼 나무) → 트리스트럼',
      tasks: [
        { text: '[필수/보상] 악의 소굴 모든 괴물 처치 → 아카라 보상으로 스킬 포인트 +1 획득', is_checked: false },
        { text: '차가운 평야 웨이포인트(WP) 활성화 (매장지의 핏빛 큰까마귀는 선택 사항)', is_checked: false },
        { text: '어둠숲에서 이니푸스 나무 클릭 후 아카라에게 스크롤 해독 의뢰', is_checked: false },
        { text: '바위 벌판 케인 돌기둥 작동 → 트리스트럼 진입 후 데커드 케인 구출 & 워트의 의족 확보', is_checked: false },
        { text: '아카라 상점에서 2홈 지팡이(꽃봉오리 재료) 및 2홈 갑옷(잠행 재료) 상점작 체크', is_checked: false }
      ],
      note: '지하 통로 1층 출구는 입구 방향 기준 직진(좌/우 갈림길 무시) 지형에 주로 생성됩니다.',
      strategic_tip: '레벨 6~12 구간: 검은 습지 잊힌 탑의 백작(카운테스)을 반복 처치해 탈+에드(잠행, 17레벨), 티르+랄(꽃봉오리, 19레벨), 네프+티르(구렁텅이) 룬을 확보하세요.'
    },
    {
      index: 1,
      condition: { type: 'ACT', value: 'Act 1-2' },
      location: '1막 — 잊힌 탑(백작) ~ 안다리엘 처치',
      route: '검은 습지(WP) → 잊힌 탑 5층(룬 파밍) → 외부 회랑 → 병영(호라드림 망치) → 감옥 → 내부 회랑(WP) → 지하 묘지 4층',
      tasks: [
        { text: '검은 습지 잊힌 탑 5층 백작 처치 — 잠행(탈+에드) / 강철(티르+엘) 룬 확보', is_checked: false },
        { text: '병영 대장장이 처치 후 호라드림 망치 회수 (찰시 마법부여 보상 오픈)', is_checked: false },
        { text: '지하 묘지 2층 웨이포인트 활성화 (3층 계단은 2층 WP 방 기준 시계방향 90도 벽면)', is_checked: false },
        { text: '마을에서 해독 물약 3~4개 음용 후(독 저항 +50% 중첩) 안다리엘 처치', is_checked: false },
        { text: '와리브와 대화해 2막 루트 골레인 이동', is_checked: false }
      ],
      note: '해독 물약과 해동 물약은 마실 때마다 지속시간이 30초씩 누적되며 최대 저항도 +10% 증가합니다.',
      strategic_tip: '안다리엘은 화염 저항이 -50%이므로 화염 스킬이나 화염 보석/랄 룬 무기에 매우 취약합니다.'
    },
    {
      index: 2,
      condition: { type: 'ACT', value: 'Act 2-1' },
      location: '2막 — 하수구(라다먼트) & 호라드림의 함/지팡이',
      route: '하수구 3층(스킬+1) → 메마른 언덕 → 죽음의 전당 3층(큐브) → 머나먼 오아시스 → 구더기 굴 3층(지팡이) → 잊힌 도시 → 발톱 독사 사원 2층(목걸이)',
      tasks: [
        { text: '[필수/보상] 루트 골레인 하수구 3층 라다먼트 처치 → 기술의 책(스킬 +1) 획득', is_checked: false },
        { text: '그리즈에게 전투/기도/축복받은 조준 2막 사막 용병 고용', is_checked: false },
        { text: '죽음의 전당 3층에서 호라드림의 함(큐브) 획득 (악몽/지옥 난이도 생략 가능)', is_checked: false },
        { text: '머나먼 오아시스 구더기 굴 3층에서 왕들의 지팡이 획득 (입구 기준 시계방향 벽타기)', is_checked: false },
        { text: '잊힌 도시 웨이포인트 활성화 후 발톱 독사 사원 2층 제단에서 독사의 목걸이 획득', is_checked: false },
        { text: '호라드림의 함에 왕들의 지팡이 + 독사의 목걸이를 넣어 호라드림 지팡이 조합', is_checked: false }
      ],
      note: '파라 상점에서 2홈 본 실드(제왕운시 재료), 3홈 방패(고대인의 서약 재료), 3홈 프레일(강철/원환)을 구매할 수 있습니다.',
      strategic_tip: '구더기 굴 1~2층은 입구 방향 기준 오른쪽(시계방향) 벽을 따라 이동하면 가장 빠르게 다음 층 계단을 찾습니다.'
    },
    {
      index: 3,
      condition: { type: 'ACT', value: 'Act 2-2' },
      location: '2막 — 비전 성역 ~ 탈 라샤의 무덤(두리엘)',
      route: '하렘 → 궁전 지하 3층(포탈) → 비전 성역(소환술사) → 신비술사의 협곡(WP) → 진짜 탈 라샤의 무덤 → 두리엘 처치',
      tasks: [
        { text: '드로그난과 대화 후 궁전 진입 (대화하지 않으면 제르힌 경비병이 길을 막음)', is_checked: false },
        { text: '비전 성역 4방향 중 소환술사 처치 후 호라드림 일지 클릭 → 진짜 무덤 문양 확인', is_checked: false },
        { text: '신비술사의 협곡 웨이포인트에서 퀘스트 창(Q)의 문양과 일치하는 탈 라샤 무덤 진입', is_checked: false },
        { text: '용병과 캐릭터에게 해동 물약 4개씩 복용(냉기 저항 +50%) 후 두리엘 처치', is_checked: false },
        { text: '무덤 안쪽 티리엘과 대화 → 마을 복귀 후 제르힌 및 메쉬프와 대화해 3막 이동', is_checked: false }
      ],
      note: '탈 라샤의 무덤 진행 방향은 입구 타일 기준 왼쪽(반시계방향 90도) 벽면을 따라가면 지팡이 꽂는 방이 나옵니다.',
      strategic_tip: '원소술사는 전자기장(Static Field)으로 두리엘 체력을 즉시 깎고, 근접 캐릭터는 강타(Crushing Blow) 무기를 활용하세요.'
    },
    {
      index: 4,
      condition: { type: 'ACT', value: 'Act 3-1' },
      location: '3막 — 비취 조각상/기드빈 & 칼림의 유물 3종',
      route: '거미 숲 → 거미 동굴(칼림의 눈) → 거대한 습지 → 약탈자 밀림(기드빈) → 약탈자 던전 3층(칼림의 뇌) → 쿠라스트 하류~상류 → 하수구 2층(칼림의 심장)',
      tasks: [
        { text: '[필수/보상] 첫 정예 괴물 드랍 비취 조각상 → 메쉬프 → 알코어 대화로 영구 생명력 +20 물약 획득', is_checked: false },
        { text: '거미 숲의 거미 동굴(아라크니드 동굴 아님!)에서 칼림의 눈 획득', is_checked: false },
        { text: '약탈자 밀림의 약탈자 던전 3층에서 칼림의 뇌 획득', is_checked: false },
        { text: '쿠라스트 시장/상류 지하 하수구 2층 레버 작동 후 칼림의 심장 획득', is_checked: false },
        { text: '[필수/보상] 쿠라스트 시장 폐허의 사원에서 람 에센의 고서 회수 → 알코어에게 스탯 +5 획득', is_checked: false }
      ],
      note: '3막 오르무스 상점에서 텔포봉(순간이동 충전 지팡이, 요구 레벨 24)을 미리 구매해 두면 3~5막 벽 넘기에 필수입니다.',
      strategic_tip: '자폭 인형(언데드 스티지언 돌)은 처치 순간 큰 물리 폭발 피해를 주므로 용병 뒤에서 처치하거나 텔포로 지나가세요.'
    },
    {
      index: 5,
      condition: { type: 'ACT', value: 'Act 3-2' },
      location: '3막 — 트라빈칼 의회 ~ 증오의 억류지(메피스토)',
      route: '트라빈칼(WP) → 대의회 처치(칼림의 도리깨) → 칼림의 의지 조합 후 생체구슬 파괴 → 증오의 억류지 2층(WP) → 3층 메피스토',
      tasks: [
        { text: '트라빈칼 웨이포인트 활성화 후 대의회 처치 → 칼림의 도리깨 획득', is_checked: false },
        { text: '큐브에 눈 + 뇌 + 심장 + 도리깨를 조합해 칼림의 의지 제작 후 장착·타격으로 생체구슬 파괴', is_checked: false },
        { text: '증오의 억류지 2층 웨이포인트 확보 후 입구 기준 왼쪽(시계방향) 벽을 따라 3층 진입', is_checked: false },
        { text: '메피스토 처치 후 붉은 포탈을 타고 4막 혼돈의 요새 진입', is_checked: false }
      ],
      note: '증오의 억류지 2층에서 3층으로 내려가는 계단은 입구 캐릭터 시선 기준 왼쪽 벽면을 따라 돌면 빠르게 나옵니다.',
      strategic_tip: '메피스토는 강 건너편 지형에 걸치기(강가 파이어볼/블리자드 딜링)가 가능해 원거리 캐릭터의 핵심 파밍처입니다.'
    },
    {
      index: 6,
      condition: { type: 'ACT', value: 'Act 4' },
      location: '4막 — 타락한 천사(이주얼) ~ 혼돈의 성역(디아블로)',
      route: '외부 평원 → 절망의 평원(이주얼, 스킬+2) → 저주받은 자들의 도시(WP) → 불길의 강(WP/지옥불 제단) → 혼돈의 성역 봉인 5개 → 디아블로',
      tasks: [
        { text: '[필수/보상] 절망의 평원에서 이주얼 처치 후 영혼 대화 → 티리엘에게 스킬 포인트 +2 획득', is_checked: false },
        { text: '불길의 강 지옥불 제단에서 대장장이 헤파스토 처치 후 메피스토 영혼석 파괴(룬/보석 보상)', is_checked: false },
        { text: '불길의 강 웨이포인트 활성화 후 혼돈의 성역 진입', is_checked: false },
        { text: '혼돈의 성역 5개 봉인 해제 및 군주 드 사이스 / 영혼의 감염자 / 혼돈의 대장군 3보스 처치', is_checked: false },
        { text: '디아블로 처치 후 티리엘의 포탈을 통해 5막 해로개스 이동', is_checked: false }
      ],
      note: '악몽 난이도 헬포지에서는 최대 우움(#22), 지옥 난이도 헬포지에서는 최대 굴(#25) 룬이 드랍됩니다.',
      strategic_tip: '보통 난이도 디아블로의 번개 숨결(레드 라이트닝)은 캐릭터와 완전히 밀착하면 판정이 닿지 않거나 대각선 이동으로 피할 수 있습니다.'
    },
    {
      index: 7,
      condition: { type: 'ACT', value: 'Act 5-1' },
      location: '5막 — 쉔크(소켓 보상) & 앤야 구출(모든 저항 +10)',
      route: '핏빛 기슭(쉔크) → 혹한의 고산지(WP/바바리안 3명 구출) → 고대인의 길 → 수정 동굴 → 얼어붙은 강(앤야 구출)',
      tasks: [
        { text: '[필수/보상] 핏빛 기슭 감독관 쉔크 처치 → 라르주크 장비 홈(소켓) 추가 보상 해금', is_checked: false },
        { text: '[보상] 혹한의 고산지에서 포로 바바리안 15명 구출 → 퀄케크에게 랄+오르트+탈(고대인의 서약) 룬 획득', is_checked: false },
        { text: '[필수/보상] 수정 동굴 아래 얼어붙은 강에서 얼어붙은 앤야 확인 → 마라에게 해동 물약 수령 → 앤야 구출', is_checked: false },
        { text: '마라와 대화해 저항의 두루마리 수령 후 우클릭 사용 → 모든 저항 영구 +10% 증가', is_checked: false },
        { text: '고대인의 길 웨이포인트 활성화 (아리앗 정상 진입용 거점)', is_checked: false }
      ],
      note: '보통 카우방이나 결정의 통로에서 드랍된 흰색 크리스탈 소드/브로드 소드를 라르주크에게 주면 확정 4홈(영혼 재료)이 뚫립니다.',
      strategic_tip: '얼어붙은 강에는 영혼(버닝 소울)과 마녀가 등장하므로 번개 저항 75%를 반드시 맞추고 진입하세요.'
    },
    {
      index: 8,
      condition: { type: 'ACT', value: 'Act 5-2' },
      location: '5막 — 아리앗 정상(삼바바) & 세계석 성채(바알)',
      route: '고대인의 길(WP) → 아리앗 정상(삼바바, 20/40/60레벨 제한) → 세계석 성채 2층(WP) → 파괴의 왕좌(5웨이브) → 바알 처치',
      tasks: [
        { text: '[필수] 아리앗 정상에서 고대인 3인(탈릭·매덕·코릭)을 포탈 열지 않고 한 번에 처치 (레벨 20/40/60 필요)', is_checked: false },
        { text: '세계석 성채 2층 웨이포인트 활성화 (3층 계단은 2층 WP 방 기준 오른쪽 시계방향 벽면)', is_checked: false },
        { text: '파괴의 왕좌에서 바알의 소환수 5웨이브(콜렌조~리스터) 전멸', is_checked: false },
        { text: '세계석 보관실 진입 후 바알 처치 → 다음 난이도 및 비밀 카우방 해금!', is_checked: false }
      ],
      note: '지옥 난이도 고대인 3인 전투 전에는 바닥에 물약을 미리 뿌려 두고, 텔포봉으로 고대인을 한 명씩 분리해 각개격파하세요.',
      strategic_tip: '바알 클리어 후 공포의 영역(Terror Zone)이 활성화되면 현 난이도 최고 효율로 경험치와 룬/부적을 파밍할 수 있습니다.'
    }
  ]
};

const warlockGuide = {
  meta: {
    id: 'abyss-warlock-guide',
    title: '캐스터 스타터 — 원소/네크/팔라 맨땅 고속 빌드업',
    author_id: 'D2R-HUD',
    original_source_id: null,
    version: '1.3.0',
    last_updated: '2026-10-27',
    class: 'Caster Starter',
    source_type: 'library'
  },
  steps: [
    {
      index: 0,
      condition: { type: 'LEVEL', value: 'Lv 1 ~ 18' },
      location: '초반 세팅 — 잠행(Stealth) & 꽃봉오리(Leaf)',
      route: '1막 악의 소굴 → 잊힌 탑 백작 룬 파밍 → 아카라/드로그난 상점 재료 구매',
      tasks: [
        { text: '잊힌 탑 백작 반복 파밍으로 탈+에드(잠행), 티르+랄(꽃봉오리), 네프+티르(구렁텅이) 룬 확보', is_checked: false },
        { text: '찰시에게 2홈 일반 갑옷(브레스트 플레이트/스플린트 메일 제외 가벼운 갑옷) 구매', is_checked: false },
        { text: '레벨 17 달성 즉시 갑옷에 탈 + 에드 순서로 장착해 잠행(달리기/패캐/패힛 +25%) 완성', is_checked: false },
        { text: '화염 스킬 캐릭터는 2홈 양손 지팡이에 티르 + 랄을 박아 꽃봉오리(화염 기술 +3) 제작', is_checked: false }
      ],
      note: '파란색(매직) 장비에는 룬워드가 발동하지 않습니다. 반드시 회색 이름의 일반 소켓 장비를 사용하세요.',
      strategic_tip: '지구력 물약 4~6개를 벨트나 인벤토리에 두고 마시면 초반 지구력 부족 없이 계속 달릴 수 있습니다.'
    },
    {
      index: 1,
      condition: { type: 'LEVEL', value: 'Lv 19 ~ 27' },
      location: '중반 세팅 — 고대인의 서약 & 전승(Lore) & 영혼(Spirit)',
      route: '보통 카우방 재료 파밍 → 라르주크 4홈 소켓 → 악몽 백작 솔/앰/샤엘 파밍',
      tasks: [
        { text: '5막 바바리안 구출 보상(랄+오르트+탈)을 3홈 방패에 장착해 고대인의 서약(모든 저항 +43~48%) 완성', is_checked: false },
        { text: '보통 카우방에서 흰색 크리스탈 소드/브로드 소드 및 4홈 미늘창(폴암) 확보', is_checked: false },
        { text: '라르주크 소켓 보상으로 크리스탈 소드 4홈 확정 후 탈+주울+오르트+앰 장착 → 영혼(Spirit) 검 완성', is_checked: false },
        { text: '2홈 투구에 오르트+솔 장착 → 전승(모든 기술 +1, 번개 저항 +30%, 적 처치 시 마나 +2) 완성', is_checked: false },
        { text: '용병용 4홈 미늘창에 랄+티르+탈+솔 장착 → 통찰(명상 오라로 마나 무한 회복) 완성', is_checked: false }
      ],
      note: '영혼(Spirit) 방패는 성기사 전용 방패를 제외하면 힘제 156의 모너크(지옥 난이도 드랍)부터 4홈이 가능합니다.',
      strategic_tip: '2막 기도 용병에게 통찰 무기와 치료(샤엘+이오+탈) 투구를 함께 채우면 기도 회복량이 3배로 중첩됩니다.'
    },
    {
      index: 2,
      condition: { type: 'LEVEL', value: 'Lv 28 ~ 75+' },
      location: '악몽~지옥 진입 — 연기(Smoke) / 배신(Treachery) & 저항 세팅',
      route: '악몽 백작(룸/코/렘) → 악몽 바알 65레벨업 → 지옥 안다리엘/메피스토/공포의 영역',
      tasks: [
        { text: '지옥 진입 전 2홈 갑옷에 네프+룸을 박아 연기(모든 저항 +50%) 제작하여 지옥 저항 -100% 페널티 대비', is_checked: false },
        { text: '용병용 3홈 갑옷에 샤엘+주울+렘(배신) 또는 샤엘+이오+솔(방벽) 투구로 용병 생존력 완성', is_checked: false },
        { text: '2홈 방패에 샤엘+에드를 박아 제왕운시(빙결되지 않음, 모든 저항 +25, 매찬 +25%) 제작', is_checked: false },
        { text: '지옥 클리어 후 공포의 영역(TZ)에서 파괴의 부적(Sunder Charm) 확보 및 최종 빌드 전환', is_checked: false }
      ],
      note: '지옥 난이도에서는 원소 면역 괴물이 다수 등장하므로, 3막 오르무스 상점에서 산 텔포봉으로 면역 구간을 빠르게 돌파하세요.',
      strategic_tip: '참나무의 심장(코+벡스+풀+주울, 4홈 프레일)과 소집(앰+랄+말+이스트+오움, 5홈 크리스탈 소드)을 맞춘 뒤 수수께끼로 넘어갑니다.'
    }
  ]
};

fs.writeFileSync(path.join(WEB_SRC, 'quest_timeline.json'), JSON.stringify(questTimeline, null, 2), 'utf8');
fs.writeFileSync(path.join(WEB_SRC, 'warlock_guide.json'), JSON.stringify(warlockGuide, null, 2), 'utf8');
console.log('Generated web/src/quest_timeline.json and web/src/warlock_guide.json.');
