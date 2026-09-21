/**
 * gen-story-data.mjs —— 从《任务故事库.md》生成 4 份 TS 数据文件
 *
 *   §九       → src/data/missions.ts   MissionDef[]
 *   §十一     → src/data/events.ts     EventDef[]
 *   §11.12    → src/data/badlots.ts   BadLotDef[]
 *   §十       → src/data/quiz.ts       QuizDef[]
 *
 * 用法：node scripts/gen-story-data.mjs
 * 契约：external/koishi-plugin-xianxia-idle/src/types.ts（**不要手改生成物**）
 *
 * 设计约束
 *  - 数值一律不解析（req/耗时/奖励系数由插件按公式现算），这里只搬"玩家看到的字"
 *  - 所有字符串用 JSON.stringify 转义（正文含中文引号、反引号、全角空格）
 *  - 先断言、后落盘：任何硬断言失败就 exit(1)，不写文件
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC_MD = path.join(ROOT, '插件', '基础', '任务故事库.md')
const OUT_DIR = path.join(ROOT, 'external', 'koishi-plugin-xianxia-idle', 'src', 'data')

const GRADE = { 凡: 1, 黄: 2, 玄: 3, 地: 4, 天: 5, 仙: 6, 帝: 7 }
const PURPOSES = ['combat', 'farm', 'train', 'compound']
const q = (s) => JSON.stringify(s) // 唯一允许的字符串转义方式

const lines = fs.readFileSync(SRC_MD, 'utf8').split(/\r?\n/)
const at = (prefix) => {
  const i = lines.findIndex((l) => l.startsWith(prefix))
  if (i < 0) throw new Error(`找不到章节锚点：${prefix}`)
  return i
}
const I9 = at('## 九、日常历练任务')
const I10 = at('## 十、每日问答题库')
const I11 = at('## 十一、随机奇遇事件池')
const I12 = at('## 十二、')

/* ══════════════════════════════ 一、missions ══════════════════════════════ */
const MISSIONS = []
for (let i = I9; i < I10; i++) {
  const ln = lines[i]
  const h = /^#### (m(\d)-(\d)-(combat|farm|train|compound)-(\d{2})) ｜ (.+?)　`([凡黄玄地天仙帝])`/.exec(ln)
  if (!h) continue
  const [, id, realm, , purpose, , name, gradeName] = h
  const story = {}
  for (let k = i + 1; k < I10; k++) {
    const t = lines[k]
    if (t.startsWith('#### ') || t.startsWith('### ') || t.startsWith('## ')) break
    const b = /^- \*\*(intro|success|fail)\*\*：(.*)$/.exec(t)
    if (b) story[b[1]] = b[2]
  }
  MISSIONS.push({
    id, name, realm: +realm, grade: GRADE[gradeName], purpose, story,
    placeholder: ln.includes('【占位】'),
  })
}

/* ══════════════════════════════ 二、events ══════════════════════════════ */
/** 括号感知切分：`，` 出现在 `（…）` 内时不能切（例：灵材 ×3（你不知道为什么要留，但你就是留了）） */
function splitClauses (text) {
  const out = []
  let buf = '', depth = 0
  for (const ch of text) {
    if (ch === '（' || ch === '(') depth++
    else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && (ch === '，' || ch === ',' || ch === '；' || ch === ';')) {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out.flatMap((c) => c.split(/\s\+\s/).map((s) => s.trim()).filter(Boolean))
}
/** `（N 小时）` → 分钟；无则 60（本题库里全部是 1 小时，与规格表的 minutes:60 等价） */
function minutesOf (text) {
  const m = /(\d+(?:\.\d+)?)\s*小时/.exec(text)
  if (m) return Math.round(+m[1] * 60)
  if (/半\s*小时/.test(text)) return 30
  return 60
}
const P = '(?:\\s*（[^）]*）)?' // 可选的行尾修饰括号，整体吃掉以免误报"未消费子句"
const RULES = [
  { t: 'material', re: new RegExp(`(?:获得)?灵材\\s*(?:×\\s*)?(\\d+)(?:\\s*[–—\\-]\\s*(\\d+))?${P}`), make: (m) => ({ t: 'material', n: +m[1] }) },
  { t: 'frag', re: new RegExp(`(?:获得)?故事碎片\\s*(?:×\\s*)?(\\d+)(?:\\s*[–—\\-]\\s*(\\d+))?${P}`), make: (m) => ({ t: 'frag', n: +m[1] }) },
  { t: 'pill', re: new RegExp(`(?:获得)?(?:随机)?丹药\\s*(?:×\\s*)?(\\d+)(?:\\s*[–—\\-]\\s*(\\d+))?${P}`), make: (m) => ({ t: 'pill', n: +m[1] }) },
  // 具名丹药（渡厄丹 ×1、金刚丹 ×1…）：EventEffect 没有具名字段，按随机同境界丹药发放
  { t: 'pill-named', re: new RegExp(`(?:获得)?\\S{1,4}丹\\s*(?:×\\s*)?(\\d+)${P}`), make: (m) => ({ t: 'pill', n: +m[1] }) },
  // 功法残页：按品级给一门随机功法
  { t: 'tech', re: new RegExp(`(凡|黄|玄|地|天|仙|帝)品功法残页\\s*(?:×\\s*)?(\\d+)?${P}`), make: (m) => ({ t: 'tech', grade: '凡黄玄地天仙帝'.indexOf(m[1]) + 1 }) },
  { t: 'exp', re: new RegExp(`修为\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*%(?:\\s*[–—\\-]\\s*(\\d+(?:\\.\\d+)?)\\s*%)?\\s*×\\s*EP\\s*\\(\\s*rank\\s*\\)${P}`), make: (m) => ({ t: 'exp', pct: +m[1] / 100 }) },
  { t: 'buff-', re: new RegExp(`(?:但)?修为增速\\s*[−\\-–—]\\s*(\\d+(?:\\.\\d+)?)\\s*%${P}`), make: (m, full) => ({ t: 'buff', mul: 1 - +m[1] / 100, minutes: minutesOf(full) }) },
  { t: 'buff*', re: new RegExp(`(?:但)?修为增速\\s*×\\s*(\\d+(?:\\.\\d+)?)${P}`), make: (m, full) => ({ t: 'buff', mul: +m[1], minutes: minutesOf(full) }) },
]
/** 一条子句里可能叠多个收益：反复取首个命中，直到没有规则再命中 */
function effectsOfClause (clause) {
  const effs = []
  let rest = clause
  for (;;) {
    let hit = null
    for (const r of RULES) {
      const m = r.re.exec(rest)
      if (m) { hit = { r, m }; break }
    }
    if (!hit) break
    effs.push(hit.r.make(hit.m, clause))
    const next = rest.slice(0, hit.m.index) + rest.slice(hit.m.index + hit.m[0].length)
    if (next === rest) break
    rest = next
  }
  return { effs, leftover: rest.replace(/\s+/g, ' ').trim() }
}
const EVENTS = []
const unmatchedOptions = [] // effects 为空的 option —— 会让奇遇"点不动"
const leftoverOnly = [] // 已解析出效果、但有修饰性子句没被消费（多半无害）
for (let i = I11; i < I12; i++) {
  const eh = /^\*\*(E(\d)-\d{3}) ｜ (.+?)\*\*$/.exec(lines[i])
  if (eh) { EVENTS.push({ id: eh[1], realm: +eh[2], title: eh[3], body: '', options: [] }); continue }
  const cur = EVENTS[EVENTS.length - 1]
  if (!cur) continue
  const oh = /^- \*\*(.+?)\*\*：(.*?)　*→ (即时资源|稳定进度)\s*$/.exec(lines[i])
  if (oh) {
    const [, label, text, arrow] = oh
    const effects = [], leftovers = []
    for (const c of splitClauses(text)) {
      const { effs, leftover } = effectsOfClause(c)
      effects.push(...effs)
      if (leftover) leftovers.push(leftover)
    }
    const option = { label, text, kind: arrow === '即时资源' ? 'res' : 'exp', effects }
    cur.options.push(option)
    if (!effects.length) unmatchedOptions.push({ id: cur.id, title: cur.title, label, text, leftovers })
    else if (leftovers.length) leftoverOnly.push({ id: cur.id, text, leftovers })
    continue
  }
  if (lines[i].trim() && !cur.options.length) cur.body = cur.body ? `${cur.body}\n${lines[i]}` : lines[i]
}

/* ══════════════════════════════ 三、badlots ══════════════════════════════ */
const BADLOTS = []
for (let i = I11; i < I12; i++) {
  const h = /^\*\*(X(\d)-\d{2}) ｜ (.+?)\*\*$/.exec(lines[i])
  if (!h) continue
  const fragment = (lines[i + 1] || '').trim()
  BADLOTS.push({ id: h[1], realm: +h[2], sign: h[3], fragment })
}

/* ══════════════════════════════ 四、quiz ══════════════════════════════ */
const QUIZ = []
const seqOfBand = {}
let band = 0, cur = null
const flush = () => { if (cur) { QUIZ.push(cur); cur = null } }
for (let i = I10; i < I11; i++) {
  const ln = lines[i]
  const bh = /^### 10\.\d+ Q(\d)/.exec(ln)
  if (bh) { flush(); band = +bh[1]; continue }
  if (!band) continue
  const qh = /^\*\*(\d+)\.\*\*\s*(.+)$/.exec(ln)
  if (qh) {
    flush()
    seqOfBand[band] = (seqOfBand[band] || 0) + 1
    cur = {
      id: `Q${band}-${String(seqOfBand[band]).padStart(2, '0')}`,
      band, q: qh[2].trim(), options: [], answer: -1, explain: '', source: '',
      _marks: 0, _no: +qh[1],
    }
    continue
  }
  if (!cur) continue
  const oh = /^- ([ABC])\.\s*(.*)$/.exec(ln)
  if (oh) {
    let text = oh[2]
    if (text.includes('✅')) { cur._marks++; cur.answer = cur.options.length } // 在删标记之前统计
    text = text.replace(/✅/g, '').replace(/[\s　]+$/, '').trim()
    cur.options.push(text)
    continue
  }
  const fh = /^>\s*(.*)$/.exec(ln)
  if (fh && !cur.explain) {
    let rest = fh[1].trim()
    const sm = /^(.*?)　*`([^`]+)`\s*$/.exec(rest) // 末尾的 `出处`
    if (sm) { cur.explain = sm[1].trim(); cur.source = sm[2].trim() }
    else { cur.explain = rest; cur.source = '' }
  }
}
flush()

/* ══════════════════════════════ 断言 ══════════════════════════════ */
const fails = []
const check = (ok, msg) => { if (!ok) fails.push(msg) }
const uniq = (arr) => new Set(arr).size === arr.length

check(MISSIONS.length === 192, `missions 条数 = ${MISSIONS.length}，应为 192`)
check(uniq(MISSIONS.map((m) => m.id)), 'missions id 有重复')
check(uniq(MISSIONS.map((m) => m.name)), 'missions 名称有重复')
check(MISSIONS.every((m) => m.story.intro && m.story.success && m.story.fail), 'missions 有缺失文本块')
check(MISSIONS.filter((m) => m.placeholder).length === 174, `missions 占位数 = ${MISSIONS.filter((m) => m.placeholder).length}，应为 174`)
check(MISSIONS.every((m) => m.realm >= 1 && m.realm <= 9 && m.grade >= 1 && m.grade <= 7 && PURPOSES.includes(m.purpose)), 'missions realm/grade/purpose 越界')

check(EVENTS.length === 108, `events 条数 = ${EVENTS.length}，应为 108`)
check(uniq(EVENTS.map((e) => e.id)), 'events id 有重复')
check(EVENTS.every((e) => e.options.length === 2), 'events 有非 2 选项的条目')
check(EVENTS.every((e) => e.options.filter((o) => o.kind === 'res').length === 1 && e.options.filter((o) => o.kind === 'exp').length === 1), 'events 有不是「1 res + 1 exp」的条目')
check(EVENTS.every((e) => e.body), 'events 有缺正文的条目')

check(BADLOTS.length === 54, `badlots 条数 = ${BADLOTS.length}，应为 54`)
check(uniq(BADLOTS.map((b) => b.id)), 'badlots id 有重复')
check([1, 2, 3, 4, 5, 6, 7, 8, 9].every((r) => BADLOTS.filter((b) => b.realm === r).length === 6), 'badlots 不是每境界 6 条')
check(BADLOTS.every((b) => b.sign && b.fragment), 'badlots 有空 sign/fragment')

check(QUIZ.length === 60, `quiz 题数 = ${QUIZ.length}，应为 60`)
check(uniq(QUIZ.map((x) => x.id)), 'quiz id 有重复')
check(QUIZ.every((x) => x.options.length === 3), 'quiz 有非 3 选项的题')
check(QUIZ.every((x) => x._marks === 1 && x.answer >= 0 && x.answer <= 2), 'quiz 有非「恰好 1 个 ✅」的题')
check(QUIZ.every((x) => x.q && x.explain && x.source), 'quiz 有空 q/explain/source')

/* ══════════════════════════════ 落盘 ══════════════════════════════ */
const BANNER = (sec) =>
  `/* eslint-disable */\n` +
  `// ⚠️ 自动生成，请勿手改。\n` +
  `// 源：插件/基础/任务故事库.md ${sec}\n` +
  `// 生成：scripts/gen-story-data.mjs　契约：src/types.ts\n\n`

const missionsTs = [BANNER('§九 日常历练任务（192 条：18 条定稿 + 174 条占位）'),
  `import type { MissionDef } from '../types'\n`,
  `export const MISSIONS: MissionDef[] = [`]
for (const m of MISSIONS) {
  missionsTs.push('  {')
  missionsTs.push(`    id: ${q(m.id)},`)
  missionsTs.push(`    name: ${q(m.name)},`)
  missionsTs.push(`    realm: ${m.realm},`)
  missionsTs.push(`    grade: ${m.grade},`)
  missionsTs.push(`    purpose: ${q(m.purpose)},`)
  missionsTs.push('    story: {')
  missionsTs.push(`      intro: ${q(m.story.intro)},`)
  missionsTs.push(`      success: ${q(m.story.success)},`)
  missionsTs.push(`      fail: ${q(m.story.fail)},`)
  missionsTs.push('    },')
  if (m.placeholder) missionsTs.push('    placeholder: true,')
  missionsTs.push('  },')
}
missionsTs.push(']', '')

const serEffects = (effs) => `[${effs.map((e) => {
  const parts = Object.entries(e).map(([k, v]) => `${k}: ${typeof v === 'string' ? q(v) : v}`)
  return `{ ${parts.join(', ')} }`
}).join(', ')}]`
const eventsTs = [BANNER('§十一 随机奇遇事件池（108 条：练气 12 条定稿 + 96 条占位）'),
  `import type { EventDef } from '../types'\n`,
  `export const EVENTS: EventDef[] = [`]
for (const e of EVENTS) {
  eventsTs.push('  {')
  eventsTs.push(`    id: ${q(e.id)},`)
  eventsTs.push(`    realm: ${e.realm},`)
  eventsTs.push(`    title: ${q(e.title)},`)
  eventsTs.push(`    body: ${q(e.body)},`)
  eventsTs.push('    options: [')
  for (const o of e.options) {
    eventsTs.push(`      { label: ${q(o.label)}, text: ${q(o.text)}, kind: ${q(o.kind)}, effects: ${serEffects(o.effects)} },`)
  }
  eventsTs.push('    ],')
  eventsTs.push('  },')
}
eventsTs.push(']', '')

const badlotsTs = [BANNER('§11.12 凶签与故事碎片（54 条，占位）'),
  `import type { BadLotDef } from '../types'\n`,
  `export const BADLOTS: BadLotDef[] = [`]
for (const b of BADLOTS) {
  badlotsTs.push(`  { id: ${q(b.id)}, realm: ${b.realm}, sign: ${q(b.sign)}, fragment: ${q(b.fragment)} },`)
}
badlotsTs.push(']', '')

const quizTs = [BANNER('§十 每日问答题库（60 题：Q1 18 / Q2 9 / Q3 9 / Q4 9 / Q5 15）'),
  `import type { QuizDef } from '../types'\n`,
  `export const QUIZ: QuizDef[] = [`]
for (const x of QUIZ) {
  quizTs.push('  {')
  quizTs.push(`    id: ${q(x.id)},`)
  quizTs.push(`    band: ${x.band},`)
  quizTs.push(`    q: ${q(x.q)},`)
  quizTs.push(`    options: [${x.options.map(q).join(', ')}],`)
  quizTs.push(`    answer: ${x.answer},`)
  quizTs.push(`    explain: ${q(x.explain)},`)
  quizTs.push(`    source: ${q(x.source)},`)
  quizTs.push('  },')
}
quizTs.push(']', '')

/* ══════════════════════════════ 报告 ══════════════════════════════ */
const pad = (s, n) => String(s).padEnd(n)
console.log('=== 条数断言 ===')
console.log(`missions  ${pad(MISSIONS.length, 4)} (占位 ${MISSIONS.filter((m) => m.placeholder).length})   期望 192 / 174`)
console.log(`events    ${pad(EVENTS.length, 4)}                     期望 108`)
console.log(`badlots  ${pad(BADLOTS.length, 4)}                     期望 54`)
console.log(`quiz      ${pad(QUIZ.length, 4)}                     期望 60（按 band：${[1, 2, 3, 4, 5].map((b) => `Q${b}:${QUIZ.filter((x) => x.band === b).length}`).join(' ')}）`)

console.log('\n=== events 未识别清单 ===')
console.log(`A. effects 为空（会让奇遇「点不动」）：${unmatchedOptions.length} 条 option`)
const byText = new Map()
for (const u of unmatchedOptions) byText.set(u.text, (byText.get(u.text) || 0) + 1)
for (const [text, n] of byText) console.log(`   ×${n}  ${text}`)
console.log(`   涉及 option 文本 ${byText.size} 种 / ${unmatchedOptions.length} 处；id 示例：${[...new Set(unmatchedOptions.map((u) => u.id))].slice(0, 8).join(', ')}`)
console.log(`B. 已解析出效果、但有修饰性子句未消费：${leftoverOnly.length} 处（多半无害）`)
const byLeft = new Map()
for (const u of leftoverOnly) for (const l of u.leftovers) byLeft.set(l, (byLeft.get(l) || 0) + 1)
for (const [l, n] of byLeft) console.log(`   ×${n}  「${l}」`)

if (fails.length) {
  console.log('\n❌ 断言失败，未写文件：')
  for (const f of fails) console.log('   - ' + f)
  process.exit(1)
}
fs.mkdirSync(OUT_DIR, { recursive: true })
const outputs = [
  ['missions.ts', missionsTs.join('\n')],
  ['events.ts', eventsTs.join('\n')],
  ['badlots.ts', badlotsTs.join('\n')],
  ['quiz.ts', quizTs.join('\n')],
]
console.log('\n=== 落盘 ===')
for (const [name, content] of outputs) {
  const p = path.join(OUT_DIR, name)
  fs.writeFileSync(p, content, 'utf8')
  console.log(`✅ ${p}  ${content.split('\n').length} 行 / ${Buffer.byteLength(content, 'utf8')} 字节`)
}
