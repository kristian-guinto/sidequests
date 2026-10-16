'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface DepthOdometerProps {
  value: number;
  initialValue?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  formatThousands?: boolean;
  className?: string;
  glowColor?: string;
  onComplete?: () => void;
}

export function DepthOdometer({
  value,
  initialValue,
  duration = 900,
  prefix = '',
  suffix = '',
  formatThousands = true,
  className = '',
  glowColor = '#ffd166',
  onComplete,
}: DepthOdometerProps) {
  const [displayValue, setDisplayValue] = useState<number>(initialValue !== undefined ? initialValue : value);
  const [isPopping, setIsPopping] = useState(false);
  const startValRef = useRef(displayValue);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = displayValue;
    const endVal = value;
    const diff = endVal - startVal;

    if (diff === 0) return;

    startTimeRef.current = null;
    startValRef.current = startVal;
    setIsPopping(false);

    // Easing: easeOutExpo
    const easeOutExpo = (x: number): number => {
      return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    };

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeOutExpo(progress);

      const current = Math.round(startValRef.current + diff * easedProgress);
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
        setIsPopping(true);
        if (onComplete) onComplete();
        setTimeout(() => setIsPopping(false), 400);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value, duration]);

  const formattedNumber = formatThousands
    ? Math.abs(displayValue).toLocaleString('en-US')
    : Math.abs(displayValue).toString();

  const sign = displayValue < 0 ? '-' : displayValue > 0 && prefix === '+' ? '+' : '';
  const finalPrefix = prefix === '-' || prefix === '+' ? sign : prefix;

  return (
    <span
      className={`inline-block font-mono tracking-wider tabular-nums transition-transform duration-200 ${
        isPopping ? 'scale-110 drop-shadow-[0_0_12px_var(--glow)]' : ''
      } ${className}`}
      style={{
        // @ts-ignore
        '--glow': glowColor,
      }}
    >
      <span className="opacity-90">{finalPrefix}</span>
      <span>{formattedNumber}</span>
      <span className="opacity-90 text-[0.85em] ml-0.5">{suffix}</span>
    </span>
  );
}

/**
 * Hook for components needing animated numbers
 */
export function useOdometer(targetValue: number, duration = 800) {
  const [val, setVal] = useState(targetValue);
  const prevRef = useRef(targetValue);

  useEffect(() => {
    const start = prevRef.current;
    const diff = targetValue - start;
    if (diff === 0) return;

    let startTimestamp: number | null = null;
    let frame: number;

    const tick = (now: number) => {
      if (!startTimestamp) startTimestamp = now;
      const elapsed = now - startTimestamp;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setVal(Math.round(start + diff * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setVal(targetValue);
        prevRef.current = targetValue;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targetValue, duration]);

  return val;
}
