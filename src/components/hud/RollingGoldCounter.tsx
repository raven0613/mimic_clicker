import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { coinRewardAnimationConfig } from '../../configs/coinRewardAnimationConfig'

interface RollingGoldCounterProps {
  value: number
}

interface NumberTransition {
  from: number
  to: number
  id: number
}

interface RollingDigitStyle extends CSSProperties {
  '--rolling-digit-steps': number
  '--rolling-digit-duration': string
}

function normalizeValue(value: number): number {
  return Math.max(0, Math.floor(value))
}

function getDigit(value: number, columnFromRight: number): number {
  return Math.floor(value / 10 ** columnFromRight) % 10
}

function RollingDigit({
  from,
  to,
  transitionId,
}: {
  from: number
  to: number
  transitionId: number
}) {
  const forwardDistance = (to - from + 10) % 10
  const stepCount =
    coinRewardAnimationConfig.counter.extraFullRotations * 10 +
    forwardDistance
  const digits = Array.from(
    { length: stepCount + 1 },
    (_, index) => (from + index) % 10,
  )
  const style: RollingDigitStyle = {
    '--rolling-digit-steps': stepCount,
    '--rolling-digit-duration': `${coinRewardAnimationConfig.counter.digitRollDurationMs}ms`,
  }

  return (
    <span className="rolling-digit" aria-hidden="true">
      <span
        className="rolling-digit__track"
        key={`${transitionId}-${from}-${to}`}
        style={style}
      >
        {digits.map((digit, index) => (
          <span className="rolling-digit__value" key={`${index}-${digit}`}>
            {digit}
          </span>
        ))}
      </span>
    </span>
  )
}

export function RollingGoldCounter({ value }: RollingGoldCounterProps) {
  const targetValue = normalizeValue(value)
  const [displayedValue, setDisplayedValue] = useState(targetValue)
  const [transition, setTransition] = useState<NumberTransition | null>(null)
  const nextTransitionId = useRef(0)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (
        targetValue < displayedValue ||
        (transition !== null && targetValue < transition.to)
      ) {
        setTransition(null)
        setDisplayedValue(targetValue)
        return
      }
      if (transition || targetValue === displayedValue) return

      nextTransitionId.current += 1
      setTransition({
        from: displayedValue,
        to: targetValue,
        id: nextTransitionId.current,
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [displayedValue, targetValue, transition])

  useEffect(() => {
    if (!transition) return

    const timeoutId = window.setTimeout(() => {
      setDisplayedValue(transition.to)
      setTransition(null)
    }, coinRewardAnimationConfig.counter.digitRollDurationMs)
    return () => window.clearTimeout(timeoutId)
  }, [transition])

  const fromValue = transition?.from ?? displayedValue
  const toValue = transition?.to ?? displayedValue
  const digitCount = Math.max(
    String(fromValue).length,
    String(toValue).length,
  )

  return (
    <span className="rolling-number" aria-label={`本局收益 ${targetValue}`}>
      {Array.from({ length: digitCount }, (_, index) => {
        const columnFromRight = digitCount - index - 1
        const fromDigit = getDigit(fromValue, columnFromRight)
        const toDigit = getDigit(toValue, columnFromRight)

        if (!transition) {
          return (
            <span className="rolling-digit" key={columnFromRight}>
              {toDigit}
            </span>
          )
        }
        return (
          <RollingDigit
            from={fromDigit}
            to={toDigit}
            transitionId={transition.id}
            key={columnFromRight}
          />
        )
      })}
    </span>
  )
}
