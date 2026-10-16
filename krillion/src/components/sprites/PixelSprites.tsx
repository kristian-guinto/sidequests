'use client';

import React from 'react';
import { TierId } from '@/lib/types';

interface SpriteBaseProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

export interface SubmarineSpriteProps extends SpriteBaseProps {
  depthMeters?: number;
}

/**
 * Retro Pixel Submarine / Bathyscaphe (Yellow & Cyan)
 * Features spinning rear propeller, viewport, periscope, and a glowing headlight cone
 * whose brightness and reach scale with depthMeters.
 */
export function SubmarineSprite({
  size = 48,
  depthMeters = 0,
  animate = true,
  className = '',
}: SubmarineSpriteProps) {
  // Headlight brightness increases as we go deeper into the trench
  const depthFactor = Math.min(1, Math.max(0, depthMeters / 7000));
  const beamOpacity = 0.25 + depthFactor * 0.55;
  const beamLength = 40 + depthFactor * 60;

  return (
    <div
      className={`relative inline-flex items-center ${animate ? 'animate-pixel-bob' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 40 24"
        width={size}
        height={(size * 24) / 40}
        className="pixelated overflow-visible"
        shapeRendering="crispEdges"
      >
        <defs>
          {/* Headlight beam gradient */}
          <linearGradient id="headlight-beam" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#4de3ff" stopOpacity={beamOpacity} />
            <stop offset="60%" stopColor="#ffd166" stopOpacity={beamOpacity * 0.5} />
            <stop offset="100%" stopColor="#ffd166" stopOpacity="0" />
          </linearGradient>
          {/* Hull metal sheen */}
          <linearGradient id="sub-hull" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="60%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
        </defs>

        {/* Dynamic Headlight Cone projecting forward */}
        <polygon
          points={`32,12 ${32 + beamLength},${12 - beamLength * 0.35} ${32 + beamLength},${12 + beamLength * 0.35}`}
          fill="url(#headlight-beam)"
          className="pointer-events-none"
        />

        {/* Periscope / Antenna */}
        <rect x="18" y="2" width="2" height="4" fill="#94a3b8" />
        <rect x="18" y="1" width="4" height="2" fill="#0284c7" />
        <rect x="21" y="1" width="1" height="2" fill="#38bdf8" />

        {/* Conning tower / Sail */}
        <rect x="15" y="5" width="8" height="4" fill="#ca8a04" />
        <rect x="16" y="6" width="6" height="3" fill="#eab308" />

        {/* Main Submarine Hull (Rounded pixel bathyscaphe) */}
        <rect x="6" y="8" width="26" height="11" fill="url(#sub-hull)" rx="1" />
        <rect x="8" y="7" width="22" height="1" fill="#fef08a" />
        <rect x="7" y="19" width="24" height="1" fill="#a16207" />
        <rect x="32" y="10" width="1" height="7" fill="#ca8a04" />

        {/* Cyan Porthole / Viewport */}
        <rect x="22" y="10" width="6" height="6" fill="#0369a1" />
        <rect x="23" y="11" width="4" height="4" fill="#38bdf8" />
        <rect x="24" y="11" width="2" height="2" fill="#e0f2fe" />

        {/* Second Viewport */}
        <rect x="14" y="11" width="4" height="4" fill="#0369a1" />
        <rect x="15" y="12" width="2" height="2" fill="#38bdf8" />

        {/* Headlight Lamp Fixture on Bow */}
        <rect x="31" y="11" width="2" height="3" fill="#0f172a" />
        <rect x="32" y="11" width="1" height="3" fill="#fde047" />

        {/* Rear Propeller Shaft & Blades */}
        <rect x="3" y="12" width="3" height="2" fill="#64748b" />
        {/* Spinning propeller blades */}
        <g className={animate ? 'origin-[3px_13px]' : ''}>
          <rect x="1" y="8" width="2" height="5" fill="#94a3b8" />
          <rect x="1" y="13" width="2" height="5" fill="#cbd5e1" />
          <rect x="2" y="10" width="1" height="6" fill="#f1f5f9" />
        </g>

        {/* Tiny exhaust bubbles behind */}
        {animate && (
          <g className="animate-bubble-rise opacity-70">
            <rect x="0" y="11" width="1.5" height="1.5" fill="#a5f3fc" />
            <rect x="-3" y="9" width="1" height="1" fill="#e0f2fe" />
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * Tier: Plankton (🫧)
 * Cute glowing microscopic pixel copepod with blue-cyan antennae.
 */
function PlanktonSprite({ size = 48, animate = true, className = '' }: SpriteBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`pixelated ${animate ? 'animate-pixel-bob' : ''} ${className}`}
      shapeRendering="crispEdges"
    >
      {/* Outer Glow Halo */}
      <circle cx="12" cy="12" r="9" fill="#8fa3c4" fillOpacity="0.15" />

      {/* Antennae */}
      <rect x="5" y="4" width="2" height="2" fill="#a5f3fc" />
      <rect x="7" y="5" width="2" height="2" fill="#38bdf8" />
      <rect x="9" y="7" width="2" height="2" fill="#38bdf8" />

      <rect x="17" y="4" width="2" height="2" fill="#a5f3fc" />
      <rect x="15" y="5" width="2" height="2" fill="#38bdf8" />
      <rect x="13" y="7" width="2" height="2" fill="#38bdf8" />

      {/* Main Plankton Body */}
      <rect x="9" y="8" width="6" height="9" fill="#8fa3c4" />
      <rect x="10" y="9" width="4" height="7" fill="#bae6fd" />

      {/* Glowing Inner Core */}
      <rect x="11" y="10" width="2" height="4" fill="#38bdf8" />

      {/* Little red eye dot */}
      <rect x="11" y="10" width="2" height="1" fill="#f43f5e" />

      {/* Swimming Bristles / Legs */}
      <rect x="7" y="10" width="2" height="1" fill="#a5f3fc" />
      <rect x="6" y="12" width="3" height="1" fill="#a5f3fc" />
      <rect x="7" y="14" width="2" height="1" fill="#a5f3fc" />

      <rect x="15" y="10" width="2" height="1" fill="#a5f3fc" />
      <rect x="15" y="12" width="3" height="1" fill="#a5f3fc" />
      <rect x="15" y="14" width="2" height="1" fill="#a5f3fc" />

      {/* Tail Bristles */}
      <rect x="10" y="17" width="1" height="3" fill="#38bdf8" />
      <rect x="13" y="17" width="1" height="3" fill="#38bdf8" />
      <rect x="11" y="18" width="2" height="2" fill="#a5f3fc" />
    </svg>
  );
}

/**
 * Tier: Too Clever (🤡)
 * Cheeky orange-and-white pixel clownfish wearing a jaunty jester hat.
 */
function TooCleverSprite({ size = 48, animate = true, className = '' }: SpriteBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`pixelated ${animate ? 'animate-clown-wobble' : ''} ${className}`}
      shapeRendering="crispEdges"
    >
      {/* Jester Cap on top */}
      <rect x="7" y="2" width="2" height="2" fill="#ffd166" />
      <rect x="8" y="3" width="3" height="3" fill="#9d7bff" />
      <rect x="13" y="2" width="2" height="2" fill="#ffd166" />
      <rect x="12" y="3" width="3" height="3" fill="#ff5252" />
      <rect x="9" y="6" width="6" height="2" fill="#9d7bff" />

      {/* Clownfish Main Body (Orange) */}
      <rect x="6" y="8" width="13" height="10" fill="#ff9f43" />
      <rect x="7" y="7" width="10" height="1" fill="#f97316" />
      <rect x="7" y="18" width="10" height="1" fill="#c2410c" />

      {/* White Stripes with Black Borders */}
      {/* Stripe 1 (behind eye) */}
      <rect x="13" y="8" width="2" height="9" fill="#ffffff" />
      <rect x="12" y="8" width="1" height="9" fill="#0f172a" />
      <rect x="15" y="8" width="1" height="9" fill="#0f172a" />

      {/* Stripe 2 (mid-body) */}
      <rect x="9" y="9" width="2" height="7" fill="#ffffff" />
      <rect x="8" y="9" width="1" height="7" fill="#0f172a" />
      <rect x="11" y="9" width="1" height="7" fill="#0f172a" />

      {/* Eye and Cheeky Smirk */}
      <rect x="16" y="9" width="2" height="2" fill="#ffffff" />
      <rect x="17" y="10" width="1" height="1" fill="#0f172a" />
      <rect x="18" y="13" width="2" height="1" fill="#0f172a" />
      <rect x="17" y="14" width="1" height="1" fill="#0f172a" />

      {/* Tail Fin */}
      <rect x="3" y="10" width="3" height="5" fill="#ff9f43" />
      <rect x="2" y="9" width="2" height="2" fill="#ff9f43" />
      <rect x="2" y="14" width="2" height="2" fill="#ff9f43" />
      <rect x="5" y="10" width="1" height="5" fill="#ffffff" />

      {/* Ventral & Pectoral Fins */}
      <rect x="11" y="17" width="3" height="3" fill="#ff9f43" />
      <rect x="13" y="13" width="3" height="2" fill="#fb923c" />
    </svg>
  );
}

/**
 * Tier: Schooler (🐟)
 * Shimmering silver-cyan Bangus (milkfish) swimming with 2 mini companion fish.
 */
function SchoolerSprite({ size = 48, animate = true, className = '' }: SpriteBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`pixelated ${animate ? 'animate-pixel-bob' : ''} ${className}`}
      shapeRendering="crispEdges"
    >
      {/* Mini Companion Fish 1 (Top left) */}
      <g className={animate ? 'animate-pulse' : ''}>
        <rect x="2" y="4" width="4" height="2" fill="#38bdf8" />
        <rect x="1" y="4" width="1" height="2" fill="#0284c7" />
        <rect x="5" y="4" width="1" height="1" fill="#0f172a" />
      </g>

      {/* Mini Companion Fish 2 (Bottom left) */}
      <g className={animate ? 'animate-pulse' : ''}>
        <rect x="4" y="18" width="4" height="2" fill="#38bdf8" />
        <rect x="3" y="18" width="1" height="2" fill="#0284c7" />
        <rect x="7" y="18" width="1" height="1" fill="#0f172a" />
      </g>

      {/* Lead Fish - Bangus Torpedo Body */}
      <rect x="8" y="9" width="11" height="6" fill="#4de3ff" />
      <rect x="9" y="8" width="8" height="1" fill="#0284c7" />
      <rect x="9" y="15" width="8" height="1" fill="#0369a1" />

      {/* Silvery belly sheen */}
      <rect x="10" y="11" width="8" height="3" fill="#e0f2fe" />
      <rect x="11" y="12" width="6" height="1" fill="#ffffff" />

      {/* Head & Eye */}
      <rect x="19" y="10" width="3" height="4" fill="#38bdf8" />
      <rect x="21" y="11" width="1" height="2" fill="#0284c7" />
      <rect x="19" y="10" width="1" height="1" fill="#0f172a" />
      <rect x="18" y="10" width="1" height="1" fill="#ffffff" />

      {/* Deeply Forked Bangus Caudal Tail */}
      <rect x="6" y="11" width="2" height="2" fill="#0284c7" />
      <rect x="4" y="9" width="2" height="2" fill="#38bdf8" />
      <rect x="3" y="8" width="2" height="2" fill="#4de3ff" />
      <rect x="4" y="13" width="2" height="2" fill="#38bdf8" />
      <rect x="3" y="14" width="2" height="2" fill="#4de3ff" />

      {/* Dorsal Fin */}
      <rect x="12" y="6" width="3" height="2" fill="#0284c7" />
      <rect x="13" y="5" width="2" height="1" fill="#38bdf8" />
    </svg>
  );
}

/**
 * Tier: Rare (🦑)
 * Bioluminescent coral-red giant squid with animated wavy tentacles.
 */
function RareSquidSprite({ size = 48, animate = true, className = '' }: SpriteBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`pixelated ${animate ? 'animate-pixel-bob' : ''} ${className}`}
      shapeRendering="crispEdges"
    >
      {/* Outer Bioluminescent Aura */}
      <circle cx="12" cy="11" r="10" fill="#ff5252" fillOpacity="0.12" />

      {/* Mantle Fin Wings */}
      <polygon points="12,1 6,6 18,6" fill="#dc2626" />
      <polygon points="12,2 8,6 16,6" fill="#ff5252" />

      {/* Torpedo Mantle */}
      <rect x="8" y="6" width="8" height="7" fill="#ff5252" />
      <rect x="9" y="6" width="6" height="6" fill="#f87171" />

      {/* Bioluminescent spots on mantle */}
      <rect x="10" y="8" width="1" height="1" fill="#fef08a" />
      <rect x="13" y="7" width="1" height="1" fill="#4de3ff" />
      <rect x="11" y="10" width="1" height="1" fill="#4de3ff" />

      {/* Head & Giant Abyssal Eyes */}
      <rect x="7" y="13" width="10" height="3" fill="#b91c1c" />
      <rect x="7" y="13" width="2" height="2" fill="#4de3ff" />
      <rect x="8" y="13" width="1" height="1" fill="#0f172a" />
      <rect x="15" y="13" width="2" height="2" fill="#4de3ff" />
      <rect x="15" y="13" width="1" height="1" fill="#0f172a" />

      {/* 8 Tentacles */}
      <rect x="8" y="16" width="1" height="4" fill="#dc2626" />
      <rect x="7" y="19" width="1" height="2" fill="#ff5252" />

      <rect x="10" y="16" width="1" height="5" fill="#ef4444" />
      <rect x="11" y="20" width="1" height="2" fill="#fca5a5" />

      <rect x="13" y="16" width="1" height="5" fill="#ef4444" />
      <rect x="12" y="20" width="1" height="2" fill="#fca5a5" />

      <rect x="15" y="16" width="1" height="4" fill="#dc2626" />
      <rect x="16" y="19" width="1" height="2" fill="#ff5252" />

      {/* Long Feeding Tentacles */}
      <rect x="6" y="16" width="1" height="7" fill="#b91c1c" />
      <rect x="5" y="22" width="2" height="2" fill="#fef08a" />

      <rect x="17" y="16" width="1" height="7" fill="#b91c1c" />
      <rect x="17" y="22" width="2" height="2" fill="#fef08a" />
    </svg>
  );
}

/**
 * Tier: Deep Cut (🏮)
 * Spooky abyssal purple anglerfish with needle teeth and a glowing lantern lure.
 */
function DeepCutSprite({ size = 48, animate = true, className = '' }: SpriteBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`pixelated ${animate ? 'animate-pixel-bob' : ''} ${className}`}
      shapeRendering="crispEdges"
    >
      {/* Glowing Lantern Halo */}
      <circle cx="19" cy="4" r="4" fill="#4de3ff" fillOpacity="0.3" className={animate ? 'animate-pulse' : ''} />
      <circle cx="19" cy="4" r="2" fill="#ffd166" fillOpacity="0.5" />

      {/* Dangling Illicium / Lure stalk */}
      <rect x="11" y="6" width="1" height="2" fill="#9d7bff" />
      <rect x="12" y="4" width="2" height="2" fill="#9d7bff" />
      <rect x="14" y="3" width="3" height="1" fill="#9d7bff" />
      <rect x="17" y="3" width="1" height="2" fill="#a855f7" />
      {/* Glowing Esca bulb */}
      <rect x="18" y="3" width="2" height="2" fill="#4de3ff" />
      <rect x="18.5" y="3.5" width="1" height="1" fill="#ffffff" />

      {/* Bulky Purple Anglerfish Body */}
      <rect x="6" y="8" width="11" height="9" fill="#7e22ce" />
      <rect x="7" y="7" width="9" height="1" fill="#9d7bff" />
      <rect x="8" y="9" width="8" height="6" fill="#9d7bff" />

      {/* Dead/Milky Abyssal Eye */}
      <rect x="13" y="9" width="2" height="2" fill="#cbd5e1" />
      <rect x="14" y="10" width="1" height="1" fill="#475569" />

      {/* Massive Jagged Underbite Jaws with Needle Teeth */}
      <rect x="12" y="13" width="6" height="4" fill="#3b0764" />
      {/* Lower jaw extending forward */}
      <rect x="14" y="16" width="5" height="2" fill="#581c87" />

      {/* Sharp white needle teeth */}
      <rect x="13" y="13" width="1" height="2" fill="#ffffff" />
      <rect x="15" y="13" width="1" height="2" fill="#ffffff" />
      <rect x="14" y="15" width="1" height="2" fill="#ffffff" />
      <rect x="16" y="15" width="1" height="2" fill="#ffffff" />
      <rect x="18" y="15" width="1" height="2" fill="#ffffff" />

      {/* Spiny Dorsal & Tail Fins */}
      <rect x="4" y="10" width="2" height="4" fill="#6b21a8" />
      <rect x="2" y="9" width="2" height="2" fill="#9d7bff" />
      <rect x="2" y="13" width="2" height="2" fill="#9d7bff" />
      <rect x="9" y="17" width="2" height="3" fill="#6b21a8" />
    </svg>
  );
}

/**
 * Tier: One in a Krillion (🌟)
 * Legendary golden crowned pixel Krill surrounded by twinkling stars.
 */
function KrillionSprite({ size = 48, animate = true, className = '' }: SpriteBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`pixelated ${animate ? 'animate-krillion-shockwave' : ''} ${className}`}
      shapeRendering="crispEdges"
    >
      {/* Golden Radiance Aura */}
      <circle cx="12" cy="12" r="10" fill="#ffd166" fillOpacity="0.25" />

      {/* Twinkling Pixel Stars in corners */}
      <rect x="2" y="3" width="2" height="2" fill="#ffd166" className={animate ? 'animate-pulse' : ''} />
      <rect x="20" y="4" width="2" height="2" fill="#fef08a" className={animate ? 'animate-pulse' : ''} />
      <rect x="1" y="18" width="2" height="2" fill="#fef08a" className={animate ? 'animate-pulse' : ''} />
      <rect x="21" y="17" width="2" height="2" fill="#ffd166" className={animate ? 'animate-pulse' : ''} />

      {/* Royal 3-Point Gold Crown */}
      <rect x="13" y="3" width="1" height="2" fill="#f59e0b" />
      <rect x="15" y="2" width="1" height="3" fill="#ffd166" />
      <rect x="17" y="3" width="1" height="2" fill="#f59e0b" />
      <rect x="13" y="5" width="5" height="1" fill="#f59e0b" />
      <rect x="15" y="4" width="1" height="1" fill="#ef4444" /> {/* Crown Ruby */}

      {/* Curved Golden Krill Shell Segments */}
      <rect x="12" y="6" width="6" height="5" fill="#ffd166" />
      <rect x="13" y="7" width="4" height="3" fill="#fef08a" />

      <rect x="9" y="9" width="5" height="4" fill="#fbbf24" />
      <rect x="7" y="11" width="4" height="4" fill="#f59e0b" />
      <rect x="5" y="13" width="4" height="3" fill="#d97706" />

      {/* Big joyful shining eye */}
      <rect x="16" y="8" width="2" height="2" fill="#0f172a" />
      <rect x="16" y="8" width="1" height="1" fill="#ffffff" />

      {/* Long Golden Feathery Antennae */}
      <rect x="18" y="7" width="4" height="1" fill="#ffd166" />
      <rect x="21" y="6" width="2" height="1" fill="#fde047" />
      <rect x="18" y="9" width="3" height="1" fill="#fbbf24" />

      {/* Swimmerets / Pleopods */}
      <rect x="7" y="15" width="1" height="3" fill="#fef08a" />
      <rect x="9" y="14" width="1" height="3" fill="#fef08a" />
      <rect x="11" y="13" width="1" height="3" fill="#fef08a" />
      <rect x="13" y="12" width="1" height="3" fill="#fef08a" />

      {/* Fan Tail / Telson */}
      <rect x="3" y="14" width="2" height="3" fill="#f59e0b" />
      <rect x="2" y="15" width="2" height="1" fill="#ffd166" />
    </svg>
  );
}

/**
 * Tier: Miss / Drifted
 * Popped pixel air bubble and rusty anchor.
 */
function MissSprite({ size = 48, animate = false, className = '' }: SpriteBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`pixelated ${className}`}
      shapeRendering="crispEdges"
    >
      {/* Popped bubble burst particles */}
      <rect x="6" y="4" width="1.5" height="1.5" fill="#64748b" />
      <rect x="16" y="5" width="1.5" height="1.5" fill="#64748b" />
      <rect x="4" y="11" width="1.5" height="1.5" fill="#94a3b8" />
      <rect x="18" y="10" width="1.5" height="1.5" fill="#94a3b8" />

      {/* Rusty Anchor */}
      {/* Ring at top */}
      <rect x="10" y="5" width="4" height="1" fill="#475569" />
      <rect x="10" y="7" width="4" height="1" fill="#475569" />
      <rect x="9" y="5" width="1" height="3" fill="#475569" />
      <rect x="14" y="5" width="1" height="3" fill="#475569" />

      {/* Crossbar */}
      <rect x="7" y="9" width="10" height="2" fill="#64748b" />
      <rect x="6" y="9" width="1" height="2" fill="#334155" />
      <rect x="17" y="9" width="1" height="2" fill="#334155" />

      {/* Main Shank */}
      <rect x="11" y="8" width="2" height="10" fill="#64748b" />

      {/* Curved Flukes */}
      <rect x="8" y="17" width="8" height="2" fill="#475569" />
      <rect x="6" y="15" width="2" height="3" fill="#64748b" />
      <rect x="5" y="13" width="2" height="3" fill="#94a3b8" />
      <rect x="16" y="15" width="2" height="3" fill="#64748b" />
      <rect x="17" y="13" width="2" height="3" fill="#94a3b8" />
    </svg>
  );
}

export interface TierPixelSpriteProps {
  tier: TierId;
  size?: number;
  animate?: boolean;
  className?: string;
}

/**
 * Universal Tier Sprite Renderer
 * Dispatches to the corresponding pixel-art sea creature.
 */
export function TierPixelSprite({
  tier,
  size = 48,
  animate = true,
  className = '',
}: TierPixelSpriteProps) {
  switch (tier) {
    case 'plankton':
      return <PlanktonSprite size={size} animate={animate} className={className} />;
    case 'tooclever':
      return <TooCleverSprite size={size} animate={animate} className={className} />;
    case 'schooler':
      return <SchoolerSprite size={size} animate={animate} className={className} />;
    case 'rare':
      return <RareSquidSprite size={size} animate={animate} className={className} />;
    case 'deepcut':
      return <DeepCutSprite size={size} animate={animate} className={className} />;
    case 'krillion':
      return <KrillionSprite size={size} animate={animate} className={className} />;
    case 'miss':
    default:
      return <MissSprite size={size} animate={animate} className={className} />;
  }
}
