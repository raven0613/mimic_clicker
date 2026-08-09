interface EffectChainState {
  causedFullClear: boolean
  defeatedMimicIds: Set<number>
  initialTargetCount: number
}

export class EffectChainBalanceTracker {
  private readonly chains = new Map<number, EffectChainState>()
  private readonly getEffectiveTargetCount: (atMs: number) => number

  public constructor(getEffectiveTargetCount: (atMs: number) => number) {
    this.getEffectiveTargetCount = getEffectiveTargetCount
  }

  public ensure(chainId: number, atMs: number): void {
    if (this.chains.has(chainId)) return
    this.chains.set(chainId, {
      causedFullClear: false,
      defeatedMimicIds: new Set(),
      initialTargetCount: this.getEffectiveTargetCount(atMs),
    })
  }

  public recordDefeat(chainId: number, mimicId: number, atMs: number): void {
    this.ensure(chainId, atMs)
    this.chains.get(chainId)!.defeatedMimicIds.add(mimicId)
  }

  public markFullClear(chainId: number, atMs: number): void {
    this.ensure(chainId, atMs)
    this.chains.get(chainId)!.causedFullClear = true
  }

  public createMetrics(): {
    effectChainCount: number
    effectChainFullClearCount: number
    maximumDefeatsInEffectChain: number
    maximumEffectChainClearRatio: number
  } {
    const chains = [...this.chains.values()]
    return {
      effectChainCount: chains.length,
      effectChainFullClearCount: chains.filter(
        (chain) => chain.causedFullClear,
      ).length,
      maximumDefeatsInEffectChain: Math.max(
        0,
        ...chains.map((chain) => chain.defeatedMimicIds.size),
      ),
      maximumEffectChainClearRatio: Math.max(
        0,
        ...chains.map((chain) =>
          Math.min(
            1,
            chain.defeatedMimicIds.size /
              Math.max(1, chain.initialTargetCount),
          ),
        ),
      ),
    }
  }
}
