/**
 * 双渲染黄金快照
 *
 * 同一条操作流水，分别用「纯文本」与「Markdown」两种渲染各跑一遍，把**原样输出**落成文件。
 * 两种模式共用同一份内容源（core/render.ts），快照同时是：
 *   1. 重构的回归网 —— 纯文本快照必须逐字不变
 *   2. 两套方案的对照样张 —— docs/输出/纯文本.txt vs docs/输出/markdown.txt
 *
 * 为了能 diff，必须可复现：时钟冻结 + Math.random 换成定种 PRNG。
 *
 * 运行：
 *   node -r esbuild-register scripts/golden-render.ts           # 生成
 *   node -r esbuild-register scripts/golden-render.ts --check   # 与已提交快照逐字对比
 */

import { Context } from 'koishi'
import MockBot from '@koishijs/plugin-mock'

// ── 可复现：冻结时钟 + 定种随机 ───────────────────────────────────────
const FROZEN = new Date('2026-09-21T10:00:00+08:00').getTime()
const RealDate = Date
function freezeClock () {
  const Fake: any = function (this: any, ...args: any[]) {
    if (!(this instanceof Fake)) return RealDate(...args as [any])
    return args.length === 0 ? new RealDate(FROZEN) : new (RealDate as any)(...args)
  }
  Fake.prototype = RealDate.prototype
  Fake.now = () => FROZEN
  Fake.parse = RealDate.parse
  Fake.UTC = RealDate.UTC
  ;(globalThis as any).Date = Fake
}
let seed = 20260921
function seedRandom () {
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

const MODES = ['text', 'markdown'] as const
type Mode = typeof MODES[number]

/** mock 编码器会把未知元素原样写成 <qq:markdown>…</qq:markdown>，剥掉它才拿到真身 */
function unwrap (s: string): string {
  return s.replace(/^<qq:markdown>/, '').replace(/<\/qq:markdown>$/, '')
}

async function run (mode: Mode): Promise<{ text: string; pairs: Array<{ cmd: string; out: string }> }> {
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const dbFile = path.resolve(`data/golden-${mode}.db`)
  fs.rmSync(dbFile, { force: true })
  fs.mkdirSync(path.dirname(dbFile), { recursive: true })

  seed = 20260921
  seedRandom()
  freezeClock()

  const app = new Context({ prefix: ['.', '/'] })
  const sqliteMod: any = require('@koishijs/plugin-database-sqlite')
  app.plugin(sqliteMod?.default?.default ?? sqliteMod?.default ?? sqliteMod, { path: `data/golden-${mode}.db` })
  const mod: any = require('../external/koishi-plugin-xianxia-idle/src/index.ts')
  app.plugin(mod?.default?.default ?? mod?.default ?? mod, { render: mode, todoHint: true })
  await app.start()
  await new Promise((r) => setTimeout(r, 300))

  const Mock = (MockBot as any).default ?? MockBot
  app.plugin(Mock, { selfId: 'bot-514' })
  await new Promise((r) => setTimeout(r, 300))
  const c = app.mock.client('g1', 'c1')
  await app.mock.initUser('g1', 4)
  const db = app.database!
  const C = require('../external/koishi-plugin-xianxia-idle/src/core/curves.ts')

  const out: string[] = []
  const pairs: Array<{ cmd: string; out: string }> = []
  const send = async (cmd: string) => {
    const raw = ((await c.receive(cmd, 1)) || []).join('\n')
    const body = mode === 'markdown' ? unwrap(raw) : raw
    pairs.push({ cmd, out: body })
    out.push(`──── $ ${cmd}`)
    out.push(body)
    out.push('')
  }
  /** 时间旅行后跑一条指令（惰性结算，改时间戳即改世界） */
  const travel = (ms: number) => FROZEN - ms

  // 1 建档 + 开场
  await send('.修仙')
  await send('.帮助')
  await send('.介绍')
  await send('.待办')
  await send('.状态')
  await send('.丹药')
  await send('.功法')
  await send('.丹炉')
  await send('.图鉴')

  // 2 闭关 → 结算
  await send('.闭关')
  await db.set('xianxia_user', { userId: 'g1' }, { seclusionStart: new Date(travel(7200 * 1000)) } as any)
  await send('.状态')
  await send('.出关')

  // 3 历练：菜单 → 多选一 → 批量 → 队列 → 收取
  await send('.历练')
  await send('.历练 1')
  await send('.历练 换')
  await send('.历练 打怪 凡 2')
  await send('.任务')
  for (const row of await db.get('xianxia_queue', { userId: 'g1' })) {
    await db.set('xianxia_queue', { userId: 'g1', seq: row.seq }, { finishAt: new Date(travel(1000)) } as any)
  }
  await send('.任务 收')
  await send('.任务')
  await send('.放弃 99')

  // 4 突破：修为不足 → 满池
  await send('.突破')
  await db.set('xianxia_user', { userId: 'g1' }, { exp: C.EP(1) } as any)
  await send('.突破')
  await send('.突破')

  // 5 每日
  await send('.签到')
  await send('.签到')
  await send('.抽签')
  await send('.答题')
  await send('.答题 A')
  await db.set('xianxia_user', { userId: 'g1' }, { pendingEventId: 'E1-001' } as any)
  await send('.奇遇')
  await send('.奇遇 1')
  await send('.奇遇 2')
  await send('.天机')

  // 6 成长
  await send('.修仙管理 发丹 @g1 P1-A 8')
  await send('.修仙管理 发灵材 @g1 5000')
  await send('.丹药')
  await send('.服用 聚气丹')
  await send('.服用 聚气丹')
  await db.upsert('xianxia_tech', [{ userId: 'g1', techId: 'T01', tier: 'L', obtainedAt: new Date(FROZEN) }], ['userId', 'techId'])
  await db.set('xianxia_user', { userId: 'g1' }, { techId: 'T01', techTier: 'L', exp: C.EP(2) * 2 } as any)
  await send('.功法')
  await send('.升阶')
  await send('.炼丹 聚气丹 1')
  await send('.喂丹 聚气丹 1')
  await send('.丹炉')
  await send('.图鉴 功法')
  await send('.图鉴 丹药')
  await send('.图鉴 故事')
  await send('.成就')

  // 7 叙事
  await send('.任务链')
  await send('.接链 青云旧籍')
  await db.set('xianxia_chain', { userId: 'g1', chainId: 'shanmen_01' }, { finishAt: new Date(travel(1000)) } as any)
  await send('.链进度')
  await send('.链进度')
  await send('.看故事 青云旧籍')
  await send('.看故事 青云旧籍 1')
  await send('.放弃链 青云旧籍')

  // 8 错误分支与帮助分支
  await send('.帮助 状态')
  await send('.帮助 历练')
  await send('.帮助 炼丹')
  await send('.帮助 丹炉')
  await send('.帮助 不存在的指令')
  await send('.历练 99')
  await send('.历练 不存在')
  await send('.服用 不存在')
  await send('.接链 不存在')
  await send('.放弃')
  await send('.修仙管理 不存在')
  await send('.修仙管理 查询 @g1')

  await app.stop()
  return { text: out.join('\n'), pairs }
}

async function main () {
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const check = process.argv.includes('--check')
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)
  const modes = only ? MODES.filter((m) => m === only) : MODES
  const dir = path.resolve('docs/输出')
  const names: Record<Mode, string> = { text: '纯文本.txt', markdown: 'markdown.txt' }
  fs.mkdirSync(dir, { recursive: true })

  let bad = 0
  const results: Partial<Record<Mode, { text: string; pairs: Array<{ cmd: string; out: string }> }>> = {}
  for (const mode of modes) {
    const res = await run(mode)
    results[mode] = res
    const body = res.text
    const file = path.join(dir, names[mode])
    if (check) {
      const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
      if (old === null) { console.log(`❌ ${names[mode]} 不存在（先跑一次生成）`); bad++; continue }
      if (old === body) { console.log(`✅ ${names[mode]} 与快照逐字一致（${body.length} 字符）`); continue }
      const a = old.split('\n'); const b = body.split('\n')
      const at = a.findIndex((x, i) => x !== b[i])
      console.log(`❌ ${names[mode]} 有差异，首个不同在第 ${at + 1} 行：`)
      console.log(`   快照：${JSON.stringify(a[at])}`)
      console.log(`   现在：${JSON.stringify(b[at])}`)
      console.log(`   （快照 ${a.length} 行 / 现在 ${b.length} 行）`)
      bad++
    } else {
      fs.writeFileSync(file, body)
      console.log(`✍ 已写入 ${file}（${body.length} 字符，${body.split('\n').length} 行）`)
    }
  }

  // ── 不变量：两条路径只在排版上不同，数据指纹必须逐条一致 ─────────────
  if (results.text && results.markdown) {
    const R = require('../external/koishi-plugin-xianxia-idle/src/core/render.ts')
    const a = results.text.pairs
    const b = results.markdown.pairs
    const diffs: string[] = []
    if (a.length !== b.length) diffs.push(`指令条数不同：${a.length} vs ${b.length}`)
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i].cmd !== b[i].cmd) { diffs.push(`第 ${i + 1} 条指令不对齐：${a[i].cmd} vs ${b[i].cmd}`); continue }
      if (R.fingerprint(a[i].out) !== R.fingerprint(b[i].out)) diffs.push(`${a[i].cmd} 数据指纹不一致`)
    }
    if (diffs.length) {
      console.log(`❌ 两条渲染路径的数据指纹不一致（${diffs.length} 处）：`)
      for (const d of diffs.slice(0, 8)) console.log(`   ${d}`)
      bad++
    } else {
      console.log(`✅ 两条渲染路径数据指纹逐条一致（${a.length} 条指令：纯文本 ${results.text.text.length} 字符 / Markdown ${results.markdown.text.length} 字符）`)
    }
    // 空回复 = 指令没接上出口（例如绕开 shell / emit 直接返回结构体），比排版错更难发现
    const blank = a.filter((x) => !x.out.trim()).map((x) => x.cmd)
    const blank2 = b.filter((x) => !x.out.trim()).map((x) => x.cmd)
    if (blank.length || blank2.length) {
      console.log(`❌ 有指令没有回复（纯文本 ${blank.length} 条 / Markdown ${blank2.length} 条）：${[...new Set([...blank, ...blank2])].join(' ')}`)
      bad++
    } else {
      console.log(`✅ 每条指令都有回复（${a.length} 条，无空回复）`)
    }
  }
  process.exit(bad ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(2) })
