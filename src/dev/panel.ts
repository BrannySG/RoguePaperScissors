import type { Shell } from '../app/shell.ts';
import { DEFAULT_RULESET, type RuleSet } from '../core/ruleset.ts';
import { encodeRecord, verifyRecord } from './replay.ts';

const ENUM_OPTIONS: Partial<Record<keyof RuleSet, readonly string[]>> = {
  cooldownAppliesTo: ['both', 'winner', 'loser', 'none'],
  handVisibility: ['hidden', 'open'],
  echoReveal: ['onFirstFire', 'always', 'never'],
};

const PANEL_CSS = `
  position:fixed; top:0; left:0; z-index:10; width:290px; max-height:100vh;
  overflow:auto; padding:12px 14px; box-sizing:border-box;
  background:rgba(20,20,20,.92); color:#eee; font:12px/1.5 ui-monospace,monospace;
`;

const ROW_CSS = 'display:flex; justify-content:space-between; gap:8px; margin:3px 0;';
const INPUT_CSS =
  'width:112px; background:#000; color:#eee; border:1px solid #555; padding:2px 4px; font:inherit;';
const BUTTON_CSS =
  'flex:1; background:#eee; color:#111; border:0; padding:6px; font:inherit; font-weight:700; cursor:pointer;';

/**
 * Dev-only RuleSet editor. This is the one piece of DOM in the project: it is
 * tooling rather than game UI, is mounted only under `import.meta.env.DEV`, and
 * never ships. See docs/adr/0003.
 */
export function mountDevPanel(shell: Shell): void {
  const panel = document.createElement('div');
  panel.setAttribute('style', PANEL_CSS);

  const heading = document.createElement('div');
  heading.textContent = 'RULESET  [~ to hide]';
  heading.setAttribute('style', 'font-weight:700; margin-bottom:8px; letter-spacing:1px;');
  panel.appendChild(heading);

  const seedInput = addRow(panel, 'seed', String(shell.fightOptions.seed), 'number');
  const inputs = new Map<keyof RuleSet, HTMLInputElement | HTMLSelectElement>();

  for (const key of Object.keys(DEFAULT_RULESET) as Array<keyof RuleSet>) {
    const current = shell.fightOptions.ruleSet[key];
    const options = ENUM_OPTIONS[key];

    inputs.set(
      key,
      options === undefined
        ? addRow(panel, key, String(current), 'number')
        : addSelect(panel, key, options, String(current)),
    );
  }

  const status = document.createElement('div');
  status.setAttribute('style', 'margin-top:10px; min-height:32px; color:#8f8;');
  panel.appendChild(makeButtons(() => readRuleSet(inputs), seedInput, shell, status));
  panel.appendChild(status);

  document.body.appendChild(panel);

  window.addEventListener('keydown', (event) => {
    if (event.key === '`' || event.key === '~') {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  });
}

function readRuleSet(
  inputs: Map<keyof RuleSet, HTMLInputElement | HTMLSelectElement>,
): RuleSet {
  const ruleSet = { ...DEFAULT_RULESET } as Record<string, unknown>;

  for (const [key, element] of inputs) {
    const raw = element.value;
    const asNumber = Number(raw);
    ruleSet[key] =
      element instanceof HTMLSelectElement || Number.isNaN(asNumber) ? raw : asNumber;
  }

  return ruleSet as unknown as RuleSet;
}

function makeButtons(
  readRules: () => RuleSet,
  seedInput: HTMLInputElement,
  shell: Shell,
  status: HTMLElement,
): HTMLElement {
  const bar = document.createElement('div');
  bar.setAttribute('style', 'display:flex; gap:6px; margin-top:10px; flex-wrap:wrap;');

  bar.appendChild(
    button('APPLY + RESTART', () => {
      shell.startFight({ seed: Number(seedInput.value) || 1, ruleSet: readRules() });
      status.textContent = 'Restarted.';
    }),
  );

  bar.appendChild(
    button('NEW SEED', () => {
      const seed = Math.floor(Math.random() * 1_000_000);
      seedInput.value = String(seed);
      shell.startFight({ seed, ruleSet: readRules() });
      status.textContent = `Restarted on seed ${seed}.`;
    }),
  );

  bar.appendChild(
    button('VERIFY REPLAY', () => {
      const record = shell.record;
      if (record === null) {
        status.style.color = '#f88';
        status.textContent = 'No Fight has been played yet.';
        return;
      }

      const result = verifyRecord(record);
      status.style.color = result.ok ? '#8f8' : '#f88';
      status.textContent = result.ok
        ? `Replay matched across ${result.roundsChecked} checkpoints.`
        : `DIVERGED at round ${result.divergedAtRound}: ${result.actual} != ${result.expected}`;
    }),
  );

  bar.appendChild(
    button('COPY REPLAY', () => {
      const record = shell.record;
      if (record === null) {
        status.style.color = '#f88';
        status.textContent = 'No Fight has been played yet.';
        return;
      }

      void navigator.clipboard.writeText(encodeRecord(record));
      status.style.color = '#8f8';
      status.textContent = 'Recording copied to clipboard.';
    }),
  );

  return bar;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.textContent = label;
  element.setAttribute('style', BUTTON_CSS);
  element.addEventListener('click', onClick);
  return element;
}

function addRow(
  parent: HTMLElement,
  label: string,
  value: string,
  type: string,
): HTMLInputElement {
  const row = document.createElement('label');
  row.setAttribute('style', ROW_CSS);
  row.append(label);

  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.setAttribute('style', INPUT_CSS);

  row.appendChild(input);
  parent.appendChild(row);
  return input;
}

function addSelect(
  parent: HTMLElement,
  label: string,
  options: readonly string[],
  value: string,
): HTMLSelectElement {
  const row = document.createElement('label');
  row.setAttribute('style', ROW_CSS);
  row.append(label);

  const select = document.createElement('select');
  select.setAttribute('style', INPUT_CSS);

  for (const option of options) {
    const element = document.createElement('option');
    element.value = option;
    element.textContent = option;
    select.appendChild(element);
  }

  select.value = value;
  row.appendChild(select);
  parent.appendChild(row);
  return select;
}
