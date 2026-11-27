import type { Modifier, ModifierOf, ModifierType } from '../../levels/schema';
import { bumper } from './bumper';
import { conveyor } from './conveyor';
import { feather } from './feather';
import { fog } from './fog';
import { heavy } from './heavy';
import { hourglass } from './hourglass';
import { ice } from './ice';
import { invert } from './invert';
import type { ModifierContext, ModifierInstance, ModifierModule } from './kit';
import { magnet } from './magnet';
import { pusher } from './pusher';
import { sand } from './sand';
import { shield } from './shield';
import { slowMo } from './slowMo';
import { speedPad } from './speedPad';
import { spring } from './spring';
import { sweeper } from './sweeper';
import { wind } from './wind';

/** Bonuses and maluses of PLAN.md § 5, one module each. */
export const MODIFIERS: { [T in ModifierType]: ModifierModule<ModifierOf<T>> } = {
  speedPad,
  spring,
  magnet,
  shield,
  slowMo,
  hourglass,
  feather,
  ice,
  sand,
  wind,
  conveyor,
  pusher,
  sweeper,
  bumper,
  heavy,
  invert,
  fog,
};

export const modifierModule = (m: Modifier): ModifierModule<Modifier> => MODIFIERS[m.type] as ModifierModule<Modifier>;

export const createModifier = (ctx: ModifierContext, m: Modifier): ModifierInstance => modifierModule(m).create(ctx, m);
