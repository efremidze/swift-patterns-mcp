import pino from 'pino';

const logger = pino.default({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'swift-patterns-mcp',
  },
});

export default logger;
