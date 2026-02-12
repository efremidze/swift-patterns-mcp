import 'dotenv/config';
import { vi } from 'vitest';

if (process.env.CI) {
  vi.mock('keytar', () => ({
    default: {
      getPassword: vi.fn().mockResolvedValue(null),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true),
    },
  }));
}
