# Koishi 官方开发指南 · 技术笔记（逐字抄录版）

> **用途**：为「Koishi 平台的修仙挂机文字游戏 QQ 机器人插件」的开发指南提供事实底稿。
> **取材原则**：凡官方文档写明写法 / 命令 / 字段名处，一律**逐字抄录原文代码块与命令**，不做改写、不做归纳性发挥。凡官方文档未写明的，统一在文末「文档未覆盖 / 待确认」一节显式标注，**不臆测**。

## 0. 取材来源

### 0.1 用户指定的 8 个页面（正文已全文读取）

| # | 页面 | URL |
|---|------|-----|
| 1 | 环境搭建 | https://koishi.chat/zh-CN/guide/develop/setup.html |
| 2 | 配置文件 | https://koishi.chat/zh-CN/guide/develop/config.html |
| 3 | 启动脚本 | https://koishi.chat/zh-CN/guide/develop/script.html |
| 4 | 工作区开发 | https://koishi.chat/zh-CN/guide/develop/workspace.html |
| 5 | 认识插件 | https://koishi.chat/zh-CN/guide/plugin/ |
| 6 | 配置构型 | https://koishi.chat/zh-CN/guide/plugin/schema.html |
| 7 | 生命周期 | https://koishi.chat/zh-CN/guide/plugin/lifecycle.html |
| 8 | 服务与依赖 | https://koishi.chat/zh-CN/guide/plugin/service.html |

### 0.2 为补全用户提问点而额外读取的官方页面

| 页面 | URL | 补什么 |
|------|-----|--------|
| 发布插件 | https://koishi.chat/zh-CN/guide/develop/publish.html | `package.json` 必要字段、`koishi` 字段 |
| 配置构型演练场索引 | https://koishi.chat/zh-CN/schema/ | Schema 类型总目录 |
| 必需与可选 | https://koishi.chat/zh-CN/schema/meta/required.html | `.required()` |
| 默认值 | https://koishi.chat/zh-CN/schema/meta/default.html | `.default()` |
| 标题与描述 | https://koishi.chat/zh-CN/schema/meta/description.html | `.description()` |
| 禁用与隐藏 | https://koishi.chat/zh-CN/schema/meta/disabled.html | `.disabled()` `.hidden()` `.deprecated()` `.experimental()` |
| 配置项外观 | https://koishi.chat/zh-CN/schema/meta/role.html | `.role()` |
| 嵌套类型 | https://koishi.chat/zh-CN/schema/meta/nested.html | 嵌套 / 简写形式 |
| 数值 (Number) | https://koishi.chat/zh-CN/schema/basic/number.html | `.min()` `.max()` `.step()` |
| 字符串 (String) | https://koishi.chat/zh-CN/schema/basic/string.html | `.pattern()`、string 的 role |
| Intersect：分组 | https://koishi.chat/zh-CN/schema/advanced/intersect.html | `Schema.intersect()` `.collapse()` |
| Union：单选框 | https://koishi.chat/zh-CN/schema/advanced/union-select.html | `Schema.union()` `Schema.const()` |
| 创建模板项目 | https://koishi.chat/zh-CN/manual/starter/boilerplate.html | 创建 / 启动命令 |

> ⚠️ **抓取限制说明**：koishi.chat 使用 VitePress 的「npm / yarn」双标签页。抓取工具只渲染**当前激活的 npm 标签页**，yarn 标签页的代码块无法取得；GitHub / raw.githubusercontent.com 在本环境不可访问（DNS 解析到非公网 IP），因此**无法读取文档的 Markdown 源文件**。凡 yarn 变体命令，本文只记录在正文叙述中被明确写出的那些（如 `yarn dev`、`yarn pub`），其余标注为「文档中的 yarn 标签页内容未取得」。

---

# A. 工程与工作区

## A.1 运行环境要求

> Koishi 需要 [Node.js](https://nodejs.org/) (**最低 v18，推荐使用 LTS**) 运行环境，你需要自己安装它。

创建项目的目录要求（原文 TIP）：

> 这个目录不宜过长，且路径中请避免出现中文或者空格。我们推荐的目录如下：
> - Windows：`C:\dev` 或者 `D:\dev` (也不要直接在盘根创建项目，最好是建一层目录)
> - 其他操作系统：`~/dev`

## A.2 安装包管理器

```sh
# 安装 yarn
npm i -g yarn

# 查看版本
yarn -v
```

Windows 报错 `yarn：无法加载文件 yarn.ps1，因为在此系统上禁止运行脚本。` 时：

```sh
Set-ExecutionPolicy RemoteSigned
```

## A.3 配置镜像源

```sh
npm config set registry https://registry.npmmirror.com
```

登录 npm 账号（发布插件用）：

```sh
npm login --registry=https://registry.npmjs.org
```

## A.4 版本控制

```sh
git --version           # git version 2.39.1
```

```sh
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

> 它们将会默认作为你创建的插件的作者，也会出现在你的提交记录中。

## A.5 创建模板项目（确切的命令）

» 来源：`/zh-CN/guide/develop/setup.html`（「安装 Koishi」节）与 `/zh-CN/manual/starter/boilerplate.html`

打开命令行，并进入你想要创建 Koishi 项目的目录。输入下面的命令以创建 Koishi 项目：

```sh
npm init koishi@latest
```

> 跟随提示即可完成全套初始化流程。

启动应用（boilerplate 页原文）：

```sh
npm start
```

> **注意**：官方文档用的是 `npm init koishi@latest`，**不是** `npx create-koishi`。文档中未出现 `npx` 形式的创建命令。

## A.6 工作区目录结构

» 来源：`/zh-CN/guide/develop/workspace.html`（「创建新插件」节）

在应用目录运行下面的命令以创建一个新的插件工作区：

```sh
npm run setup [name] -- [-c] [-m] [-G]
```

- **name:** 插件的包名，缺省时将进行提问
- **\-c, --console:** 创建一个带控制台扩展的插件
- **\-m, --monorepo:** 创建 monorepo 的插件
- **\-G, --no-git:** 跳过 git 初始化

假设你创建了一个叫 `example` 的插件，你将看到下面的目录结构（**原文逐字**）：

```
root
├── external
│   └── example
│       ├── src
│       │   └── index.ts
│       └── package.json
├── koishi.yml
└── package.json
```

**插件放在 `external/<插件目录名>/` 下**，源码在 `external/<name>/src/index.ts`，配置文件是应用目录下的 `koishi.yml`。

> ⚠️ **文档内部不一致（必须留意）**：`/zh-CN/guide/develop/publish.html` 在「准备工作」一节给出的目录树却是 `plugins/` 而非 `external/`：
> ```
> root
> ├── plugins
> │   └── example
> │       ├── src
> │       │   └── index.ts
> │       └── package.json        # 你应该修改这里
> ├── koishi.yml
> └── package.json                # 而不是这里
> ```
> 同页 TIP 原文：**「请注意 `package.json` 文件不是唯一的，它在应用目录和每个插件目录都会存在。请确保你修改了正确的文件。」**
> 以「工作区开发」页的 `external/` 为准；`plugins/` 应为文档未同步更新的旧写法。

## A.7 新建插件后的默认源码

» 来源：`/zh-CN/guide/develop/workspace.html`，`index.ts` 原文：

```ts
import { Context } from 'koishi'

export const name = 'example'

export function apply(ctx: Context) {
  // 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
  ctx.on('message', (session) => {
    if (session.content === '天王盖地虎') {
      session.send('宝塔镇河妖')
    }
  })
}
```

加载方式（原文）：

> 以 [开发模式](./script.html#开发模式) 重新运行你的项目，在左侧活动栏前往「插件配置」，在插件列表中选择一个分组或选择最顶上的「全局配置」，此时可以在右上角找到「添加插件」按钮。点击该按钮并选择你刚才创建的插件名称，你会立即在网页控制台的配置界面中看到 `example` 插件。只需点击启用，你就可以实现与机器人的对话了。

## A.8 创建私域插件（scoped）

» 来源：`/zh-CN/guide/develop/workspace.html`

假设你的 npm 用户名是 `alice`：

```sh
npm run setup @alice/example
```

此外还需要额外修改 `tsconfig.json`（**原文逐字**）：

```json
{
  "extends": "./tsconfig.base",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // "@scope/koishi-plugin-*": ["external/*/src"],
      "@alice/koishi-plugin-*": ["external/*/src"],
    },
  },
}
```

> 找到高亮的一行代码，将其复制一份，并将 `@scope` 替换为你的 npm 用户名，然后将复制的这一行代码前面的注释符号去掉。

## A.9 TypeScript 配置与构建产物

### A.9.1 TypeScript 支持（开发模式）

» 来源：`/zh-CN/guide/develop/script.html`

> Koishi 模板项目**原生地支持 TypeScript 开发**。上述 `-r esbuild-register` 参数允许我们在运行时**直接使用工作区插件的 TypeScript 源代码**。

因此：**开发模式下不需要预先编译**，`esbuild-register` 在运行时直接转译 `.ts`。

### A.9.2 构建（确切的命令与产物路径）

» 来源：`/zh-CN/guide/develop/workspace.html`（「构建源代码」节）

> 上面的插件暂时还只能在开发模式下运行。如果想要在生产模式下使用或发布到插件市场，你需要构建你的源代码。在应用目录运行下面的命令：

```sh
npm run build [...name]
```

- **name:** 要构建的插件列表，缺省时表示全部插件

还是以上面的插件 `example` 为例（**原文逐字**）：

- 后端代码将输出到 `external/example/lib` 目录
- 前端代码将输出到 `external/example/dist` 目录 (如果存在)

### A.9.3 tsconfig 的继承链

» 来源：`/zh-CN/guide/develop/workspace.html` 的 `tsconfig.json` 原文显示：

```json
{
  "extends": "./tsconfig.base",
  ...
}
```

即插件工作区从模板项目的 `tsconfig.base` 继承 TypeScript 配置（具体 `compilerOptions` 内容文档未展开）。

## A.10 依赖安装（含按 workspace 指定包的写法）

» 来源：`/zh-CN/guide/develop/workspace.html`（「添加依赖」节）

```sh
npm install [...deps] -w koishi-plugin-[name]
```

- **name:** 你的插件名称
- **deps:** 要添加的依赖列表

> 如果要添加的是 `devDependencies` 或者 `peerDependencies`，你也需要在命令后面加上 `-D` 或 `-P` 参数。关于服务类插件的依赖声明，请参考 [后续章节](./../plugin/service.html#关于-peerdependencies)。

**关键点**：`-w koishi-plugin-[name]` 里的 `[name]` 是**包名**（带 `koishi-plugin-` 前缀），例如 `-w koishi-plugin-example`。

## A.11 批量更新依赖版本

```sh
npm run dep
```

> 这将按照每个 `package.json` 中声明的依赖版本进行更新。举个例子，如果某个依赖的版本是 `^1.1.4`，而这个依赖之后发布了新版本 `1.2.3` 和 `2.3.3`，那么运行该指令后，依赖的版本将会被更新为 `^1.2.3`。

## A.12 二次开发（克隆他人仓库到 external）

开发插件：

```sh
npm run clone koishijs/koishi-plugin-forward
```

开发 Koishi 本身：

```sh
npm run clone koishijs/koishi
npm run build -w @root/koishi
```

> 模板项目支持已经内置了 Koishi 生态中的几个核心仓库 ([koishi](https://github.com/koishijs/koishi), [satori](https://github.com/satorijs/satori), [minato](https://github.com/cordiverse/minato)) 的路径配置。
> 完成上述操作后，现在你的 `yarn dev` 已经能直接使用 Koishi 的 TypeScript 源码了！

## A.13 启动脚本（start / dev）

» 来源：`/zh-CN/guide/develop/script.html`

打开应用目录下的 `package.json` 文件（**原文逐字**）：

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development koishi start -r esbuild-register -r yml-register",
    "start": "koishi start"
  }
}
```

启动：

```sh
npm run start
```

开发模式启动：

```sh
npm run dev
```

> 如你所见，`dev` 相当于在 `start` 指令的基础上添加了额外的参数和环境变量。这些参数为我们启用了额外的特性，而环境变量则能影响插件的部分行为。

启动参数（原文）：

> 启动脚本支持 Node.js 的 [命令行参数](https://nodejs.org/api/cli.html)。例如，上面的 `-r` 对应于 `--require`，它将允许你加载 `.ts` 和 `.yml` 后缀的文件。

自动重启（原文）：

> Koishi 的命令行工具支持自动重启。当运行 Koishi 的进程崩溃时，如果 Koishi 已经启动成功，则监视进程将自动重新启动一个新的进程。

> ⚠️ **本节命令必须在[应用目录](#应用目录)下运行**（原文 TIP：*本节中介绍的命令行都需要在 [应用目录](./config.html#应用目录) 下运行*）。同样的 TIP 也出现在「工作区开发」与「发布插件」两节。

### A.13.1 用其他语言编写开发脚本（CoffeeScript 示例，原文逐字）

```json
{
  "scripts": {
    "dev": "koishi start -r coffeescript/register"
  },
  "devDependencies": {
    "coffeescript": "^2.7.0"
  }
}
```

> **DANGER**：我们并不推荐使用高级语言来编写配置文件，因为动态的配置无法支持环境变量、配置热重载和插件市场等特性。大部分情况下我们建议仅将 `-r` 用于开发目的。

### A.13.2 模块热替换（HMR）

> 内置插件 `@koishijs/plugin-hmr` 实现了插件级别的热替换。每当你修改你的本地文件时，Koishi 就会尝试重载你的插件，并在命令行中提醒你。

`koishi.yml` 原文：

```yaml
plugins:
  group:develop:
    $if: env.NODE_ENV === 'development'
    hmr:
      root: '.'
      # 要忽略的文件列表，支持 glob patterns
      ignore:
        - some-file
```

Linux 文件监听数量限制报错与修复（原文）：

```text
NOSPC: System limit for number of file watchers reached
```

```sh
echo fs.inotify.max_user_watches=524288 |
sudo tee -a /etc/sysctl.conf &&
sudo sysctl -p
```

> 另一种方案是只监听部分子路径，例如将 `root` 改为 `external/foo` (其中 `foo` 是你正在开发的插件目录，参见下一节的工作区指南)，这将忽略其他目录下的变化，并依然对你的插件进行热重载。当你同时开发多个插件时，你也可以将 `root` 改成一个数组来使用。

## A.14 配置文件 `koishi.yml`

» 来源：`/zh-CN/guide/develop/config.html`

### A.14.1 应用目录（配置文件所在位置）

> 配置文件所在的目录叫**应用目录**。根据你的安装方式，应用目录的位置可能不同：
> - 模板项目：你创建的项目目录，例如 `D:/dev/koishi-app`
> - 启动器 (zip)：解压目录下 `data/instances/default`
> - 启动器 (msi)：`C:/Users/你的用户名/AppData/Roaming/Koishi/Desktop/data/instances/default`
> - 启动器 (pkg)：`~/Library/Application Support/Koishi/Desktop/data/instances/default`
>
> 配置文件是应用目录下名为 `koishi.yml` 的文件。

### A.14.2 完整示例（原文逐字）

```yaml
# 全局设置
host: localhost
port: 5140

# 插件列表
plugins:
  # group 表示这是一个插件组
  group:console:
    # 波浪线前缀表示一个不启用的插件
    ~auth:
    console:
    logger:
    insight:
    market:
      # 以缩进的方式显示插件的配置项
      registry:
        endpoint: https://registry.npmmirror.com

  # 这里是一些零散的插件
  github:
  dialogue:
```

### A.14.3 全局设置

> 全局设置对应于配置文件中 `plugins:` 一行以上的部分。这里会包含一些最基础的配置项，例如网络设置、指令前缀、默认权限等。修改这里的配置项，会影响整个 Koishi 应用的行为而非某个插件。

### A.14.4 插件配置

`plugins` 是一个 YAML 对象，它的每一个键对应于插件的名称，而值则对应于插件的配置。当没有进行配置时，值可以省略 (或者写成 `{}`)。

```yaml
plugins:
  dialogue:
    # 这里是 koishi-plugin-dialogue 的配置
    context:
      enable: true
```

### A.14.5 插件名称解析规则

> 插件名称通常对应于插件发布时的包名。例如：
> - `market` 对应于官方插件 `@koishijs/plugin-market`
> - `dialogue` 对应于社区插件 `koishi-plugin-dialogue`

> 除了插件的包名外，插件名称还可以拥有一个可选的前缀 (`~`) 和后缀 (`:xxx`)。插件名称前的波浪线 (`~`) 表示该插件不会被启用。插件名称后的冒号后是插件的别名，当某个插件需要存在多组配置时这会非常有用。

### A.14.6 插件组（group）

```yaml
plugins:
  group:official:
    # 一层嵌套插件组下的 help 插件
    help:
    group:console:
      # 两层嵌套插件组下的 market 插件
      market:
```

### A.14.7 元信息（`$` 前缀）

```yaml
plugins:
  group:console:
    # 在控制台中折叠该插件组
    $collapsed: true
    status:
      # 仅对于 telegram 平台启用该插件
      $filter:
        $eq:
          - $: platform
          - telegram
```

### A.14.8 环境变量

插值语法：

```yaml
plugins:
  adapter-discord:
    token: ${{ env.DISCORD_TOKEN }}
```

> 除了系统提供的环境变量外，Koishi 还原生支持 [dotenv](https://github.com/motdotla/dotenv)。你可以在当前目录创建一个 `.env.local` 文件，并在里面填入你的环境变量。这个文件已经被包含在 `.gitignore` 中。

```sh
DISCORD_TOKEN = xxx
```

环境变量用于条件判断（模板项目原文）：

```yaml
plugins:
  desktop:
    $if: env.KOISHI_AGENT?.includes('Desktop')
```

### A.14.9 修改配置文件的流程

> 如果你使用的是模板项目，你需要手动修改它并重新启动 Koishi 应用；如果你使用的是启动器，则你可以直接在「插件配置」中进行调整，Koishi 会自动将这些改动写入配置文件。

1. 关闭当前 Koishi 应用
2. 在[应用目录](#a141-应用目录配置文件所在位置)下找到配置文件并进行编辑
3. 保存配置文件后再次启动 Koishi 应用

---

# B. 插件骨架与生命周期

## B.1 插件的三种基本形式

» 来源：`/zh-CN/guide/plugin/`（「插件的基本形式」节，**原文逐字**）

> 一个插件需要是以下三种基本形式之一：
> 1. 一个接受两个参数的函数，第一个参数是所在的上下文，第二个参数是传入的配置项
> 2. 一个接受两个参数的类，第一个参数是所在的上下文，第二个参数是传入的配置项
> 3. 一个对象，其中的 `apply` 方法是第一种形式中所说的函数
>
> 而一个插件在被加载时，则相当于进行了上述函数的调用。因此，下面的四种写法是基本等价的：

```ts
declare const callback: Middleware
/// ---cut---
ctx.middleware(callback)

ctx.plugin(ctx => ctx.middleware(callback))

ctx.plugin({
  apply: ctx => ctx.middleware(callback),
})

ctx.plugin(class {
  constructor(ctx) {
    ctx.middleware(callback)
  }
})
```

## B.2 具名插件

> 对于对象形式的插件，你还可以额外提供一个 `name` 属性作为插件的名称。对于函数和类形式的插件来说，插件名称便是函数名或类名。具名插件有助于更好地描述插件的功能，并被用于插件关系可视化中，实际上不会影响任何运行时的行为。

### 函数 / 整体导出对象形式（原文逐字）

`foo.ts`：

```ts
// 整体导出对象形式的插件
export interface Config {}

export const name = 'Foo'

export function apply(ctx: Context, config: Config) {}
```

### 类 / 默认导出形式（原文逐字）

`bar.ts`：

```ts
// 默认导出类形式的插件
class Bar {
  constructor(ctx: Context, config: Bar.Config) {}
}

namespace Bar {
  export interface Config {}
}

export default Bar
```

## B.3 嵌套的插件

`index.ts`（原文逐字）：

```ts
// 入口文件，从上述模块分别加载插件
import Foo from './foo'
import * as Bar from './bar'

export function apply(ctx: Context) {
  ctx.plugin(Foo)
  ctx.plugin(Bar)
}
```

> 这样当你加载上述模块时，就相当于同时加载了 foo 和 bar 两个模块。这样的做法不仅能够减轻心智负担，解耦出的模块还享受独立的热重载，你可以在不影响一个模块运行的情况下修改另一个的代码！
>
> 当你在开发较为复杂的功能时，可以将插件分解成多个独立的子插件，并在入口文件中依次加载这些子插件。许多大型插件都采用了这种写法。

## B.4 模块如何被 Koishi 当作插件加载

> 一个模块可以作为插件被 Koishi 的配置文件加载，其需要满足以下两条中的一条：
> - 此模块的**默认导出**是一个插件
> - 此模块的**导出整体**是一个插件
>
> 这两种写法并无优劣之分，你完全可以按照自己的需求调整导出的形式。按照惯例，如果你的插件是一个函数，我们通常直接导出 apply 方法，并将导出整体作为一个插件；如果你的插件是一个类，那么我们通常使用默认导出的形式。

> ⚠️ **TIP（原文，极易踩坑）**：这里默认导出的优先级更高。因此，**只要模块提供了默认导出，Koishi 就会尝试加载这个默认导出，而不是导出整体**。在开发中请务必注意这一点。

配置文件中的 `plugins` 字段：

```yaml
plugins:
  console:
  dialogue:
    prefix: '#'
```

路径解析逻辑（**原文逐字**）：

> - 对于 foo，我们将尝试读取 `@koishijs/plugin-foo` 和 `koishi-plugin-foo`
> - 对于 @foo/bar，我们将尝试读取 `@foo/koishi-plugin-bar`

换言之，上述配置文件相当于下面的代码：

```ts
app.plugin(require('@koishijs/plugin-console').default)
app.plugin(require('koishi-plugin-dialogue'), { prefix: '#' })
```

## B.5 插件的具名导出（元属性）总表

以下为官方文档中**实际出现**的全部具名导出：

| 导出名 | 形态 | 用途（文档原文依据） | 来源页 |
|--------|------|---------------------|--------|
| `apply` | `export function apply(ctx: Context, config: Config) {}` | 插件入口函数，"一个接受两个参数的函数，第一个参数是所在的上下文，第二个参数是传入的配置项" | 认识插件 / 配置构型 |
| `name` | `export const name = 'example'` | "你还可以额外提供一个 `name` 属性作为插件的名称"；"具名插件有助于更好地描述插件的功能，并被用于插件关系可视化中，实际上不会影响任何运行时的行为" | 认识插件 |
| `Config` | `export const Config: Schema<Config> = Schema.object({})` | "`Config` 应当是导出的插件的一个属性"，用于声明配置构型 | 配置构型 |
| `usage` | `export const usage = '这是一个示例插件。'` | "你还可以通过导出 `usage` 属性来为插件提供使用方法" | 配置构型 |
| `reusable` | `export const reusable = true` | "只需声明插件的 `reusable` 属性为 `true` 即可"（可重用插件）；类形式写在 `static reusable = true` | 生命周期 |
| `inject` | `export const inject = ['database']` | 声明服务依赖，数组或对象形式 | 服务与依赖 |
| `using` | `ctx.plugin({ using: ['console'], apply: ... })` | `ctx.inject()` 的等价写法，文档中作为对象形式出现 | 服务与依赖 |
| `filter` | （仅被提及，未给示例） | "类似的属性还有 `reusable`, `using`, `filter` 等等，我们将在接下来的几节中介绍它们的用法" | 配置构型 |

> ⚠️ **重要更正**：官方 8 个页面中**从未出现 `export const schema`**。当前 Koishi 版本声明配置构型用的是 **`export const Config`**（大写 C）。`export const schema` 是 Koishi 3 时代的写法，**不要**写进新指南。

### B.5.1 一个"完整的插件"（原文逐字）

» 来源：`/zh-CN/guide/plugin/schema.html`

```ts
export const name = 'example'
export const usage = '这是一个示例插件。'
export interface Config {}
export const Config: Schema<Config> = Schema.object({})
export function apply(ctx: Context, config: Config) {}
```

> 形如 `name` 和 `Config` 这样的属性，我们称之为插件的**元属性**。它们需要与插件的入口函数**同级导出**。

## B.6 函数式插件 vs 类插件：完整对照

### B.6.1 函数式（具名导出整体）

» 来源：`/zh-CN/guide/plugin/` 的 `foo.ts` + `/zh-CN/guide/plugin/schema.html` 的完整插件示例：

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
    // 输出当前的配置
    return `foo: ${config.foo}\nbar: ${config.bar}`
  })
}
```

### B.6.2 类插件（默认导出，配 `namespace` 放 Config）

» 来源：`/zh-CN/guide/plugin/schema.html`（**原文逐字**）

```ts
class Example {
  constructor(ctx: Context, config: Example.Config) {
    // 这里是插件实现
  }
}

namespace Example {
  export interface Config {}

  export const Config: Schema<Config> = Schema.object({
    // 这里是配置声明
  })
}

export default Example
```

类形式声明 `reusable`（» 来源：生命周期页 `bar.ts`，原文逐字）：

```ts
export default class Bar {
  static reusable = true
  constructor(ctx: Context) {}
}
```

## B.7 `apply` 的签名与 `ctx` 是什么

- 签名：`export function apply(ctx: Context, config: Config) {}` —— "第一个参数是所在的上下文，第二个参数是传入的配置项"
- `ctx` 的类型从 `koishi` 包导入：`import { Context } from 'koishi'`
- `ctx` 是什么（» 生命周期页「重新认识上下文」节，原文）：

> 上下文描述了机器人的一种可能的运行环境，而插件则是在这个环境中运行的。**每个插件的上下文互不相同，这才保证了插件的副作用可以被有效地回收。**
>
> 对于完整的运行环境有许多的刻画方式，而副作用的回收正是其中的一种。基于副作用的上下文也可以称为**插件上下文**。在接下来的章节中，我们还将看到运行环境的其他刻画维度，包括基于依赖的**服务上下文**和基于过滤器的**会话上下文**。

`ctx` 提供的 API 举例（文档正文中出现过的）：`ctx.on()`, `ctx.middleware()`, `ctx.command()`, `ctx.plugin()`, `ctx.inject()`, `ctx.set()`/服务属性（如 `ctx.database`、`ctx.assets`、`ctx.console`、`ctx.puppeteer`、`ctx.model`、`ctx.i18n`）、`ctx.registry.delete()`、`ctx.console.addEntry()`。

## B.8 生命周期事件（确切事件名）

» 来源：`/zh-CN/guide/plugin/lifecycle.html`

> 在 [事件系统](./../basic/events.html) 中，我们已经了解了由聊天平台推送的会话事件。除此以外，Koishi 也提供了一些生命周期事件。这些事件会在某些 Koishi 的运行阶段被触发，你可以通过监听它们来实现各种各样的功能。本节主要介绍与插件开发相关的一些核心事件。

**文档中明确给出的生命周期事件名只有三个**：`ready`、`dispose`、`fork`。

| 事件名 | 触发时机（文档原文） | 注册方式 |
|--------|---------------------|----------|
| `ready` | "`ready` 事件在应用启动时触发。如果一个插件在加载时，应用已经处于启动状态，则会立即触发。" | `ctx.on('ready', () => { ... })` |
| `dispose` | "在插件停用时"（`fork.dispose()` 被调用 / 插件被卸载时） | `ctx.on('dispose', () => { ... })` |
| `fork` | "`fork` 是一个生命周期事件，当插件每次被调用时都会触发。" | `ctx.on('fork', (ctx) => { ... })` |

> `ready` 事件适用场景（原文）：
> - 含有异步操作 (比如文件操作，网络请求等)
> - 希望等待其他插件加载完成后才执行的操作

### B.8.1 `dispose` 的完整示例（原文逐字）

```ts
// 一个示例的服务器插件
import { Context } from 'koishi'
import { createServer } from 'http'

export function apply(ctx: Context, config) {
  const server = createServer()

  ctx.on('ready', () => {
    // 在插件启动时监听端口
    server.listen(1234)
  })

  ctx.on('dispose', () => {
    // 在插件停用时关闭端口
    server.close()
  })
}
```

## B.9 插件卸载 / 重载时的资源清理约定

» 来源：`/zh-CN/guide/plugin/lifecycle.html`（「副作用与 `dispose` 事件」节）

**`ctx.plugin()` 返回 `Fork` 对象**（原文逐字）：

```ts
import { Context } from 'koishi'

function callback(ctx: Context) {
  // 编写你的插件逻辑
  ctx.on('message', callback1)
  ctx.command('foo').action(callback2)
  ctx.middleware(callback3)
  ctx.plugin(require('another-plugin'))
}

// 加载插件
const fork = ctx.plugin(callback)

// 停用这个插件，取消上述全部副作用
fork.dispose()
```

> 对于可重用的插件，`fork.dispose()` 也只会停用 `fork` 对应的那一次。如果你想取消全部的副作用，可以使用 `ctx.registry.delete()`：

```ts
// 移除可重用插件的全部副作用
ctx.registry.delete(plugin)
```

**清理约定（原文）**：

> Koishi 的插件系统支持热重载，即任何一个插件可能在运行时被多次加载和卸载。要实现这一点，我们就必须在插件被卸载时清除它的所有副作用。
>
> **绝大部分 `ctx` 方法都会在在插件被停用自动回收副作用**；然而，如果你使用了 `ctx` 之外的方法，你的代码还可能通过其他方式引入副作用，这时就需要通过 `dispose` 事件来手动清除它们。

> 💡 对挂机类插件的直接含义：用 `setInterval` / `setTimeout` / 自建 HTTP server / 文件监听等**非 ctx API** 引入的副作用，必须在 `ctx.on('dispose', ...)` 中手动清理，否则 HMR 重载会累积多个定时器。

## B.10 可重用性与 `fork` 事件

### B.10.1 默认不可重用

```ts
function callback() {
  console.log('called')
}

ctx.plugin(callback)
ctx.plugin(callback)
```

> 执行上面的代码，你会发现 `called` 只会被打印一次。这是因为 `ctx.plugin()` 会检测插件是否已经被加载：如果是，则会直接返回之前的 `Fork` 对象，而不会再次执行插件的逻辑。
>
> 采用这种设计的主要原因是，插件往往会占用某些资源，因此重复启用会导致预期之外的问题。例如，一个插件注册了某个指令，如果重复启用，那么这个指令也会被重复注册。

### B.10.2 声明 `reusable`

`reply.ts`（原文逐字）：

```ts
export const name = 'reply'
export const reusable = true    // 声明此插件可重用

export interface Config {
  input: string
  output: string
}

export function apply(ctx: Context, config: Config) {
  ctx.middleware((session, next) => {
    // 当用户发送 input 时，回复 output
    if (session.content === config.input) {
      return config.output
    }
    return next()
  })
}
```

多次调用：

```ts
import * as reply from './reply'

ctx.plugin(reply, { input: '天王盖地虎', output: '宝塔镇河妖' })
ctx.plugin(reply, { input: '宫廷玉液酒', output: '一百八一杯' })
```

类形式：`static reusable = true`（见 B.6.2）。

### B.10.3 维护共享状态：`fork` 事件

`count.ts`（原文逐字）：

```ts
export const name = 'count'

export function apply(ctx: Context) {
  let count = 0         // 这里保存了共享状态

  ctx.command('count').action(() => {
    return `此插件已被调用 ${count} 次。`
  })

  ctx.on('fork', (ctx) => {
    count += 1
    ctx.on('dispose', () => {
      count -= 1
    })
  })
}
```

原文要点：

> `fork` 事件实际上将插件分割成了两个不同的作用域。**外侧的代码仍然只会被执行一次，对应着不可重用的部分；而内侧的代码则会被执行多次，对应着可重用的部分。**
>
> 最后，`fork` 事件的回调函数与插件本身类似，也接受 `ctx` 和 `config` 两个参数，分别对应于该次调用时传入插件的参数。**外侧和内侧的 `ctx` 含义不同，请格外注意。**

### B.10.4 `reusable` 只是 `fork` 的语法糖（原文逐字）

```ts
ctx.plugin({
  reusable: true,
  apply: (ctx) => {
    ctx.middleware(callback)
  },
})
```

```ts
ctx.plugin((ctx) => {
  ctx.on('fork', (ctx) => {
    ctx.middleware(callback)
  })
})
```

**情况一：不可重用插件嵌套可重用插件** —— 原文结论：

> 然而，如果你直接将可重用插件嵌套在不可重用插件中，由于外层的插件只会执行一次，所以内层的插件也并不会被重复执行。这显然不是我们想要的结果。这就是为什么我们需要 `fork` 事件。当你需要在不可重用的插件中重用某段代码，你就应该使用 `fork` 事件。

**情况二：可重用插件嵌套不可重用插件**（原文逐字，含"该放哪里"的示范）：

```ts
export function apply(ctx: Context) {
  // 注册指令
  ctx.command('foo').action(callback)

  // 扩展控制台
  ctx.console.addEntry('/client')
}
```

```ts
import * as internal from './internal'

export const reusable = true

export function apply(ctx: Context, config: Config) {
  // 不可重用的部分被嵌套在独立的插件中
  ctx.plugin(internal)

  // 中间件是可以重复注册的
  ctx.middleware(callback)
}
```

## B.11 生命周期事件的权威清单

» 来源：https://koishi.chat/zh-CN/api/core/events.html（API 参考「事件 (Events)」，本次补充抓取）

原文：**「## 生命周期事件 —— 这里的所有事件在全体上下文触发的 (即上下文选择器对这些事件无效)。」**

| 事件名 | 参数 | 触发方式 | 说明（原文） |
|--------|------|----------|-------------|
| `ready` | — | `parallel` | 应用启动时触发。如果应用已经处于启动状态，则会立即触发。 |
| `dispose` | — | `parallel` | 插件被卸载时触发。 |
| `service` | `name: string` 服务名称 | `emit` | 有服务被修改时触发。 |
| `model` | `name: string` 被扩展的表名 | `emit` | 调用 `model.extend()` 时触发。 |
| `login-added` | `bot: Bot` 机器人实例 | `emit` | 添加机器人时触发。 |
| `login-removed` | `bot: Bot` 机器人实例 | `emit` | 移除机器人时触发。 |
| `login-updated` | `bot: Bot` 机器人实例 | `emit` | 机器人状态发生改变时触发。 |

> ⚠️ **注意**：官方「生命周期事件」清单中**没有** `fork`。`fork` 是插件系统的内部事件（见 B.10.3），只在插件页讲，未列入 API 的「生命周期事件」分类。**也没有 `before-*` 形式的生命周期事件** —— `before-*` 属于**内置会话事件**，不是生命周期事件。

### B.11.1 确切的 `dispose` 数据安全警告（**对挂机游戏插件极其关键**）

» 原文 WARNING（API 事件页）：

> 请注意，**`dispose` 事件的目的是清理副作用而不是确保数据保存**。当 Koishi 进程崩溃或是被强行中止时，`dispose` 事件都可能不会触发。**为了保护你的数据，你应当在每一次修改后立即上传数据，而不是在 `dispose` 中处理收尾工作。**

即：**挂机收益 / 修炼进度必须在每次变更后立即写库，不能在 `dispose` 里做"退出时统一存档"。**

### B.11.2 确实存在的 `before-*` 事件（属于内置会话事件，不是生命周期事件）

» 来源：同一 API 事件页「内置会话事件」节

| 事件名 | 参数 | 触发方式 | 触发时机 |
|--------|------|----------|----------|
| `middleware` | `session: Session` | `emit` | 在执行完全部中间件后会在对应的上下文触发。 |
| `before-parse` | `content: string`、`session: Session` | `bail` | 尝试将文本解析成 Argv 对象时调用。你可以在回调函数中返回一个 Argv 对象以覆盖默认的解析行为。 |
| `parse` | `argv: Argv` | `bail` | 尝试将一个未识别出指令的 Argv 对象识别成指令调用时使用。 |
| `before-attach-channel` / `before-attach-user` | `session`、`fields: Set<string>` | `emit` | 当 Koishi 试图从数据库获取频道 / 用户信息前触发。你可以在回调函数中通过 `fields.add()` 修改传入的字段集合。**如果没有配置数据库，则两个事件都不会触发；如果不是群聊消息，则 before-attach-channel 事件不会触发。** |
| `attach-channel` / `attach-user` | `session: Session` | `serial` | 当 Koishi 完成频道 / 用户数据获取后触发。 |
| `command/before-attach-channel` / `command/before-attach-user` | `session: Argv`、`fields: Set<string>` | `emit` | 这两个事件触发于任意指令调用前。 |
| `before-send` | （会话） | — | 即将发送信息时会在对应的上下文触发。**由于该消息还未发送，这个会话并没有 `messageId` 属性。** 你可以通过修改 `session.content` 改变发送的内容，或者返回一个 truthy 值以取消该消息的发送。 |
| `command/before-execute` | `argv: Argv` | `serial` | 调用指令前会在对应的上下文触发。此时指令的可用性还未经检测，因此可能出现参数错误、权限不足、超过使用次数等情况。你可以通过在回调函数中返回一个字符串以取消该指令的执行。进一步，如果该字符串非空，则会作为此指令执行的结果。 |
| `command` | `argv: Argv` | `parallel` | 指令调用完毕后会在对应的上下文触发。 |

**通用会话事件**（由适配器实现，均含 `session` 参数，触发方式均为 `emit`）原文列出的完整清单：
`friend-request`、`guild-added`、`guild-member-added`、`guild-member-removed`、`guild-member-request`、`guild-member-updated`、`guild-removed`、`guild-request`、`guild-role-created`、`guild-role-deleted`、`guild-role-updated`、`guild-updated`、`login-added`、`login-removed`、`login-updated`、`message-created (message)`、`message-deleted`、`message-updated`、`reaction-added`、`reaction-removed`。

> 💡 在「认识插件」与「工作区开发」页出现的 `ctx.on('message', (session) => {...})` 中的 `message`，即上表 `message-created` 的别名。

---

# C. 配置构型 Schema

## C.1 为什么需要 Schema

» 来源：`/zh-CN/guide/plugin/schema.html`

> 为此，我们开发了 [schemastery](https://github.com/shigma/schemastery) 这个工具，并将它集成到了 Koishi 中。这个工具可以帮助你：
> - 验证某个配置项是否合法
> - 为可缺省的配置项提供默认值
> - 在控制台中通过表单让用户进行在线配置

## C.2 基本示例（原文逐字）

```ts
import { Context, Schema } from 'koishi'

export const name = 'example'

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
    // 输出当前的配置
    return `foo: ${config.foo}\nbar: ${config.bar}`
  })
}
```

> 在这个示例中，我们的插件导出了一个 `Config` 类型和一个同名的 `Schema` 对象。前者为我们的插件提供了类型，而后者则生成了对配置项的约束。我们可以看到，这个插件的配置项有两个属性，`foo` 是必需的，而 `bar` 则是可选的。**如果你不填写 `foo`，那么插件在启动时就会报错**；而如果你不填写 `bar`，那么它将会被赋予默认值 `1`。

## C.3 类型与链式修饰（guide 页原文逐字）

```ts
Schema.object({
  foo: Schema.array(Schema.string()),
  bar: Schema.dict(Schema.number()),
  baz: Schema.object({
    quz: Schema.boolean(),
  }),
})
```

```ts
Schema.number()
  // 限制取值范围
  .min(0).max(100).step(1)
  // 设置默认值
  .default(50)
  // 以滑动条的形式显示
  .role('slider')
  // 设置描述信息
  .description('这是一个介于 0 和 100 之间的整数。')
```

> 我们能做的还远不止于此。一些高级类型如 `intersect` 可用于将类型的分组显示；而 `union` 则可以创造联合类型。通过恰当地组合它们，你甚至可以构造出上下关联的配置项！

## C.4 Schema 类型总目录（官方演练场侧边栏，**权威清单**）

» 来源：https://koishi.chat/zh-CN/schema/

**核心概念（meta）**
- 必需与可选 `/schema/meta/required.html`
- 默认值 `/schema/meta/default.html`
- 标题与描述 `/schema/meta/description.html`
- 禁用与隐藏 `/schema/meta/disabled.html`
- 配置项外观 `/schema/meta/role.html`
- 嵌套类型 `/schema/meta/nested.html`

**基础类型（basic）**
- 数值 (Number) `/schema/basic/number.html`
- 字符串 (String) `/schema/basic/string.html`
- 布尔值 (Boolean) `/schema/basic/boolean.html`
- 日期 (Date) `/schema/basic/date.html`
- 位集 (Bitset) `/schema/basic/bitset.html`
- 对象 (Object) `/schema/basic/object.html`
- 元组 (Tuple) `/schema/basic/tuple.html`
- 字典 (Dict) `/schema/basic/dict.html`
- 数组 (Array) `/schema/basic/array.html`
- 路径 (Path) `/schema/basic/path.html`

**高级类型（advanced）**
- Intersect：分组 `/schema/advanced/intersect.html`
- Union：单选框 `/schema/advanced/union-select.html`
- Union：联合类型 `/schema/advanced/union-arbitrary.html`
- Intersect + Union：配置联动 1 `/schema/advanced/union-tagged-1.html`
- Intersect + Union：配置联动 2 `/schema/advanced/union-tagged-2.html`
- Transform：输入转换 `/schema/advanced/transform.html`
- Computed：条件求值 `/schema/advanced/computed.html`

## C.5 链式修饰方法（逐条，含原文示例）

### C.5.1 `.required()` / 可选

» 来源：`/schema/meta/required.html`（**原文逐字**）

> **默认情况下，所有配置项都是可选的。** 你可以通过 `.required()` 来声明一个必需的配置项。未配置的必需配置项的左侧会出现红色的提示线。
>
> 请注意：对于字符串等原始类型，空串和未配置是两个不同的概念。你可以通过控件中央的水平线来进行区分。

```ts
export default Schema.object({
  foo: Schema.boolean(),
  bar: Schema.string().required(),
})
```

示例输出（原文）：Input `null` → Output `"$.bar missing required value"`

### C.5.2 `.default()`

» 来源：`/schema/meta/default.html`（**原文逐字**）

> **WARNING：请注意：`.required()` 与 `.default()` 不能同时使用。**
>
> `.default()` 用于设置某个配置项的默认值。如果你传入了值，那么默认值将不会有任何行为；如果没有传入值，则默认值会作为初始状态呈现在表单中。
>
> 在配置项菜单中可以选择将配置项恢复为默认值。**如果你将某个配置项修改为了默认值，则该配置项实际上会被清除**，以确保配置文件的简洁性。

```ts
export default Schema.object({
  foo: Schema.string().default('lol'),
  bar: Schema.number().default(2333),
  baz: Schema.boolean().default(true),
})
```

Output（原文）：`{ "foo": "lol", "bar": 2333, "baz": true }`

### C.5.3 `.description()`

» 来源：`/schema/meta/description.html`（**原文逐字**）

> `.description()` 用于设置某个配置项的描述文本。**当添加在属性上时会显示在名称下方，当添加在对象上时则会表现为小标题。** 我们还支持了基本的行内 Markdown 语法。

```ts
export default Schema.object({
  foo: Schema.boolean().description('*斜体*的属性描述。'),
  bar: Schema.string().description('**粗体**的属性描述。'),
}).description('配置标题')
```

### C.5.4 `.disabled()` / `.hidden()` / `.deprecated()` / `.experimental()`

» 来源：`/schema/meta/disabled.html`（**原文逐字**）

> `.disabled()` 用于禁用某个配置项。禁用的配置项无法被用户编辑。`.hidden()` 用于隐藏某个配置项。隐藏的配置项不会呈现在表单中。但是它们仍然会参与类型检查。
>
> 许多应用会同时提供 API 和网页表单，而开发者可能不希望将全部配置项都提供给表单的填写者 (例如复杂的底层配置或者实验性设置)。在这种情况下，禁用或隐藏部分配置项将会是一个不错的选择。
>
> 除此以外，我们还提供了 `.deprecated()` 和 `.experimental()` 方法，它们分别用于标记已废弃和实验性的配置项。

```ts
export default Schema.object({
  foo: Schema.number().disabled(),
  bar: Schema.number().hidden(),
  baz: Schema.string().deprecated(),
  qux: Schema.string().experimental(),
  choice: Schema.union([
    Schema.const('foo').disabled(),
    Schema.const('bar').hidden(),
    Schema.const('baz').deprecated(),
    Schema.const('qux').experimental(),
  ]),
})
```

### C.5.5 `.role()`

» 来源：`/schema/meta/role.html`（**原文逐字**）

> `.role()` 描述了一个配置项的外观，而**不会影响该类型的实际行为**。不同类型的可选外观各有不同，我们将在每种类型的示例中分别介绍。

```ts
export default Schema.object({
  number: Schema.percent().role(''),
  string: Schema.string().role(''),
  choice: Schema
    .union(['foo', 'bar', 'qux'])
    .role(''),
})
```

```ts
export default Schema.object({
  number: Schema.percent().role('slider'),
  string: Schema.string().role('secret'),
  choice: Schema
    .union(['foo', 'bar', 'qux'])
    .role('radio'),
})
```

> ⚠️ 注意：`Schema.percent()` 在官方 role 页的示例中被使用（未在 /guide/ 8 页中出现）。

### C.5.6 `.min()` / `.max()` / `.step()`

» 来源：`/schema/basic/number.html`（**原文逐字**）

> `Schema.number()` 描述了一个数值，支持输入框和滑块。

```ts
export default Schema.object({
  foo: Schema.number(),
  bar: Schema.number().role('slider')
    .min(0).max(100).step(1).default(30),
})
```

Output（原文）：`{ "bar": 30 }`

### C.5.7 `.pattern()`

» 来源：`/schema/basic/string.html`

> 可以使用 `.pattern()` 限制输入的内容符合某个正则表达式。

```ts
export default Schema.object({
  text: Schema.string(),
  secret: Schema.string().role('secret').default('password'),
  link: Schema.string().role('link').default('https://github.com'),
  area: Schema.string().role('textarea', { rows: [2, 4] }),
  color: Schema.string().role('color'),
  custom: Schema.string().pattern(/^custom$/i),
})
```

### C.5.8 `.collapse()`

» 来源：`/schema/advanced/intersect.html`（**原文逐字**）

> Intersect 类型可用于合并多个类型。一种最常见的用法是将配置项分为多组显示。
>
> **使用 `.collapse()` 可以将分组默认折叠为一个单独的配置项。**

```ts
export default Schema.intersect([
  Schema.object({
    foo: Schema.number(),
    bar: Schema.string(),
  }).description('分组 1'),
  Schema.object({
    baz: Schema.string(),
    qux: Schema.boolean(),
  }).description('分组 2'),
])
```

> ✅ **`.collapse()` 不接收任何参数**（已在 `/schema/basic/object.html`、`basic/dict.html`、`basic/array.html`、`advanced/intersect.html` 四处逐一核对，全部写作裸 `.collapse()`）。
> 它可用于 **`Schema.object()` / `Schema.dict()` / `Schema.array()` / `Schema.intersect()` 分组**，效果为"将配置项/分组设置为默认折叠"。
> 各页原文：
> - `basic/object.html`：「使用 `.collapse()` 可以将对象默认折叠为一个单独的配置项。」`Schema.object({...}).collapse()`
> - `basic/dict.html`：「使用 `.collapse()` 可以将配置项设置为默认折叠。」
> - `basic/array.html`：示例中同样出现 `.collapse()`。

## C.6 `.role()` 的合法取值（按类型，逐字）

**数值（Number）**：`'slider'`（以滑动条的形式显示）；`''`（默认输入框）

**字符串（String）** —— 原文逐字：

> `Schema.string()` 描述了一个字符串，支持多种特殊外观。
> - **secret**：默认情况下不显示输入框中的内容，可点击按钮切换
> - **link**：点击可访问输入框中的链接 (同时输入框也会稍长一些)
> - **textarea**：输入框显示在配置项下侧，为自适应高度的多行文本域
>     - 可以通过 `rows` 属性来限制文本域的最小和最大行数
> - **color**：输入框显示为颜色选择器

`textarea` 的 `rows` 用法原文：`Schema.string().role('textarea', { rows: [2, 4] })`

**Union**：`'radio'` —— 原文逐字：

> 如果每个可选值有较长的描述文本，你可以进一步将 `role` 设置为 `radio`，这样一来所有的选项将显示在下方而不是右侧。

## C.7 复合与嵌套类型

### C.7.1 `Schema.object()` / `Schema.array()` / `Schema.dict()`

```ts
Schema.object({
  foo: Schema.array(Schema.string()),
  bar: Schema.dict(Schema.number()),
  baz: Schema.object({
    quz: Schema.boolean(),
  }),
})
```

### C.7.2 可简写的类型（**原文逐字，非常容易看错**）

» 来源：`/schema/meta/nested.html`

> 一些类型 (例如 [Object](./../basic/object.html) 和 [Array](./../basic/array.html)) 允许将其他类型作为参数传入，形成新的组合类型。你可以任意嵌套这些类型，以满足更复杂的需求。
>
> **例子里的 `String` 是 `Schema.string().required()` 的简写形式。类似的写法对于 `Number` 和 `Boolean` 也是成立的。**

```ts
Schema.object({
  foo: Schema.object({
    bar: Schema
      .array(Schema.object({
        baz: Schema.number().required(),
      }))
      .default([{ baz: 114514 }]),
    qux: Schema
      .dict(String)
      .default({ welcome: 'Hello World' }),
  }),
})
```

> 即：`String` ≡ `Schema.string().required()`；`Number` ≡ `Schema.number().required()`；`Boolean` ≡ `Schema.boolean().required()`。**注意简写形式自带 `.required()`。**

### C.7.3 `Schema.union()` + `Schema.const()`

» 来源：`/schema/advanced/union-select.html`（**原文逐字**）

> Union 描述了多个子类型的联合。它的最基础形式是从多个固定值中选择一个。**这里的每一个字符串是 `Schema.const()` 的简写形式。**

```ts
export default Schema.object({
  value1: Schema.union(['foo', 'bar', 'qux']),
  value2: Schema.union([
    Schema.const('foo').description('选项 1'),
    Schema.const('bar').description('选项 2'),
    Schema.const('baz').description('选项 3'),
  ]).role('radio'),
})
```

## C.8 配置项在控制台如何呈现 / 如何分组

依据以上原文，可直接引用的机制有：

1. **表单自动生成**：配置构型"在控制台中通过表单让用户进行在线配置"；每个属性渲染为一个控件。
2. **控件外观由 `.role()` 决定**，`.role()` 不影响实际行为。
3. **分组**：用 `Schema.intersect([...])` 合并多个 `Schema.object()`，并在每个分组对象上 `.description('分组 N')` 使其显示为**小标题**；`.collapse()` 可将分组默认折叠为一个单独的配置项。
4. **描述文本**：属性上的 `.description()` 显示在名称下方；对象上的 `.description()` 显示为小标题。支持行内 Markdown（`*斜体*`、`**粗体**`）。
5. **必需项提示**：未配置的必需配置项左侧出现红色提示线。
6. **默认值**：没传值时默认值作为初始状态呈现在表单中；把配置项改回默认值等于清除该项。
7. **隐藏**：`.hidden()` 的项不出现在表单中但仍参与类型检查；`.disabled()` 的项可见但不可编辑。
8. **插件级描述**：插件通过 `export const usage = '...'` 提供使用方法（显示于控制台插件详情）。
9. **`koishi` 字段的服务声明**："这些字段将显示在控制台中插件的详情页中，帮助使用者更好地理解插件的功能。"

## C.9 演练场全部页面补充（逐字抄录）

> 本节由子代理逐页抓取 `https://koishi.chat/zh-CN/schema/` 下**全部 24 页**汇编而成，独立完整版见同目录 `koishi-schema-api-reference.md`。下列代码块均与官网逐字一致。

### C.9.1 站点上确认存在的全部静态工厂方法

```
Schema.object({...})
Schema.string()
Schema.number()
Schema.boolean()
Schema.date()
Schema.bitset(Intents)                  // 也支持 Schema.bitset({ FOO: 1, BAR: 2, QUX: 4 })
Schema.array(Number) / Schema.array(String) / Schema.array(Schema.object({...}))
Schema.dict(Boolean) / Schema.dict(String) / Schema.dict(Schema.object({...}))
Schema.tuple([Number, Number])
Schema.union(['foo', 'bar', 'qux'])      // 字符串简写形式
Schema.union([TypeA, TypeB, ...])        // 类型形式
Schema.intersect([...])
Schema.const('foo') | Schema.const(true) | Schema.const(false) | Schema.const()   // 允许无参 = "未设置"
Schema.path() | Schema.path({ filters: ['.png', '.jpg', 'directory'] })
Schema.percent()                         // 仅在 meta/role.html 出现，无文字规格说明
Schema.transform(String, value => [value])
Schema.computed(Number)                  // 仅见此调用形式
```

**简写形式**（`meta/nested.html`）：`String` = `Schema.string().required()`；`Number`、`Boolean` 同理。
> 注意 `String` / `Number` / `Boolean`（大写开头，**不是** `Schema.` 前缀）自带 `.required()`。

⛔ **站点上不存在的**（勿编造）：`Schema.natural`、`Schema.from`、`Schema.to`。

### C.9.2 Union 联合类型（任意类型联合）

» 来源：`/schema/advanced/union-arbitrary.html`（**原文逐字**）

```ts
export default Schema.object({
  value: Schema.union([
    Schema.const().description('unset'),
    Schema.number().description('number'),
    Schema.string().description('string'),
    Schema.const(true).description('true'),
    Schema.const(false).description('false'),
    Schema.object({
      foo: Schema.string(),
      bar: Schema.number(),
    }).description('object'),
  ]),
})
```

> 原文：「你需要给每个子类型提供一个 `description`，它们会作为表单中呈现的选项。」
> ⚠️ 注意 `Schema.const()` **不带参数是合法的**，表示"未设置"。

### C.9.3 Intersect + Union：配置联动（**修仙游戏配置最实用的一节**）

» 来源：`/schema/advanced/union-tagged-1.html`（**原文逐字**）

```ts
export default Schema.intersect([
  Schema.object({
    enabled: Schema.boolean().default(false),
  }).description('基础配置'),
  Schema.union([
    Schema.object({
      enabled: Schema.const(true).required(),
      foo: Schema.number().description('请输入一个数值。'),
      bar: Schema.string().description('请输入一个字符串。'),
    }),
    Schema.object({}),
  ])
])
```

原文 TIP：

> 由于配置项默认情况下都是可选的，所以下方的 `enabled` 如果类型与上方的默认值不同，就必须加上 `required()`；反过来，如果相同，你就不应该加上 `required()` (你甚至可以缺省不写，这就是为什么最下面出现了一个空白的 `object({})`)。
> Input `null` → Output `{ "enabled": false }`

» 来源：`/schema/advanced/union-tagged-2.html`（**原文逐字**）

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

原文 TIP：

> 由于配置项默认情况下都是可选的，所以下方的 `type` 配置项如果类型与上方的默认值不同，就必须加上 `required()`。在这个例子中，`type` 本来就是一个必需属性，所以下方的每一个 `type` 都必须加上 `required()`。
> Input `null` → Output `"$.type missing required value"`

### C.9.4 Transform：输入转换

» 来源：`/schema/advanced/transform.html`（**原文逐字**）

```ts
export default Schema.object({
  value: Schema.union([
    Schema.array(String),
    Schema.transform(String, value => [value]),
  ]).default([]),
})
```

> 原文：「Transform 用于定义一个转换类型，通常与 Union 一同使用。当输入满足一参数类型时，将调用二参数转换输入作为输出。此次转换将直接修改输入的对象，以确保类型满足输出类型。**在网页表单中，将只会显示输出类型。**」
> 签名形式：`Schema.transform(InputType, value => OutputValue)`

### C.9.5 Computed：条件求值

» 来源：`/schema/advanced/computed.html`

```ts
export default Schema.object({
  foo: Schema.computed(Number),
}).description('配置项')
```

> 原文：「`Schema.computed()` 类型可用于合并多个类型。一种最常见的用法是将配置项分为多组显示。」（仅见此单类型参数调用形式）
> ⚠️ 原文 TIP：「**此类型只能在 Koishi 中使用。**」

### C.9.6 基础类型逐个补充

**`Schema.boolean()`**（`/schema/basic/boolean.html`，原文逐字）

```ts
export default Schema.object({
  enable: Schema.boolean(),
})
```
> 原文：「`Schema.boolean()` 以开关的形式描述了一个布尔值。」（该页**未给出** boolean 专属的 `role` 取值）

**`Schema.date()`**（`/schema/basic/date.html`，原文逐字）

```ts
export default Schema.object({
  value: Schema.date(),
  datetime: Schema.string().role('datetime'),
  date: Schema.string().role('date'),
  time: Schema.string().role('time'),
})
```
> 原文：「Date 类型与 `datetime` 的前端体验是完全一致的，唯一区别在于输出的格式不同。字符串额外多出 `date` 和 `time` 两种格式」

**`Schema.bitset()`**（`/schema/basic/bitset.html`，原文逐字）

```ts
const enum Intents {
  FOO = 1,
  BAR = 2,
  QUX = 4,
}

export default Schema.object({
  bitset: Schema.bitset(Intents)
    .default(Intents.FOO | Intents.QUX),
  array: Schema
    .array(Schema.union(['FOO', 'BAR', 'QUX']))
    .default(['FOO', 'QUX'])
    .role('checkbox'),
})
```
> Input `null` → Output `{ "bitset": 5, "array": [ "FOO", "QUX" ] }`
> 原文：输出为整数，输入可以是整数或字符串数组；`.role('checkbox')` 使输出变为字符串数组；`.role('select')` 为复选菜单。

**`Schema.object()` + `.collapse()`**（`/schema/basic/object.html`，原文逐字）

```ts
export default Schema.object({
  foo: Schema.string().required(),
  bar: Schema.number(),
  baz: Schema.object({
    qux: Schema.boolean(),
  }),
  nested: Schema.object({
    inner: Schema.string(),
  }).collapse(),
})
```
> 原文：「使用 `.collapse()` 可以将对象默认折叠为一个单独的配置项。」

**`Schema.tuple()`**（`/schema/basic/tuple.html`，原文逐字）

```ts
export default Schema.object({
  point: Schema.tuple([Number, Number]),
})
```
> 原文 TIP：「目前我们只支持元组内部元素是原始类型 (String, Number, Boolean) 的情况。」「它们会被显示在同一行中。」

**`Schema.dict()`**（`/schema/basic/dict.html`，原文逐字）

```ts
export default Schema.object({
  dict: Schema.dict(Boolean),
  table1: Schema.dict(String).role('table'),
  table2: Schema.dict(Schema.object({
    foo: Schema.string(),
    bar: Schema.number(),
  })).role('table'),
})
```
> 原文：「使用 `.collapse()` 可以将配置项设置为默认折叠。使用 `.role('table')` 可以将字典以表格形式显示。」

**`Schema.array()`**（`/schema/basic/array.html`，原文逐字）

```ts
export default Schema.object({
  array: Schema.array(Number),
  table1: Schema.array(String).role('table'),
  table2: Schema.array(Schema.object({
    foo: Schema.string(),
    bar: Schema.number().experimental(),
    qux: Schema.bitset({ FOO: 1, BAR: 2, QUX: 4 }).default(5),
  })).role('table'),
})
```
> 原文 TIP：「对于已知字符串构成的数组，还可以使用 `.role('checkbox')` 或 `.role('select')`，将它们以复选框或复选菜单的形式显示。」

**`Schema.path()`**（`/schema/basic/path.html`，原文逐字）

```ts
export default Schema.object({
  path1: Schema.path(),
  path2: Schema.path({
    filters: ['.png', '.jpg', 'directory'],
  }),
})
```
> 原文 TIP：「此类型基于 `@koishijs/plugin-explorer`，**仅在加载该插件时可用**。未加载该插件时，类型只会表现为普通的字符串」
> 原文：「如果是相对路径，则会基于 `ctx.baseDir` 进行解析。该配置项会显示成一个能够打开文件选择器的按钮。支持传入一些额外的选项：`allowCreate`：是否允许创建目录和上传文件 / `filters`：可选的文件的扩展名列表，扩展名全需要以 `.` 开头；特别地其中如果包含 `directory` 则表示可以选择文件夹」

### C.9.7 `.role()` 合法取值完整表（仅列文档中出现的）

| 类型 | 合法 `.role()` 取值 |
|------|---------------------|
| **Number** | `''`（默认外观）、`'slider'` |
| **String** | `''`、`'secret'`、`'link'`、`'textarea'`（可配 `{ rows: [2, 4] }`）、`'color'`、`'datetime'`、`'date'`、`'time'` |
| **Union** | `''`、`'radio'`（选项渲染在下方而非右侧） |
| **Array** | `'table'`、`'checkbox'`、`'select'`（后两者用于已知字符串数组） |
| **Dict** | `'table'` |
| **Bitset** | `'checkbox'`（配合 `Schema.array(Schema.union([...]))` 时输出为字符串数组）、`'select'`（复选菜单） |
| **Boolean / Object / Intersect / Tuple / Path** | 文档**未给出**任何 role 取值 |

### C.9.8 修饰方法总表（含"未找到"）

| 方法 | 签名 | 含义 | 来源 |
|------|------|------|------|
| `.required()` | 无参 | 声明必需；未配置时左侧红色提示线；校验报错 `"$.bar missing required value"` | `/schema/meta/required.html` |
| `.default(v)` | `.default('lol'\|2333\|true\|30\|[]\|{...}\|枚举位)` | 设置默认值；**不能与 `.required()` 同用**；把值改回默认等于清除该键 | `/schema/meta/default.html` |
| `.description(text)` | `.description('配置标题')` | 属性上→显示在名称下方；对象上→表现为小标题；支持行内 Markdown；在 union 分支上→作为表单项选项文案 | `/schema/meta/description.html` |
| `.disabled()` | 无参 | 配置项无法被用户编辑 | `/schema/meta/disabled.html` |
| `.hidden()` | 无参 | 不呈现在表单中，但仍参与类型检查 | `/schema/meta/disabled.html` |
| `.deprecated()` | 无参 | 标记已废弃 | `/schema/meta/disabled.html` |
| `.experimental()` | 无参 | 标记实验性 | `/schema/meta/disabled.html`、`/schema/basic/array.html` |
| `.role(name)` | `.role('slider'\|'secret'\|'link'\|'textarea'\|'color'\|'datetime'\|'date'\|'time'\|'radio'\|'table'\|'checkbox'\|'select'\|'')` | 仅描述外观，**不影响实际行为** | `/schema/meta/role.html` |
| `.role(name, options)` | `.role('textarea', { rows: [2, 4] })` | 附带选项对象；`rows` 限制文本域最小/最大行数 | `/schema/basic/string.html` |
| `.min(n)` | `.min(0)` | 数值下界 | `/schema/basic/number.html` |
| `.max(n)` | `.max(100)` | 数值上界 | `/schema/basic/number.html` |
| `.step(n)` | `.step(1)` | 数值步长 | `/schema/basic/number.html` |
| `.pattern(regexp)` | `.pattern(/^custom$/i)` | 限制字符串内容匹配正则 | `/schema/basic/string.html` |
| `.collapse()` | **无参** | object/dict/array → 默认折叠为单项；intersect → 分组默认折叠 | `basic/object.html`、`basic/dict.html`、`basic/array.html`、`advanced/intersect.html` |
| `.comment(text)` | — | ⛔ **未在文档中找到** | — |
| `.toString()` | — | ⛔ **未在文档中找到** | — |
| `.set(...)` | — | ⛔ **未在文档中找到** | — |
| `.extra(...)` | — | ⚠️ 未在 `/schema/` 章节出现；仅见于 v4.14 更新日志「支持了 `.extra()` 方法和类型扩展」 | https://koishi.chat/zh-CN/releases/v4.14.html |

### C.9.9 控制台 / 表单渲染行为汇总（供"配置项如何呈现"一节引用）

- 必需项：左侧红色提示线；**空串与"未配置"是两个不同概念**，靠控件中央的水平线区分。
- 默认值：作为表单初始状态呈现；配置项菜单可恢复默认值；**改回默认值实际会清除该键**（保证配置文件简洁）。
- 描述：属性 → 名称下方；对象 → 小标题；支持行内 Markdown。
- `disabled` → 不可编辑；`hidden` → 不出现在表单但仍参与类型检查。
- `role` → 只改外观。
- `Schema.object().collapse()` → 默认折叠为单项；`dict`/`array` 的 `.role('table')` → 表格；`dict`/`array` 的 `.collapse()` → 默认折叠。
- number → 输入框或滑块；boolean → 开关；bitset → 复选框组；tuple 元素同一行显示。
- `Schema.path()` → 渲染为可打开文件选择器的按钮。
- `Schema.intersect()` → 分组；`.collapse()` 把分组折叠为一项。
- union + `.role('radio')` → 选项渲染在下方；每个分支的 `description` 即选项文案。
- `Schema.transform()` → 「在网页表单中，将只会显示输出类型。」
- v4.14 更新日志（配置界面）：schemastery-vue v7；`.collapse()`；`.experimental()` / `.deprecated()`；部分类型的"上方插入/下方插入"菜单项；bitset 的"全部选中"/"清空选择"；`.extra()` 与类型扩展。

---

# D. 服务与依赖注入

## D.1 服务的概念

» 来源：`/zh-CN/guide/plugin/service.html`

> 在之前的章节中，你或许已经意识到了 Koishi 的大部分特性都是围绕上下文进行设计的……换言之，应用其实可以被理解成一个容器，搭载了各种各样的功能 (如数据库和适配器等)，而上下文则单纯提供了一个接口来访问它们。这种组织形式被称为 **服务 (Service)**。
>
> 对于已经有 IoC / DI 概念的同学来说，服务就是一种类似于 IoC 的实现 (**但并非通过 DI 实现**)。Service API 通过 TypeScript 特有的 **声明合并 (Declaration Merging)** 机制提供了容器内服务的快速访问。

## D.2 服务的三种类型（**原文逐字，含官方举例**）

**第一种：由 Koishi 自带的服务。** 只要有上下文对象，你就可以随时访问这些服务。

- `ctx.model`：提供数据模型
- `ctx.i18n`：提供国际化能力

**第二种：由 Koishi 所定义但并未实现的服务。** 你可以选择适当的插件来实现它们。在你安装相应的插件之前，相关的功能是无法访问的。

- `ctx.assets`：转存资源文件
- `ctx.database`：封装数据库操作

> 实现特定服务的插件名通常以服务名作为前缀，例如 `assets-local`, `database-mysql` 等等。这并非强制的要求，但我们建议插件开发者也都遵循这个规范，这有助于让使用者对你插件的功能建立一个更明确的认识。

**第三种：由插件定义和实现的服务。** 通常情况下你需要声明这些服务作为依赖。

- `ctx.console`：网页控制台
- `ctx.puppeteer`：浏览器截图

## D.3 反例（官方给的"标准错误答案"，原文逐字）

```ts
// 标准错误答案！别抄这个！
export const name = 'dialogue'

export function apply(ctx: Context) {
  // 检查数据库服务是否存在
  if (!ctx.database) return

  ctx.command('dialogue').action((_, content) => {
    // 检查资源存储服务是否存在
    if (ctx.assets) ctx.assets.transform(content)
  })

  // 检查控制台服务是否存在
  if (ctx.console) {
    ctx.console.addEntry('/path/to/dialogue/extension')
  }
}
```

> 你很快会发现这样写完全无法运行。首先，**数据库服务需要等到应用启动完成后才可以访问**，换言之即使安装了数据库插件，你也无法立即判断数据库服务是否存在。此外，**一旦上述服务所在插件在运行时被重载**，由于上面的代码属于 dialogue 插件，因此 if 中代码的副作用将无法被有效清理；而当相应的服务重新被注册时，这部分的代码也不会被重新运行，从而导致一系列难以检测的问题。

## D.4 `inject` 的确切用法

### D.4.1 数组形式

```ts
export const name = 'dialogue'
export const inject = ['database']

export function apply(ctx: Context) {
  // 你可以立即访问数据库服务
  ctx.database.get('dialogue', {})
}
```

> `inject` **可以是一个数组或者对象**。这里使用了数组，表示此插件依赖的服务列表。怎么理解这里的依赖关系呢？如果你声明了某个服务作为插件的依赖：
> - 直到此服务的值变为 truthy 为止，该插件的函数体不会被加载
> - 一旦此服务的值发生变化，该插件将立即回滚 (并非插件停用)
> - 如果变化后的值依旧为 truthy，该插件会在回滚完成后被重新加载

> ⚠️ **官方文档只写了「数组」和「对象」两种形式，没有单独的字符串形式（`export const inject = 'database'`）。**

### D.4.2 对象形式：`{ required, optional }`

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

> 另一种情况是，插件依赖的服务仅仅在运行时判断并使用，并不提供任何副作用。此时可以将 `inject` 声明为一个对象，其含有 `required` 和 `optional` 两个可选的属性，分别表示必需依赖和可选依赖。这样声明的**可选依赖同样可以在插件体中直接使用，但插件的生命周期并不会实际依赖该服务**。换句话说，插件不会等待该服务加载，也不会因为服务的变化而回滚。

### D.4.3 `ctx.inject()`（部分功能依赖服务时）

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

> ⚠️ **TIP（原文，内存泄漏警告）**：请注意：这里出现了两个 `ctx` 对象，它们属于不同的插件。**在子插件的回调函数内，请务必使用作为参数的 `ctx` 而不是外层的 `ctx`，不然在服务被热重载时可能会引发内存泄漏。**

### D.4.4 最佳实践（官方给出的"正确答案"，原文逐字）

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

## D.5 需要数据库时应该 inject 什么

**`inject = ['database']`**（服务名为 `database`，上下文属性为 `ctx.database`，"封装数据库操作"）。

原文出现过的两种写法：
- 仅需数据库：`export const inject = ['database']`
- 数据库必需 + 其他可选：`export const inject = { required: ['database'], optional: ['assets'] }`

同时，若在 `package.json` 中声明（» 服务页原文）：

```json
{
  "koishi": {
    "service": {
      "required": ["database"],
      "optional": ["assets", "console"],
      "implements": ["dialogue"]
    }
  }
}
```

> 在这里，`required` 对应于必需依赖，`optional` 对应于可选依赖，`implements` 对应于提供的服务。如果你的插件没有使用或提供服务，那么对应的字段可以省略。

## D.6 如何定义自己的服务

» 来源：`/zh-CN/guide/plugin/service.html`（「自定义服务」节，**原文逐字**）

> 如果你希望自己插件提供一些接口供其他插件使用，那么最好的办法便是提供自定义服务，就像这样：

```ts
export default class Console extends Service {
  constructor(ctx: Context) {
    super(ctx, 'console')
  }
}
```

> 这样定义的好处在于，`Console` 本身也是一个合法的插件，其他插件可以直接通过 `ctx.plugin(Console)` 来加载它。

TypeScript 声明合并（原文逐字）：

```ts
declare module 'koishi' {
  interface Context {
    console: Console
  }
}
```

使用方（原文逐字）：

```ts
import {} from 'koishi-plugin-console'

export const inject = ['console']

export function apply(ctx: Context) {
  ctx.console.addEntry('/path/to/dialogue/extension')
}
```

> ⚠️ **关于 `ctx.set()`**：官方 8 个页面中**没有出现 `ctx.set()`**。文档给出的自定义服务方式就是**继承 `Service` 抽象类并在 `super(ctx, name)` 中注册**。

### D.6.1 服务的生命周期（`Service` 构造函数与抽象方法，**原文逐字**）

> `Service` 抽象类的构造函数支持三个参数：
> - `ctx`：服务所在的上下文对象
> - `name`：服务的名称 (即其在所有上下文中的属性名)
> - `immediate`：是否立即注册到所有上下文中 (可选，默认为 `false`)
>
> 以及三个可选的抽象方法：
> - `start()`：在 `ready` 事件触发时调用
> - `stop()`：在 `dispose` 事件触发时调用
> - `fork()`：在 `fork` 事件触发时调用

> 默认情况下，一个自定义服务会先等待 ready 事件触发，然后调用可能存在的 `start()` 方法，最后才会被注册到全体上下文中。这种设计确保了服务在能够被访问的时候就已经是可用的。但如果你的服务不需要等待 ready 事件，那么只需传入第三个参数 `true` 就可以立即将服务注册到所有上下文中。
>
> 此外，当注册了服务的插件被卸载时，其注册的服务也会被移除，通过 `inject` 声明依赖的插件也会被停止运行，直到服务再次被实现。这意味着开发者不需要担心服务的生命周期，只需要专注于提供或使用服务的功能即可。

### D.6.2 服务的热重载（console 插件源码节选，**原文逐字**）

```ts
interface Console {
  entries: Set<string>
  triggerReload(): void
}
// ---cut---
class Console extends Service {
  // 这个方法的作用是添加入口文件
  addEntry(filename: string) {
    this.entries.add(filename)
    this.triggerReload()

    // 注意这个地方，ctx 属性会指向访问此方法的上下文 (而不是构造函数中的上下文)
    // 只需要在这个上下文上监听 dispose 事件，就可以顺利处理副作用了
    this.ctx.on('dispose', () => {
      this.entries.delete(filename)
      this.triggerReload()
    })
  }
}
```

> 关键点：**`this.ctx` 指向的是"访问此方法的上下文"**，而不是构造函数的上下文。

## D.7 `package.json` 中的服务声明与 `peerDependencies`

### D.7.1 `koishi.service` 字段

```json
{
  "koishi": {
    "service": {
      "required": ["database"],
      "optional": ["assets", "console"],
      "implements": ["dialogue"]
    }
  }
}
```

> 如果你打算将插件发布到插件市场，我们建议在插件的 `package.json` 中对其所提供和使用的服务进行声明。

### D.7.2 `inject` 声明 vs `package.json` 声明（原文逐字）

> 对于任何依赖服务的插件，其**必须声明 `inject` 才能正常工作**，但**缺失 `package.json` 中的声明并不会影响插件的运行**。尽管如此，我们依然建议你在 `package.json` 中声明依赖，因为这样做能够在安装时提供更多信息，使用者可以一次性地安装插件所需的所有依赖，而不是等到插件运行时才发现缺少了某个服务。

### D.7.3 关于 `peerDependencies`（原文逐字）

> 一个很容易混淆的概念是 `package.json` 自带的 `peerDependencies` 字段。这个字段用于声明一个 npm 包的依赖，但声明的依赖需要由用户安装 (或由包管理器自动安装到依赖树顶层)。是不是跟服务的概念非常像？它们之间的区别如下：
>
> 1. `peerDependencies` 描述的是 npm 包的**运行时行为**。如果对应的依赖不存在，那么程序预期无法正常运行 (除非在 `peerDependenciesMeta` 中指明可选性)。而对于 Koishi 插件来说，由于有了 `inject` 机制，**即使依赖的服务不存在，程序也不会崩溃**。
> 2. `peerDependencies` 是**一对一**的关系，即依赖的只能是另一个确定的包。而 Koishi 中的服务则是**一对多**的关系，即依赖的服务可以被多个插件所提供。
>
> 基于以上两点，关于是否要在插件的 `package.json` 中为服务声明 `peerDependencies`，我们可以根据插件从依赖中**导入的内容**来判断：

**情况一：插件仅导入了类型声明**（"这是绝大部分的情况"）——"我们**无需声明 `peerDependencies`**，但**建议把依赖加入 `devDependencies`** 中"：

```ts
// import {} 的意思是，我们只需要类型声明，而不需要导入任何内容
// 在编译后，这个语句会被移除，不会引入任何副作用
import {} from 'koishi-plugin-puppeteer'

// 通过 inject 属性声明依赖，并通过 ctx 来访问服务
export const inject = ['puppeteer']
export function apply(ctx: Context) {
  ctx.puppeteer.render()
}
```

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

> ⚠️ 注意：此处原文（service.html）写的是顶层 `"service"` 键；而同一篇文档前文与 publish.html 写的是 `"koishi": { "service": {...} }`。**两处不一致，以 `"koishi": { "service": ... }` 为准**（publish.html 有完整的字段说明）。

**情况二：插件导入了类型声明以外的内容**——"此时你需要同时声明 `peerDependencies` 和 `devDependencies`"：

```ts
import { DataService } from '@koishijs/plugin-console'

export class ExamplePlugin extends DataService {
  // ...
}
```

```json
{
  "service": {
    "required": ["console"]
  },
  "peerDependencies": {
    "@koishijs/plugin-console": "^5.13.0"
  },
  "devDependencies": {
    "@koishijs/plugin-console": "^5.13.0"
  }
}
```

---

# E. 插件 `package.json`（发布 / 市场准入）

» 来源：`/zh-CN/guide/develop/publish.html`（用户指定的 8 页之外的补充页，因为 8 页未覆盖此内容）

## E.1 最重要的两个属性

```json
{
  "name": "koishi-plugin-example",
  "version": "1.0.0",
  // ……
}
```

> 其中最重要的属性有两个：`name` 是要发布的包名，`version` 是当前版本号。可以看到，这里的包名相比实际在插件市场中看到的插件名多了一个 `koishi-plugin-` 的前缀。

> **TIP**：请注意：包名和版本号都是唯一的：包名不能与其他已经发布的包相同，而同一个包的同一个版本号也只能发布一次。

## E.2 插件市场的准入条件（**原文逐字**）

> 要想显示在插件市场中，插件的 `package.json` 需要满足以下基本要求：
> - `name` 必须符合以下格式之一：
>     - `koishi-plugin-*`
>     - `@bar/koishi-plugin-*`
>     - `@koishijs/plugin-*` (官方插件)
>     - 其中 `*` 是由数字、小写字母和连字符 `-` 组成的字符串
> - `name` 不能与已发布的插件重复或相似
> - `version` 应当符合[语义化版本](https://semver.org/lang/zh-CN/) (通常从 `1.0.0` 开始)
> - **`peerDependencies` 必须包含 `koishi`**
> - 不能声明 `private` 为 `true` (否则你的插件无法发布)
> - 最新版本不能被[弃用](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions)

符合标准的示例：

```json
{
  "name": "koishi-plugin-example",
  "version": "1.0.0",
  "peerDependencies": {
    "koishi": "^4.3.2"
  }
}
```

## E.3 附加信息字段

```json
{
  "name": "koishi-plugin-example",
  "version": "1.0.0",
  "contributors": [                         // 贡献者
    "Alice <alice@gmail.com>",
    "Bob <bob@gmail.com>"
  ],
  "license": "MIT",                         // 许可证
  "homepage": "https://example.com",        // 主页
  "repository": {                           // 源码仓库
    "type": "git",
    "url": "git+https://github.com/alice/koishi-plugin-example.git"
  },
  "keywords": ["example"],                  // 关键词
  "peerDependencies": {
    "koishi": "^4.3.2"
  }
}
```

- **contributors:** 插件维护者，应该是一个数组，其中的元素通常使用 `名字 <邮箱>` 的格式
- **license:** 插件许可证
- **homepage:** 插件主页
- **repository:** 插件源码仓库，应该是一个对象，其中 `type` 字段指定仓库类型，`url` 字段指定仓库地址
- **keywords:** 插件关键词，应该是一个字符串数组，会用于插件市场中的搜索功能

## E.4 `koishi` 字段（**原文逐字**）

```json
{
  "name": "koishi-plugin-dialogue",
  "version": "1.0.0",
  "peerDependencies": {
    "koishi": "^4.3.2"
  },
  "koishi": {
    "description": {                        // 不同语言的插件描述
      "en": "English Description",
      "zh": "中文描述"
    },
    "service": {
      "required": ["database"],             // 必需的服务
      "optional": ["assets"],               // 可选的服务
      "implements": ["dialogue"],           // 实现的服务
    },
  }
}
```

- **description:** 插件描述，应该是一个对象，其中的键代表语言名，值是对应语言下的描述
- **service:** 插件的服务相关信息
- **preview:** 配置为 `true` 可以让插件显示为「开发中」状态
- **hidden:** 配置为 `true` 可以让插件市场中不显示该插件 (通常情况下你不需要这么做)

## E.5 关于 `main` / `exports`

» 原文（publish.html，TIP）：

> 此外，还有一些字段与 [Koishi Online](./../../cookbook/practice/online.html) 的部署流程相关 (如 `browser`, `exports` 等)。由于不影响主线开发，你可以稍后再进行了解。

> ⚠️ **用户提问点「`main` / `exports` 的写法」在官方 8 个页面及 publish.html 中均未给出具体写法**。文档只说明构建产物输出到 `lib/`（后端）与 `dist/`（前端），并把 `exports` 归为 Koishi Online 部署相关。**不要在指南里臆造 `exports` 内容。**

### E.5.1 官方插件真实 `package.json` 佐证（**非文档正文，来自 npm registry**）

> 来源：`https://registry.npmmirror.com/koishi-plugin-dialogue/latest`（`koishi-plugin-dialogue@4.1.3`，作者 Shigma，即 Koishi 作者本人）
> **这一段不是 koishi.chat 文档正文**，而是官方插件在 npm 上的实际元数据，用于回答"`main` 该怎么写"。引用时请保留此标注。

```json
{
  "name": "koishi-plugin-dialogue",
  "description": "Dialogue Plugin for Koishi",
  "version": "4.1.3",
  "main": "lib/index.js",
  "typings": "lib/index.d.ts",
  "author": { "name": "Shigma", "email": "shigma10826@gmail.com" },
  "license": "MIT",
  "homepage": "https://dialogue.koishi.chat/",
  "keywords": ["bot", "chatbot", "koishi", "plugin", "teach", "dialogue", "conversation"],
  "koishi": {
    "description": {
      "en": "A powelful and convenient dialogue system",
      "zh": "强大而易用的问答系统"
    },
    "service": {
      "required": ["database"],
      "optional": ["assets"],
      "implements": ["dialogue"]
    }
  },
  "peerDependencies": { "koishi": "^4.15.4" },
  "devDependencies": {
    "@koishijs/assets": "^1.0.3",
    "@koishijs/plugin-help": "^2.3.3",
    "koishi": "^4.15.4"
  },
  "dependencies": { "fastest-levenshtein": "^1.0.16" }
}
```

**由此可确证的三点事实**：

1. `main` 指向 **`lib/index.js`**，与文档所述构建产物目录 `external/<name>/lib` **一致**（即插件包的 `main` 是相对插件目录的 `lib/index.js`）。
2. 类型声明入口用 **`typings: "lib/index.d.ts"`**（该包用的是 `typings` 而非 `types`）。
3. **该官方插件没有 `exports` 字段** —— 印证文档所说 `exports` 只与 Koishi Online 部署相关，普通插件不需要写。

> ⚠️ 这只是一个官方插件样本，**不是模板项目生成的确切文件**。模板项目 boilerplate 的脚手架文件存放在 GitHub（本环境不可访问），因此「`npm run setup` 生成的确切 `package.json` 全文」本次**无法取证**。

## E.6 发布 / 版本 / 弃用命令

```sh
npm run pub [...name]
```
- **name:** 要发布的插件列表，缺省时表示全部（此处 `name` **不包含 `koishi-plugin-` 前缀，而是你的工作区目录名**）

> 这将发布所有版本号发生变动的插件。
> 从插件成功发布到进插件市场需要一定的时间 (通常在 15 分钟内)。

调试 / 镜像问题：

```sh
npm run pub [...name] --debug
```
```sh
yarn pub [...name] --debug
```
```sh
npm run pub [...name] -- --registry https://registry.npmjs.org
```

> 如果你配置了国内镜像，你可能会遇到以下的错误提示：
> `No token found and can't prompt for login when running with --non-interactive.`

Yarn v2+ 分开设置镜像（原文逐字）：

```sh
# 安装时使用国内镜像
yarn config set npmRegistryServer https://registry.npmmirror.com
# 发布时使用官方镜像
yarn config set npmPublishRegistry https://registry.yarnpkg.com
```

更新版本号：

```sh
npm run bump [...name] -- [-1|-2|-3|-p|-v <ver>] [-r]
```

- **name:** 要更新的插件列表，不能为空
- **\-1, --major:** 跳到下一个大版本，例如 `3.1.4` -> `4.0.0`
- **\-2, --minor:** 跳到下一个中版本，例如 `3.1.4` -> `3.2.0`
- **\-3, --patch:** 跳到下一个小版本，例如 `3.1.4` -> `3.1.5`
- **\-p, --prerelease:** 跳到下一个预览版本，具体行为如下
    - 如果当前版本是 `alpha.x`，则跳到 `beta.0`
    - 如果当前版本是 `beta.x`，则跳到 `rc.0`
    - 如果当前版本是 `rc.x`，则移除 prerelease 部分
    - 其他情况下，跳到下一个大版本的 `alpha.0`
- **\-v, --version:** 设置具体的版本号
- **\-r, --recursive:** 递归更新依赖版本
- 缺省情况：按照当前版本的最后一位递增

弃用插件：

```sh
npm deprecate <full-name> <message>
# 例如
npm deprecate koishi-plugin-example "this plugin is deprecated"
```

```sh
npm deprecate <full-name>[@<version>] <message>
```

---

# F. 官方文档中提到的常见坑与注意事项（全部来自原文 WARNING / TIP / DANGER）

## F.1 默认导出的优先级陷阱（最容易翻车）

> **只要模块提供了默认导出，Koishi 就会尝试加载这个默认导出，而不是导出整体。** 在开发中请务必注意这一点。
> —— 认识插件页 TIP

**含义**：在同一个 `index.ts` 里同时写 `export default X` 和 `export const name/Config/apply`，会命中默认导出，元属性形同虚设。

## F.2 `.required()` 与 `.default()` 不能同时使用

> **WARNING：请注意：`.required()` 与 `.default()` 不能同时使用。**
> —— 默认值页

另外，字符串的"空串"与"未配置"是两个不同概念。

## F.3 `fork` 内外两个 `ctx` 含义不同

> 外侧和内侧的 `ctx` 含义不同，请格外注意。
> —— 生命周期页

`ctx.inject()` 同理：

> 在子插件的回调函数内，请务必使用作为参数的 `ctx` 而不是外层的 `ctx`，不然在服务被热重载时可能会引发内存泄漏。
> —— 服务与依赖页 TIP

## F.4 不要用 `if (!ctx.database) return` 检查服务

> 你很快会发现这样写完全无法运行。首先，数据库服务需要等到应用启动完成后才可以访问……此外，一旦上述服务所在插件在运行时被重载……if 中代码的副作用将无法被有效清理。
> —— 服务与依赖页

正确做法：`inject` 数组/对象 + `ctx.inject()` 子插件。

## F.5 服务/插件热重载下的副作用泄漏

> 绝大部分 `ctx` 方法都会在在插件被停用自动回收副作用；然而，如果你使用了 `ctx` 之外的方法，你的代码还可能通过其他方式引入副作用，这时就需要通过 `dispose` 事件来手动清除它们。
> —— 生命周期页

**对挂机游戏插件特别相关**：`setInterval` 心跳、结算定时器、自建 server、文件监听都必须挂在 `ctx.on('dispose', ...)` 上清理。

## F.6 可重用插件嵌套在不可重用插件里不会重复执行

> 如果你直接将可重用插件嵌套在不可重用插件中，由于外层的插件只会执行一次，所以内层的插件也并不会被重复执行。
> —— 生命周期页

要用 `fork` 事件。

## F.7 `fork.dispose()` 只停用一次；全部停用要用 `ctx.registry.delete()`

## F.8 配置文件相关的坑

- **WARNING**："配置文件的结构未来可能会发生变化，请留意后续更新。"
- **TIP**："如果你不了解 YAML 的语法，请不要随意修改配置文件，否则将可能导致 Koishi 应用无法运行。"
- 插件名前的 `~` 表示**不启用**；`group:` 是插件组；`$if` / `$filter` / `$collapsed` 是元信息。
- **DANGER**："我们并不推荐使用高级语言来编写配置文件，因为动态的配置无法支持环境变量、配置热重载和插件市场等特性。"
- 修改配置文件后需要**重启**（模板项目场景）。

## F.9 目录与路径

- 创建项目的目录"不宜过长，且路径中请避免出现中文或者空格"。
- 所有 CLI 命令（`setup` / `build` / `install` / `dep` / `pub` / `bump`）**都需要在[应用目录](#a141-应用目录配置文件所在位置)下运行**。
- **应用目录的 `package.json` 和插件目录的 `package.json` 是两个文件**，别改错。

## F.10 发布相关

- 包名 / 版本号唯一，冲突会报错。
- `peerDependencies` **必须包含 `koishi`**，否则进不了插件市场。
- `private` 不能为 `true`。
- 配置了国内镜像会导致发布报 `No token found...`，需临时用官方镜像。
- 发布到进插件市场有延迟（通常 15 分钟内）。

## F.11 HMR 相关

- Linux 下文件监听数上限报 `NOSPC: System limit for number of file watchers reached`。
- 可把 `hmr.root` 收窄为 `external/<你的插件>`，多插件时可用数组。

## F.12 服务声明两处不一致（文档 bug，编者需注意）

- `service.html` 的「对比 peerDependencies → 情况一」示例把 `service` 写在 `package.json` 顶层；
- `service.html` 前文与 `publish.html` 都写在 `"koishi": { "service": ... }` 下。
- **以 `"koishi": { "service": ... }` 为准。**

## F.13 插件目录名 `external/` vs `plugins/`（文档 bug）

- `workspace.html` 用 `external/`；`publish.html` 的目录树用 `plugins/`。
- **以 `external/` 为准**（`npm run setup` 生成的结构）。

---

# G. 文档未覆盖 / 待确认（**不要凭印象补写**）

以下是用户提问点中，官方这 8 个页面（含本次补充页）**明确没有给出**的内容。写指南时应避免编造，或标注需另行查证：

| 提问点 | 状态 | 说明 |
|--------|------|------|
| `npx` 形式的创建命令 | ❌ 文档无 | 文档只有 `npm init koishi@latest` |
| yarn 变体命令（`yarn create koishi` / `yarn setup` 等） | ⚠️ 部分 | VitePress yarn 标签页抓取不到；正文中仅明确出现 `yarn dev`、`yarn pub`、`yarn pub [...name] --debug`、`yarn -v`、`yarn config set ...` |
| `packages/` 目录 | ❌ 文档无 | 工作区页只有 `external/`；`packages/` 未出现在这 8 页中 |
| `main` / `exports` 字段的具体写法 | ⚠️ 文档无，但有 npm 实证 | 文档只说 `exports` 与 Koishi Online 部署相关；构建产物在 `lib/`（后端）与 `dist/`（前端）。**官方插件 `koishi-plugin-dialogue@4.1.3` 的实际写法是 `"main": "lib/index.js"` + `"typings": "lib/index.d.ts"`，且无 `exports`** —— 见 E.5.1（非文档正文，已标注来源） |
| 模板项目 boilerplate 脚手架文件的内容 | ❌ 无法取证 | 脚手架存放在 GitHub（`raw.githubusercontent.com` / `github.com` 本环境 DNS 解析到非公网 IP，被拒绝），故 `npm run setup` 生成的确切 `package.json` / `tsconfig.base` 全文本次无法取得 |
| `export const schema` | ❌ 文档无 | 现行写法是 `export const Config`；`schema` 是 Koishi 3 旧写法 |
| `before-*` 系列生命周期事件 | ✅ 已澄清 | **不存在 `before-*` 形式的生命周期事件**。生命周期事件只有 `ready`/`dispose`/`service`/`model`/`login-added`/`login-removed`/`login-updated`。`before-*` 属于**内置会话事件**（`before-parse`、`before-attach-channel`、`before-attach-user`、`before-send`、`command/before-execute` 等），详见 B.11 |
| `ctx.set()` | ❌ 文档无 | 自定义服务用 `class X extends Service` + `super(ctx, name)` |
| `inject` 的**字符串**形式 | ❌ 文档无 | 原文只说"可以是一个数组或者对象" |
| `Schema.percent()` / `Schema.date()` / `Schema.bitset()` / `Schema.path()` / `Schema.tuple()` / `Schema.transform()` / `Schema.computed()` 的具体签名 | ✅ 已补齐 | 全部 24 页已逐页抄录，见 C.9。`Schema.percent()` 仅在 `/schema/meta/role.html` 出现（无文字规格）；`Schema.natural` / `Schema.from` / `Schema.to` **站点上不存在** |
| `Schema.union()` 的**对象形式**（tagged union / 配置联动） | ✅ 已补齐 | 见 C.9.3（`union-tagged-1` / `union-tagged-2` 原文逐字）。要点：下方分支若与上方默认值类型不同，**必须加 `.required()`** |
| `.comment()` 方法 | ⛔ 确认不存在 | 全部 24 页 `/schema/` 页面中**没有** `.comment()`；说明文本由 `.description()` 承担。`.set()` / `.toString()` 同样未找到；`.extra()` 仅见于 v4.14 更新日志 |
| 控制台「插件配置」分组 UI 的 `$collapsed` 与 `Schema.intersect().collapse()` 的对应关系 | ⚠️ 文档未明确关联 | 两者分别见于 config.html 与 intersect.html，文档未说明二者是否同一机制 |
