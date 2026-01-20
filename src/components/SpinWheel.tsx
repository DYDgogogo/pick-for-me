import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// 微信小程序 API 类型声明
declare const wx: {
  vibrateShort?: (options: { type: 'light' | 'medium' | 'heavy' }) => void;
  shareAppMessage?: (options: {
    title: string;
    path: string;
    imageUrl?: string;
  }) => void;
} | undefined;

interface HistoryHighlight {
  options: string[];
  index: number;
  requestId: number;
}

interface SpinWheelProps {
  options: string[];
  onResult: (result: string, index: number) => void;
  onSpinStart?: () => void;
  recentPresets?: string[][];
  onPresetClick?: (preset: string[]) => void;
  onOptionsReorder?: (newOptions: string[]) => void;
  historyHighlight?: HistoryHighlight | null;
}

// Titanium Cold Palette (Lightened for light-industrial canvas)
// Keep the same hue family, lift value to reduce heaviness.
const COLORS = [
  '#586170', // Light Slate
  '#7C8CA3', // Light Steel Blue
  '#B8C0CD', // Soft Silver Grey
  '#454C57', // Mid Titanium
  '#9B93A6', // Soft Muted Purple
];

// CSS Variables for consistent theming
const CSS_VARS = {
  // Primary Spin Button - Light Glassmorphism
  buttonBg: 'rgba(255, 255, 255, 0.7)',
  buttonBgHover: 'rgba(255, 255, 255, 0.9)',
  buttonText: '#333333',
  buttonShadow: `
    0 10px 24px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.75)
  `,
  
  // Pointer Colors
  pointerColor: '#FFFFFF',
  pointerShadow: '0px 3px 6px rgba(0, 0, 0, 0.6)',
  
  // Result Circle - Light Glassmorphism with seamless edge buffer
  resultBg: 'rgba(255, 255, 255, 0.85)',
  resultBackdrop: 'blur(24px) saturate(180%)',
  resultText: '#333333',
  resultBorder: 'rgba(255, 255, 255, 0.85)',
  resultShadow: `
    0 12px 28px rgba(15, 23, 42, 0.18),
    inset 0 2px 6px rgba(255, 255, 255, 0.8),
    inset 0 -2px 4px rgba(15, 23, 42, 0.08)
  `,
  
  // Card Shadows
  cardShadow: '0 2px 16px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
};

// Generate metallic gradient for each color
const getMetallicGradient = (baseColor: string): { lighter: string; darker: string } => {
  const gradients: Record<string, { lighter: string; darker: string }> = {
    '#586170': { lighter: '#6E788A', darker: '#47505E' }, // Light Slate
    '#7C8CA3': { lighter: '#95A6BF', darker: '#67758A' }, // Light Steel Blue
    '#B8C0CD': { lighter: '#D0D7E2', darker: '#A2AAB8' }, // Soft Silver Grey
    '#454C57': { lighter: '#5A6270', darker: '#343B45' }, // Mid Titanium
    '#9B93A6': { lighter: '#B0A8BD', darker: '#857D92' }, // Soft Muted Purple
  };
  return gradients[baseColor] || { lighter: baseColor, darker: baseColor };
};

// Smart color assignment to ensure adjacent slices never have the same color
// This function needs to be called sequentially to properly check adjacent colors
const getSegmentColor = (index: number, totalSegments: number, assignedColors: string[] = [], offset: number = 0): string => {
  const paletteLength = COLORS.length;
  
  // Base color assignment using (index + offset) % palette.length
  let colorIndex = (index + offset) % paletteLength;
  let color = COLORS[colorIndex];
  
  // Get previous segment color (handle wrap-around for index 0)
  const prevIndex = index === 0 ? totalSegments - 1 : index - 1;
  let prevColor: string;
  
  // If we have assigned colors, use the actual assigned color for previous segment
  if (assignedColors.length > prevIndex) {
    prevColor = assignedColors[prevIndex];
  } else {
    // Otherwise calculate it (for first segment)
    const prevColorIndex = (prevIndex + offset) % paletteLength;
    prevColor = COLORS[prevColorIndex];
  }
  
  // If current color matches previous color, find a different color
  if (color === prevColor) {
    // Try next color in palette
    colorIndex = (colorIndex + 1) % paletteLength;
    color = COLORS[colorIndex];
    
    // If still matches, try the one after that
    if (color === prevColor && paletteLength > 2) {
      colorIndex = (colorIndex + 1) % paletteLength;
      color = COLORS[colorIndex];
    }
  }
  
  // Edge case: Check if last slice (index = totalSegments - 1) matches first slice (index = 0)
  if (index === totalSegments - 1 && totalSegments > 1) {
    // Get the actual first slice color (may have been adjusted)
    const firstColor = assignedColors.length > 0 ? assignedColors[0] : COLORS[(0 + offset) % paletteLength];
    
    if (color === firstColor) {
      // Find a different color that doesn't match first or previous
      for (let i = 0; i < paletteLength; i++) {
        const candidateIndex = (colorIndex + i + 1) % paletteLength;
        const candidateColor = COLORS[candidateIndex];
        
        if (candidateColor !== firstColor && candidateColor !== prevColor) {
          color = candidateColor;
          break;
        }
      }
    }
  }
  
  return color;
};

// Apple 级别 Easing 曲线 - cubic-bezier(0.1, 0.7, 0.1, 1)

// 分享文案池 - 冷静但友好的基调
const CALM_SHARE_TEMPLATES: Array<(result: string) => string> = [
  (result: string) => `结果：【${result}】。`,
  (result: string) => `今天的选择是：【${result}】。`,
  (result: string) => `这次就选：【${result}】。`,
  (result: string) => `我已经决定选：【${result}】。`,
];

// 随机选择分享文案
const getRandomShareText = (result: string): string => {
  const randomTemplate =
    CALM_SHARE_TEMPLATES[Math.floor(Math.random() * CALM_SHARE_TEMPLATES.length)];
  return randomTemplate(result);
};

export default function SpinWheel({ options, onResult, onSpinStart, historyHighlight }: SpinWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showSharePoster, setShowSharePoster] = useState(false);
  const [radius, setRadius] = useState(140);
  const controls = useAnimation();
  const wheelRef = useRef<SVGSVGElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  // Respect user/system motion preference for performance and comfort
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    // Fallback for older browsers
    if (typeof media.addListener === 'function') {
      media.addListener(update);
      return () => media.removeListener(update);
    }
  }, []);

  // Pre-calculate all segment colors to ensure adjacent slices never have the same color
  const segmentColors = useMemo(() => {
    const colors: string[] = [];
    for (let i = 0; i < options.length; i++) {
      colors.push(getSegmentColor(i, options.length, colors, 0));
    }
    return colors;
  }, [options.length]);

  // Calculate the pointed index from total rotation
  const calculateIndexFromRotation = useCallback((totalRotation: number): number => {
    // Defensive check: prevent division by zero
    if (options.length <= 0) {
      return 0;
    }
    const sliceAngle = 360 / options.length;
    const index = Math.floor(((360 - (totalRotation % 360)) % 360) / sliceAngle);
    return index % options.length;
  }, [options.length]);

  // Segment path calculation
  const getSegmentPath = (index: number, total: number, radius: number) => {
    // Defensive check: prevent division by zero
    if (total <= 0) {
      return `M ${radius} ${radius} L ${radius} ${radius} Z`; // Return empty path
    }
    const angle = 360 / total;
    const startAngle = index * angle - 90;
    const endAngle = startAngle + angle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = radius + radius * Math.cos(startRad);
    const y1 = radius + radius * Math.sin(startRad);
    const x2 = radius + radius * Math.cos(endRad);
    const y2 = radius + radius * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    return `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  // Text position calculation with improved padding
  const getTextPosition = (index: number, total: number, radius: number) => {
    // Defensive check: prevent division by zero
    if (total <= 0) {
      return { x: radius, y: radius, rotation: 0 };
    }
    const angle = 360 / total;
    const midAngle = index * angle + angle / 2 - 90;
    const rad = (midAngle * Math.PI) / 180;
    // Increased textRadius for better breathing space from center
    const textRadius = total <= 4 ? radius * 0.58 : radius * 0.63;
    
    return {
      x: radius + textRadius * Math.cos(rad),
      y: radius + textRadius * Math.sin(rad),
      rotation: midAngle + 90,
    };
  };

  // Truncate text
  const truncateText = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + '…';
  };

  const getMaxTextLength = (total: number) => {
    if (total <= 2) return 8;
    if (total <= 4) return 6;
    if (total <= 6) return 4;
    return 3;
  };


  // Confetti effect - Titanium Cold Palette colors
  const triggerConfetti = () => {
    if (prefersReducedMotion) return;
    const titaniumColors = ['#383D49', '#5A6678', '#8E97A6', '#2C3038', '#7A7285'];

    // Main burst - elegant and minimal
    confetti({
      particleCount: 40,
      spread: 60,
      startVelocity: 30,
      origin: { x: 0.5, y: 0.45 },
      colors: titaniumColors,
      ticks: 150,
      gravity: 1.0,
      scalar: 0.9,
      drift: 0.5,
    });
  };

  // Haptic feedback
  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([40, 20, 60]);
    }
  };

  // Spin function - 极简高性能动画
  const spin = () => {
    if (isSpinning) return;
    // Defensive check: prevent spinning with insufficient options
    if (options.length < 2) return;
    
    // Call onSpinStart callback to save current options as recent preset
    if (onSpinStart) {
      onSpinStart();
    }
    
    setIsSpinning(true);
    setSelectedIndex(null);

    // Pick a random target index
    const targetIndex = Math.floor(Math.random() * options.length);
    const sliceAngle = 360 / options.length;
    
    // Calculate target rotation: we want the target segment's center to be at 0 degrees (pointer position)
    const targetRotation = (90 - targetIndex * sliceAngle - sliceAngle / 2 + 360) % 360;
    
    // Calculate rotation increment from current position
    const currentRotationMod = rotation % 360;
    let deltaRotation = (targetRotation - currentRotationMod + 360) % 360;
    
    // Add multiple spins for visual effect
    const spins = prefersReducedMotion ? 4 + Math.random() * 1.5 : 5 + Math.random() * 2;
    const totalRotation = rotation + spins * 360 + deltaRotation;
    
    // Apple 级别动画曲线：cubic-bezier(0.1, 0.7, 0.1, 1) - 启动极速，停止干脆
    const baseDuration = prefersReducedMotion ? 2.4 : 3.3;
    const jitter = prefersReducedMotion ? 0.3 : 0.5;
    const animationDuration = baseDuration + Math.random() * jitter; // 稍微缩短整体时长，提升流畅感
    
    controls.start({
      rotate: totalRotation,
      transition: { 
        duration: animationDuration,
        ease: [0.1, 0.7, 0.1, 1] as const, // cubic-bezier(0.1, 0.7, 0.1, 1)
      },
    });

    // Complete - 精密机械表指针停顿：立即锁定，无偏移补偿
    setTimeout(() => {
      // 立即锁定到精确角度，严禁任何偏移补偿
      setRotation(totalRotation);
      controls.set({ rotate: totalRotation }); // 强制设置最终角度，防止余震
      
      const calculatedIndex = calculateIndexFromRotation(totalRotation);
      
      setSelectedIndex(calculatedIndex);
      setIsSpinning(false);
      
      // 触感反馈：微信小程序环境
      if (typeof wx !== 'undefined' && wx.vibrateShort) {
        wx.vibrateShort({ type: 'light' });
      } else {
        // 降级方案：Web 环境
        triggerHapticFeedback();
      }
      
      // Trigger confetti after wheel completely stops
      setTimeout(() => {
        triggerConfetti();
      }, 200);
      
      onResult(options[calculatedIndex], calculatedIndex);
      
      // Show share card modal after a brief delay
      setTimeout(() => {
        setShowShareCard(true);
      }, 500);
    }, animationDuration * 1000); // 精确匹配动画时长
  };

  // Adapt wheel size for small screens
  useEffect(() => {
    const updateRadiusForViewport = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      if (width <= 320) {
        setRadius(100); // Very small: iPhone SE / small Android
      } else if (width <= 360) {
        setRadius(110); // Small: iPhone 6/7/8
      } else if (width <= 375) {
        setRadius(120); // Standard small: iPhone X/11/12 mini
      } else if (width <= 420) {
        setRadius(130); // Medium
      } else {
        setRadius(140); // Large
      }
    };
    updateRadiusForViewport();
    window.addEventListener('resize', updateRadiusForViewport);
    return () => window.removeEventListener('resize', updateRadiusForViewport);
  }, []);

  // Store previous options to detect reordering
  const prevOptionsRef = useRef<string[]>(options);
  const prevRotationRef = useRef<number>(rotation);
  const lastHistoryRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedIndex(null);
    // Add subtle opacity transition when options change
    setOpacity(0.6);
    const timer = setTimeout(() => {
      setOpacity(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [options.length]);

  // Real-time wheel rotation sync when options are reordered
  useEffect(() => {
    // Defensive check: prevent calculation with insufficient options
    if (options.length < 2) return;
    
    // Check if options were reordered (same length, different order)
    if (
      options.length === prevOptionsRef.current.length &&
      JSON.stringify(options) !== JSON.stringify(prevOptionsRef.current) &&
      !isSpinning
    ) {
      // Calculate which option is currently under the pointer
      const currentIndex = calculateIndexFromRotation(rotation);
      const currentOption = prevOptionsRef.current[currentIndex];
      
      // Find this option's new index in the reordered list
      const newIndex = options.indexOf(currentOption);
      
      if (newIndex !== -1 && newIndex !== currentIndex) {
        // Calculate rotation adjustment to keep the same option under the pointer
        const sliceAngle = 360 / options.length;
        const indexDiff = newIndex - currentIndex;
        const rotationAdjustment = -indexDiff * sliceAngle; // Negative because we rotate opposite to index change
        
        // Update rotation smoothly
        const newRotation = rotation + rotationAdjustment;
        setRotation(newRotation);
        prevRotationRef.current = newRotation;
        
        // Animate the wheel to the new rotation with Apple-level easing
        controls.start({
          rotate: newRotation,
          transition: { 
            duration: 0.4, 
            ease: [0.1, 0.7, 0.1, 1] as const // 统一使用新的 easing 曲线
          },
        });
      }
    }
    
    prevOptionsRef.current = options;
    prevRotationRef.current = rotation;
  }, [options, isSpinning, controls, rotation]);

  // Handle external highlight requests from history (clicking a history pill)
  useEffect(() => {
    if (!historyHighlight) return;
    if (isSpinning) return;

    // Avoid re-processing the same request
    if (lastHistoryRequestIdRef.current === historyHighlight.requestId) return;

    // Only respond when options fully match the history snapshot
    if (
      historyHighlight.options.length !== options.length ||
      !historyHighlight.options.every((opt, i) => opt === options[i])
    ) {
      return;
    }

    // Defensive check: prevent calculation with insufficient options
    if (options.length < 2) return;

    const targetIndex = Math.min(
      Math.max(historyHighlight.index, 0),
      options.length - 1
    );

    const sliceAngle = 360 / options.length;
    const targetRotation = (90 - targetIndex * sliceAngle - sliceAngle / 2 + 360) % 360;

    const currentRotationMod = ((rotation % 360) + 360) % 360;
    let deltaRotation = (targetRotation - currentRotationMod + 360) % 360;
    // Choose the shorter rotation direction
    if (deltaRotation > 180) deltaRotation -= 360;

    const totalRotation = rotation + deltaRotation;

    setRotation(totalRotation);
    controls.start({
      rotate: totalRotation,
      transition: {
        duration: 0.9,
        ease: [0.25, 0.1, 0.25, 1] as const,
      },
    });
    setSelectedIndex(targetIndex);
    lastHistoryRequestIdRef.current = historyHighlight.requestId;
  }, [historyHighlight, options, rotation, isSpinning, controls]);

  const size = radius * 2;

  // Empty state: show friendly message when options are insufficient
  if (options.length < 2) {
    return (
      <div className="flex flex-col items-center" style={{ gap: 0 }}>
        {/* Empty State Container - Light Glassmorphism */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            position: 'relative',
            width: size,
            height: size,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '0.5px solid rgba(255, 255, 255, 0.6)',
            boxShadow: prefersReducedMotion
              ? '0 8px 18px rgba(15, 23, 42, 0.12)'
              : `
              inset 0 2px 6px rgba(255, 255, 255, 0.65),
              inset 0 -2px 4px rgba(15, 23, 42, 0.06),
              0 10px 26px rgba(15, 23, 42, 0.14)
            `,
            padding: '40px 32px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: 500,
              color: 'rgba(15, 23, 42, 0.7)',
              textAlign: 'center',
              lineHeight: 1.5,
              letterSpacing: '-0.01em',
              marginBottom: '8px',
            }}
          >
            {options.length === 0 ? '还没有选项' : '选项不足'}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 400,
              color: 'rgba(15, 23, 42, 0.5)',
              textAlign: 'center',
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
            }}
          >
            请添加更多选项
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center" style={{ gap: 0 }}>
      {/* Wheel Container - Absolute Centering Reference Frame - Pure Background */}
      <div 
        style={{ 
          position: 'relative',
          width: size, 
          height: size,
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
          background: 'transparent', // 确保背景完全透明，无任何残留
        }}
      >
        {/* Apple-Level Pointer - Floating Entity with Refined Shadow - Pure Clean */}
        {/* 使用 filter 替代 boxShadow，避免容器背景问题 */}
        <div 
          style={{
            position: 'absolute',
            top: -2,
            left: '50%',
            marginLeft: '-7px', // Half of width (14 / 2)
            transformOrigin: 'center bottom',
            zIndex: 50, // 高于转盘，确保悬浮感
            background: 'transparent', // 确保背景完全透明
            pointerEvents: 'none', // 防止任何交互残留
            border: 'none', // 确保无边框
            outline: 'none', // 确保无轮廓
            width: '14px', // 明确宽度，防止意外空间
            height: '26px', // 明确高度，防止意外空间
            overflow: 'visible', // 允许阴影显示
            lineHeight: 0, // 防止行高产生的空间
            fontSize: 0, // 防止字体大小产生的空间
            isolation: 'isolate', // 创建新的堆叠上下文，防止背景穿透
          }}
        >
          <svg 
            width="14" 
            height="26" 
            viewBox="0 0 14 26" 
            preserveAspectRatio="xMidYMin meet"
            style={{ 
              display: 'block',
              background: 'transparent', // SVG 背景透明
              border: 'none', // 确保无边框
              outline: 'none', // 确保无轮廓
              margin: 0, // 确保无外边距
              padding: 0, // 确保无内边距
              verticalAlign: 'top', // 防止基线对齐产生的空间
              width: '14px', // 明确宽度
              height: '26px', // 明确高度
              filter: prefersReducedMotion
                ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.16))'
                : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15))', // 使用 filter 替代 boxShadow
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Pure white triangle pointer - floating above wheel - no background elements */}
            <path
              d="M7 26 L0 0 L14 0 Z"
              fill="#FFFFFF"
              stroke="none" // 确保无描边
            />
            {/* 确保 SVG 内无任何其他元素 */}
          </svg>
        </div>

        {/* Wheel - Milled Metal with Enhanced Depth - Pure Clean */}
        <motion.div
          animate={controls}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            transformOrigin: `${radius}px ${radius}px`, // Explicit pixel center
            borderRadius: '50%',
            overflow: 'hidden',
            boxSizing: 'border-box',
            border: 'none', // 确保无边框
            outline: 'none', // 确保无轮廓
            boxShadow: prefersReducedMotion
              ? '0 8px 18px rgba(15, 23, 42, 0.12)'
              : `
              inset 0 2px 6px rgba(255, 255, 255, 0.65),
              inset 0 -2px 4px rgba(15, 23, 42, 0.06),
              0 10px 26px rgba(15, 23, 42, 0.14)
            `, // lighter, cooler shadow for light-industrial feel
            opacity: opacity,
            transition: 'opacity 0.3s ease-in-out',
            zIndex: 10,
            background: 'transparent', // 确保转盘容器背景透明
          }}
        >
          <svg 
            ref={wheelRef}
            width={size} 
            height={size} 
            viewBox={`0 0 ${size} ${size}`}
            style={{ display: 'block' }}
          >
            <defs>
              {/* Enhanced Metallic Gradients - Physical Light Simulation */}
              {COLORS.map((color, idx) => {
                const gradient = getMetallicGradient(color);
                return (
                  <radialGradient key={`metallic-${idx}`} id={`metallicGrad-${idx}`} cx="30%" cy="30%">
                    <stop offset="0%" stopColor={gradient.lighter} stopOpacity="1" />
                    <stop offset="60%" stopColor={color} stopOpacity="1" />
                    <stop offset="100%" stopColor={gradient.darker} stopOpacity="1" />
                  </radialGradient>
                );
              })}
            </defs>

            {/* Segments with Titanium metallic colors - Smooth seams */}
            {options.map((option, index) => {
              const textPos = getTextPosition(index, options.length, radius);
              // Use pre-calculated color to ensure adjacent slices never have the same color
              const color = segmentColors[index];
              const colorIndex = COLORS.indexOf(color);
              const gradientId = `metallicGrad-${colorIndex}`;
              
              return (
                <g key={index}>
                  {/* Main segment with metallic gradient and smooth seams */}
                  <path
                    d={getSegmentPath(index, options.length, radius)}
                    fill={`url(#${gradientId})`}
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                    style={{
                      paintOrder: 'fill',
                    }}
                  />
                  
                  <text
                    x={textPos.x}
                    y={textPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(255, 255, 255, 0.92)"
                    fontSize={options.length > 8 ? 11 : options.length > 6 ? 12 : options.length > 4 ? 14 : 16}
                    fontWeight="500"
                    transform={`rotate(${textPos.rotation}, ${textPos.x}, ${textPos.y})`}
                    style={{ 
                      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                      paintOrder: 'stroke fill',
                      textShadow: '0 1px 2px rgba(15, 23, 42, 0.25)',
                    }}
                  >
                    {truncateText(option, getMaxTextLength(options.length))}
                  </text>
                </g>
              );
            })}

            {/* Center Hub - Clean Base Circle - Hidden when result modal is shown */}
            <circle
              cx={radius}
              cy={radius}
              r={32}
              fill="#FFFFFF"
              stroke="rgba(0, 0, 0, 0.08)"
              strokeWidth="1"
              style={{
                opacity: (showShareCard || showSharePoster) ? 0 : 1,
                transition: 'opacity 0.3s ease-out',
                pointerEvents: (showShareCard || showSharePoster) ? 'none' : 'auto',
              }}
            />
          </svg>
        </motion.div>

        {/* Center Result Hub - Apple-Level Elevated Entity - Hidden when result modal is shown */}
        <AnimatePresence>
          {selectedIndex !== null && !isSpinning && !showShareCard && !showSharePoster && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ 
                duration: prefersReducedMotion ? 0.35 : 0.5,
                ease: [0.34, 1.56, 0.64, 1], // Spring-like ease
              }}
              style={{ 
                position: 'absolute',
                top: radius - 32, // Exact pixel position: center - half height
                left: radius - 32, // Exact pixel position: center - half width
                width: 64,
                height: 64,
                boxSizing: 'border-box',
                zIndex: 200, // 增强层级，使其在转盘轴心上方
                pointerEvents: 'none',
                filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))', // 向外扩散的软阴影
              }}
            >
              {/* Result Circle - Glassmorphism with Seamless Edge Buffer */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  background: CSS_VARS.resultBg,
                  backdropFilter: CSS_VARS.resultBackdrop,
                  WebkitBackdropFilter: CSS_VARS.resultBackdrop,
                  border: `0.5px solid ${CSS_VARS.resultBorder}`,
                  boxShadow: CSS_VARS.resultShadow,
                  boxSizing: 'border-box',
                }}
              >
                <span 
                  style={{ 
                    fontSize: options[selectedIndex].length > 3 ? '12px' : '15px',
                    fontWeight: 600,
                    color: CSS_VARS.resultText,
                    textAlign: 'center',
                    lineHeight: '1.2',
                    padding: '0 6px',
                    maxWidth: '100%',
                    wordBreak: 'break-word',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {options[selectedIndex]}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Spin Button - Light Glassmorphism Primary CTA */}
      <div className="flex flex-col items-center" style={{ marginTop: '32px', gap: '8px' }}>
        <motion.button
          onClick={spin}
          disabled={isSpinning || options.length < 2}
          whileHover={options.length >= 2 ? { scale: 1.03 } : {}}
          whileTap={options.length >= 2 ? { scale: 0.97 } : {}}
          className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={{
            paddingLeft: '34px',
            paddingRight: '34px',
            paddingTop: '16px',
            paddingBottom: '16px',
            borderRadius: '980px',
            background: options.length < 2 ? 'rgba(255, 255, 255, 0.4)' : CSS_VARS.buttonBg,
            color: CSS_VARS.buttonText,
            fontSize: '17px',
            fontWeight: 500,
            letterSpacing: '-0.022em',
            minWidth: '150px',
            lineHeight: 1,
            boxShadow: CSS_VARS.buttonShadow,
            outline: 'none',
            border: '0.5px solid rgba(255, 255, 255, 0.7)',
            transition: 'all 0.25s ease-out',
          }}
          onMouseEnter={(e) => {
            if (options.length >= 2) {
              e.currentTarget.style.background = CSS_VARS.buttonBgHover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = options.length < 2 ? 'rgba(255, 255, 255, 0.4)' : CSS_VARS.buttonBg;
          }}
        >
          {isSpinning
            ? '转动中…'
            : selectedIndex === null
            ? '开始转动'
            : '再转一次'}
        </motion.button>
        
        {/* Empty state hint - shown when options < 2 */}
        {options.length < 2 && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              fontSize: '12px',
              color: 'rgba(15, 23, 42, 0.5)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              textAlign: 'center',
              margin: 0,
            }}
          >
            至少需要 2 个选项才能转盘
          </motion.p>
        )}
      </div>

      {/* Share Poster Modal - Beautiful 9:16 Poster */}
      <AnimatePresence>
        {showSharePoster && selectedIndex !== null && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
              onClick={() => setShowSharePoster(false)}
            >
              {/* Poster Modal - 80% screen width */}
              <motion.div
                ref={posterRef}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ 
                  type: "spring", 
                  damping: 28, 
                  stiffness: 320 
                }}
                className="relative"
                style={{
                  width: '80%',
                  maxWidth: '400px',
                  aspectRatio: '9 / 16',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Poster Content */}
                <div
                  className="relative w-full h-full overflow-hidden"
                  style={{
                    borderRadius: '32px',
                    background: `linear-gradient(135deg, 
                      ${segmentColors[selectedIndex]}20 0%, 
                      ${segmentColors[(selectedIndex + 1) % options.length]}15 50%,
                      ${segmentColors[(selectedIndex + 2) % options.length]}20 100%)`,
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {/* Close Button - Refined Apple Style */}
                  <motion.button
                    onClick={() => setShowSharePoster(false)}
                    whileHover={{ scale: 1.08, background: 'rgba(255, 255, 255, 0.95)' }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                      transition: 'all 0.2s ease-out',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 0, 0, 0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </motion.button>

                  {/* Wheel Thumbnail - Centered with blur effect */}
                  <div
                    className="absolute"
                    style={{
                      top: '18%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '140px',
                      height: '140px',
                      opacity: 0.7,
                      filter: 'blur(3px)',
                    }}
                  >
                    <svg 
                      width="140" 
                      height="140" 
                      viewBox="0 0 280 280"
                    >
                      <defs>
                        {/* Metallic gradients for poster thumbnail */}
                        {COLORS.map((color, idx) => {
                          const gradient = getMetallicGradient(color);
                          return (
                            <radialGradient key={`poster-metallic-${idx}`} id={`posterMetallicGrad-${idx}`} cx="50%" cy="30%">
                              <stop offset="0%" stopColor={gradient.lighter} />
                              <stop offset="100%" stopColor={gradient.darker} />
                            </radialGradient>
                          );
                        })}
                      </defs>
                      {options.map((_, index) => {
                        const color = segmentColors[index];
                        const colorIndex = COLORS.indexOf(color);
                        const gradientId = `posterMetallicGrad-${colorIndex}`;
                        
                        return (
                          <g key={index}>
                            <path
                              d={getSegmentPath(index, options.length, 140)}
                              fill={`url(#${gradientId})`}
                              stroke="rgba(255, 255, 255, 0.3)"
                              strokeWidth="1"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Result Text - Large and Bold */}
                  <div
                    className="absolute text-center"
                    style={{
                      top: '42%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '85%',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 'clamp(36px, 10vw, 56px)',
                        fontWeight: 700,
                        color: '#1D1D1F',
                        letterSpacing: '-0.04em',
                        lineHeight: 1.1,
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        wordBreak: 'break-word',
                      }}
                    >
                      {options[selectedIndex]}
                    </p>
                  </div>

                  {/* QR Code Area - Bottom Right */}
                  <div
                    className="absolute"
                    style={{
                      bottom: '12%',
                      right: '8%',
                      width: '80px',
                      height: '80px',
                      background: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* QR Code Placeholder */}
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        background: 'rgba(0, 0, 0, 0.05)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                      }}
                    >
                      📱
                    </div>
                  </div>

                  {/* Hint Text - Bottom */}
                  <div
                    className="absolute text-center"
                    style={{
                      bottom: '6%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '85%',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 400,
                        color: 'rgba(29, 29, 31, 0.6)',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.4,
                      }}
                    >
                      长按保存图片，发给朋友参考决策
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Share Card Modal - Minimalist Apple Style */}
      <AnimatePresence>
        {showShareCard && selectedIndex !== null && (
          <>
            {/* Backdrop - Click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
              onClick={() => setShowShareCard(false)}
            >
              {/* Minimalist Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ 
                  type: "spring", 
                  damping: 28, 
                  stiffness: 320,
                  duration: 0.4 
                }}
                className="relative w-full max-w-sm mx-4"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  borderRadius: '28px',
                  border: '1px solid rgba(255, 255, 255, 0.6)',
                  padding: '56px 40px 40px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.06)',
                }}
              >
                {/* Refined Close Button - Low Contrast */}
                <motion.button
                  onClick={() => setShowShareCard(false)}
                  whileHover={{ scale: 1.08, background: 'rgba(0, 0, 0, 0.08)' }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease-out',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 0, 0, 0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </motion.button>

                {/* Card Content - Centered */}
                <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
                  {/* Result Text + Meta - Calm, structured hierarchy */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 400,
                        color: 'rgba(15, 23, 42, 0.55)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        margin: 0,
                      }}
                    >
                      本次结果
                    </p>
                    <p
                      style={{
                        fontSize: 'clamp(42px, 11vw, 60px)',
                        fontWeight: 700,
                        color: '#1D1D1F',
                        letterSpacing: '-0.04em',
                        lineHeight: 1.1,
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        wordBreak: 'break-word',
                        textShadow: '0 2px 12px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06)',
                      }}
                    >
                      {options[selectedIndex]}
                    </p>
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 400,
                        color: 'rgba(15, 23, 42, 0.55)',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.4,
                        margin: 0,
                      }}
                    >
                      来自当前选项列表的随机选择
                    </p>
                  </div>

                  {/* Share Button - aligned with primary CTA style */}
                  <motion.button
                    onClick={() => {
                      const result = options[selectedIndex];
                      const shareText = getRandomShareText(result);
                      const shareTitle = `帮我选 - ${result}`;
                      const shareUrl = window.location.href;
                      
                      // 微信小程序环境
                      if (typeof wx !== 'undefined' && wx.shareAppMessage) {
                        wx.shareAppMessage({
                          title: shareTitle,
                          path: `/pages/index/index?result=${encodeURIComponent(result)}`,
                          imageUrl: '', // 建议使用转盘结果截图
                        });
                      } else if (navigator.share) {
                        // Web Share API
                        navigator.share({
                          title: shareTitle,
                          text: shareText,
                          url: shareUrl,
                        }).catch(() => {
                          // Fallback: copy to clipboard
                          navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
                            alert('已复制到剪贴板');
                          });
                        });
                      } else {
                        // Fallback: copy to clipboard
                        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
                          alert('已复制到剪贴板');
                        });
                      }
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-full"
                    style={{
                      background: CSS_VARS.buttonBg,
                      color: CSS_VARS.buttonText,
                      fontSize: '17px',
                      fontWeight: 500,
                      letterSpacing: '-0.01em',
                      border: '0.5px solid rgba(255, 255, 255, 0.8)',
                      padding: '16px 0',
                      borderRadius: '100px',
                      boxShadow: CSS_VARS.buttonShadow,
                      transition: 'all 0.25s ease-out',
                      cursor: 'pointer',
                    }}
                  >
                    分享结果
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
