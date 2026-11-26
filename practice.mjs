import { searchTerms } from './discovery.mjs';
import { translated } from './i18n.mjs';
import { englishRecipes, evaluationRecipe, videoEvaluationRecipe } from './practice.en.mjs';

const tracks = [
  {
    id: 'ai',
    name: 'AI 评测',
    cues: /评测|幻觉|摘要|模型评估|summari[sz]|summaries|llm eval|ai eval|hallucination|\bevals?\b/i,
    keywords: /evaluat|accuracy|summari|abstract|prompt|dataset|example|benchmark|模型|摘要|评测/i,
    files: /eval|benchmark|dataset|test|example/i,
    title: '给一个输出做小样本评测',
    steps: [
      '从选中的材料里找一个能核对输入和输出的场景。如果这个项目没有生成能力，就用摘录作为输入，自行准备几条待核对的输出。',
      '准备 5 条样本，至少覆盖一个信息不足或容易误解的例子。逐条标记“有原文支持”“与原文冲突”或“无从核实”。',
      '按相同标准比较两种输出方式，记录最难判断的样本和你的处理依据。'
    ],
    checks: ['提交一张至少含 5 条样本的对照表，每条有原文链接或摘录。', '给出两种方案的结果，并说明一个样本局限。'],
    question: '哪条输出最难判断？如果把它标成另一个类别，比较结果会变吗？'
  },
  {
    id: 'product',
    name: '产品拆解',
    cues: /产品|用户|需求|体验|转化|留存|价值|竞品|交互|设计|\bux\b|product/i,
    keywords: /quickstart|quick start|getting started|usage|features|demo|example|overview|使用|功能|入门/i,
    files: /^(docs?|demos?|examples?|app|screenshots?)(\/|$)/i,
    title: '走完一条核心使用流程',
    steps: [
      '根据选中的阅读起点写出一个明确的用户及其任务，再按 README 里的最短路径尝试完成。如果只能阅读文档，标记这次是文档走查。',
      '记录入口、关键决定和完成信号。找出一个会让新用户犹豫或失败的步骤。',
      '为该步骤提出一个改动，画出改前和改后的流程，并给出一种验证办法。'
    ],
    checks: ['交付一张带来源的流程图或三至五步的走查记录。', '明确一个有观察依据的问题、一个改动方案和一项可观察的验证指标。'],
    question: '你为什么优先处理这个步骤？怎样判断改动是降低了失败率，还是只减少了点击次数？'
  },
  {
    id: 'testing',
    name: '测试与调试',
    cues: /测试|回归|调试|故障|边界|缺陷|unit test|debug|regression/i,
    keywords: /test|contribut|install|setup|usage|validation|error|example|测试|配置/i,
    files: /^(tests?|specs?|fixtures?|examples?|src|lib)(\/|$)|pytest|vitest/i,
    title: '为一条可运行的行为补回归测试',
    steps: [
      '从来源中选一个有明确输入输出的行为，先跑通最小调用并记录命令与环境。',
      '挑一个边界输入，写下预期行为及依据，再构造可复现的测试。',
      '在本地故意破坏对应行为，确认测试会失败，再恢复代码重跑。'
    ],
    checks: ['留下测试文件或脚本，以及失败和恢复后的运行记录。', '指出测试覆盖了哪个行为，以及还有哪个边界未覆盖。'],
    question: '如果实现改了而外部行为没变，你的测试还会通过吗？怎么确认？'
  },
  {
    id: 'architecture',
    name: '架构理解',
    cues: /架构|模块|数据流|请求|调用链|接口|状态|architecture|api|data flow/i,
    keywords: /architect|structure|design|overview|usage|quickstart|install|example|api|架构|接口/i,
    files: /^(src|lib|app|packages|server|core|examples?|docs?)(\/|$)/i,
    title: '追踪一次完整调用路径',
    steps: [
      '从引用的文档或目录挑一个可描述的输入，定位入口文件和触发方式。',
      '顺着一个成功场景追到结果，记录每次数据交接。能运行时用日志确认，阅读推断要单独标记。',
      '画出调用路径，标注一个失败分支和它对调用方的影响。'
    ],
    checks: ['保留入口和至少一个后续处理位置的文件链接。', '交付一张能区分运行观察与代码推断的调用图或调用记录。'],
    question: '如果中间依赖超时，调用方会看到什么？你的证据来自哪里？'
  },
  {
    id: 'performance',
    name: '性能分析',
    cues: /性能|瓶颈|延迟|吞吐|耗时|压测|performance|latency|benchmark/i,
    keywords: /benchmark|performance|profil|speed|usage|example|install|性能|速度/i,
    files: /bench|perf|examples?|fixtures?/i,
    title: '测量一个可以复跑的性能指标',
    steps: [
      '选一个单独可运行的步骤，固定环境和输入，明确要记录耗时还是吞吐量。',
      '记录运行命令和样本规模，对基线和一个变化条件各跑至少 5 次。',
      '比较中位数和波动，写下一个可能影响结果的因素。'
    ],
    checks: ['交付原始测量记录和可复跑的命令。', '给出两组中位数，说明你是否有足够证据支持所声称的变化。'],
    question: '如果数据量增大十倍，你的测量方法和结论分别会怎么变？'
  }
];

const general = {
  id: 'general',
  name: '自定义目标',
  keywords: /quickstart|getting started|usage|example|install|overview|使用|入门/i,
  files: /^(examples?|docs?|src|tests?)(\/|$)/i,
  title: '验证项目里的一个最小场景',
  steps: [
    '用目标能力写出一个可观察的结果，再从引用的材料里找一个能产出该结果的最小案例。',
    '把操作和预期写下来，记录至少一次执行或走查的实际结果。',
    '改变一个输入或假设，再跑一次，说明哪个结果支持了你的判断。'
  ],
  checks: ['交付一份其他人可以按步骤复查的记录，附至少一个来源。', '说明实际结果、一个限制和你下一步想验证的问题。'],
  question: '你怎么判断这次观察能说明问题？换一个输入时，哪些结论可能失效？'
};

const videoPractice = {
  id: 'video',
  keywords: /video|prompt|generation|evaluation|benchmark|视频|评测|生成/i,
  files: /video|eval|benchmark|test|example/i,
  name: '视频生成评测',
  title: '用同一段 Prompt 对比两段视频',
  steps: [
    '使用内置的两段样片和配套 Prompt，或用同一段 Prompt 自己生成两段视频，记录两边的设置差异。',
    '观看两段视频，按 Prompt 遵循度、运动连贯性、画面一致性和瑕疵控制四项打分，回放核对画面和时间戳。',
    '对比总分和单项分，用画面证据解释最明显的差异，再写下这次测试的局限。',
    '核对评测报告，将它填入实战记录。'
  ],
  checks: [
    '两段视频都有可识别的来源，并保留共用 Prompt 和对照条件。',
    '两段视频各有四项评分和带时间戳的观察，低分或有分差的项目有画面依据。',
    '给出两个 20 分制总分，用证据解释最关键的差异，并写明一个测试局限。'
  ],
  question: '哪个时间戳最能支持你的判断？换一个场景时，你会怎么验证结论是否还成立？',
  training: {
    id: 'video',
    title: '视频生成评测带教',
    steps: [
      { title: '确定对照条件', instruction: '先选素材。内置样片已有共用 Prompt 和固定设置。用自己的素材时，把同一段 Prompt 原样输入两个生成工具，尽量统一时长、比例和分辨率。', output: '两段可对比的视频，以及同一段 Prompt 和设置差异。' },
      { title: '观看并逐项评分', instruction: '先看评分标准，再把 A、B 各看一遍。对照 Prompt 分别给四项打分。可以拖动进度条回放，把观察记到对应的时间点。', output: '八个分数和带时间戳的画面观察。' },
      { title: '解释分差', instruction: '页面会加总四项分数。用最能解释差异的一条画面证据写出结论，并说明这次对比还不能回答什么。', output: '一条有证据的结论和一条测试局限。' },
      { title: '核对评测报告', instruction: '检查别人能否用这份报告找到两段视频、还原对照条件，并看懂你的评分依据。', output: '一份可填入实战记录的评测报告。' }
    ],
    rubric: [
      { id: 'instruction', help: '主体、动作、场景和运镜有没有按 Prompt 出现？' },
      { id: 'motion', help: '动作是否连续？留意突然跳位、变速等问题。' },
      { id: 'coherence', help: '主体的形状、颜色和周围场景在前后帧是否一致？' },
      { id: 'artifacts', help: '有没有闪烁、多余物体或其他渲染瑕疵？瑕疵越少，分数越高。' }
    ]
  }
};

const customEvaluation = {
  id: 'evaluation',
  cues: /评测|评估|benchmark|evaluation|eval|准确/i,
  name: '任务专项评测',
  keywords: /benchmark|eval|quality|质量|评测|评估|对比|比较/i,
  files: /eval|benchmark|dataset|test|example/i,
  title: '按固定标准完成一次对比评测',
  steps: [
    '从目标中确定一个可以观察的质量维度，写成一句可判断的标准。',
    '选同一组输入，分别记录两个方案的输出，并为每个结果保留原文或画面证据。',
    '逐项按相同标准评分，汇总差异，再写下一个可能改变结论的局限。'
  ],
  checks: [
    '保留测试输入和两个方案的实际输出。',
    '每个分数都有可以复查的证据。',
    '报告对比结果，并说明一项影响结论的局限。'
  ],
  question: '如果另一位评测者独立打分，最可能在哪个标准上和你意见不同？',
  training: {
    id: 'evaluation',
    title: '逐步完成一次任务专项评测',
    intro: '把你写下的能力转成一个可复查的小型评测。先固定输入和标准，再记录每个实际结果。',
    steps: [
      { title: '把目标变成观察标准', instruction: '从目标描述里圈出要评估的一个结果。写清楚什么现象算达标，什么现象算失败。', example: '不要只写“质量好”。改写成一条观察者可以独立判断的标准。', output: '一句包含可观察现象的判断标准。' },
      { title: '准备一组可复用输入', instruction: '用同一组输入测试两个方案。留一个常规样例和一个最容易出错或产生歧义的样例。', example: '记录输入文本、参数和生成日期，下一次对比时原样复跑。', output: '至少两个带编号的输入样例。' },
      { title: '记录实际输出与证据', instruction: '保留两个方案的原始输出。逐条对照标准标记证据和出处。暂时不要先选赢家。', example: '事实判断附原文行号，媒体评测附片段和时间戳。', output: '每个输入都有 A、B 结果和一条证据。' },
      { title: '独立评分并比较', instruction: '先按预先写好的标准给 A、B 打分，再汇总总分和最大的单项差异。', example: '任何一项如果无法从材料里核实，标成“无证据”，不要猜分。', output: '一张显示各项分数和总分的比较表。' },
      { title: '写结论与局限', instruction: '用最强的一条证据解释结果。然后写明一个本次小测试无法回答的问题。', example: '另一个输入、随机种子或人工评分差异可能改变结论。', output: '一句结果、一条证据、一项下一步检查。' }
    ]
  }
};

const demoChinese = [
    '# Note Summarizer',
    '',
    '这个演示把会议笔记压缩成三条要点。',
    '## Usage',
    '输入一段会议笔记，输出决定、负责人和截止日期。',
    '原文没写明截止日期时，输出“待确认”。',
    '## Evaluation',
    '每条要点都应能找到对应的原文依据。',
    '示例：原文说“下周再讨论”，摘要不可以写成“下周交付”。',
    '例外情况：原文记录了两个候选日期，摘要应保留不确定性。'
].join('\n');

const demoEnglish = [
  '# Note Summarizer',
  '',
  'This demo compresses meeting notes into three bullet points.',
  '## Usage',
  'Enter a meeting note to extract decisions, owners, and due dates.',
  'If the note leaves the due date open, the output should say “to be confirmed.”',
  '## Evaluation',
  'Every bullet point must be supported by the original note.',
  'Example: “Discuss again next week” does not mean “Deliver next week.”',
  'If the note lists two possible dates, preserve that uncertainty.'
].join('\n');

export function demoMaterials(language) {
  return {
    goal: translated(language, 'aiGoal'),
    repo: {
      slug: translated(language, 'demoRepository'),
      kind: 'demoSource',
      readmePath: translated(language, 'demoReadme'),
      readmeText: language === 'en' ? demoEnglish : demoChinese,
      entries: [],
      note: 'demoNote'
    }
  };
}

function extractSections(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let section = { title: '', lines: [] };
  let fence = '';
  lines.forEach((line, index) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = '';
      return;
    }
    if (fence) return;
    const heading = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      if (section.lines.length) sections.push(section);
      section = { title: heading[1], lines: [] };
    } else {
      section.lines.push({ value: line.trim(), number: index + 1 });
    }
  });
  if (section.lines.length) sections.push(section);
  return sections;
}

function usefulLine({ value }) {
  return value.length >= 10 && value.length <= 480
    && !/^(?:[![]|<|---|\|)/.test(value) && /[\p{L}\p{N}]/u.test(value);
}

function termsFor(goal) {
  return [...new Set((goal.match(/[A-Za-z][\w-]{2,}|[\u4e00-\u9fff]{2,}/g) ?? [])
    .map((term) => term.toLowerCase())
    .filter((term) => !['and', 'the', 'for', 'with'].includes(term)))];
}

function countTerms(value, terms) {
  const lower = value.toLowerCase();
  return terms.filter((term) => lower.includes(term)).length;
}

function selectReadme(repo, track, terms, t) {
  const readmePath = repo.readmePath || t('manualReadme');
  if (!repo.readmeText) return null;
  const sections = extractSections(repo.readmeText);
  const ranked = sections.map(({ title, lines }) => {
    const usable = lines.filter(usefulLine);
    const text = usable.slice(0, 30).map(({ value }) => value).join(' ');
    const score = countTerms(title, terms) * 6 + countTerms(text, terms) * 3
      + (track.keywords.test(title) ? 5 : 0) + (track.keywords.test(text) ? 2 : 0);
    return { title, usable, score };
  }).filter(({ usable }) => usable.length).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) {
    return {
      title: readmePath,
      url: repo.readmeUrl,
      kind: 'README',
      detail: t('noExcerpt')
    };
  }

  const { usable, title } = best;
  const relevantIndex = usable.findIndex(({ value }) => countTerms(value, terms) > 0 || track.keywords.test(value));
  const startIndex = Math.max(0, relevantIndex);
  const first = usable[startIndex];
  const next = usable[startIndex + 1];
  const last = next?.number === first.number + 1 && first.value.length + next.value.length < 380 ? next : first;
  const range = first === last ? 'L' + first.number : 'L' + first.number + '-L' + last.number;
  return {
    title: title ? readmePath + ' · ' + title.slice(0, 110) : readmePath,
    url: repo.readmeUrl ? repo.readmeUrl + (/\.(?:md|markdown|mdown)$/i.test(repo.readmePath) ? '?plain=1' : '') + '#' + range : '',
    kind: t('readmeExcerpt'),
    detail: t(first === last ? 'sourceLine' : 'sourceRange', { start: first.number, end: last.number }),
    quote: first === last ? first.value : first.value + '\n' + last.value
  };
}

function selectEntry(entries, track, terms, readmePath) {
  return entries.filter(({ path }) => path !== readmePath && !path.startsWith('.'))
    .map((entry) => ({
      entry,
      score: countTerms(entry.path, terms) * 3 + (track.files.test(entry.path) ? 2 : 0)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path))[0]?.entry;
}

export function isVideoGoal(goal) {
  return /(?:视频.{0,10}生成|生成.{0,10}视频|文生视频|图生视频|video[\s-]+generat|generat\w*[\s-]+(?:videos?|clips?)|(?:text|image)[\s-]+to[\s-]+video)/i.test(goal)
    && /评测|评估|评价|质量|打分|评分|benchmark|quality|eval|scor|compar/i.test(goal);
}

export function videoPracticeMaterials() {
  return { kind: 'videoSource', entries: [] };
}

export function makeCard(repo, goal, locale = 'zh') {
  const t = (key, values) => translated(locale, key, values);
  const track = isVideoGoal(goal)
    ? videoPractice
    : tracks.find(({ cues }) => cues.test(goal) && cues !== tracks[0].cues)
      ?? (/(?:摘要|summari[sz]|summaries|幻觉|hallucination)/i.test(goal) ? tracks[0]
        : customEvaluation.cues.test(goal) || tracks[0].cues.test(goal) ? customEvaluation : general);
  const baseRecipe = locale === 'en'
    ? track.id === 'video' ? videoEvaluationRecipe
      : track.id === 'evaluation' ? evaluationRecipe
        : englishRecipes[track.id] ?? track
    : track;
  const goalExcerpt = excerpt(goal, 90);
  const recipe = track.id === 'general'
    ? {
        ...baseRecipe,
        title: locale === 'en' ? `Turn “${excerpt(goal, 48)}” into a small exercise` : `把「${excerpt(goal, 38)}」做成一次小练习`,
        steps: locale === 'en' ? [
          `Turn “${goalExcerpt}” into one observable result. Write down the input and what would count as success.`,
          'Use a relevant source from this project and work through one ordinary case and one edge case. Save what actually happened.',
          'Repeat with one changed input. Compare the two outcomes and name the evidence that supports your conclusion.'
        ] : [
          `把「${goalExcerpt}」改写成一个可以观察的结果，写下输入和达标条件。`,
          '按已引用的项目材料做一个常规案例和一个边界案例，记录实际结果。',
          '改变一个输入再做一次，对比结果，并指出支持你结论的证据。'
        ],
        checks: locale === 'en' ? [
          `The notes state how “${goalExcerpt}” was tested and what inputs were used.`,
          'Keep two outcomes and evidence that another person can check.',
          'Explain the difference, conclusion, and one limitation.'
        ] : [
          `记录你如何验证「${goalExcerpt}」以及使用的具体输入。`,
          '保留两个案例的结果，并附上他人可以核对的证据。',
          '解释差异、结论和一项测试局限。'
        ],
        training: {
          id: 'general',
          title: locale === 'en' ? `Guided practice: ${excerpt(goal, 55)}` : `带教练习：${excerpt(goal, 45)}`,
          intro: locale === 'en'
            ? `This lesson is built around your goal: “${goalExcerpt}.” Follow the steps and keep the result tied to the source.`
            : `这份练习围绕你的目标「${goalExcerpt}」设计。按步骤动手，并把结果和引用来源对应起来。`,
          steps: (locale === 'en' ? [
            [`Define success for this goal`, `Write the exact input and one observable condition for “${goalExcerpt}.”`, 'The input can be repeated, and another person can recognize success.', 'One input and a concrete success condition.'],
            ['Run the baseline case', 'Use the selected source to follow a normal case. Record the commands or actions and the actual result.', 'Separate what you observed from what you inferred.', 'A short run log linked to the project source.'],
            ['Probe an edge case', 'Change one input or condition that is relevant to your goal, then repeat the same workflow.', 'Change one factor at a time so the result is interpretable.', 'A second case with the changed input recorded.'],
            ['Compare the evidence', 'Put the two outcomes side by side and check them against your success condition.', 'If the source does not support a claim, mark it as unknown instead of filling in a guess.', 'Two outcomes with a checkable source or observation.'],
            ['Write a short conclusion', 'Say what the evidence shows about your goal, what it does not show, and what you would test next.', 'A useful conclusion describes a limitation rather than overstating the result.', 'One evidence-backed finding and one next question.']
          ] : [
            ['先定义目标是否达成', `为「${goalExcerpt}」写下一个可重复的输入和一个具体的成功信号。`, '他人可以用这个信号判断练习结果是否达标。', '一条具体输入和成功条件。'],
            ['完成基准案例', '依据卡片引用的项目资料走完一个常规案例，记下操作和实际结果。', '区分亲自观察到的结果与根据资料作出的推断。', '一份带项目来源的操作记录。'],
            ['检查一个边界案例', '改变一个和目标有关的输入或条件，按同样流程再做一次。', '一次只改变一个因素，便于解释结果差异。', '记录第二个案例及其输入变化。'],
            ['核对两次结果', '并排比较两个结果，再按最初的成功条件逐项核对。', '来源无法支持的说法标为“未知”，不要补猜测。', '两次结果及可核对的来源或观察。'],
            ['写出有依据的结论', '说明证据对目标说明了什么、还不能说明什么，以及下一步要检查的内容。', '结论里写出局限，避免把一次小测试说成普遍规律。', '一条带证据的发现和一个下一步问题。']
          ]).map(([title, instruction, example, output]) => ({ title, instruction, example, output }))
        }
      }
    : baseRecipe;
  const extracted = searchTerms(goal).flatMap((term) => [term, ...term.split(' ')]);
  const terms = [...new Set([...extracted, ...termsFor(goal)])];
  const sources = [];
  const readme = selectReadme(repo, track, terms, t);
  if (readme) sources.push(readme);
  const entry = selectEntry(repo.entries, track, terms, repo.readmePath);
  if (entry) {
    sources.push({
      title: entry.path,
      url: entry.url,
      kind: entry.type === 'dir' ? 'Directory' : 'File',
      detail: t('pathOnly')
    });
  }
  if (repo.commit) {
    sources.push({
      title: t('openCommit'),
      url: repo.url + '/tree/' + repo.commit,
      kind: 'Commit',
      detail: repo.commit.slice(0, 10)
    });
  } else if (repo.url) {
    sources.push({ title: t('openRepository'), url: repo.url, kind: 'Repository', detail: t('suppliedUrl') });
  }
  const sourceForPractice = sources.find(({ quote }) => quote) ?? sources[0];
  const sourceTitle = sourceForPractice?.title ?? repo.slug ?? t('videoSource');
  const sourceQuote = sourceForPractice?.quote ?? '';
  const sourceStep = {
    title: t('sourceStepTitle'),
    instruction: t('sourceStepInstruction', { source: sourceTitle, goal: excerpt(goal, 70) }),
    example: sourceQuote ? excerpt(sourceQuote, 240) : t('sourceStepFallback', { repo: repo.slug }),
    output: t('sourceStepOutput', { source: sourceTitle })
  };
  const baseTraining = recipe.training ?? {
    id: track.id,
    title: recipe.title,
    intro: locale === 'en'
      ? 'Follow this focused exercise using the linked source. Keep the inputs, observations, and evidence together so you can repeat it.'
      : '按这份专项练习使用来源里的材料。把输入、观察和证据放在一起，确保别人可以复查。',
    steps: recipe.steps.map((instruction, index) => ({
      title: (locale === 'en' ? ['Set up the exercise', 'Do the work', 'Check the result'][index] : ['准备练习', '动手完成', '检查结果'][index]) ?? (locale === 'en' ? 'Next step' : '下一步'),
      instruction,
      example: repo.description || goal,
      output: recipe.checks[index] ?? recipe.checks.at(-1)
    }))
  };
  const isVideo = track.id === 'video';
  const referenceCheck = sourceForPractice && !isVideo
    ? [t('sourceCheck', { source: sourceTitle })] : [];
  const training = {
    ...baseTraining,
    source: sourceForPractice,
    steps: isVideo ? baseTraining.steps : [sourceStep, ...baseTraining.steps]
  };
  return {
    repo: repo.slug ?? t('videoSource'),
    repoUrl: repo.url ?? '',
    description: repo.description ?? '',
    language: repo.language ?? '',
    goal,
    recipe: recipe.name,
    kind: t(repo.kind),
    title: recipe.title,
    note: repo.note ? t(repo.note) : '',
    sources,
    steps: isVideo ? recipe.steps : [sourceStep.instruction, ...recipe.steps],
    checks: [...recipe.checks, ...referenceCheck],
    question: recipe.question,
    training,
    locale
  };
}

export function excerpt(value, maxLength) {
  const singleLine = value.replace(/\s+/g, ' ');
  return singleLine.length > maxLength ? singleLine.slice(0, maxLength) + '…' : singleLine;
}

export function interviewQuestions(card, notes, evidenceUrl) {
  const t = (key, values) => translated(card.locale, key, values);
  return [
    t('interviewGoal', { goal: excerpt(card.goal, 120), repo: card.repo }),
    t(evidenceUrl ? 'interviewWithLink' : 'interviewWithNotes', { excerpt: excerpt(notes, 72) }),
    card.question
  ];
}

export function toMarkdown(record) {
  const { card, notes, evidenceUrl, questions, createdAt } = record;
  const t = (key) => translated(card.locale, key);
  const numbered = (items) => items.map((item, i) => (i + 1) + '. ' + item);
  return [
    '# ' + card.title, '',
    '- Repository: ' + card.repo + (card.repoUrl ? ' (' + card.repoUrl + ')' : ''),
    '- ' + t('cardGoal') + ': ' + card.goal.replace(/\n/g, '\n  '),
    '- ' + t('exportSource') + ': ' + card.kind,
    '- ' + t('exportTime') + ': ' + createdAt,
    '', '## ' + t('exportReferences'), '',
    ...card.sources.flatMap((source) => [
      '- ' + source.title + ' · ' + source.kind + ' (' + source.detail + ')',
      ...(source.url ? ['  ' + source.url] : [])
    ]),
    ...(card.note ? ['', card.note] : []),
    '', '## ' + t('exportSteps'), '', ...numbered(card.steps),
    '', '## ' + t('criteria'), '', ...card.checks.map((check) => '- ' + check),
    '', '## ' + t('outcome'), '', notes,
    ...(evidenceUrl ? ['', t('evidenceLabel') + ': ' + evidenceUrl] : []),
    '', '## ' + t('interview'), '', ...numbered(questions), ''
  ].join('\n');
}
