import { useMemo, useState } from 'react'
import './App.css'

type Status = {
  hp: number
  mp: number
  str: number
  dex: number
  agi: number
  int: number
  vit: number
  luk: number
}

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

const DEFAULT_A: Combatant = {
  name: 'プレイヤーA',
  status: { hp: 640, mp: 210, str: 80, dex: 70, agi: 65, int: 40, vit: 75, luk: 50 },
}

const DEFAULT_B: Combatant = {
  name: 'プレイヤーB',
  status: { hp: 600, mp: 210, str: 78, dex: 68, agi: 62, int: 45, vit: 72, luk: 42 },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const rollRange = (roll: () => number, min: number, max: number) => min + roll() * (max - min)

const DEFAULT_CRITICAL_CAP = 0.5

const physicalDefense = (vit: number, defenseRoll = 1) => vit * defenseRoll

const calcHitRate = (attacker: Status, defender: Status) => {
  const base = 0.83
  const dexTerm = (attacker.dex - defender.agi * 0.65) * 0.0028
  const luckTerm = (attacker.luk - defender.luk) * 0.0008
  const vitTerm = defender.vit * 0.0003
  return clamp(base + dexTerm + luckTerm - vitTerm, 0.1, 0.98)
}

const calcCriticalRate = (
  attacker: Status,
  defender: Status,
  criticalCap = DEFAULT_CRITICAL_CAP,
) => {
  const base = 0.07
  const defenderLuk = Math.max(defender.luk, 1)
  const lukRatio = attacker.luk / defenderLuk

  // lukRatio=1 -> 7%, lukRatio=50 -> 100%
  const uncappedRate = base + (lukRatio - 1) * (0.93 / 49)
  return clamp(uncappedRate, 0.01, criticalCap)
}

const calcNormalAttack = (attacker: Combatant, defender: Combatant, roll = Math.random): AttackResult => {
  const hitRate = calcHitRate(attacker.status, defender.status)
  const criticalRate = calcCriticalRate(attacker.status, defender.status, DEFAULT_CRITICAL_CAP)

  if (roll() > hitRate) {
    return {
      hit: false,
      critical: false,
      damage: 0,
      defenderRemainingHp: defender.status.hp,
      attackerHitRate: hitRate,
      attackerCritRate: criticalRate,
      criticalCap: DEFAULT_CRITICAL_CAP,
      attackRoll: 0,
      defenseRoll: 0,
    }
  }

  const attackRoll = rollRange(roll, 0.66, 1.0)
  const defenseRoll = rollRange(roll, 0.5, 1.0)
  const attackPower = attacker.status.str * attackRoll
  const defense = physicalDefense(defender.status.vit, defenseRoll)
  const crit = roll() < criticalRate
  const critMultiplier = crit ? 1.5 : 1
  const rawDamage = (attackPower - defense) * critMultiplier
  const damage = Math.max(0, Math.round(rawDamage))
  const remainingHp = Math.max(0, defender.status.hp - damage)

  return {
    hit: true,
    critical: crit,
    damage,
    defenderRemainingHp: remainingHp,
    attackerHitRate: hitRate,
    attackerCritRate: criticalRate,
    criticalCap: DEFAULT_CRITICAL_CAP,
    attackRoll,
    defenseRoll,
  }
}

function StatInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (next: number) => void
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function App() {
  const [a, setA] = useState<Combatant>(DEFAULT_A)
  const [b, setB] = useState<Combatant>(DEFAULT_B)
  const [log, setLog] = useState<string>('未実行')

  const quickView = useMemo(() => {
    return {
      aPdefMinMax: `${physicalDefense(a.status.vit, 0.5).toFixed(1)} ~ ${physicalDefense(a.status.vit, 1.0).toFixed(1)}`,
      bPdefMinMax: `${physicalDefense(b.status.vit, 0.5).toFixed(1)} ~ ${physicalDefense(b.status.vit, 1.0).toFixed(1)}`,
      hitAB: (calcHitRate(a.status, b.status) * 100).toFixed(1),
      hitBA: (calcHitRate(b.status, a.status) * 100).toFixed(1),
    }
  }, [a.status, b.status])

  const updateStatus = (side: 'a' | 'b', key: keyof Status, value: number) => {
    const setter = side === 'a' ? setA : setB
    setter((prev) => ({
      ...prev,
      status: {
        ...prev.status,
        [key]: Math.max(0, value),
      },
    }))
  }

  const runOneAttack = () => {
    const result = calcNormalAttack(a, b)
    const line = result.hit
      ? `${a.name} → ${b.name}: ${result.damage} ダメージ${result.critical ? ' (クリティカル)' : ''} / 残りHP ${result.defenderRemainingHp}`
      : `${a.name} → ${b.name}: ミス`

    setLog(
      `${line}\n命中率: ${(result.attackerHitRate * 100).toFixed(1)}% / クリ率: ${(result.attackerCritRate * 100).toFixed(1)}% (上限 ${(result.criticalCap * 100).toFixed(0)}%)\n` +
        (result.hit
          ? `攻撃乱数: x${result.attackRoll.toFixed(3)} (物理 1.00~0.66) / 防御乱数: x${result.defenseRoll.toFixed(3)} (物防 1.00~0.50)`
          : ''),
    )
  }

  return (
    <main className="app">
      <h1>あるけみバトルシミュレーター (最初の実装)</h1>
      <p>1vs1・通常攻撃 1 回だけの計算を行います。</p>

      <section className="grid">
        {[{ key: 'a', data: a }, { key: 'b', data: b }].map((entry) => (
          <article key={entry.key} className="panel">
            <h2>{entry.data.name}</h2>
            <StatInput label="HP" value={entry.data.status.hp} onChange={(v) => updateStatus(entry.key as 'a' | 'b', 'hp', v)} />
            <StatInput label="MP" value={entry.data.status.mp} onChange={(v) => updateStatus(entry.key as 'a' | 'b', 'mp', v)} />
            <StatInput label="STR" value={entry.data.status.str} onChange={(v) => updateStatus(entry.key as 'a' | 'b', 'str', v)} />
            <StatInput label="DEX" value={entry.data.status.dex} onChange={(v) => updateStatus(entry.key as 'a' | 'b', 'dex', v)} />
            <StatInput label="AGI" value={entry.data.status.agi} onChange={(v) => updateStatus(entry.key as 'a' | 'b', 'agi', v)} />
            <StatInput label="INT" value={entry.data.status.int} onChange={(v) => updateStatus(entry.key as 'a' | 'b', 'int', v)} />
            <StatInput label="VIT" value={entry.data.status.vit} onChange={(v) => updateStatus(entry.key as 'a' | 'b', 'vit', v)} />
            <StatInput label="LUK" value={entry.data.status.luk} onChange={(v) => updateStatus(entry.key as 'a' | 'b', 'luk', v)} />
          </article>
        ))}
      </section>

      <section className="panel metrics">
        <p>A物防レンジ: {quickView.aPdefMinMax} / B物防レンジ: {quickView.bPdefMinMax}</p>
        <p>A→B 命中率: {quickView.hitAB}% / B→A 命中率: {quickView.hitBA}%</p>
      </section>

      <button onClick={runOneAttack} type="button">
        AがBを通常攻撃
      </button>

      <pre className="panel log">{log}</pre>
    </main>
  )
}

export default App
