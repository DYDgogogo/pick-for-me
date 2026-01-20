import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SpinWheel from './components/SpinWheel';
import OptionEditor from './components/OptionEditor';

// Presets - 快捷模板系统（基于中国用户高频使用场景）
const PRESETS = [
  // 高频决策场景（Top 3）
  { name: '吃什么', options: ['火锅', '烧烤', '日料', '外卖', '自己做'] },
  { name: '去哪玩', options: ['电影院', '健身房', '公园', '居家', '逛街'] },
  { name: '谁买单', options: ['我', '你', 'AA制', '下次我请'] },
  
  // 通用决策场景
  { name: '是或否', options: ['是', '否'] },
  { name: '选A还是B', options: ['选A', '选B'] },
  { name: '石头剪刀布', options: ['石头', '剪刀', '布'] },
  
  // 生活场景
  { name: '今天穿什么', options: ['休闲', '正式', '运动', '随意'] },
  { name: '喝什么', options: ['咖啡', '奶茶', '果汁', '水'] },
  { name: '看什么', options: ['电影', '电视剧', '综艺', '短视频'] },
];

// 微信小程序 API 类型声明
declare const wx: {
  getStorageSync?: (key: string) => any;
  setStorageSync?: (key: string, data: any) => void;
  removeStorageSync?: (key: string) => void;
} | undefined;

interface HistoryItem {
  options: string[];
  result: string;
  index: number;
  sceneName?: string;
  createdAt: number;
}

interface CustomSceneNames {
  [optionsKey: string]: string; // optionsKey = JSON.stringify(options)
}

interface HistoryHighlight {
  options: string[];
  index: number;
  requestId: number;
}

// Load options from localStorage or WeChat Mini Program storage
const loadOptions = (): string[] => {
  try {
    // 微信小程序环境
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const saved = wx.getStorageSync('decision-options');
      if (saved && Array.isArray(saved)) return saved;
    } else {
      // Web 环境
      const saved = localStorage.getItem('decision-options');
      if (saved) return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load options:', e);
  }
  return ['是', '否'];
};

// Save options to localStorage or WeChat Mini Program storage
const saveOptions = (options: string[]) => {
  try {
    // 微信小程序环境
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync('decision-options', options);
    } else {
      // Web 环境
      localStorage.setItem('decision-options', JSON.stringify(options));
    }
  } catch (e) {
    console.error('Failed to save options:', e);
  }
};

// Load recent presets from localStorage or WeChat Mini Program storage
const loadRecentPresets = (): string[][] => {
  try {
    // 微信小程序环境
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const saved = wx.getStorageSync('decision_presets');
      if (saved && Array.isArray(saved)) return saved;
    } else {
      // Web 环境
      const saved = localStorage.getItem('decision_presets');
      if (saved) return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load recent presets:', e);
  }
  return [];
};

// Save recent presets to localStorage or WeChat Mini Program storage
const saveRecentPresets = (presets: string[][]) => {
  try {
    // 微信小程序环境
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync('decision_presets', presets);
    } else {
      // Web 环境
      localStorage.setItem('decision_presets', JSON.stringify(presets));
    }
  } catch (e) {
    console.error('Failed to save recent presets:', e);
  }
};

// Load recent history from localStorage or WeChat Mini Program storage
const loadHistory = (): HistoryItem[] => {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const saved = wx.getStorageSync('decision_history');
      if (saved && Array.isArray(saved)) return saved;
    } else {
      const saved = localStorage.getItem('decision_history');
      if (saved) return JSON.parse(saved) as HistoryItem[];
    }
  } catch (e) {
    console.error('Failed to load decision history:', e);
  }
  return [];
};

// Save recent history to localStorage or WeChat Mini Program storage
const saveHistory = (history: HistoryItem[]) => {
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync('decision_history', history);
    } else {
      localStorage.setItem('decision_history', JSON.stringify(history));
    }
  } catch (e) {
    console.error('Failed to save decision history:', e);
  }
};

// Load custom scene names from localStorage or WeChat Mini Program storage
const loadCustomSceneNames = (): CustomSceneNames => {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const saved = wx.getStorageSync('custom_scene_names');
      if (saved && typeof saved === 'object') return saved;
    } else {
      const saved = localStorage.getItem('custom_scene_names');
      if (saved) return JSON.parse(saved) as CustomSceneNames;
    }
  } catch (e) {
    console.error('Failed to load custom scene names:', e);
  }
  return {};
};

// Save custom scene names to localStorage or WeChat Mini Program storage
const saveCustomSceneNames = (names: CustomSceneNames) => {
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync('custom_scene_names', names);
    } else {
      localStorage.setItem('custom_scene_names', JSON.stringify(names));
    }
  } catch (e) {
    console.error('Failed to save custom scene names:', e);
  }
};

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return '刚刚';
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  return `${day} 天前`;
};

// Add or update a preset in the recent presets list
const addRecentPreset = (options: string[]): string[][] => {
  const presets = loadRecentPresets();
  
  // Check if identical array already exists
  const existingIndex = presets.findIndex(
    preset => JSON.stringify(preset) === JSON.stringify(options)
  );
  
  let updatedPresets: string[][];
  
  if (existingIndex !== -1) {
    // Move existing preset to front (Most Recently Used)
    updatedPresets = [
      presets[existingIndex],
      ...presets.slice(0, existingIndex),
      ...presets.slice(existingIndex + 1)
    ];
  } else {
    // Add new preset to front
    updatedPresets = [options, ...presets];
  }
  
  // Limit to top 5 unique combinations
  updatedPresets = updatedPresets.slice(0, 5);
  
  saveRecentPresets(updatedPresets);
  return updatedPresets;
};

export default function App() {
  const [options, setOptions] = useState<string[]>(loadOptions);
  const [optionsHistory, setOptionsHistory] = useState<string[][]>([]);
  const [recentPresets, setRecentPresets] = useState<string[][]>(loadRecentPresets);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [historyHighlight, setHistoryHighlight] = useState<HistoryHighlight | null>(null);
  const [sceneHint, setSceneHint] = useState<string | null>(null);
  const [customSceneNames, setCustomSceneNames] = useState<CustomSceneNames>(loadCustomSceneNames);
  const [editingSceneName, setEditingSceneName] = useState<{ optionsKey: string; currentName: string } | null>(null);
  
  // Responsive viewport detection for small screens
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 375
  );
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateViewport = () => setViewportWidth(window.innerWidth);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);
  
  const isSmallScreen = viewportWidth <= 375;
  const isVerySmallScreen = viewportWidth <= 320;
  
  // Check if user is new (no history and default options)
  const isNewUser = history.length === 0 && 
    options.length === 2 && 
    options[0] === '是' && 
    options[1] === '否';
  
  // Show guide for new users (can be dismissed)
  const [showGuide, setShowGuide] = useState(isNewUser);
  
  // Auto-hide guide when user starts interacting
  useEffect(() => {
    if (showGuide && (options.length !== 2 || options[0] !== '是' || options[1] !== '否')) {
      setShowGuide(false);
    }
  }, [options, showGuide]);

  // Auto-hide scene hint after a short duration
  useEffect(() => {
    if (!sceneHint) return;
    const timer = setTimeout(() => {
      setSceneHint(null);
    }, 800);
    return () => clearTimeout(timer);
  }, [sceneHint]);

  useEffect(() => {
    saveOptions(options);
  }, [options]);

  // Handle spin start - save current options as recent preset
  const handleSpinStart = () => {
    const updatedPresets = addRecentPreset(options);
    setRecentPresets(updatedPresets);
    // Hide guide when user starts spinning
    if (showGuide) {
      setShowGuide(false);
    }
  };

  // Apply options with optional history tracking
  const applyOptions = (next: string[], trackHistory: boolean = true) => {
    try {
      // Defensive check: ensure next is a valid array
      if (!Array.isArray(next) || next.length === 0) {
        console.error('Invalid options array:', next);
        return;
      }
      
      setOptions((prev) => {
        // Prevent unnecessary updates if options haven't changed
        if (JSON.stringify(prev) === JSON.stringify(next)) {
          return prev;
        }
        
        if (trackHistory) {
          setOptionsHistory((stack) => [...stack, prev]);
        }
        return next;
      });
    } catch (error) {
      console.error('Error in applyOptions:', error);
      // Prevent crash by not updating state on error
    }
  };

  const canUndo = optionsHistory.length > 0;

  const undoLastOptionsChange = () => {
    setOptionsHistory((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setOptions(previous);
      return stack.slice(0, -1);
    });
  };

  // Handle preset click - apply preset to current options
  const handlePresetClick = (preset: string[]) => {
    applyOptions(preset);
  };

  // Get scene name for options (priority: custom name > preset name > undefined)
  const getSceneName = (opts: string[]): string | undefined => {
    const optionsKey = JSON.stringify(opts);
    // 1. Check custom scene names first
    if (customSceneNames[optionsKey]) {
      return customSceneNames[optionsKey];
    }
    // 2. Check presets
    const matchedPreset = PRESETS.find(
      (preset) =>
        preset.options.length === opts.length &&
        preset.options.every((opt, i) => opt === opts[i])
    );
    return matchedPreset?.name;
  };

  // Save custom scene name
  const saveCustomSceneName = (optionsKey: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return; // Don't save empty names

    const updated = { ...customSceneNames, [optionsKey]: trimmedName };
    setCustomSceneNames(updated);
    saveCustomSceneNames(updated);

    // Update all history items with the same options
    setHistory((prev) => {
      const updatedHistory = prev.map((item) => {
        const itemKey = JSON.stringify(item.options);
        if (itemKey === optionsKey) {
          return { ...item, sceneName: trimmedName };
        }
        return item;
      });
      saveHistory(updatedHistory);
      return updatedHistory;
    });

    setEditingSceneName(null);
  };

  // Delete custom scene name
  const deleteCustomSceneName = (optionsKey: string) => {
    const updated = { ...customSceneNames };
    delete updated[optionsKey];
    setCustomSceneNames(updated);
    saveCustomSceneNames(updated);

    // Update history items to use preset name or undefined
    setHistory((prev) => {
      const updatedHistory = prev.map((item) => {
        const itemKey = JSON.stringify(item.options);
        if (itemKey === optionsKey) {
          const presetName = PRESETS.find(
            (preset) =>
              preset.options.length === item.options.length &&
              preset.options.every((opt, i) => opt === item.options[i])
          )?.name;
          return { ...item, sceneName: presetName };
        }
        return item;
      });
      saveHistory(updatedHistory);
      return updatedHistory;
    });

    setEditingSceneName(null);
  };

  const handleResult = (result: string, index: number) => {
    const sceneName = getSceneName(options);

    const item: HistoryItem = {
      options: [...options],
      result,
      index,
      sceneName,
      createdAt: Date.now(),
    };

    setHistory((prev) => {
      const filtered = prev.filter(
        (h) =>
          !(h.result === item.result &&
            h.sceneName === item.sceneName &&
            JSON.stringify(h.options) === JSON.stringify(item.options))
      );
      const next = [item, ...filtered].slice(0, 5);
      saveHistory(next);
      return next;
    });
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center"
      style={{
        paddingLeft: isVerySmallScreen ? '12px' : isSmallScreen ? '16px' : '24px',
        paddingRight: isVerySmallScreen ? '12px' : isSmallScreen ? '16px' : '24px',
        paddingTop: isVerySmallScreen ? '40px' : isSmallScreen ? '48px' : '60px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif',
        // Light industrial canvas (cool, metallic, low-contrast)
        background: `radial-gradient(1200px 600px at 50% 0%,
          rgba(255, 255, 255, 0.9) 0%,
          rgba(240, 243, 248, 0.9) 45%,
          rgba(228, 233, 242, 1) 100%),
          linear-gradient(to bottom, #F6F8FB, #E9EEF6)`,
      }}
    >
      {/* Header - Apple iPhone Landing Page Typography */}
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="text-center w-full"
        style={{ marginBottom: isVerySmallScreen ? '32px' : isSmallScreen ? '40px' : '60px' }}
      >
        {/* Main Title - Refined */}
        <h1 
          style={{ 
            fontSize: 'clamp(42px, 7vw, 48px)',
            fontWeight: 400,
            color: '#1d1d1f',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            marginBottom: '14px',
          }}
        >
          帮我选
        </h1>
        
        {/* Subtitle - Enhanced Contrast */}
        <p 
          style={{ 
            fontSize: '18px',
            fontWeight: 400,
            color: 'rgba(29, 29, 31, 0.72)',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}
        >
          不再纠结，马上开转
        </p>

        {/* Scene hint when restoring from history */}
        <AnimatePresence>
          {sceneHint && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                marginTop: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '0.5px solid rgba(255, 255, 255, 0.9)',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                fontSize: '13px',
                color: 'rgba(15, 23, 42, 0.8)',
                letterSpacing: '-0.01em',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '999px',
                  background: 'rgba(56, 189, 248, 0.9)',
                  boxShadow: '0 0 0 4px rgba(56, 189, 248, 0.18)',
                }}
              />
              <span>{sceneHint}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Main Content - Roulette Wheel */}
      <motion.main
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center w-full max-w-lg"
      >
        <SpinWheel 
          options={options} 
          onResult={handleResult} 
          onSpinStart={handleSpinStart}
          recentPresets={recentPresets}
          onPresetClick={handlePresetClick}
          historyHighlight={historyHighlight}
        />

        {/* Recent history strip - light glass capsules */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ marginTop: isVerySmallScreen ? '12px' : isSmallScreen ? '16px' : '20px', width: '100%' }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                fontSize: isVerySmallScreen ? '11px' : '12px',
                color: 'rgba(15, 23, 42, 0.45)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              最近使用
            </div>
            {/* Glass base strip for recent history */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.6)',
                border: '0.5px solid rgba(255, 255, 255, 0.85)',
                boxShadow:
                  '0 12px 26px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                padding: '4px 8px',
                boxSizing: 'border-box',
              }}
            >
              {history.length > 0 ? (
                <div
                  className="hide-scrollbar"
                  style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: '10px',
                    padding: '4px 0',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {history.map((item, idx) => {
                    const optionsKey = JSON.stringify(item.options);
                    const displaySceneName = getSceneName(item.options) || '自定义场景';
                    
                    return (
                      <div
                        key={`${item.createdAt}-${idx}`}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setOptions(item.options);
                            setHistoryHighlight({
                              options: item.options,
                              index: item.index,
                              requestId: Date.now(),
                            });
                            setSceneHint(`已切换到「${displaySceneName}」场景`);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            padding: isVerySmallScreen ? '5px 10px' : isSmallScreen ? '5px 12px' : '6px 14px',
                            borderRadius: '999px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            minWidth: isVerySmallScreen ? '110px' : isSmallScreen ? '120px' : '135px',
                            maxWidth: isVerySmallScreen ? '160px' : isSmallScreen ? '180px' : '200px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontSize: isVerySmallScreen ? '10px' : '11px',
                              color: 'rgba(15, 23, 42, 0.48)',
                              marginBottom: '1px',
                              letterSpacing: '0.03em',
                            }}
                          >
                            {displaySceneName}
                          </div>
                      <div
                        style={{
                          fontSize: isVerySmallScreen ? '13px' : isSmallScreen ? '14px' : '15px',
                          fontWeight: 550,
                          color: '#1f2933',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          whiteSpace: 'normal',
                          maxWidth: '100%',
                        }}
                      >
                        {item.result}
                      </div>
                      <div
                        style={{
                          fontSize: isVerySmallScreen ? '10px' : '11px',
                          color: 'rgba(15, 23, 42, 0.45)',
                          marginTop: '1px',
                        }}
                      >
                        {formatRelativeTime(item.createdAt)}
                      </div>
                    </motion.button>
                    {/* Edit Scene Name Button */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSceneName({
                          optionsKey,
                          currentName: displaySceneName,
                        });
                      }}
                      style={{
                        flexShrink: 0,
                        width: isVerySmallScreen ? '20px' : '22px',
                        height: isVerySmallScreen ? '20px' : '22px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(15, 23, 42, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      title="编辑场景名称"
                    >
                      <svg
                        width={isVerySmallScreen ? '10' : '11'}
                        height={isVerySmallScreen ? '10' : '11'}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(15, 23, 42, 0.5)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </motion.button>
                  </div>
                  );
                })}
                </div>
              ) : (
                <div
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'rgba(15, 23, 42, 0.5)',
                      fontWeight: 400,
                      letterSpacing: '-0.01em',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    转动几次后会在这里看到历史
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </motion.main>

      {/* Edit Scene Name Modal */}
      <AnimatePresence>
        {editingSceneName && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSceneName(null)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 1000,
              }}
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'calc(100% - 48px)',
                maxWidth: '400px',
                background: '#FFFFFF',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                zIndex: 1001,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#1D1D1F',
                  marginBottom: '16px',
                  letterSpacing: '-0.01em',
                }}
              >
                编辑场景名称
              </h3>
              <input
                type="text"
                autoFocus
                defaultValue={editingSceneName.currentName === '自定义场景' ? '' : editingSceneName.currentName}
                placeholder="输入场景名称..."
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    if (input.value.trim()) {
                      saveCustomSceneName(editingSceneName.optionsKey, input.value);
                    } else {
                      deleteCustomSceneName(editingSceneName.optionsKey);
                    }
                  } else if (e.key === 'Escape') {
                    setEditingSceneName(null);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontWeight: 400,
                  color: '#1D1D1F',
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  letterSpacing: '-0.01em',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '20px',
                  justifyContent: 'flex-end',
                }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      saveCustomSceneName(editingSceneName.optionsKey, input.value);
                    } else {
                      deleteCustomSceneName(editingSceneName.optionsKey);
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#FFFFFF',
                    background: '#007AFF',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}
                >
                  保存
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setEditingSceneName(null)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#1D1D1F',
                    background: 'rgba(0, 0, 0, 0.05)',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}
                >
                  取消
                </motion.button>
              </div>
              {customSceneNames[editingSceneName.optionsKey] && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    deleteCustomSceneName(editingSceneName.optionsKey);
                  }}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 400,
                    color: '#FF3B30',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  删除自定义名称
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Options Editor */}
      <motion.footer
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-lg"
        style={{ marginTop: isVerySmallScreen ? '32px' : isSmallScreen ? '40px' : '48px', marginBottom: isVerySmallScreen ? '24px' : isSmallScreen ? '32px' : '40px' }}
      >
        <OptionEditor 
          options={options} 
          onChange={(next) => {
            // For drag reorder, don't track history (to avoid cluttering undo stack)
            // Check if it's a reorder (same length, same items, different order)
            const isReorder = next.length === options.length && 
              next.every(opt => options.includes(opt)) &&
              JSON.stringify(next) !== JSON.stringify(options);
            applyOptions(next, !isReorder);
          }} 
          presets={PRESETS}
          canUndo={canUndo}
          onUndo={undoLastOptionsChange}
        />
      </motion.footer>
    </div>
  );
}
