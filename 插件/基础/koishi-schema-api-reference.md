# Koishi `Schema`（schemastery）API 参考 — 逐页抄录自 koishi.chat 官方中文文档

> 来源：<https://koishi.chat/zh-CN/schema/>（「演练场 / 配置构型」章节）全部 24 个页面 + 索引页。
> 采集方式：逐页 `web_fetch` 抓取渲染后的页面文本；对每个页面均以英文镜像页 (`/en-US/...`) 复核结尾是否一致，确认文章正文完整（抓取只在页面最底部 footer 分页器处被截断，正文无缺失）。
> 所有 TypeScript 代码块均为逐字符抄录，未做任何改写、缩进调整或补全。
> 未在文档中出现的 API 一律标注「未在文档中找到」，不做推测。

## 目录 / 页面清单

| # | 页面 | URL |
|---|------|-----|
| 0 | 配置构型（索引） | https://koishi.chat/zh-CN/schema/index.html |
| 1 | 必需与可选 | https://koishi.chat/zh-CN/schema/meta/required.html |
| 2 | 默认值 | https://koishi.chat/zh-CN/schema/meta/default.html |
| 3 | 标题与描述 | https://koishi.chat/zh-CN/schema/meta/description.html |
| 4 | 禁用与隐藏 | https://koishi.chat/zh-CN/schema/meta/disabled.html |
| 5 | 配置项外观 | https://koishi.chat/zh-CN/schema/meta/role.html |
| 6 | 嵌套类型 | https://koishi.chat/zh-CN/schema/meta/nested.html |
| 7 | 数值 (Number) | https://koishi.chat/zh-CN/schema/basic/number.html |
| 8 | 字符串 (String) | https://koishi.chat/zh-CN/schema/basic/string.html |
| 9 | 布尔值 (Boolean) | https://koishi.chat/zh-CN/schema/basic/boolean.html |
| 10 | 日期 (Date) | https://koishi.chat/zh-CN/schema/basic/date.html |
| 11 | 位集 (Bitset) | https://koishi.chat/zh-CN/schema/basic/bitset.html |
| 12 | 对象 (Object) | https://koishi.chat/zh-CN/schema/basic/object.html |
| 13 | 元组 (Tuple) | https://koishi.chat/zh-CN/schema/basic/tuple.html |
| 14 | 字典 (Dict) | https://koishi.chat/zh-CN/schema/basic/dict.html |
| 15 | 数组 (Array) | https://koishi.chat/zh-CN/schema/basic/array.html |
| 16 | 路径 (Path) | https://koishi.chat/zh-CN/schema/basic/path.html |
| 17 | Intersect：分组 | https://koishi.chat/zh-CN/schema/advanced/intersect.html |
| 18 | Union：单选框 | https://koishi.chat/zh-CN/schema/advanced/union-select.html |
| 19 | Union：联合类型 | https://koishi.chat/zh-CN/schema/advanced/union-arbitrary.html |
| 20 | Intersect + Union：配置联动 1 | https://koishi.chat/zh-CN/schema/advanced/union-tagged-1.html |
| 21 | Intersect + Union：配置联动 2 | https://koishi.chat/zh-CN/schema/advanced/union-tagged-2.html |
| 22 | Transform：输入转换 | https://koishi.chat/zh-CN/schema/advanced/transform.html |
| 23 | Computed：条件求值 | https://koishi.chat/zh-CN/schema/advanced/computed.html |

---

## 索引页：配置构型

页面正文即章节导航列表（核心概念 6 页 / 基础类型 10 页 / 高级类型 7 页），无 API 代码。页面底部标注「在 GitHub 编辑此页面」指向 `https://github.com/koishijs/docs/edit/main/zh-CN/schema/index.md`。

---

# 核心概念

## 必需与可选 — `.required()`

来源：https://koishi.chat/zh-CN/schema/meta/required.html

正文（逐字）：

> 默认情况下，所有配置项都是可选的。你可以通过 `.required()` 来声明一个必需的配置项。未配置的必需配置项的左侧会出现红色的提示线。
>
> 请注意：对于字符串等原始类型，空串和未配置是两个不同的概念。你可以通过控件中央的水平线来进行区分。

```ts
export default Schema.object({
  foo: Schema.boolean(),
  bar: Schema.string().required(),
})
```

Input

`null`

Output

`"$.bar missing required value"`

## 默认值 — `.default(v)`

来源：https://koishi.chat/zh-CN/schema/meta/default.html

正文（逐字）：

> WARNING
>
> 请注意：`.required()` 与 `.default()` 不能同时使用。
>
> `.default()` 用于设置某个配置项的默认值。如果你传入了值，那么默认值将不会有任何行为；如果没有传入值，则默认值会作为初始状态呈现在表单中。
>
> 在配置项菜单中可以选择将配置项恢复为默认值。如果你将某个配置项修改为了默认值，则该配置项实际上会被清除，以确保配置文件的简洁性。

```ts
export default Schema.object({
  foo: Schema.string().default('lol'),
  bar: Schema.number().default(2333),
  baz: Schema.boolean().default(true),
})
```

Input

`null`

Output

`{ "foo": "lol", "bar": 2333, "baz": true }`

## 标题与描述 — `.description(text)`

来源：https://koishi.chat/zh-CN/schema/meta/description.html

正文（逐字）：

> `.description()` 用于设置某个配置项的描述文本。当添加在属性上时会显示在名称下方，当添加在对象上时则会表现为小标题。我们还支持了基本的行内 Markdown 语法。

```ts
export default Schema.object({
  foo: Schema.boolean().description('*斜体*的属性描述。'),
  bar: Schema.string().description('**粗体**的属性描述。'),
}).description('配置标题')
```

Input

`null`

Output

`{ }`

## 禁用与隐藏 — `.disabled()` / `.hidden()` / `.deprecated()` / `.experimental()`

来源：https://koishi.chat/zh-CN/schema/meta/disabled.html

正文（逐字）：

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

Input

`null`

Output

`{ }`

## 配置项外观 — `.role(name)`

来源：https://koishi.chat/zh-CN/schema/meta/role.html

正文（逐字）：

> `.role()` 描述了一个配置项的外观，而不会影响该类型的实际行为。不同类型的可选外观各有不同，我们将在每种类型的示例中分别介绍。

默认外观（`.role('')`，即空字符串）：

```ts
export default Schema.object({
  number: Schema.percent().role(''),
  string: Schema.string().role(''),
  choice: Schema
    .union(['foo', 'bar', 'qux'])
    .role(''),
})
```

设置外观后：

```ts
export default Schema.object({
  number: Schema.percent().role('slider'),
  string: Schema.string().role('secret'),
  choice: Schema
    .union(['foo', 'bar', 'qux'])
    .role('radio'),
})
```

Input

`null`

Output

`{ "number": 0.5, "string": "password", "choice": "foo" }`

> 注：`Schema.percent()` 在整个 `/schema/` 章节中仅在本页出现（上面两个代码块各一次），文档没有给出它的文字说明，只给出调用形式与示例输出 `0.5`。

## 嵌套类型 — 类型简写 `String` / `Number` / `Boolean`

来源：https://koishi.chat/zh-CN/schema/meta/nested.html

正文（逐字）：

> 一些类型 (例如 [Object](./../basic/object.html) 和 [Array](./../basic/array.html)) 允许将其他类型作为参数传入，形成新的组合类型。你可以任意嵌套这些类型，以满足更复杂的需求。
>
> 例子里的 `String` 是 `Schema.string().required()` 的简写形式。类似的写法对于 `Number` 和 `Boolean` 也是成立的。

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

Input

`null`

Output

`{ "foo": { "bar": [ { "baz": 114514 } ], "qux": { "welcome": "Hello World" } } }`

---

# 基础类型

## `Schema.number()`

来源：https://koishi.chat/zh-CN/schema/basic/number.html

正文（逐字）：

> `Schema.number()` 描述了一个数值，支持输入框和滑块。

```ts
export default Schema.object({
  foo: Schema.number(),
  bar: Schema.number().role('slider')
    .min(0).max(100).step(1).default(30),
})
```

Input

`null`

Output

`{ "bar": 30 }`

- 文档化的数字外观：`'slider'`（滑块）。`''`（空串）在 role 页作为「默认外观」示例出现。
- 文档化的数字方法：`.min()`、`.max()`、`.step()`。
- `Schema.percent()`：见 `meta/role.html`（调用形式 `Schema.percent().role('slider')`）。
- `Schema.natural()`：**未在文档中找到**（本页及 `/schema/` 全部页面均无此方法的任何文字或代码）。

## `Schema.string()`

来源：https://koishi.chat/zh-CN/schema/basic/string.html

正文（逐字）：

> `Schema.string()` 描述了一个字符串，支持多种特殊外观。
>
> - secret：默认情况下不显示输入框中的内容，可点击按钮切换
> - link：点击可访问输入框中的链接 (同时输入框也会稍长一些)
> - textarea：输入框显示在配置项下侧，为自适应高度的多行文本域
>   - 可以通过 `rows` 属性来限制文本域的最小和最大行数
> - color：输入框显示为颜色选择器
>
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

Input

`null`

Output

`{ "secret": "password", "link": "https://github.com" }`

- 字符串外观：`'secret'`、`'link'`、`'textarea'`（可带第二参数 `{ rows: [2, 4] }`）、`'color'`；`''`（空串，role 页）。
- 字符串专属方法：`.pattern(regexp)`。
- 日期相关外观也作用在字符串上（见下页）：`'datetime'`、`'date'`、`'time'`。

## `Schema.boolean()`

来源：https://koishi.chat/zh-CN/schema/basic/boolean.html

正文（逐字）：

> `Schema.boolean()` 以开关的形式描述了一个布尔值。

```ts
export default Schema.object({
  enable: Schema.boolean(),
})
```

Input

`null`

Output

`{ }`

- 本页未记录任何布尔专属的 `.role()` 取值。

## `Schema.date()`

来源：https://koishi.chat/zh-CN/schema/basic/date.html

正文（逐字）：

> 由于 Date 不便于序列化，我们提供了两套描述 Date 的方式：
>
> - 使用 Date 类型：输入字符串，输出 Date 实例
> - 使用 String 类型与三种可选的 `role` 属性
>
> 其中，Date 类型与 `datetime` 的前端体验是完全一致的，唯一区别在于输出的格式不同。字符串额外多出 `date` 和 `time` 两种格式，用于表达纯日期和纯时间字符串。

```ts
export default Schema.object({
  value: Schema.date(),
  datetime: Schema.string().role('datetime'),
  date: Schema.string().role('date'),
  time: Schema.string().role('time'),
})
```

Input

`null`

Output

`{ }`

- 文档化的日期外观（用于 `Schema.string()`）：`'datetime'`、`'date'`、`'time'`。

## `Schema.bitset()`

来源：https://koishi.chat/zh-CN/schema/basic/bitset.html

正文（逐字）：

> `Schema.bitset()` 以复选框的形式描述了一个整数，通常每一位表达某种特征。它的输出是一个整数，输入可以是一个整数或者一个字符串数组。
>
> 如果希望输出的也是字符串数组，可以配合使用 `Schema.array()` 和 `Schema.union()`，并设置 `.role('checkbox')`。
>
> 此外，我们还提供了 `.role('select')`，它将以复选菜单的形式呈现。

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

Input

`null`

Output

`{ "bitset": 5, "array": [ "FOO", "QUX" ] }`

- `Schema.bitset()` 的两种参数形式在文档中出现：
  - `Schema.bitset(Intents)` —— 传入 `const enum`（本页）；
  - `Schema.bitset({ FOO: 1, BAR: 2, QUX: 4 })` —— 传入字面量对象（见 `basic/array.html`）。
- 文档化的相关外观：`'checkbox'`（配合 `Schema.array(Schema.union([...]))`）、`'select'`（复选菜单）。

## `Schema.object()`

来源：https://koishi.chat/zh-CN/schema/basic/object.html

正文（逐字）：

> `Schema.object()` 描述了一个具有给定属性的对象。
>
> 默认情况下所有属性都是可选的，可以通过 `.required()` 来声明一个必需属性。
>
> 使用 `.collapse()` 可以将对象默认折叠为一个单独的配置项。

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

Input

`null`

Output

`"$.foo missing required value"`

- `.collapse()` 在此页以**无参**形式出现。

## `Schema.tuple()`

来源：https://koishi.chat/zh-CN/schema/basic/tuple.html

正文（逐字）：

> TIP
>
> 目前我们只支持元组内部元素是原始类型 ([String](./string.html), [Number](./number.html), [Boolean](./boolean.html)) 的情况。如果你要描述比较复杂的类型，请使用 [Object](./object.html) 或 [Array](./array.html) 替代。
>
> `Schema.tuple()` 描述了一个元组，它的长度是固定的，你需要分别给出其中每个元素的类型。它们会被显示在同一行中。

```ts
export default Schema.object({
  point: Schema.tuple([Number, Number]),
})
```

Input

`null`

Output

`"$.point[0] missing required value"`

## `Schema.dict()`

来源：https://koishi.chat/zh-CN/schema/basic/dict.html

正文（逐字）：

> `Schema.dict()` 类型描述了一个字典，其中的键是任意字符串，而值是给定的类型。
>
> - 使用 `.collapse()` 可以将配置项设置为默认折叠。
> - 使用 `.role('table')` 可以将字典以表格形式显示。
>
> 例子里的 `Boolean` 是 `Schema.boolean().required()` 的简写。

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

Input

`null`

Output

`{ "dict": { }, "table1": { }, "table2": { } }`

- 字典外观：`'table'`；修饰符：`.collapse()`（无参）。

## `Schema.array()`

来源：https://koishi.chat/zh-CN/schema/basic/array.html

正文（逐字）：

> `Schema.array()` 描述了一个数组，其中的元素满足给定的类型。
>
> - 使用 `.collapse()` 可以将配置项设置为默认折叠。
> - 使用 `.role('table')` 可以将数组以表格形式显示。
>
> 例子里的 `Number` 是 `Schema.number().required()` 的简写。
>
> TIP
>
> 特别地，对于已知字符串构成的数组，还可以使用 [`.role('checkbox')`](./bitset.html) 或 [`.role('select')`](./bitset.html)，将它们以复选框或复选菜单的形式显示。

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

Input

`null`

Output

`{ "array": [ ], "table1": [ ], "table2": [ ] }`

- 数组外观：`'table'`、`'checkbox'`、`'select'`；修饰符：`.collapse()`（无参）。

## `Schema.path()`

来源：https://koishi.chat/zh-CN/schema/basic/path.html

正文（逐字）：

> TIP
>
> 此类型基于 @koishijs/plugin-explorer，仅在加载该插件时可用。未加载该插件时，类型只会表现为普通的字符串 (比如现在就是这样)。
>
> `Schema.path()` 描述了一个路径。如果是相对路径，则会基于 `ctx.baseDir` 进行解析。该配置项会显示成一个能够打开文件选择器的按钮。
>
> 支持传入一些额外的选项：
>
> - `allowCreate`：是否允许创建目录和上传文件
> - `filters`：可选的文件的扩展名列表，扩展名全需要以 `.` 开头；特别地其中如果包含 `directory` 则表示可以选择文件夹

```ts
export default Schema.object({
  path1: Schema.path(),
  path2: Schema.path({
    filters: ['.png', '.jpg', 'directory'],
  }),
})
```

Input

`null`

Output

`{ }`

---

# 高级类型

## `Schema.intersect()` — 分组

来源：https://koishi.chat/zh-CN/schema/advanced/intersect.html

正文（逐字）：

> Intersect 类型可用于合并多个类型。一种最常见的用法是将配置项分为多组显示。
>
> 使用 `.collapse()` 可以将分组默认折叠为一个单独的配置项。

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

Input

`null`

Output

`{ }`

- 分组方式：把每个 `Schema.object({...})` 作为 `Schema.intersect([...])` 的数组元素，并用 `.description('分组名')` 给每个对象命名 —— 该 `description` 成为表单中的分组标题（呼应 `meta/description.html`：「当添加在对象上时则会表现为小标题」）。
- `.collapse()` 使该分组默认折叠为一个单独的配置项（本页正文说明；本页代码块本身未调用 `.collapse()`）。

## `Schema.union()` — 单选框（固定值联合）

来源：https://koishi.chat/zh-CN/schema/advanced/union-select.html

正文（逐字）：

> Union 描述了多个子类型的联合。它的最基础形式是从多个固定值中选择一个。这里的每一个字符串是 `Schema.const()` 的简写形式。如果每个可选值有较长的描述文本，你可以进一步将 `role` 设置为 `radio`，这样一来所有的选项将显示在下方而不是右侧。

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

Input

`null`

Output

`{ }`

- `Schema.union(['foo', 'bar', 'qux'])`：字符串数组形式，每个字符串是 `Schema.const()` 的简写。
- `Schema.union([Schema.const(v).description(...), ...])`：显式 `Schema.const` 形式，`.description()` 给出该选项在表单中显示的长描述文本。
- `.role('radio')`：所有选项显示在下方而不是右侧。

## `Schema.union()` — 联合类型（任意类型联合）

来源：https://koishi.chat/zh-CN/schema/advanced/union-arbitrary.html

正文（逐字）：

> Union 同样支持多种不同类型的联合。你需要给每个子类型提供一个 description，它们会作为表单中呈现的选项。

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

Input

`null`

Output

`{ }`

- 注意 `Schema.const()` **可以不带参数**（表示 `unset` / 未设置选项）。
- 联合中的每个分支都必须有 `.description(...)`，它在表单中作为该分支的选项名。

## Intersect + Union：配置联动 1

来源：https://koishi.chat/zh-CN/schema/advanced/union-tagged-1.html

正文（逐字）：

> 一种比较复杂的场景是以对象的某个属性值确定对象的其他属性的类型。善用 Intersect 和 Union，我们就可以轻松实现表单项的联动效果！试着切换 `enabled` 的取值，并观察下方表单项的变化吧。

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

TIP（逐字）：

> 请注意这个例子中对于 `default()` 和 `required()` 的使用。由于配置项默认情况下都是可选的，所以下方的 `enabled` 如果类型与上方的默认值不同，就必须加上 `required()`；反过来，如果相同，你就不应该加上 `required()` (你甚至可以缺省不写，这就是为什么最下面出现了一个空白的 `object({})`)。

Input

`null`

Output

`{ "enabled": false }`

## Intersect + Union：配置联动 2

来源：https://koishi.chat/zh-CN/schema/advanced/union-tagged-2.html

正文（逐字）：

> 一种比较复杂的场景是以对象的某个属性值确定对象的其他属性的类型。善用 Intersect 和 Union，我们就可以轻松实现表单项的联动效果！试着切换 `type` 的取值，并观察下方表单项的变化吧。

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

TIP（逐字）：

> 请注意这个例子中对于 `default()` 和 `required()` 的使用。由于配置项默认情况下都是可选的，所以下方的 `type` 配置项如果类型与上方的默认值不同，就必须加上 `required()`。在这个例子中，`type` 本来就是一个必需属性，所以下方的每一个 `type` 都必须加上 `required()`。

Input

`null`

Output

`"$.type missing required value"`

## `Schema.transform()` — 输入转换

来源：https://koishi.chat/zh-CN/schema/advanced/transform.html

正文（逐字）：

> Transform 用于定义一个转换类型，通常与 Union 一同使用。当输入满足一参数类型时，将调用二参数转换输入作为输出。此次转换将直接修改输入的对象，以确保类型满足输出类型。在网页表单中，将只会显示输出类型。

```ts
export default Schema.object({
  value: Schema.union([
    Schema.array(String),
    Schema.transform(String, value => [value]),
  ]).default([]),
})
```

Input

`null`

Output

`{ "value": [ ] }`

- 签名形式（如文档所示）：`Schema.transform(InputType, value => OutputValue)` —— 第一个参数是「一参数类型」（输入类型），第二个参数是转换函数。

## `Schema.computed()` — 条件求值

来源：https://koishi.chat/zh-CN/schema/advanced/computed.html

正文（逐字）：

> TIP
>
> 此类型只能在 Koishi 中使用。
>
> `Schema.computed()` 类型可用于合并多个类型。一种最常见的用法是将配置项分为多组显示。

```ts
export default Schema.object({
  foo: Schema.computed(Number),
}).description('配置项')
```

Input

`null`

Output

`{ }`

- 文档给出的唯一调用形式为 `Schema.computed(Number)`（单类型参数）。本页没有给出多参数或函数形式的示例。

---

# 静态工厂方法汇总（仅列出在 `/schema/` 章节中实际验证到的）

| 方法 / 简写 | 文档中的调用形式（逐字） | 来源页面 |
|---|---|---|
| `Schema.object` | `Schema.object({ ... })` | basic/object.html、meta/nested.html、guide |
| `Schema.string` | `Schema.string()` | basic/string.html |
| `Schema.number` | `Schema.number()` | basic/number.html |
| `Schema.boolean` | `Schema.boolean()` | basic/boolean.html |
| `Schema.date` | `Schema.date()` | basic/date.html |
| `Schema.bitset` | `Schema.bitset(Intents)` / `Schema.bitset({ FOO: 1, BAR: 2, QUX: 4 })` | basic/bitset.html、basic/array.html |
| `Schema.array` | `Schema.array(Number)`、`Schema.array(Schema.object({...}))`、`Schema.array(String)` | basic/array.html |
| `Schema.dict` | `Schema.dict(Boolean)`、`Schema.dict(String)`、`Schema.dict(Schema.object({...}))` | basic/dict.html |
| `Schema.tuple` | `Schema.tuple([Number, Number])` | basic/tuple.html |
| `Schema.union` | `Schema.union(['foo', 'bar', 'qux'])`（字符串简写）/ `Schema.union([TypeA, TypeB, ...])` | advanced/union-select.html、advanced/union-arbitrary.html |
| `Schema.intersect` | `Schema.intersect([Schema.object({...}).description('分组 1'), ...])` | advanced/intersect.html |
| `Schema.const` | `Schema.const('foo')`、`Schema.const(true)`、`Schema.const(false)`、`Schema.const()`（无参） | advanced/union-select.html、advanced/union-arbitrary.html、meta/disabled.html |
| `Schema.path` | `Schema.path()`、`Schema.path({ filters: ['.png', '.jpg', 'directory'] })` | basic/path.html |
| `Schema.percent` | `Schema.percent().role('')`、`Schema.percent().role('slider')` | meta/role.html（**仅此一处**，无文字说明） |
| `Schema.transform` | `Schema.transform(String, value => [value])` | advanced/transform.html |
| `Schema.computed` | `Schema.computed(Number)` | advanced/computed.html |
| 简写 `String` | `Schema.string().required()` 的简写 | meta/nested.html、basic/array.html、basic/tuple.html |
| 简写 `Number` | `Schema.number().required()` 的简写 | meta/nested.html、basic/array.html、basic/tuple.html |
| 简写 `Boolean` | `Schema.boolean().required()` 的简写 | meta/nested.html、basic/dict.html、basic/tuple.html |

## 未在文档中找到的静态方法

| 方法 | 状态 |
|---|---|
| `Schema.natural` | **未在文档中找到**（`/schema/` 全部 24 页均无出现） |
| `Schema.from` | **未在文档中找到** |
| `Schema.to` | **未在文档中找到** |

---

# 链式修饰符总表

| 修饰符 | 签名 / 文档中的调用形式 | 含义（依文档原文） | 来源页面 |
|---|---|---|---|
| `.required()` | `.required()`（无参） | 声明一个必需的配置项；未配置时左侧出现红色提示线，校验报 `"$.bar missing required value"` | meta/required.html |
| `.default(v)` | `.default('lol')`、`.default(2333)`、`.default(true)`、`.default(30)`、`.default([])`、`.default([{ baz: 114514 }])`、`.default({ welcome: 'Hello World' })`、`.default(Intents.FOO \| Intents.QUX)`、`.default(['FOO', 'QUX'])`、`.default(5)`、`.default(114514)`、`.default(false)` | 设置默认值；未传值时的初始状态。**与 `.required()` 不能同时使用**。改回默认值时该配置项会被清除 | meta/default.html（其余为各页示例） |
| `.description(text)` | `.description('**粗体**的属性描述。')`、`.description('配置标题')`、`.description('分组 1')`、`.description('选项 1')`、`.description('请输入一个数值。')` | 设置描述文本：在属性上显示在名称下方；在对象上表现为小标题；支持基本行内 Markdown；在 union 分支上作为表单选项名 | meta/description.html、advanced/* |
| `.disabled()` | `.disabled()`（无参） | 禁用该配置项，用户无法编辑 | meta/disabled.html |
| `.hidden()` | `.hidden()`（无参） | 隐藏该配置项，不呈现在表单中，但仍参与类型检查 | meta/disabled.html |
| `.deprecated()` | `.deprecated()`（无参） | 标记为已废弃的配置项 | meta/disabled.html |
| `.experimental()` | `.experimental()`（无参） | 标记为实验性的配置项 | meta/disabled.html、basic/array.html |
| `.role(name)` | `.role('')`、`.role('slider')`、`.role('secret')`、`.role('radio')`、`.role('link')`、`.role('color')`、`.role('datetime')`、`.role('date')`、`.role('time')`、`.role('table')`、`.role('checkbox')`、`.role('select')` | 描述配置项的外观，不影响该类型的实际行为 | meta/role.html 及各类型页 |
| `.role(name, options)` | `.role('textarea', { rows: [2, 4] })` | 带第二参数的外观设置；`rows` 限制文本域的最小和最大行数 | basic/string.html |
| `.min(n)` | `.min(0)` | 限制数值下限 | basic/number.html |
| `.max(n)` | `.max(100)` | 限制数值上限 | basic/number.html |
| `.step(n)` | `.step(1)` | 限制数值步长 | basic/number.html |
| `.pattern(regexp)` | `.pattern(/^custom$/i)` | 限制输入内容符合某个正则表达式（字符串） | basic/string.html |
| `.collapse()` | `.collapse()`（**无参**） | 对象：默认折叠为一个单独的配置项；字典/数组：设置为默认折叠；Intersect：将该分组默认折叠为一个单独的配置项 | basic/object.html、basic/dict.html、basic/array.html、advanced/intersect.html |
| `.comment(text)` | — | **未在文档中找到**（`/schema/` 章节无此方法） | — |
| `.hidden()`（重复确认） | 见上 | — | — |
| `.toString()` | — | **未在文档中找到** | — |
| `.set(...)` | — | **未在文档中找到** | — |
| `.extra(...)` | — | 未在 `/schema/` 章节找到；仅在版本介绍页提到「支持了 `.extra()` 方法和类型扩展」 | releases/v4.14.html（非 `/schema/` 页面） |

补充（非 `/schema/` 页面，但同站 `guide/plugin/schema.html` 出现，可作旁证）：

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

来源：https://koishi.chat/zh-CN/guide/plugin/schema.html

同一页还给出最简基例：

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

---

# `.role()` 合法取值汇总（仅文档化者）

| 适用类型 | `.role()` 取值 | 文档原文含义 | 来源页面 |
|---|---|---|---|
| Number | `''`（空字符串） | 默认外观（示例中与设置外观的版本对照） | meta/role.html |
| Number | `'slider'` | 滑块；number 页称「支持输入框和滑块」 | basic/number.html、meta/role.html |
| String | `''` | 默认外观 | meta/role.html |
| String | `'secret'` | 默认情况下不显示输入框中的内容，可点击按钮切换 | basic/string.html |
| String | `'link'` | 点击可访问输入框中的链接 (同时输入框也会稍长一些) | basic/string.html |
| String | `'textarea'` | 输入框显示在配置项下侧，为自适应高度的多行文本域；可通过 `rows` 属性限制最小和最大行数 | basic/string.html |
| String | `'color'` | 输入框显示为颜色选择器 | basic/string.html |
| String | `'datetime'` | 与 `Schema.date()` 前端体验完全一致，仅输出格式不同 | basic/date.html |
| String | `'date'` | 纯日期字符串 | basic/date.html |
| String | `'time'` | 纯时间字符串 | basic/date.html |
| Union | `''` | 默认外观 | meta/role.html |
| Union | `'radio'` | 可选值有较长描述文本时使用；所有选项显示在下方而不是右侧 | advanced/union-select.html、meta/role.html |
| Array | `'table'` | 将数组以表格形式显示 | basic/array.html |
| Array | `'checkbox'` | 已知字符串构成的数组以复选框形式显示（配合 `Schema.array(Schema.union([...]))`） | basic/array.html、basic/bitset.html |
| Array | `'select'` | 以复选菜单的形式显示 | basic/array.html（TIP 链接）、basic/bitset.html |
| Dict | `'table'` | 将字典以表格形式显示 | basic/dict.html |
| Bitset（配合 array+union） | `'checkbox'` | 使输出为字符串数组的复选框形式 | basic/bitset.html |
| Bitset | `'select'` | 以复选菜单的形式呈现 | basic/bitset.html |

未文档化 `.role()` 取值的类型：`Schema.boolean()`、`Schema.object()`、`Schema.intersect()`、`Schema.tuple()`、`Schema.path()`、`Schema.date()`（其自身无 role，靠字符串 role 表达）。

---

# 控制台（Koishi console）呈现相关说明（逐字摘录）

| 说明 | 来源页面 |
|---|---|
| 未配置的必需配置项的左侧会出现红色的提示线。对于字符串等原始类型，空串和未配置是两个不同的概念，可通过控件中央的水平线来区分。 | meta/required.html |
| 如果没有传入值，则默认值会作为初始状态呈现在表单中。在配置项菜单中可以选择将配置项恢复为默认值。如果你将某个配置项修改为了默认值，则该配置项实际上会被清除，以确保配置文件的简洁性。 | meta/default.html |
| `.description()` 添加在属性上时显示在名称下方，添加在对象上时表现为小标题；支持基本的行内 Markdown 语法。 | meta/description.html |
| 禁用的配置项无法被用户编辑。隐藏的配置项不会呈现在表单中，但是它们仍然会参与类型检查。 | meta/disabled.html |
| `.role()` 描述了一个配置项的外观，而不会影响该类型的实际行为。 | meta/role.html |
| 使用 `.collapse()` 可以将对象默认折叠为一个单独的配置项。 | basic/object.html |
| 使用 `.collapse()` 可以将配置项设置为默认折叠（字典/数组）。使用 `.role('table')` 可以将字典/数组以表格形式显示。 | basic/dict.html、basic/array.html |
| `Schema.number()` 支持输入框和滑块。 | basic/number.html |
| `Schema.boolean()` 以开关的形式描述了一个布尔值。 | basic/boolean.html |
| `Schema.bitset()` 以复选框的形式描述了一个整数。 | basic/bitset.html |
| `Schema.tuple()` 的元素「会被显示在同一行中」。 | basic/tuple.html |
| `Schema.path()` 该配置项会显示成一个能够打开文件选择器的按钮。 | basic/path.html |
| Intersect 一种最常见的用法是将配置项分为多组显示；使用 `.collapse()` 可以将分组默认折叠为一个单独的配置项。 | advanced/intersect.html |
| Union 设置 `role` 为 `radio` 后「所有的选项将显示在下方而不是右侧」。 | advanced/union-select.html |
| Union 各子类型的 description「会作为表单中呈现的选项」。 | advanced/union-arbitrary.html |
| Transform：「在网页表单中，将只会显示输出类型。」 | advanced/transform.html |
| 版本介绍（v4.14 配置界面优化）：schemastery-vue 升级到 v7；支持 `.collapse()` 显式声明可折叠；支持 `.experimental()` 与 `.deprecated()`；部分类型支持「在上方插入」「在下方插入」；`bitset` 支持「全部选中」「清空选择」；支持 `.extra()` 方法和类型扩展。 | releases/v4.14.html（非 `/schema/` 页面） |

---

# 明确「未在文档中找到」的条目

- `Schema.natural()` —— 未在 `/schema/` 章节出现（number 页无相关说明）。
- `Schema.from` / `Schema.to` —— 未出现。
- `.comment(text)` —— 未出现。
- `.set(...)` —— 未出现。
- `.toString()` —— 未出现。
- `.extra(...)` —— 未在 `/schema/` 章节出现；仅 v4.14 版本介绍页提及。
- `Schema.boolean()` / `Schema.object()` / `Schema.intersect()` 的专属 `.role()` 取值 —— 未出现。
- `Schema.bitset()` 的参数类型定义、`Schema.transform()` 的完整 TypeScript 签名（返回类型等） —— 文档只给出调用示例，未给出正式签名。
