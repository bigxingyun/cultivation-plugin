#!/usr/bin/env node
// 生成器：从《功法丹药图鉴.md》§五 解析出 external/koishi-plugin-xianxia-idle/src/data/pills.ts
// 用法：node scripts/gen-pills.mjs
// 只读源文档、只写一个生成物。不要手改生成物。
// 注意：「效果」列**不解析**（数值由插件按公式现算），「品级×类别覆盖检查」表也不解析。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, '插件', '基础', '功法丹药图鉴.md')
const OUT = path.join(ROOT, 'external', 'koishi-plugin-xianxia-idle', 'src', 'data', 'pills.ts')

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7 }
const CLASS_BY_NAME = { 修为: 'A', 淬体: 'B', 突破: 'C', 悟道: 'D', 护道: 'E' }
const CLASSES = ['A', 'B', 'C', 'D', 'E']

const problems = []
const must = (cond, msg) => { if (!cond) problems.push(msg) }
const cells = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim())
const strip = (s) => s.replace(/\*\*/g, '').trim()

/* ---------------- 解析 ---------------- */
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)
const PILL_HEAD = /^### (一|二|三|四|五|六|七)品 ｜ /
const pills = []
let grade = 0

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (line.startsWith('#')) {
    const h = PILL_HEAD.exec(line)
    grade = h ? CN_NUM[h[1]] : 0 // 离开 §五 的品级小节（如 ### 5.1 覆盖检查）就停
    continue
  }
  if (!grade || !line.startsWith('|')) continue
  const c = cells(line)
  const idm = /^`P(\d)-([A-E])`$/.exec(c[0] || '')
  if (!idm) continue // 表头 / 分隔行 / 覆盖检查表
  const where = `${idm[0].replace(/`/g, '')}（源文档第 ${i + 1} 行）`
  const g = Number(idm[1])
  const cls = idm[2]
  must(g === grade, `${where}: id 品级 ${g} 与小节「${grade}品」不一致`)
  must(c.length >= 5, `${where}: 列数不足（${c.length}）`)
  const name = strip(c[1])
  const clsByName = CLASS_BY_NAME[c[2].trim()]
  must(clsByName === cls, `${where}: id 末字母 ${cls} 与「类别」列「${c[2]}」(${clsByName}) 不一致`)
  must(name.length > 0, `${where}: 丹药名为空`)
  pills.push({ id: `P${g}-${cls}`, name, grade: g, cls, lore: strip(c[4] || '') })
}

/* ---------------- 断言 ---------------- */
must(pills.length === 35, `丹药条数应为 35，实得 ${pills.length}`)
must(new Set(pills.map((p) => p.id)).size === pills.length, 'pill id 有重复')
for (let g = 1; g <= 7; g++) {
  const inGrade = pills.filter((p) => p.grade === g)
  must(inGrade.length === 5, `${g} 品应有 5 条，实得 ${inGrade.length}`)
  for (const cls of CLASSES) must(inGrade.some((p) => p.cls === cls), `缺口：${g} 品缺 ${cls} 类`)
  for (const p of inGrade) must(p.lore.length > 0, `${p.id}: 典出为空`)
}
if (problems.length) {
  console.error('❌ 解析/一致性断言失败：\n  - ' + problems.join('\n  - '))
  process.exit(1)
}

/* ---------------- 生成 ---------------- */
const body = pills
  .map((p) => `  { id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, grade: ${p.grade}, cls: ${JSON.stringify(p.cls)}, lore: ${JSON.stringify(p.lore)} },`)
  .join('\n')

const out = `// @generated 自动生成，请勿手改。来源：插件/基础/功法丹药图鉴.md §五
// 生成器：scripts/gen-pills.mjs　（共 ${pills.length} 条 = 7 品级 × 5 类别）
// 「效果」列不入库：数值由插件按公式现算（设定文档 §10.1 / §10.2）
import type { PillDef } from '../types'

export const PILLS: PillDef[] = [
${body}
]
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out, 'utf8')

/* ---------------- 自检：回头数一遍生成物 ---------------- */
const emitted = fs.readFileSync(OUT, 'utf8')
const idCount = (emitted.match(/\bid: "/g) || []).length
must(idCount === pills.length, `生成物里 id: 出现 ${idCount} 次，应为 ${pills.length}`)
if (problems.length) { console.error('❌ 生成物自检失败：\n  - ' + problems.join('\n  - ')); process.exit(1) }

/* ---------------- 统计 ---------------- */
const byGrade = {}
for (const p of pills) byGrade[p.grade] = (byGrade[p.grade] || 0) + 1
console.log('✅ pills.ts')
console.log(`   ${pills.length} 条 / 生成物内 id: ${idCount} 处`)
console.log('   每品级条数：' + Object.entries(byGrade).map(([k, v]) => `${k}品=${v}`).join(' '))
console.log(`   id 首尾：${pills[0].id} … ${pills[pills.length - 1].id}`)
console.log('   解析失败行：无')
