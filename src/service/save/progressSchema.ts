import { z } from 'zod'

import { equipmentDefinitions } from '../../configs/equipmentConfig'
import { mimicIds, type ProgressData } from '../../types/game'

const mimicIdSchema = z.enum(mimicIds)
const equipmentIdSchema = z.enum(
  equipmentDefinitions.map(({ id }) => id) as [
    (typeof equipmentDefinitions)[number]['id'],
    ...(typeof equipmentDefinitions)[number]['id'][],
  ],
)

const equipmentSaleGroupSchema = z
  .object({
    equipmentId: equipmentIdSchema,
    quantity: z.number().int().positive(),
    unitPriceGold: z.number().int().nonnegative(),
    subtotalGold: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((group, context) => {
    if (group.subtotalGold !== group.unitPriceGold * group.quantity) {
      context.addIssue({
        code: 'custom',
        message: 'Equipment sale subtotal must equal unit price times quantity',
        path: ['subtotalGold'],
      })
    }
  })

const roundResultSchema = z
  .object({
    combatGold: z.number().int().nonnegative(),
    equipmentSaleGold: z.number().int().nonnegative(),
    totalGold: z.number().int().nonnegative(),
    equipmentSales: z.array(equipmentSaleGroupSchema),
    defeatedMimics: z.number().int().nonnegative(),
    jackpotOutcome: z.enum([
      'notRevealed',
      'defeated',
      'escaped',
      'roundExpiredDuringChase',
    ]),
  })
  .strict()
  .superRefine((result, context) => {
    const saleTotal = result.equipmentSales.reduce(
      (total, group) => total + group.subtotalGold,
      0,
    )
    if (new Set(result.equipmentSales.map(({ equipmentId }) => equipmentId)).size !== result.equipmentSales.length) {
      context.addIssue({
        code: 'custom',
        message: 'Equipment sale groups must have unique equipment ids',
        path: ['equipmentSales'],
      })
    }
    if (saleTotal !== result.equipmentSaleGold) {
      context.addIssue({
        code: 'custom',
        message: 'Equipment sale gold must equal the grouped subtotal sum',
        path: ['equipmentSaleGold'],
      })
    }
    if (result.totalGold !== result.combatGold + result.equipmentSaleGold) {
      context.addIssue({
        code: 'custom',
        message: 'Round total gold must equal combat gold plus equipment sale gold',
        path: ['totalGold'],
      })
    }
  })

const version1ProgressSchema = z
  .object({
    schemaVersion: z.literal(1),
    completedRounds: z.number().int().nonnegative(),
    gold: z.number().int().nonnegative(),
    unlockedMimicIds: z.array(mimicIdSchema),
    pendingUnlockMimicIds: z.array(mimicIdSchema),
  })
  .strict()

export const progressSchema = z
  .object({
    schemaVersion: z.literal(2),
    completedRounds: z.number().int().nonnegative(),
    gold: z.number().int().nonnegative(),
    unlockedMimicIds: z.array(mimicIdSchema),
    pendingUnlockMimicIds: z.array(mimicIdSchema),
    latestRoundResult: roundResultSchema.nullable(),
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

export function parseProgress(input: unknown): ProgressData {
  const version1 = version1ProgressSchema.safeParse(input)
  if (version1.success) {
    return progressSchema.parse({
      ...version1.data,
      schemaVersion: 2,
      latestRoundResult: null,
    })
  }
  return progressSchema.parse(input)
}
