import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useSyncExternalStore } from 'preact/compat';
import { createStore } from 'zustand/vanilla';
import { initPhysics } from '../../src/engine/physics';
import { runBot } from '../../src/game/bot';
import { DEFAULT_LEVEL, EDITOR_LEVEL_KEY, fetchLevel, LEVEL_IDS } from '../../src/levels/catalog';
import { generateLevel } from '../../src/levels/generate';
import { parseLevel } from '../../src/levels/loader';
import { THEMES, type Entity, type Level, type Piece, type PieceType } from '../../src/levels/schema';
import { validateLevel, type Issue } from '../../src/levels/validate';
import { downloadJson } from '../../src/ui/download';
import { cellAt, drawLevel, fitView, hitTest, toWorldXZ, type View } from './draw';
import { hasRot, PIECE_TYPES, pieceFields, type Field } from './fields';
import { ENTITY_LABELS, FIELD_LABELS, OPTION_LABELS, PIECE_LABELS } from './labels';
import {
  deleteSelection,
  duplicateSelection,
  initialState,
  moveSelection,
  newPiece,
  placeAt,
  redo,
  rotate,
  undo,
  updateLevel,
  updatePiece,
  type EditorState,
  type Tool,
} from './model';
import { createPreview, type Preview } from './preview';
import './editor.css';

const DRAFT_KEY = 'bille-celeste.editor-draft';

const loadDraft = (): Level | undefined => {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    const result = saved ? parseLevel(JSON.parse(saved)) : undefined;
    return result?.ok ? result.level : undefined;
  } catch {
    return undefined;
  }
};

const store = createStore<EditorState>(() => initialState(loadDraft()));
const set = (change: (s: EditorState) => EditorState) => store.setState(change(store.getState()), true);
const useEditor = <T,>(select: (s: EditorState) => T): T =>
  useSyncExternalStore(store.subscribe, () => select(store.getState()));

store.subscribe(({ level }, previous) => {
  if (level === previous.level) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(level));
  } catch {
    // Storage blocked: the draft only lives in this tab.
  }
});

const openLevel = (level: Level) => store.setState(initialState(level, store.getState().opened + 1), true);

// ——— Toolbar ———

const Toolbar = ({ notify }: { notify: (message: string) => void }) => {
  const level = useEditor((s) => s.level);
  const layer = useEditor((s) => s.layer);
  const rot = useEditor((s) => s.rot);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const [gen, setGen] = useState({ open: false, world: 1, difficulty: 0.3, seed: 1 });
  const file = useRef<HTMLInputElement>(null);

  const play = () => {
    try {
      localStorage.setItem(EDITOR_LEVEL_KEY, JSON.stringify(level));
    } catch {
      notify('Impossible de transmettre le niveau au jeu (stockage bloqué)');
      return;
    }
    window.open('../?level=editor', 'bille-celeste-play');
  };

  const exportLevel = () => {
    const result = parseLevel(level);
    if (!result.ok) {
      notify(`Export impossible : ${result.errors[0] ?? 'niveau invalide'}`);
      return;
    }
    downloadJson(`${level.id}.json`, result.level);
    void navigator.clipboard?.writeText(JSON.stringify(result.level, null, 2)).catch(() => undefined);
    notify(`${level.id}.json exporté (et copié dans le presse-papiers)`);
  };

  const importFile = async (input: HTMLInputElement) => {
    const chosen = input.files?.[0];
    input.value = '';
    if (!chosen) return;
    try {
      const result = parseLevel(JSON.parse(await chosen.text()));
      if (result.ok) openLevel(result.level);
      else notify(`Fichier invalide : ${result.errors[0] ?? ''}`);
    } catch {
      notify('Ce fichier n’est pas du JSON');
    }
  };

  const bot = () => {
    const result = parseLevel(level);
    if (!result.ok) return notify('Le niveau ne respecte pas le schéma');
    const run = runBot(result.level);
    notify(
      !run.planned
        ? 'Bot : aucun chemin du départ à l’arrivée'
        : run.won
          ? `Bot : terminé en ${run.time.toFixed(1)} s, ${run.falls} chute(s)`
          : `Bot : échec (${run.falls} chutes)`,
    );
  };

  return (
    <header class="toolbar">
      <strong class="brand">Éditeur</strong>
      <button onClick={() => openLevel(initialState().level)}>Nouveau</button>
      <select
        aria-label="Ouvrir un niveau du jeu"
        onChange={async (e) => {
          const id = e.currentTarget.value;
          e.currentTarget.value = '';
          if (id) openLevel(await fetchLevel(id));
        }}
      >
        <option value="">Ouvrir…</option>
        {LEVEL_IDS.map((id) => (
          <option value={id}>{id}</option>
        ))}
      </select>
      <button onClick={() => file.current?.click()}>Importer</button>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => importFile(e.currentTarget)}
      />
      <button onClick={() => setGen({ ...gen, open: !gen.open })}>Générer…</button>
      {gen.open && (
        <span class="gen">
          <label>
            Monde
            <input
              type="number"
              min={1}
              max={4}
              value={gen.world}
              onInput={(e) => setGen({ ...gen, world: +e.currentTarget.value })}
            />
          </label>
          <label>
            Difficulté
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={gen.difficulty}
              onInput={(e) => setGen({ ...gen, difficulty: +e.currentTarget.value })}
            />
          </label>
          <label>
            Graine
            <input type="number" value={gen.seed} onInput={(e) => setGen({ ...gen, seed: +e.currentTarget.value })} />
          </label>
          <button
            onClick={() => {
              try {
                openLevel(generateLevel({ world: gen.world, difficulty: gen.difficulty, seed: gen.seed }));
                setGen({ ...gen, open: false });
              } catch (error) {
                notify(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            OK
          </button>
        </span>
      )}
      <span class="sep" />
      <button disabled={!canUndo} onClick={() => set(undo)} title="Ctrl+Z">
        Annuler
      </button>
      <button disabled={!canRedo} onClick={() => set(redo)} title="Ctrl+Maj+Z">
        Rétablir
      </button>
      <span class="sep" />
      <span class="layer" title="[ et ] changent la couche">
        Hauteur
        <button aria-label="Couche plus basse" onClick={() => store.setState({ layer: layer - 1 })}>
          −
        </button>
        <b>{layer * 0.5}</b>
        <button aria-label="Couche plus haute" onClick={() => store.setState({ layer: layer + 1 })}>
          +
        </button>
      </span>
      <button onClick={() => set(rotate)} title="R">
        Tourner ({rot}°)
      </button>
      <span class="grow" />
      <button onClick={bot}>Tester avec le bot</button>
      <button class="primary" onClick={play}>
        Jouer ▶
      </button>
      <button class="primary" onClick={exportLevel}>
        Exporter
      </button>
    </header>
  );
};

// ——— Palette ———

const ENTITY_TOOLS: Entity['type'][] = ['crystal', 'checkpoint', 'goal', 'hiddenGem'];

const sameTool = (a: Tool, b: Tool) => JSON.stringify(a) === JSON.stringify(b);

const Palette = () => {
  const tool = useEditor((s) => s.tool);
  const item = (t: Tool, label: string) => (
    <button class={sameTool(tool, t) ? 'tool on' : 'tool'} onClick={() => store.setState({ tool: t, selection: [] })}>
      {label}
    </button>
  );
  return (
    <nav class="palette" aria-label="Palette">
      {item({ kind: 'select' }, 'Sélection (Échap)')}
      <h3>Pièces</h3>
      {PIECE_TYPES.map((type) => item({ kind: 'piece', type }, PIECE_LABELS[type]))}
      <h3>Objets</h3>
      {ENTITY_TOOLS.map((type) => item({ kind: 'entity', type }, ENTITY_LABELS[type]))}
      {item({ kind: 'spawn' }, 'Départ')}
    </nav>
  );
};

// ——— Top view ———

const GridView = () => {
  const level = useEditor((s) => s.level);
  const selection = useEditor((s) => s.selection);
  const layer = useEditor((s) => s.layer);
  const tool = useEditor((s) => s.tool);
  const rot = useEditor((s) => s.rot);
  const opened = useEditor((s) => s.opened);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ cx: 0, cz: -10, zoom: 18, width: 600, height: 400 });
  const [hover, setHover] = useState<[number, number] | undefined>();
  const drag = useRef<
    | { mode: 'pan'; x: number; y: number; cx: number; cz: number }
    | { mode: 'move'; base: EditorState; from: [number, number] }
    | null
  >(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setView((v) => ({ ...v, width: el.clientWidth, height: el.clientHeight })),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = () => {
    const el = canvas.current;
    if (el) setView(fitView(store.getState().level, el.clientWidth, el.clientHeight));
  };
  useEffect(fit, [opened]);

  const zoomBy = (factor: number) => setView((v) => ({ ...v, zoom: Math.min(80, Math.max(4, v.zoom * factor)) }));

  const ghostPiece = useMemo((): Piece | undefined => {
    if (!hover || tool.kind !== 'piece') return undefined;
    try {
      return newPiece(tool.type, [hover[0], layer, hover[1]], rot);
    } catch {
      return undefined;
    }
  }, [hover, tool, layer, rot]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const ratio = devicePixelRatio || 1;
    el.width = view.width * ratio;
    el.height = view.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const ghost = ghostPiece ? { piece: ghostPiece } : hover && tool.kind !== 'select' ? { cell: hover } : {};
    drawLevel(ctx, view, level, selection, layer, ghost);
  }, [view, level, selection, layer, ghostPiece, hover, tool]);

  const local = (e: PointerEvent): [number, number] => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const down = (e: PointerEvent) => {
    const [sx, sy] = local(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pan = () => (drag.current = { mode: 'pan', x: sx, y: sy, cx: view.cx, cz: view.cz });
    if (e.button !== 0) return pan();
    const state = store.getState();
    if (state.tool.kind !== 'select') {
      const [i, k] = cellAt(view, sx, sy);
      set((s) => placeAt(s, i, k));
      return;
    }
    const hit = hitTest(state.level, view, sx, sy, state.layer);
    if (!hit) {
      store.setState({ selection: [] });
      return pan();
    }
    const has = state.selection.some((s) => s.kind === hit.kind && s.index === hit.index);
    if (e.shiftKey) {
      store.setState({
        selection: has
          ? state.selection.filter((s) => s.kind !== hit.kind || s.index !== hit.index)
          : [...state.selection, hit],
      });
      return;
    }
    if (!has) store.setState({ selection: [hit] });
    drag.current = { mode: 'move', base: store.getState(), from: cellAt(view, sx, sy) };
  };

  const move = (e: PointerEvent) => {
    const [sx, sy] = local(e);
    setHover(cellAt(view, sx, sy));
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'pan') {
      setView((v) => ({ ...v, cx: d.cx - (sx - d.x) / v.zoom, cz: d.cz - (sy - d.y) / v.zoom }));
      return;
    }
    const [i, k] = cellAt(view, sx, sy);
    const [di, dk] = [i - d.from[0], k - d.from[1]];
    store.setState(di || dk ? moveSelection(d.base, di, 0, dk) : d.base, true);
  };

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const [sx, sy] = local(e as unknown as PointerEvent);
    const [wx, wz] = toWorldXZ(view, sx, sy);
    const zoom = Math.min(80, Math.max(4, view.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    setView({ ...view, zoom, cx: wx - (sx - view.width / 2) / zoom, cz: wz - (sy - view.height / 2) / zoom });
  };

  return (
    <div class="grid-view">
      <canvas
        ref={canvas}
        data-testid="grid"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => setHover(undefined)}
        onWheel={wheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      <span class="zoom">
        <button aria-label="Zoom avant" onClick={() => zoomBy(1.25)}>
          +
        </button>
        <button aria-label="Zoom arrière" onClick={() => zoomBy(0.8)}>
          −
        </button>
        <button onClick={fit}>Cadrer</button>
      </span>
      <p class="status">
        {hover ? `Case [${hover[0]}, ${layer}, ${hover[1]}] · ` : ''}
        Clic : poser · R : tourner · Suppr : effacer · Ctrl+D : dupliquer · flèches : déplacer · [ ] : hauteur · glisser
        le fond : se déplacer · molette : zoom
      </p>
    </div>
  );
};

// ——— Inspector ———

const FieldInput = ({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) => {
  const label = FIELD_LABELS[field.key] ?? field.key;
  if (field.kind === 'choice') {
    return (
      <label class="field">
        <span>{label}</span>
        <select
          value={String(value)}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            onChange(typeof field.options[0] === 'number' ? Number(raw) : raw);
          }}
        >
          {field.options.map((o) => (
            <option value={String(o)}>{OPTION_LABELS[String(o)] ?? String(o)}</option>
          ))}
        </select>
      </label>
    );
  }
  const input = (v: number, set: (n: number) => void) => (
    <input
      type="number"
      min={field.min}
      max={field.max}
      step={field.step}
      value={v}
      onChange={(e) => {
        const n = Number(e.currentTarget.value);
        if (Number.isFinite(n)) set(n);
      }}
    />
  );
  if (field.kind === 'pair') {
    const [a, b] = (value as [number, number]) ?? [1, 1];
    return (
      <label class="field">
        <span>{label}</span>
        <span class="pair">
          {input(a, (n) => onChange([n, b]))}×{input(b, (n) => onChange([a, n]))}
        </span>
      </label>
    );
  }
  return (
    <label class="field">
      <span>{label}</span>
      {input(Number(value), onChange)}
    </label>
  );
};

const CellInput = ({
  cell,
  onChange,
  label = 'Case',
}: {
  cell: readonly number[];
  onChange: (c: number[]) => void;
  label?: string;
}) => (
  <label class="field">
    <span>{label}</span>
    <span class="triple">
      {[0, 1, 2].map((n) => (
        <input
          type="number"
          step={1}
          value={cell[n]}
          aria-label={`${label} ${'xyz'[n]}`}
          onChange={(e) => onChange(cell.map((v, m) => (m === n ? Number(e.currentTarget.value) : v)))}
        />
      ))}
    </span>
  </label>
);

const PieceInspector = ({ index, piece }: { index: number; piece: Piece }) => {
  const patch = (p: Record<string, unknown>) => set((s) => updatePiece(s, index, p));
  return (
    <section>
      <h2>{PIECE_LABELS[piece.type as PieceType]}</h2>
      {piece.type === 'movingPlatform' ? (
        piece.path.map((stop, n) => (
          <CellInput
            label={`Arrêt ${n + 1}`}
            cell={stop}
            onChange={(c) => patch({ path: piece.path.map((p, m) => (m === n ? c : p)) })}
          />
        ))
      ) : (
        <CellInput cell={piece.cell} onChange={(cell) => patch({ cell })} />
      )}
      {piece.type === 'movingPlatform' && (
        <p class="row">
          <button onClick={() => patch({ path: [...piece.path, piece.path.at(-1) ?? [0, 0, 0]] })}>+ arrêt</button>
          <button disabled={piece.path.length <= 2} onClick={() => patch({ path: piece.path.slice(0, -1) })}>
            − arrêt
          </button>
        </p>
      )}
      {hasRot(piece.type) && 'rot' in piece && (
        <FieldInput
          field={{ key: 'rot', kind: 'choice', options: [0, 90, 180, 270] }}
          value={piece.rot}
          onChange={(rot) => patch({ rot })}
        />
      )}
      {pieceFields(piece.type).map((field) => (
        <FieldInput
          field={field}
          value={(piece as Record<string, unknown>)[field.key]}
          onChange={(v) => patch({ [field.key]: v })}
        />
      ))}
    </section>
  );
};

const LevelInspector = ({ level }: { level: Level }) => {
  const patch = (p: Partial<Level>) => set((s) => updateLevel(s, p));
  const text = (label: string, value: string, change: (v: string) => void) => (
    <label class="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => change(e.currentTarget.value)} />
    </label>
  );
  return (
    <section>
      <h2>Niveau</h2>
      {text('Identifiant', level.id, (id) => patch({ id }))}
      {text('Nom (fr)', level.name.fr, (fr) => patch({ name: { ...level.name, fr } }))}
      {text('Nom (en)', level.name.en, (en) => patch({ name: { ...level.name, en } }))}
      <FieldInput
        field={{ key: 'world', kind: 'choice', options: [1, 2, 3, 4] }}
        value={level.world}
        onChange={(world) => patch({ world: world as number })}
      />
      <label class="field">
        <span>Temps de référence (s)</span>
        <input
          type="number"
          min={1}
          value={level.parTimeSec}
          onChange={(e) => patch({ parTimeSec: Number(e.currentTarget.value) })}
        />
      </label>
      <FieldInput
        field={{ key: 'theme', kind: 'choice', options: THEMES }}
        value={level.decor.theme}
        onChange={(theme) => patch({ decor: { ...level.decor, theme: theme as Level['decor']['theme'] } })}
      />
      <CellInput
        label="Départ"
        cell={level.spawn.cell}
        onChange={(cell) => patch({ spawn: { cell: cell as [number, number, number] } })}
      />
      <p class="hint">
        {level.pieces.length} pièces · {level.entities.filter((e) => e.type === 'crystal').length} cristaux
      </p>
    </section>
  );
};

const Inspector = () => {
  const level = useEditor((s) => s.level);
  const selection = useEditor((s) => s.selection);
  const [first] = selection;
  if (selection.length > 1)
    return (
      <section>
        <h2>{selection.length} éléments</h2>
        <p class="hint">Flèches pour déplacer, R pour tourner, Ctrl+D pour dupliquer, Suppr pour effacer.</p>
      </section>
    );
  if (first?.kind === 'piece' && level.pieces[first.index])
    return <PieceInspector index={first.index} piece={level.pieces[first.index] as Piece} />;
  if (first?.kind === 'entity') {
    const entity = level.entities[first.index];
    if (entity)
      return (
        <section>
          <h2>{ENTITY_LABELS[entity.type]}</h2>
          <CellInput
            cell={entity.cell}
            onChange={(cell) =>
              set((s) =>
                updateLevel(s, {
                  entities: s.level.entities.map((e, i) =>
                    i === first.index ? { ...e, cell: cell as [number, number, number] } : e,
                  ),
                }),
              )
            }
          />
        </section>
      );
  }
  return <LevelInspector level={level} />;
};

// ——— Validation ———

const useIssues = (level: Level): Issue[] => {
  const [issues, setIssues] = useState<Issue[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = parseLevel(level);
      setIssues(
        parsed.ok ? validateLevel(parsed.level) : parsed.errors.map((message) => ({ severity: 'error', message })),
      );
    }, 120);
    return () => clearTimeout(timer);
  }, [level]);
  return issues;
};

const Validation = () => {
  const level = useEditor((s) => s.level);
  const issues = useIssues(level);
  return (
    <section class="validation" aria-live="polite">
      <h2>Validation</h2>
      {issues.length === 0 ? (
        <p class="ok">✓ Niveau valide</p>
      ) : (
        <ul>
          {issues.map((i) => (
            <li class={i.severity}>{i.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ——— 3D preview ———

const Preview3D = () => {
  const level = useEditor((s) => s.level);
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<Preview | undefined>(undefined);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open || !canvas.current) return;
    preview.current = createPreview(canvas.current);
    const observer = new ResizeObserver(() => preview.current?.resize());
    observer.observe(canvas.current);
    return () => {
      observer.disconnect();
      preview.current?.dispose();
      preview.current = undefined;
    };
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = parseLevel(level);
      if (parsed.ok) preview.current?.show(parsed.level);
    }, 150);
    return () => clearTimeout(timer);
  }, [level, open]);

  return (
    <section class="preview">
      <h2>
        Aperçu 3D <button onClick={() => setOpen(!open)}>{open ? 'Masquer' : 'Afficher'}</button>
      </h2>
      {open && <canvas ref={canvas} />}
    </section>
  );
};

// ——— App ———

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);

const App = () => {
  const [message, setMessage] = useState('');
  const notify = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage((m) => (m === text ? '' : m)), 4000);
  };

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const arrows: Record<string, [number, number]> = {
        arrowleft: [-1, 0],
        arrowright: [1, 0],
        arrowup: [0, -1],
        arrowdown: [0, 1],
      };
      if (mod && key === 'z') set(e.shiftKey ? redo : undo);
      else if (mod && key === 'y') set(redo);
      else if (mod && key === 'd') set(duplicateSelection);
      else if (key === 'r' && !mod) set(rotate);
      else if (key === 'delete' || key === 'backspace') set(deleteSelection);
      else if (key === 'escape') store.setState({ tool: { kind: 'select' }, selection: [] });
      else if (key === '[' || key === ']') {
        const d = key === ']' ? 1 : -1;
        const s = store.getState();
        if (s.selection.length) set((state) => moveSelection(state, 0, d, 0));
        else store.setState({ layer: s.layer + d });
      } else if (arrows[key]) {
        const [di, dk] = arrows[key] ?? [0, 0];
        set((s) => moveSelection(s, di, 0, dk));
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);

  return (
    <div class="editor">
      <Toolbar notify={notify} />
      <Palette />
      <GridView />
      <aside class="side">
        <Inspector />
        <Validation />
        <Preview3D />
      </aside>
      {message && (
        <div class="notice" role="status">
          {message}
        </div>
      )}
    </div>
  );
};

await initPhysics();
if (!loadDraft()) openLevel(await fetchLevel(DEFAULT_LEVEL));
const root = document.getElementById('app');
if (root) render(<App />, root);
