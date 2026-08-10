import { assign, setup } from 'xstate'

interface GameFlowContext {
  hasPendingUnlock: boolean
  errorMessage: string | null
}

type GameFlowEvent =
  | { type: 'BOOT_SUCCEEDED'; hasPendingUnlock: boolean }
  | { type: 'BOOT_FAILED'; errorMessage: string }
  | { type: 'START_ROUND' }
  | { type: 'OPEN_BACKPACK' }
  | { type: 'CLOSE_BACKPACK' }
  | { type: 'JACKPOT_LEFT_DISGUISED' }
  | { type: 'JACKPOT_RETURNED' }
  | { type: 'JACKPOT_REVEALED' }
  | { type: 'JACKPOT_RESOLVED' }
  | { type: 'ROUND_TIMER_EXPIRED' }
  | { type: 'ROUND_COMPLETED' }
  | { type: 'SETTLEMENT_SAVED'; hasPendingUnlock: boolean }
  | { type: 'SAVE_FAILED'; errorMessage: string }
  | { type: 'CONTINUE' }
  | { type: 'UNLOCK_ACKNOWLEDGED'; hasPendingUnlock?: boolean }
  | { type: 'PROGRESS_RELOADED'; hasPendingUnlock: boolean }
  | { type: 'RETRY_READY' }
  | { type: 'RETRY_SETTLEMENT' }
  | { type: 'RETRY_UNLOCK' }

export const gameFlowMachine = setup({
  types: {
    context: {} as GameFlowContext,
    events: {} as GameFlowEvent,
  },
  guards: {
    bootHasPendingUnlock: ({ event }) =>
      event.type === 'BOOT_SUCCEEDED' && event.hasPendingUnlock,
    contextHasPendingUnlock: ({ context }) => context.hasPendingUnlock,
    eventHasPendingUnlock: ({ event }) =>
      (event.type === 'UNLOCK_ACKNOWLEDGED' ||
        event.type === 'PROGRESS_RELOADED') &&
      event.hasPendingUnlock === true,
  },
  actions: {
    rememberBootUnlock: assign({
      hasPendingUnlock: ({ event }) =>
        event.type === 'BOOT_SUCCEEDED' ? event.hasPendingUnlock : false,
      errorMessage: null,
    }),
    rememberSettlementUnlock: assign({
      hasPendingUnlock: ({ event }) =>
        event.type === 'SETTLEMENT_SAVED' ? event.hasPendingUnlock : false,
      errorMessage: null,
    }),
    rememberError: assign({
      errorMessage: ({ event }) =>
        event.type === 'BOOT_FAILED' || event.type === 'SAVE_FAILED'
          ? event.errorMessage
          : 'Unknown game flow error',
    }),
    clearPendingUnlock: assign({ hasPendingUnlock: false }),
    rememberRemainingUnlock: assign({
      hasPendingUnlock: ({ event }) =>
        (event.type === 'UNLOCK_ACKNOWLEDGED' ||
          event.type === 'PROGRESS_RELOADED') &&
        event.hasPendingUnlock === true,
    }),
  },
}).createMachine({
  id: 'gameFlow',
  initial: 'loadingSave',
  context: {
    hasPendingUnlock: false,
    errorMessage: null,
  },
  states: {
    loadingSave: {
      on: {
        BOOT_SUCCEEDED: [
          {
            guard: 'bootHasPendingUnlock',
            target: 'unlockAnnouncement',
            actions: 'rememberBootUnlock',
          },
          { target: 'ready', actions: 'rememberBootUnlock' },
        ],
        BOOT_FAILED: { target: 'error', actions: 'rememberError' },
      },
    },
    ready: {
      on: {
        START_ROUND: 'playing',
        PROGRESS_RELOADED: [
          {
            guard: 'eventHasPendingUnlock',
            target: 'unlockAnnouncement',
            actions: 'rememberRemainingUnlock',
          },
          { actions: 'clearPendingUnlock' },
        ],
      },
    },
    playing: {
      type: 'parallel',
      states: {
        gameplay: {
          initial: 'jackpotWaitingToAppear',
          states: {
            jackpotWaitingToAppear: {
              on: { JACKPOT_RETURNED: 'jackpotDisguised' },
            },
            jackpotDisguised: {
              on: {
                JACKPOT_LEFT_DISGUISED: 'jackpotWaitingToReturn',
                JACKPOT_REVEALED: 'jackpotChasing',
              },
            },
            jackpotWaitingToReturn: {
              on: { JACKPOT_RETURNED: 'jackpotDisguised' },
            },
            jackpotChasing: {
              on: { JACKPOT_RESOLVED: 'jackpotResolved' },
            },
            jackpotResolved: {},
          },
        },
        backpack: {
          initial: 'closed',
          states: {
            closed: { on: { OPEN_BACKPACK: 'open' } },
            open: { on: { CLOSE_BACKPACK: 'closed' } },
          },
        },
      },
      on: { ROUND_TIMER_EXPIRED: 'finishingRound' },
    },
    finishingRound: {
      on: { ROUND_COMPLETED: 'savingSettlement' },
    },
    savingSettlement: {
      on: {
        SETTLEMENT_SAVED: {
          target: 'settlement',
          actions: 'rememberSettlementUnlock',
        },
        SAVE_FAILED: { target: 'error', actions: 'rememberError' },
      },
    },
    settlement: {
      on: {
        CONTINUE: [
          { guard: 'contextHasPendingUnlock', target: 'unlockAnnouncement' },
          { target: 'ready' },
        ],
      },
    },
    unlockAnnouncement: {
      on: {
        UNLOCK_ACKNOWLEDGED: [
          {
            guard: 'eventHasPendingUnlock',
            target: 'unlockAnnouncement',
            actions: 'rememberRemainingUnlock',
            reenter: true,
          },
          { target: 'ready', actions: 'clearPendingUnlock' },
        ],
        SAVE_FAILED: { target: 'error', actions: 'rememberError' },
      },
    },
    error: {
      on: {
        RETRY_READY: 'ready',
        RETRY_SETTLEMENT: 'savingSettlement',
        RETRY_UNLOCK: 'unlockAnnouncement',
      },
    },
  },
})
