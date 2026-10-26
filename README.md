# D2R-HUD v1.3.0 — Diablo II: Resurrected Self-Contained Sanctuary Overlay

> **Diablo II: Resurrected (디아블로 II: 레저렉션)** 인게임 플레이를 위한 **100% 자체 내장형(Self-Contained) 오프라인 오버레이 HUD**.

기존 `D2R-HUD (v1.1.3)`가 외부 웹 호스팅(`https://d2hud.pages.dev/`, 현재 `NXDOMAIN` 폐쇄)에 의존해 실행 시 빈 화면이 출력되던 구조적 결함을 리버스 엔지니어링(REA)하여, **모든 UI 번들·33종 레저렉션 HD 룬 스프라이트·98종 룬워드 사전·60종 호라드림의 함 큐빙 레시피·액트 1~5 캠페인 가이드를 `resources/app.asar` 내부에 완전 내장한 독립 실행형 v1.3.0 버전**입니다.

---

## 주요 변경 및 개선 사항 (v1.1.3 → v1.3.0)

1. **외부 서버 의존성 완전 제거 (Zero External Dependency)**
   - `index.js`의 `mainWindow.loadURL('https://d2hud.pages.dev/')` 호출을 제거하고 로컬 번들(`web/dist/index.html`)을 직접 로드합니다.
   - 인터넷 연결이 없거나 외부 서버가 종료되어도 영구적으로 즉시 동작합니다.
2. **디아블로 II: 레저렉션 정통 HD UI 디자인 시스템 (`tokens.css`, `index.css`)**
   - D2R 게임 클라이언트의 `data/hd/global/ui/layouts/_profilehd.json` 색상 토큰(`$FontColorGold`, `$FontColorLightGold`, `$FontColorUnique`, `$FontColorSet`, `$FontColorRune`, `$FontColorMagic`, `$FontColorRare`, `$FontColorCrafted`)을 그대로 추출하여 적용했습니다.
   - 흑요석(`#0B0A08`) 바탕과 이중 황동·성역 금빛 베벨 테두리(`#8A6D3B` / `#C7B377`), 한국어 `Noto Serif KR`·`Pretendard` 타이포그래피로 레저렉션 인게임 패널과 일체감을 제공합니다.
3. **실제 D2R HD 룬 아이콘 33종 & 아이템 그래픽 내장 (`scripts/extract-d2r-assets.cjs`)**
   - 디아블로 II: 레저렉션 HD `.sprite`(`SPa1` 98×98 RGBA) 원본에서 엘(El #1)~조드(Zod #33) 33종 룬과 보석·반지·목걸이·부적 이미지를 PNG로 디코딩해 내장했습니다.
4. **호라드림 비전 사전 (룬워드 98종 + 호라드림의 함 큐빙 60종)**
   - 레저렉션 2.4 / 2.6 신규 룬워드(꺼져가는 불길, 안개, 집착, 지혜, 역병, 투지, 치료, 방벽, 화로, 탈선, 모자이크, 변덕)를 포함한 **98종 전체 룬워드** 검색·홈 개수(2~6홈) 필터·**내 보관함 보유 룬 기반 제작 가능 여부 자동 계산**.
   - 룬 업그레이드, 장비 홈 뚫기, 매직/레어 업그레이드, 크래프트(주황) 제작, 보석/정수/파괴참 등 **60종 호라드림의 함 큐빙 조합법** 카테고리별 제공.
5. **멀티 모니터 전환 및 픽셀 자동 숨김 완벽 호환**
   - `v1.1.3`의 단일 모니터 창 이동 IPC(`move-to-monitor`)와 렌더러(`Ctrl+F8` 및 설정 모니터 드롭다운)를 완벽히 연동했습니다.
   - 인게임 특정 픽셀 좌표·색상을 감지해 메뉴/로딩 화면 진입 시 HUD를 자동으로 숨기고 복귀 시 다시 표시합니다.

---

## 단축키 안내

| 단축키 | 동작 |
| :--- | :--- |
| `Ctrl + Q` (변경 가능) | HUD 전체 표시 / 숨기기 토글 |
| `Ctrl + ←` / `Ctrl + →` | 퀘스트 가이드 이전 단계 / 다음 단계 이동 |
| `Ctrl + F8` | 멀티 모니터 간 HUD 즉시 전환 (`move-to-monitor` IPC) |
| `Ctrl + F9 ~ F12` | 현재 모니터 좌상단 / 우상단 / 좌하단 / 우하단 모서리 스냅 |
| `F12` | 개발자 도구 토글 |

---

## 프로젝트 구조

```text
D2R-HUD/
├── index.js                        # Electron 메인 프로세스 (v1.3.0 자체 내장 로더 + IPC + Self-Test)
├── package.json                    # 루트 빌드 및 검증 스크립트
├── DESIGN.md                       # 레저렉션 HD UI 디자인 토큰 및 설계 명세
├── scripts/
│   ├── extract-d2r-assets.cjs      # D2R .sprite(SPa1) -> PNG 디코더 및 룬워드/큐빙 DB 생성기
│   └── package-and-verify.cjs      # 자체 내장 app.asar 패키징 및 무인(Headless) 동작 검증기
└── web/
    ├── index.html                  # 렌더러 엔트리
    ├── public/data/portal-master/  # 33종 HD 룬 및 보석/장신구 아이콘 에셋
    └── src/
        ├── App.tsx                 # 레저렉션 성역 HUD & 호라드림 사전 & 가이드 에디터 & 환경설정
        ├── tokens.css              # D2R _profilehd.json 기반 디자인 토큰
        ├── index.css               # 레저렉션 프레임·버튼·슬롯 스타일
        ├── runewords.json          # 98종 룬워드 데이터베이스
        ├── cubing.json             # 60종 호라드림의 함 큐빙 데이터베이스
        ├── quest_timeline.json     # 액트 1~5 캠페인 최단 동선 가이드
        └── warlock_guide.json      # 초반 원소술사/캐스터 스타터 육성 가이드
```

---

## 빌드 및 무인 동작 검증 (Self-Test)

```bash
# 1. 웹 번들 빌드 (web/dist 생성)
npm run web:build

# 2. 자체 내장 app.asar 패키징 및 Electron 런타임 무인 검증 실행
npm run verify
```
