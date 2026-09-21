/**
 * 无头链路自检（headless smoke test）
 *
 * 不依赖 QQ、也不依赖网页控制台：用官方 @koishijs/plugin-mock 起一个
 * 假平台，把消息"发"进去，把机器人回复取出来逐条断言。
 *
 * 运行：
 *     node -r esbuild-register scripts/smoke-test.ts
 *
 * 退出码 0 = 全部通过；1 = 有未通过项；2 = 自检脚本自身崩溃。
 */

import { Context } from 'koishi'
import MockBot from '@koishijs/plugin-mock'

interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

const checks: CheckResult[] = []

function check(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail })
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} | ${name}${detail ? `  ——  ${detail}` : ''}`)
}

function first(text: string, n = 1) {
  return (text || '').split('\n').slice(0, n).join(' / ') || '(无回复)'
}

async function main() {
  console.log('══════ Koishi 链路自检 ══════\n')

  // ── 0. 每次自检都从空库开始（保证可重复运行；sql.js 驱动是文件快照式） ──
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const dbFile = path.resolve('data/smoke.db')
  fs.rmSync(dbFile, { force: true })
  fs.mkdirSync(path.dirname(dbFile), { recursive: true })

  // ── 1. 建应用（不读 koishi.yml，避免加载器差异干扰自检） ───────────
  const app = new Context({ prefix: ['.', '/'] })

  const sqliteMod: any = require('@koishijs/plugin-database-sqlite')
  const sqlite = sqliteMod?.default?.default ?? sqliteMod?.default ?? sqliteMod
  app.plugin(sqlite, { path: 'data/smoke.db' })

  const demoMod: any = require('../external/koishi-plugin-demo/src/index.ts')
  app.plugin(demoMod.default ?? demoMod, { probeLimit: 5 })

  await app.start()
  await new Promise((r) => setTimeout(r, 300))

  check('D1 应用启动', !!app, `koishi ${require('koishi/package.json').version}`)
  check(
    'D2 database 服务注入',
    !!app.database,
    app.database ? `驱动已就绪，库中表：${Object.keys((await app.database.stats()).tables).join(', ') || '(空)'}` : 'ctx.database 缺失',
  )

  // ── 2. 挂上假平台 ──────────────────────────────────────────────────
  const Mock = (MockBot as any).default ?? MockBot
  app.plugin(Mock, { selfId: 'bot-514' })
  await new Promise((r) => setTimeout(r, 300))

  check('D3 假平台上线', app.bots.length > 0, `bots = ${app.bots.map((b) => `${b.platform}:${b.selfId}`).join(', ') || '(无)'}`)

  const client = app.mock.client('u1', 'c1')
  const client2 = app.mock.client('u2', 'c1')
  await app.mock.initUser('u1', 1)
  await app.mock.initUser('u2', 4)

  /** 发一条消息，拿回机器人回复数组 */
  async function send(c: typeof client, content: string) {
    const replies = await c.receive(content, 1)
    return (replies || []).join('\n---\n')
  }

  console.log('\n────── 逐段验证链路 ──────\n')

  // 1. 消息双向 ────────────────────────────────────────────────────
  const r1 = await send(client, '.demo.echo 你好修仙')
  check(
    '1/8 消息收发（进得来 · 出得去）',
    r1.includes('你好修仙') && r1.includes('platform  = mock'),
    first(r1),
  )

  // 2. 事件时间戳 ──────────────────────────────────────────────────
  const r2 = await send(client, '.demo.ping')
  check('2/8 事件时间戳可用', /\d+ ms/.test(r2), first(r2))

  // 3. 数据库建表 / 插入 / 原子自增 / 读回 ──────────────────────────
  const r3a = await send(client, '.demo.db')
  const r3b = await send(client, '.demo.db')
  check(
    '3/8 数据库建表 + create + 原子自增',
    /count = 1/.test(r3a) && /count = 2/.test(r3b) && /matched = 1/.test(r3b),
    `${/count = \d+/.exec(r3a)?.[0]} → ${/count = \d+/.exec(r3b)?.[0]}`,
  )
  check('4/8 自建表已注册（stats 可见）', /demo_record/.test(r3a), /库中表：(.*)/.exec(r3a)?.[1] ?? '(未列出)')

  // 5. 惰性结算（真实时间流逝） ────────────────────────────────────
  await send(client, '.demo.sit')
  await new Promise((r) => setTimeout(r, 2200))
  const r5 = await send(client, '.demo.stand')
  const secs = Number(/本次流逝 (\d+) 秒/.exec(r5)?.[1] ?? 0)
  check('5/8 惰性结算（无定时器，按真实时间）', secs >= 2, `结算到 ${secs} 秒`)

  // 6. 每日重置按服务器日期 ────────────────────────────────────────
  const r6a = await send(client, '.demo.daily')
  const r6b = await send(client, '.demo.daily')
  check('6/8 每日重置（按日期而非 24h）', r6a.includes('签到成功') && r6b.includes('已经签过了'), first(r6b))

  // 7. 权限分级 ────────────────────────────────────────────────────
  const r7low = await send(client, '.demo.admin') // authority 1
  const r7high = await send(client2, '.demo.admin -f') // authority 4
  check(
    '7/8 权限分级（authority: 4）',
    !r7high.includes('权限不足') && r7high.includes('authority = 4') && r7low !== r7high,
    `低权限=${first(r7low)}`,
  )
  check('8/8 选项解析（-f / fallback）', r7high.includes('--force = true'), first(r7high))

  // 9. 异常路径 ────────────────────────────────────────────────────
  const r9 = await send(client, '.demo.err')
  const r9b = await send(client, '.demo.ping')
  check('9/9 抛错后插件仍存活', /\d+ ms/.test(r9b), `err 指令回复：${first(r9)}`)

  // 10. 数据真的落库 ───────────────────────────────────────────────
  //     注意：demo.admin 不建记录，所以 demo_record 里只应有 u1 一行。
  //     这里断言的是「确实落库了」，不是「每个用户都有一行」。
  const rows = await app.database.get('demo_record', {}, { limit: 20 })
  check(
    '10 数据真实落库（读回校验）',
    rows.length === 1 && rows[0].count === 2 && rows[0].seclusionSeconds >= 2 && rows[0].lastCheckinDate,
    `${rows.length} 行：${rows.map((r: any) => `${r.userId}(count=${r.count}, sec=${Math.round(r.seclusionSeconds)}, daily=${r.lastCheckinDate})`).join(' ')}`,
  )

  // ── 汇总 ──────────────────────────────────────────────────────────
  const failed = checks.filter((c) => !c.pass)
  console.log('\n══════ 汇总 ══════')
  console.log(`通过 ${checks.length - failed.length} / ${checks.length}`)
  if (failed.length) {
    console.log('\n未通过项：')
    for (const f of failed) console.log(`  · ${f.name}  ——  ${f.detail}`)
  } else {
    console.log('全链路已打通：消息 → 指令 → 数据库 → 惰性结算 → 回复')
  }

  await app.stop()
  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error('自检脚本自身出错：', err)
  process.exit(2)
})
