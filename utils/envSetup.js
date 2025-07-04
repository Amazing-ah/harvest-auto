const fs = require('fs');
const os = require('os');
const path = require('path');
const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();
const { MSG } = require('../i18n/messages');

/**
 * 字段定义与说明：导出函数确保多处引用时字段/校验/i18n皆一致
 */
function getEnvFields(currentLang, MSG) {
  return [
    {
      key: 'HARVEST_AUTO_LANG',
      message:
        MSG[currentLang].HARVEST_AUTO_LANG_LABEL || '界面/提示语言（CN/EN）',
      validate: (v) =>
        ['CN', 'EN'].includes(v.trim().toUpperCase())
          ? true
          : MSG[currentLang].HARVEST_AUTO_LANG_INVALID || '请输入 CN 或 EN',
      filter: (v) => v.trim().toUpperCase(),
    },
    {
      key: 'HARVEST_ACCOUNT_ID',
      message: MSG[currentLang].HARVEST_ACCOUNT_ID,
      validate: (v) => !!v || MSG[currentLang].NOT_EMPTY_ERROR,
    },
    {
      key: 'HARVEST_TOKEN',
      message: MSG[currentLang].HARVEST_TOKEN,
      validate: (v) => !!v || MSG[currentLang].NOT_EMPTY_ERROR,
    },
    {
      key: 'USER_AGENT',
      message: MSG[currentLang].USER_AGENT,
      validate: (v) => !!v || MSG[currentLang].NOT_EMPTY_ERROR,
    },
    {
      key: 'PROJECT_MAP',
      message: MSG[currentLang].PROJECT_MAP,
      validate: (v) => {
        if (!v) return MSG[currentLang].NOT_EMPTY_ERROR;
        try {
          const r = JSON.parse(v);
          return typeof r === 'object' && !Array.isArray(r)
            ? true
            : MSG[currentLang].PROJECT_MAP_ERR;
        } catch {
          return MSG[currentLang].PROJECT_MAP_ERR;
        }
      },
      filter: (v) => JSON.stringify(JSON.parse(v)),
    },
    {
      key: 'TASK_MAP',
      message: MSG[currentLang].TASK_MAP,
      validate: (v) => {
        if (!v) return MSG[currentLang].NOT_EMPTY_ERROR;
        try {
          const r = JSON.parse(v);
          return typeof r === 'object' && !Array.isArray(r)
            ? true
            : MSG[currentLang].TASK_MAP_ERR;
        } catch {
          return MSG[currentLang].TASK_MAP_ERR;
        }
      },
      filter: (v) => JSON.stringify(JSON.parse(v)),
    },
  ];
}

/**
 * 交互式创建~/.harvest-auto.env文件（首次）
 */
async function ensureUserEnvFileInteractive() {
  const homedir = os.homedir();
  const userEnvPath = path.join(homedir, '.harvest-auto.env');
  // 检查当前用户目录下文件是否存在
  let isFirstRun = !fs.existsSync(userEnvPath);
  let envContent = isFirstRun
    ? ''
    : fs.readFileSync(userEnvPath, { encoding: 'utf-8' });
  let matchedLang = envContent.match(/^\s*HARVEST_AUTO_LANG\s*=\s*(\w+)/m);
  let currentLang = matchedLang?.[1] || null;
  let osLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  // 检测系统语言
  let guessedLang = osLocale.startsWith('zh') ? 'CN' : 'EN';

  // 要求选择语言（首次，或之前没 LANG 字段的情况）
  if (isFirstRun || !currentLang) {
    console.log('\n');
    // 系统语言提示，双语合成
    console.log(
      '\x1b[36m%s\x1b[0m',
      MSG[guessedLang].SYSTEM_LANG_DETECTED(osLocale)
    );
    const { selectedLang } = await prompt([
      {
        type: 'list',
        name: 'selectedLang',
        message: MSG[guessedLang].LANGUAGE_CHOICE,
        choices: [
          { name: MSG.CN.LANG_ZH, value: 'CN' },
          { name: MSG.CN.LANG_EN, value: 'EN' },
        ],
        default: guessedLang,
      },
    ]);
    currentLang = selectedLang;
    // 如果不是首次（已有env文件但无LANG），补写一行LANG
    if (!isFirstRun) {
      let newContent =
        envContent.trim() + `\nHARVEST_AUTO_LANG=${currentLang}\n`;
      fs.writeFileSync(userEnvPath, newContent, { encoding: 'utf-8' });
      console.log('\x1b[32m%s\x1b[0m', MSG[currentLang].ENV_PATCHED);
    }
  }

  if (isFirstRun) {
    const FIELDS = getEnvFields(currentLang, MSG);

    let envData = { LANG: currentLang };
    for (const f of FIELDS) {
      let confirmed = false;
      let val;
      while (!confirmed) {
        const { inputVal } = await prompt([
          {
            type: 'input',
            name: 'inputVal',
            message: f.message,
            validate: f.validate,
          },
        ]);
        val = f.filter ? f.filter(inputVal) : inputVal;
        const { isOk } = await prompt([
          {
            type: 'confirm',
            name: 'isOk',
            message: MSG[currentLang].CONFIRM(f.key, val),
            default: true,
          },
        ]);
        confirmed = isOk;
      }
      envData[f.key] = val;
    }

    // 拼装env内容，LANG在最前
    const envTemplate = [
      `HARVEST_AUTO_LANG=${envData.LANG}`,
      `HARVEST_ACCOUNT_ID=${envData.HARVEST_ACCOUNT_ID}`,
      `HARVEST_TOKEN=${envData.HARVEST_TOKEN}`,
      `USER_AGENT=${envData.USER_AGENT}`,
      `PROJECT_MAP=${envData.PROJECT_MAP}`,
      `TASK_MAP=${envData.TASK_MAP}`,
      '',
    ].join('\n');
    fs.writeFileSync(userEnvPath, envTemplate, { encoding: 'utf-8' });

    console.log('\x1b[32m%s\x1b[0m', MSG[currentLang].ENV_SUCCESS(userEnvPath));
    return;
  }
}

/**
 * 交互式更改~/.harvest-auto.env字段，只修改选中的字段，支持多语言。
 */
async function changeUserEnvFileInteractive() {
  const homedir = os.homedir();
  const userEnvPath = path.join(homedir, '.harvest-auto.env');
  let envContent, matchedLang, currentLang;
  if (!fs.existsSync(userEnvPath)) {
    console.log(
      '\x1b[31m%s\x1b[0m',
      '配置文件不存在，请先执行任意填报或初始化.'
    );
    return;
  }
  envContent = fs.readFileSync(userEnvPath, { encoding: 'utf-8' });
  matchedLang = envContent.match(/^\s*HARVEST_AUTO_LANG\s*=\s*(\w+)/m);
  currentLang = matchedLang?.[1] || 'CN';
  if (!MSG[currentLang]) currentLang = 'CN';

  // 解析当前env内容
  let currentEnv = {};
  envContent.split(/\r?\n/).forEach((line) => {
    let m = line.match(/^\s*([\w_]+)\s*=\s*(.+)$/);
    if (m) {
      currentEnv[m[1]] = m[2];
    }
  });
  // 字段定义
  let FIELDS = getEnvFields(currentLang, MSG);

  // ==== 新交互：先问“全部还是部分字段” ====
  const { doType } = await prompt([
    {
      type: 'list',
      name: 'doType',
      message: MSG[currentLang].CHANGE_ENV_CHOOSE_MODE,
      choices: [
        { name: MSG[currentLang].CHANGE_ENV_CHOOSE_ALL, value: 'ALL' },
        { name: MSG[currentLang].CHANGE_ENV_CHOOSE_PART, value: 'PART' },
      ],
      default: 'ALL',
    },
  ]);

  let keys = [];
  if (doType === 'ALL') {
    // 优先处理 lang 字段
    let envData = { ...currentEnv };
    const langField = 'HARVEST_AUTO_LANG';
    const langFieldDesc = FIELDS.find((f) => f.key === langField);
    let confirmedLang = false;
    let langVal = currentEnv[langField] || currentLang;
    while (!confirmedLang) {
      const { inputLang } = await prompt([
        {
          type: 'list',
          name: 'inputLang',
          message:
            langFieldDesc.message +
            (langVal
              ? currentLang === 'CN'
                ? `（当前：${langVal}）`
                : ` (current: ${langVal})`
              : ''),
          default: langVal,
          choices: [
            { name: MSG[currentLang].LANG_ZH || '简体中文(CN)', value: 'CN' },
            { name: MSG[currentLang].LANG_EN || 'English(EN)', value: 'EN' },
          ],
        },
      ]);
      let realLang = inputLang;
      const { isOk } = await prompt([
        {
          type: 'confirm',
          name: 'isOk',
          message: MSG[currentLang].CONFIRM(langField, realLang),
          default: true,
        },
      ]);
      confirmedLang = isOk;
      if (confirmedLang) envData[langField] = realLang;
    }
    // 更新 lang 相关配置和字段定义
    currentLang = envData[langField];
    FIELDS = getEnvFields(currentLang, MSG);
    // 其它字段顺序（除 lang 外的所有字段）
    const keysNoLang = FIELDS.filter((f) => f.key !== 'HARVEST_AUTO_LANG').map(
      (f) => f.key
    );

    // 开始逐项变更其它字段
    for (const key of keysNoLang) {
      const desc = FIELDS.find((f) => f.key === key);
      let confirmed = false;
      let val = currentEnv[key] || '';
      while (!confirmed) {
        const { inputVal } = await prompt([
          {
            type: 'input',
            name: 'inputVal',
            message:
              desc.message +
              (val
                ? currentLang === 'CN'
                  ? ` [当前值: ${val}]`
                  : ` [Current: ${val}]`
                : ''),
            default: val,
            validate: desc.validate,
          },
        ]);
        let realInput = desc.filter ? desc.filter(inputVal) : inputVal;
        const { isOk } = await prompt([
          {
            type: 'confirm',
            name: 'isOk',
            message: MSG[currentLang].CONFIRM(key, realInput),
            default: true,
          },
        ]);
        confirmed = isOk;
        if (confirmed) envData[key] = realInput;
      }
    }

    // 重新组装env文件内容，LANG最前
    const envLines = [
      `HARVEST_AUTO_LANG=${envData['HARVEST_AUTO_LANG']}`,
      ...FIELDS.filter((f) => f.key !== 'HARVEST_AUTO_LANG').map(
        (f) => `${f.key}=${envData[f.key] || ''}`
      ),
      '',
    ];
    fs.writeFileSync(userEnvPath, envLines.join('\n'), { encoding: 'utf-8' });

    console.log(
      '\x1b[32m%s\x1b[0m',
      MSG[currentLang].CHANGE_ENV_DONE ||
        MSG.CN.CHANGE_ENV_DONE ||
        (currentLang === 'CN' ? '设置/修改已完成。' : 'Configuration updated.')
    );
  } else {
    // 部分字段模式
    // 只显示可选字段
    const { fieldsToChange } = await prompt([
      {
        type: 'checkbox',
        name: 'fieldsToChange',
        message: MSG[currentLang].CHANGE_ENV_SELECT_FIELDS,
        choices: FIELDS.map((f) => ({
          name: currentEnv[f.key]
            ? `${f.key}${
                currentLang === 'CN'
                  ? `（当前：${currentEnv[f.key]}）`
                  : ` (current: ${currentEnv[f.key]})`
              }`
            : f.key,
          value: f.key,
        })),
        pageSize: 10,
        validate: (v) =>
          v.length > 0 ? true : MSG[currentLang].CHANGE_ENV_MUST_SELECT,
      },
    ]);
    keys = fieldsToChange;

    let envData = { ...currentEnv };
    // 在部分字段修改时，交互过程中允许切换语言
    let actualCurrentLang = currentLang;
    for (const key of keys) {
      // 每次都用最新的 actualCurrentLang 展示字段描述和消息
      const curFields = getEnvFields(actualCurrentLang, MSG);
      const desc = curFields.find((f) => f.key === key);
      let confirmed = false;
      let val =
        envData[key] !== undefined ? envData[key] : currentEnv[key] || '';
      while (!confirmed) {
        let promptConfig;
        if (key === 'HARVEST_AUTO_LANG') {
          promptConfig = {
            type: 'list',
            name: 'inputVal',
            message:
              desc.message +
              (val
                ? actualCurrentLang === 'CN'
                  ? `（当前：${val}）`
                  : ` (current: ${val})`
                : ''),
            default: val,
            choices: [
              {
                name: MSG[actualCurrentLang].LANG_ZH || '简体中文(CN)',
                value: 'CN',
              },
              {
                name: MSG[actualCurrentLang].LANG_EN || 'English(EN)',
                value: 'EN',
              },
            ],
          };
        } else {
          promptConfig = {
            type: 'input',
            name: 'inputVal',
            message:
              desc.message +
              (val
                ? actualCurrentLang === 'CN'
                  ? `（当前：${val}）`
                  : ` (current: ${val})`
                : ''),
            default: val,
            validate: desc.validate,
          };
        }
        const { inputVal } = await prompt([promptConfig]);
        let realInput = desc.filter ? desc.filter(inputVal) : inputVal;

        // 用目标语言进行 HARVEST_AUTO_LANG 字段确认，其它字段用当前语种
        let confirmLang = actualCurrentLang;
        if (key === 'HARVEST_AUTO_LANG' && realInput) {
          confirmLang = realInput;
        }
        const { isOk } = await prompt([
          {
            type: 'confirm',
            name: 'isOk',
            message: MSG[confirmLang].CONFIRM(key, realInput),
            default: true,
          },
        ]);
        confirmed = isOk;
        if (confirmed) {
          envData[key] = realInput;
          // 实时切换语言
          if (
            key === 'HARVEST_AUTO_LANG' &&
            realInput &&
            realInput !== actualCurrentLang
          ) {
            actualCurrentLang = realInput;
          }
        }
      }
    }

    // 重新组装env文件内容，LANG最前
    const finishLang = envData['HARVEST_AUTO_LANG'] || actualCurrentLang;
    const envLines = [
      `HARVEST_AUTO_LANG=${finishLang}`,
      ...FIELDS.filter((f) => f.key !== 'HARVEST_AUTO_LANG').map(
        (f) => `${f.key}=${envData[f.key] || ''}`
      ),
      '',
    ];
    fs.writeFileSync(userEnvPath, envLines.join('\n'), { encoding: 'utf-8' });

    console.log(
      '\x1b[32m%s\x1b[0m',
      MSG[finishLang].CHANGE_ENV_DONE ||
        MSG.CN.CHANGE_ENV_DONE ||
        (finishLang === 'CN' ? '设置/修改已完成。' : 'Configuration updated.')
    );
  }
}

module.exports = {
  ensureUserEnvFileInteractive,
  changeUserEnvFileInteractive,
  getEnvFields,
};
