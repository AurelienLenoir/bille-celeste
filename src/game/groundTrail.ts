type Point = { x: number; y: number; z: number };

const SAMPLE_EVERY = 0.1;
const KEEP = 12;
/** The shield puts the ball back where it rolled this long before it left the ground. */
const LOOK_BACK = 0.5;

export type GroundTrail = {
  /** Called every step: remembers where the ball was while it touched the ground. */
  record: (p: Point, grounded: () => boolean, dt: number) => void;
  /** A recent place where the ball was safely on the ground, if any. */
  safePoint: () => Point | undefined;
  clear: () => void;
};

/** Recent places the ball rolled on, for the shield to put it back "on the spot". */
export const createGroundTrail = (): GroundTrail => {
  let samples: Point[] = [];
  let since = SAMPLE_EVERY;
  return {
    record: (p, grounded, dt) => {
      since += dt;
      // The ground check (a ray cast) only runs when a sample is due.
      if (since < SAMPLE_EVERY || !grounded()) return;
      since = 0;
      samples.push({ x: p.x, y: p.y, z: p.z });
      if (samples.length > KEEP) samples.shift();
    },
    safePoint: () => samples[Math.max(0, samples.length - 1 - Math.round(LOOK_BACK / SAMPLE_EVERY))],
    clear: () => {
      samples = [];
      since = SAMPLE_EVERY;
    },
  };
};
