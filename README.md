# harvest-auto

## 简介

**harvest-auto** 是一个命令行工具（CLI），可将本地日报 JSON 文件一键导入 [Harvest](https://www.getharvest.com/) 工时系统。
支持命令行直接使用，也可作为 Node.js 模块引入项目二次开发。
工具自动适应路径粘贴，支持中文路径、带空格路径（需加引号），高效适配日常团队工时批量填报场景。

---

## 安装

### 方式一：本地安装

首先克隆或下载本仓库，然后在项目目录下安装依赖：

```bash
npm install
```

### 方式二：全局安装（推荐）

你可以通过 npm 全局安装本工具，这样在任何目录下都可以直接运行：

```bash
npm install -g @whtg/harvest-auto
```

---

## 环境配置（全局/本地）

### 全局配置首选（推荐！）

全局安装后，直接在命令行运行以下命令，会自动在主目录创建配置文件（如 `~/.harvest-auto.env`）：

```bash
harvest-auto
```

如果配置未完善，会引导你去编辑 `~/.harvest-auto.env` 文件。用文本编辑器（如 VSCode）打开后，填写你的 Harvest 账号信息、API Token 和项目/任务 ID 映射等。

配置好环境后，你可以在任意路径下直接运行：

```bash
harvest-auto -f "/完整/路径/日报.json"
```

如需仅预览而不提交，可加 `--dry-run`：

```bash
harvest-auto -f "/完整/路径/日报.json" --dry-run
```

1. **首次运行工具时，会自动在你的主目录（如 `~/.harvest-auto.env`）生成配置模板**，内容如下：

    ```
    HARVEST_ACCOUNT_ID=你的Harvest账号ID
    HARVEST_TOKEN=你的Harvest API Token
    USER_AGENT=自定义标识(如 your-email@example.com)
    PROJECT_MAP={"项目A":项目A 的 id,"项目B":项目B 的 id}
    TASK_MAP={"任务A":任务A 的 id,"任务B":任务B 的 id}
    ```

    - 手动打开：
      `~/.harvest-auto.env`
    - 编辑并保存实际的账号/token/项目和任务的 ID 后再次运行本工具即可正常使用。

2. **说明**
    - `HARVEST_ACCOUNT_ID` 及 `HARVEST_TOKEN` 需要从 Harvest 个人 API 页面获取
    - `USER_AGENT` 一般填写邮箱或项目名，必须有内容
    - `PROJECT_MAP` 和 `TASK_MAP` 是名称与 ID 的映射（Harvest 后台可查ID）

### 兼容：本地 `.env` 文件也可被识别

如果你习惯使用本地目录下的 `.env` 文件，内容与上述一致，也能被工具读取（优先级低于全局 `~/.harvest-auto.env`）。

> **强烈建议全局配置**，这样无论 CLI 工具安装在哪里，全局都能通用。

---

## 日报文件格式：支持 JSON 或 Markdown/文本格式

### 方式一：标准 JSON

日报文件应为数组，每个元素有 `date`（日期）、`items`（当日多项明细）。每一明细包含 `project`、`task`、`notes` 三字段。例如：

```json
[
  {
    "date": "2024-06-01",
    "items": [
      {
        "project": "项目A",
        "task": "任务A",
        "notes": "完善模块功能"
      }
    ]
  },
  {
    "date": "2024-06-02",
    "items": [
      { "project": "项目B", "task": "任务B", "notes": "实现接口开发" }
    ]
  }
]
```

---

### 方式二：简单文本/markdown日记风（无需手动转json，推荐！）
你可以直接写如下格式，每天开头 `YYYY-MM-DD project: '项目名'`，下方每行都是一条事项，保存为 `.md` 或 `.txt` 也可：

```
2025-06-23 project: 'SC'
Handled upload exceptions, changed the location of error alerts, and enhanced error description display.
Researched the issue of first login leading to the chat module, discovering no data present.

2025-06-24 project: 'SC'
Cooperated with the backend to resolve the issue of empty session id and token for new user logins.
Changed the data handling method, added separate storage for session id and token.
```

- 无需每行加 `-`、无需自己转json，每一行自动作为当天的事项导入
- `project` 由头部自动识别，`task` 自动默认为“开发”，如需细分可导入后到 Harvest 平台手动调整
- 支持.md/.txt/.daylog等扩展名（只要内容格式如上即可）

工具会自动识别 JSON 或 Markdown/文本风日报，无需单独转换！

---

## 使用方法

### CLI 命令行用法

#### 全局安装用户

全局安装后可直接使用如下命令，无需 npx：

```bash
harvest-auto -f "/完整/路径/日报.json"
```

#### 本地安装用户

```bash
npx harvest-auto -f "/完整/路径/日报.json"
```

- **如果路径中含有空格，务必用英文引号 `"` 包裹整个路径**
  例如：
  `harvest-auto -f "/Users/用户名/工作日报 2024.06.json"`

- 未加 `-f` 时，终端会交互式提示输入文件路径，并自动净化首尾空格/引号/换行。

- 如需预览内容而非真正上报，可加 `--dry-run`：

  ```
  harvest-auto -f "/路径/日报.json" --dry-run
  ```

  仅输出即将上报的 JSON，不提交数据。

- **如果首次使用自动生成配置文件，需在编辑好后再次运行工具！**

### 作为 Node.js 模块引入

也可以在自己的脚本中直接调用核心接口：

```js
const { fillAllReports } = require('./index');
fillAllReports(dailyReportsArray);
```

---

## 其他说明

- 每条日报会随机生成 1.5~2.5 之间（保留一位小数）的工时量填入（hours 字段，自动生成）
- 如果某条项目或任务找不到映射，将详细报错并跳过该条（不会影响其他数据导入）
- 仅支持批量插入，不支持修改和删除功能
- 若看到“请手动打开如下路径进行编辑”提示，请用任意文本编辑器编辑对应文件并保存

---

## 常见问题

1. **报“找不到此文件”？**
   - 检查路径有无空格或特殊符号未被引号包裹
   - 路径首尾如有引号、空格、换行符，工具会自动清理

2. **项目/任务未配置映射？**
   - 请在 `.env` 中 `PROJECT_MAP`/`TASK_MAP` 添加所有所需名称及对应ID

3. **报 API 权限异常？**
   - 检查 `HARVEST_TOKEN` 是否有效，权限是否正确

---

## 注意事项

- **强烈建议**：如路径含空格或为中文路径，务必加英文引号！
- 本工具不做幂等控制，如多次运行可能会产生重复填报
- 配置项改动需重启命令或重新运行脚本生效
- 日报 JSON 会做内容完整性基本校验，若异常会终止并报错

---

## 反馈与贡献

如有建议、Bug 或新需求，欢迎提 Issue 或 PR！

---
