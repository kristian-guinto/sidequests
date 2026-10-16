'use client';

import React, { useMemo } from 'react';
import { TierId } from '@/lib/types';

interface OceanEnvironmentProps {
  depthMeters: number;
  isPlunging: boolean;
  lastTier?: TierId | null;
}

interface DepthZoneConfig {
  name: string;
  location: string;
  range: string;
  topColor: string;
  midColor: string;
  bottomColor: string;
  showSunbeams: boolean;
  sunbeamOpacity: number;
  showMarineSnow: boolean;
  showBiolum: boolean;
  showHydrothermal: boolean;
}

export function OceanEnvironment({
  depthMeters,
  isPlunging,
  lastTier,
}: OceanEnvironmentProps) {
  // Determine current depth zone config
  const zone: DepthZoneConfig = useMemo(() => {
    if (depthMeters <= 600) {
      const sunFade = Math.max(0.2, 1 - (depthMeters / 600) * 0.7);
      return {
        name: 'SUNLIGHT ZONE (EPIPELAGIC)',
        location: 'Tubbataha Reefs · Coral Shelf',
        range: '0m – 600m',
        topColor: '#062c43',
        midColor: '#051f38',
        bottomColor: '#05192d',
        showSunbeams: true,
        sunbeamOpacity: sunFade,
        showMarineSnow: false,
        showBiolum: false,
        showHydrothermal: false,
      };
    } else if (depthMeters <= 2000) {
      const sunFade = Math.max(0, 0.3 - ((depthMeters - 600) / 1400) * 0.3);
      return {
        name: 'TWILIGHT ZONE (MESOPELAGIC)',
        location: 'Verde Island Passage · Submerged Ridges',
        range: '600m – 2,000m',
        topColor: '#04162a',
        midColor: '#030f20',
        bottomColor: '#030b1a',
        showSunbeams: sunFade > 0.05,
        sunbeamOpacity: sunFade,
        showMarineSnow: true,
        showBiolum: false,
        showHydrothermal: false,
      };
    } else if (depthMeters <= 4500) {
      return {
        name: 'MIDNIGHT ZONE (BATHYPELAGIC)',
        location: 'Philippine Sea · Abyssal Slopes',
        range: '2,000m – 4,500m',
        topColor: '#020a16',
        midColor: '#010610',
        bottomColor: '#01040a',
        showSunbeams: false,
        sunbeamOpacity: 0,
        showMarineSnow: true,
        showBiolum: true,
        showHydrothermal: false,
      };
    } else {
      return {
        name: 'HADAL ZONE (EMDEN DEEP)',
        location: 'Philippine Trench Floor · 10,540m Chasm',
        range: '4,500m – 7,000m+',
        topColor: '#010206',
        midColor: '#05020c',
        bottomColor: '#090314',
        showSunbeams: false,
        sunbeamOpacity: 0,
        showMarineSnow: false,
        showBiolum: true,
        showHydrothermal: true,
      };
    }
  }, [depthMeters]);

  // Color for the dive plunge shockwave
  const shockwaveColor = useMemo(() => {
    switch (lastTier) {
      case 'krillion':
        return '#ffd166';
      case 'deepcut':
        return '#9d7bff';
      case 'rare':
        return '#ff5252';
      case 'schooler':
        return '#4de3ff';
      case 'tooclever':
        return '#ff9f43';
      case 'plankton':
        return '#8fa3c4';
      case 'miss':
      default:
        return '#64748b';
    }
  }, [lastTier]);

  return (
    <div
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden transition-colors duration-1000"
      style={{
        background: `linear-gradient(to bottom, ${zone.topColor} 0%, ${zone.midColor} 50%, ${zone.bottomColor} 100%)`,
      }}
    >
      {/* 1. Subtle Sonar Grid & CRT Scanlines */}
      <div className="absolute inset-0 sonar-grid opacity-60" />
      <div className="absolute inset-0 crt-scanlines opacity-40" />

      {/* 2. Sunlight Zone: Diagonal Pixel Sunbeams from surface */}
      {zone.showSunbeams && (
        <div
          className="absolute inset-0 transition-opacity duration-1000 pointer-events-none"
          style={{ opacity: zone.sunbeamOpacity }}
        >
          <svg className="w-full h-96 opacity-40" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sunbeam-grad" x1="0%" y1="0%" x2="40%" y2="100%">
                <stop offset="0%" stopColor="#4de3ff" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#4de3ff" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#4de3ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points="10%,0 25%,0 40%,100% 15%,100%" fill="url(#sunbeam-grad)" />
            <polygon points="45%,0 65%,0 85%,100% 55%,100%" fill="url(#sunbeam-grad)" />
            <polygon points="75%,0 90%,0 100%,100% 80%,100%" fill="url(#sunbeam-grad)" />
          </svg>
        </div>
      )}

      {/* 3. Rising Pixel Bubbles (Standard or Plunge Speed) */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Particle column 1 */}
        <div
          className={`absolute left-[12%] bottom-0 w-2 h-2 rounded-none bg-cyan-300/60 pixelated ${
            isPlunging ? 'animate-plunge-rush' : 'animate-bubble-rise'
          }`}
          style={{ animationDelay: '0.2s', animationDuration: isPlunging ? '0.4s' : '5.5s' }}
        />
        {/* Particle column 2 */}
        <div
          className={`absolute left-[28%] bottom-0 w-3 h-3 rounded-none bg-sky-200/50 pixelated ${
            isPlunging ? 'animate-plunge-rush' : 'animate-bubble-rise'
          }`}
          style={{ animationDelay: '1.4s', animationDuration: isPlunging ? '0.35s' : '7.2s' }}
        />
        {/* Particle column 3 */}
        <div
          className={`absolute left-[45%] bottom-0 w-1.5 h-1.5 rounded-none bg-cyan-200/70 pixelated ${
            isPlunging ? 'animate-plunge-rush' : 'animate-bubble-rise'
          }`}
          style={{ animationDelay: '0.8s', animationDuration: isPlunging ? '0.45s' : '6.0s' }}
        />
        {/* Particle column 4 */}
        <div
          className={`absolute left-[68%] bottom-0 w-2.5 h-2.5 rounded-none bg-blue-300/50 pixelated ${
            isPlunging ? 'animate-plunge-rush' : 'animate-bubble-rise'
          }`}
          style={{ animationDelay: '2.1s', animationDuration: isPlunging ? '0.38s' : '6.8s' }}
        />
        {/* Particle column 5 */}
        <div
          className={`absolute left-[84%] bottom-0 w-2 h-2 rounded-none bg-cyan-400/60 pixelated ${
            isPlunging ? 'animate-plunge-rush' : 'animate-bubble-rise'
          }`}
          style={{ animationDelay: '0.5s', animationDuration: isPlunging ? '0.42s' : '5.8s' }}
        />

        {/* Extra rapid plunge streak lines when diving */}
        {isPlunging && (
          <>
            <div
              className="absolute left-[18%] bottom-0 w-0.5 h-24 bg-gradient-to-t from-cyan-400 to-transparent animate-plunge-rush"
              style={{ animationDuration: '0.25s', animationDelay: '0.05s' }}
            />
            <div
              className="absolute left-[38%] bottom-0 w-1 h-36 bg-gradient-to-t from-sky-300 to-transparent animate-plunge-rush"
              style={{ animationDuration: '0.3s', animationDelay: '0.15s' }}
            />
            <div
              className="absolute left-[58%] bottom-0 w-0.5 h-28 bg-gradient-to-t from-cyan-400 to-transparent animate-plunge-rush"
              style={{ animationDuration: '0.22s', animationDelay: '0.1s' }}
            />
            <div
              className="absolute left-[78%] bottom-0 w-1 h-40 bg-gradient-to-t from-blue-300 to-transparent animate-plunge-rush"
              style={{ animationDuration: '0.28s', animationDelay: '0.2s' }}
            />
            <div
              className="absolute left-[90%] bottom-0 w-0.5 h-20 bg-gradient-to-t from-cyan-300 to-transparent animate-plunge-rush"
              style={{ animationDuration: '0.24s', animationDelay: '0.08s' }}
            />
          </>
        )}
      </div>

      {/* 4. Twilight & Midnight: Marine Snow and Bioluminescent Specks */}
      {zone.showMarineSnow && (
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-[20%] left-[15%] w-1 h-1 bg-slate-300 rounded-none animate-pulse" />
          <div className="absolute top-[35%] left-[55%] w-1.5 h-1.5 bg-slate-400 rounded-none animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-[50%] left-[80%] w-1 h-1 bg-slate-300 rounded-none animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[70%] left-[25%] w-1 h-1 bg-slate-400 rounded-none animate-pulse" style={{ animationDelay: '0.7s' }} />
          <div className="absolute top-[85%] left-[65%] w-1.5 h-1.5 bg-slate-300 rounded-none animate-pulse" style={{ animationDelay: '1.5s' }} />
        </div>
      )}

      {/* 5. Midnight & Hadal: Pulsing Bioluminescent Specks (Cyan & Purple) */}
      {zone.showBiolum && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[25%] left-[20%] w-2 h-2 bg-cyan-400 rounded-none animate-ping opacity-60" style={{ animationDuration: '3.5s' }} />
          <div className="absolute top-[40%] left-[75%] w-1.5 h-1.5 bg-purple-400 rounded-none animate-ping opacity-50" style={{ animationDuration: '4.2s', animationDelay: '1.2s' }} />
          <div className="absolute top-[65%] left-[35%] w-2 h-2 bg-emerald-400 rounded-none animate-ping opacity-60" style={{ animationDuration: '3.8s', animationDelay: '0.6s' }} />
          <div className="absolute top-[80%] left-[85%] w-1.5 h-1.5 bg-yellow-300 rounded-none animate-ping opacity-70" style={{ animationDuration: '4.8s', animationDelay: '2.1s' }} />
        </div>
      )}

      {/* 6. Hadal Zone: Hydrothermal Vents Glow at the floor */}
      {zone.showHydrothermal && (
        <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-purple-950/40 via-amber-950/20 to-transparent pointer-events-none">
          {/* Glowing vent chimney silhouettes */}
          <div className="absolute bottom-0 left-[15%] w-12 h-24 bg-black/60 border-t-2 border-amber-500/40 shadow-[0_0_20px_rgba(255,209,102,0.2)]" />
          <div className="absolute bottom-0 right-[22%] w-16 h-32 bg-black/70 border-t-2 border-purple-500/40 shadow-[0_0_25px_rgba(157,123,255,0.25)]" />
          {/* Heat shimmering embers */}
          <div className="absolute bottom-12 left-[18%] w-2 h-2 bg-amber-400 animate-ping opacity-80" />
          <div className="absolute bottom-16 right-[25%] w-2 h-2 bg-purple-400 animate-ping opacity-75" style={{ animationDelay: '1.5s' }} />
        </div>
      )}

      {/* 7. Plunge Reveal Shockwave Sonar Ring */}
      {isPlunging && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className="w-48 h-48 rounded-full border-4 border-dashed animate-sonar-ping"
            style={{
              borderColor: shockwaveColor,
              boxShadow: `0 0 35px ${shockwaveColor}`,
            }}
          />
        </div>
      )}

      {/* 8. Retro Sonar & Depth Zone Watermark HUD */}
      <div className="absolute bottom-3 left-4 text-left pointer-events-none select-none hidden sm:block">
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
          <span className="inline-block w-2 h-2 bg-krillion-cyan rounded-none animate-ping" />
          <span className="text-slate-400 uppercase font-bold tracking-widest">{zone.name}</span>
          <span className="text-slate-600">[{zone.range}]</span>
        </div>
        <div className="text-[11px] font-mono text-slate-400 tracking-wider">
          LOC: <span className="text-slate-300">{zone.location}</span>
        </div>
      </div>

      {/* Right HUD: Coordinates & Depth Odometer watermark */}
      <div className="absolute bottom-3 right-4 text-right pointer-events-none select-none hidden sm:block font-mono text-[10px] text-slate-500">
        <div>PHILIPPINE TRENCH SECTOR 07</div>
        <div className="text-krillion-cyan font-bold tracking-wider">
          SONAR: {depthMeters.toLocaleString()}M // -{(depthMeters * 3.28084).toFixed(0)}FT
        </div>
      </div>
    </div>
  );
}
