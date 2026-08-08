import { Assets, type Texture } from 'pixi.js'

import goldCoinFlipImageUrl from '../../../assets/coin/gold_coin_flip.png'
import goldCoinIdleImageUrl from '../../../assets/coin/gold_coin_idle.png'
import normalEffectCardFrameUrl from '../../../assets/effects/card_frame/normal.png'
import thunderEffectCardIconUrl from '../../../assets/effects/card_icon/thunder.png'
import thunderStripUrl from '../../../assets/effects/thunder.png'
import jackpotImageUrl from '../../../assets/mimic/jackpot.png'
import normalImageUrl from '../../../assets/mimic/normal.png'
import rare1ImageUrl from '../../../assets/mimic/rare1.png'
import rare2ImageUrl from '../../../assets/mimic/rare2.png'
import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { LoadedCoinRewardTextures } from '../reward/coinRewardTextures'
import type { LoadedMimicTextures } from '../runtimeTypes'
import { createHorizontalSpriteSheetFrames } from './horizontalSpriteSheetTextures'

export interface LoadedEffectCardTextures {
  normalFrame: Texture
  thunderIcon: Texture
  thunderFrames: Texture[]
}

export interface LoadedRuntimeAssets {
  mimics: LoadedMimicTextures
  coins: LoadedCoinRewardTextures
  effectCards: LoadedEffectCardTextures
}

function nearestTextureOptions(src: string) {
  return { src, data: { scaleMode: 'nearest' as const } }
}

export async function loadRuntimeAssets(): Promise<LoadedRuntimeAssets> {
  const [
    normal,
    rare1,
    rare2,
    jackpot,
    coinFlipStrip,
    coinIdle,
    normalFrame,
    thunderIcon,
    thunderStrip,
  ] = await Promise.all([
    Assets.load<Texture>(normalImageUrl),
    Assets.load<Texture>(rare1ImageUrl),
    Assets.load<Texture>(rare2ImageUrl),
    Assets.load<Texture>(jackpotImageUrl),
    Assets.load<Texture>(goldCoinFlipImageUrl),
    Assets.load<Texture>(goldCoinIdleImageUrl),
    Assets.load<Texture>(nearestTextureOptions(normalEffectCardFrameUrl)),
    Assets.load<Texture>(nearestTextureOptions(thunderEffectCardIconUrl)),
    Assets.load<Texture>(nearestTextureOptions(thunderStripUrl)),
  ])
  assertTextureDimensions(
    normalFrame,
    'effects/card_frame/normal',
    attachedCardConfig.card.sourceWidthPixels,
    attachedCardConfig.card.sourceHeightPixels,
  )
  assertTextureDimensions(
    thunderIcon,
    'effects/card_icon/thunder',
    attachedCardConfig.card.sourceWidthPixels,
    attachedCardConfig.card.sourceHeightPixels,
  )

  return {
    mimics: { normal, rare1, rare2, jackpot },
    coins: {
      flipFrames: createHorizontalSpriteSheetFrames(
        coinFlipStrip,
        coinRewardAnimationConfig.spriteSheet,
      ),
      idle: coinIdle,
    },
    effectCards: {
      normalFrame,
      thunderIcon,
      thunderFrames: createHorizontalSpriteSheetFrames(
        thunderStrip,
        effectCardConfig.thunder.spriteSheet,
      ),
    },
  }
}

function assertTextureDimensions(
  texture: Texture,
  assetLabel: string,
  expectedWidth: number,
  expectedHeight: number,
): void {
  if (texture.width === expectedWidth && texture.height === expectedHeight) {
    return
  }
  throw new Error(
    `Invalid ${assetLabel} dimensions: expected ${expectedWidth}x${expectedHeight}, received ${texture.width}x${texture.height}`,
  )
}
