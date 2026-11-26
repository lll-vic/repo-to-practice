const topics = [
  [/(?:视频.{0,8}生成|生成.{0,8}视频|文生视频|图生视频|video[\s-]+generat|generat\w*[\s-]+videos?|(?:text|image).to.video)/i, 'video generation'],
  [/文生视频|文字生成视频|\btext.to.video\b/i, 'text to video'],
  [/\brag\b|检索增强|知识库问答|retrieval.augmented/i, 'rag'],
  [/摘要|总结准确|summari[sz]|summaries/i, 'text summarization'],
  [/评测|幻觉|模型评估|llm evaluation|\bevals?\b|hallucination/i, 'llm evaluation'],
  [/智能体|多智能体|\b(?:ai agents?|agentic|multi-agent)\b/i, 'ai agent'],
  [/推荐系统|recommendation system|recommender/i, 'recommender system'],
  [/用户行为|数据埋点|产品分析|漏斗|留存|转化率|product analytics|user analytics/i, 'product analytics'],
  [/用户流程|用户体验|用户研究|产品拆解|产品取舍|user flow|user research|product trade-offs|\bux\b/i, 'usability testing'],
  [/需求分析|需求管理|需求文档|requirements analysis|requirements engineering/i, 'requirements engineering'],
  [/数据可视化|可视化仪表盘|data visuali[sz]ation|analytics dashboard/i, 'data visualization'],
  [/自动化测试|回归测试|单元测试|端到端测试|regression test|unit test|end-to-end test/i, 'automated testing'],
  [/数据流|调用链|可观测性|分布式链路|trace the data flow|distributed tracing|observability/i, 'distributed tracing'],
  [/性能瓶颈|性能分析|压测|performance|profiling|benchmark/i, 'performance profiling'],
  [/数据分析|data analy(?:sis|tics)/i, 'data analysis'],
  [/数据清洗|\bdata clean(?:ing)?\b/i, 'data cleaning'],
  [/数据工程|数据管道|\betl\b|data pipelines?/i, 'data pipeline'],
  [/全栈|full.stack/i, 'full stack'],
  [/响应式|responsive design/i, 'responsive design'],
  [/无障碍|accessibility|\ba11y\b/i, 'accessibility'],
  [/爬虫|网页抓取|web scraping/i, 'web scraping'],
  [/浏览器自动化|browser automation/i, 'browser automation'],
  [/微服务|microservices/i, 'microservices'],
  [/设计系统|组件库|design system|component library/i, 'design system'],
  [/即时通讯|实时聊天|real.time chat/i, 'real time chat'],
  [/工作流|workflow automation/i, 'workflow automation'],
  [/自然语言处理|\bnlp\b/i, 'natural language processing'],
  [/机器学习|machine learning/i, 'machine learning'],
  [/深度学习|deep learning/i, 'deep learning'],
  [/计算机视觉|computer vision/i, 'computer vision'],
  [/金融建模|financial modeling/i, 'financial modeling'],
  [/量化|quantitative finance/i, 'quantitative finance'],
  [/反欺诈|fraud detection/i, 'fraud detection'],
  [/a\/b\s*(?:test|测试)|ab\s*(?:test|测试)/i, 'ab testing'],
  [/提示词|prompt engineering/i, 'prompt engineering'],
  [/语音识别|speech recognition/i, 'speech recognition'],
  [/知识图谱|knowledge graph/i, 'knowledge graph'],
  [/强化学习|reinforcement learning/i, 'reinforcement learning'],
  [/时间序列|time series/i, 'time series']
];

const tools = /(?<![\w.])(?:Next\.js|Node\.js|Vue\.js|C\+\+|C#|React|Vue|Angular|Svelte|TypeScript|JavaScript|Python|NumPy|pandas|Streamlit|SQL|PostgreSQL|Postgres|MongoDB|Redis|DuckDB|ClickHouse|dbt|Airflow|Spark|Kafka|Power BI|Tableau|Figma|Playwright|Cypress|Jest|pytest|Docker|Kubernetes|Terraform|AWS|Azure|FastAPI|Flask|Django|Express|GraphQL|Ruby|Rails|Golang|Rust|Java|OpenTelemetry|Prometheus|Grafana|PyTorch|TensorFlow|LangChain|LangGraph|OpenAI|Hugging Face|HuggingFace|vLLM|Unity|Unreal|Flutter|Swift|Kotlin|WebAssembly|WordPress|Elasticsearch)(?![\w.])/gi;

const englishNoise = new Set((
  'want need learn learning practice practicing build building familiar familiarity looking skills skill technical ' +
  'requirements requirement required preferred qualifications qualification experience experienced with using ability able ' +
  'strong excellent proficiency proficient team teams candidate responsibilities responsibility years years of in for and ' +
  'the from into work working hands on must good knowledge including use improve have should role job recruit develop ' +
  'design implementation implement manage management maintain create provide product products project projects software ' +
  'system systems solid well based collaborate can junior senior engineer engineering developer one how what write ' +
  'tools tool know more understand understanding working understanding testing evaluation analysis development'
).split(' '));
const chineseNoise = new Set((
  '熟悉 掌握 负责 需要 希望 想练 想要 学习 能力 技能 要求 经验 优先 具备 使用 开发 设计 相关 以上 ' +
  '岗位 职位 工作 参与 完成 一次 项目 实战 招聘 理解 进行 了解 优化 验证 评估 一个 拆解 实现 个人'
).split(' '));
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

function unique(terms) {
  return [...new Set(terms)];
}

export function searchTerms(goal) {
  const clean = goal.replace(/\b(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, ' ');
  const namedTools = unique([...clean.matchAll(tools)].map(([word]) => word.replace(/\./g, '').toLowerCase()));
  const themes = topics.filter(([pattern]) => pattern.test(clean)).map(([, term]) => term);
  if (themes.includes('video generation')) {
    if (/评测|评估|评判|评价|质量|打分|评分|eval|scor|quality|compar|benchmark/i.test(clean)) {
      return ['video generation evaluation', 'video generation'];
    }
    return unique(['video generation', ...(themes.includes('text to video') ? ['text to video'] : [])]);
  }
  if (themes.length && namedTools.length) {
    const theme = themes[0];
    return [theme + ' ' + namedTools[0], theme];
  }
  if (themes.length) return themes.slice(0, 2);
  if (namedTools.length) return namedTools.slice(0, 2);

  const fallback = [];
  for (const { segment, isWordLike } of segmenter.segment(clean)) {
    if (!isWordLike) continue;
    const word = segment.toLowerCase();
    if (/^[a-z][a-z\d]{2,24}$/.test(word) && !englishNoise.has(word) ||
      /^[\p{Script=Han}]{2,12}$/u.test(word) && !chineseNoise.has(word)) {
      fallback.push(word);
    }
  }
  return unique(fallback).slice(0, 2);
}

export function repositoryQuery(term) {
  return term + ' in:name,description,topics archived:false stars:>=5';
}

export function githubSearchUrl(term) {
  return 'https://github.com/search?' + new URLSearchParams({ q: repositoryQuery(term), type: 'repositories' });
}
