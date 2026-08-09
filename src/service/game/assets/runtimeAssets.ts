import { Assets, type Texture } from 'pixi.js'

import goldCoinFlipImageUrl from '../../../assets/coin/gold_coin_flip.png'
import goldCoinIdleImageUrl from '../../../assets/coin/gold_coin_idle.png'
import normalEffectCardFrameUrl from '../../../assets/effects/card_frame/normal.png'
import meteoriteEffectCardIconUrl from '../../../assets/effects/card_icon/meteorite.png'
import thunderEffectCardIconUrl from '../../../assets/effects/card_icon/thunder.png'
import tornadoEffectCardIconUrl from '../../../assets/effects/card_icon/tornado.png'
import explosionStripUrl from '../../../assets/effects/explode.png'
import hitStripUrl from '../../../assets/effects/hit.png'
import meteoriteStripUrl from '../../../assets/effects/meteorite.png'
import thunderStripUrl from '../../../assets/effects/thunder.png'
import tornadoEndStripUrl from '../../../assets/effects/tornado_end.png'
import tornadoRunStripUrl from '../../../assets/effects/tornado_run.png'
import tornadoStartStripUrl from '../../../assets/effects/tornado_start.png'
import ringEquipmentCardUrl from '../../../assets/equipment/decoration/ring_pearl.png'
import swordEquipmentCardUrl from '../../../assets/equipment/weapon/sword.png'
import jackpotImageUrl from '../../../assets/mimic/jackpot.png'
import normalImageUrl from '../../../assets/mimic/normal.png'
import rare1ImageUrl from '../../../assets/mimic/rare1.png'
import rare2ImageUrl from '../../../assets/mimic/rare2.png'
import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import { animationConfig } from '../../../configs/animationConfig'
import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { LoadedCoinRewardTextures } from '../reward/coinRewardTextures'
import type { LoadedMimicTextures } from '../runtimeTypes'
import { createHorizontalSpriteSheetFrames } from './horizontalSpriteSheetTextures'

export interface LoadedAttachedCardTextures {
  frames: { normal: Texture }
  effectIcons: { thunder: Texture; meteorite: Texture; tornado: Texture }
  equipmentCards: { sword: Texture; ring: Texture }
}

export interface LoadedEffectCardTextures {
  thunderFrames: Texture[]
  meteoriteFrames: Texture[]
  explosionFrames: Texture[]
  tornadoStartFrames: Texture[]
  tornadoRunFrames: Texture[]
  tornadoEndFrames: Texture[]
}

export interface LoadedCombatEffectTextures {
  hitFrames: Texture[]
}

export interface LoadedRuntimeAssets {
  mimics: LoadedMimicTextures
  coins: LoadedCoinRewardTextures
  attachedCards: LoadedAttachedCardTextures
  effectCards: LoadedEffectCardTextures
  combatEffects: LoadedCombatEffectTextures
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
    meteoriteIcon,
    tornadoIcon,
    thunderStrip,
    meteoriteStrip,
    explosionStrip,
    hitStrip,
    tornadoStartStrip,
    tornadoRunStrip,
    tornadoEndStrip,
    swordEquipmentCard,
    ringEquipmentCard,
  ] = await Promise.all([
    Assets.load<Texture>(normalImageUrl),
    Assets.load<Texture>(rare1ImageUrl),
    Assets.load<Texture>(rare2ImageUrl),
    Assets.load<Texture>(jackpotImageUrl),
    Assets.load<Texture>(goldCoinFlipImageUrl),
    Assets.load<Texture>(goldCoinIdleImageUrl),
    Assets.load<Texture>(nearestTextureOptions(normalEffectCardFrameUrl)),
    Assets.load<Texture>(nearestTextureOptions(thunderEffectCardIconUrl)),
    Assets.load<Texture>(nearestTextureOptions(meteoriteEffectCardIconUrl)),
    Assets.load<Texture>(nearestTextureOptions(tornadoEffectCardIconUrl)),
    Assets.load<Texture>(nearestTextureOptions(thunderStripUrl)),
    Assets.load<Texture>(nearestTextureOptions(meteoriteStripUrl)),
    Assets.load<Texture>(nearestTextureOptions(explosionStripUrl)),
    Assets.load<Texture>(nearestTextureOptions(hitStripUrl)),
    Assets.load<Texture>(nearestTextureOptions(tornadoStartStripUrl)),
    Assets.load<Texture>(nearestTextureOptions(tornadoRunStripUrl)),
    Assets.load<Texture>(nearestTextureOptions(tornadoEndStripUrl)),
    Assets.load<Texture>(nearestTextureOptions(swordEquipmentCardUrl)),
    Assets.load<Texture>(nearestTextureOptions(ringEquipmentCardUrl)),
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
  assertTextureDimensions(
    meteoriteIcon,
    'effects/card_icon/meteorite',
    attachedCardConfig.card.sourceWidthPixels,
    attachedCardConfig.card.sourceHeightPixels,
  )
  assertTextureDimensions(
    tornadoIcon,
    'effects/card_icon/tornado',
    attachedCardConfig.card.sourceWidthPixels,
    attachedCardConfig.card.sourceHeightPixels,
  )
  assertTextureDimensions(
    swordEquipmentCard,
    'equipment/weapon/sword',
    attachedCardConfig.card.sourceWidthPixels,
    attachedCardConfig.card.sourceHeightPixels,
  )
  assertTextureDimensions(
    ringEquipmentCard,
    'equipment/decoration/ring_pearl',
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
    attachedCards: {
      frames: { normal: normalFrame },
      effectIcons: {
        thunder: thunderIcon,
        meteorite: meteoriteIcon,
        tornado: tornadoIcon,
      },
      equipmentCards: {
        sword: swordEquipmentCard,
        ring: ringEquipmentCard,
      },
    },
    effectCards: {
      thunderFrames: createHorizontalSpriteSheetFrames(
        thunderStrip,
        effectCardConfig.thunder.spriteSheet,
      ),
      meteoriteFrames: createHorizontalSpriteSheetFrames(
        meteoriteStrip,
        effectCardConfig.meteorite.spriteSheet,
      ),
      explosionFrames: createHorizontalSpriteSheetFrames(
        explosionStrip,
        effectCardConfig.meteorite.explosionSpriteSheet,
      ),
      tornadoStartFrames: createHorizontalSpriteSheetFrames(
        tornadoStartStrip,
        effectCardConfig.tornado.spriteSheets.start,
      ),
      tornadoRunFrames: createHorizontalSpriteSheetFrames(
        tornadoRunStrip,
        effectCardConfig.tornado.spriteSheets.run,
      ),
      tornadoEndFrames: createHorizontalSpriteSheetFrames(
        tornadoEndStrip,
        effectCardConfig.tornado.spriteSheets.end,
      ),
    },
    combatEffects: {
      hitFrames: createHorizontalSpriteSheetFrames(
        hitStrip,
        animationConfig.manualHitEffect.spriteSheet,
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
