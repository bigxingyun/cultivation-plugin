# Koishi 官方文档技术笔记
## 指令系统 / 事件系统 / 中间件 / 消息元素 / 进阶用法

> 面向：为一个 Koishi 平台的「修仙挂机文字游戏 QQ 机器人插件」编写开发指南（约 15 条指令、参数解析、定时结算）。
> 原则：只记录官方文档中的**事实性 API**，代码示例原样保留。不含任何设计建议。

### 阅读来源

按要求完整阅读（web_fetch + 读取截断存档全文）：

1. https://koishi.chat/zh-CN/guide/basic/command.html
2. https://koishi.chat/zh-CN/guide/basic/events.html
3. https://koishi.chat/zh-CN/guide/basic/middleware.html
4. https://koishi.chat/zh-CN/guide/basic/element.html
5. https://koishi.chat/zh-CN/guide/basic/advanced.html

因为以上 5 页**不包含**若干被问及的 API，额外核对了以下官方页面（下文引用处均注明来源）：

- https://koishi.chat/zh-CN/manual/usage/command.html （入门：指令系统）
- https://koishi.chat/zh-CN/api/core/command.html （API：Command / Argv）
- https://koishi.chat/zh-CN/api/core/context.html （API：Context）
- https://koishi.chat/zh-CN/api/core/session.html （API：Session）
- https://koishi.chat/zh-CN/api/core/events.html （API：内置事件清单）
- https://koishi.chat/zh-CN/api/service/timer.html （API：计时器）
- https://koishi.chat/zh-CN/api/message/elements.html （API：标准元素）
- https://koishi.chat/zh-CN/api/message/api.html （API：渲染函数 h）
- https://cron.koishi.chat/ （**第三方社区插件** koishi-plugin-cron 文档）
- https://koishi.js.org/v1/api/command.html （Koishi **v1** 旧文档，用于核对 `cmd.shortcut()`）

### 文档缺口（官方现有文档中查不到的内容，勿凭空臆造）

| 被问及 | 文档事实 |
| --- | --- |
| `ctx.command()` 的多重载 | 官方只给出一个签名 `ctx.command(def, desc?, config?)`，未记载重载形式 |
| 参数类型 `boolean` / `guild` / `member` | **不在**官方内置类型列表中（列表见 §A3，仅 11 种） |
| 自定义参数类型 `.type()` / `ctx.parser` | 这 5 页与 `api/core/command` 均**未记载**注册自定义参数类型的 API；只有**选项**支持 `config.type` |
| `.shortcut()` | **v1 时代 API**（v1 文档有 `cmd.shortcut(name, config?)`）；当前 v4 的 Command API 页面**没有**该方法。v4 guide 仅在开篇提到「快捷方式」一词，未给出 API |
| `session.reply()` | 当前 Session API 页面**没有** `reply` 方法（只有 `send` / `sendQueued` / `cancelQueued` / `prompt` / `suggest` / `execute` 等） |
| 定时任务 / cron | 官方**核心**仅提供 `ctx.setTimeout` / `ctx.setInterval` / `ctx.sleep` / `ctx.throttle` / `ctx.debounce`；cron 由**社区插件** koishi-plugin-cron 提供 `ctx.cron()` |
| 「用户离线期间时间流逝」结算 | 上述所有页面**均未提供**离线/挂机结算的官方最佳实践；只有 `session.event.timestamp`（事件时间戳）等事实性构件可用 |
| 事件名 `before-command` / `connect` / `disconnect` | 官方事件表中不存在这些名字；对应的名字是 `command/before-execute`、`command`，以及 `login-added/removed/updated` |

---

# A. 指令系统

## A1. `ctx.command()` 签名

来源：`api/core/context.html#ctx-command`

### ctx.command(def, desc?, config?)

- **def:** `string` 指令名以及可能的参数
- **desc:** `string` 指令的描述
- **config:** `CommandConfig` 指令的配置
  - **checkUnknown:** `boolean` 是否对未知选项进行检测，默认为 `false`
  - **checkArgCount:** `boolean` 是否对参数个数进行检测，默认为 `false`
  - **authority:** `number` 最低调用权限，默认为 `1`
  - **showWarning:** `boolean` 当小于最短间隔时是否进行提醒，默认为 `true`
- 返回值：`Command` 注册或修改的指令

在当前上下文中注册或修改一个指令。

入门示例（guide/basic/command.html 原样）：

```ts
ctx.command('echo <message>')
  .action((_, message) => message)
```

官方对这段代码的两条说明：

- `.command()` 方法定义了名为 echo 的指令，其有一个必选参数为 `message`
- `.action()` 方法定义了指令触发时的回调函数，第一个参数是一个 `Argv` 对象，第二个参数是输入的 `message`

## A2. 参数定义语法

来源：`guide/basic/command.html#定义参数`

- 指令名可以包含数字、字母、短横线甚至中文，但不应该包含空白字符、小数点 `.` 或斜杠 `/`
- 一个指令可以含有任意个参数，其中 **必选参数** 用尖括号包裹，**可选参数** 用方括号包裹；这些参数将作为 `action` 回调函数除 `Argv` 以外的的后续参数传入

```ts
ctx.command('test <arg1> [arg2] [arg3]')
  .action((_, arg1, arg2, arg3) => { /* do something */ })
```

官方 TIP（原样）：

> 除去表达的意义不同，以及参数个数不足时使用必选参数可能产生错误信息外，这两种参数在程序上是没有区别的。与此同时，默认情况下 `action` 回调函数从第二个参数起也总是字符串。如果传入的参数不足，则对应的参数不会被传入，因此你需要自己处理可能的 `undefined`。

### 变长参数

有时我们需要传入未知数量的参数，这时我们可以使用 **变长参数**，它可以通过在括号中前置 `...` 来实现：

```ts
ctx.command('test <arg1> [...rest]')
  .action((_, arg1, ...rest) => { /* do something */ })
```

### 文本参数（`:text`）

通常来说传入的信息被解析成指令调用后，会被空格分割成若干个参数。但如果你想输入的就是含有空格的内容，可以通过在括号中后置 `:text` 来声明一个 **文本参数**：

```ts
ctx.command('test <message:text>')
  .action((_, message) => { /* do something */ })
```

官方 TIP（原样，**对「历练 战斗」这类多词参数极关键**）：

> 文本参数的解析优先级很高，即使是之后的内容中含有选项也会被一并认为是该参数的一部分。因此，当使用文本参数时，应确保选项写在该参数之前，或 [使用引号](../../manual/recipe/execution.html#使用引号) 将要输入的文本包裹起来。

### 入门页对参数/选项的补充（`manual/usage/command.html` 原样）

> 参数分为必选参数和可选参数，分别用尖括号 `<>` 和方括号 `[]` 表示。一个指令可以有任意多个参数，它们的顺序是固定的，用户必须按照指令定义的顺序来输入参数。必选参数一定出现在可选参数之前。如果用户输入的参数数量不足必选参数的个数，那么插件通常会给出错误提示；如果用户输入了额外的参数，那么会被忽略。

> 参数除了可以分为必选和可选外，还可以分为定长和变长。定长参数的中不能出现空白字符，而变长参数则可以。变长参数通过参数名前后的 `...` 来指示，例如 `echo` 指令的参数就是一个变长参数。如果要为定长参数传入带有空白字符的内容，可以使用引号将其包裹起来，例如：`help "foo bar"`

## A3. 内置参数类型（官方列表，逐字抄录）

来源：`guide/basic/command.html#argument-type`

```
目前 Koishi 支持的内置类型如下：

- string: `string` 字符串
- number: `number` 数值
- bigint: `bigint` 大整数
- text: `string` 贪婪匹配的字符串
- user: `string` 用户，格式为 `{platform}:{id}` (调用时可以使用 `at` 元素或者 `@{platform}:{id}` 的格式)
- channel: `string` 频道，格式为 `{platform}:{id}` (调用时可以使用 `sharp` 元素或者 `#{platform}:{id}` 的格式)
- integer: `number` 整数
- posint: `number` 正整数
- natural: `number` 正整数
- date: `Date` 日期
- image: `Dict` 图片
```

用法与 `text` 无异，官方示例（原样）：

```ts
function showValue(value) {
  return `${typeof value} ${JSON.stringify(value)}`
}

ctx.command('test [arg:number]')
  .option('foo', '<val:string>')
  .action(({ options }, arg) => `${showValue(arg)} ${showValue(options.foo)}`)
```

交互效果（原样）：

```
Alice: test 100 --foo 200
Koishi: number 100 string "200"

Alice: test xyz
Koishi: 参数 arg 输入无效，请提供一个数字。
```

> 注意：官方列表**没有** `boolean`、`guild`、`member`。类型解析失败时，错误信息形如「参数 arg 输入无效，请提供一个数字。」

## A4. 自定义参数类型

- 在所列官方文档中查不到参数类型注册 API（既没有 `.type()`，也没有 `ctx.parser`）。
- 官方**有**的类型扩展点是**选项**上的 `config.type`（见 §A5），其类型别名为：

```ts
type DomainType = string | RegExp | ((source: string) => any)
```

## A5. 选项（option）

来源：`api/core/command.html#cmd-option`、`guide/basic/command.html#定义选项`

### cmd.option(name, desc?, config?)

- **name:** `string` 选项的名字
- **desc:** `string` 选项的描述
- **config:** `OptionConfig`
  - **config.fallback:** `any` 选项的默认值
  - **config.value:** `any` 选项的重载值
  - **config.type:** `DomainType` 选项的类型定义
  - **config.hidden:** `boolean` 是否隐藏选项
  - **config.notUsage:** `boolean` 是否计入调用
  - **config.authority:** `number` 选项的权限等级
- 返回值: `this`

为指令添加一个选项。

### 基础示例（原样）

```ts
ctx.command('test')
  .option('alpha', '-a')          // 定义一个选项
  .option('beta', '-b [beta]')    // 定义一个带参数的可选选项
  .option('gamma', '-c <gamma>')  // 定义一个带参数的必选选项
  .action(({ options }) => JSON.stringify(options))
```

```
Alice: test -adb text --gamma=1 --foo-bar baz --no-xyz
Koishi: { "alpha": true, "d": true, "beta": "text", "gamma": 1, "fooBar": "baz", "xyz": false }
```

官方总结的特性（原样）：

- 使用注册的多个别名中的任何一个都会被赋值到 `name` 中
- 选项和参数之间同时支持用空格或等号隔开的语法
- 单个短横线后跟多个字母时，会把之后的参数赋给最后一个字母（如果需要参数的话）
- 多字母中如果有短横线，会被自动进行驼峰式处理
- 类型自动转换：无参数默认为 `true`，如果是数字会转化为数字，其余情况为字符串
- 支持识别未注册选项，同时会根据传入的命令行推测是否需要参数
- 如果一个未注册选项以 `no-` 开头，则会自动去除这个前缀并处理为 `false`

> 短/长选项声明写法即在 `name`（首参）里写：短选项 `'-a'`、`'-b [beta]'`、`'-c <gamma>'`、`'-t <seconds>'`，长选项 `'--anonymous'`、`'<val:string>'`（无短横线形式）；带描述的写法是**在 decl 字符串末尾追加说明文字**（见 §A6）。

### 默认值 `fallback`（原样）

```ts
ctx.command('test')
  .option('alpha', '-a', { fallback: 100 })
  .option('beta', '-b', { fallback: 100 })
  .action(({ options }) => JSON.stringify(options))
```

```
Alice: test -b 80
Koishi: { "alpha": 100, "beta": 80 }
```

### 重载 `value`

将同一个选项注册多次，并结合使用 `value` 配置选项的重载值：

```ts
ctx.command('test')
  .option('writer', '-w <id>')
  .option('writer', '--anonymous', { value: 0 })
  .action(({ options }) => JSON.stringify(options))
```

```
Alice: test --anonymous
Koishi: { "writer": 0 }
```

### 选项类型

选项也可以像参数一样设置类型：

```ts
ctx.command('text')
  .option('alpha', '-a <value:number>')
```

除了这种写法外，你还可以传入一个 `type` 属性……它可以是像上面的例子一样的回调函数，也可以是一个 `RegExp` 对象，表示传入的选项应当匹配的正则表达式：

```ts
ctx.command('test')
  .option('beta', '-b <value>', { type: /^ba+r$/ })
  .action(({ options }) => options.beta)
```

```
Alice: test -f bar      → Koishi: bar
Alice: test -f baaaz    → Koishi: 选项 beta 输入无效，请检查语法。
```

### `required` / `hidden` / `notUsage` / `authority`

- `hidden`：注册时将配置项 `hidden` 设置为 `true`（指令与选项都支持）
- `notUsage`：`boolean` 是否计入调用（速率限制相关）
- `authority`：`number` 选项的权限等级
- **`required`：官方 OptionConfig 中并未记载 `required` 字段**；必选/可选是通过 decl 里的 `<...>` / `[...]` 表达的

### 隐藏指令与选项示例（原样）

```ts
// 手动导入类型
import {} from '@koishijs/plugin-help'

ctx.command('bar 一条看不见的指令', { hidden: true })
  .option('foo', '<text> 一个看不见的选项', { hidden: true })
  .action(({ options }) => 'secret: ' + options.foo)
```

隐藏项可通过 `help -H` / `help bar -H` 查看。

## A6. 帮助、别名与钩子

来源：`api/core/command.html`

### cmd.usage(text)
- **text:** `string` 使用方法说明
- 返回值: `this`
- 为指令添加使用方法。**多次调用此方法只会保留最后一次的定义。**

### cmd.example(example)
- **example:** `text` 使用示例
- 返回值: `this`
- 为指令添加使用示例。**多次调用此方法会一并保留并显示在帮助的最后面。**

### cmd.action(action, prepend?)
- **action:** `CommandAction` 执行函数
- **prepend:** `boolean` 是否前置
- 返回值: `this`

```ts
type Awaitable<T> = [T] extends [Promise<unknown>] ? T : T | Promise<T>
type CommandAction = (argv: Argv, ...args: any[]) => Awaitable<string | void>
```

### cmd.before(action, append?)  ← 指令执行前的检测函数
- **action:** `CommandAction` 执行函数
- **append:** `boolean` 是否后置
- 返回值: `this`

> 为指令添加检测函数。

### cmd.alias(name, config?)
- **name:** `string` 要设置的别名
- **config:** `Command.Alias`
  - **config.args:** `any[]` 要带的参数列表，将与传入的参数合并
  - **config.options:** `Dict` 要带的选项列表，将与传入的选项合并
- 返回值: `this`

```ts
ctx.command('echo <message>').alias('say')
```

```ts
ctx.command('market <area> <item>').alias('市场', { args: ['China'] })
```

> 此时调用 `市场` 时将等价于调用 `market China`。如果你传入了更多的参数，那么它们将被添加到 `China` 之后。

官方 WARNING（原样）：

> 由于指令名可以在用户侧配置，因此**不建议**开发者设置过多别名或以常用词作为别名。如果用户加载的多个插件都注册了同一个指令别名，那么后一个加载的插件将直接加载失败。

### 帮助文本写法（原样）

```ts
ctx.command('echo <message:text> 输出收到的信息')
  .option('timeout', '-t <seconds> 设定延迟发送的时间')
```

```ts
ctx.command('echo <message:text>', '输出收到的信息')
  .option('timeout', '-t <seconds> 设定延迟发送的时间')
  .usage('注意：参数请写在最前面，不然会被当成 message 的一部分！')
  .example('echo -t 300 Hello World  五分钟后发送 Hello World')
```

帮助输出形态（原样）：

```
echo <message>
输出收到的信息
注意：参数请写在最前面，不然会被当成 message 的一部分！
可用的选项有：
-t, --timeout <seconds> 设定延迟发送的时间
使用示例：
echo -t 300 Hello World 五分钟后发送 Hello World
```

## A7. 子指令：层级式 vs 派生式

来源：`guide/basic/command.html#注册子指令`、`manual/usage/command.html#子指令`

```ts
// 层级式子指令
ctx.command('foo/bar')

// 派生式子指令
ctx.command('foo.bar')
```

> 是的，除了这里用到了斜杠 `/` 和小数点 `.` 来分别表示层级式和派生式子指令外，其他用法都是完全一致的。

```ts
// 层级式子指令
ctx.command('foo').subcommand('bar')

// 派生式子指令
ctx.command('foo').subcommand('.bar')
```

### cmd.subcommand(name, desc?, config?)
- **name:** `string` 指令名以及可能的参数
- **desc:** `string` 指令的描述
- **config:** `Command.Config` 指令的配置
- 返回值：`Command` 注册或修改的指令

> 注册或修改子指令。子指令会继承当期指令的上下文。

### 两者的用户侧差别（原样）

> 子指令在调用上与普通的指令并没有区别，但它们将不会显示在 `help` 返回的全局指令列表中，而只会显示在父指令 `user` 的帮助信息中。

> 在上面的例子中，我们还能发现 Koishi 存在两种不同的子指令：一种是 **层级式**，例如 `authorize`；而另一种则是 **派生式**，例如 `user.locale`。后者跟前者的区别是，它的名称带有父指令的名称，以及一个小数点 `.`。在调用时，我们也需要加上这个小数点：

```
Alice: user.locale en   → Koishi: User data updated.
```

> 如果父指令本身没有功能，那么 `user` 和 `user -h` 的效果是一样的。此时，我们也可以使用空格代替小数点进行派生式子指令的调用：

```
Alice: user locale zh   → Koishi: 用户数据已修改。
```

## A8. `Argv` 对象与参数解构

来源：`api/core/command.html#argv-对象`

> Argv 对象会作为 `cmd.action()`, `cmd.userFields()` 等方法的回调函数中的第一个参数。它具有以下的属性：
>
> - **args:** `any[]` 参数列表
> - **options:** `{}` 选项列表
> - **next:** `Next` 中间件的 next 回调函数
> - **session:** `Session` 所在的会话对象

（即：官方 Argv 只列出 `args` / `options` / `next` / `session` 四个属性，**没有 `argv.name`**；指令名在 `Command` 实例上。）

`cmd.execute` 页面对 argv 的字段描述（原样）：

- **argv.args:** `any[]` 指令的参数列表
- **argv.options:** `Record<string, any>` 指令的选项
- **argv.session:** `Session` 当前的会话对象

两种取参数的官方写法：

```ts
// 写法 1：第一个参数 _ 是 Argv，其后依次是参数
ctx.command('test <arg1> [arg2] [arg3]')
  .action((_, arg1, arg2, arg3) => { /* do something */ })

// 写法 2：从 Argv 解构 options（官方示例）
ctx.command('test [arg:number]')
  .option('foo', '<val:string>')
  .action(({ options }, arg) => `${showValue(arg)} ${showValue(options.foo)}`)
```

相关：`cmd.userFields(fields)` / `cmd.channelFields(fields)`，用于提前声明数据库字段；类型为

```ts
type FieldCollector<K extends string> =
  | Iterable<K>
  | ((argv: Argv, fields: Set<K>) => void)
```

### 其他 Command 方法

- `cmd.removeOption(name)`：删除一个选项。注意：如果你为一个选项注册了多个别名，则删除任何一个别名都相当于删除整个选项。
- `cmd.parse(input)`：`input` 是 `Argv` 令牌化的输入，通常是 `Argv.parse()` 的返回值；返回 `Argv` 解析结果。
- `cmd.execute(argv, next?)`：返回值 `Promise<string>` 执行函数的返回结果，可用于指令插值。
- `cmd.dispose()`：移除当前指令及其所有子指令。

## A9. 指令执行前的检查 / 拦截

官方提供三条路径：

1. `cmd.before(action, append?)` —— 为指令添加检测函数（§A6）。
2. 事件 `command/before-execute`（`api/core/events.html`）：
   - **argv:** `Argv` 运行时参数
   - **触发方式:** serial
   - > 调用指令前会在对应的上下文触发。此时指令的可用性还未经检测，因此可能出现参数错误、权限不足、超过使用次数等情况。你可以通过在回调函数中返回一个字符串以取消该指令的执行。进一步，如果该字符串非空，则会作为此指令执行的结果。
3. 事件 `command`：**argv:** `Argv`；**触发方式:** parallel；指令调用完毕后会在对应的上下文触发。

配套的解析/挂载事件（同页）：

- `before-parse`：**content:** `string` 要解析的文本；**session:** `Session`；**触发方式:** bail。尝试将文本解析成 Argv 对象时调用。你可以在回调函数中返回一个 Argv 对象以覆盖默认的解析行为。
- `parse`：**argv:** `Argv`；**触发方式:** bail。尝试将一个未识别出指令的 Argv 对象识别成指令调用时使用。
- `before-attach-user` / `before-attach-channel`：**session:** `Session`；**fields:** `Set<string>`；**触发方式:** emit。可通过 `fields.add()` 修改字段集合。
- `attach-user` / `attach-channel`：**session:** `Session`；**触发方式:** serial。返回 truthy 值则该会话不会触发指令以及之后的中间件。
- `command/before-attach-user` / `command/before-attach-channel`：**session:** `Argv`；**fields:** `Set<string>`；emit。

## A10. 指令触发前缀（`manual/usage/command.html` 原样）

> 在「全局设置」中，我们提供了名为 `prefix` 和 `nickname` 的配置项。假如将 `prefix` 设置为 `/`，`nickname` 设置为 `四季酱`，则在群聊环境下只有以下信息可以触发指令调用：

```sh
四季酱, echo hello
@四季酱 echo hello
/echo hello
```

> 换句话说，一个指令能够被触发的实际条件为：
> - 消息以 `prefix` 开头，后面紧跟着指令调用
> - 消息以 `nickname` 开头，后面可以有逗号或空白字符，再后面是指令调用
> - 消息以 @机器人 开头 (可以有多个 `@`，但至少一个是机器人账号)，后面是指令调用

> **关于 `prefix` 的几点提示：**
> 1. `prefix` 是一个列表，默认值为 `['']` 表示无需前缀也能触发；将列表清空会导致所有指令都无法通过 `prefix` 触发 (但仍然可以通过私聊或 `nickname` 或 @机器人 触发)
> 2. 如果你在 `prefix` 中设置了多个值，例如 `['.', '/', '']`，那么 `.`, `/` 或无前缀都能触发指令；但由于 Koishi 是按顺序匹配各个前缀的，因此空串 `''` 必须写在最后一个
> 3. 可以为不同的会话设置不同的 `prefix`，具体请参考 [过滤器](./customize.html#filters) 一节

---

# B. 会话与消息发送

## B1. Session 常用属性（`api/core/session.html` 原样）

### 通用属性
- `session.app`：类型 `Context`，当前会话的根上下文。
- `session.bot`：类型 `Bot`，当前会话绑定的机器人实例。
- `session.channel`：类型 `Channel`；**只能在中间件或指令内部使用**，当前会话绑定的频道数据，是一个可观测对象。
  > WARNING：这个属性对应的是 Koishi 内置数据结构中的频道数据，而不是平台的频道数据。如果你需要访问平台频道数据，请使用 `session.event.channel`。
- `session.user`：类型 `User`；**只能在中间件或指令内部使用**，当前会话绑定的用户数据，是一个可观测对象。
  > WARNING：这个属性对应的是 Koishi 内置数据结构中的用户数据，而不是平台的用户数据。如果你需要访问平台用户数据，请使用 `session.event.user`。

### `session.event`（会话事件数据，包含全部可序列化资源）
- **id:** `number` 事件 ID
- **type:** `string` 事件类型
- **platform:** `string` 接收者的平台名称
- **selfId:** `string` 接收者的平台账号
- **timestamp:** `number` 事件的时间戳
- **channel:** `Channel` 事件所属的频道
- **guild:** `Guild` 事件所属的群组
- **login:** `Login` 事件的登录信息
- **member:** `GuildMember` 事件的目标成员
- **message:** `Message` 事件的消息
- **operator:** `User` 事件的操作者
- **role:** `GuildRole` 事件的目标角色
- **user:** `User` 事件的目标用户

> 事件中的各属性遵循**资源提升**规则：资源对象的某个字段可以是另一个资源对象，例如消息对象中的 `user` 字段就是一个用户对象。当资源对象出现多级嵌套时，内层的资源将会被统一提升到最外层。例如，当接收到消息事件时，事件体中可以访问到 `message`, `member`, `user`, `channel` 等资源，但 `message` 中就不再存在 `member` 和 `user` 字段了。

### 访问器属性（原样，含完整写法）
- `session.author`：`GuildMember & User`，完整写法 `{ ...session.event.user, ...session.event.member }`
- `session.channelId`：`string`，`session.event.channel.id`
- `session.channelName`：`string`，`session.event.channel.name`
- `session.content`：`string`，`session.event.message.content`
- `session.elements`：`Element[]`，`session.event.message.elements`
- `session.guildId`：`string`，`session.event.guild.id`
- `session.guildName`：`string`，`session.event.guild.name`
- `session.id`：`string`，`session.event.id`
- `session.isDirect`：`boolean`，`session.event.channel.type === Channel.Type.DIRECT`
- `session.messageId`：`string`，`session.event.message.id`
- `session.platform`：`string`，`session.event.platform`
- `session.quote`：`Message`，`session.event.message.quote`
- `session.selfId`：`string`，`session.event.selfId`
- `session.timestamp`：`string`，`session.event.timestamp`
- `session.type`：`string`，`session.event.type`
- `session.userId`：`string`，`session.event.user.id`

> 关于 `session.username`：官方 Session API 页面**未列出**该访问器；昵称相关字段见 `session.author`（`GuildMember & User`，含 `name`）。（`guide/basic/events.html` 示例中用到的是 `session.bot.sendPrivateMessage(session.userId, ...)`。）

## B2. Session 实例方法（原样）

### session.send(message)
- **message:** `string` 要发送的内容
- 返回值: `Promise<void>`
- 在当前上下文发送消息。

### session.sendQueued(message, delay?)
- **message:** `string` 要发送的内容
- **delay:** `number` 与下一条消息的时间间隔，缺省时会使用 `app.config.delay.queue`
- 返回值: `Promise<void>`
- 在当前上下文发送消息，并与下一条通过 `session.sendQueued` 发送的消息之间保持一定的时间间隔。

### session.cancelQueued(delay?)
- **delay:** `number` 与下一条消息的时间间隔，默认值为 `0`
- 返回值: `Promise<void>`
- 取消当前正在等待发送的消息队列，并重置与下一条通过 `session.sendQueued` 发送的消息之间的时间间隔。

### session.prompt(timeout?)
- **timeout:** `number` 中间件的生效时间，缺省时会使用 `app.config.delay.prompt`
- 返回值: `Promise<string>` 用户输入
- 等待当前会话的下一次输入并返回，**如果超时则会返回 `null`**。无论用户输入什么，超时前的下一次输入都不会进入中间件处理流程。

### session.prompt(callback, options?)
- **callback:** `(session: Session) => Awaitable<T>`
- **options.timeout:** 中间件的生效时间，缺省时会使用 `app.config.delay.prompt`
- 返回值: `Promise<T>` 回调函数返回的结果
- 处理当前会话的下一次输入，**如果超时则会返回 `undefined`**。如果回调函数返回值非空，则下一次输入不会进入中间件处理流程。

### session.suggest(options)
- **options.actual:** `string?` 目标字符串
- **options.expect:** `string[]` 候选项列表
- **options.prefix:** `string?` 显示在候选输入前的文本
- **options.suffix:** `string` 当只有一个选项时，显示在候选输入后的文本
- 返回值: `Promise<string>`
- 向用户展示候选项并等待输入。

### session.execute(argv, next?)
- **argv:** `string | Argv` 指令文本或运行时参数对象
- **next:** `Next` 回调函数
- 返回值: `Promise<void>`
- 执行一个指令。可以传入一个 argv 对象或者指令对应的文本。

### session.observeUser(fields?) / session.observeChannel(fields?)
分别观测用户/频道字段并更新到 `session.user` / `session.channel`，返回 `Promise<User.Observed>` / `Promise<Channel.Observed>`。

### `session.reply()` 与 `session.send()` 的差别
官方 Session API **没有** `reply` 方法。引用回复通过消息元素 `<quote id={messageId}/>`（`guide/basic/element.html`）或 `session.quote`（`Message`）表达；`guide/basic/events.html` 的回复示例用的是 `session.send('宝塔镇河妖')`。

## B3. 延时发送与等待输入（`guide/basic/advanced.html` 原样）

```ts
// 发送两条消息，中间间隔一段时间，这个时间由系统计算决定
await session.sendQueued('message1')
await session.sendQueued('message2')

// 清空等待队列
await session.cancelQueued()
```

```ts
import { Time } from 'koishi'

// 如果消息队列非空，在前一条消息发送完成后 1s 发送本消息
await session.sendQueued('message3', Time.second)

// 清空等待队列，并设定下一条消息发送距离现在至少 0.5s
await session.cancelQueued(0.5 * Time.second)
```

```yaml
delay:
  # 消息里每有一个字符就等待 0.02s
  character: 20
  # 每条消息至少等待 0.5s
  message: 500
```

> 这样一来，一段长度为 60 个字符的消息发送后，下一条消息发送前就需要等待 1.2 秒了。

等待输入：

```ts
await session.send('请输入用户名：')

const name = await session.prompt()
if (!name) return '输入超时。'

// 执行后续操作
return `${name}，请多指教！`
```

> 你可以给这个方法传入一个 `timeout` 参数，或使用 `delay.prompt` 配置项，来作为等待的时间。

执行指令：

```ts
// 当用户输入“查看帮助”时，执行 help 指令
ctx.middleware((session, next) => {
  if (session.content === '查看帮助') {
    return session.execute('help', next)
  } else {
    return next()
  }
})
```

## B4. 广播与主动交互（`guide/basic/advanced.html`）

> 我们通常将机器人做出的交互行为分为两种：主动交互和被动交互。**主动交互**是指机器人主动进行某些操作，而**被动交互**则是指机器人接收到特定事件后做出的响应。一个机器人的大部分交互都应该是被动的，而主动交互则可用于一些特殊情况，比如定时任务、通知推送等。

> Koishi 提供的交互性 API 可能存在于 `ctx`，`session` 和 `bot` 三种对象中。

```ts
// 从 session 中访问 bot
session.bot

// 从 ctx 中访问 bot，其中 platform 和 selfId 分别是平台名称和机器人 ID
ctx.bots[`${platform}:${selfId}`]
```

```ts
// 一参数填写你要发送到的频道 ID 列表
await bot.broadcast(['123456', '456789'], '全体目光向我看齐')
```

```ts
// ctx.broadcast：需要数据库，会自动获取每个频道的受理人并以对应的账号发送消息
await ctx.broadcast(['telegram:123456', 'discord:456789'], '全体目光向我看齐')
```

`ctx.broadcast(channels?, content)`（API 页原样）：

- **channels:** `string[]` 频道列表，格式为 `{platform}:{channelId}` (如 `discord:1234567890`)
- **content:** `string` 要发送的内容
- 返回值: `Promise<string[]>` 成功发送的消息 ID 列表
- 所有机器人向自己分配的频道广播消息。如果传入的频道不存在，会输出一个警告。

## B5. 消息元素（`guide/basic/element.html` 原样）

> 一个典型的元素包含名称、属性和内容。在 Koishi 中，我们通常使用 JSX 或 API 的方式创建元素。

```tsx
// 欢迎 @用户名 入群！
session.send(<>欢迎 <at id={userId}/> 入群！</>)

// 发送一张 Koishi 图标
session.send(<img src="https://koishi.chat/logo.png"/>)
```

> 如果你已经学习过 HTML 的相关知识，你唯一额外需要了解的事情就是我们使用单花括号 `{}` 进行插值。

### 使用 API（`h` 函数）

```ts
// 第一个参数是元素名称 (必选)
h('message')

// 你可以传入一个由属性构成的对象作为第二个参数
h('quote', { id })

// 后续参数是元素的内容，可以是字符串或其他元素
h('p', {}, 'hello')

// 没有属性时二参数可以忽略不写
h('p', 'hello', h('img', { src }))
```

混用：

```tsx
// 欢迎 @用户名 入群！
<>欢迎 {h('at', { id: userId })} 入群！</>
```

```tsx
// 创建一个仅包含图片的消息
h('message', <img src="https://koishi.chat/logo.png"/>)
```

> **`h` 的导入来源**：文档该页未展示 `import` 语句；`h` 由 `koishi` 包提供（同站示例从该包导入其他成员：`import { Time } from 'koishi'`）。`h` 的实例结构为：

```ts
interface Element {
  type: string
  attrs: object
  children: Element[]
}
```

### `h` 的静态方法（`api/message/api.html` 原样）

- `h(type, attrs?, ...children?)`：**type:** `string | Function` 消息元素类型；**attrs:** `object`；**children:** `Element[]`；返回值 `Element`。构造一个消息元素对象。如果 `type` 是一个函数，则会视为一个自定义消息组件。
- `h.escape(source, inline?)`：**inline:** `boolean` 在属性内部转义 (会额外处理引号)；返回转义过后的文本。
- `h.unescape(source)`：取消一段文本的消息元素转义。
- `h.parse(source, context?)`：**context:** `object` 插值上下文；返回 `Element[]`。其中的纯文本将会解析成 `text` 类型。传入 `context` 时自动识别插值语法。
- `h.select(source, query)`：选择器语法含通配 `*`、元素选择器 `type`、选择器列表 `sel1, sel2`、后代/直接子代/一般兄弟/紧邻兄弟组合器。
- `h.transform(source, rules, session?)` / `h.transformAsync(source, rules, session?)`：

```ts
type Fragment = string | Element | (string | Element)[]
type Transformer = boolean | ((
  attrs: Dict,
  children: Element[],
  session: Session,
) => Fragment)
```

### 快捷调用（原样）

```ts
// content
h.text(content)

// id
h.at(id)
h.sharp(id)
h.quote(id)

// url
h.image(url)
h.audio(url)
h.video(url)
h.file(url)

// buffer
h.image(buffer, 'image/png')
h.audio(buffer, 'audio/mpeg')
h.video(buffer, 'video/mp4')
h.file(buffer, 'application/octet-stream')
```

### 本地图片 / 二进制（原样）

```tsx
import { pathToFileURL } from 'url'
import { resolve } from 'path'

// 发送相对路径下的 logo.png
h.image(pathToFileURL(resolve(__dirname, 'logo.png')).href)

// 等价于下面的写法
<img src={pathToFileURL(resolve(__dirname, 'logo.png')).href}/>
```

```tsx
// 这里的二参数是图片的 MIME 类型
h.image(buffer, 'image/png')

// 等价于下面的写法
<img src={'data:image/png;base64,' + buffer.toString('base64')}/>
```

## B6. 标准元素清单（`api/message/elements.html` 原样）

**基础元素**
- `text`：**content:** `string` 文本内容。特殊元素，等价于一段纯文本，序列化时不会带两侧标签。
- `at`：`id` / `name` / `role` / `type`（`all` 表示 @全体成员，`here` 表示 @在线成员）；同一次发送使用 `id`, `role`, `type` 其一即可。
- `sharp`：`id` / `name`，提及频道。
- `a`：`href`，链接；平台不支持时建议显示为 `content (href)`。

**资源元素**（通用属性 `src` / `title` / `cache: boolean` / `timeout: string`）
- `img`：额外 `width` / `height`（像素）
- `audio`：额外 `duration`（秒）/ `poster`
- `video`：额外 `width` / `height` / `duration` / `poster`
- `file`：额外 `poster`
- 非网络资源 URL 写法：本地文件用 `file:` 协议，二进制数据用 `data:` 协议。

**修饰元素**：`b`/`strong`、`i`/`em`、`u`/`ins`、`s`/`del`、`spl`、`code`、`sup`、`sub`

**排版元素**：`br`、`p`、`message`（`id` / `forward: boolean`）

> `<message>` 元素的基本用法是表示一条消息。子元素对应于消息的内容。如果其没有子元素，则消息不会被发送。当出现 `<message>` 元素时，之前的元素会被立即视为一条消息被发送。

```html
<!-- 第一种写法：发送两条消息 -->
<message>hello</message>
<message>world</message>

<!-- 第二种写法：用一条空消息隔开两段文本，实际上仍然会发送两条消息 -->
hello<message/>world
```

模拟其他用户 / 转发 / 合并转发：

```html
<message>
  <author id="123123123" name="Alice" avatar="url"/>
  hello world
</message>
```

```html
<message id="123456789" forward/>
```

```html
<message forward>
  <message id="123456789"/>
  <message id="987654321"/>
  <!-- 合并转发里也可以嵌套模拟其他用户发送的消息 -->
  <message>
    <author id="123123123" name="Alice" avatar="url"/>
    hello world
  </message>
</message>
```

**元信息元素**：`quote`（子元素渲染为引用内容）、`author`（`id` / `name` / `avatar`）

**交互元素**：`button`（实验性；`id` / `type` / `href` / `text` / `theme`）。三种类型：
- 点击 `action` 类型的按钮时会触发一个 `interaction/button` 事件，该事件的 `button` 资源会包含上述 `id`
- 点击 `link` 类型的按钮时会打开一个链接，该链接的地址为上述 `href`
- 点击 `input` 类型的按钮时会在用户的输入框中填充上述 `text`

`theme` 仅建议使用：`primary` / `secondary` / `success` / `warning` / `danger` / `info`

> 关于属性名：官方标准元素用 `src`；`manual/usage/command.html` 的 echo 示例中出现了 `<image url="https://koishi.chat/logo.png"/>`（`-E` 反转义后被渲染为图片），说明 `url` 亦被接受为图片属性写法。

## B7. 消息组件（Component，实验性）

> **消息组件 (Component)** 是一种对消息元素的扩展和封装。它允许你创建可重用的定制元素，并在渲染时引入自定义逻辑。

```html
这是执行结果：<execute>echo hello</execute>
```

内置组件：
- `<execute>`：执行指令
- `<prompt>`：等待输入
- `<i18n>`：国际化
- `<random>`：随机选择

> 某些消息组件只有在特定的会话环境下才能使用 (例如在 `ctx.broadcast()` 中传入 `<execute>` 是无意义的，也会抛出错误)。

定义与注册（原样）：

```ts
// 请注意函数名必须以大写字母开头
function Custom(attrs, children, session) {
  return '自定义内容'
}
```

```tsx
// 请注意这里的大写字母
session.send(<Custom/>)
```

```ts
ctx.component('custom', (attrs, children, session) => {
  return '自定义内容'
})

// 现在你可以在任何地方使用小写的 <custom/> 了
session.send(<custom/>)
```

## B8. 转义（原样 DANGER）

> 直接发送未经转义的用户输入是非常危险的，因为它很容易导致 XSS 攻击。在使用诸如 `h.unescape()` 之类的 API 时，请务必确保输入的安全性。

> 在默认情况下，Koishi 会对指令参数进行转义以确保安全性。但在某些情况下，你可能希望手动处理消息元素的转义和解析。

---

# C. 事件系统与中间件

## C1. 基本注册（`guide/basic/events.html` 原样）

```ts
ctx.on('message', (session) => {
  if (session.content === '天王盖地虎') {
    session.send('宝塔镇河妖')
  }
})
```

> 使用 `ctx.on()` 注册监听器。它的写法与 Node.js 自带的 EventEmitter 类似：第一个参数表示要监听的事件名称，第二个参数表示事件的回调函数。同时，我们也提供了类似的函数 `ctx.once()`，用于注册一个只触发一次的监听器；以及 `ctx.off()`，用于取消一个已注册的监听器。

> 这套事件系统与 EventEmitter 的一个不同点在于，无论是 `ctx.on()` 还是 `ctx.once()` 都会返回一个 dispose 函数，调用这个函数即可取消注册监听器。因此你其实不必使用 `ctx.once()` 和 `ctx.off()`。

```ts
// 回调函数只会被触发一次
const dispose = ctx.on('foo', (...args) => {
  dispose()
  // do something
})
```

非会话事件示例（原样，回调参数不是 session）：

```ts
// bot-status-updated 不是会话事件
// 所以回调函数接受的参数不是 session 而是 bot
ctx.on('bot-status-updated', (bot) => {
  if (bot.status === Status.ONLINE) {
    // 这里的 userId 换成你的账号
    bot.sendPrivateMessage(userId, '我上线了~')
  }
})
```

```ts
// 当有好友请求时，接受请求并发送欢迎消息
ctx.on('friend-request', async (session) => {
  // session.bot 是当前会话绑定的机器人实例
  await session.bot.handleFriendRequest(session.messageId, true)
  await session.bot.sendPrivateMessage(session.userId, '很高兴认识你！')
})
```

## C2. 事件命名规范（原样）

> - 总是使用 param-case 作为事件名
> - 通过命名空间进行管理，使用 `/` 作为分隔符
> - 配对使用 xxx 和 before-xxx 命名具有时序关系的事件

举例（原样）：

> - `dialogue/before-search`: 获取搜索结果前触发
> - `dialogue/search`: 获取完搜索结果后触发

## C3. 前置事件 / 优先级（原样）

```ts
ctx.before('dialogue/search', callback)
// 相当于
ctx.on('dialogue/before-search', callback, true)
```

> 默认情况下，事件的多个回调函数的执行顺序取决于它们添加的顺序。先注册的回调函数会先被执行。如果你希望提高某个回调函数的优先级，可以给 `ctx.on()` 传入第三个参数 `prepend`，设置为 true 即表示添加到事件执行队列的开头而非结尾。

> 对于 `ctx.before()`，情况则正好相反。默认的行为的先注册的回调函数后执行，同时 `ctx.before()` 的第三个参数 `append` 则表示添加到事件执行队列的末尾而非开头。

## C4. 触发方式（原样）

> - emit: 同时触发所有 event 事件的回调函数
> - parallel: 上述方法对应的异步版本
> - bail: 依次触发所有 event 事件的回调函数；当返回一个 `false`, `null`, `undefined` 以外的值时将这个值作为结果返回
> - serial: 上述方法对应的异步版本

```ts
ctx.emit('custom-event', arg1, arg2, ...rest)
// 对应于
ctx.on('custom-event', (arg1, arg2, ...rest) => {})
```

### 过滤触发上下文（原样）

```ts
// 无法匹配该会话的上下文中注册的回调函数不会被执行 (可能有点绕)
ctx.emit(session, 'custom-event', arg1, arg2, ...rest)
```

```ts
const thisArg = { [Context.filter]: callback }
ctx.emit(thisArg, 'custom-event', arg1, arg2, ...rest)
```

> 触发事件时传入的一参数如果是对象，则会作为事件回调函数的 `this`。并且如果这个对象有 `Context.filter` 属性，那么这个属性将被用于过滤触发上下文。

## C5. 自定义事件类型（原样）

```ts
declare module 'koishi' {
  interface Events {
    // 方法名称对应自定义事件的名称
    // 方法签名对应事件的回调函数签名
    'kook/message-btn-click'(...args: any[]): void
  }
}
```

```ts
// 从 @koishijs/plugin-adapter-kook 导入事件类型
// 这里的 import {} from 会在编译时被删除，不会影响运行时的行为
// 请不要写成 import '@koishijs/plugin-adapter-kook'
import {} from '@koishijs/plugin-adapter-kook'

// 如果没有上面的类型导入，下面的代码会报错
ctx.on('kook/message-btn-click', callback)
```

## C6. 事件清单（`api/core/events.html`）

### 通用会话事件（由适配器实现，均含一个 `session` 参数，触发方式均为 `emit`）
`friend-request`、`guild-added`、`guild-member-added`、`guild-member-removed`、`guild-member-request`、`guild-member-updated`、`guild-removed`、`guild-request`、`guild-role-created`、`guild-role-deleted`、`guild-role-updated`、`guild-updated`、`login-added`、`login-removed`、`login-updated`、`message-created (message)`、`message-deleted`、`message-updated`、`reaction-added`、`reaction-removed`

> `message-created (message)`：即 `message` 是 `message-created` 的别名（guide 中用的都是 `ctx.on('message', ...)`）。
> 注意：guide 里出现的 `bot-status-updated` 未出现在 API 事件表；API 表中对应的是 `login-updated`（机器人状态发生改变时触发）。

### 内置会话事件（Koishi 自身实现，均支持上下文选择器）

| 事件 | 回调参数 | 触发方式 | 说明（原样要点） |
| --- | --- | --- | --- |
| `middleware` | `session` | emit | 在执行完全部中间件后会在对应的上下文触发。 |
| `before-parse` | `content`, `session` | bail | 尝试将文本解析成 Argv 对象时调用；返回 Argv 对象可覆盖默认解析行为。 |
| `parse` | `argv` | bail | 尝试将一个未识别出指令的 Argv 对象识别成指令调用时使用。 |
| `before-attach-channel` / `before-attach-user` | `session`, `fields: Set<string>` | emit | 从数据库获取频道/用户信息前触发；`fields.add()` 增加字段。 |
| `attach-channel` / `attach-user` | `session` | serial | 数据获取完成后触发；返回 truthy 值则该会话不会触发指令以及之后的中间件。 |
| `command/before-attach-channel` / `command/before-attach-user` | `session: Argv`, `fields: Set<string>` | emit | 任意指令调用前触发。 |
| `before-send` | `session` | bail | 即将发送信息时触发；可改 `session.content`，或返回 truthy 值以取消该消息的发送。 |
| `command/before-execute` | `argv` | serial | 调用指令前触发；返回字符串可取消该指令的执行，非空字符串会作为执行结果。 |
| `command` | `argv` | parallel | 指令调用完毕后触发。 |

### 生命周期事件（在全体上下文触发，上下文选择器无效）

| 事件 | 回调参数 | 触发方式 | 说明（原样） |
| --- | --- | --- | --- |
| `ready` | — | parallel | 应用启动时触发。如果应用已经处于启动状态，则会立即触发。 |
| `dispose` | — | parallel | 插件被卸载时触发。 |
| `service` | `name: string` | emit | 有服务被修改时触发。 |
| `model` | `name: string` | emit | 调用 `model.extend()` 时触发。 |
| `login-added` | `bot: Bot` | emit | 添加机器人时触发。 |
| `login-removed` | `bot: Bot` | emit | 移除机器人时触发。 |
| `login-updated` | `bot: Bot` | emit | 机器人状态发生改变时触发。 |

> `dispose` 官方 WARNING（原样）：
> 请注意，`dispose` 事件的目的是清理副作用而不是确保数据保存。当 Koishi 进程崩溃或是被强行中止时，`dispose` 事件都可能不会触发。为了保护你的数据，你应当在每一次修改后立即上传数据，而不是在 `dispose` 中处理收尾工作。

> 文档中**没有** `connect` / `disconnect` / `before-command` 事件。

## C7. 中间件（`guide/basic/middleware.html` 原样）

> 中间件是对消息事件处理流程的再封装。你注册的所有中间件将会由一个事件监听器进行统一管理，数据流向下游，控制权流回上游——这可以有效确保了任意消息都只被处理一次。

> 与事件系统的通用性不同，中间件专注于消息事件。你不能使用中间件处理其他类型的事件。

```ts
// 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
ctx.middleware((session, next) => {
  if (session.content === '天王盖地虎') {
    return '宝塔镇河妖'
  } else {
    // 如果去掉这一行，那么不满足上述条件的消息就不会进入下一个中间件了
    return next()
  }
})
```

> 中间件与事件的写法非常相似，但有三点区别：
> - 事件使用 `ctx.on()` 注册，而中间件使用 `ctx.middleware()` 注册
> - 中间件的回调函数接受额外的第二个参数 `next`，只有调用了它才会进入接下来的流程
> - 中间件支持直接返回要发送的内容，而事件需要手动调用 `session.send()`

取消注册：

```ts
declare const callback: import('koishi').Middleware
// ---cut---
const dispose = ctx.middleware(callback)
dispose() // 取消中间件
```

### 异步中间件（原样）

```ts
ctx.middleware(async (session, next) => {
  // 获取数据库中的用户信息
  // 这里只是示例，事实上 Koishi 会自动获取数据库中的信息并存放在 session.user 中
  const user = await session.getUser(session.userId)
  if (user.authority === 0) {
    return '抱歉，你没有权限访问机器人。'
  } else {
    return next()
  }
})
```

> 注意：异步中间件代码中，`next` 函数被调用时前面必须加上 await (或者 return)。如果删去将可能会导致时序错误，这在 Koishi 中将会抛出一个运行时警告。

### 前置中间件（原样）

> 向 `ctx.middleware()` 传入额外的第二个参数 `true` 以注册前置中间件。所有消息会优先经过前置中间件……并且你获得了决定这条消息是否继续触发其他中间件的能力。

```ts
let times = 0 // 复读次数
let message = '' // 当前消息

ctx.middleware((session, next) => {
  if (session.content === message) {
    times += 1
    if (times === 3) return message
  } else {
    times = 0
    message = session.content
    return next()
  }
}, true /* true 表示这是前置中间件 */)
```

### 临时中间件（原样）

> 你只需要在调用 `next` 时再次传入一个回调函数即可！这个回调函数只接受一个 `next` 参数，且只会加入当前的中间件执行队列；无论这个回调函数执行与否，在本次中间件解析完成后，它都会被清除。

```ts
ctx.middleware((session, next) => {
  if (session.content === 'hlep') {
    // 如果该 session 没有被截获，则这里的回调函数将会被执行
    return next('你想说的是 help 吗？')
  } else {
    return next()
  }
})
```

```ts
let times = 0 // 复读次数
let message = '' // 当前消息

ctx.middleware((session, next) => {
  if (session.content === message) {
    times += 1
    if (times === 3) return next(message)
  } else {
    times = 0
    message = session.content
    return next()
  }
}, true)
```

### `next()` 返回值语义（`cmd.execute` / `session.execute` 相关）

- 中间件/指令的解析结果通过 `next` 向上下游传递；临时中间件的回调在「信号未被截取」时被执行。
- `cmd.execute(argv, next?)`：**返回值:** `Promise<string>` 执行函数的返回结果，可用于指令插值。

---

# D. 定时与异步

## D1. 官方计时器 API（`api/service/timer.html` 原样）

### ctx.setTimeout(callback, delay)
- **callback:** `Function` 回调函数
- **delay:** `number` 延迟时间 (毫秒)
- 返回值: `() => void`
- 在指定的延迟时间后执行回调函数。返回的函数可以用于取消此计时器。

### ctx.setInterval(callback, delay)
- **callback:** `Function` 回调函数
- **delay:** `number` 延迟时间 (毫秒)
- 返回值: `() => void`
- 在指定的延迟时间后执行回调函数，然后每隔指定的延迟时间重复执行。返回的函数可以用于取消此计时器。

### ctx.sleep(delay)
- **delay:** `number` 延迟时间 (毫秒)
- 返回值: `Promise<void>`
- 等待指定的延迟时间。如果在此期间插件被停用，将会抛出一个错误。

### ctx.throttle(callback, delay, noTrailing?)
- **noTrailing:** `boolean` 是否禁用尾随调用
- 返回值: `WithDispose<F>`
- 返回一个函数，该函数在指定的周期内最多执行一次……返回函数的 `dispose()` 方法可用于取消此计时器。

### ctx.debounce(callback, delay)
- 返回值: `WithDispose<F>`
- 返回一个函数，该函数会忽略小于指定间隔的所有高频调用……返回函数的 `dispose()` 方法可用于取消此计时器。

另外 `ctx` 的服务清单中列出（`api/core/context.html`）：`ctx.setInterval` / `ctx.setTimeout` / `ctx.sleep` / `ctx.throttle` / `ctx.timer`。

## D2. cron（每日 0 点重置）

- 官方**核心**文档未提供 cron API。
- **第三方社区插件** koishi-plugin-cron（https://cron.koishi.chat/ ，仓库 github.com/koishijs/koishi-plugin-cron）提供 `ctx.cron()`：

> koishi-plugin-cron 提供了名为 `ctx.cron()` 的 API，用于分配定时任务。具体语法可以参考 GNU Crontab。

```ts
ctx.cron('0 0 * * *', () => {
  // 在每天 0 点执行
})

ctx.cron('15,45 * * * *', () => {
  // 在每小时的 15 分和 45 分执行
})

ctx.cron('*/2 * * * *', () => {
  // 每隔 2 分钟执行
})

ctx.cron('0 8 * * 1', () => {
  // 每周一早上 8 点执行
})
```

> 这是社区插件而非 Koishi 核心，使用时需确认已安装并加载该插件。

## D3. 「用户离线期间时间流逝」结算

- 所阅读的全部官方页面中**没有**离线挂机结算的官方式样或最佳实践。
- 与之相关的事实性构件：
  - `session.event.timestamp`：`number` 事件的时间戳（`session.timestamp` 访问器为 `string`，完整写法 `session.event.timestamp`）。
  - `ready` 事件：应用启动时触发；如果应用已经处于启动状态，则会立即触发。
  - `ctx.setInterval` / `ctx.setTimeout` / `ctx.sleep` / `ctx.throttle` / `ctx.debounce`（§D1）。
  - 主动交互（含定时任务、通知推送）可使用 `bot.broadcast()` / `ctx.broadcast()`（§B4）。
  - 数据持久化注意 `dispose` 的 WARNING：不能依赖它在退出时保存数据。

---

# 常见坑与注意事项

1. **`:text` 参数会吞掉后面的选项**（原样）：「文本参数的解析优先级很高，即使是之后的内容中含有选项也会被一并认为是该参数的一部分。因此，当使用文本参数时，应确保选项写在该参数之前，或使用引号将要输入的文本包裹起来。」帮助文本里官方自己也写了：「注意：参数请写在最前面，不然会被当成 message 的一部分！」
2. **参数不足不会报错到 action**：「如果传入的参数不足，则对应的参数不会被传入，因此你需要自己处理可能的 `undefined`。」
3. **必选/可选在程序上无差别**：除语义与报错信息外，「这两种参数在程序上是没有区别的」，且「默认情况下 `action` 回调函数从第二个参数起也总是字符串」。
4. **多余参数被忽略**：「如果用户输入了额外的参数，那么会被忽略。」
5. **别名冲突会导致插件加载失败**（原样）：「如果用户加载的多个插件都注册了同一个指令别名，那么后一个加载的插件将直接加载失败。」且不建议以常用词作别名。
6. **`usage()` 只保留最后一次**，`example()` 会累加。
7. **`hidden` 隐藏项仍可调用**，只是不出现在 help 中；需 `help -H` / `help bar -H` 查看。
8. **未注册选项会被识别**：「支持识别未注册选项，同时会根据传入的命令行推测是否需要参数」；`no-` 前缀会被处理为 `false`；`--foo-bar` 会驼峰化为 `fooBar`；`-adb` 这种连写会把值给最后一个字母。
   - 若要禁止未知选项，需要 `ctx.command(..., { checkUnknown: true })`；参数个数检测需要 `checkArgCount: true`（两者默认都是 `false`）。
9. **选项 `type` 校验失败文案**：「选项 beta 输入无效，请检查语法。」；参数类型失败文案：「参数 arg 输入无效，请提供一个数字。」
10. **异步中间件必须 `await`/`return` `next()`**：「如果删去将可能会导致时序错误，这在 Koishi 中将会抛出一个运行时警告。」
11. **中间件只处理消息事件**：「你不能使用中间件处理其他类型的事件。」
12. **`dispose` 不保证保存数据**（见 §C6 WARNING），官方明确要求在「每一次修改后立即上传数据」。
13. **`prefix` 顺序**：`prefix` 默认 `['']`；设置多个值时**空串 `''` 必须写在最后一个**；`prefix` 为空列表则只能通过私聊 / `nickname` / @机器人 触发。
14. **XSS**：直接发送未经转义的用户输入非常危险；Koishi 默认会对指令参数进行转义，使用 `h.unescape()` 等 API 时必须自行确保输入安全。
15. **子指令不进全局 help 列表**，只显示在父指令帮助里；派生式子指令名带父指令名与小数点（`user.locale`），父指令无功能时可用空格代替小数点（`user locale zh`）。
16. **`session.prompt()` 超时返回值不一致**：无回调形式超时返回 `null`；回调形式超时返回 `undefined`。且「超时前的下一次输入都不会进入中间件处理流程」。
17. **`session.channel` / `session.user` 是 Koishi 内置数据表数据**，不是平台数据；平台数据要用 `session.event.channel` / `session.event.user`。
18. **`ctx.broadcast()` 需要数据库**，且会对不存在的频道输出警告；`<execute>` 等消息组件在 `ctx.broadcast()` 中会抛错。
19. **消息元素属性名**：标准元素用 `src`（`<img src=...>`、`h.image(url)` 是函数名，参数是 URL）；`<image url="..."/>` 在官方 echo 示例中也可被渲染。
20. **文档版本差异**：`cmd.shortcut()` 只存在于 Koishi v1 文档，当前 API 页无此方法；事件名 `bot-status-updated`（guide 示例）与 API 表中的 `login-updated` 并存，需按实际类型定义使用。
21. **`ctx.middleware()` 注册返回 dispose 函数**，插件卸载时若未取消会残留（官方示例用 `dispose()` 取消）。
