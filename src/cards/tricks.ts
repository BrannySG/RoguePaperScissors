import type { CardDef } from '../core/cards.ts';

const trick = (card: Omit<CardDef, 'category' | 'priority'>): CardDef => ({
  ...card,
  category: 'trick',
  priority: 0,
});

/**
 * The starter pool. `draftWeight: 0` means a card is never offered directly and
 * can only enter a Hand through another card's effect.
 *
 * A card only ever resolves as the Winner of its Clash, so its Type already
 * says which Type it pays off against and its rules say what it does. Only a
 * genuinely extra Condition — an HP threshold, a Tag — is worth writing out.
 * See docs/adr/0004.
 */
export const TRICKS: readonly CardDef[] = [
  trick({
    id: 'fish',
    name: 'Fish',
    type: 'rock',
    tags: ['Beast'],
    text: '4 damage. Add 2 Fish Guts.',
    draftWeight: 10,
    rules: [
      {
        when: { kind: 'always' },
        then: [
          { kind: 'damage', amount: 4 },
          { kind: 'addCard', cardId: 'fish_guts', count: 2, to: 'self' },
        ],
      },
    ],
  }),

  trick({
    id: 'fish_guts',
    name: 'Fish Guts',
    type: 'paper',
    tags: ['Beast'],
    text: '4 damage. Heal 2.',
    draftWeight: 0,
    rules: [
      {
        when: { kind: 'always' },
        then: [
          { kind: 'damage', amount: 4 },
          { kind: 'heal', amount: 2 },
        ],
      },
    ],
  }),

  trick({
    id: 'boulder',
    name: 'Boulder',
    type: 'rock',
    tags: [],
    text: '7 damage.',
    draftWeight: 10,
    rules: [{ when: { kind: 'always' }, then: [{ kind: 'damage', amount: 7 }] }],
  }),

  trick({
    id: 'rust',
    name: 'Rust',
    type: 'scissors',
    tags: ['Metal'],
    text: "Stuns the opponent's Scissors for 2 rounds.",
    draftWeight: 8,
    rules: [
      {
        when: { kind: 'always' },
        then: [{ kind: 'cooldown', target: 'opponent', type: 'scissors', rounds: 2 }],
      },
    ],
  }),

  trick({
    id: 'second_wind',
    name: 'Second Wind',
    type: 'paper',
    tags: [],
    text: 'Clears all your cooldowns.',
    draftWeight: 8,
    rules: [{ when: { kind: 'always' }, then: [{ kind: 'clearCooldowns' }] }],
  }),

  trick({
    id: 'beast_pact',
    name: 'Beast Pact',
    type: 'rock',
    tags: ['Beast'],
    text: 'Your Beast cards deal +2 for the rest of the Fight.',
    draftWeight: 6,
    rules: [
      {
        when: { kind: 'always' },
        then: [
          {
            kind: 'echo',
            label: 'Beast Pact: Beast cards +2',
            modifier: { kind: 'damageBonus', filter: { tags: ['Beast'] }, amount: 2 },
          },
        ],
      },
    ],
  }),

  trick({
    id: 'thick_skin',
    name: 'Thick Skin',
    type: 'rock',
    tags: [],
    text: 'Take 1 less from Scissors for the rest of the Fight.',
    draftWeight: 6,
    rules: [
      {
        when: { kind: 'always' },
        then: [
          {
            kind: 'echo',
            label: 'Thick Skin: -1 from Scissors',
            modifier: {
              kind: 'damageReduction',
              filter: { types: ['scissors'] },
              amount: 1,
            },
          },
        ],
      },
    ],
  }),

  trick({
    id: 'pickpocket',
    name: 'Pickpocket',
    type: 'scissors',
    tags: [],
    text: '3 damage. Opponent discards a Trick.',
    draftWeight: 8,
    rules: [
      {
        when: { kind: 'always' },
        then: [
          { kind: 'damage', amount: 3 },
          { kind: 'discard', count: 1, from: 'opponent' },
        ],
      },
    ],
  }),

  trick({
    id: 'litter',
    name: 'Litter',
    type: 'paper',
    tags: [],
    text: "Adds 2 Soggy Paper to the opponent's hand.",
    draftWeight: 6,
    rules: [
      {
        when: { kind: 'always' },
        then: [{ kind: 'addCard', cardId: 'soggy_paper', count: 2, to: 'opponent' }],
      },
    ],
  }),

  trick({
    id: 'soggy_paper',
    name: 'Soggy Paper',
    type: 'paper',
    tags: [],
    text: 'Does nothing. Takes up space.',
    draftWeight: 0,
    rules: [],
  }),

  trick({
    id: 'last_stand',
    name: 'Last Stand',
    type: 'scissors',
    tags: [],
    text: 'While you are at 6 HP or less: 9 damage.',
    draftWeight: 6,
    rules: [
      {
        when: { kind: 'selfHpAtOrBelow', hp: 6 },
        then: [{ kind: 'damage', amount: 9 }],
      },
    ],
  }),

  trick({
    id: 'finish_it',
    name: 'Finish It',
    type: 'rock',
    tags: [],
    text: 'While the opponent is at 5 HP or less: 6 damage.',
    draftWeight: 6,
    rules: [
      {
        when: { kind: 'opponentHpAtOrBelow', hp: 5 },
        then: [{ kind: 'damage', amount: 6 }],
      },
    ],
  }),

  trick({
    id: 'market_day',
    name: 'Market Day',
    type: 'scissors',
    tags: [],
    text: 'Draft one extra option for the rest of the Fight.',
    draftWeight: 5,
    rules: [
      {
        when: { kind: 'always' },
        then: [
          {
            kind: 'echo',
            label: 'Market Day: +1 draft option',
            modifier: { kind: 'draftOptionsDelta', amount: 1 },
          },
        ],
      },
    ],
  }),
];
