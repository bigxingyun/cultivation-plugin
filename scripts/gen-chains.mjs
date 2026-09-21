#!/usr/bin/env node
/**
 * 生成器：把《任务故事库.md》里已定稿的任务链解析成 TypeScript 数据。
 *
 *   源：插件/基础/任务故事库.md  §二 ~ §八（7 条链 / 42 个节点）
 *   产物：external/koishi-plugin-xianxia-idle/src/data/chains.ts
 *
 * 用法：node scripts/gen-chains.mjs
 * 契约：external/koishi-plugin-xianxia-idle/src/types.ts 的 ChainDef / ChainNodeDef
 *
 * 解析约定（与源文档的实际写法一一对应）：
 *   · 链标题  ## 二、练气期 · 链一 `shanmen_01` · 青云旧籍
 *   · 元信息  紧随标题的三行引用：`realm: N` / **主题**： / **人物**（n 人）：
 *   · 章节    ### 链首引子 / ### 节点 N ｜ 名称 / ### 链尾收束 / ### 链末伏笔
 *   · 节点内块 **`intro`** / **`progress`** / **`success`** / **`hook`**
 *   · 正文里的 `>` 行是叙事（告示、对话），不是元信息 —— 去掉 `>` 符号后保留
 *   · 段落 = 连续非空行的最大连续段；段内用 \n 连接，段间用 \n\n
 *   · `---` 分隔线与空行一律丢弃
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, '插件', '基础', '任务故事库.md')
const OUT = path.join(ROOT, 'external', 'koishi-plugin-xianxia-idle', 'src', 'data', 'chains.ts')

/**
 * locked 状态给玩家看的模糊描述（源文档里没有这个字段，必须手写）。
 * 硬要求：只给氛围与悬念，**不得剧透**——不能出现"第九层""药引是人""名字会被换掉"这类答案。
 * 撰写时只读了每条链的【链首引子】。
 */
const BLURBS = {
  shanmen_01: '一块从废井里捞出的玉简，和一个不许再数的数字。',
  yaoyuan_01: '哑巴看园人递来的陶罐里，只有两个字：别种。',
  linglu_01: '受伤的白鹿不逃也不走，像在等一个还没到的人。',
  mingce_01: '你的名字上面那一行被划掉了，而笔本来可以划两行。',
  qingfu_01: '一只没有货签的箱子，要送到一个没有人的渡口。',
  danfang_01: '丹房掌事只问了一句话：你的手稳不稳。',
  beiwang_01: '一块不属于任何宗门的界碑，和一句说得太快的解释。',
}

/* ------------------------------------------------------------------ 解析 */

/** 元信息行 / 叙事引用行都写作 `> xxx`；这里去掉引用符号并 trim */
const stripQuote = (ln) => ln.trim().replace(/^>\s?/, '').trim()

/**
 * 把一段行列表压成正文文本。
 * 段落 = 连续非空行的最大连续段（`---` 视为空行）；段内 `\n`，段间 `\n\n`。
 */
function toText (body) {
  const paras = []
  let cur = []
  const flush = () => {
    if (cur.length) paras.push(cur.join('\n'))
    cur = []
  }
  for (const raw of body) {
    const t = raw.trim()
    if (t === '' || t === '---') { flush(); continue }
    cur.push(stripQuote(t))
  }
  flush()
  return paras.join('\n\n')
}

/** 取某个 `### ` 小节的正文（到下一个 `### ` / `## ` 为止） */
function sectionBody (lines, startIdx) {
  const end = (() => {
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (/^###\s/.test(lines[i]) || /^##\s/.test(lines[i])) return i
    }
    return lines.length
  })()
  return lines.slice(startIdx + 1, end)
}

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)

// 链标题：`## … · 链N `id` · 名称`。§一/§九~§十三 等章节标题不含反引号 id，天然被排除
const chainHeads = []
lines.forEach((ln, i) => {
  if (!/^##\s/.test(ln)) return
  const idm = /`([A-Za-z0-9_]+)`/.exec(ln)
  if (!idm || !ln.includes('·')) return
  chainHeads.push({ i, id: idm[1], name: ln.slice(ln.lastIndexOf('·') + 1).trim() })
})
if (chainHeads.length !== 7) throw new Error(`链标题应恰好 7 个，实得 ${chainHeads.length}`)

const chains = chainHeads.map((head, k) => {
  const next = k + 1 < chainHeads.length
    ? chainHeads[k + 1].i
    : lines.findIndex((l, i) => i > head.i && /^##\s/.test(l))
  if (next < 0) throw new Error(`${head.id}: 找不到链结束位置`)
  const sec = lines.slice(head.i + 1, next)

  // ---- 元信息（第一个 ### 之前的三行引用）
  const firstH3 = sec.findIndex(l => /^###\s/.test(l))
  const metaRaw = (firstH3 < 0 ? sec : sec.slice(0, firstH3)).map(stripQuote).join('\n')
  const realm = Number(/realm:\s*(\d+)/.exec(metaRaw)?.[1])
  const rankMin = Number(/rankMin:\s*(\d+)/.exec(metaRaw)?.[1])
  const chainDone = /chainDone:\s*"([^"]+)"/.exec(metaRaw)?.[1]
  const itemReq = /itemReq:\s*"([^"]+)"/.exec(metaRaw)?.[1]
  const flagReq = /flagReq:\s*"([^"]+)"/.exec(metaRaw)?.[1]
  const themeLine = sec.find(l => /^>\s*\*\*主题\*\*：/.test(l))
  const castLine = sec.find(l => /^>\s*\*\*人物\*\*/.test(l))
  if (!themeLine || !castLine) throw new Error(`${head.id}: 缺 主题 或 人物`)
  const theme = stripQuote(themeLine).replace(/^\*\*主题\*\*：/, '').trim()
  const cast = stripQuote(castLine).replace(/^\*\*人物\*\*（[^）]*）：/, '').trim()

  // ---- 四个具名小节
  const pick = (re) => {
    const idx = sec.findIndex(l => re.test(l))
    if (idx < 0) throw new Error(`${head.id}: 找不到小节 ${re}`)
    return toText(sectionBody(sec, idx))
  }
  const prologue = pick(/^###\s*链首引子\s*$/)
  const epilogue = pick(/^###\s*链尾收束\s*$/)
  const hook = pick(/^###\s*链末伏笔\s*$/)

  // ---- 节点
  const nodes = []
  sec.forEach((ln, idx) => {
    const m = /^###\s*节点\s*(\d+)\s*｜\s*(.+?)\s*$/.exec(ln)
    if (!m) return
    const body = sectionBody(sec, idx)
    const blocks = { intro: [], progress: [], success: [], hook: [] }
    let which = null
    const lead = []
    for (const b of body) {
      const mk = /^\*\*`(intro|progress|success|hook)`\*\*\s*$/.exec(b.trim())
      if (mk) { which = mk[1]; continue }
      if (which) blocks[which].push(b)
      else if (b.trim() !== '' && b.trim() !== '---') lead.push(b.trim())
    }
    if (lead.length) throw new Error(`${head.id} 节点 ${m[1]}: 在第一个标记前发现了正文: ${lead[0].slice(0, 30)}`)
    nodes.push({
      seq: Number(m[1]),
      name: m[2].trim(),
      story: {
        intro: toText(blocks.intro),
        progress: toText(blocks.progress),
        success: toText(blocks.success),
        hook: toText(blocks.hook),
      },
    })
  })
  nodes.sort((a, b) => a.seq - b.seq)

  const unlock = { rankMin }
  if (chainDone) unlock.chainDone = chainDone
  if (itemReq) unlock.itemReq = itemReq
  if (flagReq) unlock.flagReq = flagReq

  return { id: head.id, name: head.name, realm, unlock, theme, cast, blurb: BLURBS[head.id], prologue, nodes, epilogue, hook }
})

/* --------------------------------------------------------------- 自检 */

const fail = []
const chars = (s) => [...s.replace(/\s/g, '')].length

if (chains.length !== 7) fail.push(`链数 ${chains.length} ≠ 7`)
const idSet = new Set(chains.map(c => c.id))
if (idSet.size !== chains.length) fail.push('chainId 有重复')
const totalNodes = chains.reduce((n, c) => n + c.nodes.length, 0)
if (totalNodes !== 42) fail.push(`节点总数 ${totalNodes} ≠ 42`)

const stats = []
for (const c of chains) {
  if (!(c.realm >= 1 && c.realm <= 9)) fail.push(`${c.id}: realm=${c.realm} 越界`)
  if (!Number.isInteger(c.unlock.rankMin)) fail.push(`${c.id}: rankMin 缺失`)
  if (c.nodes.length !== 6) fail.push(`${c.id}: 节点数 ${c.nodes.length} ≠ 6`)
  if (c.nodes.map(n => n.seq).join(',') !== '1,2,3,4,5,6') fail.push(`${c.id}: seq 不为 1..6`)
  if (!c.blurb) fail.push(`${c.id}: blurb 未填写`)
  else if (chars(c.blurb) < 12 || chars(c.blurb) > 24) fail.push(`${c.id}: blurb 长度 ${chars(c.blurb)} 不在 12–24`)
  for (const [k, v] of Object.entries({ prologue: c.prologue, epilogue: c.epilogue, hook: c.hook })) {
    if (!v || !v.trim()) fail.push(`${c.id}: ${k} 为空`)
  }
  for (const n of c.nodes) {
    for (const k of ['intro', 'progress', 'success', 'hook']) {
      if (!n.story[k] || !n.story[k].trim()) fail.push(`${c.id} 节点${n.seq}: ${k} 为空`)
    }
    if (!n.name.trim()) fail.push(`${c.id} 节点${n.seq}: 名称为空`)
  }
  const sum = chars(c.prologue) + chars(c.epilogue) + chars(c.hook) +
    c.nodes.reduce((n, x) => n + ['intro', 'progress', 'success', 'hook'].reduce((m, k) => m + chars(x.story[k]), 0), 0)
  stats.push({ id: c.id, name: c.name, realm: c.realm, nodes: c.nodes.length, rankMin: c.unlock.rankMin, chainDone: c.unlock.chainDone, chars: sum })
}
if (fail.length) throw new Error('自检失败：\n  - ' + fail.join('\n  - '))

/* --------------------------------------------------------------- 输出 */

const q = (s) => JSON.stringify(s)
const out = []
out.push('// 自动生成，请勿手改。来源：插件/基础/任务故事库.md §二~§八')
out.push("import type { ChainDef } from '../types'")
out.push('')
out.push('export const CHAINS: ChainDef[] = [')
for (const c of chains) {
  const u = [`rankMin: ${c.unlock.rankMin}`]
  if (c.unlock.chainDone) u.push(`chainDone: ${q(c.unlock.chainDone)}`)
  if (c.unlock.itemReq) u.push(`itemReq: ${q(c.unlock.itemReq)}`)
  if (c.unlock.flagReq) u.push(`flagReq: ${q(c.unlock.flagReq)}`)
  out.push('  {')
  out.push(`    id: ${q(c.id)},`)
  out.push(`    name: ${q(c.name)},`)
  out.push(`    realm: ${c.realm},`)
  out.push(`    unlock: { ${u.join(', ')} },`)
  out.push(`    theme: ${q(c.theme)},`)
  out.push(`    cast: ${q(c.cast)},`)
  out.push(`    blurb: ${q(c.blurb)},`)
  out.push(`    prologue: ${q(c.prologue)},`)
  out.push('    nodes: [')
  for (const n of c.nodes) {
    const s = n.story
    out.push(`      { seq: ${n.seq}, name: ${q(n.name)}, story: { intro: ${q(s.intro)}, progress: ${q(s.progress)}, success: ${q(s.success)}, hook: ${q(s.hook)} } },`)
  }
  out.push('    ],')
  out.push(`    epilogue: ${q(c.epilogue)},`)
  out.push(`    hook: ${q(c.hook)},`)
  out.push(`    finalChoice: ['破境丹', '悟道丹'],`)
  out.push('  },')
}
out.push(']')
out.push('')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out.join('\n'), 'utf8')

console.log(`源：${path.relative(ROOT, SRC)}`)
console.log(`产物：${path.relative(ROOT, OUT)}（${out.length} 行）`)
console.table(stats)
const nums = stats.map(s => s.chars)
console.log(`链数 ${chains.length}｜节点 ${totalNodes}｜字数 ${Math.min(...nums)}–${Math.max(...nums)}（预期 3300–4700）｜blurb ${chains.filter(c => c.blurb).length}/7`)
