import { useEffect, useRef } from 'react'

import { PixiGameRuntime } from '../../service/game/PixiGameRuntime'
import type { RuntimeCallbacks } from '../../service/game/runtimeTypes'

interface GameCanvasProps extends RuntimeCallbacks {
  onReady: (runtime: PixiGameRuntime) => void
  onInitializationError: (error: Error) => void
}

export function GameCanvas(props: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)

  useEffect(() => {
    propsRef.current = props
  }, [props])

  useEffect(() => {
    if (!hostRef.current) return

    const runtime = new PixiGameRuntime(hostRef.current, {
      onHudSnapshot: (snapshot) => propsRef.current.onHudSnapshot(snapshot),
      onEquipmentSnapshot: (snapshot) =>
        propsRef.current.onEquipmentSnapshot(snapshot),
      onJackpotDisguised: () => propsRef.current.onJackpotDisguised(),
      onJackpotWaitingToReturn: () =>
        propsRef.current.onJackpotWaitingToReturn(),
      onJackpotRevealed: () => propsRef.current.onJackpotRevealed(),
      onJackpotResolved: () => propsRef.current.onJackpotResolved(),
      onRoundFinishing: () => propsRef.current.onRoundFinishing(),
      onRoundCompleted: (result) => propsRef.current.onRoundCompleted(result),
    })
    let active = true

    void runtime
      .initialize()
      .then(() => {
        if (active) propsRef.current.onReady(runtime)
        else runtime.destroy()
      })
      .catch((error: unknown) => {
        runtime.destroy()
        if (active) {
          propsRef.current.onInitializationError(
            error instanceof Error ? error : new Error('PixiJS initialization failed'),
          )
        }
      })

    return () => {
      active = false
      runtime.destroy()
    }
  }, [])

  return <div className="game-canvas" ref={hostRef} aria-hidden="true" />
}
