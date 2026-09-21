# Koishi 官方文档技术笔记（数据库 / 跨平台适配器）

> 面向：为一个 Koishi 平台的「修仙挂机文字游戏 QQ 机器人插件」编写开发指南。
> 本文所有内容均逐字提取自 koishi.chat 中文站页面，只记录**事实性 API**，不含设计建议。
> 标注 `[实验性]`、`[废弃]` 的地方为官方原文标注。

## 0. 已完整阅读的页面（含正文与截断后的原始全文）

| 主题 | URL |
| --- | --- |
| 基本用法 | https://koishi.chat/zh-CN/guide/database/ |
| 数据模型 | https://koishi.chat/zh-CN/guide/database/model.html |
| 进阶查询技巧 | https://koishi.chat/zh-CN/guide/database/selection.html |
| 内置数据结构（指南） | https://koishi.chat/zh-CN/guide/database/builtin.html |
| 权限管理 | https://koishi.chat/zh-CN/guide/database/permission.html |
| 跨平台基础知识 | https://koishi.chat/zh-CN/guide/adapter/index.html |
| 实现机器人 | https://koishi.chat/zh-CN/guide/adapter/bot.html |
| 消息编码 | https://koishi.chat/zh-CN/guide/adapter/message.html |
| **补充** 数据模型 (Model) API | https://koishi.chat/zh-CN/api/database/model.html |
| **补充** 数据库操作 (Database) API | https://koishi.chat/zh-CN/api/database/database.html |
| **补充** 查询表达式 (Query) API | https://koishi.chat/zh-CN/api/database/query.html |
| **补充** 求值表达式 (Eval) API | https://koishi.chat/zh-CN/api/database/evaluation.html |
| **补充** 查询构造器 (Selection) API | https://koishi.chat/zh-CN/api/database/selection.html |
| **补充** 内置数据结构 (built-in) API | https://koishi.chat/zh-CN/api/database/built-in.html |
| **补充** 会话 (Session) API | https://koishi.chat/zh-CN/api/core/session.html |
| **补充** 上下文 (Context) API | https://koishi.chat/zh-CN/api/core/context.html |
| **补充** 机器人 (Bot) API | https://koishi.chat/zh-CN/api/core/bot.html |
| **补充** 消息 (Message) 资源 API | https://koishi.chat/zh-CN/api/resources/message.html |
| **补充** 计时器 (Timer) API | https://koishi.chat/zh-CN/api/service/timer.html |
| **补充** 服务与依赖 | https://koishi.chat/zh-CN/guide/plugin/service.html |
| **补充** 平台集成 | https://koishi.chat/zh-CN/guide/adapter/integration.html |
| **补充** QQ 适配器 | https://koishi.chat/zh-CN/plugins/adapter/qq.html |
| **补充** Satori 适配器 | https://koishi.chat/zh-CN/plugins/adapter/satori.html |
| **补充** 数据库插件（SQLite / Memory / MySQL） | https://koishi.chat/zh-CN/plugins/database/{sqlite,memory,mysql}.html |
| **补充** 数据管理 (Admin) | https://koishi.chat/zh-CN/plugins/common/admin.html |
| **补充** 深入定制机器人（权限等级准则） | https://koishi.chat/zh-CN/manual/usage/customize.html |
| **补充** 指令系统（指令权限管理） | https://koishi.chat/zh-CN/manual/usage/command.html |
| **补充** 安装和配置插件 | https://koishi.chat/zh-CN/manual/usage/market.html |

---

## A. 数据库基础

### A1. 使用数据库前必须做什么

官方原文（指南「基本用法」开篇 TIP）：

> `ctx.database` 并非内置服务，因此如果你的插件需要使用数据库功能，需要[声明依赖](./../plugin/service.html#inject-属性)。

声明依赖的写法（`guide/plugin/service.html` 原文）：

```ts
export const name = 'dialogue'
export const inject = ['database']

export function apply(ctx: Context) {
  // 你可以立即访问数据库服务
  ctx.database.get('dialogue', {})
}
```

`inject` 的语义（官方原文）：

- 直到此服务的值变为 truthy 为止，该插件的函数体不会被加载
- 一旦此服务的值发生变化，该插件将立即回滚 (并非插件停用)
- 如果变化后的值依旧为 truthy，该插件会在回滚完成后被重新加载

`inject` 也可以写成对象形式（`required` / `optional`）：

```ts
export const inject = {
  optional: ['assets'],
}

export function apply(ctx: Context) {
  ctx.command('dialogue').action((_, content) => {
    // 检查资源存储服务是否存在
    if (ctx.assets) ctx.assets.transform(content)
  })
}
```

官方「最佳实践」（原文，可直接抄）：

```ts
// 正确答案！抄这个！
export const name = 'dialogue'

// 对于整体依赖的服务，使用 inject 属性声明依赖关系
export const inject = {
  required: ['database'],
  optional: ['assets'],
}

export function apply(ctx: Context) {
  ctx.command('dialogue').action((_, content) => {
    // 对于可选的依赖服务，在运行时检测即可
    if (ctx.assets) ctx.assets.transform(content)
  })

  // 对于部分功能依赖的服务，使用 ctx.inject() 注册为子插件
  ctx.inject(['console'], (ctx) => {
    ctx.console.addEntry('/path/to/dialogue/extension')
  })
}
```

`package.json` 中声明服务依赖（原文）：

```json
{
  "service": {
    "required": ["puppeteer"]
  },
  "devDependencies": {
    "koishi-plugin-puppeteer": "^2.0.0"
  }
}
```

子插件语法糖（原文）：

```ts
ctx.inject(['console'], (ctx) => {
  ctx.console.addEntry('/path/to/dialogue/extension')
})

// 等价于
ctx.plugin({
  using: ['console'],
  apply: (ctx) => {
    ctx.console.addEntry('/path/to/dialogue/extension')
  },
})
```

重要副作用警告（原文）：

> 首先，数据库服务需要等到应用启动完成后才可以访问，换言之即使安装了数据库插件，你也无法立即判断数据库服务是否存在。

**结论（事实）**：使用数据库 = ①在应用里安装一个数据库插件（提供 `database` 服务）；②在自己的插件里通过 `export const inject = ['database']` 声明依赖。

### A2. 官方支持的数据库驱动

官方插件文档「数据库支持」栏目共列出 5 个（页面 URL → 包名）：

| 显示名 | 页面 | 包名 |
| --- | --- | --- |
| Memory | `/zh-CN/plugins/database/memory.html` | `@koishijs/plugin-database-memory` |
| MongoDB | `/zh-CN/plugins/database/mongo.html` | `@koishijs/plugin-database-mongo` |
| MySQL / MariaDB | `/zh-CN/plugins/database/mysql.html` | `@koishijs/plugin-database-mysql` |
| PostgreSQL | `/zh-CN/plugins/database/postgres.html` | `@koishijs/plugin-database-postgres` |
| SQLite | `/zh-CN/plugins/database/sqlite.html` | `@koishijs/plugin-database-sqlite` |

各驱动的配置项（原文）：

**SQLite**

```
### config.path
- 类型: `string`
- 默认值: `'data/koishi.db'`
数据库文件的路径。
```

**Memory**

```
## 配置项
此插件暂无配置项。
```

（即 Memory 是唯一「零配置」的官方方案，但它是内存数据库。）

**MySQL / MariaDB**

> TIP：需要的最低版本是 MySQL 5.7 / 8.0 或 MariaDB 10.5。

```
### config.host     类型: string  默认值: 'localhost'   要连接的主机名。
### config.port     类型: number  默认值: 3306          要连接的端口号。
### config.username 类型: string  默认值: 'root'        要使用的用户名。
### config.password 类型: string                        要使用的密码。
### config.database 类型: string  默认值: 'koishi'      要访问的数据库名称。
```

**注意**：本次阅读的官方页面中**没有**出现「Koishi 内置/默认自带某个数据库」「未安装数据库插件也能用 SQLite」这类表述；所有数据库能力都由上述插件提供。SQLite 插件文档只声明了 `config.path` 一项，默认写 `data/koishi.db`。

### A3. 在控制台里如何配置数据库

官方「安装和配置插件」页面描述的通用流程（原文要点）：

- 在控制台的「插件市场」中安装插件；已安装未启用的插件名字是灰色的，点击右上角「启用插件」按钮即可运行。
- 「停用插件」不会删除代码，也不会删除配置。
- 复杂插件在详情页提供配置项：
  > 必选但尚未填入的配置项会在左侧呈现 红色 的提示条，只有正确填写配置才能启动插件。
  > 已修改但未保存的配置项会在左侧呈现 紫色 的提示条，点击「启用插件」或「保存配置」按钮后会保存配置；如果你想撤销这些改动，可以在配置名称旁的小三角处呼出菜单，选择「撤销更改」使该配置恢复到上次保存时的状态。
- 「依赖管理」页面可更新 / 卸载依赖（注意：依赖管理功能仅为生产环境设计；如果是开发环境，请使用 `dep` 命令来更新依赖）。
- 「添加插件」对话框可在「全局配置」或任意分组中创建一份未启用的插件配置；「全局配置」/分组的右上角还有「创建分组」按钮。

即：数据库的配置方式 = 在控制台插件市场安装上述数据库插件 → 在其详情页填写 `host` / `port` / `username` / `password` / `database`（SQLite 填 `path`）。

---

## B. 数据模型（`ctx.model`）

### B1. `ctx.model.extend()` 完整签名

官方 API 原文：

```
### ctx.model.extend(name, fields, config?)

-   name: string 数据表名
-   fields: Field.Config 字段信息
-   config: Table.Meta 表的基本配置
    -   config.primary: string | string[] 主键名，默认为 'id'
    -   config.unique: (string | string[])[] 值唯一的键名列表
    -   config.foreign: Dict<[string, string]> 外键列表 实验性
    -   config.autoInc: boolean 是否使用自增主键

扩展一个新的数据表。
```

指南中的 `config`（第三个参数）原始示例：

```ts
// 注意这里配置的是第三个参数，也就是之前 autoInc 所在的参数
ctx.model.extend('foo', {}, {
  // 主键，默认为 'id'
  // 主键将会被用于 Query 的简写形式，如果传入的是原始类型或数组则会自行理解成主键的值
  primary: 'name',
  // 自增主键值
  autoInc: true,
  // 唯一键，这应该是一个列表
  // 这个列表中的字段对应的值在创建和修改的时候都不允许与其他行重复
  unique: ['bar', 'baz'],
  // 外键，这应该是一个键值对
  foreign: {
    // 相当于约束了 foo.uid 必须是某一个 user.id
    uid: ['user', 'id'],
  },
})
```

**注意：没有 `index` 参数。** 官方 `Table.Meta` 只有 `primary` / `unique` / `foreign` / `autoInc` 四项；索引相关章节的标题是「声明索引 [实验性]」，但实际示例里分配的正是上面这四项（`unique` / `foreign`）。

### B2. 扩展表 / 扩展字段（含类型合并声明）

```ts
declare module 'koishi' {
  interface Tables {
    schedule: Schedule
  }
}

// 这里是新增表的接口类型
export interface Schedule {
  id: number
  assignee: string
  time: Date
  interval: number
  command: string
  session: Session.Payload
}

ctx.model.extend('schedule', {
  // 各字段的类型声明
  id: 'unsigned',
  assignee: 'string',
  time: 'timestamp',
  interval: 'integer',
  command: 'text',
  session: 'json',
})
```

向内置表注入字段：

```ts
declare module 'koishi' {
  interface User {
    foo: string
  }
}

ctx.model.extend('user', {
  // 向用户表中注入字符串字段 foo
  foo: 'string',
})
```

### B3. 字段类型完整表（官方 API 原文）

`Field<T>` 接口：

```ts
export interface Field<T> {
  type: string
  length?: number
  nullable?: boolean
  initial?: T
  comment?: string
  legacy?: string[]
}
```

**数值类型**

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :---: | :---: | :---: | :---: | :---: |
| integer | `number` | 4 | `0` | 有符号整型数，长度决定了数据的范围 |
| unsigned | `number` | 4 | `0` | 无符号整型数，长度决定了数据的范围 |
| float | `number` | 固定长度 | `0` | 单精度浮点数 |
| double | `number` | 固定长度 | `0` | 双精度浮点数 |

**字符串类型**

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :---: | :---: | :---: | :---: | :---: |
| char | `string` | 64 | `''` | 定长的字符串 |
| string | `string` | 255 | `''` | 变长的字符串 |
| text | `string` | 65535 | `''` | 变长的字符串 |

**时间类型**

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :---: | :---: | :---: | :---: | :---: |
| date | `Date` | 固定长度 | `null` | 日期值 |
| time | `Date` | 固定长度 | `null` | 时间值 |
| timestamp | `Date` | 固定长度 | `null` | 时间戳 |

**其他类型**

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :---: | :---: | :---: | :---: | :---: |
| json | `object` | 65535 | `null` | 可被序列化为 json 的结构化数据 |
| list | `string[]` | 65535 | `[]` | 字符串构成的列表，序列化时以逗号分隔 |

**关于其他类型名的核实结果（重要）**：

- 官方类型表**只列出以上 12 种**：`integer`、`unsigned`、`float`、`double`、`char`、`string`、`text`、`date`、`time`、`timestamp`、`json`、`list`。
- `'boolean'` **没有出现在类型表中**，但官方「整表迁移」示例里确实写了 `flag: 'boolean'`（见 B6），并且 `Field.nullable` 是布尔类型的属性。
- 没有 `'object'`、`'array'`、`'bigint'` 等类型名；对应 `json` / `list`。
- `'id'` 在 API 文档的内置表字段里作为类型出现（如 `id: id` 用户 ID），但不在类型表中。

### B4. 字段定义的对象写法与默认值

```ts
ctx.model.extend('user', {
  foo: {
    type: 'string',
    // 占据的字节长度
    length: 65535,
    // 该字段的默认值
    initial: 'bar',
    // 是否允许为空
    nullable: false,
  },
})
```

官方说明：

> 当你直接使用 `string` 作为类型时，其默认字节长度为 255，默认初始值为 `''`。不同字段的默认值也有所区别，你可以在[这里](./../../api/database/model.html)查看完整的数据类型列表。

（默认值即 B3 表中的「默认初始值」列：数值类型 `0`、字符串类型 `''`、时间类型 `null`、`json` `null`、`list` `[]`。）

### B5. 嵌套字段 [实验性]

官方说明了两种方式：

> 1. 使用 `json` 类型，适用于对象内部属性不固定的情况
> 2. 为每个属性单独声明嵌套类型，这种做法在查询时更加高效

```ts
declare module 'koishi' {
  interface User {
    foo: {
      bar: string
      baz: number
    }
  }
}

// 声明嵌套类型时，对象的多级属性被拼接为一个字符串
ctx.model.extend('user', {
  'foo.bar': 'string',
  'foo.baz': 'integer',
})
```

> 无论是哪一种情况，在查询时 `foo` 都会被视为一个独立的字段。
> 我们甚至还可以把上述两种方式相结合起来，例如指定 `foo.bar` 的类型为 `json`。

### B6. 表结构变更 / 迁移

**(1) 扩展时机（硬性要求）**

> 请注意：数据模型的扩展一定要在使用前完成，不然后续数据库操作可能会失败。

**(2) 字段改名 → `legacy`**

> 如果你想要修改一个已有的字段 (只修改名称，不修改逻辑)，你并不能单纯地将源码中的字段名改成新名称。如果这样做，数据仍然会停留在旧的字段中，它们实质上已经丢失了，却仍然占据的数据库的空间。此时你需要将旧的字段一并声明到表中：

```ts
ctx.model.extend('user', {
  foo: {
    type: 'string',
    legacy: ['bar', 'baz'],
  },
})
```

> 这样一来，Koishi 就知道 `foo`, `bar`, `baz` 这三个字段实际上对应是同一列数据，并在启动时自动将旧字段中的数据迁移到 `foo` 字段中。

（由此可得的**文档事实**：新增字段时 Koishi 自行处理列结构，旧列不会被自动删除，只是「占据数据库的空间」；官方没有给出「手动执行 migration」的步骤。）

**(3) 整表迁移 → `ctx.model.migrate()` [实验性]**

> WARNING：整表迁移的性能较差，建议谨慎设计数据库结构而不是依赖迁移。

```ts
ctx.model.extend('qux', {
  id: 'unsigned',
  text: 'string',
})

ctx.model.extend('qux2', {
  id: 'unsigned',
  flag: 'boolean',
})

// 如果 qux 中存在 flag 列，则对这部分数据进行迁移
ctx.model.migrate('qux', {
  flag: 'boolean',
}, async (database) => {
  const data = await database.get('qux', {}, ['id', 'flag'])
  await database.upsert('qux2', data)
})
```

> 上面的例子展示了如何将 `qux` 表中的 `flag` 数据迁移到 `qux2` 表中。迁移完成后，`qux` 表中的 `flag` 列将会被删除，而其他列则会保留。如果你希望删除旧表，可以在回调函数的最后加上一句 `database.drop('qux')`。

API 签名：

```
### ctx.model.migrate(name, fields, callback) 实验性
-   name: string 数据表名
-   fields: Field.Config 要迁移的字段信息
-   callback: (db: Database) => Promise<void> 迁移的回调函数
设置整表迁移的操作。
```

### B7. `ctx.model` 上的全部方法（官方 API 只有 3 个）

```
### ctx.model.extend(name, fields, config?)     扩展一个新的数据表。
### ctx.model.create(name, data)                创建一条新的数据，折叠嵌套属性，并填充必要的默认值。
-   name: string 数据表名
-   data: any 数据
### ctx.model.migrate(name, fields, callback) 实验性
```

---

## C. 增删改查（`ctx.database`）

### C1. 方法签名与返回类型（API 原文）

```
### ctx.database.select(table, query?)
-   table: string 表名
-   query: Query 约束条件
-   返回值: Selection
创建一个新的 Selection 对象。

### ctx.database.join(tables, query?) 实验性
-   tables: TableJoin 用于连接的表
-   query: Callback 约束条件
-   返回值: Selection
将多个表连接成新的虚拟表。

### ctx.database.get(table, query, modifier?)
-   table: string 表名
-   query: Query 约束条件
-   modifier: Modifier 请求修饰符
-   返回值: Promise<any[]>
查询数据。

### ctx.database.set(table, query, update)
-   table: string 表名
-   query: Query 约束条件
-   update: Update 数据
-   返回值: Promise<WriteResult>
更新数据。返回对象包含本次操作的匹配行数。

### ctx.database.remove(table, query)
-   table: string 表名
-   query: Query 约束条件
-   返回值: Promise<WriteResult>
删除数据。返回对象包含本次操作的匹配行数。

### ctx.database.create(table, data)
-   table: string 表名
-   data: any 数据
-   返回值: Promise<any>
插入数据。返回值为插入的数据行。

### ctx.database.upsert(table, data, keys?)
-   table: string 表名
-   data: Update[] 数据
-   keys: string | string[] 用于索引的字段
-   返回值: Promise<WriteResult>
插入或更新数据。返回对象包含本次操作的插入行数和匹配行数。

### ctx.database.eval(table, expr, query?)
-   table: string 表名
-   expr: Callback 用于计算的表达式
-   query: Query 约束条件
-   返回值: Promise<any>
计算聚合表达式。

### ctx.database.stats() 实验性
-   返回值: Promise<Stats>
获取统计信息。

### ctx.database.drop(table)
-   table: string 表名
-   返回值: Promise<void>
删除表。
DANGER 这是一个危险操作，删除表后将无法恢复数据。
如果你是插件开发者，并希望重构插件的数据库结构，我们建议使用整表迁移，以防止用户数据丢失。

### ctx.database.dropAll()
-   返回值: Promise<void>
删除所有表。
```

`Stats` 类型（原文）：

```ts
interface Stats {
  size: number
  tables: Dict<TableStats>
}

interface TableStats {
  count: number
  size: number
}
```

### C2. `get()` 返回数组、`create()` 返回值、`upsert()` 语义（指南原文）

> `get`：使用 `database.get()` 方法以获取特定表中的数据。

```ts
// 获取 schedule 表中 id 为 1234 的数据行，返回一个数组
await ctx.database.get('schedule', 1234)

// 获取 schedule 表中 id 为 1234 或 5678 的数据行，返回一个数组
await ctx.database.get('schedule', [1234, 5678])
```

> 对于复杂的数据表，如果你只需要获取少数字段，你可以通过第三个参数手动指定要获取的字段：

```ts
// 返回的数组中每个元素只会包含 command, time 属性
await ctx.database.get('schedule', [1234], ['command', 'time'])
```

```ts
// 获取名为 schedule 的表中 assignee 为 123456 或 456789 的数据行
await ctx.database.get('schedule', {
  assignee: ['123456', '456789'],
})
```

```ts
// 获取名为 schedule 的表中 id 大于 2 但是小于等于 5 的数据行
await ctx.database.get('schedule', {
  id: { $gt: 2, $lte: 5 },
})
```

**`get()` 始终返回数组**（`Promise<any[]>`）。

`create`：

```ts
// 向 schedule 表中添加一行数据，data 是要添加的数据行
// 返回值是添加的行的完整数据 (包括自动填充的 id 和默认属性等)
await ctx.database.create('schedule', data)
```

> 如果你想要批量插入数据，可以使用下面介绍的 `database.upsert()` 方法。

`set`：

```ts
// 第二个参数也可以使用上面介绍的查询表达式
await ctx.database.set('schedule', 1234, {
  assignee: 'telegram:123456',
  time: new Date(),
})
```

> 如果要修改的数据与已有数据相关，可以使用求值表达式：

```ts
// 让所有日期为今天的数据行的 count 字段在原有基础上增加 1
await ctx.database.set('foo', { date: new Date() }, (row) => ({
  count: $.add(row.count, 1),
}))
```

`upsert`（**存在则更新、不存在则插入**）：

```ts
// 用一个数组来对数据进行更新，你需要确保每一个元素都拥有这个数据表的主键
// 修改时只会用每一行中出现的键进行覆盖，不会影响未定义的字段
await ctx.database.upsert('foo', (row) => [
  { id: 1, foo: 'hello' },
  { id: 2, foo: 'world' },
  // 如果此列存在，则会按照 $.concat() 的行为进行修改
  // 如果此列不存在，row.bar 则会使用默认值
  { id: 3, bar: $.concat(row.bar, ['koishi']) },
])
```

官方给出的 upsert 行为表：

| id | foo | bar | 说明 |
| --- | --- | --- | --- |
| 1 | hello | baz | 该行已经存在，只更新了 foo 字段 |
| 2 | world | bar | 插入了新行，其中 foo 字段取自传入的数据，bar 字段取自默认值 |
| 3 | null | barkoishi | 插入了新行，其中 bar 字段取自传入的数据，foo 字段取自默认值 |

> 如果想以非主键来索引要修改的数据，可以使用第三个参数：

```ts
// 以非主键为基准对数据表进行更新，你需要确保每一个元素都拥有 telegram 属性
await ctx.database.upsert('user', rows, 'telegram')

// 以复合键为基准对数据表进行更新，你需要确保每一个元素都拥有 platform 和 id 属性
await ctx.database.upsert('channel', rows, ['platform', 'id'])
```

`remove`：

```ts
// 从 schedule 表中删除特定 id 的数据行
// 第二个参数也可以使用上面介绍的查询表达式
await ctx.database.remove('schedule', [id])
```

### C3. `WriteResult` 与原子更新

API 原文：

```ts
export interface WriteResult {
  // upsert 操作中插入数据的行数
  inserted?: number
  // set, upsert, remove 操作中匹配数据的行数
  matched?: number
}
```

指南原文：

> `set`, `upsert` 和 `remove` 操作都会返回一个 `WriteResult` 对象，它包含了这次操作的结果。你可以通过 `matched` 属性来获取匹配的数据行数 (注意不是修改的函数)，通过 `inserted` 属性来获取插入的数据行数 (仅限 `upsert` 操作)。

```ts
// 对某个用户的余额进行扣除
const result = await ctx.database.set(
  'user',
  { id, money: { $gte: 100 } },
  (row) => ({ money: $.sub(row.money, 100) }),
)
// 如果用户不存在或余额不足，此时 result.matched 为 0
if (!result.matched) {
  throw new Error('用户不存在或余额不足！')
}
```

### C4. set / upsert / create 的对比表（官方原文）

|     | set | upsert |
| --- | --- | --- |
| 作用范围 | 支持复杂的查询表达式 | 只能限定特定字段的值 |
| 插入行为 | 如果数据不存在则不会进行任何操作 | 如果数据不存在则会插入新行 |

|     | create | upsert |
| --- | --- | --- |
| 插入数量 | 只能插入一条数据 | 可以批量插入多条数据 |
| 返回值 | 返回经过填充后的数据 | 没有返回值 |
| 冲突行为 | 如果数据已存在则会报错 | 如果数据已存在则会执行修改 |

> ⚠️ **文档内部冲突（事实记录）**：指南的对比表写 upsert「没有返回值」，而 API 页面写「返回值: `Promise<WriteResult>`，返回对象包含本次操作的插入行数和匹配行数」。两处原文均已照录，不做解释。

### C5. `Modifier`（排序 / 分页 / 取部分字段）

```ts
type Modifier<K extends string> = K[] | ModifierOptions<K>

interface ModifierOptions<K> {
  limit?: number
  offset?: number
  fields?: K[]
  sort?: Dict<'asc' | 'desc'>
}
```

即 `get(table, query, modifier)` 的第三参数支持两种形式：
- 数组形式 = 只取这些字段（指南：`await ctx.database.get('schedule', [1234], ['command', 'time'])`）
- 对象形式 = `{ limit, offset, fields, sort }`，`sort` 是 `{ 字段名: 'asc' | 'desc' }`

### C6. `Update` 类型

```ts
type Uneval<T> =
  | T extends number ? Eval.Number
  : T extends string ? Eval.String
  : T extends boolean ? Eval.Boolean
  : T extends Date ? Eval.Date
  : T extends RegExp ? Eval.RegExp
  : T

type Update<S> = {
  [K in keyof S]?: Uneval<S[K]>
}
```

> 要更新的数据。包含任意多个字段，每个字段的值可以是一个固定值或者求值表达式。

### C7. 查询表达式（Query）—— 完整操作符清单

**类型定义（原文）**

```ts
// 某个字段的约束条件
type FieldQuery<T> = FieldExpr<T> | Shorthand<T>

// 一个字典，键是字段名，值是约束条件
type QueryExpr<T> = LogicalExpr<T> & {
  [K in keyof T]?: null | FieldQuery<T[K]>
}

interface LogicalExpr<T> {
  $or?: QueryExpr<T>[]
  $and?: QueryExpr<T>[]
  $not?: QueryExpr<T>
}

// 某个表的约束条件
type Query<T> = QueryExpr<T> | Shorthand<Indexable> | Callback<T, boolean>
```

> `Query` 可以是：一个 `QueryExpr`，用于约束表中的字段；一个 `Shorthand`，用于约束表中的主键 (如果主键唯一)；一个 `Callback`，可以在其中使用求值表达式。

**Shorthand 简写（原文）**

> 为了简化查询操作符的书写，我们为特定类型的字段引入了一些简写形式：
> - 如果该字段的类型是**可比较类型**，那么接受一个同类型的值，相当于 `$eq` 操作符
> - 如果该字段的类型是**可索引类型**，那么接受一个数组，相当于 `$in` 操作符
> - 如果该字段的类型是**字符串**，那么接受一个正则表达式，相当于 `$regex` 操作符

```ts
type Extract<S, T, U> = S extends T ? U : never

type Shorthand<T> =
  | Extract<T, Comparable, T>
  | Extract<T, Indexable, T[]>
  | Extract<T, string, RegExp>
```

**逻辑运算**

| 操作符 | 类型（作为 `QueryExpr` 时 / 作为 `FieldExpr` 时） | 含义 |
| --- | --- | --- |
| `$or` | `QueryExpr[]` / `FieldExpr[]` | 一组约束条件的或运算 |
| `$and` | `QueryExpr[]` / `FieldExpr[]` | 一组约束条件的与运算 |
| `$not` | `QueryExpr` / `FieldExpr` | 约束条件的否定 |

**元素运算**

| 操作符 | 类型 | 含义 |
| --- | --- | --- |
| `$in` | `T[]` (`T extends Indexable`) | 判断字段的值是否在给定的数组中 |
| `$nin` | `T[]` (`T extends Indexable`) | 判断字段的值是否不在给定的数组中 |

**比较运算**

| 操作符 | 类型 | 含义 |
| --- | --- | --- |
| `$eq` | `T` (`T extends Comparable`) | 判断字段的值是否等于给定的值 |
| `$ne` | `T` (`T extends Comparable`) | 判断字段的值是否不等于给定的值 |
| `$gt` | `T` (`T extends Comparable`) | 判断字段的值是否大于给定的值 |
| `$gte` | `T` (`T extends Comparable`) | 判断字段的值是否大于或等于给定的值 |
| `$lt` | `T` (`T extends Comparable`) | 判断字段的值是否小于给定的值 |
| `$lte` | `T` (`T extends Comparable`) | 判断字段的值是否小于或等于给定的值 |

**列表运算**

| 操作符 | 类型 | 含义 |
| --- | --- | --- |
| `$el` | `FieldExpr<U>` (`T extends U[]`) | 判断列表中是否存在满足给定约束条件的元素 |
| `$size` | `number` (`T extends any[]`) | 判断列表的长度是否等于给定的值 |

> WARNING：部分数据库可能不支持使用子条件，因此请尽量只使用 `$eq` 操作符。（针对 `$el`）

**正则表达式**

| 操作符 | 类型 | 含义 |
| --- | --- | --- |
| `$regex` | `RegExp` (`T extends string`) | 判断字段的值是否匹配给定的正则表达式 |
| `$regexFor` | `string` (`T extends string`) | 将字段的值作为正则表达式，判断给定的字符串是否匹配 |

**位运算**

| 操作符 | 类型 | 含义 |
| --- | --- | --- |
| `$bitsAllSet` | `number` (`T extends number`) | 判断字段的值是否包含给定的全部位 |
| `$bitsAllClear` | `number` (`T extends number`) | 判断字段的值是否不包含给定的全部位 |
| `$bitsAnySet` | `number` (`T extends number`) | 判断字段的值是否包含给定的任意位 |
| `$bitsAnyClear` | `number` (`T extends number`) | 判断字段的值是否不包含给定的任意位 |

**⚠️ 不存在的操作符（已核实）**：官方「查询表达式」页面**没有** `$exists`、`$expr`、`$prefix`、`$elemMatch`、`$like`、`$search` 等。可用操作符就是上表列出的：`$or` `$and` `$not` `$in` `$nin` `$eq` `$ne` `$gt` `$gte` `$lt` `$lte` `$el` `$size` `$regex` `$regexFor` `$bitsAllSet` `$bitsAllClear` `$bitsAnySet` `$bitsAnyClear`。

**Callback 形式的查询（指南原文）**

```ts
import { $ } from 'koishi'

// 上述两个搜索条件的或运算
await ctx.database.get('schedule', (row) =>
  $.or(
    $.in(row.assignee, [
      '123456',
      '456789',
    ]),
    $.and(
      $.gt(row.id, 2),
      $.lte(row.id, 5),
    ),
  ),
)
```

> TIP：虽然求值表达式在形式上是一个回调函数，但是 Koishi 并不会将数据全部拉取到内存中，而是会将这个函数的行为编译成相对应的查询语句，提交给数据库运行。因此你可以放心地使用这种写法，它并不会带来额外的性能问题 (如果你遇到查询性能瓶颈，这更有可能是数据模型本身导致的，例如缺少必要的索引)。

**「引用其他字段」的正确写法（事实）**：文档中**没有** `$.field` 这种语法。引用其他字段的方式是在 `Callback` 里使用传进来的 `row` 对象，例如 `row.id`、`row.count`、`row.bar`、`row.t1.id`（join 时），它们是 `EvalExpr`；再配合 `$.add(row.a, row.b)`、`$.gt(row.id, 2)` 等运算即可让多个字段共同参与运算。

### C8. 链式写法（`ctx.database.select()` → `Selection`）

指南原文（两者等价）：

```ts
ctx.database.get('foo', { id: { $gt: 5 } })
// 等价于
ctx.database
  .select('foo')
  .where(row => $.gt(row.id, 5))
  .execute()
```

**Selection 类型与 API 原文：**

```ts
type Cell<T> = EvalExpr<T> & (T extends Comparable ? {} : Row<T>)

type Row<S> = {
  [K in keyof S]-?: Cell<NonNullable<S[K]>>
}

// 可以视为字段的回调函数。接受当前行作为参数，返回一个 EvalExpr。
type Callback<S, T> = (row: Row<S>) => EvalExpr<T>

// 一个可用字段。该类型可以是表中现有的字段名或者一个由回调函数表示的虚拟字段。
type FieldLike<S> = keyof S | Callback<S>

// 使用多个字段构造新的虚拟表。
type Project<S> = (keyof S)[] | Dict<FieldLike<S>>
```

```
### selection.where(query)           添加约束条件。返回值: Selection
### selection.orderBy(key, order?)   对结果进行排序。key: FieldLike; order: 'asc' | 'desc'
### selection.limit(count)           限制结果数量。
### selection.offset(count)          跳过指定数量的结果。
### selection.project(fields)        对结果进行投影。fields: Project
### selection.groupBy(fields, extra?) 对结果进行分组。extra: Dict<FieldLike> 向分组内添加额外的字段
### selection.execute(expr?)
-   expr: EvalExpr 用于计算的表达式
-   返回值: Promise<any>
执行查询并返回结果。如果没有传入 expr，返回的是一个包含所有结果的数组；
否则返回的是由 expr 聚合计算出的结果。
```

**排序与分页**

```ts
// 按 id 降序排列，从第 100 条开始取 10 条数据
ctx.database
  .select('foo')
  .orderBy('id', 'desc')
  .limit(10)
  .offset(100)
  .execute()
```

**求值表达式作为排序/筛选参数**

```ts
// 返回 id 大于 5 的数据行，并按 id 升序排列
ctx.database
  .select('foo')
  .where(row => $.gt(row.id, 5))
  .orderBy(row => row.id)
  .execute()
```

**字段映射 `.project()`**

```ts
// 返回的数组元素将只含有 a, b 属性
ctx.database
  .select('foo')
  .project({
    a: row => $.add(row.id, 1),         // a = id + 1
    b: row => $.multiply(row.id, 2),    // b = id * 2
  })
  .execute()
```

**聚合查询（`.execute()` 传表达式 → 返回标量而不是数组）**

```ts
// 返回 id 大于 5 的数据行的数量
ctx.database
  .select('foo')
  .where(row => $.gt(row.id, 5))
  .execute(row => $.count(row.id))
```

> 除了 `.count()` 外还有其他的一些聚合运算，例如 `$.sum()`，`$.max()` 等。聚合运算与其他求值函数的区别在于，**聚合运算的外部不能再包含 `row` 的引用**。
> 此外，只有特定方法中才能使用聚合运算，例如 `.execute()` 和 `.having()` 等。

**分组查询**

```ts
// 按照 value 字段分组，返回结果数大于 5 的分组
ctx.database
  .select('foo')
  .groupBy('value')
  .having(row => $.gt($.count(row.id), 5))
  .execute()
```

```ts
// 返回的数据将按照 id - value 的值分组
ctx.database
  .select('foo')
  .groupBy({
    key: row => $.subtract(row.id, row.value),
  })
  .execute()
```

> `.groupBy()` 可以接受一个数组，表示同时对数组中的字段进行分组。甚至也可以是一个对象，与 `.project()` 中的用法类似。
> `.having()` 中可以使用的 `row` 属性仅限于 `.groupBy()` 中的字段。

**分组时添加聚合字段**

```ts
// 返回的数据包含 value, sum, count 三个属性
ctx.database
  .select('foo')
  .groupBy('value', {
    sum: row => $.sum(row.id),
    count: row => $.count(row.id),
  })
  .execute()
```

**多级分组**

```ts
ctx.database
  .select('foo')
  .groupBy(['uid', 'pid'], {
    submit: row => $.sum(1),
    accept: row => $.sum(row.value),
  })
  .groupBy(['uid'], {
    submit: row => $.sum(row.submit),
    accept: row => $.sum($.if($.gt(row.accept, 0), 1, 0)),
  })
  .orderBy('uid')
  .execute()
```

**⚠️ 注意**：`.having()` 与 `$.if()` 出现在官方指南示例中；但 API 的 `Selection` 页面方法清单里**没有列出 `having()`**，`求值表达式 (Eval)` 页面也**没有列出 `$.if()`**。

**连接查询 [实验性]**

```ts
// 返回的数据包含 foo, bar 两个属性
ctx.database
  .join(['foo', 'bar'], (foo, bar) => $.eq(foo.id, bar.id))
  .orderBy('foo.id') // orderBy 可以使用 'a.b' 的形式
  .execute()
```

```ts
// 返回的数据包含 t1, t2 两个属性
ctx.database
  .join({ t1: 'foo', t2: 'bar' }, row => $.eq(row.t1.id, row.t2.id))
  .orderBy('t1.id') // orderBy 可以使用 'a.b' 的形式
  .execute()
```

关联类型（原文）：

```ts
type TableLike<S> = keyof S | Selection

type TableJoin<S> = (keyof S)[] | Dict<TableLike<S>>
```

> `TableJoin`：将多个表连接成新的虚拟表。该类型可以是表名数组或者一个由 `TableLike` 构成的字典。如果是表名数组，则新的表将会使用这些表名作为字段名；否则将会使用字典的键作为字段名。

### C9. 求值表达式（`$`）—— 完整清单

导入方式（原文）：

```ts
import { $ } from 'koishi'
```

类型定义（原文）：

```ts
type $Date = Date
type $RegExp = RegExp

namespace Eval {
  type Number = number | EvalExpr<number>
  type String = string | EvalExpr<string>
  type Boolean = boolean | EvalExpr<boolean>
  type Date = $Date | EvalExpr<$Date>
  type RegExp = $RegExp | EvalExpr<$RegExp>
  type Any = string | number | boolean | $Date | $RegExp | EvalExpr<any>
}
```

> 本节中使用的 `Number`, `String`, `Boolean`, `Any` 并非 JavaScript 中的内置函数，而是对应于 `number`, `string`, `boolean`, `any` 类型的求值表达式。例如，当一个表的 `foo` 字段有数值类型时，求值表达式 `$.gt(row.x, 1)` 是合法的，并且返回值的类型是 `Boolean`。

**数值运算**

| API | 参数 | 返回值 | 含义 |
| --- | --- | --- | --- |
| `$.add(...values)` | `Number[]` 待相加的值 | `EvalExpr<number>` | 将一组值相加 |
| `$.subtract(x, y)` | `Number` 被减数 / 减数 | `EvalExpr<number>` | 将两个值相减 |
| `$.multiply(...values)` | `Number[]` 待相乘的值 | `EvalExpr<number>` | 将一组值相乘 |
| `$.divide(x, y)` | `Number` 被除数 / 除数 | `EvalExpr<number>` | 将两个值相除 |

**比较运算**

| API | 参数 | 返回值 | 含义 |
| --- | --- | --- | --- |
| `$.eq(...values)` | `Any[]` 待比较的值 | `EvalExpr<boolean>` | 判断一组值是否相等 |
| `$.ne(x, y)` | `Any` / `Any` | `EvalExpr<boolean>` | 判断 `x != y` |
| `$.gt(x, y)` | `Number` / `Number` | `EvalExpr<boolean>` | 判断 `x > y` |
| `$.gte(x, y)` | `Number` / `Number` | `EvalExpr<boolean>` | 判断 `x >= y` |
| `$.lt(x, y)` | `Number` / `Number` | `EvalExpr<boolean>` | 判断 `x < y` |
| `$.lte(x, y)` | `Number` / `Number` | `EvalExpr<boolean>` | 判断 `x <= y` |

**字符串运算**

| API | 参数 | 返回值 | 含义 |
| --- | --- | --- | --- |
| `$.concat(...values)` | `String[]` 待连接的值 | `EvalExpr<string>` | 连接一组字符串 |

**布尔运算**

| API | 参数 | 返回值 | 含义 |
| --- | --- | --- | --- |
| `$.and(...values)` | `Boolean[]` | `EvalExpr<boolean>` | 将一组布尔值做与运算 |
| `$.or(...values)` | `Boolean[]` | `EvalExpr<boolean>` | 将一组布尔值做或运算 |
| `$.not(values)` | `Boolean` | `EvalExpr<boolean>` | 将一个布尔值取反 |

**聚合运算**

| API | 参数 | 返回值 | 含义 |
| --- | --- | --- | --- |
| `$.sum(x)` | `Number` 数值表达式 | `EvalExpr<number>` | 累加一组值 |
| `$.avg(x)` | `Number` 数值表达式 | `EvalExpr<number>` | 计算一组值的平均值 |
| `$.min(x)` | `Number` 数值表达式 | `EvalExpr<number>` | 计算一组值的最小值 |
| `$.max(x)` | `Number` 数值表达式 | `EvalExpr<number>` | 计算一组值的最大值 |
| `$.count(x)` | `Any` 任意表达式 | `EvalExpr<number>` | 统计不同元素的数量 |

**`ctx.database.eval()` 的用法（API 原文）**

```
### ctx.database.eval(table, expr, query?)
-   table: string 表名
-   expr: Callback 用于计算的表达式
-   query: Query 约束条件
-   返回值: Promise<any>
计算聚合表达式。
```

**`ctx.database` 上并没有 `aggregate()` 方法**；其全部实例方法是：`select`、`join`、`get`、`set`、`remove`、`create`、`upsert`、`eval`、`stats`、`drop`、`dropAll`，外加内置的 `getUser` / `setUser` / `getChannel` / `getAssignedChannels`(废弃) / `setChannel`。

---

## D. 内置数据结构

### D1. 内置表与字段（API 原文，全部照录）

```
### User
-   id: id 用户 ID
-   name: string 用户昵称
-   authority: number 权限等级
-   permissions: string[] 权限列表
-   locales: string[] 语言列表

### Binding
-   aid: id 用户 ID
-   platform: string 平台名
-   pid: string 平台账号

### Channel
-   platform: string 平台名
-   id: string 平台账号
-   assignee: string 受理人
-   permissions: string[] 权限列表
-   locales: string[] 语言列表
```

> Koishi 的数据库 API 实际上分为两部分：
> - Minato 定义的通用数据库接口，由数据库插件实现
> - Koishi 内置数据结构相关的方法，由 Koishi 提供实现

（官方内置表只文档化了 `User` / `Binding` / `Channel` 三张；没有文档化某张 `guild` 表。）

### D2. 内置实例方法（API 原文）

```
### ctx.database.getUser(platform, id, modifier?)
-   platform: string 平台名
-   id: string 用户标识符
-   modifier: QueryModifier<User.Field> 请求修饰符
-   返回值: Promise<User> 用户数据
向数据库请求用户数据。

### ctx.database.setUser(platform, id, data)
-   platform: string 平台名
-   id: string 用户标识符
-   data: User 要修改 / 添加的数据
-   返回值: Promise<void>
向数据库修改或添加用户数据。

### ctx.database.getChannel(platform, id, fields?)
-   platform: string 平台名
-   id: string 频道标识符
-   fields: QueryModifier<User.Field> 请求修饰符
-   返回值: Promise<Channel> 频道数据
向数据库请求频道数据。

### ctx.database.getAssignedChannels(fields?, platform?, assignees?) 废弃
-   fields: ChannelField[] 请求的字段，默认为全部字段
-   platform: string 平台名，默认为全平台
-   assignees: string[] 代理者列表，默认为当前运行的全部机器人
-   返回值: Promise<Channel[]> 频道数据列表
向数据库请求被特定机器人管理的所有频道数据。这里的两个参数可以写任意一个，都可以识别。

### ctx.database.setChannel(platform, id, data)
-   platform: string 平台名
-   id: number 频道标识符
-   data: Channel 要修改 / 添加的数据
-   返回值: Promise<void>
向数据库修改或添加频道数据。
```

### D3. 给玩家加「等级/经验」等自定义字段：官方给出的两种做法

**做法一：扩展内置 `user` 表**（官方示例原文）

```ts
declare module 'koishi' {
  interface User {
    msgCount: number
  }
}

ctx.model.extend('user', {
  msgCount: 'integer',
})
```

```ts
declare module 'koishi' {
  interface User {
    inventory: string[]
  }
}

ctx.model.extend('user', {
  inventory: 'list',
})
```

**做法二：自建表**（官方示例原文，`schedule` 表）

```ts
declare module 'koishi' {
  interface Tables {
    schedule: Schedule
  }
}

export interface Schedule {
  id: number
  assignee: string
  time: Date
  interval: number
  command: string
  session: Session.Payload
}

ctx.model.extend('schedule', {
  id: 'unsigned',
  assignee: 'string',
  time: 'timestamp',
  interval: 'integer',
  command: 'text',
  session: 'json',
})
```

**官方对两者取舍的原文表述**（内置数据结构章节开篇）：

> 通常来说，中间件、插件的设计可以让机器人的开发变得更加模块化，但是缺乏统一的数据流管理也带来了额外的问题。如果每个中间件分别从数据库中读取和更新自己所需的字段，那会造成大量重复的请求，导致严重的资源浪费；将所有可能请求的数据都在中间件的一开始就请求完成，也并不会解决问题，因为一条信息的解读可能只需要少数几个字段，而大部分都是不需要的；更严重的是，后一种做法将导致资源单次请求，多次更新，从而产生种种数据安全性问题。
> 针对这些问题，Koishi 提供了一套完善的数据流管理机制，它能够在保证数据安全的同时，最大化地减少数据库访问次数。

即：**扩展 `user` 表**可以复用 Koishi 的观察者（Observer）数据流管理机制；**自建表**需要自己用 `ctx.database.get/set/upsert` 做全部读写。

### D4. 观察者（Observer）机制 —— 扩展 `user` 表的完整用法

官方示例（原文，高亮行为 13-14、18-19）：

```ts
declare function getLottery(): string

// ---cut---
// 定义一个 inventory 字段，用于存放物品列表
declare module 'koishi' {
  interface User {
    inventory: string[]
  }
}

ctx.model.extend('user', {
  inventory: 'list',
})

ctx.command('lottery')
  // 声明所需字段
  .userFields(['inventory'])
  .action(({ session }) => {
    // 这里假设 inventory 是一个字符串，表示抽到的物品
    const item = getLottery()
    // 将抽到的物品存放到 user.items 中
    session.user.inventory.push(item)
    return `恭喜您获得了 ${item}！`
  })
```

> 我们都知道，写入数据库是一个异步的操作，而上面的代码看起来完全没有异步操作。然而如果你运行这段代码，你会发现用户数据被成功地更新了。这就归功于观察者机制。
> `session.user` 是一个**观察者 (Observer)** 对象，它会检测在其上面做的一切更改并缓存下来。当中间件执行完毕后，Koishi 又会自动将变化的部分进行更新，同时将缓冲区清空。我们因此得以直接在 `session.user` 上进行赋值，而不必手动调用 `ctx.database` 上的方法。

**声明所需字段**：

> `cmd.userFields()` 方法用于声明所需的用户字段。**未声明的字段将不会被加载，也无法直接被修改。**这样做的好处是，无论用户表有多少字段，我们都可以只加载所需的字段，从而提高性能。同理我们也有 `cmd.channelFields()` 方法，功能类似。

```ts
cmd.userFields((argv, fields) => {
  fields.add('inventory')
})
```

> 这两个方法不仅可以接受一个可迭代对象，还可以接受一个回调函数。第一个参数是当前的 `Argv` 对象，第二个参数是 `Set<keyof User>`，可以通过 add / delete 方法来添加或删除字段。

**阻塞式更新**：

> 观察者机制不仅可以将多次更新合并成一次以提高程序性能，更能解决数据竞争的问题。如果两条消息在临近的时间点被接收到，如果单纯地使用 get / set 进行处理，可能会发生后一次 get 在前一次 set 之前完成，导致本应获得 2 件物品，但实际只获得了 1 件的问题。而观察者会随时同步同源数据，数据安全得以保证。
> 当然，如果你确实需要阻塞式地等待数据写入，我们也提供了 `user.$update()` 方法。顺便一提，一旦成功执行了观察者的 `$update()` 方法，之前的缓冲区将会被清空，因此之后不会重复更新数据；对于缓冲区为空的观察者，`$update()` 方法也会直接返回，不会产生任何的数据库访问。
> 你可以在[这里](./../../api/utils/observer.html)看到完整的观察者 API。

**attach 事件（四个内置事件，原文）**：

> - `before-attach-channel`：在频道观察者被绑定到会话上之前触发
> - `attach-channel`：在频道观察者被绑定到会话上之后触发
> - `before-attach-user`：在用户观察者被绑定到会话上之前触发
> - `attach-user`：在用户观察者被绑定到会话上之后触发

```ts
// 定义一个 msgCount 字段，用于存放收到的信息数量
declare module 'koishi' {
  interface User {
    msgCount: number
  }
}

ctx.model.extend('user', {
  msgCount: 'integer',
})

ctx.before('attach-user', (session, fields) => {
  fields.add('msgCount')
})

ctx.middleware((session: Session<'msgCount'>, next) => {
  // 这里更新了 msgCount 数据
  session.user.msgCount++
  return next()
})
```

**手动绑定**：

```ts
declare const fields: any[]

// ---cut---
// 绑定一个用户观察者，确保 fields 中的字段都被加载
session.observeUser(fields)

// 绑定一个频道观察者，确保 fields 中的字段都被加载
session.observeChannel(fields)
```

API：

```
### session.observeUser(fields?)
观测特定的用户字段，并更新到 session.user 中。
-   fields: Iterable<User.Field>
-   返回值: Promise<User.Observed>

### session.observeChannel(fields?)
观测特定的用户字段，并更新到 session.channel 中。
-   fields: Iterable<Channel.Field>
-   返回值: Promise<Channel.Observed>
```

### D5. 通过 session 直接拿到 / 更新当前用户的内置记录

API 原文：

```
### session.user
-   类型: User
-   只能在中间件或指令内部使用
当前会话绑定的用户数据，是一个可观测对象。

WARNING
这个属性对应的是 Koishi 内置数据结构中的用户数据，而不是平台的用户数据。
如果你需要访问平台用户数据，请使用 session.event.user。

### session.channel
-   类型: Channel
-   只能在中间件或指令内部使用
当前会话绑定的频道数据，是一个可观测对象。

WARNING
这个属性对应的是 Koishi 内置数据结构中的频道数据，而不是平台的频道数据。
如果你需要访问平台频道数据，请使用 session.event.channel。
```

`session.event` 的结构（原文）：

```
会话事件数据。包含了会话中全部可以序列化的资源。含有以下属性：
-   id: number 事件 ID
-   type: string 事件类型
-   platform: string 接收者的平台名称
-   selfId: string 接收者的平台账号
-   timestamp: number 事件的时间戳
-   channel: Channel 事件所属的频道
-   guild: Guild 事件所属的群组
-   login: Login 事件的登录信息
-   member: GuildMember 事件的目标成员
-   message: Message 事件的消息
-   operator: User 事件的操作者
-   role: GuildRole 事件的目标角色
-   user: User 事件的目标用户
```

> 事件中的各属性遵循**资源提升**规则：资源对象的某个字段可以是另一个资源对象，例如消息对象中的 `user` 字段就是一个用户对象。当资源对象出现多级嵌套时，内层的资源将会被统一提升到最外层。例如，当接收到消息事件时，事件体中可以访问到 `message`, `member`, `user`, `channel` 等资源，但 `message` 中就不再存在 `member` 和 `user` 字段了。

**访问器属性全表（原文）**

| 属性 | 类型 | 完整写法 |
| --- | --- | --- |
| `session.author` | `GuildMember & User` | `{ ...session.event.user, ...session.event.member }` |
| `session.channelId` | `string` | `session.event.channel.id` |
| `session.channelName` | `string` | `session.event.channel.name` |
| `session.content` | `string` | `session.event.message.content` |
| `session.elements` | `Element[]` | `session.event.message.elements` |
| `session.guildId` | `string` | `session.event.guild.id` |
| `session.guildName` | `string` | `session.event.guild.name` |
| `session.id` | `string` | `session.event.id` |
| `session.isDirect` | `boolean` | `session.event.channel.type === Channel.Type.DIRECT` |
| `session.messageId` | `string` | `session.event.message.id` |
| `session.platform` | `string` | `session.event.platform` |
| `session.quote` | `Message` | `session.event.message.quote` |
| `session.selfId` | `string` | `session.event.selfId` |
| `session.timestamp` | `string` | `session.event.timestamp` |
| `session.type` | `string` | `session.event.type` |
| `session.userId` | `string` | `session.event.user.id` |

- `session.bot`：类型 `Bot`，当前会话绑定的机器人实例。
- `session.root`：当前会话的根上下文。
- 官方 TIP：注意到 `GuildMember` 和 `User` 有部分重叠的字段，例如 `name` 和 `avatar`。在这种情况下，`GuildMember` 的字段会覆盖 `User` 的字段。

**Session 实例方法（原文）**

```
### session.send(message)
-   message: string 要发送的内容
-   返回值: Promise<void>
在当前上下文发送消息。

### session.sendQueued(message, delay?)
-   message: string 要发送的内容
-   delay: number 与下一条消息的时间间隔，缺省时会使用 app.config.delay.queue
在当前上下文发送消息，并与下一条通过 session.sendQueued 发送的消息之间保持一定的时间间隔。

### session.cancelQueued(delay?)
取消当前正在等待发送的消息队列，并重置与下一条通过 session.sendQueued 发送的消息之间的时间间隔。

### session.prompt(timeout?)
-   timeout: number 中间件的生效时间，缺省时会使用 app.config.delay.prompt
-   返回值: Promise<string> 用户输入
等待当前会话的下一次输入并返回，如果超时则会返回 null。
无论用户输入什么，超时前的下一次输入都不会进入中间件处理流程。

### session.prompt(callback, options?)
-   callback: (session: Session) => Awaitable<T>
-   options.timeout
-   返回值: Promise<T> 回调函数返回的结果
处理当前会话的下一次输入，如果超时则会返回 undefined。
如果回调函数返回值非空，则下一次输入不会进入中间件处理流程。

### session.suggest(options)
-   options.actual: string? 目标字符串
-   options.expect: string[] 候选项列表
-   options.prefix: string? 显示在候选输入前的文本
-   options.suffix: string 当只有一个选项时，显示在候选输入后的文本
-   返回值: Promise<string>
向用户展示候选项并等待输入。

### session.execute(argv, next?)
-   argv: string | Argv 指令文本或运行时参数对象
-   next: Next 回调函数
-   返回值: Promise<void>
执行一个指令。可以传入一个 argv 对象或者指令对应的文本。
```

---

## E. 权限

### E1. 权限等级（authority）的含义与默认值

官方「深入定制机器人」原文：

> Koishi 内部有一套默认的权限系统，它为每个用户赋予了一个权限等级，遵循以下的**核心规则**：
> - **数据库中没有的用户默认拥有 0 级权限**
> - 高权限者能够执行一切低权限者的操作
>
> 在此基础上，我们还扩充出了这样的一套**设计准则**：
> - **0 级**：不存在的用户
> - **1 级**：所有用户，只能够接触有限的功能
> - **2 级**：高级用户，能够接触几乎一切机器人的功能
> - **3 级**：管理员，能够直接操作机器人事务
> - **4 级**：高级管理员，能够管理其他账号
>
> 你可以基于这套准则对指令进行权限管理，也可以用于部分计算属性的配置项中。
>
> 通过配置登录插件的方式，你可以快速拥有一个 **5 级**权限的管理员账号。

**自动注册（原文）**：

> 默认情况下，对于每一条接收到的消息，机器人都会自动向数据库中注册其用户和频道。**新注册的用户将默认获得 1 级权限**，而新注册的频道会自动以收到消息的机器人为其受理者。如果你不希望有此行为，可以在全局设置中手动配置 `autoAuthorize` 和 `autoAssign`。

> 上述两个配置项都支持计算属性，这也意味着你可以在不同的聊天环境中配置不同的行为。

**指令的默认权限（API 原文）**：

```
### ctx.command(def, desc?, config?)
-   config: CommandConfig 指令的配置
    -   checkUnknown: boolean 是否对未知选项进行检测，默认为 false
    -   checkArgCount: boolean 是否对参数个数进行检测，默认为 false
    -   authority: number 最低调用权限，默认为 1
    -   showWarning: boolean 当小于最短间隔时是否进行提醒，默认为 true
```

### E2. 指令上如何限制权限

官方「指令系统 > 指令管理 > 权限管理」原文：

> 在「名称设置」下方还有更多的配置项，我们可以在这里进一步配置指令对用户的访问权限。例如，将 echo 指令的 `authority` 设置为 `2`，那么将只有 2 级以上权限的用户才能调用该指令。
> 我们甚至还可以单独设置每一个指令选项的权限等级。例如，我们可以单独给 `-E, --unescape` 选项设置 `authority` 为 3。这样一来，只有 3 级以上权限的用户才能使用 `echo -E` 的功能。

即：**官方文档给出的限制方式是通过 `authority`**（代码里是 `ctx.command(...)` 的 `config.authority`，控制台里是指令管理页面的 `authority` 配置项），**而不是在 `.action()` 里手写检查，也不是 schema 的 role**。

`admin` 插件提供的 `authorize` 指令（原文）：

```
### 指令：authorize
-   别名：auth
-   基本语法：authorize <value> -u <user>
-   最低权限：4
authorize 指令用于设置用户的权限等级。该指令 4 级权限才能调用，且需要满足目标用户的权限和要设定的权限都严格小于自己的权限等级，否则无法设置。
```

> 任何用户只能对权限等级低于自己的用户进行操作，且操作后的权限等级同样必须低于自己。

三种指定用户的方式：

```
- @user: 通过直接 @ 人的方式指定（不能是纯文本，需要用各平台的 @ 人方式）
- @<userId>: @ 符号后面接用户名（必须是纯文本）
- @<platform>:<userId>: @ 符号后指定具体的平台和用户名（必须是纯文本）
```

```sh
authorize 3 -u @Koishi              # 通过 @ 人的方式
authorize 3 -u @123456789           # 通过指定用户名方式
authorize 3 -u @telegram:123456789    # 指定具体的平台和用户名
```

（`admin` 页面 TIP：要使用本插件，你需要安装数据库支持。`assign` 指令最低权限同样是 4，用于设置频道的受理人。）

### E3. 权限管理 API [实验性]

> WARNING：权限管理目前属于实验性功能，API 可能随时会发生变化。

权限标识符示例（原文）：

```
- user:514：ID 为 514 的用户的权限
- group:114：ID 为 114 的用户组的权限
- authority:3：权限等级 3 的权限
- command:foo：指令 foo 的权限
- command:foo:option:bar：指令 foo 选项 bar 的权限
- telegram:admin：telegram 平台下群管理员的权限
- bot:channel.mute：能够禁言频道的机器人的权限
- config:write：能够写入配置文件的权限
```

> 权限之间存在两种关系：继承和依赖。Koishi 不区分权限与权限组的概念，权限组只是继承了其他权限的权限。你可以将用户和用户组也都视为一种权限组。

**继承**：

```ts
ctx.permissions.inherit(A, B)
```

> 如果权限 A 继承了权限 B，那么拥有权限 A 的主体将被视为同时拥有权限 B。

继承链示例（原文）：

```
user:514 > authority:3 > authority:2 > command:foo
```

> 这里出现了三个继承关系：
> - `user:114 > authority:3`，因为 ID 为 514 的用户拥有权限等级 3
> - `authority:3 > authority:2`，因为权限等级 3 天生比权限等级 2 大（内置逻辑）
> - `authority:2 > command:foo`，因为指令 foo 被权限等级 2 继承

多继承示例（原文）：

```
user:514 > authority:1
         > command:foo
```

```
authority:2  >
telegram:admin > command:foo
```

> 权限继承除了不能循环外，几乎没有任何限制。因此，任何一个权限既可以被多个权限继承，也可以继承多个权限。

**依赖**：

```ts
ctx.permissions.depend(A, B)
```

> 如果权限 A 依赖了权限 B，那么要执行权限 A 的操作时必须同时检查权限 B。

```
command:foo -> command:bar
command:foo -> bot:channel.mute
```

**访问器**：

```ts
ctx.permissions.provide('telegram:admin', async (name, session) => {
  return session.telegram?.sender?.role === 'admin'
})
```

> 每个权限可以定义多个访问器函数。在运行时必须通过每一个访问器函数的检查才能视为拥有权限。

| 普通权限 | 访问器权限 |
| --- | --- |
| 手动分配给用户 (组) | 自动分配给会话 |
| 可以被其他权限继承 | 不能被其他权限继承 |

**国际化**：

> - 通过 API 定义：使用 `permission.{name}` 提供翻译文本
> - 通过指令定义：定义时提供文本 (自动视为当前用户语言)，或通过 `--locale` 指定特定语言的文本
> - 通过控制台定义：可以在控制台「用户管理」界面中配置用户组文本
>
> 访问器权限由于其不能被其他权限继承，因此不需要做国际化。

---

## F. 适配器与平台

### F1. 核心概念（原文）

> **平台 (Platform)** 是指聊天平台，比如 Discord、Telegram 等。同一平台内的用户间具有相互发送消息的能力，而不同平台的用户间则没有。对于 Rocket Chat 这一类可自建的聊天平台而言，每个独立的自建服务器都视为不同的平台。
> **机器人 (Bot)** 是指由 Koishi 操控的平台用户。这里的用户可以是真实用户，也可以是部分平台专门提供的机器人用户。其他用户通过与机器人进行交互来体验 Koishi 的各项功能。
> **适配器 (Adapter)** 是指实现了平台协议，能够让机器人接入平台的插件。通常来说一个适配器实例对应了一个机器人用户，同时启用多个适配器就实现了多个机器人的同时接入。
> **消息 (Message)** 是字面意义上的消息。通常是文本或富文本格式的，有时也会包含图片、语音等媒体资源。在 Koishi 中，消息通过消息元素进行统一编码。
> **频道 (Channel)** 是消息的集合。一个频道包含了具备时间、逻辑顺序的一系列消息。频道又分为私聊频道和群聊频道，其中私聊频道有且仅有两人参与，而群聊频道可以有任意多人参与。
> **群组 (Guild)** 是平台用户的集合。一个群组通常会同时包含一组用户和频道，并通过权限机制让其中的部分用户进行管理。在部分平台中，群组和群聊频道的概念恰好是重合的 (例如 QQ)：一个群组内有且仅有一个群聊频道。私聊频道不属于任何群组。

> 在 Koishi 中，尽管适配器要处理的逻辑随着平台的不同而变化，但本质上所有适配器的结构都是类似的：通过实现 `Bot` 类完成发送的功能，而通过实现 `Adapter` 类完成接收的功能。

### F2. QQ 平台支持的接入方式

官方适配器一览中的平台列表（原文）：

钉钉 / Discord / Kook / 飞书 / LINE / 邮件 / Matrix / **QQ** / **Satori** / Slack / Telegram / 微信公众号 / 企业微信 / WhatsApp / Zulip

**QQ 官方适配器**：`@koishijs/plugin-adapter-qq`（页面标题），描述为：

> QQ 和 QQ 频道官方机器人适配器。

接入方法（原文）：

> 1. 前往 [QQ 开放平台](https://q.qq.com) 注册账号
> 2. 登陆进入 [机器人管理后台](https://q.qq.com/#/app/bot) 并创建官方机器人
> 3. 创建完成后，在「开发设置」界面获取机器人三项基本数据 [id, token, key]
> 4. 将上面的基本数据作为机器人配置项即可使用

机器人选项（原文）：

```
### config.id      类型: string        机器人 id。
### config.key     类型: string        机器人密钥，管理端又称呼为 secret。
### config.token   类型: string        机器人 token。
### config.type    类型: 'private' | 'public'   是否为公域机器人。
### config.sandbox 类型: boolean  默认值: true   是否开启沙盒。
### config.endpoint 类型: string  默认值: 'https://api.sgroup.qq.com/'  要请求的 API 网址。
### config.authType 类型: 'bot' | 'bearer'  默认值: 'bot'  验证方式。
```

平台名称与内部接口（原文）：

> QQ 群和频道有着不同的机器人接口，因此我们提供了两套内部 API。
> **群 (含私聊)** 对应的平台名称为 `qq`：`internal.acknowledgeInteraction()`、`internal.sendFileGuild()`、`internal.sendFilePrivate()`、`internal.sendMessage()`、`internal.sendPrivateMessage()`
> **频道 (含私聊)** 对应的平台名称为 `qqguild`：`internal.addGuildMemberRole()`、`internal.createDMS()`、`internal.createGuildApiPermissionDemand()`、`internal.createGuildAnnounce()`、`internal.createGuildChannel()`、`internal.createGuildRole()`、`internal.createPinsMessage()`、`internal.createPost()`、`internal.createSchedule()`、`internal.createReaction()`、`internal.deleteChannel()`、`internal.deleteDM()`、`internal.deleteMessage()`、`internal.deleteReaction()`、`internal.getChannel()`、`internal.getChannelMemberPermissions()`、`internal.getChannelOnlineNums()`、`internal.getChannelRole()`、`internal.getChannels()`、`internal.getGuild()`、`internal.getGuildApiPermissions()`、`internal.getGuildMember()`、`internal.getGuildMembers()`、`internal.getGuildRoleMembers()`、`internal.getGuildRoles()`、`internal.getGuilds()`、`internal.getMe()`、`internal.getMessage()`、`internal.getMessageSetting()`、`internal.getPinsMessage()`、`internal.getSchedule()`、`internal.getSchedules()`、`internal.getReactions()`、`internal.getThread()`、`internal.listThreads()`、`internal.modifyChannel()`、`internal.modifyChannelMemberPermissions()`、`internal.modifyChannelRole()`、`internal.modifyGuildRole()`、`internal.modifySchedule()`、`internal.muteGuild()`、`internal.muteGuildMember()`、`internal.muteGuildMembers()`、`internal.removeGuildAnnounce()`、`internal.removeGuildMember()`、`internal.removeGuildMemberRole()`、`internal.removeGuildRole()`、`internal.removePinsMessage()`、`internal.removePost()`、`internal.removeSchedule()`、`internal.sendDM()`、`internal.sendMessage()`

**Satori 适配器**：`@koishijs/plugin-adapter-satori`（用于接入 Satori 协议的服务器）

```
### config.endpoint
-   类型: string
-   必需参数
Satori 服务器的地址。
```

> TIP：另见：@koishijs/plugin-server-satori。

**被动型平台注意（消息编码章节原文）**：

> 遗憾的是，部分平台会限制机器人的主动交互能力。例如，在 QQ (官方机器人) 中，机器人每天只能发送极少量的主动消息；而对于被动消息，则必须在用户发送消息后的短时间内回复。这种平台被称为**被动型平台**。

```ts
class QQGuildMessageEncoder {
  async flush() {
    await this.bot.internal.sendMessages(this.channelId, {
      content: this.content,
      msgId: this.options?.session?.messageId,
    })
  }
}
```

> 在这一段代码中使用了 `this.options`，它存储了一些额外的发送选项。其中 `session` 正好对应着接收到消息的会话对象。当我们调用 `session.send()` 时，Koishi 会把当前的会话对象传递给 `MessageEncoder`。这样一来，我们就可以在发送消息时带上回复目标了。

### F3. 主动发送消息的 API

**`ctx.bots`（Context API 原文）**

```
### ctx.bots
-   类型: Bot[]
当前应用的全部机器人实例。
```

**`bot.sendMessage`（Message 资源 API 原文）**

```
### bot.sendMessage(channelId, content) 内置
-   channelId: string 频道 ID
-   content: Fragment 要发送的内容
-   返回值: Promise<string[]> 发送的消息 ID
向特定频道发送消息。

WARNING
只要你能够获取到会话对象，你就不应使用此 API，而应该使用 session.send()。
一些平台会将主动发送的消息同被动接收后回复的消息区分开来，甚至可能限制主动消息的发送，
因此使用 session.send() 总是有更好的可靠性。

TIP
bot.sendMessage() 既可以发送群聊消息，也可以发送私聊消息。当发送私聊消息时，
其与 bot.sendPrivateMessage() 的区别在于前者传入的是频道 ID，而后者传入的是用户 ID。
```

```
### bot.sendPrivateMessage(userId, content, guildId?) 内置
-   userId: string 对方 ID
-   content: Fragment 要发送的内容
-   guildId: string 群组 ID
-   返回值: Promise<string[]> 发送的消息 ID
向特定用户发送私聊消息。
```

**广播**

```
### bot.broadcast(channels, content, delay?) 内置
-   channels: string[] 频道列表
-   content: string 要发送的内容
-   delay: number 发送消息间的延迟，默认值为 config.delay.broadcast
-   返回值: Promise<string[]> 成功发送的消息 ID 列表
向多个频道广播消息。如有失败不会抛出错误。
```

```
### ctx.broadcast(channels?, content) 需要数据库
-   channels: string[] 频道列表，格式为 {platform}:{channelId} (如 discord:1234567890)
-   content: string 要发送的内容
-   返回值: Promise<string[]> 成功发送的消息 ID 列表
所有机器人向自己分配的频道广播消息。如果传入的频道不存在，会输出一个警告。
```

**`Bot` 基类相关方法（Bot API 原文）**

```
### bot.dispatch(session)   触发一个会话事件。
### bot.session(event?)     创建一个新的会话实例。
### bot.online()            修改机器人的状态为在线。
### bot.offline(error?)     修改机器人的状态为离线，并记录错误信息。
```

Bot 通用 API 完整清单（官方列出）：`bot.broadcast()`、`bot.clearReaction()`、`bot.createChannel()`、`bot.createDirectChannel()`、`bot.createGuildRole()`、`bot.createReaction()`、`bot.deleteChannel()`、`bot.deleteGuildRole()`、`bot.deleteReaction()`、`bot.deleteMessage()`、`bot.editMessage()`、`bot.getChannel()`、`bot.getChannelIter()`、`bot.getChannelList()`、`bot.getFriendIter()`、`bot.getFriendList()`、`bot.getGuild()`、`bot.getGuildIter()`、`bot.getGuildList()`、`bot.getGuildMember()`、`bot.getGuildMemberIter()`、`bot.getGuildMemberList()`、`bot.getGuildRoleIter()`、`bot.getGuildRoleList()`、`bot.getLogin()`、`bot.getMessage()`、`bot.getMessageIter()`、`bot.getMessageList()`、`bot.getReactionIter()`、`bot.getReactionList()`、`bot.getUser()`、`bot.handleFriendRequest()`、`bot.handleGuildMemberRequest()`、`bot.handleGuildRequest()`、`bot.kickGuildMember()`、`bot.muteGuildMember()`、`bot.sendMessage()`、`bot.sendPrivateMessage()`、`bot.setGuildMemberRole()`、`bot.unsetGuildMemberRole()`、`bot.updateChannel()`、`bot.updateGuildRole()`

（QQ 频道相关内部接口中另有 `internal.createSchedule()` / `internal.getSchedule()` / `internal.getSchedules()` / `internal.modifySchedule()` / `internal.removeSchedule()` —— 这是 **QQ 频道平台的日程功能**，不是 Koishi 的定时推送 API。）

### F4. 定时主动推送（不依赖用户发消息触发）

Koishi 官方**没有**「定时任务」官方插件页面（本次阅读的官方插件一览中，常用功能为 Admin / Bind / Broadcast / Callme / Echo / Help / Inspect，控制台功能与开发工具各一组，没有 schedule / cron 类插件）。官方提供的是 Context 计时器服务（`api/service/timer.html`，原文）：

```
### ctx.setTimeout(callback, delay)
-   callback: Function 回调函数
-   delay: number 延迟时间 (毫秒)
-   返回值: () => void
在指定的延迟时间后执行回调函数。返回的函数可以用于取消此计时器。

### ctx.setInterval(callback, delay)
-   callback: Function 回调函数
-   delay: number 延迟时间 (毫秒)
-   返回值: () => void
在指定的延迟时间后执行回调函数，然后每隔指定的延迟时间重复执行。返回的函数可以用于取消此计时器。

### ctx.sleep(delay)
-   delay: number 延迟时间 (毫秒)
-   返回值: Promise<void>
等待指定的延迟时间。如果在此期间插件被停用，将会抛出一个错误。

### ctx.throttle(callback, delay, noTrailing?)
返回一个函数，该函数在指定的周期内最多执行一次。
具体表现为，此函数被调用后会立即执行，并在接下来的 delay 毫秒内忽略所有调用。
默认情况下，如果在最后一次实际执行后的一个延迟周期内再次调用返回的函数，则会在此延迟周期结束时再次执行 (即尾随调用)。
将 noTrailing 设置为 true 可禁用此行为。
返回函数的 dispose() 方法可用于取消此计时器。此后所有调用都将被忽略。

### ctx.debounce(callback, delay)
返回一个函数，该函数会忽略小于指定间隔的所有高频调用。
具体表现为，此函数被调用后，不会立即执行，而是会等待 delay 毫秒。如果在此期间再次调用返回的函数，则会重新计时。
直到 delay 毫秒内没有调用，此函数才会执行。
返回函数的 dispose() 方法可用于取消此计时器。此后所有调用都将被忽略。
```

`ctx` 的实例方法清单中同样列出：`ctx.setInterval`、`ctx.setTimeout`、`ctx.sleep`（`api/core/context.html`）。

即「定时主动给某个频道推送消息」所依赖的全部官方 API 组合为：`ctx.setInterval`（或 `ctx.setTimeout`）+ `ctx.broadcast(channels, content)` 或 `ctx.bots[i].sendMessage(channelId, content)` / `bot.broadcast(channels, content, delay?)`。频道标识符格式为 `{platform}:{channelId}`（`ctx.broadcast` 原文）。另外 `ctx.database.getAssignedChannels()` 可取得「被特定机器人管理的所有频道数据」，但官方标注为**废弃**。

### F5. 消息编码

会话上 `content`（字符串形式）与 `elements`（元素形式）**会自动转换**，两种写法等价：

```ts
session.content = '欢迎 <at id="1234567"/>'
```

```ts
session.elements = [
  h('text', { content: '欢迎 ' }),
  h('at', { id: '1234567' }),
]
```

接收时按平台格式解码：

```ts
session.content = input.replace(/@(\d+)/g, '<at id="$1"/>')
```

**兼容性原则（原文）**：

> Koishi 的建议是**尽量兼容实现**。对于平台不支持的元素，可以根据元素的类型和用户的配置进行转化与回退。大致可以分为两种情况：
> - 修饰型的元素可以选择只渲染内部的元素，或以适当的方式进行文本修饰。例如：在不支持粗体的平台上渲染 `<b>` 时，可以改为只渲染粗体的内容。例如：在不支持列表的平台上渲染 `<ul>` 时，可以在每个列表项前面渲染一个 `-`。
> - 占位型的元素尽量转换为可渲染的元素；如果实在无法渲染则抛出错误。例如：如果平台不支持发送网络图片，可以先将图片下载到本地再发送。例如：如果平台不支持发送语音，可以改为发送文件，或抛出错误。

**消息编码器**：

```ts
class TelegramMessageEncoder<C extends Context> extends MessageEncoder<C, TelegramBot<C>> {
  // 使用 payload 存储待发送的消息
  private payload: Dict

  // 在 prepare 中初始化 payload
  async prepare() {
    this.payload = { chat_id: this.channelId, parse_mode: 'html', text: '' }
  }

  // 将发送好的消息添加到 results 中
  async addResult(data: Telegram.Message) {
    const message = decodeMessage(data)
    this.results.push(message)
    const session = this.bot.session()
    session.event.message = message
    session.app.emit(session, 'send', session)
  }

  // 发送缓冲区内的消息
  async flush() {
    let message: Telegram.Message
    if (this.payload.text) {
      message = await this.bot.internal.sendMessage(this.payload)
    }
    await this.addResult(message)
    this.payload.text = ''
  }

  // 遍历消息元素
  async visit(element: h) {
    const { type, attrs, children } = element
    if (type === 'text') {
      this.payload.text += h.escape(attrs.content)
    } else {
      await this.render(children)
    }
  }
}
```

> 一个 `MessageEncoder` 类需要提供 `flush` 和 `visit` 两个方法。前者用于发送缓冲区内的消息，后者用于遍历消息元素。消息发送完成后，还需要触发 `send` 事件并将结果存储于 `results` 数组中。

```ts
export class TelegramBot<C extends Context> extends Bot<C, TelegramBot.Config> {
  static MessageEncoder = TelegramMessageEncoder
}
```

> 实现了 `MessageEncoder` 静态属性后，就无需手动实现 `bot.sendMessage()` 和 `bot.sendPrivateMessage()` 方法了。

行内元素分支示例（原文）：

```ts
if (type === 'text') {
  this.payload.text += h.escape(attrs.content)
} else if (['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'del'].includes(type)) {
  // 这些元素都是 Telegram 已经支持的，直接渲染成 HTML 即可
  this.payload.text += `<${type}>`
  await this.render(children)
  this.payload.text += `</${type}>`
} else if (type === 'at') {
  // 将 at 渲染为用户链接
  this.payload.text += `<a href="tg://user?id=${attrs.id}">@${attrs.name || attrs.id}</a>`
} else {
  await this.render(children)
}
```

**消息分片（原文）**：

> 在 Koishi 中，一次消息发送可能在目标平台产生多条独立的消息，称为消息分片。这也是为什么上面的 `results` 是一个数组。消息分片产生的原因是多样的：
> - 某些元素的语义就是发送独立的消息 (例如 `<message>`)
> - 部分平台不支持某些消息元素的组合 (例如图文混合发送)，此时必须对消息进行拆分
> - 待发送的消息长度超出平台限制，此时必须对消息进行拆分

```ts
// 忽略前面的部分
} else if (type === 'message') {
  // 在解析内部元素之前先清空缓冲区
  await this.flush()
  await this.render(children)
  await this.flush()
} else ...
```

**资源元素**：`http.file()` 可自动处理 `http:` / `file:` / `data:` 等各种协议的资源链接并统一转换为 `ArrayBuffer`。

**平台集成（`guide/adapter/integration.html` 原文）**：
- 斜线指令：适配器可通过 `bot.updateCommands(commands)` 把 Koishi 指令注册为平台斜线指令。
- 用户语言偏好：适配器设置 `session.locales` 即可。

```ts
class DiscordBot {
  async updateCommands(commands: Universal.Command[]) {
    // 这里忽略了部分细节，仅供参考
    const updates = commands.map(Discord.encodeCommand)
    await this.internal.bulkOverwriteGlobalApplicationCommands(this.selfId, updates)
  }
}
```

```ts
if (from.language_code) {
  // 这里为了简化逻辑，只取语言码的前两位
  session.locales = [from.language_code.slice(0, 2)]
}
```

**访问内部接口（`guide/adapter/bot.html` 原文）**：

```ts
// 这一行写在文件头
import type { DiscordBot } from '@koishijs/plugin-adapter-discord'

(bot as DiscordBot).internal.getGuild(guildId)
```

```ts
// 这一行写在文件头
import {} from '@koishijs/plugin-adapter-discord'

if (session.discord) {
  session.discord.getGuild(guildId)     // 内部接口
  session.discord.t                     // 原始事件名称
  session.discord.d                     // 原始事件数据
} else {
  // 其他平台的处理
}
```

---

## G. 常见坑与注意事项（全部基于上述原文）

1. **`ctx.database` 不是内置服务**：插件必须 `export const inject = ['database']`；否则拿不到服务。官方还说明数据库服务要等应用启动完成才可访问，不能在插件顶层同步判断其存在。
2. **数据模型必须在「使用前」扩展完成**：官方原文「数据模型的扩展一定要在使用前完成，不然后续数据库操作可能会失败」——`ctx.model.extend()` 要放在插件 apply 的早期/顶层，不能等第一次查询时才扩展。
3. **改了字段名不会自动迁移数据**：官方明确「数据仍然会停留在旧的字段中，它们实质上已经丢失了，却仍然占据的数据库的空间」。改名必须用 `legacy: ['旧名', ...]`；重构结构必须用 `ctx.model.migrate()`（实验性，性能较差，官方建议「谨慎设计数据库结构而不是依赖迁移」）。
4. **没有 `index` 参数**：`Table.Meta` 只有 `primary` / `unique` / `foreign`(实验性) / `autoInc`。性能瓶颈时官方的说法是「这更有可能是数据模型本身导致的，例如缺少必要的索引」——但文档没有给出声明普通索引的 API。
5. **`primary` 默认为 `'id'`，且主键决定简写查询语义**：`get(table, 1234)`、`get(table, [1234, 5678])`、`remove(table, [id])` 都是主键简写；`upsert` 默认按主键索引，非主键/复合键必须传第三个参数 `keys`（如 `'telegram'`、`['platform', 'id']`）。
6. **`autoInc` 必须显式声明**：`autoInc: true` 才会使用自增主键；`create()` 返回「经过填充后的数据 (包括自动填充的 id 和默认属性等)」。
7. **`create` vs `upsert` 的冲突行为**：`create` 若数据已存在会**报错**；`upsert` 若存在则**执行修改**。`create` 只能插一条且返回填充后的数据；`upsert` 可批量。
8. **`set` 不会插入**：数据不存在时「不会进行任何操作」，必须用 `result.matched` 判断（官方示例就是这么写的）。
9. **`upsert` 的返回值文档自相矛盾**：指南对比表说「没有返回值」，API 页说返回 `Promise<WriteResult>`（含 `inserted` / `matched`）。写代码时不要假定一定没有返回值。
10. **`upsert` 只覆盖出现的键**：官方原文「修改时只会用每一行中出现的键进行覆盖，不会影响未定义的字段」；未出现的字段「则会使用默认值」（该句针对**插入新行**时；对既有行的行为见官方表格第 1 行「只更新了 foo 字段」）。
11. **`WriteResult.matched` 是「匹配行数」不是「被修改的行数」**：官方特别提醒「注意不是修改的函数（行数）」。
12. **并发安全 / 读改写竞态**：官方明确用 get + set 的朴素写法会有竞态——「可能会发生后一次 get 在前一次 set 之前完成，导致本应获得 2 件物品，但实际只获得了 1 件的问题」。两条官方解法：① 用观察者（`session.user`）自动合并更新；② 用 `set(table, query, row => ({ x: $.add(row.x, 1) }))` 这类**求值表达式做原子自增**（配合 `$gte` 条件与 `matched` 检查，即官方的扣余额示例）。需要阻塞写入时用 `user.$update()`。
13. **观察者字段必须先声明**：`session.user` 上「未声明的字段将不会被加载，也无法直接被修改」。声明方式：`cmd.userFields([...])` / `cmd.userFields((argv, fields) => fields.add(...))` / `cmd.channelFields()` / `ctx.before('attach-user', (session, fields) => fields.add(...))` / `session.observeUser(fields)`。
14. **`session.user` ≠ 平台用户数据**：`session.user` 是 Koishi 内置 `user` 表记录（可观测对象，只能在中间件或指令内部使用）；平台原始数据在 `session.event.user`，频道同理（`session.channel` vs `session.event.channel`）。类型合并时注意：扩展内置用户字段要写 `interface User`，扩展自建表要写 `interface Tables`。
15. **时间/日期类型默认值是 `null`**：`date` / `time` / `timestamp` 三种类型的 TS 类型都是 `Date`、默认初始值都是 `null`。官方文档没有说明时区处理或字符串↔Date 的自动转换规则；文档中构造时间统一使用 `new Date()`（见 `set` 示例）。可用的时间来源：`session.event.timestamp`（`number` 事件的时间戳）、`session.timestamp`（访问器，类型标注为 `string`，完整写法 `session.event.timestamp`）。
16. **`json` 与嵌套字段的取舍**：官方原文——`json` 类型「适用于对象内部属性不固定的情况」；为每个属性单独声明嵌套类型「在查询时更加高效」。嵌套字段用点号字符串声明（`'foo.bar': 'string'`），「在查询时 `foo` 都会被视为一个独立的字段」。
17. **字符串长度的隐式默认**：`string` 默认 255 字节，`char` 默认 64，`text` 默认 65535；「当你直接使用 `string` 作为类型时，其默认字节长度为 255」。超长文本（长 JSON、长日志、序列化数据）必须用 `text` 或显式 `length`。`list` 是 `string[]`，「序列化时以逗号分隔」——即**元素内不能含逗号**。
18. **`$el` 的兼容性坑**：官方 WARNING「部分数据库可能不支持使用子条件，因此请尽量只使用 `$eq` 操作符。」
19. **聚合运算的限制**：聚合表达式「外部不能再包含 `row` 的引用」；「只有特定方法中才能使用聚合运算，例如 `.execute()` 和 `.having()` 等」。`.having()` 中可用的 `row` 属性「仅限于 `.groupBy()` 中的字段」。
20. **文档与 API 的落差（写代码前必须核实）**：`$exists` / `$prefix` / `$expr` 在官方查询表达式页面**不存在**；`.having()` 与 `$.if()` 只在指南示例中出现，未列在对应 API 页面；`'boolean'` 字段类型在官方迁移示例中使用，但不在类型表中；`ctx.database.aggregate()` 不存在（用 `ctx.database.eval()` 或 `Selection.execute(expr)`）。
21. **实验性 API 清单**（官方标注）：权限管理整体实验性；`ctx.model.migrate()` 实验性；嵌套字段实验性；声明索引实验性；`ctx.database.join()` 实验性；`ctx.database.stats()` 实验性。
22. **危险操作**：`ctx.database.drop(table)` / `ctx.database.dropAll()` 官方标 DANGER，删表无法恢复；重构结构官方推荐用整表迁移保护用户数据。
23. **QQ 官方机器人是「被动型平台」**：官方原文「机器人每天只能发送极少量的主动消息；而对于被动消息，则必须在用户发送消息后的短时间内回复」。因此主动推送要考虑该限制。`bot.sendMessage()` 页面也有官方 WARNING：能拿到会话对象时不应使用此 API，而应用 `session.send()`。
24. **QQ 有 `qq` 与 `qqguild` 两套平台名和两套内部接口**：`internal.sendMessage()` 在两边都存在，但方法集合完全不同；`qq` 只有 5 个内部方法。
25. **`ctx.broadcast` 的频道格式是 `{platform}:{channelId}`**（如 `discord:1234567890`），且官方标注「需要数据库」；`getAssignedChannels` 已废弃。
26. **权限默认值容易踩**：数据库中没有的用户默认 0 级；被自动注册的新用户默认 1 级；`ctx.command` 的 `authority` 默认是 1；`authorize` 需要 4 级且只能操作严格低于自己的等级。过滤器（Filter）可以替代权限管理来做「只允许某些群使用」，官方明确「少数插件与聊天平台无关，例如控制台、数据库插件等。这些插件也因此没有过滤器设置」。
27. **控制台里改配置的原则**：官方 WARNING「如无必要，勿动配置……随意改动插件配置、删除预装插件都可能导致 Koishi 无法正常运行。」；未填必选项会在左侧呈现红色提示条，「只有正确填写配置才能启动插件」。
28. **文档未覆盖的内容（不要凭空臆造）**：本次阅读的全部页面中，**没有**任何关于「玩家离线期间的时间流逝 / 离线结算」的官方做法、**没有** `ctx.database.aggregate()`、**没有** `$exists` 类操作符、**没有**「Koishi 自带默认数据库」的表述、**没有**官方定时任务插件的文档页面（cron 类属于社区插件，见并行笔记 `koishi-官方文档技术笔记.md`）、**没有**在 `.action()` 内做权限检查的官方 API。
