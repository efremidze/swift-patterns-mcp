#!/usr/bin/env node

// src/index.ts

import 'dotenv/config';
import { routeCli } from './cli/router.js';

// Route CLI commands first
const handled = await routeCli();
if (handled) {
  process.exit(0);
}

// No CLI command - start MCP server
const { startServer } = await import('./server.js');
await startServer();
