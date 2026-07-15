import { logger } from '../logger';

describe('logger', () => {
  const originalConsoleDebug = console.debug;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  let debugCalls: string[] = [];
  let logCalls: string[] = [];
  let warnCalls: string[] = [];
  let errorCalls: string[] = [];

  beforeEach(() => {
    debugCalls = [];
    logCalls = [];
    warnCalls = [];
    errorCalls = [];
    console.debug = (msg: string) => { debugCalls.push(msg); };
    console.log = (msg: string) => { logCalls.push(msg); };
    console.warn = (msg: string) => { warnCalls.push(msg); };
    console.error = (msg: string) => { errorCalls.push(msg); };
  });

  afterEach(() => {
    console.debug = originalConsoleDebug;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  it('debug — should output in development mode', () => {
    logger.debug('debug message');
    expect(debugCalls).toHaveLength(1);
    expect(debugCalls[0]).toContain('debug message');
    expect(debugCalls[0]).toContain('DEBUG');
  });

  it('info — should output with timestamp and level', () => {
    logger.info('info message');
    expect(logCalls).toHaveLength(1);
    expect(logCalls[0]).toContain('info message');
    expect(logCalls[0]).toContain('INFO');
    expect(logCalls[0]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('warn — should output warning', () => {
    logger.warn('warning message');
    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0]).toContain('warning message');
    expect(warnCalls[0]).toContain('WARN');
  });

  it('error — should output error', () => {
    logger.error('error message');
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0]).toContain('error message');
    expect(errorCalls[0]).toContain('ERROR');
  });

  it('with metadata — should include JSON metadata in dev mode', () => {
    logger.info('test', { userId: '123', action: 'login' });
    expect(logCalls[0]).toContain('userId');
    expect(logCalls[0]).toContain('123');
    expect(logCalls[0]).toContain('login');
  });

  it('with circular reference metadata — should handle serialization failure gracefully', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logger.info('circular test', circular);

    expect(logCalls).toHaveLength(1);
    expect(logCalls[0]).toContain('circular test');
    expect(logCalls[0]).toContain('Serialization Failed');
  });
});
