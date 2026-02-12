import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetToolList = vi.hoisted(() => vi.fn());
const mockGetHandler = vi.hoisted(() => vi.fn());
const mockCreateErrorResponseFromError = vi.hoisted(() => vi.fn());
const mockPrefetchAllSources = vi.hoisted(() => vi.fn());
const mockPrefetchEmbeddingModel = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockConnect = vi.hoisted(() => vi.fn());

const handlerMap = vi.hoisted(() => new Map<unknown, (request?: any) => Promise<any>>());

const sourceManagerState = vi.hoisted(() => ({
  enabledSources: [{ id: 'sundell' }],
  patreonConfigured: false,
  prefetchEnabled: false,
  semanticEnabled: false,
}));

const sourceManagerInstances = vi.hoisted(() => [] as Array<{
  getEnabledSources: ReturnType<typeof vi.fn>;
  isSourceConfigured: ReturnType<typeof vi.fn>;
  markSourceConfigured: ReturnType<typeof vi.fn>;
  isPrefetchEnabled: ReturnType<typeof vi.fn>;
  getSemanticRecallConfig: ReturnType<typeof vi.fn>;
}>);

const listToolsSchema = vi.hoisted(() => Symbol('ListToolsRequestSchema'));
const callToolSchema = vi.hoisted(() => Symbol('CallToolRequestSchema'));

const MockServer = vi.hoisted(() => {
  return class {
    setRequestHandler = vi.fn((schema: unknown, handler: (request?: any) => Promise<any>) => {
      handlerMap.set(schema, handler);
    });

    connect = mockConnect;
  };
});

const MockSourceManager = vi.hoisted(() => {
  return class {
    getEnabledSources = vi.fn(() => sourceManagerState.enabledSources);
    isSourceConfigured = vi.fn((id: string) => (id === 'patreon' ? sourceManagerState.patreonConfigured : true));
    markSourceConfigured = vi.fn();
    isPrefetchEnabled = vi.fn(() => sourceManagerState.prefetchEnabled);
    getSemanticRecallConfig = vi.fn(() => ({ enabled: sourceManagerState.semanticEnabled }));

    constructor() {
      sourceManagerInstances.push(this);
    }
  };
});

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: MockServer,
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class MockStdioServerTransport {},
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: listToolsSchema,
  CallToolRequestSchema: callToolSchema,
}));

vi.mock('../config/sources.js', () => ({
  default: MockSourceManager,
}));

vi.mock('../tools/index.js', () => ({
  getHandler: mockGetHandler,
}));

vi.mock('../tools/registration.js', () => ({
  getToolList: mockGetToolList,
}));

vi.mock('../utils/response-helpers.js', () => ({
  createErrorResponseFromError: mockCreateErrorResponseFromError,
}));

vi.mock('../utils/source-registry.js', () => ({
  prefetchAllSources: mockPrefetchAllSources,
}));

vi.mock('../utils/semantic-recall.js', () => ({
  prefetchEmbeddingModel: mockPrefetchEmbeddingModel,
}));

vi.mock('../sources/premium/patreon.js', () => ({
  PatreonSource: class PatreonSource {},
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

import { startServer } from '../server.js';

function getLatestSourceManager() {
  const instance = sourceManagerInstances[sourceManagerInstances.length - 1];
  if (!instance) throw new Error('Expected SourceManager instance');
  return instance;
}

describe('startServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlerMap.clear();
    sourceManagerInstances.length = 0;

    sourceManagerState.enabledSources = [{ id: 'sundell' }];
    sourceManagerState.patreonConfigured = false;
    sourceManagerState.prefetchEnabled = false;
    sourceManagerState.semanticEnabled = false;

    mockConnect.mockResolvedValue(undefined);
    mockGetToolList.mockReturnValue([{ name: 'get_swift_pattern' }]);
    mockGetHandler.mockReturnValue(undefined);
    mockCreateErrorResponseFromError.mockReturnValue({
      content: [{ type: 'text', text: 'Error: mocked' }],
      isError: true,
    });
    mockPrefetchAllSources.mockResolvedValue([{ status: 'fulfilled', value: [] }]);
    mockPrefetchEmbeddingModel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers ListTools handler and returns tools from getToolList', async () => {
    const tools = [{ name: 'tool-one' }, { name: 'tool-two' }];
    mockGetToolList.mockReturnValue(tools);

    await startServer();

    const sourceManager = getLatestSourceManager();
    const listToolsHandler = handlerMap.get(listToolsSchema);
    expect(listToolsHandler).toBeDefined();

    const response = await listToolsHandler?.();

    expect(response).toEqual({ tools });
    expect(mockGetToolList).toHaveBeenCalledWith(sourceManager, expect.any(Function));
  });

  it('routes CallTool requests to a registered handler', async () => {
    const handlerResponse = { content: [{ type: 'text', text: 'ok' }] };
    const handler = vi.fn().mockResolvedValue(handlerResponse);
    mockGetHandler.mockReturnValue(handler);

    await startServer();

    const callToolHandler = handlerMap.get(callToolSchema);
    const request = { params: { name: 'get_swift_pattern', arguments: { topic: 'swiftui' } } };
    const response = await callToolHandler?.(request);

    expect(handler).toHaveBeenCalledWith(
      { topic: 'swiftui' },
      expect.objectContaining({ sourceManager: expect.any(Object), patreonSource: expect.any(Function) })
    );
    expect(response).toEqual(handlerResponse);
  });

  it('returns standardized error response for unknown tools', async () => {
    const errorResponse = { content: [{ type: 'text', text: 'Error: Unknown tool' }], isError: true };
    mockCreateErrorResponseFromError.mockReturnValue(errorResponse);

    await startServer();

    const callToolHandler = handlerMap.get(callToolSchema);
    const response = await callToolHandler?.({ params: { name: 'missing_tool', arguments: {} } });

    expect(mockCreateErrorResponseFromError).toHaveBeenCalledWith(expect.any(Error));
    expect(response).toEqual(errorResponse);
  });

  it('auto-enables Patreon when credentials are detected', async () => {
    sourceManagerState.patreonConfigured = true;
    sourceManagerState.enabledSources = [{ id: 'sundell' }];

    await startServer();

    const sourceManager = getLatestSourceManager();
    expect(sourceManager.markSourceConfigured).toHaveBeenCalledWith('patreon');
    expect(mockLoggerInfo).toHaveBeenCalledWith('Patreon auto-enabled (credentials detected)');
  });

  it('runs source and embedding prefetch hooks when enabled', async () => {
    sourceManagerState.prefetchEnabled = true;
    sourceManagerState.semanticEnabled = true;

    await startServer();
    await Promise.resolve();

    expect(mockPrefetchAllSources).toHaveBeenCalledTimes(1);
    expect(mockPrefetchEmbeddingModel).toHaveBeenCalledTimes(1);
  });

  it('logs fatal error and exits when connect fails', async () => {
    mockConnect.mockRejectedValueOnce(new Error('connect failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit called with ${code}`);
    }) as never);

    await expect(startServer()).rejects.toThrow('process.exit called with 1');

    expect(mockLoggerError).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
