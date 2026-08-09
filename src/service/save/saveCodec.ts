import { z } from 'zod'

import { saveConfig } from '../../configs/saveConfig'
import type { ProgressData } from '../../types/game'
import { parseProgress, progressSchema } from './progressSchema'

const exportEnvelopeSchema = z
  .object({
    formatVersion: z.literal(saveConfig.exportFormatVersion),
    checksum: z.string().regex(/^[0-9a-f]{8}$/),
    payload: z.string(),
  })
  .strict()

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function decodeBase64(value: string): string {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function checksum(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let hash = 0x811c9dc5
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function encodeProgress(progress: ProgressData): string {
  const payload = JSON.stringify(progressSchema.parse(progress))
  return encodeBase64(
    JSON.stringify({
      formatVersion: saveConfig.exportFormatVersion,
      checksum: checksum(payload),
      payload,
    }),
  )
}

export function decodeProgress(encoded: string): ProgressData {
  const trimmed = encoded.trim()
  if (trimmed.length > saveConfig.maximumImportCodeLength) {
    throw new Error('Import code length exceeds the supported maximum')
  }

  try {
    const envelope = exportEnvelopeSchema.parse(JSON.parse(decodeBase64(trimmed)))
    if (checksum(envelope.payload) !== envelope.checksum) {
      throw new Error('Import code integrity check failed')
    }
    return parseProgress(JSON.parse(envelope.payload))
  } catch (error) {
    if (error instanceof Error && /length|integrity/.test(error.message)) {
      throw error
    }
    throw new Error('Import code format or decode validation failed', {
      cause: error,
    })
  }
}
