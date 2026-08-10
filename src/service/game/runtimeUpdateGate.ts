export type RuntimeUpdateMode = 'idle' | 'active' | 'decorative'

export function shouldAdvanceRuntime(
  mode: RuntimeUpdateMode,
  isGameplayPaused: boolean,
): boolean {
  if (mode === 'idle') return false
  return mode !== 'active' || !isGameplayPaused
}
