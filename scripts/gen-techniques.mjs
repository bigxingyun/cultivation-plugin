#!/usr/bin/env node
// 生成器：从《功法丹药图鉴.md》§二 解析出 external/koishi-plugin-xianxia-idle/src/data/techniques.ts
// 用法：node scripts/gen-techniques.mjs
// 只读源文档、只写一个生成物。不要手改生成物。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, '插件', '基础', '功法丹药图鉴.md')
const OUT = path.join(ROOT, 'external', 'koishi-plugin-xianxia-idle', 'src', 'data', 'techniques.ts')

const GRADE_NAMES = ['凡', '黄', '玄', '地', '天', '仙', '帝']
const TIERS = ['L', 'M', 'U']
/** 可掉落的最低大境界序数：按品级硬编码（设定文档 §6.5），不从文档解析 */
const UNLOCK_BY_GRADE = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 6, 7: 7 }
/** 查表 7 值，不得现算 */
const M_TECH_TABLE = [1.2, 1.62, 2.19, 2.95, 3.99, 5.39, 8.45]

const problems = []
const must = (cond, msg) => { if (!cond) problems.push(msg) }
const r6 = (n) => Math.round(n * 1e6) / 1e6
const cells = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim())
const strip = (s) => s.replace(/\*\*/g, '').trim()

/** 「数值」列的单段解析：按 code 决定量纲 */
function parseValue(raw, code, where) {
  const s = strip(raw)
  let m
  if (code === 'E6') {
    m = /^[×x]\s*([\d.]+)$/.exec(s)
    if (!m) throw new Error(`${where}: E6 期望 ×倍数，实得 ${JSON.stringify(s)}`)
    return r6(Number(m[1]) - 1) // ×1.027 → 0.027
  }
  if (code === 'E3' || code === 'E7') {
    m = /^\+\s*([\d.]+)\s*pt$/.exec(s)
    if (!m) throw new Error(`${where}: ${code} 期望 +n pt，实得 ${JSON.stringify(s)}`)
    return Number(m[1]) // 百分点，不除 100
  }
  m = /^\+\s*([\d.]+)%$/.exec(s)
  if (!m) throw new Error(`${where}: ${code} 期望 +n%，实得 ${JSON.stringify(s)}`)
  return r6(Number(m[1]) / 100)
}

/* ---------------- 解析 ---------------- */
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)
const TECH_HEAD = /^### (T\d{2}) ｜ (.+)$/
const techs = []
let cur = null

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (line.startsWith('#')) {
    const h = TECH_HEAD.exec(line)
    if (h) {
      const parts = h[2].split(' · ') // 名 · 品级 · 倾向 · 特效
      const grade = GRADE_NAMES.indexOf(parts[1].replace(/品$/, '')) + 1
      cur = { id: h[1], name: parts[0].trim(), grade, tendency: parts[2].trim(), headEffects: (parts[3].match(/E[1-8]/g) || []), dex: '', image: '', acquire: '', tiers: {}, line: i + 1 }
      techs.push(cur)
    } else {
      cur = null // 离开 §二 的模板区（如 ### 2.1 分布检查 / ## 三）
    }
    continue
  }
  if (!cur) continue
  const b = /^- \*\*典出\*\*：(.*)$/.exec(line)
  if (b) { cur.dex = b[1].trim(); continue }
  const im = /^- \*\*形象\*\*：(.*)$/.exec(line)
  if (im) { cur.image = im[1].trim(); continue }
  const ac = /^- \*\*获取倾向\*\*：(.*)$/.exec(line)
  if (ac) { cur.acquire = ac[1].trim(); continue }
  if (!line.startsWith('|')) continue
  const c = cells(line)
  const idm = /^`(T\d{2})-([LMU])`$/.exec(c[0] || '')
  if (!idm) continue
  const where = `${cur.id}/${idm[2]}（源文档第 ${i + 1} 行）`
  must(idm[1] === cur.id, `${where}: 表内 id 与标题不一致（${idm[1]} vs ${cur.id}）`)
  const codes = c[2].match(/E[1-8]/g) || []
  const raws = strip(c[3]).split('/').map((s) => s.trim()).filter((s) => s !== '')
  must(codes.length > 0, `${where}: 特效列没抠出 E 编号（${JSON.stringify(c[2])}）`)
  must(codes.length === raws.length, `${where}: effects ${codes.length} 个 vs 数值 ${raws.length} 段，不是一一对应`)
  const effects = codes.map((code, k) => ({ code, value: parseValue(raws[k] ?? '', code, where) }))
  cur.tiers[idm[2]] = effects
  cur.mTech = Number(c[4])
}

/* ---------------- 断言 ---------------- */
must(techs.length === 16, `模板数应为 16，实得 ${techs.length}`)
let tierRows = 0   // tier 数据条数（16 模板 × 3 品阶 = 48）
let effectCount = 0 // 特效条目总数（一门功法的一个品阶可有 1–3 个特效）
for (const t of techs) {
  const keys = Object.keys(t.tiers)
  must(keys.length === 3, `${t.id}: tier 数应为 3，实得 ${keys.length}（${keys.join(',')}）`)
  for (const k of TIERS) must(Array.isArray(t.tiers[k]), `${t.id}: 缺 tier ${k}`)
  must(t.dex && t.image && t.acquire, `${t.id}: 典出/形象/获取倾向 有空缺`)
  must(M_TECH_TABLE.includes(t.mTech), `${t.id}: mTech ${t.mTech} 不在查表 7 值内`)
  must(UNLOCK_BY_GRADE[t.grade] !== undefined, `${t.id}: 品级 ${t.grade} 无法映射 unlockRealm`)
  const ref = t.tiers.L.map((e) => e.code)
  for (const k of TIERS) {
    const codes = t.tiers[k].map((e) => e.code)
    must(codes.join('+') === ref.join('+'), `${t.id}/${k}: 特效编号与下品不一致（${codes.join('+')} vs ${ref.join('+')}）`)
    tierRows += 1
    effectCount += t.tiers[k].length
  }
  must(ref.join('+') === t.headEffects.join('+'), `${t.id}: 标题特效「${t.headEffects.join(' + ')}」与表内「${ref.join(' + ')}」不一致`)
}
must(new Set(techs.map((t) => t.id)).size === techs.length, 'tech id 有重复')
must(tierRows === 48, `tier 数据应为 48 条（16 模板 × 3 品阶），实得 ${tierRows}`)
if (problems.length) {
  console.error('❌ 解析/一致性断言失败：\n  - ' + problems.join('\n  - '))
  process.exit(1)
}

/* ---------------- 生成 ---------------- */
const eff = (e) => `{ code: ${JSON.stringify(e.code)}, value: ${e.value} }`
const body = techs.map((t) => {
  const tiers = TIERS.map((k) => `      ${k}: [${t.tiers[k].map(eff).join(', ')}],`).join('\n')
  return `  { id: ${JSON.stringify(t.id)}, name: ${JSON.stringify(t.name)}, grade: ${t.grade}, tendency: ${JSON.stringify(t.tendency)}, effects: [${t.tiers.L.map((e) => JSON.stringify(e.code)).join(', ')}],\n` +
    `    dex: ${JSON.stringify(t.dex)}, image: ${JSON.stringify(t.image)},\n` +
    `    acquire: ${JSON.stringify(t.acquire)}, mTech: ${t.mTech}, unlockRealm: ${UNLOCK_BY_GRADE[t.grade]},\n` +
    `    tiers: {\n${tiers}\n    } },`
}).join('\n')

const out = `// @generated 自动生成，请勿手改。来源：插件/基础/功法丹药图鉴.md §二
// 生成器：scripts/gen-techniques.mjs　（共 ${techs.length} 门模板 / ${tierRows} 条 tier 数据 / ${effectCount} 个特效条目）
import type { TechniqueDef } from '../types'

export const TECHNIQUES: TechniqueDef[] = [
${body}
]
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out, 'utf8')

/* ---------------- 自检：回头数一遍生成物 ---------------- */
const emitted = fs.readFileSync(OUT, 'utf8')
const idCount = (emitted.match(/\bid: "/g) || []).length
const effectEntries = (emitted.match(/\{ code: "/g) || []).length
const tierLines = (emitted.match(/^ {6}[LMU]: \[/gm) || []).length
must(idCount === 16, `生成物里 id: 出现 ${idCount} 次，应为 16`)
must(tierLines === 48, `生成物里 tier 行 ${tierLines} 行，应为 48`)
must(effectEntries === effectCount, `生成物里 code 条目 ${effectEntries} 个，应为 ${effectCount}`)
if (problems.length) { console.error('❌ 生成物自检失败：\n  - ' + problems.join('\n  - ')); process.exit(1) }

/* ---------------- 统计 ---------------- */
const byGrade = {}
for (const t of techs) byGrade[`${t.grade}${GRADE_NAMES[t.grade - 1]}`] = (byGrade[`${t.grade}${GRADE_NAMES[t.grade - 1]}`] || 0) + 1
console.log('✅ techniques.ts')
console.log(`   模板 ${techs.length} 门 / tier 数据 ${tierRows} 条 / 特效条目 ${effectCount} 个`)
console.log(`   生成物内 id: ${idCount} 处、tier 行 ${tierLines} 行、code 条目 ${effectEntries} 个`)
console.log('   每品级模板数：' + Object.entries(byGrade).map(([k, v]) => `${k}=${v}`).join(' '))
console.log(`   id 首尾：${techs[0].id} … ${techs[techs.length - 1].id}`)
console.log('   解析失败行：无')
