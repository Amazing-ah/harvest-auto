#!/usr/bin/env node
/**
 * harvest-auto CLI 工具
 * 支持: 命令行导入日报JSON至Harvest (需.env配置)、也支持 require 引用
 * 路径健壮升级：自动去除路径首尾空格、引号、换行
 */
require('dotenv').config();
const { program } = require('commander');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();
const ora = require('ora').default;
const {
  parseMarkdownToDailyReports,
} = require('./utils/markdownToDailyReports');
const {
  ensureUserEnvFileInteractive,
  changeUserEnvFileInteractive,
} = require('./utils/envSetup');
const { MSG } = require('./i18n/messages');

// ------ 环境变量与配置 ------

// ------ 工时生成 ------
function normalHoursArr(len, min = 1.46, max = 3, dayTotal = 8, LANG = 'CN') {
  const maxTries = 200;
  // 先快速排除不合法的请求
  if (min * len > dayTotal || max * len < dayTotal) {
    throw new Error(MSG[LANG].HOURS_RANGE_ERROR);
  }
  for (let t = 0; t < maxTries; t++) {
    let left = dayTotal;
    const arr = [];
    for (let i = 0; i < len; i++) {
      let localMin = min;
      let localMax = max;
      // 剩余最小/最大用于保证必合法
      if (i < len - 1) {
        // 后面条数*最小工时
        localMax = Math.min(max, left - min * (len - i - 1));
        localMin = Math.max(min, left - max * (len - i - 1));
        if (localMax < localMin) {
          // 本轮采样失败，重采
          break;
        }
        // 偏向于2左右
        let bias = 2;
        let range = localMax - localMin;
        // 加入偏好中心
        let v = +(localMin + Math.random() * range).toFixed(2);
        if (range >= 1) {
          // 带中心偏移
          v = +Math.max(
            localMin,
            Math.min(localMax, bias + (Math.random() - 0.5) * range * 0.8)
          ).toFixed(2);
        }
        arr.push(v);
        left -= v;
      } else {
        // 最后一条直接补齐
        arr.push(+left.toFixed(2));
      }
    }
    // 验证合法
    if (
      arr.length === len &&
      arr.every((v) => v >= min && v <= max) &&
      +arr.reduce((a, b) => a + b, 0).toFixed(2) === +dayTotal.toFixed(2)
    ) {
      return arr;
    }
  }
  throw new Error(MSG[LANG].HOURS_SAMPLING_ERROR);
}

// ------ Harvest接口 ------
async function createTimeEntry(
  { date, project, task, notes, hours },
  { PROJECT_MAP, TASK_MAP, HARVEST_ACCOUNT_ID, HARVEST_TOKEN, USER_AGENT },
  LANG = 'CN'
) {
  const project_id = PROJECT_MAP[project];
  const task_id = TASK_MAP[task];
  if (!project_id) throw new Error(MSG[LANG].PROJECT_NOT_MAPPED(project));
  if (!task_id) throw new Error(MSG[LANG].TASK_NOT_MAPPED(task));

  const data = { project_id, task_id, spent_date: date, hours, notes };

  return axios({
    url: 'https://api.harvestapp.com/v2/time_entries',
    method: 'post',
    headers: {
      'Harvest-Account-Id': HARVEST_ACCOUNT_ID,
      Authorization: `Bearer ${HARVEST_TOKEN}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
    data,
  });
}

// ------ 502自动重试封装 ------
async function createTimeEntryWithRetry(
  args,
  opts,
  LANG = 'CN',
  maxRetry = 3,
  delay = 1000
) {
  let lastErr;
  for (let i = 0; i < maxRetry; i++) {
    try {
      return await createTimeEntry(args, opts, LANG);
    } catch (err) {
      lastErr = err;
      // 检查是否是502网关错误
      const status = err.response?.status || err.status;
      if (status !== 502) throw err;
      // 502: 自动重试，延迟递增
      if (i < maxRetry - 1) {
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// ------ 核心导入逻辑（可单独require引用） ------
/**
 * 导入所有日报，每日总工时保证 >=8 小时，单条工时1.4~2.4随机，最后一条补足。
 * 传入 opts 以携带PROJECT_MAP、TASK_MAP等
 */
async function fillAllReports(dailyReports, opts, LANG) {
  for (const { date, items } of dailyReports) {
    const arrLen = items.length;
    // 区间必须吻合采样逻辑
    const min = 1.46;
    const max = 3;
    // 求最大、最小允许总和
    const minSum = +(min * arrLen).toFixed(2);
    const maxSum = +(max * arrLen).toFixed(2);
    // 动态生成 dayTotal，使其处于允许区间且几个工作日不会完全一样
    let dayTotal;
    let tries = 0;
    do {
      dayTotal = +(8 + Math.random() * 2).toFixed(2); // 8~10 之间取2位
      tries++;
      // 超范围自动强收敛
      if (dayTotal < minSum) dayTotal = minSum;
      if (dayTotal > maxSum) dayTotal = maxSum;
    } while (++tries < 5 && (dayTotal < minSum || dayTotal > maxSum));

    let hoursArr;
    try {
      hoursArr = normalHoursArr(arrLen, min, max, dayTotal, LANG);
    } catch (e) {
      // 容错：前n-1条为min，最后一条补足
      hoursArr = Array(arrLen).fill(min);
      hoursArr[arrLen - 1] = +(dayTotal - min * (arrLen - 1)).toFixed(2);
      if (hoursArr[arrLen - 1] > max) {
        console.warn(
          MSG[LANG].WARNING_HOURS_ITEMS(date, dayTotal, arrLen, max, true)
        );
      } else {
        console.warn(
          MSG[LANG].WARNING_HOURS_ITEMS(date, dayTotal, arrLen, max, false)
        );
      }
    }

    for (let i = 0; i < arrLen; i++) {
      const item = items[i];
      const hours = hoursArr[i];

      // project/task都去除全角/半角空白，始终取明细自身字段
      const project =
        item.project && typeof item.project === 'string'
          ? item.project.replace(/[\s\u3000]/g, '').trim()
          : '';
      const task =
        item.task && typeof item.task === 'string'
          ? item.task.replace(/[\s\u3000]/g, '').trim()
          : '';

      // 使用 ora 动画
      const spinner = ora(
        MSG[LANG].SUBMIT_PROGRESS(date, project, task, hours)
      ).start();

      try {
        await createTimeEntryWithRetry(
          {
            ...item,
            date,
            project,
            task,
            hours,
          },
          opts,
          LANG
        );
        spinner.succeed(
          MSG[LANG].SUBMIT_OK(date, project, task, hours, item.notes)
        );
      } catch (err) {
        spinner.fail(
          MSG[LANG].SUBMIT_FAIL(
            date,
            project,
            task,
            hours,
            item.notes,
            err.response?.data || err.message || err
          )
        );
      }
    }
  }
}

module.exports = { fillAllReports };

// ------ CLI部分 ------
if (require.main === module) {
  // 捕获 Ctrl+C，友好中断提示（多语言）
  process.on('SIGINT', () => {
    // 用 env 里正确的 HARVEST_AUTO_LANG
    const { MSG } = require('./i18n/messages');
    let LANG = (process.env.HARVEST_AUTO_LANG || 'CN').toUpperCase().trim();
    if (!MSG[LANG]) LANG = 'CN';
    console.log('\x1b[33m%s\x1b[0m', MSG[LANG].SIGINT);
    process.exit(0);
  });
  // 首次运行时交互式创建配置
  (async () => {
    const homedir = os.homedir();
    const userEnvPath = path.join(homedir, '.harvest-auto.env');
    await ensureUserEnvFileInteractive();

    // 这里确保 env 文件已经确保存在，然后动态加载
    require('dotenv').config({ path: userEnvPath });

    // 重新读取配置
    const HARVEST_ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID;
    const HARVEST_TOKEN = process.env.HARVEST_TOKEN;
    const USER_AGENT = process.env.USER_AGENT;

    let PROJECT_MAP = {};
    try {
      PROJECT_MAP = JSON.parse(process.env.PROJECT_MAP || '{}');
    } catch (e) {
      console.error('\x1b[31m%s\x1b[0m', MSG[LANG].PROJECT_MAP_INVALID);
      process.exit(1);
    }

    let TASK_MAP = {};
    try {
      TASK_MAP = JSON.parse(process.env.TASK_MAP || '{}');
    } catch (e) {
      console.error('\x1b[31m%s\x1b[0m', MSG[LANG].TASK_MAP_INVALID);
      process.exit(1);
    }

    // 在 dotenv 加载后定义 HARVEST_AUTO_LANG，并用于后续所有国际化
    let LANG = (process.env.HARVEST_AUTO_LANG || 'CN').toUpperCase().trim();
    // 防御性：不支持的 lang fallback
    if (!MSG[LANG]) LANG = 'CN';

    program
      .name('harvest-auto')
      .usage('-f <日报json> [options]')
      .description(MSG[LANG].CLI_DESC)
      .option('-f, --file <file>', MSG[LANG].FILE_PATH_ASK)
      .option('--dry-run', MSG[LANG].DRY_RUN_DESC)
      .option(
        '-c, --change',
        LANG === 'CN'
          ? '交互式修改 ~/.harvest-auto.env 配置文件'
          : 'Interactively change ~/.harvest-auto.env config'
      )
      .helpOption('-h, --help', MSG[LANG].HELP_DESC)
      .parse(process.argv);

    let { file, dryRun, change } = program.opts();

    try {
      // 新增: 修改env配置命令
      if (change) {
        await changeUserEnvFileInteractive();
        process.exit(0);
      }

      // 路径净化函数：去除首尾空格、引号和换行
      function cleanPath(val) {
        if (!val) return val;
        return (
          val
            .trim()
            .replace(/^"+|"+$/g, '')
            .replace(/\r?\n/g, '')
            // 通用反斜杠转义字符还原（空格、&, (, )、中文符号等终端粘贴都支持）
            .replace(/\\(.)/g, '$1')
        );
      }

      try {
        // 如未指定文件参数，则用inquirer交互获取
        if (!file) {
          const { inputFile } = await prompt([
            {
              type: 'input',
              name: 'inputFile',
              message: MSG[LANG].FILE_PATH_ASK,
              validate(val) {
                let p = cleanPath(val);
                if (p.startsWith('~')) {
                  p = path.join(process.env.HOME, p.slice(1));
                }
                if (!fs.existsSync(p)) {
                  return MSG[LANG].FILE_NOT_FOUND(p);
                }
                return true;
              },
            },
          ]);
          file = inputFile;
        }

        // 确认环节和后续都清理路径
        let p = cleanPath(file);
        if (p.startsWith('~')) {
          p = path.join(process.env.HOME, p.slice(1));
        }
        const { confirmRead } = await prompt([
          {
            type: 'confirm',
            name: 'confirmRead',
            message: MSG[LANG].FILE_PATH_CONFIRM(p),
            default: true,
          },
        ]);
        if (!confirmRead) {
          console.log(MSG[LANG].CANCEL);
          process.exit(0);
        }

        let dailyReports = [];
        try {
          const content = fs.readFileSync(p, 'utf-8');
          try {
            // 先尝试 JSON 格式
            dailyReports = JSON.parse(content);
          } catch {
            // 非 JSON 时，尝试用 md/daylog 转换器
            dailyReports = parseMarkdownToDailyReports(content);
          }
          if (!Array.isArray(dailyReports) || dailyReports.length === 0)
            throw new Error(MSG[LANG].NO_VALID_REPORT);
        } catch (e) {
          console.error(MSG[LANG].READ_FAIL, e.message || e);
          process.exit(1);
        }

        if (dryRun) {
          console.log(JSON.stringify(dailyReports, null, 2));
          console.log(MSG[LANG].DRY_RUN);
        } else {
          await fillAllReports(
            dailyReports,
            {
              PROJECT_MAP,
              TASK_MAP,
              HARVEST_ACCOUNT_ID,
              HARVEST_TOKEN,
              USER_AGENT,
            },
            LANG
          );
          // 所有填报完成后全局成功提示
          console.log('\x1b[32m%s\x1b[0m', MSG[LANG].SUBMIT_FINISH);
        }
      } catch (err) {
        if (err && err.name === 'ExitPromptError') {
          let tip = MSG[LANG].CANCEL + '\n' + (MSG[LANG].EXIT_MID || '');
          console.log('\x1b[33m%s\x1b[0m', tip);
          process.exit(0);
        }
        throw err;
      }
    } catch (err) {
      if (err && err.name === 'ExitPromptError') {
        let tip = MSG[LANG].CANCEL + '\n' + (MSG[LANG].EXIT_MID || '');
        console.log('\x1b[33m%s\x1b[0m', tip);
        process.exit(0);
      }
      throw err;
    }
  })();
}
