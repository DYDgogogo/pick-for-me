import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 微信小程序 API 类型声明
declare const wx: {
  getStorageSync?: (key: string) => any;
  setStorageSync?: (key: string, data: any) => void;
  removeStorageSync?: (key: string) => void;
  vibrateShort?: (options: { type: 'light' | 'medium' | 'heavy' }) => void;
} | undefined;

interface OptionEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
  presets: { name: string; options: string[] }[];
  canUndo?: boolean;
  onUndo?: () => void;
}

export default function OptionEditor({ options, onChange, presets, canUndo = false, onUndo }: OptionEditorProps) {
  const [newOption, setNewOption] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);
  const isProcessingAddRef = useRef(false); // Prevent duplicate add calls
  const presetsScrollRef = useRef<HTMLDivElement | null>(null);
  const presetButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rafIdRef = useRef<number | null>(null);
  const scrollEndTimeoutRef = useRef<number | null>(null);
  const [magnetIndex, setMagnetIndex] = useState<number | null>(null);
  const isApplyingPresetRef = useRef(false); // Prevent concurrent preset applications
  const lastAppliedPresetRef = useRef<string>(''); // Track last applied preset to prevent loops
  
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
  
  // Show only first 3 options by default
  const visibleOptions = options.slice(0, 3);
  const hiddenOptions = options.slice(3);
  const hasMoreOptions = options.length > 3;

  const addOption = () => {
    // Prevent duplicate calls (e.g., from both onBlur and onKeyDown)
    if (isProcessingAddRef.current) {
      return;
    }
    
    try {
      isProcessingAddRef.current = true;
      const trimmedOption = newOption.trim();
      
      // Check if input is empty
      if (!trimmedOption) {
        setIsAddingNew(false);
        setNewOption('');
        isProcessingAddRef.current = false;
        return;
      }
      
      // Check if reached max options
      if (options.length >= 12) {
        showToastMessage('最多只能添加 12 个选项');
        setIsAddingNew(false);
        setNewOption('');
        isProcessingAddRef.current = false;
        return;
      }
      
      // Prevent duplicate options
      if (options.includes(trimmedOption)) {
        showToastMessage('选项已存在');
        setIsAddingNew(false);
        setNewOption('');
        isProcessingAddRef.current = false;
        return;
      }
      
      // Successfully add option
      onChange([...options, trimmedOption]);
      setNewOption('');
      setIsAddingNew(false);
      isProcessingAddRef.current = false;
    } catch (error) {
      console.error('Error in addOption:', error);
      setIsAddingNew(false);
      setNewOption('');
      isProcessingAddRef.current = false;
    }
  };

  const removeOption = (index: number) => {
    try {
      if (options.length > 2 && index >= 0 && index < options.length) {
        onChange(options.filter((_, i) => i !== index));
      }
    } catch (error) {
      console.error('Error in removeOption:', error);
    }
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(options[index]);
  };

  const saveEdit = () => {
    try {
      if (editingIndex !== null && editValue.trim() && editingIndex >= 0 && editingIndex < options.length) {
        const trimmedValue = editValue.trim();
        // Prevent duplicate options (except for the current one being edited)
        if (options.some((opt, idx) => opt === trimmedValue && idx !== editingIndex)) {
          setEditingIndex(null);
          setEditValue('');
          return;
        }
        const newOptions = [...options];
        newOptions[editingIndex] = trimmedValue;
        onChange(newOptions);
      }
      setEditingIndex(null);
      setEditValue('');
    } catch (error) {
      console.error('Error in saveEdit:', error);
      setEditingIndex(null);
      setEditValue('');
    }
  };

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingIndex(null);
    }
  };

  const handleNewKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission or other default behavior
      addOption();
    } else if (e.key === 'Escape') {
      setIsAddingNew(false);
      setNewOption('');
    }
  };

  const startAddNew = () => {
    setIsAddingNew(true);
    setTimeout(() => newInputRef.current?.focus(), 0);
  };

  const cancelAddNew = () => {
    // On blur, if there's text, try to add it automatically (mobile-friendly)
    // This handles the case where user types but doesn't press Enter
    if (newOption.trim()) {
      // Use setTimeout to avoid conflicts with onKeyDown (Enter key)
      // This ensures onKeyDown has priority if user presses Enter
      setTimeout(() => {
        // Double-check we're still in adding mode (might have been closed by onKeyDown)
        if (isAddingNew && !isProcessingAddRef.current) {
          addOption();
        }
      }, 200);
    } else {
      // If empty, just close the input
      setIsAddingNew(false);
      setNewOption('');
    }
  };

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 显示 Toast 提示
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  const applyPreset = useCallback((presetOptions: string[]) => {
    // Prevent concurrent applications
    if (isApplyingPresetRef.current) {
      return;
    }
    
    // Create a unique key for this preset
    const presetKey = JSON.stringify(presetOptions);
    
    // Prevent applying the same preset twice in quick succession (avoid loops)
    if (lastAppliedPresetRef.current === presetKey) {
      return;
    }
    
    isApplyingPresetRef.current = true;
    lastAppliedPresetRef.current = presetKey;
    
    // Clear any pending scroll selection to avoid conflicts
    if (scrollEndTimeoutRef.current !== null) {
      window.clearTimeout(scrollEndTimeoutRef.current);
      scrollEndTimeoutRef.current = null;
    }
    
    // Apply the preset
    onChange(presetOptions);
    showToastMessage('已应用模板');
    
    // Reset flag after a short delay
    setTimeout(() => {
      isApplyingPresetRef.current = false;
    }, 300);
  }, [onChange]);

  const triggerHaptic = useCallback(() => {
    if (typeof wx !== 'undefined' && wx?.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
      return;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }, []);

  const centerPresetChip = useCallback((index: number) => {
    const container = presetsScrollRef.current;
    const btn = presetButtonRefs.current[index];
    if (!container || !btn) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    const btnCenter = btnRect.left + btnRect.width / 2;
    const delta = btnCenter - containerCenter;

    container.scrollTo({
      left: container.scrollLeft + delta,
      behavior: 'smooth',
    });
  }, []);

  // Minimal mono-line icons (SVG). No emoji.
  const getPresetIcon = (presetName: string) => {
    // 20x20, stroke icon, uses currentColor
    const commonProps = {
      width: 16,
      height: 16,
      viewBox: '0 0 24 24',
      fill: 'none' as const,
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      style: { flex: '0 0 auto' },
    };

    // Food (fork + knife)
    if (presetName.includes('吃')) {
      return (
        <svg {...commonProps}>
          <path d="M6 3v8" />
          <path d="M8 3v8" />
          <path d="M10 3v8" />
          <path d="M8 11v10" />
          <path d="M16 3v18" />
          <path d="M16 3c2 1 3 3 3 5s-1 4-3 5" />
        </svg>
      );
    }

    // Location / travel (pin)
    if (presetName.includes('去哪') || presetName.includes('周末')) {
      return (
        <svg {...commonProps}>
          <path d="M12 21s6-5 6-10a6 6 0 0 0-12 0c0 5 6 10 6 10z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    }

    // Pay / card
    if (presetName.includes('买单') || presetName.includes('谁')) {
      return (
        <svg {...commonProps}>
          <rect x="3.5" y="6.5" width="17" height="11" rx="2.2" />
          <path d="M3.5 10h17" />
          <path d="M7.5 14.5h4" />
        </svg>
      );
    }

    // Target / A/B
    if (presetName.includes('选A') || presetName.includes('选B')) {
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 5V3" />
          <path d="M19 12h2" />
        </svg>
      );
    }

    // Rock-paper-scissors (scissors)
    if (presetName.includes('石头') || presetName.includes('剪刀') || presetName.includes('布')) {
      return (
        <svg {...commonProps}>
          <circle cx="7" cy="9" r="2.2" />
          <circle cx="7" cy="15" r="2.2" />
          <path d="M9 10.5l11-7.5" />
          <path d="M9 13.5l11 7.5" />
          <path d="M9.2 12h3.2" />
        </svg>
      );
    }

    // Dice
    if (presetName.includes('1到6') || presetName.includes('到')) {
      return (
        <svg {...commonProps}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <path d="M9 9h0" />
          <path d="M15 15h0" />
          <path d="M15 9h0" />
          <path d="M9 15h0" />
          <path d="M12 12h0" />
        </svg>
      );
    }

    // Default: check
    return (
      <svg {...commonProps}>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  };

  // Optional: track nearest-to-center chip (kept for future, but visuals follow selection only)
  const updateMagnetIndex = useCallback(() => {
    if (!presetsScrollRef.current) return;
    const container = presetsScrollRef.current;
    const buttons = presetButtonRefs.current;
    if (buttons.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;

    let bestIdx: number | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    buttons.forEach((btn, idx) => {
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const bx = rect.left + rect.width / 2;
      const dist = Math.abs(bx - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });

    setMagnetIndex(bestIdx);
  }, []);

  const scheduleMagnetUpdate = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      updateMagnetIndex();
      rafIdRef.current = null;
    });
  }, [updateMagnetIndex]);

  const scheduleScrollEndSelection = useCallback(() => {
    if (scrollEndTimeoutRef.current !== null) {
      window.clearTimeout(scrollEndTimeoutRef.current);
    }
    scrollEndTimeoutRef.current = window.setTimeout(() => {
      scrollEndTimeoutRef.current = null;
      if (!isExpanded) return;
      if (magnetIndex === null) return;
      
      // Don't trigger if a preset is currently being applied
      if (isApplyingPresetRef.current) return;

      const activeIndex = presets.findIndex(
        (preset) =>
          preset.options.length === options.length &&
          preset.options.every((opt, i) => opt === options[i])
      );

      // 如果已经是当前选中，不重复触发
      if (activeIndex === magnetIndex) return;

      const targetPreset = presets[magnetIndex];
      if (!targetPreset) return;

      // 防止在选项正在变化时触发（避免冲突）
      // 检查目标模板是否与当前选项完全不同（完全替换）
      const isCompleteReplacement = targetPreset.options.length !== options.length ||
        !targetPreset.options.every(opt => options.includes(opt));
      
      // 只有在明确是用户滚动选择时才触发（且不是点击触发的）
      // 增加延迟，确保点击事件优先处理
      if ((isCompleteReplacement || activeIndex === -1) && !isApplyingPresetRef.current) {
        triggerHaptic();
        applyPreset(targetPreset.options);
      }
    }, 300); // 增加延迟，确保点击事件优先
  }, [applyPreset, isExpanded, magnetIndex, options, presets, triggerHaptic]);

  useEffect(() => {
    if (!isExpanded) return;
    scheduleMagnetUpdate();

    const onResize = () => scheduleMagnetUpdate();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (scrollEndTimeoutRef.current !== null) {
        window.clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = null;
      }
    };
  }, [isExpanded, scheduleMagnetUpdate]);

  // 保存当前选项到 localStorage 或微信小程序存储
  const saveCurrentOptions = () => {
    try {
      // 微信小程序环境
      if (typeof wx !== 'undefined' && wx.setStorageSync) {
        wx.setStorageSync('decision-options', options);
      } else {
        // Web 环境
        localStorage.setItem('decision-options', JSON.stringify(options));
      }
      showToastMessage('已保存');
    } catch (e) {
      console.error('Failed to save options:', e);
      showToastMessage('保存未成功，请稍后重试');
    }
  };

  // 删除保存的选项（恢复默认）
  const deleteSavedOptions = () => {
    try {
      // 微信小程序环境
      if (typeof wx !== 'undefined' && wx.removeStorageSync) {
        wx.removeStorageSync('decision-options');
      } else {
        // Web 环境
        localStorage.removeItem('decision-options');
      }
      showToastMessage('已清除');
    } catch (e) {
      console.error('Failed to delete options:', e);
      showToastMessage('清除未成功，请稍后重试');
    }
  };


  return (
    <div 
      className="w-full" 
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', // 确保内容居中对齐
      }}
    >
      {/* Options - Simple List (No Drag) */}
      <div
        className="flex flex-col"
        style={{ 
          gap: '0px', // 使用 marginBottom 控制间距
          width: '100%',
          maxWidth: '100%',
          alignItems: 'stretch', // 确保卡片宽度一致
          position: 'relative',
          listStyle: 'none', // 移除列表默认样式（黑点）
          padding: 0, // 移除默认 padding
          margin: 0, // 移除默认 margin
        }}
      >
        {visibleOptions.map((option, visibleIndex) => {
          const actualIndex = visibleIndex; // For first 3 options, index matches
          return (
          <div
            key={`${actualIndex}-${option}`}
            className="relative group"
            style={{
              position: 'relative',
              listStyle: 'none', // 移除列表默认样式（黑点）
              padding: 0, // 移除默认 padding
              margin: 0, // 移除默认 margin
            }}
            onMouseEnter={() => setHoveredIndex(actualIndex)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {editingIndex === actualIndex ? (
              // Edit Mode - Premium Card Design
              <div 
                style={{
                  background: '#FFFFFF',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                  marginBottom: '10px',
                }}
              >
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyPress}
                  onBlur={saveEdit}
                  autoFocus
                  maxLength={20}
                  className="w-full bg-transparent outline-none"
                  style={{ 
                    color: '#1D1D1F', 
                    fontWeight: 500,
                    fontSize: '15px',
                    letterSpacing: '-0.01em',
                    border: 'none',
                    paddingLeft: '20px',
                    textAlign: 'left',
                  }}
                />
              </div>
            ) : (
              // Display Mode - Premium Card Design
              <motion.div 
                className="cursor-pointer"
                style={{
                  background: '#FFFFFF',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '10px', // 柔和的圆角
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', // 极轻微的弥散投影
                  marginBottom: '10px', // 呼吸感间距
                  position: 'relative',
                }}
                onClick={() => startEdit(actualIndex)}
              >
                <div className="flex items-center justify-between">
                  {/* Option Name */}
                  <p 
                    style={{ 
                      color: '#1D1D1F', 
                      fontWeight: 500,
                      fontSize: '15px',
                      letterSpacing: '-0.01em',
                      textAlign: 'left',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      wordBreak: 'break-word',
                    }}
                  >
                    {option || '输入选项...'}
                  </p>
                  
                  {/* Delete button - Trash icon */}
                  {options.length > 2 && (
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOption(actualIndex);
                      }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ 
                        opacity: hoveredIndex === actualIndex ? 1 : 0,
                        scale: hoveredIndex === actualIndex ? 1 : 0.8,
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255, 59, 48, 0.1)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
          );
        })}

        {/* Show More Button - Premium Card Style */}
        {hasMoreOptions && (
          <motion.button
            onClick={() => setShowDrawer(true)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full cursor-pointer transition-all duration-150"
            style={{
              background: '#FFFFFF',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              color: '#0071E3',
              fontSize: '15px',
              fontWeight: 500,
              marginTop: '2px', // 与上方卡片保持间距
            }}
          >
            显示更多 ({hiddenOptions.length} 个选项)
          </motion.button>
        )}

        {/* Add New Option - Premium Card Style */}
        {options.length < 12 && (
          <motion.div
            layout
            className="cursor-pointer transition-all duration-150 flex items-center justify-center"
            style={{
              background: '#FFFFFF',
              border: '1px dashed rgba(0, 0, 0, 0.12)',
              padding: '12px 20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              marginTop: '10px', // 呼吸感间距
            }}
            onClick={!isAddingNew ? startAddNew : undefined}
          >
            {isAddingNew ? (
              <input
                ref={newInputRef}
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={handleNewKeyPress}
                onBlur={cancelAddNew}
                placeholder="输入选项..."
                maxLength={20}
                className="w-full bg-transparent outline-none"
                style={{ 
                  color: '#1D1D1F',
                  fontSize: '15px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  border: 'none',
                  paddingLeft: '20px',
                  textAlign: 'left',
                }}
                autoFocus
              />
            ) : (
              <span 
                style={{ 
                  color: 'rgba(0, 0, 0, 0.25)',
                  fontSize: '20px',
                  fontWeight: 300,
                  lineHeight: 1,
                }}
              >
                +
              </span>
            )}
          </motion.div>
        )}
      </div>

      {/* Floating Dark Glass Control Bar - Apple-Level Unified Control Island */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full"
        style={{
          marginTop: '48px', // 与上方选项列表保持呼吸感间距
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', // SafeArea breathing room
        }}
      >
        {/* Unified Container - Two-layer layout (Control Bar + Presets Menu) */}
        <motion.div
          whileTap={{ scale: 0.98 }} // 整体按压反馈，模拟物理触感
          className="flex flex-col"
          style={{
            width: '100%',
            maxWidth: '100%',
            // Light Glassmorphism (Apple-like acrylic)
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderRadius: '32px', // 胶囊形状
            border: '0.5px solid rgba(255, 255, 255, 0.6)', // 极细白色高光描边
            boxShadow:
              '0 10px 28px rgba(0, 0, 0, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.45)', // soft shadow + top sheen
            padding: isVerySmallScreen 
              ? `12px ${isExpanded ? '16px' : '20px'}` 
              : isSmallScreen 
              ? `12px ${isExpanded ? '20px' : '24px'}` 
              : '12px 32px', // 增加左右 padding，提供更多呼吸感
            paddingBottom: isExpanded ? '16px' : '12px', // 动态底部 padding
            boxSizing: 'border-box',
            cursor: 'default', // 默认光标
          }}
        >
          {/* Top Layer - Control Bar */}
          <div className="flex items-center" style={{ minHeight: '64px' }}>
          {/* Left Section - Presets Toggle */}
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            whileHover={{ 
              opacity: 1,
              textShadow: '0 0 8px rgba(255, 255, 255, 0.25)',
            }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 flex-1 justify-start"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center', // 确保垂直居中
            }}
          >
            <span style={{
              fontSize: isVerySmallScreen ? '12px' : '13px',
              color: '#333333',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              transition: 'all 0.2s ease',
              textShadow: isExpanded ? '0 0 10px rgba(255, 255, 255, 0.35)' : 'none',
            }}>
              快捷模板
            </span>
            <motion.svg
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="#333333"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'stroke 0.2s ease' }}
              />
            </motion.svg>
          </motion.button>

          {/* Vertical Divider - Left */}
          <div
            style={{
              width: '0.5px',
              height: '32px', // 增加高度以适应新的容器高度
              background: 'rgba(0, 0, 0, 0.08)', // subtle divider on light glass
              margin: '0 20px', // 增加间距，提供呼吸感
            }}
          />

          {/* Middle Section - Action Buttons (Save & Clear) */}
          <div className="flex items-center flex-1 justify-center" style={{ gap: '16px' }}>
            <motion.button
              onClick={saveCurrentOptions}
              whileHover={{
                scale: 1.05,
                color: '#FFFFFF',
                textShadow: '0 0 8px rgba(255, 255, 255, 0.3)',
              }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5"
              style={{
                background: 'rgba(255, 255, 255, 0.28)',
                border: '0.5px solid rgba(255, 255, 255, 0.6)',
                padding: isVerySmallScreen ? '8px 10px' : isSmallScreen ? '8px 12px' : '9px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#333333',
                fontSize: isVerySmallScreen ? '11px' : '12px',
                fontWeight: 400,
                letterSpacing: '-0.01em',
                transition: 'all 0.2s ease',
                boxShadow:
                  'inset 0 1px 2px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(255, 255, 255, 0.55)',
                height: '100%',
                display: 'flex',
                alignItems: 'center', // 确保垂直居中
              }}
            >
              {/* Download/Disk Icon */}
              <svg width={isVerySmallScreen ? "12" : "14"} height={isVerySmallScreen ? "12" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'inherit' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>保存</span>
            </motion.button>

            <motion.button
              onClick={deleteSavedOptions}
              whileHover={{
                scale: 1.05,
                color: '#FFFFFF',
                textShadow: '0 0 8px rgba(255, 255, 255, 0.3)',
              }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5"
              style={{
                background: 'rgba(255, 255, 255, 0.28)',
                border: '0.5px solid rgba(255, 255, 255, 0.6)',
                padding: isVerySmallScreen ? '8px 10px' : isSmallScreen ? '8px 12px' : '9px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#333333',
                fontSize: isVerySmallScreen ? '11px' : '12px',
                fontWeight: 400,
                letterSpacing: '-0.01em',
                transition: 'all 0.2s ease',
                boxShadow:
                  'inset 0 1px 2px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(255, 255, 255, 0.55)',
                height: '100%',
                display: 'flex',
                alignItems: 'center', // 确保垂直居中
              }}
            >
              {/* Trash Icon */}
              <svg width={isVerySmallScreen ? "12" : "14"} height={isVerySmallScreen ? "12" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'inherit' }}>
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>清除</span>
            </motion.button>
          </div>

          {/* Vertical Divider - Right */}
          <div
            style={{
              width: '0.5px',
              height: '32px', // 增加高度以适应新的容器高度
              background: 'rgba(0, 0, 0, 0.08)',
              margin: '0 20px', // 增加间距，提供呼吸感
            }}
          />

          {/* Right Section - Statistics + Undo */}
          <div className="flex-1 flex justify-end items-center" style={{ height: '100%', gap: '12px' }}>
            <button
              type="button"
              onClick={canUndo && onUndo ? onUndo : undefined}
              disabled={!canUndo}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                margin: 0,
                fontSize: '12px',
                fontWeight: 400,
                letterSpacing: '-0.01em',
                color: canUndo ? 'rgba(51, 51, 51, 0.9)' : 'rgba(51, 51, 51, 0.25)',
                cursor: canUndo ? 'pointer' : 'default',
                textDecoration: canUndo ? 'underline' : 'none',
                textUnderlineOffset: '2px',
                transition: 'opacity 0.2s ease',
              }}
            >
              撤销上一步
            </button>
            <span style={{
              fontSize: '12px',
              color: '#333333',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}>
              {options.length}/12
            </span>
          </div>
          </div>

          {/* Bottom Layer - Presets Panel (Integrated within same container) */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
                style={{ marginTop: '8px' }} // tighter gap -> unified island
              >
                {/* Scroll area with edge gradient fades (no arrows) */}
                <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
                  <div
                    className="flex overflow-x-auto hide-scrollbar"
                    ref={presetsScrollRef}
                    onScroll={() => {
                      scheduleMagnetUpdate();
                      scheduleScrollEndSelection();
                    }}
                    onMouseDown={(e) => {
                      // Allow scrolling but don't interfere with button clicks
                      // Only prevent if clicking directly on scroll container (not on buttons)
                      if (e.target === e.currentTarget || (e.target as HTMLElement).closest('button') === null) {
                        // This is a scroll action, allow it
                        return;
                      }
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start', // Changed from 'center' to 'flex-start' to ensure proper spacing
                      gap: '10px',
                      scrollSnapType: 'x mandatory', // CSS magnetic snap
                      WebkitOverflowScrolling: 'touch', // Momentum scrolling (iOS)
                      overscrollBehaviorX: 'auto', // Allow natural boundary behavior
                      paddingTop: '4px',
                      paddingBottom: '4px',
                      paddingLeft: '10px',
                      paddingRight: '20px', // Padding for last item to ensure it's fully clickable
                      position: 'relative', // Ensure proper stacking context
                    }}
                  >
                    {presets.map((preset, index) => {
                      const isActive =
                        preset.options.length === options.length &&
                        preset.options.every((opt, i) => opt === options[i]);
                      void magnetIndex; // state kept for future; avoid unused warnings in edits
                      const isEmphasized = isActive; // visuals follow selection only

                      return (
                        <motion.button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            
                            // Clear any pending scroll selection to avoid conflicts
                            if (scrollEndTimeoutRef.current !== null) {
                              window.clearTimeout(scrollEndTimeoutRef.current);
                              scrollEndTimeoutRef.current = null;
                            }
                            
                            // Prevent if already applying
                            if (isApplyingPresetRef.current) return;
                            
                            centerPresetChip(index);
                            triggerHaptic();
                            applyPreset(preset.options);
                          }}
                          onMouseDown={(e) => {
                            // Prevent scroll from interfering with click on edge items
                            e.stopPropagation();
                            e.preventDefault(); // Also prevent default to ensure click works
                          }}
                          onTouchStart={(e) => {
                            // Prevent scroll from interfering with touch on edge items
                            e.stopPropagation();
                            // Don't preventDefault on touchStart to allow proper touch handling
                          }}
                          onTouchEnd={(e) => {
                            // Ensure touch events work properly for last item
                            e.stopPropagation();
                          }}
                          ref={(el) => {
                            presetButtonRefs.current[index] = el;
                          }}
                          animate={{ scale: isEmphasized ? 1.1 : 1 }}
                          whileHover={{ scale: isEmphasized ? 1.1 : 1.04 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-shrink-0 flex items-center gap-2"
                          style={{
                            touchAction: 'manipulation', // Prevent double-tap zoom and improve touch response
                            position: 'relative', // Ensure button is positioned
                            zIndex: 10, // Ensure button is above other elements
                            // Chip Refinement (Light glass): default subtle, emphasized (selected/center) pops
                            paddingLeft: isVerySmallScreen ? '12px' : isSmallScreen ? '14px' : '16px',
                            paddingRight: isVerySmallScreen ? '12px' : isSmallScreen ? '14px' : '16px',
                            paddingTop: isVerySmallScreen ? '8px' : '10px',
                            paddingBottom: isVerySmallScreen ? '8px' : '10px',
                            background: isEmphasized ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            color: '#333333',
                            fontSize: isVerySmallScreen ? '12px' : isSmallScreen ? '13px' : '14px',
                            fontWeight: isActive ? 700 : 500,
                            letterSpacing: '-0.01em',
                            scrollSnapAlign: 'center',
                            whiteSpace: 'nowrap',
                            minWidth: 'fit-content',
                            borderRadius: '999px',
                            border: isEmphasized
                              ? '1px solid rgba(255, 255, 255, 0.75)'
                              : '0.5px solid rgba(255, 255, 255, 0.6)',
                            boxShadow: isEmphasized
                              ? '0 0 8px rgba(255, 255, 255, 0.18), inset 0 -1px 0 rgba(255, 255, 255, 0.65)'
                              : 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Mono line icon (no emoji) */}
                          <span style={{ color: '#333333', opacity: isEmphasized ? 1 : 0.78 }}>
                            {getPresetIcon(preset.name)}
                          </span>
                          <span>{preset.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Left fade (30px) */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: '30px',
                      pointerEvents: 'none',
                      background:
                        'linear-gradient(to right, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))',
                    }}
                  />
                  {/* Right fade (reduced width to avoid blocking last button) */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: '20px', // Reduced from 30px to avoid blocking last button
                      pointerEvents: 'none',
                      background:
                        'linear-gradient(to left, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0))', // Lighter gradient
                      zIndex: 1, // Lower than buttons
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50"
            style={{
              background: 'rgba(28, 28, 30, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
              pointerEvents: 'none',
            }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Drawer for Hidden Options */}
      <AnimatePresence>
        {showDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40"
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
              onClick={() => setShowDrawer(false)}
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ 
                type: "spring", 
                damping: 30, 
                stiffness: 300 
              }}
              className="fixed bottom-0 left-0 right-0 z-50"
              style={{
                background: '#FFFFFF',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                maxHeight: '70vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div
                  style={{
                    width: '40px',
                    height: '4px',
                    background: '#D2D2D7',
                    borderRadius: '2px',
                  }}
                />
              </div>

              {/* Drawer Header */}
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #E5E5EA',
                }}
              >
                <div className="flex items-center justify-between">
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#1D1D1F',
                    }}
                  >
                    所有选项
                  </h3>
                  <motion.button
                    onClick={() => setShowDrawer(false)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 0, 0, 0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </motion.button>
                </div>
              </div>

              {/* Drawer Content - Scrollable */}
              <div
                className="overflow-y-auto"
                style={{
                  padding: '16px 24px',
                  paddingBottom: '24px',
                }}
              >
                <div
                  className="flex flex-col"
                  style={{ 
                    gap: '0px', // 使用 marginBottom 控制间距
                    listStyle: 'none', // 移除列表默认样式（黑点）
                    padding: 0, // 移除默认 padding
                    margin: 0, // 移除默认 margin
                  }}
                >
                  {options.map((option, index) => (
                    <div
                      key={`${index}-${option}`}
                      className="relative group"
                      style={{
                        position: 'relative',
                        listStyle: 'none', // 移除列表默认样式（黑点）
                        padding: 0, // 移除默认 padding
                        margin: 0, // 移除默认 margin
                      }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {editingIndex === index ? (
                        // Edit Mode - Premium Card Design
                        <div 
                          style={{
                            background: '#FFFFFF',
                            padding: '12px 20px',
                            borderRadius: '10px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                            marginBottom: '10px',
                            position: 'relative',
                          }}
                        >
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleEditKeyPress}
                            onBlur={saveEdit}
                            autoFocus
                            maxLength={20}
                            className="w-full bg-transparent outline-none"
                            style={{ 
                              color: '#1D1D1F', 
                              fontWeight: 500,
                              fontSize: '15px',
                              letterSpacing: '-0.01em',
                              border: 'none',
                              paddingLeft: '20px',
                              textAlign: 'left',
                            }}
                          />
                        </div>
                      ) : (
                        // Display Mode - Premium Card Design
                        <motion.div 
                          className="cursor-pointer"
                          style={{
                            background: '#FFFFFF',
                            border: 'none',
                            padding: '12px 20px',
                            borderRadius: '10px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                            marginBottom: '10px',
                            position: 'relative',
                          }}
                          onClick={() => startEdit(index)}
                        >
                          <div className="flex items-center justify-between">
                            <p 
                              style={{ 
                                color: '#1D1D1F', 
                                fontWeight: 500,
                                fontSize: '15px',
                                letterSpacing: '-0.01em',
                                textAlign: 'left',
                              }}
                            >
                              {option || '输入选项...'}
                            </p>
                            
                            {options.length > 2 && (
                              <motion.button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeOption(index);
                                }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ 
                                  opacity: hoveredIndex === index ? 1 : 0,
                                  scale: hoveredIndex === index ? 1 : 0.8,
                                }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(255, 59, 48, 0.1)' }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </motion.button>
                          )}
                        </div>
                      </motion.div>
                    )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
