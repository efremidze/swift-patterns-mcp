// src/config/sources.ts

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { getConfigPath } from '../utils/paths.js';

export type SourceType = 'free' | 'premium';
export type SourceStatus = 'enabled' | 'disabled' | 'not-configured';

export interface ContentSource {
  id: string;
  name: string;
  description: string;
  type: SourceType;
  enabled: boolean;
  requiresAuth: boolean;
  status: SourceStatus;
  setupFunction?: string; // Function name to call for setup
  configKeys?: string[]; // Required env vars
}

export const AVAILABLE_SOURCES: ContentSource[] = [
  // ============================================================================
  // FREE SOURCES - Always available, no authentication
  // ============================================================================
  
  {
    id: 'sundell',
    name: 'Swift by Sundell',
    description: 'In-depth Swift articles and patterns from John Sundell',
    type: 'free',
    enabled: true,
    requiresAuth: false,
    status: 'enabled',
  },
  
  {
    id: 'vanderlee',
    name: 'Antoine van der Lee',
    description: 'Practical iOS development tips and performance guides',
    type: 'free',
    enabled: true,
    requiresAuth: false,
    status: 'enabled',
  },

  {
    id: 'nilcoalescing',
    name: 'Nil Coalescing',
    description: 'SwiftUI-focused Swift patterns and tutorials from Nil Coalescing',
    type: 'free',
    enabled: true,
    requiresAuth: false,
    status: 'enabled',
  },
  
  {
    id: 'pointfree',
    name: 'Point-Free',
    description: 'Open source Swift libraries and architecture patterns',
    type: 'free',
    enabled: true,
    requiresAuth: false,
    status: 'enabled',
  },
  
  // ============================================================================
  // PREMIUM SOURCES - Optional, require authentication
  // ============================================================================
  
  {
    id: 'patreon',
    name: 'Patreon',
    description: 'Access premium content from iOS creators you support on Patreon',
    type: 'premium',
    enabled: false,
    requiresAuth: true,
    status: 'not-configured',
    setupFunction: 'setupPatreon',
    configKeys: ['PATREON_CLIENT_ID', 'PATREON_CLIENT_SECRET'],
  },
  
  // Future premium sources
  {
    id: 'github-sponsors',
    name: 'GitHub Sponsors',
    description: 'Access content from developers you sponsor on GitHub (Coming soon)',
    type: 'premium',
    enabled: false,
    requiresAuth: true,
    status: 'not-configured',
    setupFunction: 'setupGitHubSponsors',
    configKeys: ['GITHUB_TOKEN'],
  },
];

export interface SourceConfig {
  sources: Record<string, {
    enabled: boolean;
    configured: boolean;
    lastSync?: string;
  }>;
}

const sourceConfigSchema = z.object({
  sources: z.record(z.string(), z.object({
    enabled: z.boolean(),
    configured: z.boolean(),
    lastSync: z.string().optional(),
  })),
});

const DEFAULT_CONFIG: SourceConfig = {
  sources: {
    sundell: { enabled: true, configured: true },
    vanderlee: { enabled: true, configured: true },
    nilcoalescing: { enabled: true, configured: true },
    pointfree: { enabled: true, configured: true },
    patreon: { enabled: false, configured: false },
    'github-sponsors': { enabled: false, configured: false },
  },
};

export class SourceManager {
  private config: SourceConfig;
  private configPath: string;
  
  constructor(configPath?: string) {
    this.configPath = configPath || getConfigPath();
    this.config = this.loadConfig();
  }
  
  private loadConfig(): SourceConfig {
    try {
      const data = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = sourceConfigSchema.safeParse(JSON.parse(data));
      if (parsed.success) {
        return parsed.data;
      }
      return DEFAULT_CONFIG;
    } catch {
      // Default config
      return DEFAULT_CONFIG;
    }
  }
  
  private saveConfig(): void {
    const dir = path.dirname(this.configPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(this.config, null, 2)
    );
  }
  
  /**
   * Get all enabled sources
   */
  getEnabledSources(): ContentSource[] {
    return AVAILABLE_SOURCES.filter(source => {
      const config = this.config.sources[source.id];
      return config?.enabled && config?.configured;
    });
  }
  
  /**
   * Get source by ID
   */
  getSource(id: string): ContentSource | undefined {
    return AVAILABLE_SOURCES.find(s => s.id === id);
  }
  
  /**
   * Enable a source
   */
  enableSource(id: string): boolean {
    const source = this.getSource(id);
    if (!source) return false;
    
    // Check if requires configuration
    if (source.requiresAuth && !this.isSourceConfigured(id)) {
      throw new Error(
        `Source "${source.name}" requires configuration. Run: swift-patterns-mcp setup --${id}`
      );
    }
    
    if (!this.config.sources[id]) {
      this.config.sources[id] = { enabled: true, configured: !source.requiresAuth };
    } else {
      this.config.sources[id].enabled = true;
    }
    
    this.saveConfig();
    return true;
  }
  
  /**
   * Disable a source
   */
  disableSource(id: string): boolean {
    if (!this.config.sources[id]) return false;
    
    this.config.sources[id].enabled = false;
    this.saveConfig();
    return true;
  }
  
  /**
   * Check if source is configured (has credentials)
   */
  isSourceConfigured(id: string): boolean {
    const source = this.getSource(id);
    if (!source || !source.requiresAuth) return true;
    
    // Check if required config keys are present
    if (source.configKeys) {
      return source.configKeys.every(key => !!process.env[key]);
    }
    
    return this.config.sources[id]?.configured || false;
  }
  
  /**
   * Mark source as configured
   */
  markSourceConfigured(id: string): void {
    if (!this.config.sources[id]) {
      this.config.sources[id] = { enabled: true, configured: true };
    } else {
      this.config.sources[id].configured = true;
      this.config.sources[id].enabled = true;
    }
    this.saveConfig();
  }
  
  /**
   * Get all sources (for display)
   */
  getAllSources(): Array<ContentSource & { 
    isEnabled: boolean;
    isConfigured: boolean;
  }> {
    return AVAILABLE_SOURCES.map(source => ({
      ...source,
      isEnabled: this.config.sources[source.id]?.enabled || false,
      isConfigured: this.isSourceConfigured(source.id),
    }));
  }
  
  /**
   * Get sources by type
   */
  getSourcesByType(type: SourceType): ContentSource[] {
    return AVAILABLE_SOURCES.filter(s => s.type === type);
  }
}

export default SourceManager;
