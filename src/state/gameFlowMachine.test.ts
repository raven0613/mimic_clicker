import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { gameFlowMachine } from './gameFlowMachine'

describe('game flow machine', () => {
  it('waits for an explicit start after booting', () => {
    const actor = createActor(gameFlowMachine).start()

    actor.send({ type: 'BOOT_SUCCEEDED', hasPendingUnlock: false })
    expect(actor.getSnapshot().value).toBe('ready')

    actor.send({ type: 'START_ROUND' })
    expect(actor.getSnapshot().value).toEqual({
      playing: 'jackpotWaitingToAppear',
    })

    actor.send({ type: 'JACKPOT_RETURNED' })
    expect(actor.getSnapshot().value).toEqual({ playing: 'jackpotDisguised' })
  })

  it('tracks the Jackpot chase as a discrete playing substate', () => {
    const actor = createActor(gameFlowMachine).start()
    actor.send({ type: 'BOOT_SUCCEEDED', hasPendingUnlock: false })
    actor.send({ type: 'START_ROUND' })
    actor.send({ type: 'JACKPOT_RETURNED' })
    actor.send({ type: 'JACKPOT_REVEALED' })

    expect(actor.getSnapshot().value).toEqual({ playing: 'jackpotChasing' })

    actor.send({ type: 'JACKPOT_RESOLVED' })
    expect(actor.getSnapshot().value).toEqual({ playing: 'jackpotResolved' })
  })

  it('tracks a missed disguise while it waits to return', () => {
    const actor = createActor(gameFlowMachine).start()
    actor.send({ type: 'BOOT_SUCCEEDED', hasPendingUnlock: false })
    actor.send({ type: 'START_ROUND' })
    actor.send({ type: 'JACKPOT_RETURNED' })
    actor.send({ type: 'JACKPOT_LEFT_DISGUISED' })
    expect(actor.getSnapshot().value).toEqual({
      playing: 'jackpotWaitingToReturn',
    })

    actor.send({ type: 'JACKPOT_RETURNED' })
    expect(actor.getSnapshot().value).toEqual({ playing: 'jackpotDisguised' })
  })

  it('cannot show settlement until the completed result has been saved', () => {
    const actor = createActor(gameFlowMachine).start()
    actor.send({ type: 'BOOT_SUCCEEDED', hasPendingUnlock: false })
    actor.send({ type: 'START_ROUND' })
    actor.send({ type: 'ROUND_TIMER_EXPIRED' })
    expect(actor.getSnapshot().value).toBe('finishingRound')

    actor.send({ type: 'ROUND_COMPLETED' })

    expect(actor.getSnapshot().value).toBe('savingSettlement')

    actor.send({ type: 'SETTLEMENT_SAVED', hasPendingUnlock: true })
    expect(actor.getSnapshot().value).toBe('settlement')

    actor.send({ type: 'CONTINUE' })
    expect(actor.getSnapshot().value).toBe('unlockAnnouncement')
  })

  it('restores an unacknowledged unlock before returning to ready', () => {
    const actor = createActor(gameFlowMachine).start()

    actor.send({ type: 'BOOT_SUCCEEDED', hasPendingUnlock: true })
    expect(actor.getSnapshot().value).toBe('unlockAnnouncement')

    actor.send({ type: 'UNLOCK_ACKNOWLEDGED' })
    expect(actor.getSnapshot().value).toBe('ready')
  })

  it('retries a failed settlement save without advancing the flow', () => {
    const actor = createActor(gameFlowMachine).start()
    actor.send({ type: 'BOOT_SUCCEEDED', hasPendingUnlock: false })
    actor.send({ type: 'START_ROUND' })
    actor.send({ type: 'ROUND_TIMER_EXPIRED' })
    actor.send({ type: 'ROUND_COMPLETED' })
    actor.send({ type: 'SAVE_FAILED', errorMessage: 'storage unavailable' })
    expect(actor.getSnapshot().value).toBe('error')

    actor.send({ type: 'RETRY_SETTLEMENT' })
    expect(actor.getSnapshot().value).toBe('savingSettlement')
  })
})
