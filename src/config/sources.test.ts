// src/config/sources.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SourceManager, { AVAILABLE_SOURCES } from './sources.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('AVAILABLE_SOURCES', () => {
  it('should have free sources', () => {
    const freeSources = AVAILABLE_SOURCES.filter(s => s.type === 'free');

    expect(freeSources.length).toBeGreaterThan(0);
    expect(freeSources.some(s => s.id === 'sundell')).toBe(true);
    expect(freeSources.some(s => s.id === 'vanderlee')).toBe(true);
    expect(freeSources.some(s => s.id === 'nilcoalescing')).toBe(true);
    expect(freeSources.some(s => s.id === 'pointfree')).toBe(true);
  });

  it('should have premium sources', () => {
    const premiumSources = AVAILABLE_SOURCES.filter(s => s.type === 'premium');

    expect(premiumSources.length).toBeGreaterThan(0);
    expect(premiumSources.some(s => s.id === 'patreon')).toBe(true);
  });

  it('should have required fields for all sources', () => {
    for (const source of AVAILABLE_SOURCES) {
      expect(source.id).toBeDefined();
      expect(source.name).toBeDefined();
      expect(source.description).toBeDefined();
      expect(source.type).toMatch(/^(free|premium)$/);
      expect(typeof source.enabled).toBe('boolean');
      expect(typeof source.requiresAuth).toBe('boolean');
    }
  });

  it('should have free sources enabled by default', () => {
    const freeSources = AVAILABLE_SOURCES.filter(s => s.type === 'free');

    for (const source of freeSources) {
      expect(source.enabled).toBe(true);
    }
  });

  it('should have premium sources disabled by default', () => {
    const premiumSources = AVAILABLE_SOURCES.filter(s => s.type === 'premium');

    for (const source of premiumSources) {
      expect(source.enabled).toBe(false);
    }
  });

  it('should have configKeys for auth-required sources', () => {
    const authSources = AVAILABLE_SOURCES.filter(s => s.requiresAuth);

    for (const source of authSources) {
      expect(source.configKeys).toBeDefined();
      expect(source.configKeys!.length).toBeGreaterThan(0);
    }
  });
});

describe('SourceManager', () => {
  let tempConfigPath: string;
  let manager: SourceManager;

  beforeEach(() => {
    // Create a temp config path for testing
    tempConfigPath = path.join(os.tmpdir(), `swift-patterns-mcp-test-${Date.now()}.json`);
    manager = new SourceManager(tempConfigPath);
  });

  afterEach(() => {
    // Clean up temp file
    try {
      fs.unlinkSync(tempConfigPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('getSource', () => {
    it('should return source by id', () => {
      const source = manager.getSource('sundell');

      expect(source).toBeDefined();
      expect(source?.id).toBe('sundell');
      expect(source?.name).toBe('Swift by Sundell');
    });

    it('should return undefined for unknown source', () => {
      const source = manager.getSource('nonexistent');

      expect(source).toBeUndefined();
    });
  });

  describe('getAllSources', () => {
    it('should return all sources with status', () => {
      const sources = manager.getAllSources();

      expect(sources.length).toBe(AVAILABLE_SOURCES.length);
      for (const source of sources) {
        expect(source).toHaveProperty('isEnabled');
        expect(source).toHaveProperty('isConfigured');
      }
    });

    it('should show free sources as configured', () => {
      const sources = manager.getAllSources();
      const freeSources = sources.filter(s => s.type === 'free');

      for (const source of freeSources) {
        expect(source.isConfigured).toBe(true);
      }
    });
  });

  describe('getEnabledSources', () => {
    it('should return only enabled and configured sources', () => {
      const enabled = manager.getEnabledSources();

      for (const source of enabled) {
        expect(source.enabled).toBe(true);
      }
    });

    it('should include free sources by default', () => {
      const enabled = manager.getEnabledSources();
      const ids = enabled.map(s => s.id);

      expect(ids).toContain('sundell');
      expect(ids).toContain('vanderlee');
      expect(ids).toContain('nilcoalescing');
      expect(ids).toContain('pointfree');
    });
  });

  describe('getSourcesByType', () => {
    it('should filter by free type', () => {
      const freeSources = manager.getSourcesByType('free');

      expect(freeSources.length).toBeGreaterThan(0);
      for (const source of freeSources) {
        expect(source.type).toBe('free');
      }
    });

    it('should filter by premium type', () => {
      const premiumSources = manager.getSourcesByType('premium');

      expect(premiumSources.length).toBeGreaterThan(0);
      for (const source of premiumSources) {
        expect(source.type).toBe('premium');
      }
    });
  });

  describe('enableSource', () => {
    it('should enable a free source', () => {
      const result = manager.enableSource('sundell');

      expect(result).toBe(true);
    });

    it('should return false for unknown source', () => {
      const result = manager.enableSource('nonexistent');

      expect(result).toBe(false);
    });

    it('should throw for unconfigured premium source', () => {
      expect(() => manager.enableSource('patreon')).toThrow(/requires configuration/);
    });
  });

  describe('disableSource', () => {
    it('should disable a source', () => {
      manager.enableSource('sundell');
      const result = manager.disableSource('sundell');

      expect(result).toBe(true);
    });

    it('should return false for unknown source', () => {
      const result = manager.disableSource('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('isSourceConfigured', () => {
    it('should return true for free sources', () => {
      const configured = manager.isSourceConfigured('sundell');

      expect(configured).toBe(true);
    });

    it('should return false for unconfigured premium sources', () => {
      const configured = manager.isSourceConfigured('patreon');

      expect(configured).toBe(false);
    });

    it('should return true for non-auth sources', () => {
      const configured = manager.isSourceConfigured('vanderlee');

      expect(configured).toBe(true);
    });
  });

  describe('markSourceConfigured', () => {
    it('should mark source as configured', () => {
      manager.markSourceConfigured('patreon');

      // After marking, the config should be saved
      // We can verify by creating a new manager with the same path
      const newManager = new SourceManager(tempConfigPath);
      const sources = newManager.getAllSources();
      const patreon = sources.find(s => s.id === 'patreon');

      expect(patreon?.isEnabled).toBe(true);
    });
  });

  describe('config persistence', () => {
    it('should save and load config', () => {
      manager.enableSource('sundell');
      manager.disableSource('vanderlee');

      // Create new manager with same path
      const newManager = new SourceManager(tempConfigPath);
      const sources = newManager.getAllSources();

      const sundell = sources.find(s => s.id === 'sundell');
      const vanderlee = sources.find(s => s.id === 'vanderlee');

      expect(sundell?.isEnabled).toBe(true);
      expect(vanderlee?.isEnabled).toBe(false);
    });

    it('should handle missing config file gracefully', () => {
      const missingPath = path.join(os.tmpdir(), 'nonexistent-config.json');
      const newManager = new SourceManager(missingPath);

      // Should use defaults
      const sources = newManager.getAllSources();
      expect(sources.length).toBe(AVAILABLE_SOURCES.length);
    });
  });
});
