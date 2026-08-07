import { describe, expect, it } from 'vitest'

import { createInitialProgress } from '../progression/createInitialProgress'
import { decodeProgress, encodeProgress } from './saveCodec'

describe('save export codec', () => {
  it('round-trips a valid progress document', () => {
    const progress = createInitialProgress()

    expect(decodeProgress(encodeProgress(progress))).toEqual(progress)
  })

  it('rejects a damaged export code', () => {
    const encoded = encodeProgress(createInitialProgress())
    const damaged = `${encoded.slice(0, -2)}zz`

    expect(() => decodeProgress(damaged)).toThrow(/integrity|decode|format/i)
  })

  it('rejects oversized input before decoding it', () => {
    expect(() => decodeProgress('a'.repeat(1_000_000))).toThrow(/length/i)
  })
})
