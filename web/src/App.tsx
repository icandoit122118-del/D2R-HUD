import React, { useState, useEffect, useRef } from 'react';
import questTimeline from './quest_timeline.json';
import runewordData from './runewords.json';
import cubingData from './cubing.json';
import warlockGuide from './warlock_guide.json';

// --- Types ---
interface Task {
  text: string;
  is_checked: boolean;
}

interface Step {
  index: number;
  condition: { type: string; value: any };
  location: string;
  route?: string;
  tasks: Task[];
  note: string;
  strategic_tip?: string;
}

interface Runeword {
  name: string;
  original_name: string;
  runes: string[];
  item_types: string[];
  level: number;
  stats: string[];
  category: string;
  material_sources: string;
}

interface CubingRecipe {
  name: string;
  category: string;
  recipe: string;
  result: string;
  description?: string;
  runes?: string[];
}

interface Guide {
  meta: {
    id: string;
    title: string;
    author_id: string;
    original_source_id: string | null;
    version: string;
    last_updated: string;
    class: string;
    is_public?: boolean;
    source_type?: 'library' | 'local' | 'file';
    file_path?: string;
  };
  steps: Step[];
}

interface DisplayInfo {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
  relativeX: number;
  relativeY: number;
}

const DEFAULT_GUIDE: Guide = { ...questTimeline, meta: { ...questTimeline.meta, source_type: 'library' } } as Guide;
const ABYSS_WARLOCK: Guide = { ...warlockGuide, meta: { ...warlockGuide.meta, source_type: 'library' } } as Guide;
const ALL_GUIDES = [DEFAULT_GUIDE, ABYSS_WARLOCK];
const APP_VERSION = '1.3.0';

const RUNE_MAP: Record<string, string> = {
  '엘': 'El', '엘드': 'Eld', '티르': 'Tir', '네프': 'Nef', '에드': 'Eth',
  '아이드': 'Ith', '탈': 'Tal', '랄': 'Ral', '오르트': 'Ort', '주울': 'Thul',
  '앰': 'Amn', '솔': 'Sol', '샤엘': 'Shael', '돌': 'Dol', '헬': 'Hel',
  '이오': 'Io', '룸': 'Lum', '코': 'Ko', '팔': 'Fal', '렘': 'Lem',
  '풀': 'Pul', '우움': 'Um', '움': 'Um', '말': 'Mal', '이스트': 'Ist',
  '굴': 'Gul', '벡스': 'Vex', '오움': 'Ohm', '로': 'Lo', '수르': 'Sur',
  '베르': 'Ber', '자': 'Jah', '참': 'Cham', '조드': 'Zod'
};

const ORDERED_RUNES = [
  '엘', '엘드', '티르', '네프', '에드', '아이드', '탈', '랄', '오르트', '주울',
  '앰', '솔', '샤엘', '돌', '헬', '이오', '룸', '코', '팔', '렘',
  '풀', '우움', '말', '이스트', '굴', '벡스', '오움', '로', '수르', '베르',
  '자', '참', '조드'
];

const getRuneImageUrl = (runeName: string) => {
  const engName = RUNE_MAP[runeName];
  if (!engName) return null;
  return `./data/portal-master/images/items/socketables/rune/${engName}_Rune.png`;
};

const getItemImageUrl = (itemName: string) => {
  if (RUNE_MAP[itemName]) return getRuneImageUrl(itemName);
  const gems: Record<string, string> = {
    '최상급 자수정': 'Perfect_Amethyst', '상급 자수정': 'Flawless_Amethyst', '자수정': 'Amethyst',
    '최상급 루비': 'Perfect_Ruby', '상급 루비': 'Flawless_Ruby', '루비': 'Ruby',
    '최상급 사파이어': 'Perfect_Sapphire', '상급 사파이어': 'Flawless_Sapphire', '사파이어': 'Sapphire',
    '최상급 토파즈': 'Perfect_Topaz', '상급 토파즈': 'Flawless_Topaz', '토파즈': 'Topaz',
    '최상급 에메랄드': 'Perfect_Emerald', '상급 에메랄드': 'Flawless_Emerald', '에메랄드': 'Emerald',
    '최상급 다이아몬드': 'Perfect_Diamond', '상급 다이아몬드': 'Flawless_Diamond', '다이아몬드': 'Diamond',
    '최상급 해골': 'Perfect_Skull', '상급 해골': 'Flawless_Skull', '해골': 'Skull'
  };
  if (gems[itemName]) return `./data/portal-master/images/items/socketables/gem/${gems[itemName]}.png`;
  if (itemName.includes('아뮬렛')) return `./data/portal-master/images/items/amulet/Amulet_1.png`;
  if (itemName.includes('링') || itemName.includes('반지')) return `./data/portal-master/images/items/ring/Ring_1.png`;
  if (itemName.includes('부적')) return `./data/portal-master/images/items/charms/charm1u.png`;
  return null;
};

function App() {
  const [guide, setGuide] = useState<Guide>(() => {
    const lastSession = localStorage.getItem('d2r-last-session');
    if (lastSession) {
      try {
        const session = JSON.parse(lastSession);
        if (session.source_type === 'local' && session.id) {
          const custom = localStorage.getItem(`d2r-guide-${session.id}`);
          if (custom) return JSON.parse(custom);
        }
        if (session.source_type === 'library' && session.id) {
          const library = ALL_GUIDES.find(g => g.meta.id === session.id);
          if (library) return library;
        }
      } catch (e) { /* fallback */ }
    }
    return DEFAULT_GUIDE;
  });

  const LIBRARY_IDS = new Set(ALL_GUIDES.map(g => g.meta.id));

  const [savedGuides, setSavedGuides] = useState<{ id: string; title: string; path?: string; source_type?: string }[]>(() => {
    const index = localStorage.getItem('d2r-guides-index');
    if (!index) return [];
    try {
      const parsed = JSON.parse(index);
      return parsed.filter((g: any) => {
        if (g.source_type === 'library') return false;
        if (LIBRARY_IDS.has(g.id) && !g.path) return false;
        return true;
      });
    } catch (e) { return []; }
  });

  // Auto-Hide State
  const [autoHide, setAutoHide] = useState<{ enabled: boolean; x: number; y: number; targetColor: string; interval: number }>(() => {
    const saved = localStorage.getItem('d2r-autohide');
    const parsed = saved ? JSON.parse(saved) : { enabled: false, x: 0, y: 0, targetColor: '#000000', interval: 500 };
    return { ...parsed, enabled: false };
  });
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // View Mode State
  const [viewMode, setViewMode] = useState<'guide' | 'hud' | 'runeword'>('hud');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

  // Self-Contained v1.3 Features: Owned Runes & Socket Filter & Cube Category
  const [ownedRunes, setOwnedRunes] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('d2r-owned-runes') || '[]');
    } catch (e) { return []; }
  });
  const [showStashBar, setShowStashBar] = useState(false);
  const [craftableOnly, setCraftableOnly] = useState(false);
  const [socketFilter, setSocketFilter] = useState<string>('all');
  const [cubeCategoryFilter, setCubeCategoryFilter] = useState<string>('all');
  const [expandedRunewords, setExpandedRunewords] = useState<Record<string, boolean>>({});
  const [newGuideTitleInput, setNewGuideTitleInput] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('d2r-owned-runes', JSON.stringify(ownedRunes));
  }, [ownedRunes]);

  const toggleOwnedRune = (runeKr: string) => {
    setOwnedRunes(prev =>
      prev.includes(runeKr) ? prev.filter(r => r !== runeKr) : [...prev, runeKr]
    );
  };

  // Popup Positions & Sizes
  const [hudPos, setHudPos] = useState<{ x: number; y: number }>({ x: 32, y: 32 });
  const hasCenteredRef = useRef(false);
  const [editorPos, setEditorPos] = useState<{ x: number; y: number }>(() => JSON.parse(localStorage.getItem('guide-pos') || '{"x": 60, "y": 60}'));
  const [runewordPos, setRunewordPos] = useState<{ x: number; y: number }>(() => JSON.parse(localStorage.getItem('runepos') || '{"x": 80, "y": 60}'));
  const [settingsPos, setSettingsPos] = useState<{ x: number; y: number }>(() => JSON.parse(localStorage.getItem('settings-pos') || '{"x": 360, "y": 60}'));
  const [uiScale, setUiScale] = useState<number>(() => parseFloat(localStorage.getItem('uiscale') || '1.0'));

  const [hudSize, setHudSize] = useState<{ width: number; height: number }>(() => {
    try { return JSON.parse(localStorage.getItem('hud-size') || '{"width": 340, "height": 460}'); }
    catch (e) { return { width: 340, height: 460 }; }
  });
  const [editorSize, setEditorSize] = useState<{ width: number; height: number }>(() => {
    try { return JSON.parse(localStorage.getItem('editor-size') || '{"width": 520, "height": 620}'); }
    catch (e) { return { width: 520, height: 620 }; }
  });
  const [runewordSize, setRunewordSize] = useState<{ width: number; height: number }>(() => {
    try { return JSON.parse(localStorage.getItem('runeword-size') || '{"width": 420, "height": 700}'); }
    catch (e) { return { width: 420, height: 700 }; }
  });
  const [settingsSize, setSettingsSize] = useState<{ width: number; height: number }>(() => {
    try { return JSON.parse(localStorage.getItem('settings-size') || '{"width": 300, "height": 540}'); }
    catch (e) { return { width: 300, height: 540 }; }
  });

  const [showSettings, setShowSettings] = useState(false);
  const [toggleHotkey, setToggleHotkey] = useState(() => localStorage.getItem('toggle-hotkey') || 'Control+Q');

  // Update State
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });
  const showToast = (message: string) => {
    setToast({ message, show: true });
    setTimeout(() => setToast({ message: '', show: false }), 3000);
  };

  const [searchRune, setSearchRune] = useState('');
  const [etcTab, setEtcTab] = useState<'runes' | 'cubing'>('runes');

  // Monitor State
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(() => localStorage.getItem('selected-monitor-id'));

  const isEditorOpen = viewMode === 'guide';
  const isRunewordOpen = viewMode === 'runeword';

  const toggleEditor = () => setViewMode(prev => prev === 'guide' ? 'hud' : 'guide');
  const toggleRunewords = () => setViewMode(prev => prev === 'runeword' ? 'hud' : 'runeword');
  const closePanels = () => setViewMode('hud');

  useEffect(() => { localStorage.setItem('guide-pos', JSON.stringify(editorPos)); }, [editorPos]);
  useEffect(() => { localStorage.setItem('runepos', JSON.stringify(runewordPos)); }, [runewordPos]);
  useEffect(() => { localStorage.setItem('settings-pos', JSON.stringify(settingsPos)); }, [settingsPos]);
  useEffect(() => { localStorage.setItem('uiscale', uiScale.toString()); }, [uiScale]);
  useEffect(() => {
    if (selectedMonitorId) localStorage.setItem('selected-monitor-id', selectedMonitorId);
  }, [selectedMonitorId]);
  useEffect(() => { localStorage.setItem('hud-size', JSON.stringify(hudSize)); }, [hudSize]);
  useEffect(() => { localStorage.setItem('editor-size', JSON.stringify(editorSize)); }, [editorSize]);
  useEffect(() => { localStorage.setItem('runeword-size', JSON.stringify(runewordSize)); }, [runewordSize]);
  useEffect(() => { localStorage.setItem('settings-size', JSON.stringify(settingsSize)); }, [settingsSize]);

  useEffect(() => {
    localStorage.setItem('d2r-last-guide-id', guide.meta.id);
    const session = {
      id: guide.meta.id,
      source_type: guide.meta.source_type || 'library',
      path: guide.meta.file_path || null
    };
    localStorage.setItem('d2r-last-session', JSON.stringify(session));
  }, [guide]);

  useEffect(() => {
    if (!(window as any).require) return;
    const lastSession = localStorage.getItem('d2r-last-session');
    if (!lastSession) return;
    try {
      const session = JSON.parse(lastSession);
      if (session.source_type === 'file' && session.path) {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.invoke('read-guide-file', session.path).then((data: any) => {
          if (data) {
            setGuide({ ...data, meta: { ...data.meta, source_type: 'file', file_path: session.path } });
            setCurrentFilePath(session.path);
          }
        }).catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('d2r-guides-index', JSON.stringify(savedGuides));
  }, [savedGuides]);

  const ipcSend = (channel: string, ...args: any[]) => {
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send(channel, ...args);
    }
  };

  useEffect(() => {
    localStorage.setItem('d2r-autohide', JSON.stringify(autoHide));
    ipcSend('toggle-auto-hide', autoHide);
  }, [autoHide]);

  useEffect(() => {
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');

      const handleCalibration = (_: any, data: { x: number; y: number; color: string }) => {
        setAutoHide(prev => ({ ...prev, x: data.x, y: data.y, targetColor: data.color }));
        setIsCalibrating(false);
        showToast(`픽셀 좌표 (${data.x}, ${data.y}) 색상 ${data.color} 감지 완료`);
      };

      const handleCalibFailed = (_: any, msg: string) => {
        setIsCalibrating(false);
        showToast('픽셀 캡처 실패: ' + msg);
      };

      const handlePrimaryDisplay = (_: any, info: { id?: number; x: number; y: number; width: number; height: number }) => {
        if (hasCenteredRef.current) return;
        const margin = 32;
        const rightX = Math.max(margin, (info.width - hudSize.width * uiScale) - margin);
        const topY = margin;
        setHudPos({ x: rightX, y: topY });

        const centerUI = (size: { width: number; height: number }) => ({
          x: Math.max(16, (info.width - size.width * uiScale) / 2),
          y: Math.max(16, (info.height - size.height * uiScale) / 2)
        });

        setEditorPos(centerUI(editorSize));
        setRunewordPos(centerUI(runewordSize));
        setSettingsPos(centerUI(settingsSize));
        hasCenteredRef.current = true;

        const primId = info.id?.toString() || 'primary';
        setSelectedMonitorId(primId);
      };

      const handleAllDisplays = (_: any, info: { displays: DisplayInfo[] }) => {
        setDisplays(info.displays);
      };

      const handleCycleMonitor = () => {
        if (displays.length <= 1) return;
        const currentIndex = displays.findIndex(d => d.id.toString() === selectedMonitorId);
        const nextMonitor = displays[(currentIndex + 1 + displays.length) % displays.length] || displays[0];
        const nextId = nextMonitor.id.toString();
        setSelectedMonitorId(nextId);
        ipcRenderer.send('move-to-monitor', nextId);

        const moveUI = (size: { width: number; height: number }) => ({
          x: Math.max(16, (nextMonitor.bounds.width - size.width * uiScale) / 2),
          y: Math.max(16, (nextMonitor.bounds.height - size.height * uiScale) / 2)
        });
        setHudPos({ x: Math.max(16, nextMonitor.bounds.width - hudSize.width * uiScale - 32), y: 32 });
        setEditorPos(moveUI(editorSize));
        setRunewordPos(moveUI(runewordSize));
        setSettingsPos(moveUI(settingsSize));
      };

      const handleSnapToCorner = (_: any, corner: string) => {
        setHudPos(prev => {
          const currentMonitor = displays.find(d => d.id.toString() === selectedMonitorId) || displays[0];
          const monW = currentMonitor ? currentMonitor.bounds.width : window.innerWidth;
          const monH = currentMonitor ? currentMonitor.bounds.height : window.innerHeight;
          const w = hudSize.width * uiScale;
          const h = hudSize.height * uiScale;
          const margin = 12;

          switch (corner) {
            case 'top-left': return { x: margin, y: margin };
            case 'top-right': return { x: Math.max(margin, monW - w - margin), y: margin };
            case 'bottom-left': return { x: margin, y: Math.max(margin, monH - h - margin) };
            case 'bottom-right': return { x: Math.max(margin, monW - w - margin), y: Math.max(margin, monH - h - margin) };
            default: return prev;
          }
        });
      };

      ipcRenderer.on('calibration-complete', handleCalibration);
      ipcRenderer.on('calibration-failed', handleCalibFailed);
      ipcRenderer.on('primary-display-info', handlePrimaryDisplay);
      ipcRenderer.on('all-displays-info', handleAllDisplays);
      ipcRenderer.on('cycle-monitor', handleCycleMonitor);
      ipcRenderer.on('snap-to-corner', handleSnapToCorner);

      ipcRenderer.send('get-all-displays-info');
      ipcRenderer.send('get-primary-display-info');

      return () => {
        ipcRenderer.removeListener('calibration-complete', handleCalibration);
        ipcRenderer.removeListener('calibration-failed', handleCalibFailed);
        ipcRenderer.removeListener('primary-display-info', handlePrimaryDisplay);
        ipcRenderer.removeListener('all-displays-info', handleAllDisplays);
        ipcRenderer.removeListener('cycle-monitor', handleCycleMonitor);
        ipcRenderer.removeListener('snap-to-corner', handleSnapToCorner);
      };
    }
  }, [displays, selectedMonitorId, uiScale, hudSize, editorSize, runewordSize, settingsSize]);

  const startCalibration = () => {
    setIsCalibrating(true);
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      ipcSend('snap-pixel-color');
      setCountdown(null);
      setIsCalibrating(false);
    }
  }, [countdown]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCalibrating) {
        setIsCalibrating(false);
        setCountdown(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isCalibrating]);

  // --- Guide Management ---
  const saveGuideAsFile = async () => {
    if (!(window as any).require) {
      showToast('데스크톱 오버레이 앱에서만 파일 저장이 지원됩니다.');
      return;
    }
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const fileGuide = { ...guide, meta: { ...guide.meta, source_type: 'file' as const } };
      const filePath = await ipcRenderer.invoke('save-guide-dialog', fileGuide);
      if (filePath) {
        const guideWithPath = { ...fileGuide, meta: { ...fileGuide.meta, file_path: filePath } };
        setGuide(guideWithPath);
        setCurrentStepIndex(0);
        setCurrentFilePath(filePath);
        setSavedGuides(prev => {
          const filtered = prev.filter(g => g.path !== filePath);
          const newEntry = { id: guideWithPath.meta.id, title: guideWithPath.meta.title, path: filePath, source_type: 'file' };
          return [newEntry, ...filtered];
        });
        showToast(`가이드 파일 저장 완료: ${filePath}`);
      }
    } catch (err: any) {
      showToast('파일 저장 실패: ' + err.message);
    }
  };

  const loadGuideFromFileWithPath = async (filePath: string) => {
    if (!(window as any).require) return;
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const data = await ipcRenderer.invoke('read-guide-file', filePath);
      if (data) {
        const guideWithSource = { ...data, meta: { ...data.meta, source_type: 'file' as const, file_path: filePath } };
        setGuide(guideWithSource);
        setCurrentStepIndex(0);
        setCurrentFilePath(filePath);
        setSavedGuides(prev => {
          const filtered = prev.filter(g => g.path !== filePath);
          const newEntry = { id: guideWithSource.meta.id, title: guideWithSource.meta.title, path: filePath, source_type: 'file' };
          return [newEntry, ...filtered];
        });
      }
    } catch (err: any) {
      showToast('파일 읽기 오류: ' + err.message);
    }
  };

  const loadGuideFromFile = async () => {
    if (!(window as any).require) {
      showToast('데스크톱 오버레이 앱에서만 파일 열기가 지원됩니다.');
      return;
    }
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('open-guide-dialog');
      if (result) {
        const { filePath, data } = result;
        const guideWithSource = { ...data, meta: { ...data.meta, source_type: 'file' as const, file_path: filePath } };
        setGuide(guideWithSource);
        setCurrentStepIndex(0);
        setCurrentFilePath(filePath);
        setSavedGuides(prev => {
          const filtered = prev.filter(g => g.path !== filePath);
          const newEntry = { id: guideWithSource.meta.id, title: guideWithSource.meta.title, path: filePath, source_type: 'file' };
          return [newEntry, ...filtered];
        });
        showToast(`가이드 로드 완료: ${filePath}`);
      }
    } catch (err: any) {
      showToast('파일 열기 오류: ' + err.message);
    }
  };

  const confirmSaveGuideAs = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const newId = 'local-' + Date.now().toString();
    const newGuide: Guide = {
      ...guide,
      meta: {
        ...guide.meta,
        id: newId,
        title: trimmed,
        last_updated: new Date().toISOString().split('T')[0],
        source_type: 'local',
        file_path: undefined
      }
    };
    localStorage.setItem(`d2r-guide-${newId}`, JSON.stringify(newGuide));
    setSavedGuides(prev => [{ id: newId, title: trimmed, source_type: 'local' }, ...prev]);
    setGuide(newGuide);
    setCurrentFilePath(null);
    setNewGuideTitleInput(null);
    showToast(`'${trimmed}' 사본이 내 로컬 저장소에 보관되었습니다.`);
  };

  const saveGuide = async () => {
    if (currentFilePath && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const success = await ipcRenderer.invoke('save-guide-to-path', { filePath: currentFilePath, guideData: guide });
        if (success) {
          showToast(`파일에 변경사항 저장 완료: ${currentFilePath}`);
          return;
        }
      } catch (err) { /* fallback */ }
    }
    const isLibrary = ALL_GUIDES.some(g => g.meta.id === guide.meta.id);
    if (isLibrary) {
      setNewGuideTitleInput(`${guide.meta.title} (커스텀)`);
      return;
    }
    localStorage.setItem(`d2r-guide-${guide.meta.id}`, JSON.stringify(guide));
    showToast('변경사항이 로컬 저장소에 저장되었습니다.');
  };

  const loadGuide = (id: string) => {
    const library = ALL_GUIDES.find(g => g.meta.id === id);
    if (library) {
      setGuide(library);
      setCurrentStepIndex(0);
      setCurrentFilePath(null);
      return;
    }
    const content = localStorage.getItem(`d2r-guide-${id}`);
    if (content) {
      try {
        const loadedGuide = JSON.parse(content);
        setGuide(loadedGuide);
        setCurrentStepIndex(0);
        setCurrentFilePath(null);
      } catch (e) {
        showToast('가이드 데이터를 불러오지 못했습니다.');
      }
    }
  };

  const resetToDefault = () => {
    localStorage.removeItem('d2r-last-guide-id');
    setGuide(DEFAULT_GUIDE);
    setCurrentStepIndex(0);
    setCurrentFilePath(null);
    showToast('기본 성역 퀘스트 타임라인으로 초기화했습니다.');
  };

  const deleteGuide = (id: string, path?: string) => {
    if (path) {
      setSavedGuides(prev => prev.filter(g => g.path !== path));
    } else {
      localStorage.removeItem(`d2r-guide-${id}`);
      setSavedGuides(prev => prev.filter(g => g.id !== id));
    }
    showToast('선택한 가이드를 목록에서 제거했습니다.');
  };

  // Click-through Mouse Bridge
  useEffect(() => {
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      const handleMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('.pointer-events-auto');
        if (isInteractive) {
          ipcRenderer.send('set-ignore-mouse-events', false);
        } else {
          ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
        }
      };
      window.addEventListener('mousemove', handleMouseOver);
      return () => window.removeEventListener('mousemove', handleMouseOver);
    }
  }, []);

  // Global Shortcut Step Navigation
  useEffect(() => {
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      const handleNext = () => setCurrentStepIndex(prev => Math.min(prev + 1, guide.steps.length - 1));
      const handlePrev = () => setCurrentStepIndex(prev => Math.max(prev - 1, 0));
      ipcRenderer.on('next-step', handleNext);
      ipcRenderer.on('prev-step', handlePrev);
      return () => {
        ipcRenderer.removeListener('next-step', handleNext);
        ipcRenderer.removeListener('prev-step', handlePrev);
      };
    }
  }, [guide.steps.length]);

  // Hotkey Recorder
  const [isRecording, setIsRecording] = useState(false);
  useEffect(() => {
    if (!isRecording) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Control');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');
      if (e.metaKey) modifiers.push('Super');
      const key = e.key.toUpperCase();
      if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return;
      const accelerator = [...modifiers, key].join('+');
      setToggleHotkey(accelerator);
      setIsRecording(false);
      localStorage.setItem('toggle-hotkey', accelerator);
      ipcSend('update-toggle-hotkey', accelerator);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  useEffect(() => {
    ipcSend('update-toggle-hotkey', toggleHotkey);
  }, []);

  // 1:1 Direct Manipulation Drag Handler
  const handleDrag = (e: React.MouseEvent, type: 'editor' | 'runeword' | 'hud' | 'settings') => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = type === 'editor' ? editorPos : type === 'runeword' ? runewordPos : type === 'settings' ? settingsPos : hudPos;

    ipcSend('set-ignore-mouse-events', false);

    const onMouseMove = (moveEvent: MouseEvent) => {
      let newX = startPos.x + (moveEvent.clientX - startX);
      let newY = startPos.y + (moveEvent.clientY - startY);
      const currentMonitor = displays.find(d => d.id.toString() === selectedMonitorId) || displays[0];
      const maxW = currentMonitor ? currentMonitor.bounds.width : window.innerWidth;
      const maxH = currentMonitor ? currentMonitor.bounds.height : window.innerHeight;

      newX = Math.max(-80, Math.min(maxW - 60, newX));
      newY = Math.max(0, Math.min(maxH - 48, newY));

      if (type === 'editor') setEditorPos({ x: newX, y: newY });
      else if (type === 'runeword') setRunewordPos({ x: newX, y: newY });
      else if (type === 'settings') setSettingsPos({ x: newX, y: newY });
      else setHudPos({ x: newX, y: newY });
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const targetUnderMouse = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      if (!targetUnderMouse?.closest('.pointer-events-auto')) {
        ipcSend('set-ignore-mouse-events', true, { forward: true });
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Resize Handler
  const handleResize = (e: React.MouseEvent, direction: 'width' | 'height' | 'both', type: 'hud' | 'editor' | 'runeword' | 'settings' = 'hud') => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;

    let startWidth = hudSize.width;
    let startHeight = hudSize.height;
    let setSize = setHudSize;
    let minW = 260, minH = 220;

    if (type === 'editor') {
      startWidth = editorSize.width; startHeight = editorSize.height; setSize = setEditorSize; minW = 380; minH = 420;
    } else if (type === 'runeword') {
      startWidth = runewordSize.width; startHeight = runewordSize.height; setSize = setRunewordSize; minW = 320; minH = 420;
    } else if (type === 'settings') {
      startWidth = settingsSize.width; startHeight = settingsSize.height; setSize = setSettingsSize; minW = 260; minH = 340;
    }

    ipcSend('set-ignore-mouse-events', false);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextW = (direction === 'width' || direction === 'both')
        ? Math.max(minW, startWidth + (moveEvent.clientX - startX) / uiScale)
        : startWidth;
      const nextH = (direction === 'height' || direction === 'both')
        ? Math.max(minH, startHeight + (moveEvent.clientY - startY) / uiScale)
        : startHeight;
      setSize({ width: nextW, height: nextH });
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const targetUnderMouse = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      if (!targetUnderMouse?.closest('.pointer-events-auto')) {
        ipcSend('set-ignore-mouse-events', true, { forward: true });
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Step & Task Mutations
  const updateStep = (index: number, field: keyof Step, value: any) => {
    setGuide(prev => {
      const newSteps = [...prev.steps];
      const currentValue = newSteps[index][field];
      const newValue = typeof value === 'function' ? value(currentValue) : value;
      newSteps[index] = { ...newSteps[index], [field]: newValue };
      return { ...prev, steps: newSteps };
    });
  };

  const addStep = () => {
    const newStep: Step = {
      index: guide.steps.length,
      condition: { type: 'ACT', value: `Step ${guide.steps.length + 1}` },
      location: '새로운 성역 지역',
      route: '',
      tasks: [{ text: '수행할 목표를 입력하세요', is_checked: false }],
      note: ''
    };
    setGuide(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    setCurrentStepIndex(guide.steps.length);
  };

  const removeStep = (index: number) => {
    if (guide.steps.length <= 1) return;
    const newSteps = guide.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, index: i }));
    setGuide(prev => ({ ...prev, steps: newSteps }));
    setCurrentStepIndex(Math.max(0, currentStepIndex - 1));
  };

  // Filtering Logic for Runewords & Cubing
  const canCraftRuneword = (r: Runeword) => {
    if (ownedRunes.length === 0) return false;
    return r.runes.every(rn => ownedRunes.includes(rn));
  };

  const filteredRunewords = (runewordData as Runeword[]).filter(r => {
    const q = searchRune.trim().toLowerCase();
    const matchesSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      r.original_name.toLowerCase().includes(q) ||
      r.runes.some(rn => rn.includes(q)) ||
      r.item_types.some(it => it.toLowerCase().includes(q)) ||
      r.stats.some(st => st.toLowerCase().includes(q));

    const matchesSocket = socketFilter === 'all' || r.item_types.some(t => t.includes(`${socketFilter}홈`));
    const matchesCraftable = !craftableOnly || canCraftRuneword(r);
    return matchesSearch && matchesSocket && matchesCraftable;
  });

  const cubeCategories = ['all', ...Array.from(new Set((cubingData as CubingRecipe[]).map(c => c.category)))];

  const filteredCubing = (cubingData as CubingRecipe[]).filter(c => {
    const q = searchRune.trim().toLowerCase();
    const matchesSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      c.recipe.toLowerCase().includes(q) ||
      c.result.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.runes && c.runes.some(rn => rn.includes(q)));
    const matchesCat = cubeCategoryFilter === 'all' || c.category === cubeCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const currentStep = guide.steps[currentStepIndex] || guide.steps[0];
  const completedTasksCount = currentStep.tasks.filter(t => t.is_checked).length;

  return (
    <div className="d2r-canvas" style={{ zoom: uiScale } as any}>

      {/* 1. GUIDE EDITOR PANEL */}
      {isEditorOpen && (
        <div
          className="d2r-panel"
          style={{
            left: editorPos.x / uiScale,
            top: editorPos.y / uiScale,
            width: `${editorSize.width}px`,
            height: `${editorSize.height}px`,
            zIndex: 52
          }}
        >
          <div className="d2r-resize-e" onMouseDown={e => handleResize(e, 'width', 'editor')} />
          <div className="d2r-resize-s" onMouseDown={e => handleResize(e, 'height', 'editor')} />
          <div className="d2r-resize-se" onMouseDown={e => handleResize(e, 'both', 'editor')} />

          {/* Header */}
          <div style={{ backgroundColor: 'var(--color-stone)', borderBottom: '1px solid var(--color-gold-dark)', position: 'relative', zIndex: 2 }}>
            <div className="d2r-header" onMouseDown={e => handleDrag(e, 'editor')} style={{ borderBottom: 'none', paddingBottom: '4px' }}>
              <span className="d2r-title">성역 원정대 가이드 편집기</span>
              <button onClick={closePanels} onMouseDown={e => e.stopPropagation()} className="d2r-btn-icon" title="닫기" aria-label="가이드 편집기 닫기">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div style={{ padding: '4px 10px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }} onMouseDown={e => e.stopPropagation()}>
              <select
                className="d2r-select"
                aria-label="가이드 선택"
                onChange={e => {
                  const val = e.target.value;
                  if (val.startsWith('file:')) loadGuideFromFileWithPath(val.slice(5));
                  else loadGuide(val);
                }}
                value={currentFilePath ? `file:${currentFilePath}` : guide.meta.id}
              >
                <optgroup label="기본 성역 도서관">
                  <option value={DEFAULT_GUIDE.meta.id}>{DEFAULT_GUIDE.meta.title}</option>
                  <option value={ABYSS_WARLOCK.meta.id}>{ABYSS_WARLOCK.meta.title}</option>
                </optgroup>
                {savedGuides.some(g => !g.path) && (
                  <optgroup label="내 로컬 보관함">
                    {savedGuides.filter(g => !g.path).map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </optgroup>
                )}
                {savedGuides.some(g => g.path) && (
                  <optgroup label="외부 JSON 가이드 파일">
                    {savedGuides.filter(g => g.path).map(g => {
                      const fileName = g.path!.split(/[\\\/]/).pop() || g.path;
                      return <option key={g.path} value={`file:${g.path}`}>{fileName}</option>;
                    })}
                  </optgroup>
                )}
              </select>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <button onClick={saveGuide} className="d2r-btn d2r-btn-gold">변경사항 저장</button>
                <button onClick={() => setNewGuideTitleInput(`${guide.meta.title} (사본)`)} className="d2r-btn">사본 저장</button>
                {(window as any).require && (
                  <>
                    <button onClick={loadGuideFromFile} className="d2r-btn">JSON 열기</button>
                    <button onClick={saveGuideAsFile} className="d2r-btn">JSON 내보내기</button>
                  </>
                )}
                {currentFilePath && (
                  <button
                    onClick={() => {
                      const entry = savedGuides.find(g => g.path === currentFilePath);
                      if (entry) deleteGuide(entry.id, currentFilePath);
                      setCurrentFilePath(null);
                    }}
                    className="d2r-btn d2r-btn-crimson"
                    style={{ marginLeft: 'auto' }}
                  >
                    목록 제외
                  </button>
                )}
              </div>

              {newGuideTitleInput !== null && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingTop: '4px' }}>
                  <input
                    className="d2r-input"
                    value={newGuideTitleInput}
                    onChange={e => setNewGuideTitleInput(e.target.value)}
                    placeholder="새 가이드 제목 입력"
                    aria-label="새 가이드 제목"
                  />
                  <button onClick={() => confirmSaveGuideAs(newGuideTitleInput)} className="d2r-btn d2r-btn-gold">확인</button>
                  <button onClick={() => setNewGuideTitleInput(null)} className="d2r-btn">취소</button>
                </div>
              )}
            </div>
          </div>

          {/* Body: Sidebar + Step Editor */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 2 }}>
            <div style={{ width: '155px', backgroundColor: 'var(--color-stone)', borderRight: '1px solid var(--color-gold-subtle)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-gold-subtle)' }}>
                <button onClick={addStep} className="d2r-btn" style={{ width: '100%' }}>+ 단계 추가</button>
              </div>
              <div className="d2r-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {guide.steps.map((step, idx) => {
                  const isSelected = currentStepIndex === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentStepIndex(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 8px',
                        textAlign: 'left',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--color-stone-active)' : 'var(--color-void)',
                        border: isSelected ? '1px solid var(--color-gold)' : '1px solid var(--color-void)',
                        color: isSelected ? 'var(--color-gold-light)' : 'var(--color-beige)'
                      }}
                    >
                      <span className="d2r-num" style={{ fontSize: '10px', color: isSelected ? 'var(--color-gold)' : 'var(--color-muted)', fontWeight: 700 }}>
                        {idx + 1}.
                      </span>
                      <span style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {step.location || '이름 없음'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-gold-subtle)', display: 'flex', gap: '6px', backgroundColor: 'var(--color-stone)' }}>
                <button onClick={() => removeStep(currentStepIndex)} className="d2r-btn d2r-btn-crimson">현재 단계 삭제</button>
                <button onClick={resetToDefault} className="d2r-btn" style={{ marginLeft: 'auto' }}>기본값 복원</button>
              </div>

              <div className="d2r-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, marginBottom: '4px' }}>지역 및 챕터명</label>
                  <input
                    className="d2r-input"
                    value={currentStep.location}
                    onChange={e => updateStep(currentStepIndex, 'location', e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, marginBottom: '4px' }}>핵심 이동 경로 (Route)</label>
                  <input
                    className="d2r-input"
                    value={currentStep.route || ''}
                    onChange={e => updateStep(currentStepIndex, 'route', e.target.value)}
                    placeholder="예: 바위 벌판 → 지하 통로 1층 → 어둠숲"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, marginBottom: '4px' }}>세부 체크리스트 목표</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--color-stone)', padding: '8px', borderRadius: '3px', border: '1px solid var(--color-gold-subtle)' }}>
                    {(currentStep.tasks || []).map((task, tidx) => (
                      <div key={tidx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <textarea
                          className="d2r-textarea d2r-scroll"
                          rows={2}
                          value={task.text}
                          onChange={e => {
                            updateStep(currentStepIndex, 'tasks', (prevTasks: Task[]) => {
                              const next = [...prevTasks];
                              next[tidx] = { ...next[tidx], text: e.target.value };
                              return next;
                            });
                          }}
                        />
                        <button
                          onClick={() => updateStep(currentStepIndex, 'tasks', (prevTasks: Task[]) => prevTasks.filter((_, i) => i !== tidx))}
                          className="d2r-btn d2r-btn-crimson"
                          title="항목 삭제"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => updateStep(currentStepIndex, 'tasks', (prevTasks: Task[]) => [...(prevTasks || []), { text: '', is_checked: false }])}
                      className="d2r-btn"
                    >
                      + 체크 항목 추가
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, marginBottom: '4px' }}>길찾기 규칙 및 참고 노트</label>
                  <textarea
                    className="d2r-textarea d2r-scroll"
                    rows={3}
                    value={currentStep.note}
                    onChange={e => updateStep(currentStepIndex, 'note', e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-magic-blue)', fontWeight: 600, marginBottom: '4px' }}>보스 공략 및 파밍 팁</label>
                  <textarea
                    className="d2r-textarea d2r-scroll"
                    rows={3}
                    value={currentStep.strategic_tip || ''}
                    onChange={e => updateStep(currentStepIndex, 'strategic_tip', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN QUEST HUD PANEL */}
      <div
        className="d2r-panel"
        style={{
          left: hudPos.x / uiScale,
          top: hudPos.y / uiScale,
          width: `${hudSize.width}px`,
          zIndex: 50
        }}
      >
        <div className="d2r-resize-e" onMouseDown={e => handleResize(e, 'width', 'hud')} />

        {/* Header */}
        <div className="d2r-header" onMouseDown={e => handleDrag(e, 'hud')}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span className="d2r-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {guide.meta.title}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="d2r-badge">{currentStep.condition?.value || `Step ${currentStepIndex + 1}`}</span>
              <span className="d2r-subtitle" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentStep.location}
              </span>
            </div>
          </div>

          {/* Toolbar Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={toggleEditor}
              className={`d2r-btn-icon ${isEditorOpen ? 'active' : ''}`}
              title="가이드 선택 및 편집"
              aria-label="가이드 선택 및 편집"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </button>

            <button
              onClick={toggleRunewords}
              className={`d2r-btn-icon ${isRunewordOpen ? 'active' : ''}`}
              title="호라드림 사전 (룬워드 / 큐빙)"
              aria-label="호라드림 사전 열기"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`d2r-btn-icon ${showSettings ? 'active' : ''}`}
              title="환경 설정"
              aria-label="환경 설정 열기"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <button
              onClick={() => ipcSend('quit-app')}
              className="d2r-btn-icon"
              style={{ color: 'var(--color-crimson)' }}
              title="프로그램 종료 (숨기기는 Ctrl+Q)"
              aria-label="프로그램 종료"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Step Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-gold-subtle)', backgroundColor: 'var(--color-stone-raised)', position: 'relative', zIndex: 2 }}>
          <button
            onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
            disabled={currentStepIndex === 0}
            className="d2r-btn"
            style={{ flex: 1, borderRadius: 0, border: 'none', borderRight: '1px solid var(--color-gold-subtle)' }}
          >
            ◀ 이전 단계
          </button>
          <div className="d2r-num" style={{ padding: '0 10px', fontSize: '11px', color: 'var(--color-gold-currency)', fontWeight: 700 }}>
            {currentStepIndex + 1} / {guide.steps.length} ({completedTasksCount}/{currentStep.tasks.length})
          </div>
          <button
            onClick={() => setCurrentStepIndex(prev => Math.min(guide.steps.length - 1, prev + 1))}
            disabled={currentStepIndex === guide.steps.length - 1}
            className="d2r-btn d2r-btn-gold"
            style={{ flex: 1, borderRadius: 0, border: 'none', borderLeft: '1px solid var(--color-gold-subtle)' }}
          >
            다음 단계 ▶
          </button>
        </div>

        {/* Step Content */}
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', zIndex: 2 }}>
          {currentStep.route && (
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-stone)', border: '1px solid var(--color-gold-border)', borderRadius: '3px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <svg aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-gold)', flexShrink: 0, marginTop: '2px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              <p style={{ fontSize: '11px', color: 'var(--color-gold-light)', fontWeight: 600, overflowWrap: 'anywhere' }}>
                {currentStep.route}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {currentStep.tasks.map((task, idx) => (
              <div
                key={idx}
                role="checkbox"
                aria-checked={task.is_checked}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    updateStep(currentStepIndex, 'tasks', (prevTasks: Task[]) => {
                      const next = [...prevTasks];
                      next[idx] = { ...next[idx], is_checked: !next[idx].is_checked };
                      return next;
                    });
                  }
                }}
                onClick={() => {
                  updateStep(currentStepIndex, 'tasks', (prevTasks: Task[]) => {
                    const next = [...prevTasks];
                    next[idx] = { ...next[idx], is_checked: !next[idx].is_checked };
                    return next;
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '3px',
                  backgroundColor: task.is_checked ? 'var(--color-set-bg)' : 'var(--color-stone)',
                  border: task.is_checked ? '1px solid var(--color-set-border)' : '1px solid var(--color-gold-subtle)'
                }}
              >
                <div
                  style={{
                    marginTop: '2px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '2px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: task.is_checked ? 'var(--color-set-green)' : 'var(--color-slot-bg)',
                    border: task.is_checked ? '1px solid var(--color-set-green)' : '1px solid var(--color-gold-dark)',
                    color: 'var(--color-obsidian-solid)',
                    fontSize: '10px',
                    fontWeight: 900
                  }}
                >
                  {task.is_checked ? '✓' : ''}
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    color: task.is_checked ? 'var(--color-muted)' : 'var(--color-gold-light)',
                    textDecoration: task.is_checked ? 'line-through' : 'none',
                    overflowWrap: 'anywhere',
                    minWidth: 0
                  }}
                >
                  {task.text}
                </p>
              </div>
            ))}
            {currentStep.tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--color-muted)', fontSize: '11px' }}>
                등록된 체크리스트 목표가 없습니다.
              </div>
            )}
          </div>

          {currentStep.note && (
            <div style={{ padding: '7px 10px', backgroundColor: 'var(--color-stone)', borderLeft: '2px solid var(--color-gold)', borderRadius: '0 3px 3px 0' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-beige)', overflowWrap: 'anywhere' }}>{currentStep.note}</p>
            </div>
          )}

          {currentStep.strategic_tip && (
            <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-magic-bg)', border: '1px solid var(--color-magic-border)', borderRadius: '3px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-magic-blue)', marginBottom: '3px' }}>
                성역 전술 조언
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-gold-light)', overflowWrap: 'anywhere' }}>
                {currentStep.strategic_tip}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. HORADRIC TOME (RUNEWORDS & CUBING) PANEL */}
      {isRunewordOpen && (
        <div
          className="d2r-panel"
          style={{
            left: runewordPos.x / uiScale,
            top: runewordPos.y / uiScale,
            width: `${runewordSize.width}px`,
            height: `${runewordSize.height}px`,
            zIndex: 51
          }}
        >
          <div className="d2r-resize-e" onMouseDown={e => handleResize(e, 'width', 'runeword')} />
          <div className="d2r-resize-s" onMouseDown={e => handleResize(e, 'height', 'runeword')} />
          <div className="d2r-resize-se" onMouseDown={e => handleResize(e, 'both', 'runeword')} />

          {/* Header */}
          <div className="d2r-header" onMouseDown={e => handleDrag(e, 'runeword')}>
            <span className="d2r-title">호라드림 비전 사전: 룬워드 및 큐빙</span>
            <button onClick={closePanels} onMouseDown={e => e.stopPropagation()} className="d2r-btn-icon" title="닫기" aria-label="호라드림 사전 닫기">
              <svg aria-hidden="true" width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Primary Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gold-dark)', backgroundColor: 'var(--color-stone)', position: 'relative', zIndex: 2 }}>
            <button
              onClick={() => setEtcTab('runes')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: etcTab === 'runes' ? 'var(--color-stone-active)' : 'var(--color-void)',
                color: etcTab === 'runes' ? 'var(--color-gold-light)' : 'var(--color-muted)',
                border: 'none',
                borderBottom: etcTab === 'runes' ? '2px solid var(--color-gold)' : '2px solid var(--color-void)'
              }}
            >
              룬어 사전 ({filteredRunewords.length})
            </button>
            <button
              onClick={() => setEtcTab('cubing')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: etcTab === 'cubing' ? 'var(--color-stone-active)' : 'var(--color-void)',
                color: etcTab === 'cubing' ? 'var(--color-gold-light)' : 'var(--color-muted)',
                border: 'none',
                borderBottom: etcTab === 'cubing' ? '2px solid var(--color-rune-orange)' : '2px solid var(--color-void)'
              }}
            >
              호라드림의 함 큐빙 ({filteredCubing.length})
            </button>
          </div>

          {/* Search & Filters */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gold-subtle)', backgroundColor: 'var(--color-stone)', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="d2r-input"
                placeholder="룬어 이름, 영문명, 룬(샤엘/베르), 장비(폴암/투구), 옵션 검색"
                value={searchRune}
                onChange={e => setSearchRune(e.target.value)}
                aria-label="룬워드 및 큐빙 검색"
              />
              {searchRune && (
                <button onClick={() => setSearchRune('')} className="d2r-btn">초기화</button>
              )}
            </div>

            {etcTab === 'runes' ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                  {['all', '2', '3', '4', '5', '6'].map(sock => (
                    <button
                      key={sock}
                      onClick={() => setSocketFilter(sock)}
                      className={`d2r-btn ${socketFilter === sock ? 'd2r-btn-gold' : ''}`}
                      style={{ minHeight: '24px', padding: '2px 8px', fontSize: '10px' }}
                    >
                      {sock === 'all' ? '전체 홈' : `${sock}홈`}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowStashBar(!showStashBar)}
                    className={`d2r-btn ${showStashBar || ownedRunes.length > 0 ? 'd2r-btn-gold' : ''}`}
                    style={{ minHeight: '24px', padding: '2px 8px', fontSize: '10px', marginLeft: 'auto' }}
                  >
                    보유 룬 선택 ({ownedRunes.length})
                  </button>
                </div>

                {showStashBar && (
                  <div style={{ padding: '6px', backgroundColor: 'var(--color-slot-bg)', border: '1px solid var(--color-gold-subtle)', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-gold)' }}>내 보관함 보유 룬 클릭 (클릭 시 조합 가능 여부 표시)</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => setCraftableOnly(!craftableOnly)}
                          className={`d2r-btn ${craftableOnly ? 'd2r-btn-gold' : ''}`}
                          style={{ minHeight: '22px', padding: '1px 6px', fontSize: '10px' }}
                        >
                          {craftableOnly ? '✓ 제작 가능만' : '제작 가능만 보기'}
                        </button>
                        {ownedRunes.length > 0 && (
                          <button
                            onClick={() => { setOwnedRunes([]); setCraftableOnly(false); }}
                            className="d2r-btn d2r-btn-crimson"
                            style={{ minHeight: '22px', padding: '1px 6px', fontSize: '10px' }}
                          >
                            비우기
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {ORDERED_RUNES.map((rn, idx) => {
                        const isOwned = ownedRunes.includes(rn);
                        return (
                          <button
                            key={rn}
                            onClick={() => toggleOwnedRune(rn)}
                            className={`d2r-rune-slot ${isOwned ? 'owned' : ''}`}
                            style={{ padding: '2px 4px', minWidth: '34px' }}
                            title={`#${idx + 1} ${rn} 룬`}
                          >
                            {getRuneImageUrl(rn) && (
                              <img src={getRuneImageUrl(rn)!} alt={rn} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            )}
                            <span style={{ fontSize: '9px', color: isOwned ? 'var(--color-rune-orange)' : 'var(--color-beige)', fontWeight: 700 }}>
                              {rn}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {cubeCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCubeCategoryFilter(cat)}
                    className={`d2r-btn ${cubeCategoryFilter === cat ? 'd2r-btn-gold' : ''}`}
                    style={{ minHeight: '24px', padding: '2px 7px', fontSize: '10px' }}
                  >
                    {cat === 'all' ? '전체 분류' : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List Content */}
          <div className="d2r-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: 2 }}>
            {etcTab === 'runes' ? (
              filteredRunewords.map((r, i) => {
                const key = `${r.name}-${i}`;
                const isExpanded = !!expandedRunewords[key];
                const visibleStats = isExpanded ? r.stats : r.stats.slice(0, 6);
                const craftable = canCraftRuneword(r);

                return (
                  <div
                    key={key}
                    className="d2r-card"
                    style={{
                      borderColor: craftable ? 'var(--color-set-border)' : 'var(--color-gold-subtle)',
                      cursor: r.stats.length > 6 ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (r.stats.length > 6) {
                        setExpandedRunewords(prev => ({ ...prev, [key]: !prev[key] }));
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <h3 className="d2r-title" style={{ fontSize: '14px', color: 'var(--color-gold)' }}>{r.name}</h3>
                          <span style={{ fontSize: '11px', color: 'var(--color-slate-gold)' }}>{r.original_name}</span>
                          {craftable && (
                            <span className="d2r-badge" style={{ backgroundColor: 'var(--color-set-bg)', borderColor: 'var(--color-set-border)', color: 'var(--color-set-green)' }}>
                              제작 가능
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-beige)', marginTop: '2px' }}>
                          {r.item_types.join(', ')}
                        </div>
                      </div>
                      <span className="d2r-badge d2r-num">요구 레벨 {r.level}</span>
                    </div>

                    {/* Rune Sequence */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                      {r.runes.map((rn, ri) => {
                        const hasRune = ownedRunes.includes(rn);
                        return (
                          <div
                            key={ri}
                            className={`d2r-rune-slot ${hasRune ? 'owned' : ''}`}
                            onClick={e => { e.stopPropagation(); toggleOwnedRune(rn); }}
                            title={`${rn} 룬 (클릭 시 보유 토글)`}
                          >
                            {getRuneImageUrl(rn) && (
                              <img src={getRuneImageUrl(rn)!} alt={rn} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                            )}
                            <span style={{ fontSize: '10px', fontWeight: 700, color: hasRune ? 'var(--color-rune-orange)' : 'var(--color-gold-light)' }}>
                              {rn}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: 'var(--color-magic-blue)' }}>
                      {visibleStats.map((st, si) => (
                        <div key={si} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--color-gold)' }}>•</span>
                          <span style={{ overflowWrap: 'anywhere', color: st.includes('변함') ? 'var(--color-gold-light)' : 'var(--color-magic-blue)' }}>{st}</span>
                        </div>
                      ))}
                      {r.stats.length > 6 && (
                        <div style={{ fontSize: '10px', color: 'var(--color-gold)', marginTop: '3px', fontWeight: 600 }}>
                          {isExpanded ? '▲ 옵션 접기' : `▼ 외 +${r.stats.length - 6}개 옵션 전체 보기`}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--color-gold-subtle)', fontSize: '10px', color: 'var(--color-rune-orange)' }}>
                      {r.material_sources}
                    </div>
                  </div>
                );
              })
            ) : (
              filteredCubing.map((c, i) => (
                <div key={i} className="d2r-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <h3 className="d2r-title" style={{ fontSize: '12px', color: 'var(--color-gold)' }}>{c.name}</h3>
                    <span className="d2r-badge">{c.category}</span>
                  </div>

                  <div style={{ padding: '7px 9px', backgroundColor: 'var(--color-slot-bg)', border: '1px solid var(--color-gold-subtle)', borderRadius: '3px', marginBottom: '6px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--color-gold-light)', fontWeight: 600 }}>조합식: {c.recipe}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                      {c.recipe.split('+').map((part, idx) => {
                        const clean = part.trim().replace(/\s*룬$/, '');
                        const icon = getItemImageUrl(clean) || getItemImageUrl(part.trim());
                        return icon ? (
                          <div key={idx} className="d2r-rune-slot" style={{ cursor: 'default' }} title={part.trim()}>
                            <img src={icon} alt={part.trim()} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            <span style={{ fontSize: '9px', color: 'var(--color-beige)' }}>{part.trim()}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: 'var(--color-set-green)', fontWeight: 900, fontSize: '12px' }}>⇒</span>
                    <p style={{ fontSize: '11px', color: 'var(--color-set-green)', fontWeight: 700, overflowWrap: 'anywhere' }}>
                      결과: {c.result}
                    </p>
                  </div>

                  {c.description && (
                    <p style={{ marginTop: '5px', fontSize: '10px', color: 'var(--color-muted)', overflowWrap: 'anywhere' }}>
                      {c.description}
                    </p>
                  )}
                </div>
              ))
            )}

            {((etcTab === 'runes' && filteredRunewords.length === 0) || (etcTab === 'cubing' && filteredCubing.length === 0)) && (
              <div style={{ padding: '40px 16px', textAlign: 'center', border: '1px dashed var(--color-gold-subtle)', borderRadius: '4px', color: 'var(--color-muted)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-gold)', fontWeight: 700, marginBottom: '4px' }}>조건에 맞는 항목이 없습니다</div>
                <div style={{ fontSize: '11px', marginBottom: '10px' }}>검색어나 홈/보유 룬 필터를 초기화해 보세요.</div>
                <button
                  onClick={() => { setSearchRune(''); setSocketFilter('all'); setCraftableOnly(false); setCubeCategoryFilter('all'); }}
                  className="d2r-btn d2r-btn-gold"
                >
                  필터 전체 초기화
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. SETTINGS PANEL */}
      {showSettings && (
        <div
          className="d2r-panel"
          style={{
            left: settingsPos.x / uiScale,
            top: settingsPos.y / uiScale,
            width: `${settingsSize.width}px`,
            zIndex: 100
          }}
        >
          <div className="d2r-Header d2r-header" onMouseDown={e => handleDrag(e, 'settings')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="d2r-title">성역 HUD 환경 설정</span>
              <span className="d2r-badge d2r-num">v{APP_VERSION}</span>
            </div>
            <button onClick={() => setShowSettings(false)} onMouseDown={e => e.stopPropagation()} className="d2r-btn-icon" title="닫기" aria-label="환경 설정 닫기">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="d2r-scroll" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '72vh', overflowY: 'auto', position: 'relative', zIndex: 2 }}>
            {/* Data Reset */}
            <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--color-gold-subtle)' }}>
              <button onClick={resetToDefault} className="d2r-btn d2r-btn-crimson" style={{ width: '100%' }}>
                기본 퀘스트 가이드로 초기화
              </button>
              <p style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '4px' }}>
                진행 체크 상태를 초기 상태로 되돌립니다 (저장된 커스텀 가이드는 유지).
              </p>
            </div>

            {/* Toggle Hotkey */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, marginBottom: '4px' }}>
                HUD 표시 / 숨기기 단축키
              </label>
              <button
                onClick={() => setIsRecording(true)}
                className={`d2r-btn d2r-num ${isRecording ? 'd2r-btn-crimson' : ''}`}
                style={{ width: '100%', padding: '8px 12px' }}
              >
                {isRecording ? '원하는 키 조합을 누르세요…' : toggleHotkey}
              </button>
              <p style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '4px' }}>
                모서리 스냅: Ctrl+F9~F12 / 모니터 전환: Ctrl+F8 / 단계 이동: Ctrl+←,→
              </p>
            </div>

            {/* UI Scale */}
            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--color-gold-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600 }}>UI 배율 조절</span>
                <span className="d2r-num" style={{ fontSize: '11px', color: 'var(--color-gold-light)', fontWeight: 700 }}>{Math.round(uiScale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.85"
                max="1.5"
                step="0.05"
                value={uiScale}
                onChange={e => setUiScale(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-gold)', cursor: 'pointer', pointerEvents: 'auto' }}
                aria-label="UI 배율 조절"
              />
            </div>

            {/* Monitor Selection */}
            {displays.length > 0 && (
              <div style={{ paddingTop: '10px', borderTop: '1px solid var(--color-gold-subtle)' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, marginBottom: '4px' }}>
                  표시 모니터 선택
                </label>
                <select
                  className="d2r-select"
                  aria-label="표시 모니터 선택"
                  value={selectedMonitorId || (displays[0]?.id?.toString() || '')}
                  onChange={e => {
                    const monitorId = e.target.value;
                    const monitor = displays.find(d => d.id.toString() === monitorId);
                    if (monitor) {
                      setSelectedMonitorId(monitorId);
                      ipcSend('move-to-monitor', monitorId);
                      const moveUI = (size: { width: number; height: number }) => ({
                        x: Math.max(16, (monitor.bounds.width - size.width * uiScale) / 2),
                        y: Math.max(16, (monitor.bounds.height - size.height * uiScale) / 2)
                      });
                      setHudPos({ x: Math.max(16, monitor.bounds.width - hudSize.width * uiScale - 32), y: 32 });
                      setEditorPos(moveUI(editorSize));
                      setRunewordPos(moveUI(runewordSize));
                      setSettingsPos(moveUI(settingsSize));
                    }
                  }}
                >
                  {displays.map((d, i) => (
                    <option key={d.id} value={d.id.toString()}>
                      모니터 {i + 1} ({d.bounds.width}×{d.bounds.height}) {d.isPrimary ? '[주 모니터]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Auto-Hide Pixel Checker */}
            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--color-gold-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600 }}>인게임 픽셀 자동 숨김</span>
                <button
                  onClick={() => setAutoHide(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`d2r-btn ${autoHide.enabled ? 'd2r-btn-gold' : ''}`}
                  style={{ minHeight: '22px', padding: '2px 8px', fontSize: '10px' }}
                >
                  {autoHide.enabled ? '감지 켜짐' : '감지 꺼짐'}
                </button>
              </div>

              <div style={{ padding: '8px', backgroundColor: 'var(--color-stone)', border: '1px solid var(--color-gold-subtle)', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--color-beige)' }}>
                  <span>감지 좌표</span>
                  <span className="d2r-num">X: {autoHide.x}, Y: {autoHide.y} ({autoHide.targetColor})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '3px',
                      border: '1px solid var(--color-gold)',
                      backgroundColor: autoHide.targetColor,
                      flexShrink: 0
                    }}
                    title={autoHide.targetColor}
                  />
                  <button
                    onClick={startCalibration}
                    disabled={isCalibrating}
                    className="d2r-btn"
                    style={{ flex: 1 }}
                  >
                    {isCalibrating ? `${countdown}초 뒤 마우스 위치 캡처…` : '마우스 위치 픽셀 캡처 (3초)'}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>감지 주기 (ms)</span>
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    step="100"
                    value={autoHide.interval}
                    onChange={e => setAutoHide(prev => ({ ...prev, interval: parseInt(e.target.value, 10) || 500 }))}
                    className="d2r-input d2r-num"
                    style={{ width: '90px', padding: '3px 6px', fontSize: '11px' }}
                    aria-label="감지 주기 밀리초"
                  />
                </div>
              </div>
            </div>

            {/* Update Check Section */}
            {(window as any).require && (
              <div style={{ paddingTop: '10px', borderTop: '1px solid var(--color-gold-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600 }}>버전 및 릴리스 확인</span>
                  <button
                    onClick={async () => {
                      setUpdateStatus('checking');
                      setUpdateInfo(null);
                      try {
                        const { ipcRenderer } = (window as any).require('electron');
                        ipcRenderer.removeAllListeners('update-download-progress');
                        ipcRenderer.on('update-download-progress', (_: any, data: any) => {
                          if (typeof data === 'number') setDownloadProgress(data);
                          else if (data && typeof data.percent === 'number') {
                            setDownloadProgress(data.percent);
                            if (data.status === 'error') {
                              setUpdateStatus('error');
                              setUpdateInfo((prev: any) => ({ ...prev, error: data.message }));
                            }
                          }
                        });
                        const info = await ipcRenderer.invoke('check-update');
                        setUpdateInfo(info);
                        setUpdateStatus(info.hasUpdate ? 'available' : 'up-to-date');
                      } catch (e: any) {
                        setUpdateInfo({ error: e.message });
                        setUpdateStatus('error');
                      }
                    }}
                    className="d2r-btn"
                    style={{ minHeight: '22px', padding: '2px 8px', fontSize: '10px' }}
                  >
                    릴리스 확인
                  </button>
                </div>
                {updateStatus === 'checking' && <p style={{ fontSize: '10px', color: 'var(--color-muted)' }}>GitHub 릴리스 확인 중…</p>}
                {updateStatus === 'up-to-date' && <p style={{ fontSize: '10px', color: 'var(--color-set-green)' }}>✓ 최신 자체 내장 버전입니다 (v{APP_VERSION})</p>}
                {updateStatus === 'error' && <p style={{ fontSize: '10px', color: 'var(--color-crimson)' }}>안내: {updateInfo?.error}</p>}
                {updateStatus === 'available' && updateInfo && (
                  <div style={{ padding: '8px', backgroundColor: 'var(--color-stone)', border: '1px solid var(--color-gold-subtle)', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-gold-light)', fontWeight: 700 }}>{updateInfo.releaseName} 다운로드 가능</div>
                    {updateInfo.downloadUrl && (
                      <button
                        onClick={async () => {
                          setUpdateStatus('downloading');
                          setDownloadProgress(0);
                          try {
                            const { ipcRenderer } = (window as any).require('electron');
                            await ipcRenderer.invoke('download-and-install-update', {
                              downloadUrl: updateInfo.downloadUrl,
                              fileName: updateInfo.fileName || 'D2R-HUD-Update.zip'
                            });
                            setUpdateStatus('up-to-date');
                          } catch (e: any) {
                            setUpdateInfo({ error: e.message });
                            setUpdateStatus('error');
                          }
                        }}
                        className="d2r-btn d2r-btn-gold"
                      >
                        패키지 다운로드 ({downloadProgress}%)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="d2r-toast" role="status" aria-live="polite">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-gold)' }} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
