const fs = require('fs')
const lines = fs.readFileSync('E:/koshi/插件/基础/_frag/b3.md', 'utf8').split(/\r?\n/)
const rows = []
for (const l of lines) {
  const m = /^#### (m\d-\d-(?:combat|farm|train|compound)-\d{2}) ｜ (\S+?)[ \u3000]*`(地|天|仙|帝)` `(combat|farm|train|compound)`/.exec(l)
  if (m) rows.push(`${m[1]} | ${m[2]} | ${m[3]} | ${m[4]}`)
}
console.log(rows.join('\n'))
console.log('total', rows.length)
