[简体中文](README.md) / [English](README_en.md)

# harvest-auto

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Daily Report Examples](#daily-report-examples)
- [Work Hour Allocation Logic](#work-hour-allocation-logic)
- [Command Reference](#command-reference)
- [FAQ](#faq)
- [Feedback & Contribution](#feedback--contribution)
- [Changelog](#changelog)

---

## Project Overview

**harvest-auto** is an intelligent automation tool dedicated to filling out daily/working time reports for the Harvest system.
It supports direct usage from the command line and can also be imported as a Node.js module in CI/automation pipelines, significantly boosting team batch time tracking, daily reporting, and individual efficiency.

---

## Key Features

- **Multiple Daily Report Formats**
  - Native JSON array
  - Tag-based input (e.g., `[project:XXX][task:YYY] Work content`, supports both global and inline tags)
- **Flexible Project/Task Declarations**
  - Declare globally (for the whole day) or per line, with clear priority and effortless inheritance
- **Intelligent Work Hour Allocation**
  - Each item is automatically assigned 1.46~3 hours, averaging about 2 hours
  - Total daily hours randomized between 8~10 hours, mimicking actual workflow
- **Precise Error Reporting**
  - Missing configs, API exceptions, invalid formats, etc., are accurately flagged and localized by day/item
- **Robust Path & Config Handling**
  - Supports drag-and-drop files, sanitizes Chinese, space, or special character paths
  - Auto-guided global/local .env configuration, command-line driven, bilingual support
  - Instantly modify configs or stop with Ctrl+C at runtime

---

## Getting Started

### Installation

**Recommended Global Install:**
```bash
npm install -g @whtg/harvest-auto
```

**Common Commands:**
```bash
harvest-auto
harvest-auto -f "/full/path/to/your/report"
harvest-auto -f "/full/path/to/your/report" --dry-run
harvest-auto -c      # Edit/env wizard for config
harvest-auto -h      # Display help
```
> Or use npx for quick one-off runs (no install needed):
> `npx harvest-auto -f "/full/path/to/your/report"`

---

## Environment Configuration

On first run, the tool will prompt you for required fields and auto-generate the config.
You can also manually edit `~/.harvest-auto.env`. Common configuration fields:

| Field               | Example Value               | Description                        |
|---------------------|----------------------------|------------------------------------|
| HARVEST_ACCOUNT_ID   | 123456                      | Your Harvest account ID              |
| HARVEST_TOKEN        | yyy                         | Your Harvest API token               |
| USER_AGENT           | someone@example.com         | Email for API request identification |
| HARVEST_AUTO_LANG    | CN / EN                     | Language (CN = Chinese, EN = English)|
| PROJECT_MAP          | {"A":123456,"B":33333}      | Mapping of project name to ID        |
| TASK_MAP             | {"Dev":12345,"Test":1}      | Mapping of task name to ID           |

---

## Daily Report Examples

### 1. Tag-based (Recommended)

```md
2025-07-01
[project:AAA][task:BBB]
Content A
Content B
[project:SC]
[task:CCC]Content C
Content D
```

**Parsing Rules:**
- Inline tags (e.g., `[task:CCC]Content C`) affect only their line and have highest priority
- A global declaration (single line like `[project:SC]`) impacts all following lines without explicit tags
- Omission of required tags yields an error; please supplement

**Parsed Example:**
```json
[
  {
    "date": "2025-07-01",
    "items": [
      { "project": "AAA", "task": "BBB", "notes": "Content A" },
      { "project": "AAA", "task": "BBB", "notes": "Content B" },
      { "project": "SC",  "task": "CCC", "notes": "Content C" },
      { "project": "SC",  "task": "BBB", "notes": "Content D" }
    ]
  }
]
```

### 2. Standard JSON Format

```json
[
  {
    "date": "2025-06-01",
    "items": [
      { "project": "A", "task": "Dev", "notes": "xxx" }
    ]
  }
]
```

---

## Work Hour Allocation Logic

- Each entry is auto-assigned **1.46~3 hours**; total per day varies **8~10 hours**—no manual input!
- If allocation fails, the process won't terminate: first n-1 items get the minimum, last item fills the remainder (exceeds max: only a warning).
- If entry count or total time is unreasonable, the CLI logs detailed warnings for manual review.
- Any Harvest API 502 error will be auto-retried up to 3 times for high stability.

---

## Command Reference

```
harvest-auto -f <report-file> [options]
```
| Option                | Description                                      |
|-----------------------|--------------------------------------------------|
| -f, --file <file>     | Path to report file, supports .json/.md/.txt/.daylog |
| --dry-run             | Preview what will be imported, but don't submit data |
| -h, --help            | Display help info                                |
| -c, --change          | Re-configure env (interactive wizard)            |

---

## FAQ

- **Q: “Missing project/task” error?**
  A: Please add both `[project:XXX][task:YYY]`, or declare globally on a single line for downstream inheritance.
- **Q: “Mapping not configured” error?**
  A: Add the mapping in `PROJECT_MAP`/`TASK_MAP` as needed, e.g., `{"Name":123456}`.
- **Q: Why is work hour allocation uneven?**
  A: CLI will warn if distribution is unusual—try balancing item counts or content.
- **Q: How do I safely stop the process?**
  A: Just press Ctrl+C at any time.

---

## Feedback & Contribution

Found a bug, have ideas, or want to contribute new features? Feel free to open an Issue or PR—let’s make this tool even better!

---

## Changelog

### 1.0.7
- Optimized Ctrl+C quitting/abort experience for initialization/config flow—no stacktrace, just a clear user message;
- Initial language selection supports smart preset, no redundant double entry;
- Multi-language support explicitly uses HARVEST_AUTO_LANG (CN/EN) — consistent in docs and code;
- Changelog and FAQ structure now clearer and more detailed.

### 1.0.6
- Terminal setup wizard for config on first run—no manual editing needed, instantly usable.
- Added completion and manual termination prompts.
- Bilingual interface support & command-line config modification.

### 1.0.5
- Documentation improvements.

### 1.0.4
- Work hour allocation: now 1.46~3h per item; 8~10h total per day, randomized for realism.
- Failed allocation invokes fallback with detailed warning, submission won’t stop.
- 502 and other Harvest API errors auto-retry up to 3 times for robustness.
- Log and documentation improvements.
