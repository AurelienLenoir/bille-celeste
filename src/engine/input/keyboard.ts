import type { Vec2 } from '../math';

const LEFT = ['arrowleft', 'q', 'a'];
const RIGHT = ['arrowright', 'd'];
const UP = ['arrowup', 'z', 'w'];
const DOWN = ['arrowdown', 's'];

/** Arrow keys, ZQSD (AZERTY) or WASD. Returns null when no direction key is held. */
export const keysToInput = (held: ReadonlySet<string>): Vec2 | null => {
  const any = (keys: string[]) => keys.some((k) => held.has(k));
  const x = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
  const y = (any(UP) ? 1 : 0) - (any(DOWN) ? 1 : 0);
  return x || y ? { x, y } : null;
};

export const createKeyboard = (): { read: () => Vec2 | null } => {
  const held = new Set<string>();
  addEventListener('keydown', (e) => held.add(e.key.toLowerCase()));
  addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  return { read: () => keysToInput(held) };
};
