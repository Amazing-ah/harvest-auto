/**
 * 支持灵活的标签化日志解析，兼容全局声明与行内明细自定义，优先级：行内大于全局。
 *
 * 日志写法举例：
 *
 * 2025-06-30
 * [project:Web]     # 声明全局 project
 * [task:Android]    # 声明全局 task
 * [project:SC][task:Web] Cooperated with...
 * [task:Notify] Changed the data...
 * [project:Notify] Solved login chat...
 * 只写内容，不加标签
 *
 * 解析为：
 * 1. [project:SC][task:Web]    => project:SC,    task:Web
 * 2. [task:Notify]             => project:Web,   task:Notify
 * 3. [project:Notify]          => project:Notify,task:Android
 * 4. 无标签                     => project:Web,   task:Android
 */

function parseMarkdownToDailyReports(mdContent) {
  const lines = mdContent.split('\n');

  let curDate = null;
  let globalProject = null;
  let globalTask = null;
  let records = [];
  let allReports = [];

  // 匹配 [project:xxx] 标签
  const projectTagReg = /\[project:([^[\]]+)\]/i;
  // 匹配 [task:xxx] 标签
  const taskTagReg = /\[task:([^[\]]+)\]/i;
  // 匹配有效日期行，如 2025-06-30 或 2025-06-30 ...（支持兼容性，可只需开头有日期）
  const dateLineReg = /^(\d{4}-\d{2}-\d{2})/;

  function pushCurDay() {
    if (curDate && records.length > 0) {
      allReports.push({ date: curDate, items: records });
      records = [];
    }
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return; // 跳过空行

    // 日期切换。检测「202x-xx-xx」
    const dateMatch = line.match(dateLineReg);
    if (dateMatch) {
      pushCurDay();
      curDate = dateMatch[1];
      globalProject = null;
      globalTask = null;
      return;
    }

    // 全局标签行（只写标签且无正文内容）
    // 如 [project:Web]、或 [task:Android]、或两者组合
    if (
      // 行中标签替换后全为空
      line.replace(projectTagReg, '').replace(taskTagReg, '').trim() === '' &&
      (projectTagReg.test(line) || taskTagReg.test(line))
    ) {
      const proj = (line.match(projectTagReg) || [])[1];
      const task = (line.match(taskTagReg) || [])[1];
      if (typeof proj === 'string') globalProject = proj.trim();
      if (typeof task === 'string') globalTask = task.trim();
      return;
    }

    // 行内明细标签
    const itemProject = (line.match(projectTagReg) || [])[1] || null;
    const itemTask = (line.match(taskTagReg) || [])[1] || null;
    // notes 去掉所有标签后的剩余内容
    const notes = line
      .replace(projectTagReg, '')
      .replace(taskTagReg, '')
      .trim();

    // 实际取值：若行有则优先用行，否则 fallback 全局
    const project =
      itemProject !== null && typeof itemProject !== 'undefined'
        ? itemProject.trim()
        : globalProject || '';
    const task =
      itemTask !== null && typeof itemTask !== 'undefined'
        ? itemTask.trim()
        : globalTask || '';

    // 若没有日期，报错提示
    if (!curDate) throw new Error(`未检测到有效日期行，明细：'${line}'`);

    // 校验必填
    if (!project) {
      throw new Error(
        `[格式错误][${curDate}] 明细 '${line}'：缺少项目(project)，请补充 [project:XXX] 标签或先声明全局项目`
      );
    }
    if (!task) {
      throw new Error(
        `[格式错误][${curDate}] 明细 '${line}'：缺少任务(task)，请补充 [task:XXX] 标签或先声明全局任务`
      );
    }

    // notes 可允许为空，但一般实际日志应有内容
    records.push({
      project,
      task,
      notes,
    });
  });

  pushCurDay();
  return allReports;
}

module.exports = { parseMarkdownToDailyReports };
