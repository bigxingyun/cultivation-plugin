// 终检：按 missionId 前缀分段（唯一可靠的分段依据），校验全部硬性要求
const fs = require('fs')
const p = 'E:/koshi/插件/基础/_frag/b4.md'
const raw = fs.readFileSync(p, 'utf8')
const b = fs.readFileSync(p)
const lines = raw.split('\n')

console.log('BOM:', raw.charCodeAt(0) === 0xfeff, '| CRLF:', (raw.match(/\r\n/g) || []).length, '| 结尾换行:', raw.endsWith('\n') && !raw.endsWith('\n\n'), '| 字节:', b.length)

const REQ = { 天: '1.680', 仙: '1.892', 帝: '2.121' }
const TIERNUM = { 天: '5', 仙: '6', 帝: '7' }
const pref = ['- **intro**：', '- **success**：', '- **fail**：']
const errors = []
const seen = new Set()
const names = []
const seg = { m7: { n: 0, tier: {}, pur: {} }, m8: { n: 0, tier: {}, pur: {} } }
const lens = []

for (let i = 0; i < lines.length; i++) {
  const l = lines[i]
  if (!l.startsWith('#### ')) continue
  const id = l.slice(5).split('｜')[0].trim()
  const rest = l.slice(5).split('｜').slice(1).join('｜')
  const s = id.split('-')
  const realm = s[0]
  if (!/^m[78]$/.test(realm)) { errors.push('境界前缀异常: ' + id); continue }
  const tier = Object.keys(TIERNUM).find((k) => TIERNUM[k] === s[1])
  const pur = s[2]
  const seq = s[3]
  if (!tier) errors.push('品级序号异常: ' + id)
  if (!['combat', 'farm', 'train', 'compound'].includes(pur)) errors.push('purpose 异常: ' + id)
  if (!/^\d\d$/.test(seq)) errors.push('序号格式异常: ' + id)
  if (seen.has(id)) errors.push('ID 重复: ' + id)
  seen.add(id)

  const name = rest.split('　')[0].replace(/^\s+/, '').trim()
  names.push(name)
  const tierTag = (rest.match(/`(天|仙|帝)`/) || [])[1]
  const purTag = (rest.match(/`(combat|farm|train|compound)`/) || [])[1]
  const reqTag = (rest.match(/`req (\d\.\d\d\d)`/) || [])[1]
  if (tierTag !== tier) errors.push(`${id} 档位标签 ${tierTag}≠${tier}`)
  if (purTag !== pur) errors.push(`${id} 目的标签 ${purTag}≠${pur}`)
  if (reqTag !== REQ[tier]) errors.push(`${id} req ${reqTag}≠${REQ[tier]}`)
  if (!rest.endsWith('【占位】')) errors.push(`${id} 缺【占位】`)
  if (rest.split('　').length !== 4) errors.push(`${id} 标题段数 ${rest.split('　').length}≠4`)

  const ok = pref.map((x, k) => (lines[i + 1 + k] || '').startsWith(x))
  if (ok.some((x) => !x)) errors.push(`${id} 三行前缀不符 ${JSON.stringify(ok)}`)
  const len = pref.map((x, k) => (lines[i + 1 + k] || '').slice(x.length)).join('').replace(/\s/g, '').length
  lens.push(len)
  if (len < 50 || len > 90) errors.push(`${id} 字数 ${len}`)
  if (lines[i + 4] !== '') errors.push(`${id} 三行后非空行`)
  if (lines[i - 1] !== '') errors.push(`${id} 标题前非空行`)

  seg[realm].n++
  seg[realm].tier[tier] = (seg[realm].tier[tier] || 0) + 1
  seg[realm].pur[pur] = (seg[realm].pur[pur] || 0) + 1
}

for (const r of ['m7', 'm8']) {
  console.log(`${r === 'm7' ? '人仙期' : '天仙期'}: ${seg[r].n} 条 | 档位 ${JSON.stringify(seg[r].tier)} | 目的 ${JSON.stringify(seg[r].pur)}`)
}
console.log('合计:', seg.m7.n + seg.m8.n, '条')
console.log('字数区间:', Math.min(...lens), '~', Math.max(...lens))
const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))]
console.log('内部重名:', dup.length ? dup.join('、') : '无')
const existing = ['后山采药', '驱赶野猪', '清扫藏经阁', '挑水三十担', '修补篱笆', '守夜', '抄录残卷', '涧边取水', '追踪野狼', '药田除虫', '押送药箱', '后山巡查', '抄录旧档', '押送份例', '涧底清淤', '驱赶灵猿', '校对册页', '界碑重立']
const clash = names.filter((n) => existing.includes(n))
console.log('与已定稿 18 条重名:', clash.length ? clash.join('、') : '无')
const hit = ['失败', '没成功', '！', '奖励'].filter((w) => raw.includes(w))
console.log('禁用词:', hit.length ? hit.join('、') : '无')
console.log('\n=== 错误 ' + errors.length + ' 条 ===')
for (const e of errors) console.log('  ' + e)
