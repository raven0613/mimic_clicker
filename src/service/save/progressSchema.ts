import { z } from 'zod'

import { mimicIds } from '../../types/game'

const mimicIdSchema = z.enum(mimicIds)

export const progressSchema = z
  .object({
    schemaVersion: z.literal(1),
    completedRounds: z.number().int().nonnegative(),
    gold: z.number().int().nonnegative(),
    unlockedMimicIds: z.array(mimicIdSchema),
    pendingUnlockMimicIds: z.array(mimicIdSchema),
  })
  .strict()
  .superRefine((progress, context) => {
    if (!progress.unlockedMimicIds.includes('normal')) {
      context.addIssue({
        code: 'custom',
        message: 'A progress document must keep the normal mimic unlocked',
        path: ['unlockedMimicIds'],
      })
    }
    if (new Set(progress.unlockedMimicIds).size !== progress.unlockedMimicIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Unlocked mimic ids must be unique',
        path: ['unlockedMimicIds'],
      })
    }
    if (
      new Set(progress.pendingUnlockMimicIds).size !==
      progress.pendingUnlockMimicIds.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Pending unlock ids must be unique',
        path: ['pendingUnlockMimicIds'],
      })
    }
    for (const pendingMimicId of progress.pendingUnlockMimicIds) {
      if (
        pendingMimicId === 'normal' ||
        !progress.unlockedMimicIds.includes(pendingMimicId)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'A pending unlock must already be unlocked',
          path: ['pendingUnlockMimicIds'],
        })
      }
    }
    const expectedRare1 = progress.completedRounds >= 1
    const expectedRare2 = progress.completedRounds >= 2
    if (progress.unlockedMimicIds.includes('rare1') !== expectedRare1) {
      context.addIssue({
        code: 'custom',
        message: 'rare1 unlock must match completed round progression',
        path: ['unlockedMimicIds'],
      })
    }
    if (progress.unlockedMimicIds.includes('rare2') !== expectedRare2) {
      context.addIssue({
        code: 'custom',
        message: 'rare2 unlock must match completed round progression',
        path: ['unlockedMimicIds'],
      })
    }
  })
