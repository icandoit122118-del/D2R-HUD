# D2R-HUD v1.3.0 — 디아블로 II: 레저렉션 인게임 네이티브 UI 모드 (In-Game Native Mod)

`yobi7979/D2R-HUD` 릴리스를 역공학(Reverse Engineering)하여 외부 오버레이 프로그램 없이 **디아블로 II: 레저렉션(`D2R.exe`) 게임 클라이언트 자체 UI 엔진(`data/global/ui/layouts/*hd.json`)에서 직접 구동되는 인게임 모드**로 제작한 프로젝트입니다.

---

## 1. 주요 기능 (레저렉션 네이티브 HD UI)

1. **인게임 미니 성역 퀘스트·길찾기 내비게이터 (`D2RHudTrackerPanelhd.json` + 7개 서브 패널)**
   - 화면을 가리지 않는 좌측 상단 비차단형(Non-blocking, `priority: 200`, `NineTileImageWidget`) 레저렉션 툴팁 프레임으로 동작하며, **사냥·이동 중 실시간으로 탭을 전환**할 수 있습니다.
   - **수록 탭 (7개)**:
     - `1막 자매단` (`D2RHudTrackAct1hd.json`)
     - `2막 루트골레인` (`D2RHudTrackAct2hd.json`)
     - `3막 쿠라스트` (`D2RHudTrackAct3hd.json`)
     - `4막 혼돈성역` (`D2RHudTrackAct4hd.json`)
     - `5막 해로개스` (`D2RHudTrackAct5hd.json`)
     - `길찾기 공식` (`D2RHudTrackMaphd.json` — 잊힌 탑, 구더기 굴, 탈 라샤 무덤, 증오의 억류지 2층, 보트의 전당, 세계석 성채 2층 등 12개 핵심 던전 방향 공식)
     - `초반 스타터` (`D2RHudTrackStarterhd.json` — 레벨 1~75+ 구간별 룬워드·용병·상점작 로드맵)

2. **호라드림 대사전 (`D2RHudMainPanelhd.json` + 7개 서브 패널)**
   - 레저렉션 순정 HD 옵션 프레임(`\PANEL\Options\FrontEndOptionsBG` + `Controller/Panel/Stash/V2/StashTabs` + `ScrollViewWidget`)을 사용한 인게임 풀스크린 백과사전입니다.
   - **수록 탭 (7개)**:
     - `캠페인 1~3막` (`D2RHudCamp1Panelhd.json`) — 액트 1~3 필수 보상 퀘스트, 동선, 보스 공략 마우스오버 툴팁
     - `캠페인 4~5막·길찾기` (`D2RHudCamp2Panelhd.json`) — 액트 4~5 필수 퀘스트 & 던전 길찾기 공식 12선
     - `초반육성·스타터` (`D2RHudStarterPanelhd.json`) — 맨땅 스타터 빌드업, 용병 삼신기(기도+통찰+치료), 패캐/패힛 프레임 표
     - `룬워드 (2~3홈)` (`D2RHudRw23Panelhd.json`) — 잠행, 꽃봉오리, 전승, 제왕운시, 연기, 배신, 고대인의 서약, 치료, 방벽, 투지 등 2~3홈 룬워드 전체 옵션 & 툴팁
     - `룬워드 (4홈)` (`D2RHudRw4Panelhd.json`) — 영혼(스피릿), 통찰, 참나무의 심장(오심), 무한(무공), 인내, 불사조, 수수께끼/사슬 갑옷(명굴), 망명, 신념 등 4홈 룬워드 전체 옵션 & 툴팁
     - `룬워드 (5~6홈·신규)` (`D2RHudRw56Panelhd.json`) — 소집(콜투암스), 슬픔(고뇌), 마지막 소원, 죽음의 숨결, 집착, 꺼져가는 불길, 역병, 안개 및 악마술사 신규 룬워드 전체 수록
     - `호라드림 큐빙 60종` (`D2RHudCubePanelhd.json`) — 일반 장비 홈 뚫기, 룬/보석 업그레이드, 유니크/레어 등급 업그레이드, 크래프트(광패 아뮬/강타장), 파괴참/면죄/횃불 조합법 60종 완비

3. **인게임 5대 진입 버튼 (Entry Points)**
   - **하단 생명력 구체 위 HUD 버튼 (`hudpanelhd.json`)**: `[성역 HUD]` 버튼(미니 내비게이터 열기) 및 `[룬·큐빙 사전]` 버튼(호라드림 대사전 열기) 상시 노출
   - **캐릭터 선택창 좌측 메뉴 (`mainmenubuttonribbonhd.json`)**: `[성역 HUD v1.3]` 버튼
   - **ESC 일시정지 메뉴 (`pauselayouthd.json`)**: `[성역 HUD 사전]` 버튼
   - **인벤토리(`I`) 상단 (`playerinventoryexpansionlayouthd.json`)**: `[성역 HUD v1.3]` 버튼
   - **호라드림의 함(큐브) 상단 (`horadriccubelayouthd.json`)**: `[큐빙·룬 사전]` 버튼

---

## 2. 설치 및 실행 방법

### A. 기존 사용 중인 모드(`yupgoolg.mpq`)에 통합 설치 (자동 적용 완료)
```bash
node scripts/build-ingame-mod.cjs
python scripts/install-mpq.py
```
- `D:\Diablo II Resurrected\mods\yupgoolg\yupgoolg.mpq` 내부에 21개 레저렉션 UI 레이아웃 JSON 파일이 ZLIB 압축으로 주입되며, 원본 백업은 `yupgoolg.before-d2rhud.mpq`에 자동 보존됩니다.
- 실행 인자: `-mod yupgoolg -txt`

### B. 단독 모드(`d2rhud`)로 실행
- `mod/d2rhud/` 폴더를 `D:\Diablo II Resurrected\mods\d2rhud\`에 복사합니다.
- Battle.net 명령줄 인수 또는 바로가기에 `-mod d2rhud -txt`를 설정해 실행합니다.

---

## 3. 디렉터리 구조

- `scripts/build-ingame-mod.cjs`: 역공학 데이터(`quest_timeline.json`, `warlock_guide.json`, `runewords.json`, `cubing.json`)를 D2R 네이티브 UI 레이아웃 JSON(`*hd.json` 21종)으로 컴파일하는 생성기
- `scripts/install-mpq.py`: `StormLib.dll`을 통해 `yupgoolg.mpq` 아카이브 내부에 레이아웃 JSON을 주입하고 바이트 단위 무결성을 검증하는 스크립트
- `scripts/verify-ingame-runtime.py`: 실제 `D2R.exe -mod yupgoolg -txt` 프로세스를 구동하여 MPQ 핸들 마운트, 패널 그래프 연결성, `blz-log.txt` 파싱 에러 유무를 실측하는 검증 스크립트
- `mod/d2rhud/d2rhud.mpq/data/global/ui/layouts/`: 단독 실행 가능한 D2R 네이티브 인게임 모드 패키지
- `mod/yupgoolg-patch/data/global/ui/layouts/`: `yupgoolg.mpq` 통합용 레이아웃 패치 파일
- `mpq-install-receipt.json` / `ingame-verification-receipt.json`: MPQ 주입 및 `D2R.exe` 실측 검증 영수증
