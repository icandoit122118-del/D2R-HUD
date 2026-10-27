const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB_SRC = path.join(ROOT, 'web', 'src');
const YUPGOOLG_MERGED = 'C:\\Users\\icand\\Downloads\\D2R-Yupgoolg-20261025\\arrow\\merged\\mods\\yupgoolg\\yupgoolg.mpq';
const SEONHEE_MOD = 'D:\\Diablo II Resurrected\\mods\\seonheeCustom\\seonheeCustom.mpq';
const OUT_MOD_DIR = path.join(ROOT, 'mod', 'd2rhud', 'd2rhud.mpq');
const OUT_YUPGOOLG_OVERLAY = path.join(ROOT, 'mod', 'yupgoolg-patch');

function stripJsonComments(str) {
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = str[i + 1];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < str.length && str[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < str.length && !(str[i] === '*' && str[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += ch;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

function readD2RJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(stripJsonComments(raw));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// Load reverse-engineered datasets
const questTimeline = JSON.parse(fs.readFileSync(path.join(WEB_SRC, 'quest_timeline.json'), 'utf8'));
const warlockGuide = JSON.parse(fs.readFileSync(path.join(WEB_SRC, 'warlock_guide.json'), 'utf8'));
const runewords = JSON.parse(fs.readFileSync(path.join(WEB_SRC, 'runewords.json'), 'utf8'));
const cubing = JSON.parse(fs.readFileSync(path.join(WEB_SRC, 'cubing.json'), 'utf8'));

// Map Reading Direction Formulas (12 core dungeon rules)
const MAP_CHEATSHEET = [
  {
    act: '1막',
    zone: '검은 습지 - 잊힌 탑 1~4층 (백작)',
    rule: '입구 타일 진입 방향 기준 왼쪽(시계방향 90도) 벽면을 따라 진행',
    detail: '백작(카운테스) 룬 파밍 시 매 층 입구에서 캐릭터 시선 좌측 벽을 타면 가장 빠르게 다음 층 계단이 나옵니다.'
  },
  {
    act: '1막',
    zone: '지하 통로 1층 / 감옥 1~3층',
    rule: '입구 방향 기준 직진 지형에 출구, 좌측(시계방향)에 2층/웨이포인트',
    detail: '바위 벌판으로 나가는 지하 통로 1층 출구는 입구 방향 정면(직진) 라인 끝에 배치됩니다.'
  },
  {
    act: '1막',
    zone: '내부 회랑 - 지하 묘지 2층 → 3층 (안다리엘)',
    rule: '지하 묘지 2층 웨이포인트(WP) 방 출구 기준 오른쪽(반시계방향 90도)',
    detail: '2층 WP 방에서 빠져나오는 방향을 기준으로 우측(시계 반대방향) 모서리에 3층 계단이 위치합니다.'
  },
  {
    act: '2막',
    zone: '머나먼 오아시스 - 구더기 굴 1~2층',
    rule: '입구 타일 기준 오른쪽(반시계방향 90도) 벽면을 따라 이동',
    detail: '좁은 통로 지형이므로 입구에서 우측 벽만 계속 따라가면 2층·3층(왕들의 지팡이) 계단이 바로 나옵니다.'
  },
  {
    act: '2막',
    zone: '죽음의 전당 1~2층 / 발톱 독사 사원 1층',
    rule: '입구 타일 기준 왼쪽(시계방향 90도) 벽면을 따라 이동',
    detail: '호라드림의 함(죽음의 전당 3층)과 독사의 목걸이(독사 사원 2층) 모두 입구 기준 좌측 벽타기 공식이 적용됩니다.'
  },
  {
    act: '2막',
    zone: '비전 성역 (소환술사 4방향)',
    rule: '웨이포인트 기준 4갈래 중 막다른 끝 - 포탈/계단 유무로 지형 판별',
    detail: '소환술사 처치 후 호라드림 일지를 읽고 퀘스트(Q) 창의 문양과 일치하는 탈 라샤 무덤을 확인하세요.'
  },
  {
    act: '2막',
    zone: '신비술사의 협곡 - 탈 라샤의 무덤 (두리엘)',
    rule: '무덤 입구 기준 왼쪽(시계방향 90도) 벽면을 따라가면 지팡이 홈 방 등장',
    detail: '7개 무덤의 문양 순서(원 → 반달 → 네모 → 별 → 아래세모 → 동그라미세모 → 위세모)는 항상 고정입니다.'
  },
  {
    act: '3막',
    zone: '증오의 억류지 2층 → 3층 (메피스토)',
    rule: '증오 2층 입구 타일 기준 왼쪽(시계방향 90도) 벽면을 따라 이동',
    detail: '2층 웨이포인트(WP) 기준이 아니라 1층에서 2층으로 내려온 입구 타일 기준 좌측 벽면입니다.'
  },
  {
    act: '4막',
    zone: '절망의 평원(이주얼) / 불길의 강(헬포지)',
    rule: '외곽 벽면을 따라 이동하며 미니맵 성소/제단 아이콘 확인',
    detail: '불길의 강은 웨이포인트 직전 갈림길 반대편에 대장장이 헤파스토의 지옥불 제단이 생성됩니다.'
  },
  {
    act: '5막',
    zone: '고대인의 길 / 수정 동굴 / 혹한의 지하도',
    rule: '입구 타일 기준 왼쪽(시계방향 90도)에 다음 지역(아리앗 정상/얼어붙은 강) 출구',
    detail: '웨이포인트는 주로 직진 방향에, 다음 퀘스트 지역 출구는 좌측(시계방향)에 배치됩니다.'
  },
  {
    act: '5막',
    zone: '고통의 전당 - 보트의 전당 (니라트하크)',
    rule: '보트의 전당 WP에서 내린 후 벽면 눈동자 벽화가 그려진 방향이 진짜 니라트하크 방',
    detail: '4갈래 갈림길 중 중앙 기둥 또는 입구 벽면에 붉은 눈동자 문양이 있는 쪽으로 직진하면 니라트하크가 있습니다.'
  },
  {
    act: '5막',
    zone: '세계석 성채 2층 → 3층 (바알)',
    rule: '세계석 성채 2층 웨이포인트(WP) 방 출구 기준 오른쪽(반시계방향 90도) 벽면',
    detail: '2층 WP 방에서 나오는 방향 기준 우측 벽면을 따라 돌면 3층 계단이 가장 빠르게 나타납니다.'
  }
];

function sanitizeD2RText(str) {
  if (!str) return '';
  return String(str)
    .replace(/[•✓✔]/g, '·')
    .replace(/[▸▹►]/g, '▶')
    .replace(/[└┗]/g, '→')
    .replace(/[—–]/g, '-');
}

function splitIntoSingleLines(str, maxLen = 44, contPrefix = '   ') {
  const clean = sanitizeD2RText(str);
  if (clean.length <= maxLen) return [clean];
  const words = clean.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxLen && cur.length > 0) {
      lines.push(cur);
      cur = `${contPrefix}${w}`;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// High-contrast crisp drop shadow for transparent HUD text over live game world
const HUD_TRANSPARENT_SHADOW = {
  shadowColor: { r: 0, g: 0, b: 0, a: 255 },
  offset: { x: 3, y: 3 }
};

function makeTextStyle(colorVar, sizeVar, alignH = 'left', alignV = 'center', lineWrap = false) {
  return {
    fontColor: colorVar,
    pointSize: sizeVar,
    alignment: { h: alignH, v: alignV },
    options: { lineWrap, newlineHandling: 'standard', pipeCharacterBehavior: 'handle' },
    spacing: { leading: 1.12, kerning: 0.94 },
    dropShadow: HUD_TRANSPARENT_SHADOW
  };
}

function makeDividerRow(width = 1480) {
  return {
    type: 'TableRowWidget',
    name: 'RowDivider',
    children: [
      {
        type: 'ImageWidget',
        name: 'Divider',
        fields: {
          rect: { x: 4, y: 24, width, height: 4 },
          filename: 'PauseMenu\\Divider'
        }
      }
    ]
  };
}

function makeSingleTextRow(col1Text, col1Color, col1Size, col2Text = '', col2Color = '$FontColorLightGold', col2Size = '$SmallFontSize', tooltip = '') {
  const children = [
    {
      type: 'LayoutItemWidget',
      name: 'Col1Wrap',
      fields: { marginTop: 3, marginBottom: 3 },
      children: [
        {
          type: 'TextBoxWidget',
          name: 'Col1Text',
          fields: {
            fitToText: true,
            text: sanitizeD2RText(col1Text),
            style: makeTextStyle(col1Color, col1Size, 'left', 'center', false)
          }
        }
      ]
    }
  ];

  if (col2Text || tooltip) {
    const col2Child = tooltip
      ? {
          type: 'ButtonWidget',
          name: 'Col2TooltipBtn',
          fields: {
            rect: { scale: 0.54 },
            filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
            hoveredFrame: 3,
            textString: sanitizeD2RText(col2Text || '상세 옵션'),
            textColor: col2Color,
            'text/style': '$StyleFEButtonText',
            tooltipString: sanitizeD2RText(tooltip),
            pressedFrame: 0,
            sound: 'cursor_select'
          }
        }
      : {
          type: 'TextBoxWidget',
          name: 'Col2Text',
          fields: {
            fitToText: true,
            text: sanitizeD2RText(col2Text),
            style: makeTextStyle(col2Color, col2Size, 'center', 'center', false)
          }
        };

    children.push({
      type: 'LayoutItemWidget',
      name: 'Col2Wrap',
      fields: { marginTop: 3, marginBottom: 3 },
      children: [col2Child]
    });
  }

  return {
    type: 'TableRowWidget',
    name: 'DataRow',
    children
  };
}

function pushWrappedRows(rows, col1Text, col1Color, col1Size, col2Text = '', col2Color = '$FontColorLightGold', col2Size = '$SmallFontSize', tooltip = '') {
  const maxLen = col1Size === '$MediumLargeFontSize' ? 38 : col1Size === '$MediumFontSize' ? 42 : 48;
  const lines = splitIntoSingleLines(col1Text, maxLen, '   ');
  lines.forEach((line, idx) => {
    if (idx === 0) {
      rows.push(makeSingleTextRow(line, col1Color, col1Size, col2Text, col2Color, col2Size, tooltip));
    } else {
      rows.push(makeSingleTextRow(line, col1Color, col1Size, '', col2Color, col2Size, ''));
    }
  });
}

// ============================================================================
// 1. TRANSPARENT & ADJUSTABLE ENCYCLOPEDIA (D2RHudMainPanel + Sub-Panels)
//    - Background stone slab (FrontEndOptionsBG / Panel_Options_BG / full-screen
//      blackout) completely removed so live gameplay stays visible!
//    - Includes window size controls: [▲ 창 접기] [소형창] [기본창] [대형창]
// ============================================================================
function buildMainPanel() {
  return {
    type: 'SettingsPanel',
    name: 'D2RHudMainPanel',
    fields: {
      priority: 9002,
      rect: { x: -860, y: 24, width: 1720, height: 150 },
      anchor: { x: 0.5, y: 0.0 }
    },
    children: [
      {
        type: 'TextBoxWidget',
        name: 'Title',
        fields: {
          rect: { x: 16, y: 6, width: 680, height: 42 },
          text: '★ D2R-HUD v1.3 호라드림 투명 대사전 (룬워드 98종 · 큐빙 60종)',
          style: makeTextStyle('$FontColorGoldYellow', '$MediumFontSize', 'left', 'center', false)
        }
      },
      {
        type: 'ButtonWidget',
        name: 'OpenMiniTrackerBtn',
        fields: {
          rect: { x: 1470, y: 4, scale: 0.48 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '좌측 미니HUD',
          onClickMessage: 'PanelManager:TogglePanel:D2RHudTrackerPanel',
          tooltipString: '좌측 상단 투명 성역 미니 내비게이터를 켜거나 끕니다.',
          textColor: '$FontColorLightGold',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'CloseButton',
        fields: {
          rect: { x: 1656, y: 4, scale: 0.72 },
          filename: 'PANEL\\closebtn_4x',
          hoveredFrame: 3,
          onClickMessage: 'PanelManager:ClosePanel:D2RHudMainPanel',
          tooltipString: '@strClose',
          sound: 'cursor_close_window_hd',
          acceptsEscKeyEverywhere: true,
          action: 'back'
        }
      },
      {
        type: 'TabBarWidget',
        name: 'OptionsTabs',
        fields: {
          rect: { x: 12, y: 52, scale: 0.88, width: 1720, height: 105 },
          anchor: { x: 0.0, y: 0.0 },
          tabCount: 7,
          tabSize: { x: 242, y: 100 },
          tabPadding: { x: 2, y: 0 },
          unavailableTabsLeaveGaps: false,
          tabSizingMethod: 'fixedCenter',
          filename: 'Controller/Panel/Stash/V2/StashTabs',
          inactiveFrames: [1, 1, 1, 1, 1, 1, 1],
          activeFrames: [0, 0, 0, 0, 0, 0, 0],
          activeTextColor: '$TabsActiveTextColor',
          inactiveTextColor: '$TabsInactiveTextColor',
          tabTextOffset: { x: 0, y: -4 },
          textStyle: {
            options: { lineWrap: true },
            pointSize: '$SmallFontSize',
            alignment: { h: 'center', v: 'center' },
            fontColor: '$FontColorWhite',
            spacing: { leading: 0.9, kerning: 0.95 }
          },
          textStrings: [
            '캠페인 1~3막',
            '캠페인 4~5막·길찾기',
            '초반육성·스타터',
            '룬워드 (2~3홈)',
            '룬워드 (4홈)',
            '룬워드 (5~6홈·신규)',
            '호라드림 큐빙 60종'
          ],
          tabMessages: [
            'SettingsPanelMessage:CheckChanges:D2RHudCamp1Panel',
            'SettingsPanelMessage:CheckChanges:D2RHudCamp2Panel',
            'SettingsPanelMessage:CheckChanges:D2RHudStarterPanel',
            'SettingsPanelMessage:CheckChanges:D2RHudRw23Panel',
            'SettingsPanelMessage:CheckChanges:D2RHudRw4Panel',
            'SettingsPanelMessage:CheckChanges:D2RHudRw56Panel',
            'SettingsPanelMessage:CheckChanges:D2RHudCubePanel'
          ]
        }
      }
    ]
  };
}

function buildMainFoldSubPanel() {
  return {
    type: 'VideoOptionsPanel',
    name: 'D2RHudMainFold',
    fields: {
      priority: 9003,
      rect: { x: -840, y: 156, width: 1680, height: 64 },
      anchor: { x: 0.5, y: 0.0 },
      applySettingsImmediately: false
    },
    children: [
      {
        type: 'TextBoxWidget',
        name: 'FoldNotice',
        fields: {
          rect: { x: 16, y: 8, width: 580, height: 40 },
          text: '▼ 호라드림 대사전 출력창 접힘 (펴기 선택):',
          style: makeTextStyle('$FontColorLightYellow', '$SmallFontSize', 'left', 'center', false)
        }
      },
      {
        type: 'ButtonWidget',
        name: 'UnfoldSmallBtn',
        fields: {
          rect: { x: 560, y: 4, scale: 0.48 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '▼ 소형 6줄 펴기',
          onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudRw23SPanel',
          textColor: '$FontColorLightTeal',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'UnfoldMedBtn',
        fields: {
          rect: { x: 750, y: 4, scale: 0.48 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '▼ 중형 11줄 펴기',
          onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudRw23Panel',
          textColor: '$FontColorGreen',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'UnfoldLargeBtn',
        fields: {
          rect: { x: 940, y: 4, scale: 0.48 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '▼ 대형 18줄 펴기',
          onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudRw23LPanel',
          textColor: '$FontColorGoldYellow',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      }
    ]
  };
}

function buildEncyclopediaSubPanel(baseKey, suffix, rows, heightPx = 640, rowHeight = 56) {
  const panelName = `D2RHud${baseKey}${suffix}Panel`;
  const modeLabel = suffix === 'S' ? '소형6줄' : suffix === 'L' ? '대형18줄' : '중형11줄';

  return {
    type: 'VideoOptionsPanel',
    name: panelName,
    fields: {
      priority: 9003,
      rect: { x: -840, y: 156, width: 1680, height: heightPx + 58 },
      anchor: { x: 0.5, y: 0.0 },
      applySettingsImmediately: false
    },
    children: [
      // Per-tab adjustable window size toolbar
      {
        type: 'TextBoxWidget',
        name: 'SizeStatusText',
        fields: {
          rect: { x: 16, y: 4, width: 220, height: 38 },
          text: `▶ [${modeLabel}]`,
          style: makeTextStyle('$FontColorLightYellow', '$SmallFontSize', 'left', 'center', false)
        }
      },
      {
        type: 'ButtonWidget',
        name: 'SubFoldBtn',
        fields: {
          rect: { x: 240, y: 0, scale: 0.46 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '▲ 창 접기',
          onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudMainFold',
          textColor: '$FontColorLightYellow',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'SubSmallBtn',
        fields: {
          rect: { x: 430, y: 0, scale: 0.46 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '소형 6줄',
          onClickMessage: `SettingsPanelMessage:CheckChanges:D2RHud${baseKey}SPanel`,
          textColor: suffix === 'S' ? '$FontColorGoldYellow' : '$FontColorLightTeal',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'SubMedBtn',
        fields: {
          rect: { x: 620, y: 0, scale: 0.46 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '중형 11줄',
          onClickMessage: `SettingsPanelMessage:CheckChanges:D2RHud${baseKey}Panel`,
          textColor: suffix === '' ? '$FontColorGoldYellow' : '$FontColorGreen',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'SubLargeBtn',
        fields: {
          rect: { x: 810, y: 0, scale: 0.46 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '대형 18줄',
          onClickMessage: `SettingsPanelMessage:CheckChanges:D2RHud${baseKey}LPanel`,
          textColor: suffix === 'L' ? '$FontColorGoldYellow' : '$FontColorWhite',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ImageWidget',
        name: 'ScrollBarBackground',
        fields: {
          rect: { x: -12, y: 50, width: 24, height: heightPx },
          anchor: { x: 1.0 },
          filename: 'PauseMenu\\VerticalScroll'
        },
        children: [
          {
            type: 'ScrollControllerWidget',
            name: 'ScrollController',
            fields: {
              rect: { x: -22, y: 24, width: 24, height: heightPx - 48 },
              anchor: { x: 1.0 },
              upArrowFilepath: 'FrontEnd\\HD\\Final\\FrontEnd_ScrollUpBtn',
              downArrowFilepath: 'FrontEnd\\HD\\Final\\FrontEnd_ScrollDownBtn',
              barFilepath: 'PauseMenu\\VerticalIndicator',
              viewName: 'ScrollView',
              wheelScrollSound: 'cursor_scroll_hd',
              buttonScrollSound: 'cursor_scroll_hd'
            }
          }
        ]
      },
      {
        type: 'ScrollViewWidget',
        name: 'ScrollView',
        fields: {
          rect: { x: 16, y: 50, width: 1620, height: heightPx },
          scrollControllerName: 'ScrollController',
          clipChildrenDraw: true
        },
        children: [
          {
            type: 'TableWidget',
            name: 'OptionsTable',
            fields: {
              columns: [
                { width: 1180, alignment: { h: 'fit', v: 'fit' } },
                { width: 420, alignment: { h: 'center', v: 'center' } }
              ],
              rowHeight
            },
            children: rows
          }
        ]
      }
    ]
  };
}

function generateCampaignRows(stepsSubset, includeMapRules = false) {
  const rows = [];
  pushWrappedRows(
    rows,
    '★ D2R-HUD v1.3 성역 원정대 필수 퀘스트 & 동선 가이드',
    '$FontColorGreen',
    '$MediumFontSize',
    '마우스 오버 팁',
    '$FontColorGoldYellow'
  );
  rows.push(makeDividerRow());

  for (const step of stepsSubset) {
    const tooltip = [
      `ÿc8[${step.condition.value}] ${step.location}`,
      '',
      `ÿc2[최적 동선]ÿc0`,
      step.route,
      '',
      `ÿc4[길찾기 노트]ÿc0`,
      step.note,
      '',
      `ÿc1[보스 & 전략 팁]ÿc0`,
      step.strategic_tip
    ].join('\n');

    pushWrappedRows(
      rows,
      `■ [${step.condition.value}] ${step.location}`,
      '$FontColorGoldYellow',
      '$MediumFontSize',
      '공략 툴팁 보기',
      '$FontColorLightGold',
      '$SmallFontSize',
      tooltip
    );
    pushWrappedRows(
      rows,
      `▶ 핵심 동선: ${step.route}`,
      '$FontColorLightTeal',
      '$SmallFontSize',
      step.condition.value,
      '$FontColorGoldYellow',
      '$SmallFontSize'
    );
    for (let i = 0; i < step.tasks.length; i++) {
      const t = step.tasks[i];
      const isReward = t.text.includes('[필수') || t.text.includes('[보상');
      pushWrappedRows(
        rows,
        `  [${i + 1}] ${t.text}`,
        isReward ? '$FontColorLightYellow' : '$FontColorWhite',
        '$SmallFontSize',
        isReward ? '★ 필수 보상' : '진행 체크',
        isReward ? '$FontColorOrange' : '$FontColorLightGray',
        '$SmallFontSize'
      );
    }
    pushWrappedRows(
      rows,
      `  ★ 길찾기: ${step.note}`,
      '$FontColorLightBlue',
      '$SmallFontSize',
      '핵심 팁',
      '$FontColorLightBlue',
      '$SmallFontSize'
    );
    rows.push(makeDividerRow());
  }

  if (includeMapRules) {
    pushWrappedRows(
      rows,
      '★ 성역 던전 길찾기 방향 공식 12선 (입구 타일/웨이포인트 기준)',
      '$FontColorGoldYellow',
      '$MediumFontSize',
      '12개 핵심 던전',
      '$FontColorGreen',
      '$SmallFontSize'
    );
    rows.push(makeDividerRow());
    for (const m of MAP_CHEATSHEET) {
      const tip = `ÿc8[${m.act}] ${m.zone}\n\nÿc2[길찾기 공식]ÿc0\n${m.rule}\n\nÿc0${m.detail}`;
      pushWrappedRows(
        rows,
        `· [${m.act}] ${m.zone} → ${m.rule}`,
        '$FontColorLightYellow',
        '$SmallFontSize',
        '상세 설명 툴팁',
        '$FontColorLightGold',
        '$SmallFontSize',
        tip
      );
    }
    rows.push(makeDividerRow());
  }

  return rows;
}

function generateStarterRows() {
  const rows = [];
  pushWrappedRows(
    rows,
    '★ 맨땅 스타터 & 악마술사/원소술사/성기사 레벨업 고속 빌드업 가이드',
    '$FontColorGreen',
    '$MediumFontSize',
    '레벨별 로드맵',
    '$FontColorGoldYellow'
  );
  rows.push(makeDividerRow());

  for (const step of warlockGuide.steps) {
    const tip = [
      `ÿc8[${step.condition.value}] ${step.location}`,
      '',
      `ÿc2[파밍 루트]ÿc0 ${step.route}`,
      '',
      `ÿc4[핵심 주의사항]ÿc0 ${step.note}`,
      '',
      `ÿc1[시너지 & 팁]ÿc0 ${step.strategic_tip}`
    ].join('\n');

    pushWrappedRows(
      rows,
      `■ [${step.condition.value}] ${step.location}`,
      '$FontColorGoldYellow',
      '$MediumFontSize',
      '세팅 툴팁 보기',
      '$FontColorLightGold',
      '$SmallFontSize',
      tip
    );
    pushWrappedRows(
      rows,
      `▶ 파밍 루트: ${step.route}`,
      '$FontColorLightTeal',
      '$SmallFontSize',
      step.condition.value,
      '$FontColorGoldYellow',
      '$SmallFontSize'
    );
    for (let i = 0; i < step.tasks.length; i++) {
      pushWrappedRows(
        rows,
        `  [${i + 1}] ${step.tasks[i].text}`,
        '$FontColorWhite',
        '$SmallFontSize',
        '필수 세팅',
        '$FontColorGreen',
        '$SmallFontSize'
      );
    }
    pushWrappedRows(
      rows,
      `  ★ 팁: ${step.strategic_tip}`,
      '$FontColorLightBlue',
      '$SmallFontSize',
      '꿀팁',
      '$FontColorLightBlue',
      '$SmallFontSize'
    );
    rows.push(makeDividerRow());
  }

  const extraGuides = [
    {
      title: '[레벨링 효율 구간] 1~15 트리스트럼 / 15~24 탈 라샤 무덤 / 24 고대인 / 25~40 보통 바알',
      sub: '40~60 악몽 바알 / 60~75 지옥 바알 / 75+ 공포의 영역(TZ) & 파괴의 부적 파밍',
      badge: '경험치 효율'
    },
    {
      title: '[용병 삼신기] 2막 기도 용병 + 통찰(랄+티르+탈+솔) + 치료(샤엘+이오+탈) + 배신(샤엘+주울+렘)',
      sub: '기도 오라 + 통찰 명상 오라 + 치료 정화 오라 3중 중첩으로 생명력·마나 초당 고속 회복',
      badge: '용병 완성'
    },
    {
      title: '[패캐/패힛 프레임 핵심] 원소술사 패캐: 63%(9프레임) → 105%(8프레임) / 번개: 117%',
      sub: '성기사(해머/피스트) 패캐: 75%(10프레임) → 125%(9프레임) / 영혼(Spirit) 35% 패캐가 핵심',
      badge: '프레임 표'
    }
  ];

  for (const g of extraGuides) {
    pushWrappedRows(rows, g.title, '$FontColorGoldYellow', '$SmallFontSize', g.badge, '$FontColorOrange', '$SmallFontSize');
    pushWrappedRows(rows, `  · ${g.sub}`, '$FontColorWhite', '$SmallFontSize', '', '$FontColorWhite', '$SmallFontSize');
    rows.push(makeDividerRow());
  }

  return rows;
}

function generateRunewordRows(rwList, headerTitle) {
  const rows = [];
  pushWrappedRows(
    rows,
    `★ ${headerTitle} (총 ${rwList.length}종 - 우측 버튼 마우스 오버 시 전체 세부 옵션 표시)`,
    '$FontColorGreen',
    '$MediumFontSize',
    `총 ${rwList.length}종 수록`,
    '$FontColorGoldYellow'
  );
  rows.push(makeDividerRow());

  for (const rw of rwList) {
    const runeCombo = (rw.runes || []).join(' + ');
    const itemTypes = (rw.item_types || []).join(', ');
    const statsLines = (rw.stats || []).map((s) => `· ${s}`).join('\n');
    const tooltip = [
      `ÿc4${rw.name} (${rw.original_name})ÿc0`,
      `ÿc8룬 조합: ${runeCombo}ÿc0`,
      `ÿc2재료: ${itemTypes} (요구 레벨 ${rw.level})ÿc0`,
      '',
      `ÿc3[완성 옵션]ÿc0`,
      statsLines,
      rw.material_sources ? `\nÿc5${rw.material_sources}ÿc0` : ''
    ].join('\n');

    const topStats = (rw.stats || []).slice(0, 2).join(' / ');
    pushWrappedRows(
      rows,
      `■ ${rw.name} [${rw.original_name}] - 룬: ${runeCombo} (${itemTypes}, Lv.${rw.level})`,
      '$FontColorGoldYellow',
      '$MediumFontSize',
      '전체 옵션 툴팁',
      '$FontColorLightGold',
      '$SmallFontSize',
      tooltip
    );
    pushWrappedRows(
      rows,
      `  ▶ 핵심 옵션: ${topStats}`,
      '$FontColorLightBlue',
      '$SmallFontSize',
      `${rw.category || ''}`,
      '$FontColorLightGray',
      '$SmallFontSize'
    );
    rows.push(makeDividerRow());
  }
  return rows;
}

function generateCubeRows() {
  const rows = [];
  pushWrappedRows(
    rows,
    `★ 호라드림의 함(큐브) 필수 조합법 ${cubing.length}종 총정리 (홈 뚫기·업그레이드·룬 합성·크래프트·면죄)`,
    '$FontColorGreen',
    '$MediumFontSize',
    `총 ${cubing.length}종 레시피`,
    '$FontColorGoldYellow'
  );
  rows.push(makeDividerRow());

  for (const c of cubing) {
    const tooltip = [
      `ÿc8[${c.category}] ${c.name}ÿc0`,
      '',
      `ÿc2[조합 재료]ÿc0`,
      c.recipe,
      '',
      `ÿc4[변환 결과]ÿc0`,
      c.result,
      '',
      `ÿc0${c.description || ''}`
    ].join('\n');

    pushWrappedRows(
      rows,
      `■ [${c.category}] ${c.name} - 재료: ${c.recipe}`,
      '$FontColorGoldYellow',
      '$SmallFontSize',
      '상세 설명 툴팁',
      '$FontColorLightGold',
      '$SmallFontSize',
      tooltip
    );
    pushWrappedRows(
      rows,
      `  ▶ 결과: ${c.result} (${c.description || ''})`,
      '$FontColorWhite',
      '$SmallFontSize',
      c.category,
      '$FontColorLightTeal',
      '$SmallFontSize'
    );
    rows.push(makeDividerRow());
  }

  return rows;
}

// ============================================================================
// 2. 100% TRANSPARENT & ADJUSTABLE IN-GAME QUEST HUD (D2RHudTrackerPanel)
//    - NO HudFrameBG opaque black box! Text floats directly on the game screen
//      with crisp drop shadow so the player's character and map are never blocked.
//    - Includes adjustable text output window controls:
//      [▲ 창 접기] [소형 4줄] [중형 8줄] [대형 15줄] [반투명막]
// ============================================================================
function buildTrackerMainPanel() {
  return {
    type: 'SettingsPanel',
    name: 'D2RHudTrackerPanel',
    fields: {
      priority: 200,
      rect: { x: 18, y: 14, width: 920, height: 120 },
      anchor: { x: 0.0, y: 0.0 }
    },
    children: [
      {
        type: 'TextBoxWidget',
        name: 'HudTitle',
        fields: {
          rect: { x: 8, y: 6, width: 390, height: 36 },
          text: '★ D2R-HUD v1.3 성역 HUD',
          style: makeTextStyle('$FontColorGoldYellow', '$MediumFontSize', 'left', 'center', false)
        }
      },
      {
        type: 'ButtonWidget',
        name: 'FoldTrackerBtn',
        fields: {
          rect: { x: 430, y: 2, scale: 0.45 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '▲ 글자창 접기',
          onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudTrackFold',
          tooltipString: '글자 출력창을 접어 상단 탭바만 남깁니다.',
          textColor: '$FontColorLightYellow',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'OpenFullDictBtn',
        fields: {
          rect: { x: 630, y: 2, scale: 0.45 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '호라드림 사전',
          onClickMessage: 'PanelManager:TogglePanel:D2RHudMainPanel',
          tooltipString: '룬워드 98종, 큐빙 60종 투명 대사전(D2RHudMainPanel)을 켜거나 끕니다.',
          textColor: '$FontColorGoldYellow',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'CloseTrackerBtn',
        fields: {
          rect: { x: 855, y: 4, scale: 0.68 },
          filename: 'PANEL\\closebtn_4x',
          hoveredFrame: 3,
          onClickMessage: 'PanelManager:ClosePanel:D2RHudTrackerPanel',
          tooltipString: '성역 HUD 닫기 (하단 성역 HUD 버튼으로 언제든 다시 열기 가능)',
          sound: 'cursor_close_window_hd'
        }
      },
      {
        type: 'TabBarWidget',
        name: 'OptionsTabs',
        fields: {
          rect: { x: 6, y: 46, scale: 0.56, width: 1600, height: 96 },
          anchor: { x: 0.0, y: 0.0 },
          tabCount: 7,
          tabSize: { x: 224, y: 96 },
          tabPadding: { x: 2, y: 0 },
          unavailableTabsLeaveGaps: false,
          tabSizingMethod: 'fixedCenter',
          filename: 'Controller/Panel/Stash/V2/StashTabs',
          inactiveFrames: [1, 1, 1, 1, 1, 1, 1],
          activeFrames: [0, 0, 0, 0, 0, 0, 0],
          activeTextColor: '$TabsActiveTextColor',
          inactiveTextColor: '$TabsInactiveTextColor',
          tabTextOffset: { x: 0, y: -4 },
          textStyle: {
            options: { lineWrap: true },
            pointSize: '$SmallFontSize',
            alignment: { h: 'center', v: 'center' },
            fontColor: '$FontColorWhite',
            spacing: { leading: 0.9, kerning: 0.95 }
          },
          textStrings: [
            '1막 자매단',
            '2막 루트골레인',
            '3막 쿠라스트',
            '4막 혼돈성역',
            '5막 해로개스',
            '길찾기 공식',
            '초반 스타터'
          ],
          tabMessages: [
            'SettingsPanelMessage:CheckChanges:D2RHudTrackAct1',
            'SettingsPanelMessage:CheckChanges:D2RHudTrackAct2',
            'SettingsPanelMessage:CheckChanges:D2RHudTrackAct3',
            'SettingsPanelMessage:CheckChanges:D2RHudTrackAct4',
            'SettingsPanelMessage:CheckChanges:D2RHudTrackAct5',
            'SettingsPanelMessage:CheckChanges:D2RHudTrackMap',
            'SettingsPanelMessage:CheckChanges:D2RHudTrackStarter'
          ]
        }
      }
    ]
  };
}

function buildTrackerFoldSubPanel() {
  return {
    type: 'VideoOptionsPanel',
    name: 'D2RHudTrackFold',
    fields: {
      priority: 201,
      rect: { x: 24, y: 108, width: 880, height: 50 },
      anchor: { x: 0.0, y: 0.0 },
      applySettingsImmediately: false
    },
    children: [
      {
        type: 'TextBoxWidget',
        name: 'FoldStateText',
        fields: {
          rect: { x: 4, y: 6, width: 220, height: 32 },
          text: '▼ 출력창 접힘:',
          style: makeTextStyle('$FontColorLightYellow', '$SmallFontSize', 'left', 'center', false)
        }
      },
      {
        type: 'ButtonWidget',
        name: 'ExpandSmallBtn',
        fields: {
          rect: { x: 205, y: 2, scale: 0.42 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '▼ 소형 4줄',
          onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudTrackAct1S',
          textColor: '$FontColorLightTeal',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'ExpandMedBtn',
        fields: {
          rect: { x: 355, y: 2, scale: 0.42 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '▼ 중형 8줄',
          onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudTrackAct1',
          textColor: '$FontColorGreen',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      },
      {
        type: 'ButtonWidget',
        name: 'ExpandLargeBtn',
        fields: {
          rect: { x: 505, y: 2, scale: 0.42 },
          filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
          hoveredFrame: 3,
          textString: '▼ 대형 15줄',
          onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudTrackAct1L',
          textColor: '$FontColorGoldYellow',
          'text/style': '$StyleFEButtonText',
          sound: 'select'
        }
      }
    ]
  };
}

/**
 * Generates an adjustable transparent text output window sub-panel for a given tracker tab:
 *   suffix === 'S' : Small 4-line window (height 168px, 100% transparent)
 *   suffix === ''  : Medium 8-line window (height 320px, 100% transparent)
 *   suffix === 'L' : Large 15-line window (height 580px, 100% transparent)
 *   suffix === 'B' : Subtle 28% dim tint 8-line window (height 320px, optional tint)
 */
function buildTrackerSubPanel(tabKey, suffix, lines) {
  const panelName = `D2RHudTrack${tabKey}${suffix}`;
  const heightPx = suffix === 'S' ? 168 : suffix === 'L' ? 580 : 320;
  const showSubtleTint = suffix === 'B';
  const modeDesc =
    suffix === 'S'
      ? '소형4줄'
      : suffix === 'L'
      ? '대형15줄'
      : suffix === 'B'
      ? '반투명8줄'
      : '중형8줄';

  const expandedRows = [];
  for (const item of lines) {
    const maxLen = item.size === '$MediumFontSize' ? 40 : 45;
    const chunks = splitIntoSingleLines(item.text, maxLen, '    ');
    for (const ch of chunks) {
      expandedRows.push({
        text: ch,
        color: item.color || '$FontColorWhite',
        size: item.size || '$SmallFontSize'
      });
    }
  }

  const tableRows = expandedRows.map((item, idx) => ({
    type: 'TableRowWidget',
    name: `TrackRow_${idx}`,
    children: [
      {
        type: 'TextBoxWidget',
        name: `TrackText_${idx}`,
        fields: {
          fitToText: true,
          text: item.text,
          style: makeTextStyle(item.color, item.size, 'left', 'center', false)
        }
      }
    ]
  }));

  const children = [];

  if (showSubtleTint) {
    children.push({
      type: 'RectangleWidget',
      name: 'SubtleTintBG',
      fields: {
        rect: { x: 0, y: 40, width: 860, height: heightPx },
        color: [0.0, 0.0, 0.0, 0.28]
      }
    });
  }

  // Interactive Text Output Window Adjustment Bar
  children.push(
    {
      type: 'TextBoxWidget',
      name: 'WindowSizeLabel',
      fields: {
        rect: { x: 4, y: 4, width: 115, height: 32 },
        text: `▶ ${modeDesc}`,
        style: makeTextStyle('$FontColorLightYellow', '$SmallFontSize', 'left', 'center', false)
      }
    },
    {
      type: 'ButtonWidget',
      name: 'SizeFoldBtn',
      fields: {
        rect: { x: 135, y: 0, scale: 0.39 },
        filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
        hoveredFrame: 3,
        textString: '▲ 접기',
        onClickMessage: 'SettingsPanelMessage:CheckChanges:D2RHudTrackFold',
        tooltipString: '글자 출력창 접기',
        textColor: '$FontColorLightYellow',
        'text/style': '$StyleFEButtonText',
        sound: 'select'
      }
    },
    {
      type: 'ButtonWidget',
      name: 'SizeSmallBtn',
      fields: {
        rect: { x: 280, y: 0, scale: 0.39 },
        filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
        hoveredFrame: 3,
        textString: '소형 4줄',
        onClickMessage: `SettingsPanelMessage:CheckChanges:D2RHudTrack${tabKey}S`,
        tooltipString: '글자 출력창을 소형(4줄, 완전투명)으로 줄입니다.',
        textColor: suffix === 'S' ? '$FontColorGoldYellow' : '$FontColorLightTeal',
        'text/style': '$StyleFEButtonText',
        sound: 'select'
      }
    },
    {
      type: 'ButtonWidget',
      name: 'SizeMedBtn',
      fields: {
        rect: { x: 425, y: 0, scale: 0.39 },
        filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
        hoveredFrame: 3,
        textString: '중형 8줄',
        onClickMessage: `SettingsPanelMessage:CheckChanges:D2RHudTrack${tabKey}`,
        tooltipString: '글자 출력창을 기본 중형(8줄, 완전투명)으로 조절합니다.',
        textColor: suffix === '' ? '$FontColorGoldYellow' : '$FontColorGreen',
        'text/style': '$StyleFEButtonText',
        sound: 'select'
      }
    },
    {
      type: 'ButtonWidget',
      name: 'SizeLargeBtn',
      fields: {
        rect: { x: 570, y: 0, scale: 0.39 },
        filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
        hoveredFrame: 3,
        textString: '대형 15줄',
        onClickMessage: `SettingsPanelMessage:CheckChanges:D2RHudTrack${tabKey}L`,
        tooltipString: '글자 출력창을 대형(15줄, 완전투명)으로 넓힙니다.',
        textColor: suffix === 'L' ? '$FontColorGoldYellow' : '$FontColorWhite',
        'text/style': '$StyleFEButtonText',
        sound: 'select'
      }
    },
    {
      type: 'ButtonWidget',
      name: 'SizeTintToggleBtn',
      fields: {
        rect: { x: 715, y: 0, scale: 0.39 },
        filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
        hoveredFrame: 3,
        textString: showSubtleTint ? '완전투명' : '반투명막',
        onClickMessage: showSubtleTint
          ? `SettingsPanelMessage:CheckChanges:D2RHudTrack${tabKey}`
          : `SettingsPanelMessage:CheckChanges:D2RHudTrack${tabKey}B`,
        tooltipString: '배경 완전투명 / 28% 옅은 반투명막 전환',
        textColor: showSubtleTint ? '$FontColorGoldYellow' : '$FontColorLightGray',
        'text/style': '$StyleFEButtonText',
        sound: 'select'
      }
    },
    {
      type: 'ImageWidget',
      name: 'ScrollBarBackground',
      fields: {
        rect: { x: -14, y: 40, width: 22, height: heightPx },
        anchor: { x: 1.0 },
        filename: 'FrontEnd\\HD\\Final\\FrontEnd_ScrollbarSmall'
      },
      children: [
        {
          type: 'ScrollControllerWidget',
          name: 'ScrollController',
          fields: {
            rect: { x: -22, y: 20, width: 22, height: heightPx - 40 },
            anchor: { x: 1.0 },
            upArrowFilepath: 'FrontEnd\\HD\\Final\\FrontEnd_ScrollUpBtn',
            downArrowFilepath: 'FrontEnd\\HD\\Final\\FrontEnd_ScrollDownBtn',
            barFilepath: 'FrontEnd\\HD\\Final\\FrontEnd_ScrollIndicator',
            viewName: 'ScrollView',
            wheelScrollSound: 'cursor_scroll_hd',
            buttonScrollSound: 'cursor_scroll_hd'
          }
        }
      ]
    },
    {
      type: 'ScrollViewWidget',
      name: 'ScrollView',
      fields: {
        rect: { x: 4, y: 40, width: 830, height: heightPx },
        scrollControllerName: 'ScrollController',
        clipChildrenDraw: true
      },
      children: [
        {
          type: 'TableWidget',
          name: 'OptionsTable',
          fields: {
            columns: [{ width: 815, alignment: { h: 'fit', v: 'fit' } }],
            rowHeight: 38
          },
          children: tableRows
        }
      ]
    }
  );

  return {
    type: 'VideoOptionsPanel',
    name: panelName,
    fields: {
      priority: 201,
      rect: { x: 24, y: 108, width: 868, height: heightPx + 46 },
      anchor: { x: 0.0, y: 0.0 },
      applySettingsImmediately: false
    },
    children
  };
}

function stepsToTrackerLines(stepsSubset) {
  const lines = [];
  for (const s of stepsSubset) {
    lines.push({
      text: `■ [${s.condition.value}] ${sanitizeD2RText(s.location)}`,
      color: '$FontColorGoldYellow',
      size: '$MediumFontSize'
    });
    lines.push({
      text: `  ▶ 동선: ${sanitizeD2RText(s.route)}`,
      color: '$FontColorLightTeal',
      size: '$SmallFontSize'
    });
    for (let i = 0; i < s.tasks.length; i++) {
      const t = s.tasks[i];
      const isReward = t.text.includes('[필수') || t.text.includes('[보상');
      lines.push({
        text: `  [${i + 1}] ${sanitizeD2RText(t.text)}`,
        color: isReward ? '$FontColorLightYellow' : '$FontColorWhite',
        size: '$SmallFontSize'
      });
    }
    lines.push({
      text: `  ★ 길찾기: ${sanitizeD2RText(s.note)}`,
      color: '$FontColorLightBlue',
      size: '$SmallFontSize'
    });
    lines.push({
      text: `  ★ 공략팁: ${sanitizeD2RText(s.strategic_tip)}`,
      color: '$FontColorGreen',
      size: '$SmallFontSize'
    });
  }
  return lines;
}

// ============================================================================
// 3. PATCH EXISTING LAYOUT ENTRY POINTS (Preserving all Yupgoolg widgets)
// ============================================================================
function buildPatchedEntryLayouts() {
  // 3.1 hudpanelhd.json — Add [성역 HUD] & [룬·큐빙 사전] Toggle buttons next to miniHealthBar
  const hudPanel = readD2RJson(path.join(YUPGOOLG_MERGED, 'data\\global\\ui\\layouts\\hudpanelhd.json'));
  hudPanel.children = hudPanel.children.filter(
    (c) => c.name !== 'D2RHudTrackerToggleBtn' && c.name !== 'D2RHudDictToggleBtn'
  );
  hudPanel.children.push(
    {
      type: 'ButtonWidget',
      name: 'D2RHudTrackerToggleBtn',
      fields: {
        rect: { x: 85, y: -55, scale: 0.67 },
        filename: 'PANEL/infobutton',
        hoveredFrame: 3,
        textString: '성역 HUD',
        pressLabelOffset: [0, 0],
        onClickMessage: 'PanelManager:TogglePanel:D2RHudTrackerPanel',
        tooltipString: 'D2R-HUD v1.3 투명 성역 퀘스트·길찾기 내비게이터 켜기/끄기 (출력창 크기 조절 지원)',
        textColor: '$FontColorGoldYellow',
        'text/style': '$StyleFEButtonText',
        acceptsReturnKey: true,
        focusOnMouseOver: false,
        sound: 'select'
      }
    },
    {
      type: 'ButtonWidget',
      name: 'D2RHudDictToggleBtn',
      fields: {
        rect: { x: 85, y: -128, scale: 0.67 },
        filename: 'PANEL/infobutton',
        hoveredFrame: 3,
        textString: '룬·큐빙 사전',
        pressLabelOffset: [0, 0],
        onClickMessage: 'PanelManager:TogglePanel:D2RHudMainPanel',
        tooltipString: 'D2R-HUD v1.3 투명 호라드림 대사전 (룬워드 98종·큐빙 60종) 켜기/끄기',
        textColor: '$FontColorLightGold',
        'text/style': '$StyleFEButtonText',
        acceptsReturnKey: true,
        focusOnMouseOver: false,
        sound: 'select'
      }
    }
  );

  // 3.2 mainmenubuttonribbonhd.json — Add [성역 HUD v1.3] button on Character Select left ribbon
  const mainRibbon = readD2RJson(path.join(YUPGOOLG_MERGED, 'data\\global\\ui\\layouts\\mainmenubuttonribbonhd.json'));
  const ribbonImg = mainRibbon.children.find((c) => c.name === 'Ribbon');
  if (ribbonImg && Array.isArray(ribbonImg.children)) {
    ribbonImg.children = ribbonImg.children.filter((c) => c.name !== 'D2RHudMainMenuBtn');
    ribbonImg.children.push({
      type: 'ButtonWidget',
      name: 'D2RHudMainMenuBtn',
      fields: {
        rect: { x: 165, y: 680 },
        filename: 'FrontEnd\\HD\\Final\\FrontEnd_ButtonMed',
        textString: '성역 HUD v1.3',
        onClickMessage: 'PanelManager:TogglePanel:D2RHudMainPanel',
        tooltipString: 'D2R-HUD v1.3 투명 성역 내비게이터 & 호라드림 사전 열기',
        textColor: '$FontColorGoldYellow',
        'text/style': '$StyleFEButtonText',
        hoveredFrame: 3,
        disabledFrame: 2
      }
    });
  }

  // 3.3 pauselayouthd.json — Add [성역 HUD · 호라드림 사전] row to ESC Pause Menu
  const pauseLayout = readD2RJson(path.join(YUPGOOLG_MERGED, 'data\\global\\ui\\layouts\\pauselayouthd.json'));
  const pauseTable = pauseLayout.children.find((c) => c.name === 'PauseTable');
  if (pauseTable && Array.isArray(pauseTable.children)) {
    pauseTable.children = pauseTable.children.filter((c) => c.name !== 'Row D2RHudMenu');
    pauseTable.children.splice(1, 0, {
      type: 'TableRowWidget',
      name: 'Row D2RHudMenu',
      children: [
        {
          type: 'ButtonWidget',
          name: 'D2RHudPauseBtn',
          fields: {
            filename: 'PauseMenu\\PauseButton',
            hoveredFrame: 3,
            textString: '성역 HUD 사전',
            onClickMessage: 'PanelManager:TogglePanel:D2RHudMainPanel',
            textColor: '$FontColorGoldYellow',
            'text/style': '$StyleFEButtonText',
            acceptsReturnKey: true,
            focusOnMouseOver: true,
            sound: 'select'
          }
        }
      ]
    });
  }

  // 3.4 playerinventoryexpansionlayouthd.json — Add [성역 HUD] button at top center of Inventory (I)
  const invLayout = readD2RJson(
    path.join(YUPGOOLG_MERGED, 'data\\global\\ui\\layouts\\playerinventoryexpansionlayouthd.json')
  );
  invLayout.children = invLayout.children.filter((c) => c.name !== 'D2RHudInvBtn');
  invLayout.children.push({
    type: 'ButtonWidget',
    name: 'D2RHudInvBtn',
    fields: {
      rect: { x: 472, y: 52, scale: 0.67 },
      filename: 'PANEL/infobutton',
      hoveredFrame: 3,
      textString: '성역 HUD v1.3',
      pressLabelOffset: [0, 0],
      onClickMessage: 'PanelManager:TogglePanel:D2RHudMainPanel',
      tooltipString: 'D2R-HUD v1.3 투명 성역 퀘스트 동선·길찾기·룬워드 98종·큐빙 60종 사전 켜기/끄기',
      textColor: '$FontColorGoldYellow',
      'text/style': '$StyleFEButtonText',
      acceptsReturnKey: true,
      focusOnMouseOver: false,
      sound: 'select'
    }
  });

  // 3.5 horadriccubelayouthd.json — Add [큐빙 사전] button on Horadric Cube panel
  const cubeLayout = readD2RJson(path.join(YUPGOOLG_MERGED, 'data\\global\\ui\\layouts\\horadriccubelayouthd.json'));
  cubeLayout.children = cubeLayout.children.filter((c) => c.name !== 'D2RHudCubeDictBtn');
  cubeLayout.children.push({
    type: 'ButtonWidget',
    name: 'D2RHudCubeDictBtn',
    fields: {
      rect: { x: -330, y: 808, scale: 0.62 },
      filename: 'PANEL/infobutton',
      hoveredFrame: 3,
      textString: '큐빙·룬 사전',
      onClickMessage: 'PanelManager:TogglePanel:D2RHudMainPanel',
      tooltipString: '호라드림 큐빙 60종 조합법 및 룬워드 98종 투명 대사전 켜기/끄기',
      textColor: '$FontColorGoldYellow',
      'text/style': '$StyleFEButtonText',
      sound: 'select'
    }
  });

  return {
    'hudpanelhd.json': hudPanel,
    'mainmenubuttonribbonhd.json': mainRibbon,
    'pauselayouthd.json': pauseLayout,
    'playerinventoryexpansionlayouthd.json': invLayout,
    'horadriccubelayouthd.json': cubeLayout
  };
}

// ============================================================================
// MAIN GENERATION PIPELINE
// ============================================================================
function main() {
  const generatedLayouts = {};

  // 1. Transparent & Adjustable Main Encyclopedia + Fold + 7 Tabs x 3 Sizes (S/Default/L)
  generatedLayouts['D2RHudMainPanelhd.json'] = buildMainPanel();
  generatedLayouts['D2RHudMainFoldhd.json'] = buildMainFoldSubPanel();

  const act1to3Steps = questTimeline.steps.filter((s) =>
    ['Act 1-1', 'Act 1-2', 'Act 2-1', 'Act 2-2', 'Act 3-1', 'Act 3-2'].includes(s.condition.value)
  );
  const act4to5Steps = questTimeline.steps.filter((s) =>
    ['Act 4', 'Act 5-1', 'Act 5-2'].includes(s.condition.value)
  );

  const rw23 = runewords.filter((r) => r.category && (r.category.includes('2홈') || r.category.includes('3홈')));
  const rw4 = runewords.filter((r) => r.category && r.category.includes('4홈'));
  const rw56 = runewords.filter((r) => !rw23.includes(r) && !rw4.includes(r));

  const mainTabs = [
    { key: 'Camp1', rows: generateCampaignRows(act1to3Steps, false) },
    { key: 'Camp2', rows: generateCampaignRows(act4to5Steps, true) },
    { key: 'Starter', rows: generateStarterRows() },
    { key: 'Rw23', rows: generateRunewordRows(rw23, '2홈 ~ 3홈 핵심 룬워드 사전') },
    { key: 'Rw4', rows: generateRunewordRows(rw4, '4홈 핵심 룬워드 사전 (영혼·통찰·무공·오심·인내·불사조 등)') },
    { key: 'Rw56', rows: generateRunewordRows(rw56, '5홈 ~ 6홈 & 신규(악마술사/2.4~2.6) 룬워드 사전') },
    { key: 'Cube', rows: generateCubeRows() }
  ];

  for (const t of mainTabs) {
    generatedLayouts[`D2RHud${t.key}SPanelhd.json`] = buildEncyclopediaSubPanel(t.key, 'S', t.rows, 360, 56);
    generatedLayouts[`D2RHud${t.key}Panelhd.json`] = buildEncyclopediaSubPanel(t.key, '', t.rows, 640, 56);
    generatedLayouts[`D2RHud${t.key}LPanelhd.json`] = buildEncyclopediaSubPanel(t.key, 'L', t.rows, 1020, 56);
  }

  // 2. 100% Transparent & Adjustable In-Game Quest HUD Bar + Fold + 7 Tabs x 4 Modes (S/Default/L/B)
  generatedLayouts['D2RHudTrackerPanelhd.json'] = buildTrackerMainPanel();
  generatedLayouts['D2RHudTrackFoldhd.json'] = buildTrackerFoldSubPanel();

  const mapTrackerLines = [
    {
      text: '■ 성역 주요 던전 길찾기 방향 공식 12선 (입구 타일 시선 기준)',
      color: '$FontColorGoldYellow',
      size: '$MediumFontSize'
    },
    ...MAP_CHEATSHEET.flatMap((m) => [
      {
        text: `· [${m.act}] ${m.zone} → ${m.rule}`,
        color: '$FontColorLightYellow',
        size: '$SmallFontSize'
      },
      {
        text: `   → ${m.detail}`,
        color: '$FontColorLightBlue',
        size: '$SmallFontSize'
      }
    ])
  ];

  const trackerTabs = [
    { key: 'Act1', lines: stepsToTrackerLines(questTimeline.steps.filter((s) => s.condition.value.startsWith('Act 1'))) },
    { key: 'Act2', lines: stepsToTrackerLines(questTimeline.steps.filter((s) => s.condition.value.startsWith('Act 2'))) },
    { key: 'Act3', lines: stepsToTrackerLines(questTimeline.steps.filter((s) => s.condition.value.startsWith('Act 3'))) },
    { key: 'Act4', lines: stepsToTrackerLines(questTimeline.steps.filter((s) => s.condition.value.startsWith('Act 4'))) },
    { key: 'Act5', lines: stepsToTrackerLines(questTimeline.steps.filter((s) => s.condition.value.startsWith('Act 5'))) },
    { key: 'Map', lines: mapTrackerLines },
    { key: 'Starter', lines: stepsToTrackerLines(warlockGuide.steps) }
  ];

  for (const t of trackerTabs) {
    for (const suffix of ['', 'S', 'L', 'B']) {
      generatedLayouts[`D2RHudTrack${t.key}${suffix}hd.json`] = buildTrackerSubPanel(t.key, suffix, t.lines);
    }
  }

  // 3. Patched Entry Layouts
  const patchedEntries = buildPatchedEntryLayouts();
  Object.assign(generatedLayouts, patchedEntries);

  const outStandaloneLayouts = path.join(OUT_MOD_DIR, 'data', 'global', 'ui', 'layouts');
  const outYupgoolgLayouts = path.join(OUT_YUPGOOLG_OVERLAY, 'data', 'global', 'ui', 'layouts');
  const outSeonheeLayouts = path.join(SEONHEE_MOD, 'data', 'global', 'ui', 'layouts');

  ensureDir(outStandaloneLayouts);
  ensureDir(outYupgoolgLayouts);

  const profileHd = readD2RJson(path.join(YUPGOOLG_MERGED, 'data\\global\\ui\\layouts\\_profilehd.json'));
  writeJson(path.join(outStandaloneLayouts, '_profilehd.json'), profileHd);
  writeJson(path.join(OUT_MOD_DIR, '..', 'd2rhud.json'), {
    name: 'd2rhud',
    savepath: 'd2rhud/'
  });

  const writtenFiles = [];
  for (const [fileName, jsonObj] of Object.entries(generatedLayouts)) {
    const p1 = path.join(outStandaloneLayouts, fileName);
    const p2 = path.join(outYupgoolgLayouts, fileName);
    writeJson(p1, jsonObj);
    writeJson(p2, jsonObj);
    if (fs.existsSync(outSeonheeLayouts)) {
      writeJson(path.join(outSeonheeLayouts, fileName), jsonObj);
    }
    writtenFiles.push({
      fileName,
      mpqPath: `data\\global\\ui\\layouts\\${fileName}`,
      bytes: fs.statSync(p1).size
    });
  }

  console.log(`Generated ${writtenFiles.length} native D2R Resurrected UI layout JSON files:`);
  for (const f of writtenFiles) {
    console.log(`  - ${f.mpqPath} (${f.bytes.toLocaleString()} bytes)`);
  }
}

main();
