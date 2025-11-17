import { isDevelopmentEnv, isProductionEnv } from '../environment';

describe('environment utils', () => {
  it('detects development mode', () => {
    expect(isDevelopmentEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isDevelopmentEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('detects production mode', () => {
    expect(isProductionEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isProductionEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
  });
});

