// 临时校验脚本（不属于交付物）
const fs = require('fs')
const p = 'E:/koshi/插件/基础/_frag/b3.md'
const text = fs.readFileSync(p, 'utf8')
const lines = text.split(/\r?\n/)

const errors = []
const h3 = []
const tasks = []

let cur = null
lines.forEach((line, i) => {
  const ln = i + 1
  if (/^### /.test(line)) {
    const m = /^###\s*(合道期|渡劫期)（rank \d+–\d+，\s*(\d+)\s*条）\s*$/.exec(line)
    if (!m) errors.push(`L${ln} 三级标题格式不符: ${line}`)
    else h3.push({ name: m[1], count: +m[2], line: ln })
    return
  }
  const m = /^#### (m\d-\d-(combat|farm|train|compound)-(\d{2})) ｜ (\S+?)[ \u3000]*`(地|天|仙|帝)` `(combat|farm|train|compound)` `req ([\d.]+)`[ \u3000]*【占位】$/.exec(line)
  if (m) {
    if (cur) tasks.push(cur)
    cur = { id: m[1], realm: +m[1][1], tier: m[5], req: m[7], purpose: m[6], name: m[4], line: ln, fields: [], body: [] }
    return
  }
  if (/^#### /.test(line)) {
    errors.push(`L${ln} 四级标题格式不符: ${line}`)
    return
  }
  if (!cur) return
  if (line.trim()) cur.body.push(line)
})
if (cur) tasks.push(cur)

// 每个块必须正好三行，顺序固定，且以 - **intro** 起始
const FIELD_ORDER = ['intro', 'success', 'fail']
for (const t of tasks) {
  if (t.body.length !== 3) {
    errors.push(`L${t.line} ${t.id} 标题下正文行数 = ${t.body.length}（应为 3）`)
    continue
  }
  FIELD_ORDER.forEach((f, idx) => {
    const m = new RegExp(`^- \\*\\*${f}\\*\\*：(.+)$`).exec(t.body[idx])
    if (!m) {
      errors.push(`L${t.line} ${t.id} 第 ${idx + 1} 行不是 ${f}：${t.body[idx].slice(0, 30)}`)
      return
    }
    t.fields[idx] = m[1]
  })
}

// 字数：三行合计 50–90（中文字符 + 全角标点，按“字”计＝去掉空白后的字符数）
const REQ = { 地: '1.471', 天: '1.680', 仙: '1.892', 帝: '2.121' }
const TIER_IDX = { 地: 4, 天: 5, 仙: 6, 帝: 7 }

for (const t of tasks) {
  if (t.fields.length < 3) continue
  // 字数口径：只数汉字（不含标点、空格、拉丁字母），这是对 50–90 要求最保守的读法
  const total = t.fields.join('').replace(/[^\u4e00-\u9fff]/g, '').length
  const withPunct = t.fields.join('').replace(/\s/g, '').length
  t.chars = total
  t.charsWithPunct = withPunct
  if (total < 50 || total > 90) errors.push(`L${t.line} ${t.id} 三行合计 ${total} 汉字（要求 50–90）`)
  if (withPunct > 110) errors.push(`L${t.line} ${t.id} 含标点 ${withPunct} 字，偏长`)
  if (REQ[t.tier] !== t.req) errors.push(`L${t.line} ${t.id} req_coef ${t.req} 与档位 ${t.tier} 不符（应 ${REQ[t.tier]}）`)
  if (TIER_IDX[t.tier] !== +t.id.split('-')[1]) errors.push(`L${t.line} ${t.id} 品级序号与档位 ${t.tier} 不符`)
  if (t.id.split('-')[2] !== t.purpose) errors.push(`L${t.line} ${t.id} 目的与标记 ${t.purpose} 不符`)
}

// 分节归属与条数
const realmOf = { 5: '合道期', 6: '渡劫期' }
for (const h of h3) {
  const inSection = tasks.filter((t) => t.line > h.line && t.line < (h3[h3.indexOf(h) + 1]?.line ?? Infinity))
  if (inSection.length !== h.count) errors.push(`${h.name} 条数 = ${inSection.length}（应为 ${h.count}）`)
  for (const t of inSection) {
    if (realmOf[t.realm] !== h.name) errors.push(`L${t.line} ${t.id} 落在 ${h.name} 分节内`)
  }
}

// 序号：同一 (境界,档位,目的) 从 01 连续
const groups = {}
for (const t of tasks) {
  const key = `${t.realm}-${t.tier}-${t.purpose}`
  ;(groups[key] ||= []).push(t)
}
for (const [key, list] of Object.entries(groups)) {
  list.sort((a, b) => a.line - b.line)
  list.forEach((t, idx) => {
    const seq = t.id.split('-')[3]
    if (seq !== String(idx + 1).padStart(2, '0')) errors.push(`L${t.line} ${t.id} 序号应为 ${String(idx + 1).padStart(2, '0')}`)
  })
}

// 档位分配表
function tally(list, keyFn) {
  const out = {}
  for (const t of list) out[keyFn(t)] = (out[keyFn(t)] || 0) + 1
  return out
}

const EXPECT = {
  合道期: { tier: { 地: 5, 天: 6, 仙: 4, 帝: 6 }, purpose: { farm: 5, combat: 6, train: 4, compound: 6 } },
  渡劫期: { tier: { 地: 4, 天: 4, 仙: 6, 帝: 7 }, purpose: { farm: 5, combat: 6, train: 4, compound: 6 } },
}

console.log('=== 分节 ===')
for (const h of h3) {
  const list = tasks.filter((t) => realmOf[t.realm] === h.name)
  const tier = tally(list, (t) => t.tier)
  const purpose = tally(list, (t) => t.purpose)
  console.log(`${h.name}：共 ${list.length} 条`)
  console.log(`  档位 ${JSON.stringify(tier)}  期望 ${JSON.stringify(EXPECT[h.name].tier)}`)
  console.log(`  目的 ${JSON.stringify(purpose)}  期望 ${JSON.stringify(EXPECT[h.name].purpose)}`)
  const bad =
    JSON.stringify(tier) !== JSON.stringify(EXPECT[h.name].tier) ||
    JSON.stringify(purpose) !== JSON.stringify(EXPECT[h.name].purpose)
  if (bad) errors.push(`${h.name} 分配不符`)
}

console.log('\n=== 名称唯一性 ===')
const EXISTING = '后山采药,驱赶野猪,清扫藏经阁,挑水三十担,修补篱笆,守夜,抄录残卷,涧边取水,追踪野狼,药田除虫,押送药箱,后山巡查,抄录旧档,押送份例,涧底清淤,驱赶灵猿,校对册页,界碑重立'.split(',')
const names = tasks.map((t) => t.name)
const dup = names.filter((n, i) => names.indexOf(n) !== i)
const clash = names.filter((n) => EXISTING.includes(n))
if (dup.length) errors.push(`内部重名：${[...new Set(dup)].join('、')}`)
if (clash.length) errors.push(`与已定稿 18 条重名：${clash.join('、')}`)
console.log(`内部重名 ${dup.length ? [...new Set(dup)].join('、') : '无'}；与已定稿冲突 ${clash.length ? clash.join('、') : '无'}`)

console.log('\n=== 字数分布（汉字口径 / 含标点口径）===')
const cs = tasks.map((t) => t.chars).filter(Boolean).sort((a, b) => a - b)
const cp = tasks.map((t) => t.charsWithPunct).filter(Boolean).sort((a, b) => a - b)
if (cs.length) {
  console.log(`汉字： n=${cs.length} min=${cs[0]} max=${cs[cs.length - 1]} 中位=${cs[Math.floor(cs.length / 2)]}`)
  console.log(`含标点：min=${cp[0]} max=${cp[cp.length - 1]} 中位=${cp[Math.floor(cp.length / 2)]}`)
}
const out = tasks.filter((t) => t.chars && (t.chars < 50 || t.chars > 90))
if (out.length) console.log('越界：' + out.map((t) => `${t.id}(${t.chars})`).join(' '))

console.log('\n=== 结论 ===')
console.log(`任务总数 ${tasks.length}（应为 42）`)
if (tasks.length !== 42) errors.push(`任务总数 ${tasks.length}`)
if (errors.length) {
  console.log(`❌ ${errors.length} 项问题：`)
  errors.forEach((e) => console.log('  · ' + e))
  process.exit(1)
} else {
  console.log('✅ 全部结构、条数、档位、目的、字数、重名校验通过')
}
