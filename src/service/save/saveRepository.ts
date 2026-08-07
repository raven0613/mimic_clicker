import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import { saveConfig } from '../../configs/saveConfig'
import type { ProgressData } from '../../types/game'
import { createInitialProgress } from '../progression/createInitialProgress'
import { progressSchema } from './progressSchema'

interface MimicClickerDatabase extends DBSchema {
  progress: {
    key: string
    value: ProgressData
  }
}

export interface SaveRepository {
  loadOrCreate(): Promise<ProgressData>
  replace(progress: ProgressData): Promise<void>
  reset(): Promise<ProgressData>
}

export function createSaveRepository(
  databaseName: string = saveConfig.databaseName,
): SaveRepository {
  let databasePromise: Promise<IDBPDatabase<MimicClickerDatabase>> | null = null

  function getDatabase(): Promise<IDBPDatabase<MimicClickerDatabase>> {
    databasePromise ??= openDB<MimicClickerDatabase>(
      databaseName,
      saveConfig.databaseVersion,
      {
        upgrade(database) {
          if (!database.objectStoreNames.contains(saveConfig.objectStoreName)) {
            database.createObjectStore(saveConfig.objectStoreName)
          }
        },
      },
    )
    return databasePromise
  }

  async function replace(progress: ProgressData): Promise<void> {
    const validated = progressSchema.parse(progress)
    try {
      const database = await getDatabase()
      await database.put(
        saveConfig.objectStoreName,
        validated,
        saveConfig.progressKey,
      )
    } catch (error) {
      throw new Error('Failed to replace IndexedDB progress', { cause: error })
    }
  }

  return {
    async loadOrCreate() {
      try {
        const database = await getDatabase()
        const stored = await database.get(
          saveConfig.objectStoreName,
          saveConfig.progressKey,
        )
        if (stored) {
          return progressSchema.parse(stored)
        }
        const initial = createInitialProgress()
        await replace(initial)
        return initial
      } catch (error) {
        throw new Error('Failed to load IndexedDB progress', { cause: error })
      }
    },
    replace,
    async reset() {
      const initial = createInitialProgress()
      await replace(initial)
      return initial
    },
  }
}
