const fs = require('fs');
const os = require('os');
const path = require('path');
const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();
const { MSG } = require('../i18n/messages');

/**
 * 交互式创建~/.harvest-auto.env文件
 * 首次使用时让用户逐项填写并确认各项参数，无需手动编辑文件。
 * 调用：
 *   await ensureUserEnvFileInteractive();
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
    // 字段定义与说明（中英双语，随 currentLang 切换）
    // === 用 i18n 消息 ===
    const FIELDS = [
      {
        key: 'HARVEST_ACCOUNT_ID',
        message: MSG[currentLang].HARVEST_ACCOUNT_ID,
        validate: (v) =>
          !!v || (currentLang === 'CN' ? '不能为空' : 'Cannot be empty'),
      },
      {
        key: 'HARVEST_TOKEN',
        message: MSG[currentLang].HARVEST_TOKEN,
        validate: (v) =>
          !!v || (currentLang === 'CN' ? '不能为空' : 'Cannot be empty'),
      },
      {
        key: 'USER_AGENT',
        message: MSG[currentLang].USER_AGENT,
        validate: (v) =>
          !!v || (currentLang === 'CN' ? '不能为空' : 'Cannot be empty'),
      },
      {
        key: 'PROJECT_MAP',
        message: MSG[currentLang].PROJECT_MAP,
        validate: (v) => {
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

module.exports = {
  ensureUserEnvFileInteractive,
};
