/** 一次性探针：把几个数据界面的**原样输出**打出来（人工看排版用，不属于自检）
 *  运行：node -r esbuild-register scripts/probe-style.ts
 */

import { Context } from 'koishi'
import MockBot from '@koishijs/plugin-mock'

async function main () {
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const dbFile = path.resolve('data/probe-style.db')
  fs.rmSync(dbFile, { force: true })

  const app = new Context({ prefix: ['.', '/'] })
  const sqliteMod: any = require('@koishijs/plugin-database-sqlite')
  app.plugin(sqliteMod?.default?.default ?? sqliteMod?.default ?? sqliteMod, { path: 'data/probe-style.db' })
  const mod: any = require('../external/koishi-plugin-xianxia-idle/src/index.ts')
  app.plugin(mod?.default?.default ?? mod?.default ?? mod, {})
  await app.start()
  await new Promise((r) => setTimeout(r, 300))

  const Mock = (MockBot as any).default ?? MockBot
  app.plugin(Mock, { selfId: 'bot-514' })
  await new Promise((r) => setTimeout(r, 300))
  const c = app.mock.client('p1', 'c1')
  await app.mock.initUser('p1', 4)
  const send = async (content: string) => ((await c.receive(content, 1)) || []).join('\n')
  const show = async (content: string) => {
    console.log(`\n──────── $ ${content}`)
    console.log(await send(content))
  }

  await show('.修仙')
  await show('.丹药')
  await show('.功法')
  await show('.丹炉')
  await show('.待办')
  await show('.历练')
  await show('.任务')

  // 造一个中期的档：rank 12 + 一门功法 + 资源 + 一条待决奇遇，看有内容时的排版
  const db = app.database
  await db.set('xianxia_user', { userId: 'p1' }, {
    rank: 12, exp: 24113, material: 1204, fragments: 7, alchemyExp: 3600,
    techId: 'T1-01', techTier: 'M', pendingEventId: '',
  } as any)
  await db.set('xianxia_user', { userId: 'p1' }, { seclusionStart: new Date(Date.now() - 4920 * 1000) } as any)
  await show('.状态')
  await show('.出关')
  await show('.签到')
  await show('.抽签')

  const cur = (await db.get('xianxia_user', { userId: 'p1' }))[0]
  await db.set('xianxia_user', { userId: 'p1' }, { exp: require('../external/koishi-plugin-xianxia-idle/src/core/curves').EP(cur.rank) + 1 } as any)
  await show('.突破')

  await show('.任务链')
  await show('.图鉴')

  await app.stop()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(2) })
