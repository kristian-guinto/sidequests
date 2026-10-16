import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Mobile Ergonomics & CRT Scanlines Safety', () => {
  const globalsCssPath = path.resolve(__dirname, '../../app/globals.css');
  const activePromptCardPath = path.resolve(__dirname, '../../components/game/ActivePromptCard.tsx');
  const answerExplorerPath = path.resolve(__dirname, '../../components/game/AnswerExplorer.tsx');
  const oceanEnvironmentPath = path.resolve(__dirname, '../../components/game/OceanEnvironment.tsx');

  it('ensures .crt-scanlines in globals.css never uses pointer-events: none', () => {
    const css = fs.readFileSync(globalsCssPath, 'utf8');

    // Extract the .crt-scanlines block
    const crtMatch = css.match(/\.crt-scanlines\s*\{([^}]+)\}/);
    expect(crtMatch).not.toBeNull();

    const crtBody = crtMatch![1];
    expect(crtBody).not.toMatch(/pointer-events\s*:\s*none/i);
  });

  it('ensures ActivePromptCard input has proper mobile attributes and prevents iOS zoom', () => {
    const code = fs.readFileSync(activePromptCardPath, 'utf8');

    // Mobile text attributes to prevent auto-zoom (min 16px font-size) and auto-correct
    expect(code).toContain('inputMode="text"');
    expect(code).toContain('enterKeyHint="send"');
    expect(code).toContain('autoCapitalize="off"');
    expect(code).toContain('autoCorrect="off"');
    expect(code).toContain('text-base');
    expect(code).toContain('touch-manipulation');
  });

  it('ensures AnswerExplorer inputs avoid iOS zoom and include search attributes', () => {
    const code = fs.readFileSync(answerExplorerPath, 'utf8');

    expect(code).toContain('inputMode="search"');
    expect(code).toContain('enterKeyHint="search"');
    expect(code).toContain('text-base sm:text-sm');
    expect(code).toContain('touch-manipulation');
  });

  it('ensures OceanEnvironment overlays explicitly set pointer-events-none', () => {
    const code = fs.readFileSync(oceanEnvironmentPath, 'utf8');

    // Canvas & gradient overlays should have pointer-events-none
    expect(code).toContain('pointer-events-none');
  });
});
