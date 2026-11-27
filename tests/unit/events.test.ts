import { describe, expect, it, vi } from 'vitest';
import { createEventBus, type GameEvents } from '../../src/game/events';
import { formatTime, formatTimeShort } from '../../src/ui/format';

describe('event bus', () => {
  it('delivers payloads to listeners and supports unsubscribe', () => {
    const bus = createEventBus<GameEvents>();
    const listener = vi.fn();
    const off = bus.on('fell', listener);
    bus.emit('fell', { falls: 2 });
    off();
    bus.emit('fell', { falls: 3 });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ falls: 2 });
  });
  it('emits payload-less events', () => {
    const bus = createEventBus<GameEvents>();
    const listener = vi.fn();
    bus.on('checkpointReached', listener);
    bus.emit('checkpointReached');
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('formatTime', () => {
  it('formats like the prototype HUD', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(65.34)).toBe('1:05.3');
    expect(formatTimeShort(65.34)).toBe('1:05');
  });
});
