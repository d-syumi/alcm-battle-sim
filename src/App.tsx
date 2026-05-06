import { useMemo, useState } from 'react'
import './App.css'
import {
  calcCommonBonusPerStat,
  calcInherentStats,
  calcInherentTotalPower,
  EQUIPMENT_MASTER,
  EQUIPMENT_SLOT_LIMIT,
  type EquipmentCategory,
} from './equipment'
import type { Status } from './types'

type Combatant = {
  name: string
  status: Status
}

type AttackResult = {
  hit: boolean
  critical: boolean
  damage: number
  defenderRemainingHp: number
  attackerHitRate: number
  attackerCritRate: number
  criticalCap: number
  attackRoll: number
  defenseRoll: number
}

type EquippedItem = { slotId: string; category: EquipmentCategory; itemId: string; plus: number }

const DEFAULT_A: Combatant = {
  name: 'プレイヤーA',
  status: { hp: 640, mp: 210, str: 80, dex: 70, agi: 65, int: 40, vit: 75, luk: 50 },
}

const DEFAULT_B: Combatant = {
  name: 'プレイヤーB',
  status: { hp: 600, mp: 210, str: 78, dex: 68, agi: 62, int: 45, vit: 72, luk: 42 },
}
const EMPTY_STATUS: Status = { hp: 0, mp: 0, str: 0, dex: 0, agi: 0, int: 0, vit: 0, luk: 0 }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const rollRange = (roll: () => number, min: number, max: number) => min + roll() * (max - min)
const DEFAULT_CRITICAL_CAP = 0.5
const physicalDefense = (vit: number, defenseRoll = 1) => vit * defenseRoll
const STACKABLE_STATS: (keyof Status)[] = ['str', 'dex', 'agi', 'int', 'vit', 'luk']

const addStatus = (base: Status, bonus: Status) =>
  (Object.keys(base) as (keyof Status)[]).reduce(
    (acc, key) => ({ ...acc, [key]: acc[key] + bonus[key] }),
    { ...base },
  )

const calcEquipmentBonus = (equipped: EquippedItem[]) => {
  let inherent = { ...EMPTY_STATUS }
  let common = { ...EMPTY_STATUS }

  for (const eq of equipped) {
    const item = EQUIPMENT_MASTER.find((x) => x.id === eq.itemId)
    if (!item) continue
    if (eq.category === 'orb' && eq.plus < 4) continue

    const scale = eq.category === 'orb' ? 0.3 : 1
    const totalPower = Math.round(calcInherentTotalPower(item.baseTotalPower, eq.plus) * scale)
    const shared = Math.round(calcCommonBonusPerStat(eq.plus) * scale)
    const commonPower = shared * STACKABLE_STATS.length
    const inherentTp = Math.max(0, totalPower - commonPower)
    inherent = addStatus(inherent, calcInherentStats(inherentTp, item.statRatios))

    for (const key of STACKABLE_STATS) common[key] += shared
  }

  return { inherent, common, total: addStatus(inherent, common) }
}

const buildInitialEquipment = (): EquippedItem[] => {
  const categories: EquipmentCategory[] = ['weapon', 'head', 'armor', 'boots', 'accessory', 'orb']
  const result: EquippedItem[] = []

  for (const category of categories) {
    const limit = EQUIPMENT_SLOT_LIMIT[category]
    for (let i = 0; i < limit; i += 1) {
      result.push({ slotId: `${category}-${i + 1}`, category, itemId: '', plus: category === 'orb' ? 4 : 0 })
    }
  }
  return result
}


const slotLabel = (slot: EquippedItem) => {
  if (slot.slotId === 'weapon-1') return '武器1'
  if (slot.slotId === 'weapon-2') return '武器2'
  if (slot.slotId === 'head-1') return '頭具'
  if (slot.slotId === 'armor-1') return '防具'
  if (slot.slotId === 'boots-1') return '足具'
  if (slot.slotId === 'accessory-1') return 'アクセサリー1'
  if (slot.slotId === 'accessory-2') return 'アクセサリー2'
  if (slot.slotId === 'orb-1') return '宝珠1'
  if (slot.slotId === 'orb-2') return '宝珠2'
  if (slot.slotId === 'orb-3') return '宝珠3'
  return slot.slotId
}

const calcHitRate = (attacker: Status, defender: Status) => {
  const base = 0.83
  const dexTerm = (attacker.dex - defender.agi * 0.65) * 0.0028
  const luckTerm = (attacker.luk - defender.luk) * 0.0008
  const vitTerm = defender.vit * 0.0003
  return clamp(base + dexTerm + luckTerm - vitTerm, 0.1, 0.98)
}
const calcCriticalRate = (attacker: Status, defender: Status, criticalCap = DEFAULT_CRITICAL_CAP) => {
  const base = 0.07
  const defenderLuk = Math.max(defender.luk, 1)
  const lukRatio = attacker.luk / defenderLuk
  const uncappedRate = base + (lukRatio - 1) * (0.93 / 49)
  return clamp(uncappedRate, 0.01, criticalCap)
}

const calcNormalAttack = (attacker: Combatant, defender: Combatant, roll = Math.random): AttackResult => {
  const hitRate = calcHitRate(attacker.status, defender.status)
  const criticalRate = calcCriticalRate(attacker.status, defender.status, DEFAULT_CRITICAL_CAP)
  if (roll() > hitRate) return { hit: false, critical: false, damage: 0, defenderRemainingHp: defender.status.hp, attackerHitRate: hitRate, attackerCritRate: criticalRate, criticalCap: DEFAULT_CRITICAL_CAP, attackRoll: 0, defenseRoll: 0 }

  const attackRoll = rollRange(roll, 0.66, 1.0)
  const defenseRoll = rollRange(roll, 0.5, 1.0)
  const attackPower = attacker.status.str * attackRoll
  const defense = physicalDefense(defender.status.vit, defenseRoll)
  const crit = roll() < criticalRate
  const rawDamage = (attackPower - defense) * (crit ? 1.5 : 1)
  const damage = Math.max(0, Math.round(rawDamage))
  return { hit: true, critical: crit, damage, defenderRemainingHp: Math.max(0, defender.status.hp - damage), attackerHitRate: hitRate, attackerCritRate: criticalRate, criticalCap: DEFAULT_CRITICAL_CAP, attackRoll, defenseRoll }
}


const formatNonZeroStatus = (status: Status, withPlus = false) => {
  const order: (keyof Status)[] = ['hp', 'mp', 'str', 'dex', 'agi', 'int', 'vit', 'luk']
  const labels: Record<keyof Status, string> = { hp: 'HP', mp: 'MP', str: 'STR', dex: 'DEX', agi: 'AGI', int: 'INT', vit: 'VIT', luk: 'LUK' }
  const items = order
    .filter((key) => status[key] !== 0)
    .map((key) => `${labels[key]} ${withPlus ? '+' : ''}${status[key]}`)
  return items.length > 0 ? items.join(' / ') : 'なし'
}

function App() {
  const [a, setA] = useState<Combatant>(DEFAULT_A)
  const [b] = useState<Combatant>(DEFAULT_B)
  const [equipped, setEquipped] = useState<EquippedItem[]>(buildInitialEquipment)
  const [log, setLog] = useState<string>('未実行')

  const equipmentBonus = useMemo(() => calcEquipmentBonus(equipped), [equipped])
  const actualA = useMemo(() => ({ ...a, status: addStatus(a.status, equipmentBonus.total) }), [a, equipmentBonus])

  const quickView = useMemo(() => ({
    aPdefMinMax: `${physicalDefense(actualA.status.vit, 0.5).toFixed(1)} ~ ${physicalDefense(actualA.status.vit, 1.0).toFixed(1)}`,
    bPdefMinMax: `${physicalDefense(b.status.vit, 0.5).toFixed(1)} ~ ${physicalDefense(b.status.vit, 1.0).toFixed(1)}`,
    hitAB: (calcHitRate(actualA.status, b.status) * 100).toFixed(1),
    hitBA: (calcHitRate(b.status, actualA.status) * 100).toFixed(1),
  }), [actualA.status, b.status])

  const updateStatus = (key: keyof Status, value: number) => setA((prev) => ({ ...prev, status: { ...prev.status, [key]: Math.max(0, value) } }))

  const runOneAttack = () => {
    const result = calcNormalAttack(actualA, b)
    const line = result.hit ? `${actualA.name} → ${b.name}: ${result.damage} ダメージ${result.critical ? ' (クリティカル)' : ''} / 残りHP ${result.defenderRemainingHp}` : `${actualA.name} → ${b.name}: ミス`
    setLog(`${line}\n命中率: ${(result.attackerHitRate * 100).toFixed(1)}% / クリ率: ${(result.attackerCritRate * 100).toFixed(1)}%\n${result.hit ? `攻撃乱数: x${result.attackRoll.toFixed(3)} / 防御乱数: x${result.defenseRoll.toFixed(3)}` : ''}`)
  }

  return <main className="app">
    <h1>あるけみバトルシミュレーター</h1>
    <section className="panel">
      <h2>装備</h2>
      <p className="notice">装備戦闘力は正確でない場合があります。特に宝珠は少しズレるためご注意ください。</p>
      {equipped.map((slot, i) => {
        const items = slot.category === 'orb'
          ? EQUIPMENT_MASTER.filter((x) => x.category !== 'orb')
          : EQUIPMENT_MASTER.filter((x) => x.category === slot.category)
        const selected = EQUIPMENT_MASTER.find((x) => x.id === slot.itemId)
        const slotPower = selected ? Math.round(calcInherentTotalPower(selected.baseTotalPower, slot.plus) * (slot.category === 'orb' ? 0.3 : 1)) : 0
        return <div key={slot.slotId} className="equip-row">
          <strong>{slotLabel(slot)}</strong>
          <select value={slot.itemId} onChange={(e) => setEquipped((prev) => prev.map((p, idx) => idx === i ? { ...p, itemId: e.target.value } : p))}>
            <option value="">装備なし</option>
            {items.map((item) => <option key={item.id} value={item.id}>[{item.rank}] {item.name}</option>)}
          </select>
          <label className="plus-field">+<input type="number" min={slot.category === 'orb' ? 4 : 0} max={15} step={1} value={slot.plus} onChange={(e) => setEquipped((prev) => prev.map((p, idx) => idx === i ? { ...p, plus: Math.max(slot.category === 'orb' ? 4 : 0, Math.floor(Number(e.target.value))) } : p))} /></label>
          <span className="slot-power">戦闘力{slotPower}</span>
        </div>
      })}
      <p>固有値合計: {formatNonZeroStatus(equipmentBonus.inherent)}</p>
      <p>共通値合計: {formatNonZeroStatus(equipmentBonus.common, true)}</p>
    </section>
    <section className="panel">
      {(['hp','mp','str','dex','agi','int','vit','luk'] as (keyof Status)[]).map((k)=><label key={k}>{k.toUpperCase()}<input type="number" value={a.status[k]} min={0} onChange={(e)=>updateStatus(k, Number(e.target.value))} /></label>)}
      <p>実ステータス(装備込み): STR {actualA.status.str} / DEX {actualA.status.dex} / AGI {actualA.status.agi} / INT {actualA.status.int} / VIT {actualA.status.vit} / LUK {actualA.status.luk}</p>
    </section>
    <section className="panel metrics"><p>A物防:{quickView.aPdefMinMax} / B物防:{quickView.bPdefMinMax}</p><p>A→B命中:{quickView.hitAB}% / B→A命中:{quickView.hitBA}%</p></section>
    <button onClick={runOneAttack}>AがBを通常攻撃</button>
    <pre className="panel log">{log}</pre>
  </main>
}

export default App
