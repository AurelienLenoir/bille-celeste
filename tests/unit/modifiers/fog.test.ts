import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { placeOn, playground, seconds } from './helpers';

describe('fog', () => {
  beforeAll(() => initPhysics());

  it('thickens the view inside the zone only', () => {
    const run = playground([{ type: 'fog', cell: [0, 0, 0], size: [3, 3], density: 0.7 }]);
    placeOn(run, 0, 0);
    seconds(run, 0.2);
    expect(run.session.status().fog).toBe(0.7);
    placeOn(run, 3, 3);
    seconds(run, 0.2);
    expect(run.session.status().fog).toBe(0);
  });
});
