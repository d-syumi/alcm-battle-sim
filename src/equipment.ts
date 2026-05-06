import type { Status } from './types'

export type EquipmentCategory = 'weapon' | 'head' | 'armor' | 'boots' | 'accessory'
export type EquipmentRank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

export type EquipmentMaster = {
  id: string
  name: string
  category: EquipmentCategory
  rank: EquipmentRank
  baseTotalPower: number
  statRatios: Partial<Record<keyof Status, number>>
}

export const EQUIPMENT_SLOT_LIMIT: Record<EquipmentCategory, number> = {
  weapon: 2,
  head: 1,
  armor: 1,
  boots: 1,
  accessory: 2,
}

// 実測テーブル(+値込み戦闘力)。値は共通値を含んだ総戦闘力。
const TOTAL_POWER_TABLE_BY_BASE: Record<number, number[]> = {
  11: [11, 24, 44, 79, 141, 254, 470, 888, 1703, 3308, 6481, 12774],
  13: [13, 29, 53, 92, 159, 280, 505, 936, 1771, 3404, 6617, 12970, 25568],
  18: [18, 42, 74, 123, 204, 342, 591, 1056, 1938, 3639, 6954, 13455],
  28: [28, 67, 117, 187, 294, 467, 765, 1296, 2275, 4114],
  36: [36, 86, 150, 238, 366, 568, 904, 1490, 2542, 4494],
  46: [46, 112, 194, 302, 457, 694, 1078, 1730, 2880, 4968, 8848],
  56: [56, 137, 235, 365, 547, 818, 1252, 1969, 3215, 5440],
  86: [86, 212, 364, 557, 820, 1197, 1773, 2693, 4223, 6865],
}

export const calcInherentTotalPower = (baseTotalPower: number, plus: number) => {
  const safePlus = Math.max(0, Math.floor(plus))
  const table = TOTAL_POWER_TABLE_BY_BASE[baseTotalPower]

  if (table && safePlus < table.length) return table[safePlus]

  if (table && table.length >= 2) {
    // テーブル外は末尾2点の比率で外挿
    const last = table[table.length - 1]
    const prev = table[table.length - 2]
    const growth = last / Math.max(prev, 1)
    return Math.round(last * growth ** (safePlus - (table.length - 1)))
  }

  // 未定義baseは近傍baseの倍率で補間
  const nearestBase = Object.keys(TOTAL_POWER_TABLE_BY_BASE)
    .map(Number)
    .sort((a, b) => Math.abs(a - baseTotalPower) - Math.abs(b - baseTotalPower))[0]
  const nearestTable = TOTAL_POWER_TABLE_BY_BASE[nearestBase]
  const ref = safePlus < nearestTable.length ? nearestTable[safePlus] : nearestTable[nearestTable.length - 1]
  return Math.round((baseTotalPower / nearestBase) * ref)
}

export const calcCommonBonusPerStat = (plus: number) => 2 ** plus

export const calcInherentStats = (
  totalPower: number,
  ratios: Partial<Record<keyof Status, number>>,
): Status => {
  const keys = Object.keys(ratios) as (keyof Status)[]
  const sumRatio = keys.reduce((acc, key) => acc + (ratios[key] ?? 0), 0)
  const initial: Status = { hp: 0, mp: 0, str: 0, dex: 0, agi: 0, int: 0, vit: 0, luk: 0 }

  if (sumRatio <= 0) return initial

  const distributed = keys.map((key) => ({ key, value: (totalPower * (ratios[key] ?? 0)) / sumRatio }))
  let used = 0
  for (const entry of distributed) {
    const value = Math.floor(entry.value)
    initial[entry.key] += value
    used += value
  }

  let rest = totalPower - used
  distributed
    .sort((a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)))
    .forEach((entry) => {
      if (rest > 0) {
        initial[entry.key] += 1
        rest -= 1
      }
    })

  return initial
}

const create = (
  category: EquipmentCategory,
  name: string,
  rank: EquipmentRank,
  baseTotalPower: number,
  ratios: EquipmentMaster['statRatios'],
): EquipmentMaster => ({
  id: `${category}-${name}`,
  name,
  category,
  rank,
  baseTotalPower,
  statRatios: ratios,
})

export const EQUIPMENT_MASTER: EquipmentMaster[] = [
  // weapon
  create('weapon', 'こんぼう', 'F', 11,{ str: 100 }),
  create('weapon', 'アイアンブレード', 'F', 11,{ str: 40, dex: 60 }),
  create('weapon', 'ウッドハンマー', 'F', 13,{ str: 100 }),
  create('weapon', 'アイアンバックラー', 'F', 13,{ vit: 100 }),
  create('weapon', 'ブロンズスピア', 'E', 18,{ str: 83.3, agi: 16.7 }),
  create('weapon', 'シルバーダガー', 'E', 19,{ str: 23.1, agi: 76.9 }),
  create('weapon', 'アイアンモーニングスター', 'E', 18,{ str: 50, luk: 50 }),
  create('weapon', '紅蓮の盾', 'E', 18,{ vit: 83.3, luk: 16.7 }),
  create('weapon', 'スチールソード', 'D', 26,{ str: 85, int: 15 }),
  create('weapon', 'オークウォーハンマー', 'D', 26,{ str: 50, vit: 50 }),
  create('weapon', 'ブロンズピケ', 'D', 26,{ str: 35, dex: 65 }),
  create('weapon', '竜皮の盾', 'D', 26,{ vit: 65, luk: 35 }),
  create('weapon', 'ミスリルブレード', 'C', 36,{ str: 46.7, dex: 53.3 }),
  create('weapon', 'エレガントラピア', 'C', 36,{ dex: 50, agi: 50 }),
  create('weapon', 'ステンレスクロウ', 'C', 36,{ str: 50, vit: 50 }),
  create('weapon', 'サンライトシールド', 'C', 36,{ int: 50, vit: 50 }),
  create('weapon', '虚空を断つ刀', 'C', 46,{ str: 75, agi: 12.5, luk: 12.5 }),
  create('weapon', 'シルバーナイトソード', 'B', 46,{ str: 75, agi: 25 }),
  create('weapon', 'ドラゴンバトルハンマー', 'B', 46,{ str: 30, vit: 70 }),
  create('weapon', 'ミスリルステッキ', 'B', 46,{ agi: 25, int: 75 }),
  create('weapon', '聖騎士の刃楯', 'B', 46,{ str: 30, vit: 70 }),
  create('weapon', '天啓目録', 'B', 56,{ dex: 10, agi: 10, int: 80 }),
  create('weapon', 'オニキスブレード', 'A', 56,{ str: 70, dex: 20, agi: 10 }),
  create('weapon', 'デーモンズグレイブ', 'A', 56,{ str: 10, dex: 50, luk: 40 }),
  create('weapon', '聖者の杖', 'A', 56,{ agi: 20, int: 70, vit: 10 }),
  create('weapon', 'アヴァロンの盾', 'A', 56,{ agi: 10, int: 20, vit: 70 }),
  create('weapon', 'クリムゾンバレット', 'A', 56,{ str: 6.25, dex: 56.25, agi: 6.25, int: 6.25, vit: 6.25, luk: 18.75 }),
  create('weapon', '絶対零弩', 'S', 86,{ str: 50, dex: 18.75, agi: 18.75, vit: 6.25, luk: 6.25 }),
  create('weapon', '夢幻水晶', 'S', 86,{ dex: 12.5, agi: 18.75, int: 56.25, vit: 6.25, luk: 6.25 }),
  create('weapon', 'ヴァルキリーシールド', 'S', 86,{ dex: 6.25, agi: 12.5, int: 18.75, vit: 56.25, luk: 6.25 }),
  create('weapon', '引鉄斧', 'S', 86,{ str: 55, dex: 5, vit: 20, luk: 20 }),
  create('weapon', '聖槍ロンギヌス', 'S', 86,{ str: 20, dex: 55, agi: 15, vit: 5, luk: 5 }),
  create('weapon', '獄竜剣', 'S', 86,{ str: 30, dex: 25, agi: 40, vit: 5 }),

  // head
  create('head', 'ベレー帽', 'F', 11,{ int: 60, luk: 40 }),
  create('head', '赤いリボン', 'F', 11,{ agi: 40, luk: 60 }),
  create('head', 'てっかめん', 'E', 18,{ str: 30, dex: 20, vit: 50 }),
  create('head', 'シルバーイヤリング', 'E', 18,{ dex: 20, agi: 20, int: 30, luk: 30 }),
  create('head', 'ドラゴンヘルム', 'D', 26,{ str: 30, dex: 25, agi: 5, vit: 40 }),
  create('head', 'ホワイトブリム', 'D', 26,{ dex: 27, agi: 27, int: 27, luk: 19 }),
  create('head', 'カウボーイハット', 'C', 36,{ dex: 40, agi: 40, int: 10, luk: 10 }),
  create('head', '天使の光輪', 'C', 36,{ int: 50, vit: 20, luk: 30 }),
  create('head', '戦士のバンダナ', 'B', 46,{ str: 40, dex: 10, agi: 20, vit: 30 }),
  create('head', 'モコモコマフラー', 'B', 46,{ int: 35, vit: 35, luk: 30 }),
  create('head', 'アルケ・ゴーグル', 'A', 56,{ str: 15, dex: 40, agi: 15, int: 10, vit: 10, luk: 10 }),
  create('head', 'フレイムクラウン', 'A', 56,{ str: 10, dex: 10, agi: 15, int: 40, vit: 25 }),
  create('head', 'ルナ・ティアラ', 'S', 86,{ dex: 10, agi: 20, int: 40, vit: 15, luk: 15 }),
  create('head', 'タイタンヘッド', 'S', 86,{ str: 50, dex: 25, vit: 25 }),

  // armor
  create('armor', 'くさりかたびら', 'F', 11,{ vit: 100 }),
  create('armor', '布のローブ', 'F', 11,{ int: 40, vit: 60 }),
  create('armor', '鋼鉄の鎧', 'E', 18,{ dex: 16.7, vit: 83.3 }),
  create('armor', '魔法使いのローブ', 'E', 18,{ agi: 16.7, int: 41.7, vit: 41.7 }),
  create('armor', 'ドラゴンスキンアーマー', 'D', 26,{ str: 30, vit: 70 }),
  create('armor', 'エルフのシルクローブ', 'D', 26,{ agi: 20, int: 40, vit: 40 }),
  create('armor', '守護者の鎧', 'C', 36,{ str: 16.7, dex: 16.7, vit: 66.7 }),
  create('armor', '賢者のローブ', 'C', 36,{ agi: 20, int: 40, vit: 40 }),
  create('armor', 'デーモンプレートアーマー', 'B', 46,{ str: 50, vit: 50 }),
  create('armor', '幻影のローブ', 'B', 46,{ agi: 10, int: 45, vit: 45 }),
  create('armor', '光の鎧', 'A', 56,{ str: 8, dex: 8, agi: 4, vit: 56, luk: 24 }),
  create('armor', '大魔導師のローブ', 'A', 56,{ agi: 4, int: 48, vit: 48 }),
  create('armor', '厄災のヴェール', 'S', 86,{ agi: 12.5, int: 50, vit: 37.5 }),
  create('armor', '煉獄の炎鎧', 'S', 86,{ str: 25, dex: 12.5, agi: 6.25, vit: 6.25, luk: 50 }),

  // boots
  create('boots', 'レザーブーツ', 'F', 11,{ str: 20, dex: 20, agi: 40, vit: 20 }),
  create('boots', '布製のブーツ', 'F', 11,{ agi: 40, int: 20, vit: 20, luk: 20 }),
  create('boots', '鉄のブーツ', 'E', 18,{ str: 16.7, dex: 16.7, agi: 43.3, vit: 25 }),
  create('boots', 'エナメルブーツ', 'E', 18,{ agi: 43.3, int: 16.7, vit: 25, luk: 16.7 }),
  create('boots', '鋼鉄のブーツ', 'D', 26,{ str: 9.1, dex: 9.1, agi: 54.5, vit: 27.3 }),
  create('boots', 'クロコダイルブーツ', 'D', 26,{ agi: 54.5, int: 9.1, vit: 27.3, luk: 9.1 }),
  create('boots', '神秘のブーツ', 'C', 36,{ str: 13.3, dex: 13.3, agi: 53.4, vit: 20 }),
  create('boots', '砂漠のブーツ', 'C', 36,{ agi: 53.3, int: 13.3, vit: 20, luk: 13.3 }),
  create('boots', '竜鱗のブーツ', 'B', 46,{ str: 15, dex: 15, agi: 55, vit: 15 }),
  create('boots', 'フォレストブーツ', 'B', 46,{ agi: 55, int: 15, vit: 15, luk: 15 }),
  create('boots', '星空ブーツ', 'A', 56,{ str: 16, dex: 16, agi: 52, vit: 16 }),
  create('boots', 'シャドウブーツ', 'A', 56,{ agi: 52, int: 16, vit: 16, luk: 16 }),
  create('boots', '雷鳴のグリーブス', 'S', 86,{ str: 12.5, agi: 50, int: 12.5, vit: 25 }),
  create('boots', 'クロノギア・ブーツ', 'S', 86,{ agi: 55, int: 45 }),

  // accessory
  create('accessory', '銅の指輪', 'F', 11,{ str: 20, dex: 20, agi: 20, int: 20, vit: 20 }),
  create('accessory', '布製のベルト', 'F', 11,{ str: 40, dex: 20, int: 20, vit: 20 }),
  create('accessory', '銀のペンダント', 'E', 18,{ str: 16.7, dex: 16.7, agi: 25, int: 8.3, vit: 25, luk: 8.3 }),
  create('accessory', '鋼鉄の腕輪', 'E', 18,{ str: 25, dex: 25, agi: 16.7, int: 8.3, vit: 16.7, luk: 8.3 }),
  create('accessory', 'ルビーの指輪', 'D', 26,{ str: 25, dex: 25, agi: 20, int: 10, vit: 15, luk: 5 }),
  create('accessory', '魔法のネックレス', 'D', 26,{ str: 20, dex: 20, agi: 20, int: 15, vit: 20, luk: 5 }),
  create('accessory', '竜の牙', 'C', 36,{ str: 23.3, dex: 23.3, agi: 20, int: 10, vit: 16.7, luk: 6.7 }),
  create('accessory', '宝石のブローチ', 'C', 36,{ str: 20, dex: 20, agi: 20, int: 13.3, vit: 20, luk: 6.7 }),
  create('accessory', '伝説のメダリオン', 'B', 46,{ str: 20, dex: 20, agi: 20, int: 10, vit: 20, luk: 10 }),
  create('accessory', '星屑のリング', 'B', 46,{ str: 20, dex: 20, agi: 17.5, int: 12.5, vit: 17.5, luk: 12.5 }),
  create('accessory', '神秘のペンダント', 'A', 56,{ str: 20, dex: 20, agi: 20, int: 10, vit: 20, luk: 10 }),
  create('accessory', '太陽のアミュレット', 'A', 56,{ str: 20, dex: 18, agi: 18, int: 14, vit: 18, luk: 12 }),
  create('accessory', '竜王のブレスレット', 'S', 86,{ str: 18.75, dex: 18.75, agi: 18.75, int: 12.5, vit: 18.75, luk: 12.5 }),
  create('accessory', 'ミスティック・オーブ', 'S', 86,{ str: 10, dex: 12.5, agi: 27.5, int: 27.5, vit: 12.5, luk: 10 }),
]
