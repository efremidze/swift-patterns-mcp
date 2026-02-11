import { describe, expect, it, vi } from 'vitest';

import { InflightDeduper } from '../inflight-dedup.js';

describe('InflightDeduper', () => {
  it('deduplicates same-key concurrent requests', async () => {
    const deduper = new InflightDeduper<string, string>();
    const task = vi.fn(async () => 'shared');

    const [first, second, third] = await Promise.all([
      deduper.run('key-a', task),
      deduper.run('key-a', task),
      deduper.run('key-a', task),
    ]);

    expect(first).toBe('shared');
    expect(second).toBe('shared');
    expect(third).toBe('shared');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('runs different keys independently', async () => {
    const deduper = new InflightDeduper<string, string>();
    const order: string[] = [];

    const [a, b] = await Promise.all([
      deduper.run('key-a', async () => {
        order.push('a-start');
        await Promise.resolve();
        order.push('a-end');
        return 'a';
      }),
      deduper.run('key-b', async () => {
        order.push('b-start');
        await Promise.resolve();
        order.push('b-end');
        return 'b';
      }),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(order).toContain('a-start');
    expect(order).toContain('b-start');
  });

  it('cleans inflight map after successful completion', async () => {
    const deduper = new InflightDeduper<string, string>();
    const task = vi.fn(async () => 'ok');

    await deduper.run('same', task);
    await deduper.run('same', task);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('cleans inflight map after rejection', async () => {
    const deduper = new InflightDeduper<string, string>();
    const failingTask = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(deduper.run('same', failingTask)).rejects.toThrow('boom');
    await expect(deduper.run('same', failingTask)).rejects.toThrow('boom');

    expect(failingTask).toHaveBeenCalledTimes(2);
  });

  it('shares same rejection for same-key concurrent calls', async () => {
    const deduper = new InflightDeduper<string, string>();
    const failingTask = vi.fn(async () => {
      throw new Error('upstream-failure');
    });

    const first = deduper.run('same', failingTask);
    const second = deduper.run('same', failingTask);

    await expect(first).rejects.toThrow('upstream-failure');
    await expect(second).rejects.toThrow('upstream-failure');
    expect(failingTask).toHaveBeenCalledTimes(1);
  });

  it('retries successfully after a previous failure', async () => {
    const deduper = new InflightDeduper<string, string>();
    const task = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('first-failure'))
      .mockResolvedValueOnce('second-success');

    await expect(deduper.run('retry', task)).rejects.toThrow('first-failure');
    await expect(deduper.run('retry', task)).resolves.toBe('second-success');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('does not deduplicate sequential completed calls', async () => {
    const deduper = new InflightDeduper<string, number>();
    let count = 0;

    const first = await deduper.run('id', async () => {
      count += 1;
      return count;
    });

    const second = await deduper.run('id', async () => {
      count += 1;
      return count;
    });

    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it('supports object keys with reference identity', async () => {
    const deduper = new InflightDeduper<{ id: string }, string>();
    const sharedKey = { id: 'shared' };
    const otherKey = { id: 'shared' };
    const task = vi.fn(async () => 'value');

    await Promise.all([
      deduper.run(sharedKey, task),
      deduper.run(sharedKey, task),
      deduper.run(otherKey, task),
    ]);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('keeps parallel behavior stable under mixed keys', async () => {
    const deduper = new InflightDeduper<string, string>();
    const taskA = vi.fn(async () => 'A');
    const taskB = vi.fn(async () => 'B');

    const results = await Promise.all([
      deduper.run('a', taskA),
      deduper.run('a', taskA),
      deduper.run('b', taskB),
      deduper.run('b', taskB),
    ]);

    expect(results).toEqual(['A', 'A', 'B', 'B']);
    expect(taskA).toHaveBeenCalledTimes(1);
    expect(taskB).toHaveBeenCalledTimes(1);
  });

  it('propagates resolved values without mutation', async () => {
    const deduper = new InflightDeduper<string, { id: string; values: number[] }>();
    const value = { id: 'result', values: [1, 2, 3] };

    const result = await deduper.run('x', async () => value);
    expect(result).toEqual({ id: 'result', values: [1, 2, 3] });
    expect(result).toBe(value);
  });
});
