// 终检：按分节统计卡片数 / 档位 / 目的
const fs = require('fs')
const lines = fs.readFileSync('E:/koshi/插件/基础/_frag/b4.md', 'utf8').split('\n')
const per = {}
let cur = null
for (const l of lines) {
  if (l.startsWith('### ')) { cur = l; per[cur] = { cards: 0, tiers: {}, purs: {} }; continue }
  if (l.startsWith('#### ') && cur) {
    per[cur].cards++
    const t = (l.match(/`(天|仙|帝)`/) || [])[1]
    const p = (l.match(/`(combat|farm|train|compound)`/) || [])[1]
    per[cur].tiers[t] = (per[cur].tiers[t] || 0) + 1
    per[cur].purs[p] = (per[cur].purs[p] || 0) + 1
  }
}
let total = 0
for (const k of Object.keys(per)) {
  total += per[k].cards
  console.log(k)
  console.log(`   卡片 ${per[k].cards} | 档位 ${JSON.stringify(per[k].tiers)} | 目的 ${JSON.stringify(per[k].purs)}`)
}
console.log('总卡片数:', total)
