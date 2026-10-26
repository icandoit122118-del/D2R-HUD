# DESIGN.md — D2R-HUD v1.3 (Diablo II: Resurrected Self-Contained Edition)

## 1. Visual Direction & Hallmark Picks (D1)

**Hallmark · v2.0.0 (`scope: app`)**

- **Screen** · Diablo II: Resurrected In-Game Transparent Overlay HUD (Quest Navigator · Runeword & Horadric Cube Tome · Guide Editor · Settings & Pixel Auto-Hide Calibrator) · states: loading, empty, error, populated
- **Theme** · Horadric Sanctuary (Custom D2R HD UI system derived directly from `data/global/ui/layouts/_profilehd.json`)
- **Rendering Target** · Windows Electron 30 Frameless Transparent Always-On-Top Overlay (`nodeIntegration: true`, click-through via `setIgnoreMouseEvents`) + React 19 / Vite Local Bundle (`web/dist/index.html`)
- **Signature** · Floating Horadric Tome HUD with real D2R HD 98×98 rune sprites (`SPa1` extracted PNGs), interactive Rune Stash craftability filter, socket-tabbed Runeword lexicon, and 1-click quest checklist

## 2. Authentic D2R `_profilehd.json` Token System

All colors and typography are declared as CSS custom properties in `:root` (`web/src/tokens.css`). No literal hex or `font-family` appears outside the token block.

| Token | Value | D2R `_profilehd.json` Source / Role |
| :--- | :--- | :--- |
| `--color-void` | `transparent` | Click-through transparent Electron canvas |
| `--color-obsidian` | `rgba(10, 9, 8, 0.96)` | Primary HUD tome surface |
| `--color-stone` | `#14110e` | Secondary panel & sidebar ground |
| `--color-stone-raised` | `#1e1914` | Card, slot, and input surface |
| `--color-stone-hover` | `#29221b` | Interactive hover surface |
| `--color-gold-light` | `#fff6e3` | `FontColorLightGold` (255, 246, 227) — Primary headings & active text |
| `--color-gold` | `#c7b377` | `FontColorGoldYellow` (199, 179, 119) — Unique / Runeword title & ornate frame |
| `--color-gold-currency` | `#d1c378` | `FontColorCurrencyGold` (209, 195, 120) — Level & socket badges |
| `--color-gold-dark` | `#78622f` | `FontColorDarkGold` (120, 98, 47) — Beveled metallic borders & dividers |
| `--color-gold-dim` | `rgba(199, 179, 119, 0.22)` | Hairline inner ring & subtle rules |
| `--color-beige` | `#ccc3b0` | `FontColorBeige` (204, 195, 176) — Primary body copy |
| `--color-muted` | `#949494` | `FontColorLightGray` (148, 148, 148) — Secondary descriptions & notes |
| `--color-slate-gold` | `#ada894` | `FontColorDarkGrayGold` (173, 168, 148) — Attribute labels |
| `--color-crimson` | `#fc4646` | `FontColorRed` (252, 70, 70) — Blood accent, destructive action, active seal |
| `--color-crimson-deep` | `rgba(140, 24, 24, 0.35)` | Crimson button & alert surface |
| `--color-rune-orange` | `#ffa800` | `FontColorOrange` (255, 168, 0) — Crafted item & rune formula highlight |
| `--color-magic-blue` | `#afb7ff` | `FontColorLightBlue` (175, 183, 255) — Magic property & strategic tip |
| `--color-set-green` | `#4fc238` | `FontColorPartyGreen` (79, 194, 56) — Completed quest task & craft result |
| `--color-focus` | `#c7b377` | Instant `:focus-visible` outline (`2px solid var(--color-focus)`) |
| `--font-display` | `'Cinzel', 'Noto Serif KR', Georgia, serif` | D2R Exocet-inspired serif display for panel titles & Runeword names |
| `--font-sans` | `'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif` | High-legibility Korean UI body face |
| `--font-mono` | `'JetBrains Mono', 'Consolas', monospace` | Hotkeys, pixel coordinates, and tabular numeric counters |

## 3. Motion, Accessibility & Edge-Case Rules

- **Frequency discipline (`emil-design-eng` / `animate`)**: Keyboard shortcuts (`Ctrl+Q`, `Ctrl+F8`~`F12`, `Ctrl+Left/Right`) and tab switches trigger **instant** state transitions (`0ms`) because players invoke them decenas of times per session.
- **GPU-only properties (`animation-performance`)**: Only `transform` and `opacity` are animated (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `140ms`–`180ms`). Never `transition: all`, and never animate `width`, `height`, `top`, or `left`.
- **Accessibility & Reduced Motion (`hallmark` Floor)**:
  - Every button, input, select, and task item provides an instant `:focus-visible` ring (`outline: 2px solid var(--color-focus); outline-offset: 2px`).
  - `@media (prefers-reduced-motion: reduce)` disables all transform transitions while preserving opacity/color state indicators.
  - `@media (hover: hover) and (pointer: fine)` gates hover-only surface shifts.

## 4. Design-Motion Stack Results Table (`design-motion.md`)

| 단계 | 스킬 | 결과 (적용 / 해당 없음: 이유) | 적용한 것 | 충돌 기록 |
| :--- | :--- | :--- | :--- | :--- |
| **D0** | 참고 자료 (Stitch, keyframe.gallery, React Bits, Open Design) | 적용 (로컬 추출 D2R 에셋 활용) | 로컬 추출된 D2R 모드 파일(`_profilehd.json`, `RunewordSubAPanelhd.json`~`F`, `bnet.json`, 33개 98×98 `.sprite` 룬 원본)을 직접 레퍼런스 및 내장 에셋으로 사용 | 없음 |
| **D1** | `hallmark` + `hallmark-apps` | 적용 | App screens 범위(`--scope app`) 채택. `:root` 토큰 단일화(`tokens.css`), `transition: all` 금지, `:focus-visible` 즉시 표시, `prefers-reduced-motion` 폴백, 추적 대문자(tracked-caps eyebrow) 제거, 이모지 아이콘을 커스텀 SVG 및 실제 룬 PNG로 대체 | 없음 |
| **D2** | `ui-ux-pro-max` | 적용 | `search.py`로 게이밍 HUD 디자인 시스템·포커스 가시성(`focus visible keyboard modal`)·React 19 상태 배칭 검증. 모달/패널 내 모든 컨트롤 포커스 링 및 4.5:1 이상 명도 대비(`#fff6e3`/`#ccc3b0` on `#0a0908`) 적용 | `ui-ux-pro-max` 기본 네온 퍼플(`#7C3AED`) 팔레트 대신 사용자 요청("UI도 레저렉션으로") 및 D1 D2R `_profilehd.json` 골드·옵시디언·크림슨 팔레트 채택 |
| **D2** | `frontend-design` | 적용 | AI 템플릿 티(슬레이트/인디고 기본값, `WORD — fragment`, 불필요한 영문 대문자 캡션) 전면 제거. 디아블로 2 레저렉션 성역 고딕(Sanctuary Gothic) 금장 베벨 프레임과 호라드림 고서 위계 적용 | 없음 |
| **D2** | `design-taste-frontend` | 적용 | `draw.mjs --app --kind builder --keep palette,type` 실행으로 앱 시트 밀도·패널 간격·컴팩트 컨트롤 규격 채택 | `draw.mjs` 기본 라이트 시트(`#f9fbfc`)는 인게임 투명 다크 오버레이 특성 및 사용자 D2R 테마 지정과 충돌하므로 D1 다크 옵시디언(`#0a0908`) 채택 |
| **D3** | `emil-design-eng` | 적용 | 고빈도 단축키(`Ctrl+Q`, `Ctrl+Left/Right`, 탭 전환) 애니메이션 0ms 즉시 응답, 버튼 `:active` 시 `transform: scale(0.97)` 피드백 적용 | 없음 |
| **D3** | `animate` | 적용 | 토스트 및 패널 진입에만 `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`(`160ms`, `scale(0.97)` + `opacity`) 적용 | 없음 |
| **D3** | `animation-performance` | 적용 | 드래그·리사이즈 중 불필요한 레이아웃 트랜지션 배제, 합성 속성(`transform`, `opacity`)만 트랜지션 허용, `tabular-nums`로 단계·레벨 숫자 흔들림 방지 | 없음 |
| **D3** | `apple-design` | 적용 | 패널 드래그·리사이즈 시 그랩 오프셋(grab offset) 1:1 직접 조작 추적 및 포인터 다운 즉시 반응 적용 | 없음 |
| **D3** | `break-ui` | 적용 | 긴 룬워드 옵션(8줄 이상), 긴 지역명/퀘스트 노트, 검색 결과 0건(빈 상태), 파일 로드 실패(오류 상태), 좁은 HUD 폭(250px)에서도 레이아웃 깨짐 방지(`min-width: 0`, `overflow-wrap: anywhere`, `flex-shrink: 0`) | 없음 |
| **D3** | `mobile-native` | 적용 (가능 범위) | `@media (hover: hover) and (pointer: fine)` 호버 게이팅 및 버튼 `user-select: none` 적용 (Windows 데스크톱 전용 오버레이 앱이므로 모바일 노치/사파리 항목은 제외) | 없음 |
| **D3** | `animate-expo` | 해당 없음: React Native/Expo 프로젝트 아님 | Windows Electron + React DOM 데스크톱 오버레이 앱 | 없음 |
| **D4** | `impeccable` | 적용 (문서 지침 모드) | `reference/craft-floor.md` 기준 커스텀 스크롤바, 텍스트 선택 영역(`::selection`), 포커스 링, 빈 상태 안내 문구, 한국어 직관적 버튼 레이블 다듬기 완료 | 없음 |
| **D4** | `review-animations` · `improve-animations` | 적용 | 기존 `App.tsx`의 `animate-pulse` 남발 및 `transition-all` 전수 제거, GPU 속성 명시로 교정 | 없음 |
| **D5** | `remotion-best-practices` · `hyperframes` · `media-use` | 해당 없음: 영상·모션 산출물 요구사항 없음 | 데스크톱 실시간 HUD 애플리케이션 구현 작업 | 없음 |
