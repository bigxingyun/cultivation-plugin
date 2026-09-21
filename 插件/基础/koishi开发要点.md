# Koishi 开发要点（本项目的框架依据）

> **本文用途**：给"修仙挂机插件"的实现者提供**经过核实的 Koishi API 事实**。
> **取材**：Koishi 官方开发指南与 API 参考（`koishi.chat/zh-CN/`），逐字核对，**不凭印象补写**。
> **核对环境**：Node.js v24.20.0 / npm 11.19.0 / git 2.49.0（Windows 11）。官方 API 会随版本变化，动手前请以官方当前文档为准。
> **权威级别**：本文是**框架 API 参考**。游戏数值以《开发游戏设定.md》为准；本文只回答"Koishi 怎么写"。

---

## 〇、先读这一节：不存在的 API

新对话最容易犯的错是**臆造 Koishi API**。下面每一条都是被核查过的"**不存在**"，写代码前请先扫一遍：

| ❌ 不存在 / 已过时 | ✅ 正确写法 |
| --- | --- |
| `export const schema` | **`export const Config: Schema<Config> = Schema.object({...})`**（大写 `C`）。`schema` 是 Koishi 3 的写法 |
| 参数类型 `boolean` / `guild` / `member` | 内置类型只有 11 种，见 §4.3 |
| `cmd.shortcut()` | Koishi **v1** 的 API，当前版本无此方法 |
| `session.reply()` | 当前 Session API **没有** `reply`。引用回复用 `<quote id={...}/>` 或 `session.quote` |
| 事件名 `before-command` / `connect` / `disconnect` | 应为 `command/before-execute`、`login-added` / `login-removed` |
| 注册自定义参数类型的 API（`.type()` / `ctx.parser`） | **没有**。只有**选项**支持 `config.type` |
| `$exists` / `$prefix` / `$expr` 查询操作符 | 不存在，见 §6.3 |
| `ctx.database.aggregate()` | 不存在。聚合用 `ctx.database.eval()` 或 `Selection.execute(expr)` |
| `ctx.model.extend()` 的 `index` 参数 | `Table.Meta` 只有 `primary` / `unique` / `foreign` / `autoInc` |
| `ctx.database.set()` 能插入 | **不能**。不存在则什么都不做；插入用 `create` 或 `upsert` |
| `if (!ctx.database) return` 检查服务 | ❌ 官方反例。用 `inject` 声明依赖 |
| 核心自带 cron / 定时任务 | 核心只有 `ctx.setTimeout/setInterval/sleep/throttle/debounce`。cron 是**社区插件** `koishi-plugin-cron` |
| 官方自带默认数据库 | 没有这种表述。需从 5 个官方驱动里选一个，见 §6.1 |

---

## 一、环境与工程

### 1.1 前置环境

| 项 | 要求 |
| --- | --- |
| Node.js | **最低 v18，推荐 LTS**。本机实测 v24.20.0 可用 |
| 包管理器 | npm / yarn 均可。官方文档默认给出 npm 命令 |
| git | 强烈建议（可回退、可协作） |

> **一条取材纪律**：`koishi.chat` 的文档站只渲染当前选中的包管理器标签页，**yarn 变体命令无法逐字取得**。本文只写**已取证的 npm 形式**。若你确实要用 yarn，请自行到官方页面切换标签页核对，**不要照 npm 命令猜**。
>
> 另：`github.com` / `raw.githubusercontent.com` 在本会话被 DNS 拒绝，官方模板脚手架的 Markdown 源无法读取。本文所有命令均来自 `koishi.chat` 正文，**没有**从脚手架源码推测的内容。

### 1.2 创建项目

```sh
npm init koishi@latest
```

官方 TIP：项目目录**不宜过长，且路径中避免中文或空格**。推荐 `C:\dev` 或 `D:\dev`（不要直接建在盘根）。

### 1.3 应用目录与环境变量

配置文件 `koishi.yml` 所在目录即**应用目录**，所有命令都在该目录下运行。

支持环境变量插值：

```yaml
plugins:
  adapter-discord:
    token: ${{ env.DISCORD_TOKEN }}
```

原生支持 dotenv：在应用目录建 `.env.local`（已在 `.gitignore` 中）即可。

### 1.4 创建工作区插件

```sh
npm run setup [name] -- [-c] [-m] [-G]
```

| 参数 | 含义 |
| --- | --- |
| `name` | 插件包名，缺省时会提问 |
| `-c, --console` | 创建带控制台扩展的插件 |
| `-m, --monorepo` | 创建 monorepo 的插件 |
| `-G, --no-git` | 跳过 git 初始化 |

**插件目录是 `external/<name>/`**（官方「发布插件」页写成 `plugins/`，是与「工作区开发」页不同步的旧写法——**以 `external/` 为准**）。

创建后的结构：

```
root
├── external
│   └── <name>
│       ├── src
│       │   └── index.ts
│       └── package.json
├── koishi.yml
└── package.json
```

### 1.5 安装依赖

```sh
npm install [...deps] -w koishi-plugin-[name]
```

- 加 `-D` 装 `devDependencies`，加 `-P` 装 `peerDependencies`。
- 批量按声明的版本范围更新依赖：`npm run dep`。

### 1.6 启动与构建

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development koishi start -r esbuild-register -r yml-register",
    "start": "koishi start"
  }
}
```

```sh
npm run start          # 生产启动
npm run dev            # 开发模式（-r esbuild-register 允许直接跑 TS 源码）
npm run build [...name]  # 构建；缺省构建全部插件
```

- `-r esbuild-register` 让**工作区插件的 TypeScript 源码在运行时直接可用**，所以开发期**不需要先编译**。
- **生产模式或发布前必须 `npm run build`**。
- HMR：内置插件 `@koishijs/plugin-hmr` 提供插件级热替换，可在 `koishi.yml` 里配 `hmr: { root, ignore }`。

### 1.7 一个完整插件的样子（官方原文）

```ts
import { Context, Schema } from 'koishi'

export const name = 'example'
export const usage = '这是一个示例插件。'

export interface Config {
  foo: string
  bar?: number
}

export const Config: Schema<Config> = Schema.object({
  foo: Schema.string().required(),
  bar: Schema.number().default(1),
})

export function apply(ctx: Context, config: Config) {
  ctx.command('config').action(() => {
    return `foo: ${config.foo}\nbar: ${config.bar}`
  })
}
```

---

## 二、插件骨架与生命周期

### 2.1 具名导出（"元属性"）总表

**官方文档中实际出现过的全部具名导出**，只有这些：

| 导出 | 形态 | 用途 |
| --- | --- | --- |
| `apply` | `export function apply(ctx: Context, config: Config) {}` | 插件入口。第一个参数是**所在上下文**，第二个是配置项 |
| `name` | `export const name = 'example'` | 插件名称。**只用于描述与插件关系可视化，不影响运行时行为** |
| `Config` | `export const Config: Schema<Config> = Schema.object({})` | 声明配置构型 |
| `usage` | `export const usage = '...'` | 在控制台展示使用方法 |
| `reusable` | `export const reusable = true` | 声明可重用（可被多次 `ctx.plugin()`） |
| `inject` | `export const inject = ['database']` | 声明服务依赖，数组或对象形式 |
| `using` | `ctx.plugin({ using: ['console'], apply: ... })` | `ctx.inject()` 的等价写法 |
| `filter` | （文档仅提及，未给示例） | 过滤器 |

> 元属性必须与入口函数**同级导出**。

### 2.2 函数式 vs 类插件

**函数式**（推荐，本项目用这种）：

```ts
import { Context, Schema } from 'koishi'

export const name = 'xianxia-idle'
export const inject = ['database']

export interface Config {
  prefix?: string
}

export const Config: Schema<Config> = Schema.object({
  prefix: Schema.string().default(''),
})

export function apply(ctx: Context, config: Config) {
  // 注册指令、事件、监听生命周期
}
```

**类插件**（默认导出，`Config` 放同名 `namespace`）：

```ts
class Example {
  constructor(ctx: Context, config: Example.Config) {
    // 插件实现
  }
}

namespace Example {
  export interface Config {}

  export const Config: Schema<Config> = Schema.object({})
}

export default Example
```

类的 `reusable` 写在 static 上：

```ts
export default class Bar {
  static reusable = true
  constructor(ctx: Context) {}
}
```

> ⚠️ **默认导出优先级陷阱**：如果一个模块既有默认导出又有具名导出，**默认导出优先**（官方列为最容易翻车的坑之一）。本项目统一用**纯具名导出、不用默认导出**，避免这个问题。

### 2.3 `ctx` 是什么

官方原文：

> 上下文描述了机器人的一种可能的运行环境，而插件则是在这个环境中运行的。**每个插件的上下文互不相同，这才保证了插件的副作用可以被有效地回收。**

所以：**你在 `ctx` 上注册的一切（指令、事件、定时器、中间件）都会随插件卸载自动回收**。这也意味着**不要**把注册行为写到 `ctx` 之外。

`ctx` 上的常用成员：`ctx.on()`、`ctx.middleware()`、`ctx.command()`、`ctx.plugin()`、`ctx.inject()`、`ctx.setInterval()`、以及服务属性 `ctx.database` / `ctx.model` 等。

### 2.4 生命周期事件（权威清单）

官方 API 参考「生命周期事件」共 **7 个**，且**"在全体上下文触发（上下文选择器对这些事件无效）"**：

| 事件 | 参数 | 触发方式 | 时机 |
| --- | --- | --- | --- |
| `ready` | — | `parallel` | 应用启动时；若加载时应用已启动则**立即触发** |
| `dispose` | — | `parallel` | 插件被卸载时 |
| `service` | `name: string` | `emit` | 有服务被修改时 |
| `model` | `name: string` | `emit` | 调用 `model.extend()` 时 |
| `login-added` | `bot: Bot` | `emit` | 添加机器人时 |
| `login-removed` | `bot: Bot` | `emit` | 移除机器人时 |
| `login-updated` | `bot: Bot` | `emit` | 机器人状态改变时 |

- **没有 `before-*` 形式的生命周期事件**。`before-parse` / `before-send` / `command/before-execute` 属于**内置会话事件**，是另一类。
- `fork` 只在「生命周期」页讲，**不在** API 的「生命周期事件」清单里。

**`ready` 的适用场景**（官方）：含有异步操作（文件、网络请求等）需要在应用启动后执行的初始化。

### 2.5 ⚠️ `dispose` 不保证执行 —— 本项目头号风险

官方原文 WARNING：

> 请注意，**`dispose` 事件的目的是清理副作用而不是确保数据保存**。当 Koishi 进程崩溃或是被强行中止时，`dispose` 事件都可能不会触发。**为了保护你的数据，你应当在每一次修改后立即上传数据，而不是在 `dispose` 中处理收尾工作。**

**对本项目的直接后果**：

| ❌ 绝不能这样 | ✅ 必须这样 |
| --- | --- |
| 闭关收益累积在内存里，退出时统一写库 | **每次收益结算后立即 `set`/`upsert` 写库** |
| 用内存变量记录"今日已历练次数" | 存到数据库字段，按时间戳判断重置 |
| 靠 `dispose` 保存玩家进度 | `dispose` **只**用于清理定时器、注销外部资源 |

这条与《开发游戏设定.md》原则 8「不惩罚离线」是同一件事的两面：**离线不亏的前提是数据已经落库**。

### 2.6 资源清理约定

官方原文：

> 绝大部分 `ctx` 方法都会在插件被停用自动回收副作用；然而，如果你使用了 `ctx` 之外的方法……就需要通过 `dispose` 事件来手动清除它们。

- `ctx.on()` / `ctx.once()` **都返回 dispose 函数**，因此不必刻意用 `ctx.once()` + `ctx.off()` 配对。
- `ctx.middleware(callback)` **返回 dispose 函数**。
- `ctx.setInterval(callback, delay)` **返回可用于取消计时器的函数**。
- **挂在插件 `ctx` 上的注册会自动回收**；只有 `ctx` 之外的资源（文件句柄、外部连接、自己 `new` 的定时器）才需要写 `dispose`。
- ⚠️ 本项目若使用 `ctx.setInterval` 做任何后台心跳，**必须在 `ctx.on('dispose')` 里清理**，否则 HMR 反复重载会累积定时器。**但注意**：清理定时器 ≠ 保存数据（见 §2.5）。

**停用插件**：`ctx.plugin()` 返回 `Fork`；`fork.dispose()` 取消该次加载的全部副作用。可重用插件要全部清掉需用 `ctx.registry.delete(plugin)`。

### 2.7 可重用性

- **默认不可重用**：第二次 `ctx.plugin(callback)` 直接返回旧 `Fork`，**不重复执行**。
- 声明可重用：`export const reusable = true`。
- 共享状态用 `fork` 事件。官方说明：**外侧代码只执行一次（不可重用部分），内侧执行多次（可重用部分）**，且**内外两个 `ctx` 含义不同**。
- `reusable` 只是 `fork` 的语法糖。

> 👉 **本项目不需要可重用**（一个群服一份全局状态），所以**不要**声明 `reusable`。

---

## 三、配置构型 Schema

### 3.1 基本形态

```ts
import { Context, Schema } from 'koishi'

export interface Config {
  quotaBase: number
  enablePush: boolean
}

export const Config: Schema<Config> = Schema.object({
  quotaBase: Schema.number().default(3),
  enablePush: Schema.boolean().default(false).description('是否开启主动推送（QQ 平台建议关闭）'),
})
```

### 3.2 可用工厂方法

站点确认存在的工厂：

`object`、`string`、`number`、`boolean`、`date`、`bitset`、`array`、`dict`、`tuple`、`union`、`intersect`、`const`、`path`、`percent`、`transform`、`computed`

**大写简写自带 `.required()`**：

```ts
Schema.String   // === Schema.string().required()
Schema.Number   // === Schema.number().required()
Schema.Boolean  // === Schema.boolean().required()
```

- `Schema.union(['foo', 'bar', 'qux'])` 中每个字符串是 `Schema.const()` 的简写。
- `Schema.const()` **可无参**（表示 unset）。

### 3.3 链式修饰方法（完整清单）

| 方法 | 说明 |
| --- | --- |
| `.required()` | 必填 |
| `.default(v)` | 默认值 |
| `.description(text)` | 描述；支持行内 Markdown |
| `.disabled()` | 禁用 |
| `.hidden()` | 隐藏 |
| `.deprecated()` | 标记废弃 |
| `.experimental()` | 标记实验性 |
| `.role(name, options?)` | 特殊呈现控件，见 §3.5 |
| `.min(n)` / `.max(n)` | 数值范围 |
| `.step(n)` | 步长 |
| `.pattern(regexp)` | 正则校验 |
| `.collapse()` | **默认折叠该分组**——⚠️ **不接收任何参数** |

> ⚠️ **`.required()` 与 `.default()` 不能同时使用**（官方 WARNING）。
> ⛔ **`.comment()` 不存在**——在 Schema 全部 24 页中已核实。想要注释请用 `.description()`。

### 3.4 配置分组（本项目会用）

用 `Schema.intersect([...])` 把配置分成几块，每块用 `.description()` 命名：

```ts
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    quotaBase: Schema.number().default(3),
  }).description('历练设置'),

  Schema.object({
    enablePush: Schema.boolean().default(false),
  }).description('推送设置').collapse(),
])
```

- `.description()` 在属性上显示于名称下方，在对象上表现为**小标题**。
- `.collapse()` 让分组默认折叠。

### 3.5 `.role()` 的合法取值

| 类型 | 合法值 |
| --- | --- |
| Number | `''` \| `'slider'` |
| String | `''` \| `'secret'` \| `'link'` \| `'textarea'` \| `'color'` \| `'datetime'` \| `'date'` \| `'time'`（`textarea` 可配 `{ rows: [2, 4] }`） |
| Union | `''` \| `'radio'` |
| Array | `'table'` \| `'checkbox'` \| `'select'` |
| Dict | `'table'` |
| Bitset | `'checkbox'` \| `'select'` |
| Boolean / Object / Intersect / Tuple / Path | 官方未给 |

### 3.6 条件配置（按选项显示不同字段）

官方示例（`union-tagged-2` 原文）：

```ts
export default Schema.intersect([
  Schema.object({
    shared: Schema.string(),
    type: Schema.union(['foo', 'bar']).required(),
  }).description('基础配置'),

  Schema.union([
    Schema.object({
      type: Schema.const('foo').required(),
      value: Schema.number().default(114514),
    }).description('特殊配置 1'),
    Schema.object({
      type: Schema.const('bar').required(),
      text: Schema.string(),
    }).description('特殊配置 2'),
  ]),
])
```

> 官方 TIP：下方 `type` 若与上方默认值类型不同，**必须加 `.required()`**。

---

## 四、指令系统

### 4.1 签名

```ts
ctx.command(def: string, desc?: string, config?: CommandConfig): Command
```

`CommandConfig`：

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| `checkUnknown` | `false` | 是否严格校验未知选项 |
| `checkArgCount` | `false` | 是否严格校验参数个数 |
| `authority` | `1` | 指令所需权限等级 |
| `showWarning` | `true` | 是否显示警告 |

### 4.2 参数定义语法

| 写法 | 含义 |
| --- | --- |
| `<name>` | **必选**参数 |
| `[name]` | **可选**参数 |
| `[...rest]` | 变长参数（前置 `...`） |
| `<message:text>` | `text` 类型参数，**贪婪匹配**，吃掉后面所有内容 |

```ts
ctx.command('test <arg1> [arg2] [arg3]').action((_, arg1, arg2, arg3) => {})
ctx.command('test <arg1> [...rest]').action((_, arg1, ...rest) => {})
ctx.command('test <message:text>').action((_, message) => {})
```

**行为规则（官方）**：

- 参数按顺序作为 action 的第 2..n 个参数传入；**默认永远是字符串**；不足时传 `undefined`（需自行处理）。
- 多余参数被**忽略**。
- 必选参数必须写在可选参数之前。
- 定长参数不能含空白；含空格要用引号：`help "foo bar"`。
- **`:text` 的解析优先级很高，会吞掉后面的选项**：

> 官方 TIP 原文：文本参数的解析优先级很高，即使是之后的内容中含有选项也会被一并认为是该参数的一部分。因此，当使用文本参数时，应确保选项写在该参数之前，或使用引号将要输入的文本包裹起来。

👉 **对本项目的意义**：像「历练 战斗」这种多词参数，若用 `<message:text>` 就要把选项写在前面。游戏指令的档位/目的这类**单字参数**建议用 `<name>` 而非 `<message:text>`。

### 4.3 内置参数类型（官方完整列表，共 11 种）

| 类型 | 解析结果 |
| --- | --- |
| `string` | 字符串 |
| `number` | 数值 |
| `bigint` | 大整数 |
| `text` | 贪婪匹配字符串 |
| `user` | `{platform}:{id}`，可用 `at` 元素或 `@{platform}:{id}` 传入 |
| `channel` | `{platform}:{id}`，可用 `sharp` 元素或 `#{platform}:{id}` 传入 |
| `integer` | 整数 |
| `posint` | 正整数 |
| `natural` | 自然数（含 0 的正整数） |
| `date` | `Date` 对象 |
| `image` | `Dict` |

校验失败文案：`参数 arg 输入无效，请提供一个数字。`

> ❌ **没有** `boolean` / `guild` / `member` 类型。需要布尔语义时，用选项（`.option('force', '-f')`）或自己解析字符串。

### 4.4 选项

```ts
ctx.command('test')
  .option('alpha', '-a')            // 无参选项，默认 true
  .option('beta', '-b [beta]')      // 带参数的可选选项
  .option('gamma', '-c <gamma>')    // 带参数的必选选项
  .option('writer', '-w <id>').option('writer', '--anonymous', { value: 0 })
  .option('alpha', '-a', { fallback: 100 })
  .option('beta', '-b <value>', { type: /^ba+r$/ })
  .action(({ options }) => JSON.stringify(options))
```

`OptionConfig`：

| 字段 | 含义 |
| --- | --- |
| `fallback` | 默认值 |
| `value` | 重载值 |
| `type` | `string \| RegExp \| ((source: string) => any)` |
| `hidden` | 是否在帮助中隐藏 |
| `notUsage` | 是否计入调用统计 |
| `authority` | 选项级权限 |

> **没有 `required` 字段**——必选/可选由声明串里的 `<...>` / `[...]` 表达。

官方解析特性：

- 选项可用空格或 `=` 分隔。
- `-adb` 把值给**最后一个字母**。
- 多字母短横线自动转驼峰：`--foo-bar` → `fooBar`。
- 无参选项默认 `true`；能转数字的转数字。
- **支持识别未注册选项**并推测是否需要参数；未注册选项以 `no-` 开头则去前缀并置 `false`。
- 例：`test -adb text --gamma=1 --foo-bar baz --no-xyz` → `{ "alpha": true, "d": true, "beta": "text", "gamma": 1, "fooBar": "baz", "xyz": false }`

校验失败文案：`选项 beta 输入无效，请检查语法。`

### 4.5 其他指令方法

| 方法 | 要点 |
| --- | --- |
| `.usage(text)` | 多次调用**只保留最后一次** |
| `.example(example)` | 多次调用**会累加** |
| `.action(fn, prepend?)` | `type CommandAction = (argv: Argv, ...args: any[]) => Awaitable<string \| void>` |
| `.before(fn, append?)` | 执行前检测函数 |
| `.alias(name, config?)` | config 可带 `{ args, options }`。⚠️ 多插件注册同别名时**后加载的插件会直接加载失败** |
| `.userFields(fields)` / `.channelFields(fields)` | 声明要观察的数据库字段，见 §6.6 |
| `.removeOption(name)` | 删任一别名即删整个选项 |
| `.parse(input)` / `.execute(argv, next?)` | |
| `.dispose()` | |
| `.subcommand(name, desc?, config?)` | |

描述可以写在第一参后面，也可以用带描述的写法：

```ts
ctx.command('echo <message:text> 输出收到的信息')
  .option('timeout', '-t <seconds> 设定延迟发送的时间')
```

### 4.6 子指令

```ts
ctx.command('foo/bar')                 // 层级式
ctx.command('foo.bar')                 // 派生式
ctx.command('foo').subcommand('bar')
ctx.command('foo').subcommand('.bar')
```

- 层级式 `foo/bar`：**出现一个空格**。
- 派生式 `foo.bar`：**出现一个小数点**；父指令无功能时可用空格代替小数点（`user locale zh` ≡ `user.locale zh`）。
- 子指令**不进全局 help 列表**，只显示在父指令帮助中。

### 4.7 `Argv` 对象

官方 API 只有 **4 个属性**：

| 属性 | 含义 |
| --- | --- |
| `args` | 参数列表 |
| `options` | 选项列表 |
| `next` | 中间件的 next 回调 |
| `session` | 会话对象 |

> ❌ **没有 `argv.name`**。

两种取参写法：

```ts
ctx.command('foo <a> <b>').action((_, a, b) => { /* ... */ })
ctx.command('foo <a>').action(({ options, session }, a) => { /* ... */ })
```

### 4.8 执行前检查与拦截

三种手段：

1. `cmd.before(action, append?)` —— 为指令添加检测函数。
2. 事件 `command/before-execute`（`serial`）—— 官方原文：可"通过在回调函数中返回一个字符串以取消该指令的执行。进一步，如果该字符串非空，则会作为此指令执行的结果"。
3. 事件 `command`（`parallel`）—— 指令调用完毕后触发。

**权限**用 `config.authority`（默认 1）声明，或走控制台「指令管理」，**不是**在 `.action()` 里自己 `if`。详见 §7。

---

## 五、会话、消息与事件

### 5.1 `Session` 属性

| 属性 | 说明 |
| --- | --- |
| `session.app` | `Context` |
| `session.bot` | `Bot` |
| `session.channel` | **Koishi 内置频道数据**（仅中间件/指令内可用） |
| `session.user` | **Koishi 内置用户数据**（同上） |
| `session.event` | 平台原始事件（`id`/`type`/`platform`/`selfId`/`timestamp`/`channel`/`guild`/`login`/`member`/`message`/`operator`/`role`/`user`） |

访问器与等价写法：

| 访问器 | 等价于 |
| --- | --- |
| `session.author` | `{...session.event.user, ...session.event.member}` |
| `session.userId` | `session.event.user.id` |
| `session.channelId` | `session.event.channel.id` |
| `session.guildId` | `session.event.guild.id` |
| `session.content` | `session.event.message.content` |
| `session.elements` | `session.event.message.elements` |
| `session.quote` | `session.event.message.quote` |
| `session.isDirect` | `session.event.channel.type === Channel.Type.DIRECT` |
| `session.messageId` / `session.timestamp` / `session.platform` / `session.selfId` / `session.type` | 直通 `session.event.*` |

> ⚠️ **`session.user` ≠ `session.event.user`**：前者是 **Koishi 数据库里的内置用户记录**，后者是**平台传来的原始数据**。
> ⚠️ 官方**未列出** `session.username`；昵称取 `session.author.name`。

### 5.2 `Session` 方法

| 方法 | 要点 |
| --- | --- |
| `session.send(message)` | `Promise<void>` |
| `session.sendQueued(message, delay?)` | 延时发送；delay 缺省用 `app.config.delay.queue` |
| `session.cancelQueued(delay?)` | 取消待发 |
| `session.prompt(timeout?)` | 等待用户输入。**无回调超时返回 `null`** |
| `session.prompt(callback, options?)` | **有回调超时返回 `undefined`** |
| `session.suggest({ actual, expect, prefix, suffix })` | |
| `session.execute(argv, next?)` | |
| `session.observeUser(fields?)` / `observeChannel(fields?)` | 见 §6.6 |

> ❌ **没有 `session.reply()`**。要引用回复用 `<quote id={...}/>` 或 `session.quote`。

`sendQueued` 的节流配置：

```yaml
delay:
  character: 20     # 每字符 0.02s
  message: 500      # 每条消息至少 0.5s
```

### 5.3 消息元素

`h` 由 `koishi` 包导出。元素结构 `{ type, attrs, children }`。

```ts
import { h } from 'koishi'

h('message')
h('quote', { id })
h('p', {}, 'hello')
h('p', 'hello', h('img', { src }))
```

JSX 写法（需 TS 配置支持）：

```tsx
session.send(<>欢迎 <at id={userId}/> 入群！</>)
session.send(<img src="https://koishi.chat/logo.png"/>)
```

`h` 的静态方法：`h(type, attrs?, ...children?)`、`h.escape(source, inline?)`、`h.unescape(source)`、`h.parse(source, context?)`、`h.select(source, query)`、`h.transform(source, rules, session?)`。

快捷方法：`h.text(content)`、`h.at(id)`、`h.sharp(id)`、`h.quote(id)`、`h.image(url)`、`h.audio(url)`、`h.video(url)`、`h.file(url)`；本地文件用 `h.image(pathToFileURL(p).href)`，二进制用 `h.image(buffer, 'image/png')`。

**常用标准元素**：

| 类别 | 元素 |
| --- | --- |
| 基础 | `text`(content)、`at`(id,name,role,type)、`sharp`(id,name)、`a`(href) |
| 资源 | `img`(src,...)、`audio`、`video`、`file` |
| 修饰 | `b|strong`、`i|em`、`u|ins`、`s|del`、`spl`、`code`、`sup`、`sub` |
| 排版 | `br`、`p`、`message`(id, forward) |
| 元信息 | `quote`、`author` |
| 交互 | `button`（实验性） |

> `<message>` 的语义：无子元素则不发送；**出现 `<message>` 时之前的元素立即作为一条消息发出**。
> `hello<message/>world` = 两条消息。

**转义 DANGER（官方原文）**：

> 直接发送未经转义的用户输入是非常危险的，因为它很容易导致 XSS 攻击。

默认会对**指令参数**转义。若你要把玩家昵称等回显到消息里，注意用 `h.escape()`。

### 5.4 事件系统

```ts
ctx.on(event, callback, prepend?)   // 返回 dispose 函数
ctx.once(event, callback)
ctx.off(event, callback)
```

- 命名规范：**param-case**；`/` 表示命名空间；`xxx` 与 `before-xxx` 配对。
- `ctx.before('dialogue/search', cb)` ≡ `ctx.on('dialogue/before-search', cb, true)`。
- 触发方式：`emit`（同步全部）/ `parallel`（异步版）/ `bail`（依次，返回非 `false|null|undefined` 即作为结果）/ `serial`（bail 异步版）。

**本项目最可能用到的会话事件**：

| 事件 | 用途 |
| --- | --- |
| `message`（= `message-created`） | 消息驱动的一切 |
| `command/before-execute` | 指令前置拦截 |
| `command` | 指令后置统计 |
| `before-send` | 改写或取消发送内容 |
| `ready` | 启动初始化 |
| `dispose` | 清理定时器 |

自定义事件需声明类型合并：

```ts
declare module 'koishi' {
  interface Events {
    'xianxia/breakthrough'(...args: any[]): void
  }
}
```

### 5.5 中间件

```ts
ctx.middleware((session, next) => {
  if (session.content === '天王盖地虎') return '宝塔镇河妖'
  return next()          // 不调用 next()，消息就不会进入下一个中间件
})

const dispose = ctx.middleware(callback)
dispose()
```

- 与事件的三点区别：用 `ctx.middleware()` 而非 `ctx.on()`；多一个 `next`，**只有调用才会进入后续流程**；**可直接 return 内容**（事件需要自己 `session.send()`）。
- ⚠️ 异步中间件**必须 `await` 或 `return` `next()`**，否则会有运行时警告。
- `ctx.middleware(cb, true)` 注册**前置中间件**。
- `return next('你想说的是 help 吗？')` 可挂"临时中间件"作为兜底响应。
- **中间件只处理消息事件**——不要用它处理非消息事件。

---

## 六、数据库

### 6.1 依赖与驱动

**`ctx.database` 不是内置服务**，插件必须声明依赖：

```ts
export const inject = ['database']
```

官方驱动共 5 个：

| 驱动 | 说明 |
| --- | --- |
| `@koishijs/plugin-database-memory` | 内存，**唯一零配置**，无配置项。适合开发与测试 |
| `@koishijs/plugin-database-sqlite` | 配置 `config.path`，默认 `'data/koishi.db'`。**本项目推荐** |
| `@koishijs/plugin-database-mysql` | MySQL 5.7 / 8.0 或 MariaDB 10.5+；`host` 默认 `localhost`、`port` 默认 `3306`、`username` 默认 `root` |
| `@koishijs/plugin-database-mongo` | |
| `@koishijs/plugin-database-postgres` | |

> 官方**没有**"Koishi 自带默认数据库"的表述。不装驱动就没有 `ctx.database`。
> 配置方式：控制台→插件市场安装驱动→插件详情页填配置项（必选项未填会红色提示，无法启动）。

⚠️ 官方警告：**数据库服务要等应用启动完成才可访问**；服务变化会导致插件**回滚重载**。

### 6.2 数据模型

```ts
ctx.model.extend(name, fields, config?)
```

`config: Table.Meta` **只有 4 项**：

| 字段 | 类型 | 默认 |
| --- | --- | --- |
| `primary` | `string \| string[]` | `'id'` |
| `unique` | `(string \| string[])[]` | — |
| `foreign` | `Dict<[string, string]>` | 实验性 |
| `autoInc` | `boolean` | — |

> ❌ **没有 `index` 参数**。本项目 `mission_queue` 按 `finishAt` 查询的需求，要么靠 `unique`，要么接受全表扫（数据量小，可接受），**不要臆造 `index`**。

**字段类型只有 12 种**：

| 类型 | TS 类型 | 默认长度 | 初始值 |
| --- | --- | --- | --- |
| `integer` | `number` | 4 | 0 |
| `unsigned` | `number` | 4 | 0 |
| `float` | `number` | — | — |
| `double` | `number` | — | — |
| `char` | `string` | 64 | `''` |
| `string` | `string` | 255 | `''` |
| `text` | `string` | 65535 | `''` |
| `date` / `time` / `timestamp` | `Date` | — | `null` |
| `json` | — | 65535 | `null` |
| `list` | — | 65535 | `[]`（**序列化时以逗号分隔**） |

> ⚠️ **`'boolean'` 不在官方类型表中**（却出现在官方 `migrate` 示例里）。本项目布尔量统一用 `unsigned` 存 0/1。
> ⚠️ **`string` 默认只有 255 字节**。任务名、故事文本必须用 `text` 或显式 `length`。
> ⚠️ **`list` 以逗号分隔**，所以元素**不能含逗号**。

字段对象写法 `Field<T>`：

```ts
ctx.model.extend('user', {
  rank: 'unsigned',
  exp: { type: 'double', initial: 0 },
  techniqueId: { type: 'string', length: 64, initial: '' },
})
```

**类型合并声明**：

```ts
declare module 'koishi' {
  interface Tables {
    mission_queue: MissionQueue
  }
}
```

**结构变更**：

- 官方原文：**"数据模型的扩展一定要在使用前完成，不然后续数据库操作可能会失败"**。
- 字段改名用 `legacy: ['oldName']`，Koishi 启动时自动迁移旧字段数据；不用 `legacy` 的话"数据仍然会停留在旧的字段中……仍然占据数据库的空间"。
- 重构表用 `ctx.model.migrate(name, fields, callback)`（实验性，官方 WARNING：**性能较差，别依赖迁移**）。
- 嵌套字段可用点号 `'foo.bar': 'string'`，或直接用 `json`。

### 6.3 增删改查

| 方法 | 签名要点 |
| --- | --- |
| `get(table, query, modifier?)` | **永远返回数组**（不是单条） |
| `create(table, data)` | 返回填充后的行；只能插一条；**主键冲突报错** |
| `set(table, query, update)` | 不存在则**什么都不做** |
| `upsert(table, data, keys?)` | 存在则更新、不存在则插入；可批量；`keys` 用于非主键/复合键 |
| `remove(table, query)` | |
| `select(table, query?)` | 返回 `Selection`（链式） |
| `eval(table, expr, query?)` | 聚合 |
| `drop(table)` / `dropAll()` | DANGER |

`WriteResult { inserted?: number; matched?: number }`

> ⚠️ 官方特别提醒：`matched` 是**匹配的行数**，**不是修改的行数**。
> ⚠️ `upsert` 的返回值文档**自相矛盾**（指南页说无返回值、API 页说返回 `Promise<WriteResult>`）。实现时以 API 页为准，并在代码里加注释说明。

**Query 表达式支持的操作符（完整且仅有这些）**：

| 类别 | 操作符 |
| --- | --- |
| 逻辑 | `$or` `$and` `$not` |
| 集合 | `$in` `$nin` |
| 比较 | `$eq` `$ne` `$gt` `$gte` `$lt` `$lte` |
| 数组 | `$el` `$size` |
| 字符串 | `$regex` `$regexFor` |
| 位 | `$bitsAllSet` `$bitsAllClear` `$bitsAnySet` `$bitsAnyClear` |

> ❌ **没有 `$exists` / `$prefix` / `$expr`**。
> ⚠️ `$el` 官方 WARNING：部分数据库不支持子条件，**尽量只用 `$eq`**。

**简写规则**：可比较类型传值 = `$eq`；可索引类型传数组 = `$in`；字符串传 `RegExp` = `$regex`。

**引用其他字段**（官方写法，会编译成 SQL，不会拉到内存）：

```ts
import { $ } from 'koishi'

ctx.database.set('user', { id, money: { $gte: 100 } }, row => ({
  money: $.sub(row.money, 100),
}))
```

> 官方 TIP 原文：虽然求值表达式在形式上是一个回调函数，但是 Koishi **并不会将数据全部拉取到内存中**，而是将这个函数的行为编译成查询语句提交给数据库。**因此可以放心使用，不会带来额外性能问题。**
>
> 官方**没有** `$.field` 这种语法。引用字段的方式是在 Callback 里用传入的 `row` 对象（`row.id`、`row.count`、join 时的 `row.t1.id`），它们是 `EvalExpr`。

**这就是本项目的原子增减范式**——扣材料、扣次数都必须这样写，不要"先 get 再 set"。

👉 **本项目示例：原子扣历练次数**

```ts
import { $ } from 'koishi'

const result = await ctx.database.set(
  'user',
  { id: userId, missionQuotaUsed: { $lt: dailyQuota } },
  (row) => ({ missionQuotaUsed: $.add(row.missionQuotaUsed, 1) }),
)
if (!result.matched) return '今日历练次数已用完。'
```

**链式 Selection**：

```ts
ctx.database
  .select('foo')
  .where((row) => $.gt(row.id, 5))
  .orderBy('id', 'desc')
  .limit(10)
  .offset(100)
  .project({ /* ... */ })
  .groupBy('value', { sum: (row) => $.sum(row.id) })
  .execute()
```

- `execute(row => $.count(row.id))` 传表达式时返回**标量**而非数组。
- ⚠️ `.having()` 只在指南示例里出现，**API Selection 页的方法清单没有列出它**（页面上列的是 `where`/`orderBy`/`limit`/`offset`/`project`/`groupBy`/`execute`）。谨慎使用。

**`$` 运算符清单**：`$.add` `$.subtract` `$.multiply` `$.divide`、`$.eq` `$.ne` `$.gt` `$.gte` `$.lt` `$.lte`、`$.concat`、`$.and` `$.or` `$.not`、`$.sum` `$.avg` `$.min` `$.max` `$.count`。
> ⚠️ `$.if(...)` 只在指南示例中出现，**未列在 Eval API 页**。

### 6.4 内置数据结构

内置表**只有 3 张**：

| 表 | 字段 |
| --- | --- |
| `User` | `id`（用户 ID）、`name`（昵称）、`authority`（权限等级）、`permissions`（权限列表）、`locales`（语言列表） |
| `Binding` | `aid`（用户 ID）、`platform`、`pid`（平台账号） |
| `Channel` | `platform`、`id`、`assignee`、`permissions`、`locales` |

内置实例方法：`ctx.database.getUser(platform, id, modifier?)`、`setUser(platform, id, data)`、`getChannel(...)`、`setChannel(...)`。
> `getAssignedChannels()` **已废弃**。

### 6.5 给玩家加字段：两种做法

官方**两种都给了**：

**做法 A：扩展内置 `user` 表** —— 可复用**观察者机制**：

```ts
ctx.model.extend('user', {
  rank: 'unsigned',
  exp: 'double',
  techniqueId: { type: 'string', length: 64, initial: '' },
})
```

**做法 B：自建表** —— 自己 `get` / `set` / `upsert`：

```ts
ctx.model.extend('mission_queue', {
  id: 'unsigned',
  userId: 'unsigned',
  missionId: { type: 'string', length: 64 },
  finishAt: 'timestamp',
}, { primary: ['userId', 'missionId'] })
```

**官方给出的取舍依据**：观察者/数据流管理机制是为了解决两个问题——"大量重复的请求→严重资源浪费"、"资源单次请求、多次更新→数据安全性问题"。

👉 **本项目的建议**：

| 数据 | 建议 | 理由 |
| --- | --- | --- |
| 角色主档（rank/exp/属性/功法） | **扩展 `user` 表**（做法 A） | 几乎每条指令都要读，正好吃观察者的批量读写收益 |
| 每日次数 / 签到状态 | **扩展 `user` 表** | 同上，且需按用户维度频繁更新 |
| `mission_queue` / `chain_progress` | **自建表**（做法 B） | 一对多关系，且需按完成时间批量扫描 |
| 背包 / 功法收集 / 成就 | **自建表** | 一对多，行数增长快 |

### 6.6 观察者机制（关键）

`session.user` 是 **Observer**：直接赋值/`push` 即可，中间件结束后**自动写库**。

```ts
session.user.rank += 1        // 自动持久化
session.user.inventory.push('灵材')  // 自动持久化
```

⚠️ **未声明的字段不会被加载，也无法直接修改**。三种声明方式：

```ts
session.observeUser(['rank', 'exp'])              // 会话级
ctx.command('状态').userFields(['rank', 'exp'])    // 指令级
ctx.before('attach-user', (session, fields) => { fields.add('rank') })  // 全局
```

需要**阻塞写入**时用 `user.$update()`（缓冲为空则直接返回，不访问数据库）。

四个 attach 事件：`before-attach-channel` / `attach-channel` / `before-attach-user` / `attach-user`。
> ⚠️ 官方说明：**没有配置数据库时这两个 `before-attach-*` 都不会触发**；不是群聊消息时 `before-attach-channel` 不触发。

### 6.7 ⚠️ 本项目的数据安全铁律

综合 §2.5 与本节：

1. **每次变更立即写库**，不攒在内存里等退出。
2. **扣减用 `set` + `$gte` 条件 + 判 `matched`**，不要"先查再改"（并发会重复扣）。
3. **模型 `extend` 必须在任何数据库操作之前完成**（放在 `apply` 顶部）。
4. **时间戳统一存 `timestamp`**，离线结算按 `now - timestamp` 算，不靠定时器累加。
5. **每日重置按服务器日期比较**，不要用"距上次登录 24 小时"。

---

## 七、权限

| 等级 | 含义（官方设计准则） |
| --- | --- |
| 0 | **不存在的用户**（数据库里没有的用户默认 0 级） |
| 1 | 所有用户（有限功能）。**新注册用户默认 1 级** |
| 2 | 高级用户 |
| 3 | 管理员 |
| 4 | 高级管理员（可管理其他账号） |
| 5 | 通过配置登录插件获得的管理员账号 |

- 高权限者能执行一切低权限者的操作。
- `ctx.command(def, desc?, config?)` 的 `config.authority` **默认 1**。
- 官方给的限权方式 = **设 `authority`**（控制台「指令管理」里可设**指令级**和**单个选项级**），**不是**在 `.action()` 里检查。
- 全局配置项 `autoAuthorize` / `autoAssign` 影响新用户默认权限。
- `admin` 插件的 `authorize` 指令（别名 `auth`）**最低权限 4**，且目标用户权限与要设的权限都必须**严格小于**自己。
- 权限系统（实验性）：`ctx.permissions.inherit(A, B)`、`depend(A, B)`、`provide(name, fn)`。

👉 **本项目**：全部游戏指令设 `authority: 1`（人人可用）；管理/调试指令（如发材料、重置数据）设 `authority: 4`。

---

## 八、定时与主动推送

### 8.1 计时器

官方核心**只有这些**：

| API | 说明 |
| --- | --- |
| `ctx.setTimeout(callback, delay)` | 返回取消函数 |
| `ctx.setInterval(callback, delay)` | 返回取消函数 |
| `ctx.sleep(delay)` | `Promise`；⚠️ 期间插件被停用会**抛错** |
| `ctx.throttle(callback, delay, noTrailing?)` | |
| `ctx.debounce(callback, delay)` | |

> ❌ **核心没有 cron**。`koishi-plugin-cron` 是**社区插件**（提供 `ctx.cron('0 0 * * *', cb)`），非官方核心，需自行确认安装。

### 8.2 主动发送

| API | 说明 |
| --- | --- |
| `ctx.bots` | `Bot[]` |
| `bot.sendMessage(channelId, content)` | 返回 `Promise<string[]>`。⚠️ 官方 WARNING：**能拿到 session 就不要用它**，用 `session.send()` |
| `bot.sendPrivateMessage(userId, content, guildId?)` | |
| `bot.broadcast(channels, content, delay?)` | |
| `ctx.broadcast(channels?, content)` | **需要数据库**；频道格式 `{platform}:{channelId}` |

### 8.3 🔴 QQ 平台的硬约束（本项目必须遵守）

官方 QQ 适配器文档明确：**QQ 官方机器人是"被动型平台"**——

> 机器人每天只能发送极少量的主动消息；而对于被动消息，则必须在用户发送消息后的短时间内回复。

**对本项目的设计约束**（已同步写入《开发游戏设定.md》§9.7）：

| 约束 | 实现要求 |
| --- | --- |
| 不能依赖定时提醒 | "该突破了""任务完成了"改为**玩家下次发任意消息时被动带出** |
| 每日重置不靠 0 点任务 | **惰性计算**：按时间戳在玩家下次交互时结算 |
| 离线结算不靠后台循环 | 同上，读数据时现算 |
| 若日后要推送 | ①做成**默认关闭**的配置开关；②走被动回复；③在多平台适配器下才启用 |

> **一句话原则**：**把"主动性"交给玩家，把"服务端定时"降级为可选优化。**
> 这同时满足《开发游戏设定.md》原则 8（不惩罚离线）——因为所有收益都是惰性结算的，玩家什么时候回来都不亏。

### 8.4 QQ 适配器配置

官方适配器 `@koishijs/plugin-adapter-qq`。配置项：

| 字段 | 说明 |
| --- | --- |
| `config.id` | 机器人 id |
| `config.key` | 即 secret |
| `config.token` | |
| `config.type` | `'private' \| 'public'` |
| `config.sandbox` | 默认 `true` |
| `config.endpoint` | 默认 `'https://api.sgroup.qq.com/'` |
| `config.authType` | `'bot' \| 'bearer'`，默认 `bot` |

**平台名有两套**：`qq`（群含私聊）与 `qqguild`（频道含私聊），内部接口不同。写 `Bot` 相关代码时注意区分。

---

## 九、本项目用得到的 API 速查表

| 需求 | API |
| --- | --- |
| 声明插件与配置 | `export const name` / `Config: Schema<Config>` / `apply(ctx, config)` |
| 声明数据库依赖 | `export const inject = ['database']` |
| 建表 | `ctx.model.extend(name, fields, { primary, unique })` |
| 声明可观察字段 | `ctx.command(...).userFields([...])` 或 `ctx.before('attach-user', ...)` |
| 读数据 | `await ctx.database.get(table, query, { limit, offset, fields, sort })`（**返回数组**） |
| 原子扣减 | `ctx.database.set(table, { ...条件 }, row => ({ x: $.sub(row.x, 1) }))` + 判 `matched` |
| 插入 | `ctx.database.create(...)` / `ctx.database.upsert(...)` |
| 聚合 | `ctx.database.eval(...)` 或 `select(...).execute(expr)` |
| 注册指令 | `ctx.command('名字 <参数> [可选]').option(...).action(...)` |
| 注册子指令 | `ctx.command('主/子')` 或 `.subcommand('子')` |
| 发消息 | `session.send(...)` / `session.sendQueued(...)` |
| 等待输入 | `session.prompt()`（超时返回 `null`） |
| 引用回复 | `h('quote', { id })` 或 `session.quote`（**没有 `session.reply()`**） |
| 监听消息 | `ctx.middleware((session, next) => ...)` 或 `ctx.on('message', ...)` |
| 启动初始化 | `ctx.on('ready', ...)` |
| 清理 | `ctx.on('dispose', ...)`（**只清副作用，不存数据**） |
| 定时器 | `ctx.setInterval(cb, ms)`（返回取消函数） |
| 权限 | `ctx.command(def, desc, { authority: 4 })` |

---

## 十、文档未覆盖 / 待确认（不要凭印象补写）

以下内容在官方开发指南中**没有**明确记载，实现时需自行验证或查阅官方 API 参考：

| 主题 | 状态 |
| --- | --- |
| **离线时间流逝的标准结算方式** | 官方**没有任何**"离线结算/挂机时间流逝"的范例。可用的构件只有 `session.event.timestamp`、`ready`、计时器 API。本项目自己定义（见《开发游戏设定.md》§16.2） |
| **`upsert` 的确切返回值** | 指南页与 API 页**互相矛盾**（"无返回值" vs `Promise<WriteResult>`） |
| **`.having()` / `$.if()`** | 只在指南示例中出现，未列入对应 API 页 |
| **`'boolean'` 字段类型** | 不在官方类型表中，但出现在官方 `migrate` 示例里 |
| **时间类型（`date`/`time`/`timestamp`）的时区规则** | 官方未说明。本项目统一存 UTC 时间戳、按服务器时区计算"日期" |
| **yarn 变体命令** | 文档站只渲染当前激活的标签页，无法逐字取证 |
| **`ctx.set()` 的确切签名** | 官方在自定义服务中提及但未给出独立签名说明 |

> 遇到这些点时：**要么查官方 API 参考页面核实，要么在代码里加 TODO 注释**，**不要凭印象写**。
