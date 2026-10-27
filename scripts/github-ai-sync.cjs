#!/usr/bin/env node
/**
 * 디아2-인게임-내비게이터 (D2R-HUD) — GitHub & AI Sync Utility
 *
 * 1. AI 친화적 컨텍스트 번들 자동 생성:
 *    - llms.txt          : 프로젝트 아키텍처 요약 + 모든 핵심 파일 Raw URL 매핑 (외부 AI가 URL 1개로 프로젝트 파악)
 *    - llms-full.txt     : 핵심 소스 코드 전체를 단일 텍스트로 병합한 번들 (ChatGPT/Claude/Gemini 등에 통째로 전달 가능)
 *    - ai-repo-index.json: 파일별 SHA256, 크기, 역할, GitHub Raw URL을 담은 머신 리더블 매니페스트
 *
 * 2. 내 GitHub 저장소 원클릭 저장/가져오기 CLI:
 *    - node scripts/github-ai-sync.cjs status        : 로컬·원격(GitHub API) 동기화 상태 및 최신 커밋 검증
 *    - node scripts/github-ai-sync.cjs bundle        : AI 컨텍스트 파일(llms.txt, llms-full.txt, ai-repo-index.json) 최신화
 *    - node scripts/github-ai-sync.cjs save [메시지] : AI 번들 자동 갱신 + git add/commit/push + 원격 반영 검증까지 원클릭 실행
 *    - node scripts/github-ai-sync.cjs pull          : 원격 GitHub 저장소 최신 변경사항 가져오기 (git pull --rebase)
 *    - node scripts/github-ai-sync.cjs repos         : 내 GitHub 계정(icandoit122118-del)의 모든 저장소 목록·URL 조회
 *    - node scripts/github-ai-sync.cjs fetch [파일]  : Git 없이도 GitHub Raw API에서 핵심 소스 또는 전체 AI 번들을 즉시 다운로드
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OWNER = 'icandoit122118-del';
const REPO = 'D2R-HUD';
const BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
const REPO_URL = `https://github.com/${OWNER}/${REPO}`;

// 핵심 소스 및 데이터 파일 목록 (AI가 프로젝트를 100% 이해하고 수정하기 위해 필요한 파일들)
const CORE_FILES = [
  {
    relPath: 'README.md',
    role: '프로젝트 개요, 인게임 캡처, 설치 및 실행 가이드',
    includeInFullBundle: true
  },
  {
    relPath: 'package.json',
    role: '패키지 메타데이터 및 NPM 실행 스크립트 정의',
    includeInFullBundle: true
  },
  {
    relPath: 'scripts/build-ingame-mod.cjs',
    role: '디아2 레저렉션 네이티브 HD UI 레이아웃 JSON 72종 컴파일러 (핵심 생성기)',
    includeInFullBundle: true
  },
  {
    relPath: 'scripts/install-mpq.py',
    role: 'StormLib.dll을 이용해 yupgoolg.mpq 내부에 UI 레이아웃 JSON을 직접 패킹·검증하는 설치 스크립트',
    includeInFullBundle: true
  },
  {
    relPath: 'scripts/verify-ingame-runtime.py',
    role: 'D2R.exe 프로세스 구동 및 MPQ 마운트·레이아웃 그래프 무결성 검증 스크립트',
    includeInFullBundle: true
  },
  {
    relPath: 'scripts/github-ai-sync.cjs',
    role: 'GitHub 원클릭 저장/가져오기 및 AI 컨텍스트 번들(llms.txt / llms-full.txt) 생성기',
    includeInFullBundle: true
  },
  {
    relPath: 'web/src/data/quest_timeline.json',
    role: '1막~5막 필수 퀘스트, 보상, 핵심 동선, 길찾기 팁 데이터',
    includeInFullBundle: false
  },
  {
    relPath: 'web/src/data/runewords.json',
    role: '룬워드 98종(2~6홈 및 신규 악마술사 룬워드 포함) 재료·요구레벨·완성 옵션 데이터',
    includeInFullBundle: false
  },
  {
    relPath: 'web/src/data/cubing.json',
    role: '호라드림의 함(큐브) 필수 조합법 60종 데이터',
    includeInFullBundle: false
  },
  {
    relPath: 'web/src/data/warlock_guide.json',
    role: '초반 맨땅 스타터 육성 가이드 데이터',
    includeInFullBundle: false
  }
];

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function getGitToken() {
  try {
    const res = spawnSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8'
    });
    if (res.stdout) {
      const m = res.stdout.match(/^password=(.+)$/m);
      if (m) return m[1].trim();
    }
  } catch (_) {}
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || null;
}

function httpsJson(url, method = 'GET', token = null, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = {
      'User-Agent': 'D2R-Ingame-Navigator-AI-Sync/1.4',
      Accept: 'application/vnd.github+json'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload = null;
    if (bodyObj) {
      payload = Buffer.from(JSON.stringify(bodyObj), 'utf8');
      headers['Content-Type'] = 'application/json; charset=utf-8';
      headers['Content-Length'] = payload.length;
    }

    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method,
        headers
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            resolve({ status: res.statusCode, data: JSON.parse(text) });
          } catch (_) {
            resolve({ status: res.statusCode, data: text });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function generateAiBundles() {
  const generatedLayoutsDir = path.join(ROOT, 'mod', 'yupgoolg-patch', 'data', 'global', 'ui', 'layouts');
  const layoutFiles = fs.existsSync(generatedLayoutsDir)
    ? fs.readdirSync(generatedLayoutsDir).filter((f) => f.endsWith('.json')).sort()
    : [];

  const coreEntries = [];
  for (const item of CORE_FILES) {
    const abs = path.join(ROOT, item.relPath);
    if (!fs.existsSync(abs)) continue;
    const stat = fs.statSync(abs);
    coreEntries.push({
      path: item.relPath,
      role: item.role,
      bytes: stat.size,
      sha256: sha256File(abs),
      rawUrl: `${RAW_BASE}/${item.relPath}`
    });
  }

  // 1. ai-repo-index.json
  const aiIndex = {
    project: '디아2-인게임-내비게이터 (D2R-HUD v1.4)',
    repository: REPO_URL,
    owner: OWNER,
    repo: REPO,
    branch: BRANCH,
    rawBaseUrl: RAW_BASE,
    aiEntryPoints: {
      llmsSummaryUrl: `${RAW_BASE}/llms.txt`,
      llmsFullSourceUrl: `${RAW_BASE}/llms-full.txt`,
      aiRepoIndexUrl: `${RAW_BASE}/ai-repo-index.json`
    },
    architecture: {
      generatorScript: 'scripts/build-ingame-mod.cjs',
      mpqInstallerScript: 'scripts/install-mpq.py',
      targetMpqPath: 'D:\\Diablo II Resurrected\\mods\\yupgoolg\\yupgoolg.mpq',
      generatedLayoutCount: layoutFiles.length
    },
    coreFiles: coreEntries,
    generatedLayouts: layoutFiles.map((f) => ({
      fileName: f,
      mpqInternalPath: `data\\global\\ui\\layouts\\${f}`,
      rawUrl: `${RAW_BASE}/mod/yupgoolg-patch/data/global/ui/layouts/${f}`
    }))
  };

  fs.writeFileSync(path.join(ROOT, 'ai-repo-index.json'), JSON.stringify(aiIndex, null, 2) + '\n', 'utf8');

  // 2. llms.txt (표준 LLM 진입점 파일)
  const llmsTxt = [
    '# 디아2-인게임-내비게이터 (D2R-HUD v1.4)',
    '',
    '> 외부 오버레이 없이 디아블로 II: 레저렉션(`D2R.exe`) 자체 UI 엔진(`data/global/ui/layouts/*hd.json`)에서 구동되는 순정 인게임 퀘스트·길찾기 내비게이터 & 호라드림 룬워드·큐빙 대사전 모드입니다.',
    '',
    '## AI 에이전트 빠른 접근 URL (Single-URL Fetch)',
    `- 전체 핵심 소스 통합 번들 (한 번에 읽기): ${RAW_BASE}/llms-full.txt`,
    `- 머신 리더블 JSON 인덱스 (SHA256·Raw URL 목록): ${RAW_BASE}/ai-repo-index.json`,
    `- GitHub 저장소 주소: ${REPO_URL}`,
    '',
    '## 핵심 소스 및 데이터 파일 (Raw URLs)',
    ...coreEntries.map((e) => `- [${e.path}](${e.rawUrl}) (${e.bytes.toLocaleString()} bytes): ${e.role}`),
    '',
    '## 빌드·MPQ 패킹·GitHub 동기화 명령어',
    '- UI 레이아웃 72종 빌드: `npm run mod:build` (`node scripts/build-ingame-mod.cjs`)',
    '- 실게임 MPQ 주입 및 검증: `npm run mod:install` (`python scripts/install-mpq.py`)',
    '- GitHub 원클릭 저장(번들 갱신 + 커밋 + 푸시): `npm run github:save` (`node scripts/github-ai-sync.cjs save`)',
    '- GitHub 최신 소스 가져오기: `npm run github:pull` (`node scripts/github-ai-sync.cjs pull`)',
    '- GitHub 동기화 상태 확인: `npm run github:status` (`node scripts/github-ai-sync.cjs status`)',
    ''
  ].join('\n');

  fs.writeFileSync(path.join(ROOT, 'llms.txt'), llmsTxt, 'utf8');

  // 3. llms-full.txt (핵심 코드 전체를 하나로 합친 AI 컨텍스트 번들)
  const fullChunks = [
    '# 디아2-인게임-내비게이터 (D2R-HUD v1.4) — Full AI Source Bundle',
    `Repository: ${REPO_URL}`,
    `Raw Bundle URL: ${RAW_BASE}/llms-full.txt`,
    ''
  ];

  for (const item of CORE_FILES) {
    if (!item.includeInFullBundle) continue;
    const abs = path.join(ROOT, item.relPath);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf8');
    fullChunks.push('================================================================================');
    fullChunks.push(`FILE: ${item.relPath}`);
    fullChunks.push(`ROLE: ${item.role}`);
    fullChunks.push(`RAW_URL: ${RAW_BASE}/${item.relPath}`);
    fullChunks.push('================================================================================');
    fullChunks.push(content.trimEnd());
    fullChunks.push('');
  }

  fs.writeFileSync(path.join(ROOT, 'llms-full.txt'), fullChunks.join('\n'), 'utf8');

  console.log('[AI Bundle] 생성 완료:');
  console.log(`  - llms.txt          (${fs.statSync(path.join(ROOT, 'llms.txt')).size.toLocaleString()} bytes)`);
  console.log(`  - llms-full.txt     (${fs.statSync(path.join(ROOT, 'llms-full.txt')).size.toLocaleString()} bytes)`);
  console.log(`  - ai-repo-index.json (${fs.statSync(path.join(ROOT, 'ai-repo-index.json')).size.toLocaleString()} bytes)`);
}

async function cmdStatus() {
  const localSha = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = execSync('git status -s', { cwd: ROOT, encoding: 'utf8' }).trim();
  const token = getGitToken();

  const repoResp = await httpsJson(`https://api.github.com/repos/${OWNER}/${REPO}`, 'GET', token);
  const commitResp = await httpsJson(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`, 'GET', token);

  const remoteSha = commitResp.data && commitResp.data.sha ? commitResp.data.sha : 'unknown';
  const isSynced = localSha === remoteSha && dirty.length === 0;

  console.log('=== GitHub 저장소 동기화 상태 ===');
  console.log(`저장소 URL   : ${REPO_URL}`);
  console.log(`프로젝트 설명: ${repoResp.data.description || '(없음)'}`);
  console.log(`로컬 HEAD    : ${localSha}`);
  console.log(`원격(GitHub) : ${remoteSha}`);
  console.log(`최근 커밋    : ${commitResp.data?.commit?.message || ''}`);
  console.log(`미커밋 파일  : ${dirty ? dirty.split('\n').length + '개 변경됨' : '없음 (Clean)'}`);
  console.log(`동기화 판정  : ${isSynced ? '✅ 완벽 동기화됨 (100% 일치)' : '⚠️ 로컬 변경사항 있음 또는 푸시 필요'}`);
}

async function cmdSave(customMsg) {
  generateAiBundles();
  execSync('git add -A', { cwd: ROOT, stdio: 'inherit' });
  const status = execSync('git status -s', { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!status) {
    console.log('[GitHub Save] 변경된 파일이 없습니다. 이미 최신 상태입니다.');
    await cmdStatus();
    return;
  }
  const msg = customMsg || `chore(sync): update source & AI context bundle (${new Date().toISOString().slice(0, 19).replace('T', ' ')})`;
  spawnSync('git', ['commit', '-m', msg], { cwd: ROOT, stdio: 'inherit' });
  spawnSync('git', ['push', 'origin', BRANCH], { cwd: ROOT, stdio: 'inherit' });
  await cmdStatus();
}

async function cmdPull() {
  console.log('[GitHub Pull] 원격 저장소에서 최신 소스를 가져옵니다...');
  spawnSync('git', ['pull', '--rebase', 'origin', BRANCH], { cwd: ROOT, stdio: 'inherit' });
  await cmdStatus();
}

async function cmdRepos() {
  const token = getGitToken();
  const url = token
    ? 'https://api.github.com/user/repos?sort=updated&per_page=30'
    : `https://api.github.com/users/${OWNER}/repos?sort=updated&per_page=30`;
  const resp = await httpsJson(url, 'GET', token);
  if (!Array.isArray(resp.data)) {
    console.error('저장소 목록을 가져오지 못했습니다:', resp.data);
    return;
  }
  console.log(`=== 내 GitHub 저장소 목록 (${OWNER}, 총 ${resp.data.length}개) ===`);
  for (const r of resp.data) {
    console.log(`- ${r.full_name} (${r.private ? 'Private' : 'Public'})`);
    console.log(`  설명: ${r.description || '(없음)'}`);
    console.log(`  URL : ${r.html_url}`);
    console.log(`  클론: git clone ${r.clone_url}`);
  }
}

async function cmdFetchRaw(targetRelPath = 'llms-full.txt') {
  const url = `${RAW_BASE}/${targetRelPath}`;
  const resp = await httpsJson(url, 'GET', getGitToken());
  const outPath = path.join(ROOT, 'fetched-' + path.basename(targetRelPath));
  const content = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data, null, 2);
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`[GitHub Fetch] ${url} -> ${outPath} (${Buffer.byteLength(content, 'utf8').toLocaleString()} bytes) 저장 완료`);
}

async function main() {
  const action = (process.argv[2] || 'status').toLowerCase();
  const arg = process.argv.slice(3).join(' ').trim();

  if (action === 'bundle') {
    generateAiBundles();
  } else if (action === 'status') {
    await cmdStatus();
  } else if (action === 'save' || action === 'push') {
    await cmdSave(arg);
  } else if (action === 'pull') {
    await cmdPull();
  } else if (action === 'repos' || action === 'list') {
    await cmdRepos();
  } else if (action === 'fetch') {
    await cmdFetchRaw(arg || 'llms-full.txt');
  } else {
    console.log('사용법: node scripts/github-ai-sync.cjs [status|bundle|save|pull|repos|fetch]');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
