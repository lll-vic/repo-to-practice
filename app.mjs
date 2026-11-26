import { githubSearchUrl, searchTerms } from './discovery.mjs';
import { GitHubError, manualRepo, parseRepo, popularRepositories, readRepo, recommendRepositories } from './github.mjs';
import { translated } from './i18n.mjs';
import { demoMaterials, excerpt, interviewQuestions, isVideoGoal, makeCard, toMarkdown, videoPracticeMaterials } from './practice.mjs';

const storageKey = 'repo-to-practice.records.v1';
const localeKey = 'repo-to-practice.language';
const $ = (selector) => document.querySelector(selector);
const repoInput = $('#repo');
const goalInput = $('#goal');
const generate = $('#generate');
const demo = $('#demo');
const manualOption = $('#manual-option');
const emptyState = $('#output-empty').cloneNode(true);
const messages = new WeakMap();
let locale = getLocale();
const t = (key, values) => translated(locale, key, values);
let records = loadRecords();
let view = null;
let busy = '';
let activeTraining;
const trainingDialog = $('#training-dialog');
const hotCacheKey = 'repo-to-practice.hot.';
const hotStates = new Map();
const hotMaxAge = 30 * 60 * 1000;
let hotRange = 'recent';
let fit = null;

function getLocale() {
  try {
    return localStorage.getItem(localeKey) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function webUrl(value) {
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return '';
  }
  return '';
}

function link(text, url) {
  const href = webUrl(url);
  if (!href) return element('strong', text);
  const a = element('a', text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function button(text, style, action) {
  const node = element('button', text, style);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function renderMessage(node) {
  const detail = messages.get(node);
  node.hidden = !detail;
  node.textContent = detail ? t(detail.key, detail.values) + (detail.suffix ? ' ' + t(detail.suffix) : '') : '';
  node.dataset.kind = detail?.kind ?? '';
}

function message(node, key, kind = '', values, suffix) {
  if (key) messages.set(node, { key, kind, values, suffix });
  else messages.delete(node);
  renderMessage(node);
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(data)) throw new Error('Invalid records format');
    return data.filter((item) => (
      typeof item?.id === 'string' && typeof item.notes === 'string'
      && Number.isFinite(Date.parse(item.createdAt))
      && item.card && Array.isArray(item.card.steps) && Array.isArray(item.card.checks)
      && Array.isArray(item.card.sources) && Array.isArray(item.questions)
    ));
  } catch {
    message($('#records-message'), 'loadFailed', 'error');
    return [];
  }
}

function persist(next) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    return false;
  }
  records = next;
  renderRecords();
  if (!fit || fit.basis === 'fitBasisHistory') fitFromRecords();
  else renderFit();
  return true;
}

function renderRoute() {
  const viewingRecords = location.hash === '#records';
  $('#workbench').hidden = viewingRecords;
  $('#records').hidden = !viewingRecords;
  for (const [selector, active] of [['#workbench-nav', !viewingRecords], ['#records-nav', viewingRecords]]) {
    if (active) $(selector).setAttribute('aria-current', 'page');
    else $(selector).removeAttribute('aria-current');
  }
}

function localize(root = document) {
  for (const [selector, attribute] of [['copy', 'textContent'], ['placeholder', 'placeholder'], ['aria', 'aria-label']]) {
    for (const node of root.querySelectorAll('[data-' + selector + ']')) {
      const copy = t(node.dataset[selector]);
      if (attribute === 'textContent') node.textContent = copy;
      else node.setAttribute(attribute, copy);
    }
  }
}

function setGoalChips() {
  for (const chip of document.querySelectorAll('[data-example]')) {
    const isExample = ['zh', 'en'].some((language) => translated(language, chip.dataset.example) === goalInput.value);
    chip.setAttribute('aria-pressed', String(isExample));
  }
}

function syncForm() {
  const hasRepo = Boolean(repoInput.value.trim());
  manualOption.hidden = !hasRepo;
  const directVideo = !hasRepo && isVideoGoal(goalInput.value);
  $('#search-hint').hidden = hasRepo || directVideo;
  $('#search-instead').hidden = !directVideo;
  $('#search-instead').disabled = Boolean(busy);
  const key = busy || (hasRepo || directVideo ? 'generate' : 'findRepos');
  $('#generate-label').textContent = t(key);
  generate.disabled = Boolean(busy);
  demo.disabled = Boolean(busy);
  $('#output').setAttribute('aria-busy', String(Boolean(busy)));
  for (const item of document.querySelectorAll('[data-pick-repo]')) item.disabled = Boolean(busy);
}

function section(title, className = '') {
  const block = element('section', '', 'card-block' + (className ? ' ' + className : ''));
  block.append(element('h4', title));
  return block;
}

function list(items, ordered = false) {
  const node = element(ordered ? 'ol' : 'ul');
  for (const item of items) node.append(element('li', item));
  return node;
}

function sourcesView(card) {
  const block = section(t('readSources'));
  if (card.note) block.append(element('p', card.note, 'hint'));
  const sources = element('div', '', 'source-list');
  for (const source of card.sources) {
    const sourceCard = element('div', '', 'source');
    sourceCard.append(link(source.title, source.url), element('small', source.kind + ' · ' + source.detail));
    if (source.quote) sourceCard.append(element('blockquote', source.quote));
    sources.append(sourceCard);
  }
  block.append(sources);
  return block;
}

function cardView(card, onTrain) {
  const node = element('div');
  const badges = element('div', '', 'badges');
  badges.append(element('span', card.recipe, 'badge'), element('span', card.kind, 'badge neutral'));
  if (card.language) badges.append(element('span', card.language, 'badge neutral'));

  const title = element('h3', card.title, 'card-title');
  title.tabIndex = -1;
  node.append(badges, title, element('p', card.repo, 'repo-name'));
  const goal = t('cardGoal') + ' · ' + excerpt(card.goal, 132);
  if (card.goal.length > 132 || card.goal.includes('\n')) {
    const fullGoal = element('details', '', 'card-goal');
    fullGoal.append(element('summary', goal), element('p', card.goal, 'notes'));
    node.append(fullGoal);
  } else {
    node.append(element('p', goal, 'card-goal'));
  }
  if (card.description) node.append(element('p', card.description, 'card-description'));

  const steps = section(t('steps'));
  steps.append(list(card.steps, true));
  const criteria = section(t('criteria'), 'acceptance');
  criteria.append(list(card.checks));
  if (onTrain) {
    const guide = element('div', '', 'training-launch');
    guide.append(button(t('guideButton'), 'primary', () => onTrain(card)));
    steps.append(guide);
  }
  if (card.sources.length || card.note) node.append(sourcesView(card));
  node.append(steps, criteria);
  return node;
}

function trainingField(name, label, options = {}) {
  const { type = 'text', value = '', placeholder = '', required = true, maxLength = 400 } = options;
  const control = element(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') control.type = type;
  else control.rows = 3;
  control.id = 'training-' + name;
  control.name = name;
  control.required = required;
  control.maxLength = maxLength;
  control.placeholder = placeholder;
  if (type !== 'file') control.value = value;
  return createField(t(label), control);
}

function pauseTrainingVideos() {
  for (const video of trainingDialog.querySelectorAll('video')) video.pause();
}

function openTraining(card) {
  const content = $('#training-content');
  if (activeTraining?.view === view && activeTraining.locale === locale) {
    trainingDialog.showModal();
    activeTraining.focus();
    return;
  }
  activeTraining?.dispose();
  const training = card.training;
  const form = element('form', '', 'training-form');
  form.addEventListener('submit', (event) => event.preventDefault());
  const report = element('pre', '', 'guide-summary');
  const panels = training.steps.map((step, index) => {
    const panel = element('section', '', 'training-step');
    const heading = element('h3', step.title);
    heading.tabIndex = -1;
    panel.append(heading, element('p', step.instruction));
    if (!index && training.id !== 'video' && training.source?.url) panel.append(link(training.source.title, training.source.url));
    if (step.example) panel.append(element('p', t('guideExample') + ' · ' + step.example, 'hint'));
    panel.append(element('p', t('guideOutput') + ' · ' + step.output, 'training-output'));
    return panel;
  });

  let dispose = () => {};
  let prepare = () => {};
  let makeReport;
  if (training.id === 'video') {
    ({ dispose, prepare, makeReport } = videoTraining(card, panels));
    panels.at(-1).append(report);
  } else {
    const responses = training.steps.map((step, index) => {
      const field = trainingField('step-' + index, 'guideResponse', { type: 'textarea', maxLength: 400 });
      panels[index].append(field);
      return field.querySelector('textarea');
    });
    makeReport = () => training.steps.map((step, index) => step.title + '\n' + responses[index].value.trim()).join('\n\n');
  }
  const progress = element('p', '', 'training-progress');
  const bar = element('progress');
  bar.max = panels.length;
  const actions = element('div', '', 'guide-actions');
  let index = 0;
  const previous = button(t('guidePrev'), 'secondary', () => show(index - 1));
  const next = button(t('guideNext'), 'primary', () => {
    for (const control of panels[index].querySelectorAll('input, textarea, select')) {
      if (control.disabled) continue;
      if (control.required && ['text', 'textarea'].includes(control.type)) control.value = control.value.trim();
      if (!control.reportValidity()) return;
    }
    if (index < panels.length - 1) {
      show(index + 1);
      return;
    }
    const notes = makeReport();
    const url = $('#evidence-link')?.value;
    trainingDialog.close();
    renderOutput({ draft: { notes, url } });
    $('#evidence-notes').focus();
  });
  actions.append(previous, next);
  const focus = () => panels[index].querySelector('h3').focus({ preventScroll: true });
  function show(step) {
    pauseTrainingVideos();
    index = step;
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    const label = t('guideProgress', { step: index + 1, total: panels.length });
    progress.textContent = label;
    bar.setAttribute('aria-label', label);
    bar.value = index + 1;
    previous.hidden = !index;
    next.textContent = t(index === panels.length - 1 ? 'guideUseReport' : 'guideNext');
    prepare(index);
    if (index === panels.length - 1 && training.id === 'video') report.textContent = makeReport();
    trainingDialog.scrollTop = 0;
    focus();
  }
  $('#training-title').textContent = training.title;
  content.replaceChildren(progress, bar);
  if (training.intro) content.append(element('p', training.intro, 'muted training-intro'));
  form.append(...panels, actions);
  content.append(form);
  activeTraining = { view, locale, dispose, focus };
  trainingDialog.showModal();
  show(0);
}

function videoTraining(card, panels) {
  const [setup, scoring, compare] = panels;
  const samples = ['paper-boat-a.mp4', 'paper-boat-b.mp4'].map((file) => './samples/' + file);
  const samplePrompt = t('videoSamplePrompt');
  const sampleSettings = t('videoSampleSettings');
  const mode = element('select');
  mode.id = 'training-mode';
  mode.append(...['videoPracticeSamples', 'videoPracticeOwn'].map((key, index) => {
    const option = element('option', t(key));
    option.value = index ? 'own' : 'samples';
    return option;
  }));
  const sampleInfo = element('div', '', 'video-sample-info');
  sampleInfo.append(element('p', t('videoSampleHint')), element('p', samplePrompt), element('p', sampleSettings, 'hint'));
  const ownSetup = element('div');
  const promptField = trainingField('prompt', 'videoPrompt', { type: 'textarea', value: samplePrompt, maxLength: 600 });
  const conditionsField = trainingField('conditions', 'videoConditions', { type: 'textarea', placeholder: t('videoConditionsExample') });
  ownSetup.append(promptField, conditionsField);
  const players = element('div', '', 'video-players');
  const clips = ['A', 'B'].map((letter, index) => {
    const fileField = trainingField('clip' + letter, 'videoFile' + letter, { type: 'file', required: false });
    const modelField = trainingField('model' + letter, 'videoTool' + letter);
    const file = fileField.querySelector('input');
    file.accept = 'video/*';
    modelField.querySelector('input').maxLength = 100;
    const identifierField = trainingField('reference' + letter, 'videoReference' + letter, { maxLength: 180 });
    const identifier = identifierField.querySelector('input');
    ownSetup.append(modelField, fileField, identifierField);
    const tile = element('div', '', 'video-tile');
    const video = element('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', t('videoScore' + letter));
    const external = element('p', t('videoExternal'), 'hint');
    external.hidden = true;
    tile.append(element('strong', t('videoScore' + letter)), video, external);
    players.append(tile);
    let localUrl = '';
    const update = () => {
      const url = mode.value === 'own' ? localUrl : samples[index];
      video.hidden = !url;
      external.hidden = Boolean(url);
      if (url) video.src = url;
      else video.removeAttribute('src');
      video.load();
    };
    const dispose = () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
      localUrl = '';
    };
    file.addEventListener('change', () => {
      dispose();
      if (file.files[0]) localUrl = URL.createObjectURL(file.files[0]);
      identifier.disabled = Boolean(localUrl);
      identifierField.hidden = Boolean(localUrl);
      update();
      resetScores();
    });
    return { file, identifier, model: modelField.querySelector('input'), update, dispose };
  });
  ownSetup.append(element('p', t('videoOwnHint'), 'hint'));
  setup.append(createField(t('videoMode'), mode), sampleInfo, ownSetup);
  const source = card.training.source;
  if (source) {
    setup.append(element('p', t('videoOptionalSource'), 'hint'), link(source.title, source.url));
    if (source.quote) setup.append(element('p', excerpt(source.quote, 240), 'hint'));
  }

  const prompt = promptField.querySelector('textarea');
  const conditions = conditionsField.querySelector('textarea');
  const promptPreview = element('p', '', 'video-sample-info');
  const rubric = element('div', '', 'video-rubric');
  const scoreRows = card.training.rubric.map(({ id, help }) => {
    const title = t({
      instruction: 'videoScorePrompt', motion: 'videoScoreMotion',
      coherence: 'videoScoreVisual', artifacts: 'videoScoreArtifacts'
    }[id]);
    const row = element('div', '', 'rubric-row');
    const columns = element('div', '', 'score-columns');
    const scores = ['A', 'B'].map((letter) => {
      const select = element('select');
      select.id = 'training-' + id + letter;
      select.required = true;
      select.setAttribute('aria-label', title + ' · ' + t('videoScore' + letter));
      const empty = element('option', '—');
      empty.value = '';
      select.append(empty);
      for (let score = 1; score <= 5; score += 1) select.append(element('option', String(score)));
      columns.append(createField(t('videoScore' + letter), select));
      return select;
    });
    const evidenceField = trainingField('evidence-' + id, 'videoCriterionEvidence', { required: false, maxLength: 150 });
    evidenceField.hidden = true;
    const evidence = evidenceField.querySelector('input');
    const update = () => {
      const [a, b] = scores.map(({ value }) => Number(value));
      const needsEvidence = Boolean(a && b && (a !== b || a <= 2 || b <= 2));
      evidenceField.hidden = !needsEvidence;
      evidence.disabled = !needsEvidence;
      evidence.required = needsEvidence;
    };
    for (const select of scores) select.addEventListener('change', update);
    row.append(element('strong', title), element('p', help), columns, evidenceField);
    rubric.append(row);
    update();
    return { title, scores, evidence, update };
  });
  const observationFields = ['A', 'B'].map((letter) => trainingField('observation' + letter, 'videoEvidence' + letter, {
    placeholder: t('videoTimestampExample'), maxLength: 200
  }));
  scoring.append(promptPreview, players, element('p', t('videoScoreScale'), 'hint'), rubric, ...observationFields);
  const observations = observationFields.map((field) => field.querySelector('input'));
  for (const { evidence } of scoreRows) evidence.pattern = '.*[0-9]{1,2}:[0-5][0-9].*';
  for (const input of observations) input.pattern = '.*[0-9]{1,2}:[0-5][0-9].*';
  const totals = element('div', '', 'guide-summary');
  const findingField = trainingField('finding', 'videoFinding', { type: 'textarea', maxLength: 400 });
  const limitationField = trainingField('limitation', 'videoLimitation', { type: 'textarea', maxLength: 400 });
  const finding = findingField.querySelector('textarea');
  const limitation = limitationField.querySelector('textarea');
  compare.append(totals, findingField, limitationField);
  const sampleFeedback = element('p', t('videoSampleReview'), 'training-output');
  panels.at(-1).append(sampleFeedback);

  function resetScores() {
    for (const { scores, evidence, update } of scoreRows) {
      for (const select of scores) select.value = '';
      evidence.value = '';
      update();
    }
    for (const input of [...observations, finding, limitation]) input.value = '';
  }
  function syncMode() {
    const own = mode.value === 'own';
    ownSetup.hidden = !own;
    sampleInfo.hidden = own;
    for (const field of ownSetup.querySelectorAll('input, textarea')) field.disabled = !own;
    for (const clip of clips) {
      clip.identifier.disabled = !own || Boolean(clip.file.files[0]);
      clip.update();
    }
    sampleFeedback.hidden = own;
    resetScores();
  }
  mode.addEventListener('change', syncMode);
  setup.addEventListener('change', (event) => {
    if (event.target.matches('textarea, input[type=text]')) resetScores();
  });
  syncMode();

  function summarize() {
    const values = scoreRows.map(({ title, scores, evidence }) => {
      const [a, b] = scores.map(({ value }) => Number(value));
      return { title, a, b, evidence: evidence.disabled ? '' : evidence.value.trim() };
    });
    const a = values.reduce((sum, row) => sum + row.a, 0);
    const b = values.reduce((sum, row) => sum + row.b, 0);
    const maxGap = Math.max(...values.map((row) => Math.abs(row.a - row.b)));
    const criteria = values.filter((row) => Math.abs(row.a - row.b) === maxGap).map(({ title }) => title);
    return {
      values,
      total: t('videoTotals', { a, b }),
      gap: maxGap ? t('videoGap', { criteria: criteria.join(t('videoJoin')), points: maxGap }) : t('videoNoGap')
    };
  }
  return {
    dispose: () => clips.forEach((clip) => clip.dispose()),
    prepare(index) {
      if (index === 1) promptPreview.textContent = t('videoPrompt') + ' · ' + (mode.value === 'own' ? prompt.value : samplePrompt);
      if (index === 2) {
        const { total, gap } = summarize();
        totals.replaceChildren(element('strong', total), element('p', gap));
      }
    },
    makeReport() {
      const usingSamples = mode.value === 'samples';
      const { values, total, gap } = summarize();
      return [
        t('videoReport'),
        t('videoMode') + ' · ' + t(usingSamples ? 'videoPracticeSamples' : 'videoPracticeOwn'),
        t('videoPrompt') + ' · ' + (usingSamples ? samplePrompt : prompt.value),
        t('videoConditions') + ' · ' + (usingSamples ? sampleSettings : conditions.value),
        ...clips.map(({ file, identifier, model }, index) => {
          const letter = index ? 'B' : 'A';
          const label = t('videoScore' + letter);
          const source = usingSamples ? samples[index] : [model.value, file.files[0]?.name ?? identifier.value].join(' · ');
          return label + ' · ' + source + '\n' + t('videoObservation') + ' · ' + observations[index].value;
        }),
        total,
        gap,
        ...values.map(({ title, a, b, evidence }) => title + ' · A ' + a + '/5 · B ' + b + '/5' + (evidence ? ' · ' + evidence : '')),
        t('videoFinding') + ' · ' + finding.value,
        t('videoLimitation') + ' · ' + limitation.value
      ].join('\n');
    }
  };
}

function createField(label, control) {
  const container = element('div', '', 'field');
  const labelNode = element('label', label);
  labelNode.htmlFor = control.id;
  container.append(labelNode, control);
  return container;
}

function evidenceForm(card, draft) {
  const form = element('form', '', 'evidence-form');
  const note = element('textarea');
  note.id = 'evidence-notes';
  note.rows = 4;
  note.maxLength = 4000;
  note.required = true;
  note.value = draft?.notes ?? '';
  note.placeholder = t('notesPlaceholder');

  const evidence = element('input');
  evidence.id = 'evidence-link';
  evidence.type = 'url';
  evidence.maxLength = 600;
  evidence.value = draft?.url ?? '';
  evidence.placeholder = 'https://…';

  const status = element('p', '', 'form-message');
  status.setAttribute('role', 'status');
  status.hidden = true;
  const submit = element('button', t('save'), 'primary');
  submit.type = 'submit';
  form.append(
    element('h3', t('evidenceHeading')),
    element('p', t('evidenceHint'), 'muted'),
    createField(t('notes'), note), createField(t('evidenceLabel'), evidence), submit, status
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const notes = note.value.trim();
    if (!notes) {
      message(status, 'notesRequired', 'error');
      note.focus();
      return;
    }
    const rawUrl = evidence.value.trim();
    const evidenceUrl = rawUrl ? webUrl(rawUrl) : '';
    if (rawUrl && !evidenceUrl) {
      message(status, 'invalidEvidence', 'error');
      evidence.focus();
      return;
    }
    const record = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      card, notes, evidenceUrl,
      questions: interviewQuestions(card, notes, evidenceUrl)
    };
    if (!persist([record, ...records])) {
      message(status, 'saveFailed', 'error');
      return;
    }
    form.reset();
    message(status);
    message($('#records-message'), 'saved');
    const panel = document.getElementById('record-' + record.id);
    panel.open = true;
    location.hash = 'records';
    renderRoute();
    panel.querySelector('summary').focus();
  });
  return form;
}

function suggestionsView(result) {
  const node = element('div', '', 'recommendations');
  const terms = element('div', '', 'search-terms');
  terms.append(element('strong', t('searchTerms')));
  for (const term of result.terms) terms.append(element('span', term, 'badge'));
  node.append(terms);
  if (result.partial) node.append(element('p', t('partialResults'), 'hint'));
  if (!result.error && !result.repositories.length) node.append(element('p', t('noResults'), 'hint'));
  if (result.error) node.append(element('p', t(result.error.key, result.error.values), 'form-message'));
  if (result.repositories.length) {
    const items = element('ul', '', 'recommendation-list');
    const number = new Intl.NumberFormat(locale === 'en' ? 'en' : 'zh-CN');
    for (const project of result.repositories) {
      const item = element('li', '', 'recommendation source');
      const heading = element('h3');
      heading.append(link(project.slug, project.url));
      const metadata = element('p', '', 'recommendation-meta');
      metadata.append(
        element('span', t('operator') + ' '),
        link('@' + project.owner, 'https://github.com/' + encodeURIComponent(project.owner)),
        document.createTextNode(' · ' + t('stars', { count: number.format(project.stars) }))
      );
      if (project.language) metadata.append(document.createTextNode(' · ' + project.language));
      item.append(heading, metadata);
      if (project.description) item.append(element('p', project.description, 'project-description'));
      item.append(element('p', t('matched') + ' · ' + project.terms.join(' · '), 'hint'));
      const choose = button(t('selectRepo'), 'secondary', () => {
        if (busy) return;
        repoInput.value = project.url;
        manualOption.open = false;
        void createCard(project, goalInput.value.trim() || result.goal, '', result);
      });
      choose.dataset.pickRepo = '';
      item.append(choose);
      items.append(item);
    }
    node.append(items);
  }
  node.append(link(t('findOnGitHub'), githubSearchUrl(result.terms[0])));
  return node;
}

function dashboardProject(project, goal) {
  const item = element('li', '', 'dashboard-project');
  const title = element('div', '', 'dashboard-project-title');
  const number = new Intl.NumberFormat(locale === 'en' ? 'en' : 'zh-CN');
  title.append(link(project.slug, project.url), element('span', '★ ' + number.format(project.stars), 'dashboard-stars'));
  item.append(title);
  if (project.description) item.append(element('p', project.description, 'dashboard-description'));
  const details = element('div', '', 'dashboard-project-details');
  const metadata = [project.language].filter(Boolean);
  const pushedAt = Date.parse(project.pushedAt);
  if (goal && Number.isFinite(pushedAt)) {
    const date = new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'zh-CN', { dateStyle: 'medium' }).format(pushedAt);
    metadata.push(t('dashboardPushed', { date }));
  }
  if (metadata.length) details.append(element('span', metadata.join(' · '), 'dashboard-language'));
  const choose = button(t('dashboardUse'), 'dashboard-project-action', () => {
    if (busy) return;
    repoInput.value = project.url;
    manualOption.open = false;
    $('#manual-readme').value = '';
    if (goal) goalInput.value = goal;
    setGoalChips();
    syncForm();
    (goalInput.value.trim() ? generate : goalInput).focus();
  });
  choose.disabled = Boolean(busy);
  choose.dataset.pickRepo = '';
  details.append(choose);
  item.append(details);
  if (goal) item.append(element('p', t('fitHow', { terms: project.terms.join(' · ') }), 'dashboard-reason'));
  return item;
}

function renderHot() {
  const state = hotStates.get(hotRange);
  const result = state?.result;
  const messages = [];
  if (result) {
    const date = new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'zh-CN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(result.fetchedAt);
    messages.push(t(state.error || Date.now() - result.fetchedAt >= hotMaxAge ? 'hotCached' : 'hotUpdated', { date }));
    if (result.partial) messages.push(t('hotPartial'));
  }
  if (state?.loading) messages.push(t('hotLoading'));
  if (state?.error) messages.push(t(result ? 'hotRefreshFailed' : 'hotUnavailable'));
  if (result && !result.repositories.length && !state.loading) messages.push(t('hotEmpty'));
  $('#hot-status').textContent = messages.join(' ');
  $('#hot-results').replaceChildren(...(result?.repositories ?? []).map((project) => dashboardProject(project)));
  $('#hot-refresh').disabled = Boolean(state?.loading);
  for (const option of document.querySelectorAll('[data-range]')) {
    option.setAttribute('aria-pressed', String(option.dataset.range === hotRange));
  }
}

function readHotCache(range) {
  try {
    const cache = JSON.parse(localStorage.getItem(hotCacheKey + range) ?? 'null');
    if (Number.isFinite(cache?.fetchedAt) && Array.isArray(cache.repositories)) return cache;
  } catch {
    // The live feed can still work without local storage.
  }
  return null;
}

async function loadHot(range, force = false) {
  const state = hotStates.get(range) ?? { result: readHotCache(range) };
  hotStates.set(range, state);
  const fresh = state.result && !state.result.partial && Date.now() - state.result.fetchedAt < hotMaxAge;
  if (state.loading || !force && fresh) {
    renderHot();
    return;
  }
  state.loading = true;
  state.error = false;
  renderHot();
  try {
    state.result = await popularRepositories(range);
    try {
      localStorage.setItem(hotCacheKey + range, JSON.stringify(state.result));
    } catch {
      // Results stay visible until the page reloads.
    }
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
    if (range === hotRange) renderHot();
  }
}

function renderFit() {
  const basis = fit?.basis ?? 'fitBasisEmpty';
  const goal = fit?.example ? t(fit.example) : fit?.goal ?? '';
  $('#fit-basis').textContent = t(basis, { goal: excerpt(goal, 80) });
  const status = $('#fit-status');
  const results = $('#fit-results');
  status.replaceChildren();
  const used = new Set(records.map(({ card }) => (card.repoUrl ?? '').toLowerCase()));
  const projects = fit?.result?.repositories ?? [];
  const tried = ({ url }) => Number(used.has(url.toLowerCase()));
  const focusedMatch = ({ terms }) => Number(terms.includes(fit.terms[0]));
  const ranked = [...projects].sort((a, b) => tried(a) - tried(b) || focusedMatch(b) - focusedMatch(a));
  results.replaceChildren(...ranked.slice(0, 3).map((project) => dashboardProject(project, goal)));
  const statusKey = fit?.loading ? 'fitLoading'
    : fit?.error ? 'fitUnavailable'
    : fit && !fit.terms.length ? 'noTerms'
    : fit?.result?.partial ? 'partialResults'
    : fit?.result && !projects.length ? 'fitEmpty'
    : '';
  if (statusKey) status.textContent = t(statusKey);
  if ((fit?.error || fit?.result && !projects.length) && fit.terms.length) {
    status.append(' ', link(t('findOnGitHub'), githubSearchUrl(fit.terms[0])));
  }
  for (const example of document.querySelectorAll('[data-fit]')) {
    example.setAttribute('aria-pressed', String(fit?.example === example.dataset.fit));
  }
}

async function loadFit(goal, basis, example) {
  const terms = searchTerms(goal);
  if (fit?.goal === goal && fit.basis === basis && fit.example === example && (fit.loading || fit.result && !fit.result.partial)) return;
  const state = { goal, basis, example, terms, loading: Boolean(terms.length) };
  fit = state;
  renderFit();
  if (!terms.length) return;
  try {
    state.result = await recommendRepositories(terms);
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
    if (fit === state) renderFit();
  }
}

function fitFromRecords() {
  const last = records.find(({ card }) => card.kind !== translated('zh', 'demoSource') && card.kind !== translated('en', 'demoSource') && typeof card.goal === 'string' && card.goal.trim());
  if (last) void loadFit(last.card.goal, 'fitBasisHistory');
  else {
    fit = null;
    renderFit();
  }
}

function renderOutput({ focus = false, draft } = {}) {
  const title = $('#output-title');
  const subtitle = $('#output-subtitle');
  const body = $('#output-body');
  if (!view) {
    title.textContent = t('emptyTitle');
    subtitle.textContent = t('emptySubtitle');
    body.replaceChildren(emptyState.cloneNode(true));
    localize(body);
  } else if (view.type === 'suggestions') {
    title.textContent = t('suggestedTitle');
    subtitle.textContent = t('suggestedSubtitle');
    body.replaceChildren(suggestionsView(view));
  } else {
    title.textContent = t('cardTitle');
    subtitle.textContent = t('cardSubtitle');
    const { repo, goal } = view.type === 'demo' ? demoMaterials(locale) : view;
    const card = makeCard(repo, goal, locale);
    body.replaceChildren();
    if (view.previous) {
      body.append(button(t('otherRepos'), 'text-button back-to-recommendations', () => {
        if (busy) return;
        view = view.previous;
        repoInput.value = '';
        syncForm();
        renderOutput({ focus: true });
      }));
    }
    body.append(cardView(card, openTraining), evidenceForm(card, draft));
  }
  syncForm();
  if (focus) title.focus();
}

function download(record) {
  const url = URL.createObjectURL(new Blob([toMarkdown(record)], { type: 'text/markdown;charset=utf-8' }));
  const a = element('a');
  a.href = url;
  a.download = 'practice-' + record.createdAt.slice(0, 10) + '-' + record.id.slice(0, 6) + '.md';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderRecords() {
  const counter = $('#record-count');
  counter.textContent = records.length;
  counter.setAttribute('aria-label', t('recordCount', { count: records.length }));
  const container = $('#records-list');
  const openIds = new Set([...container.querySelectorAll('.record[open]')].map(({ id }) => id));
  container.replaceChildren();

  if (!records.length) {
    const empty = element('div', '', 'panel empty-state');
    const start = element('a', t('startLink'));
    start.href = '#workbench';
    empty.append(element('strong', t('noRecords')), start);
    container.append(empty);
    return;
  }

  const dates = new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
  for (const record of records) {
    const { card, notes, evidenceUrl, questions, createdAt } = record;
    const details = element('details', '', 'panel record');
    details.id = 'record-' + record.id;
    details.open = openIds.has(details.id);
    const summary = element('summary', card.title);
    summary.append(element('small', card.repo + ' · ' + card.kind + ' · ' + dates.format(new Date(createdAt))));
    const body = element('div', '', 'record-content');
    const outcome = section(t('outcome'));
    outcome.append(element('p', notes, 'notes'));
    if (evidenceUrl) outcome.append(link(t('openEvidence'), evidenceUrl));
    const interview = section(t('interview'));
    interview.append(list(questions, true));
    const actions = element('div', '', 'record-actions');
    const exportButton = button(t('export'), 'secondary', () => download(record));
    const remove = button(t('delete'), 'text-button', () => {
      if (!window.confirm(t('confirmDelete'))) return;
      if (!persist(records.filter(({ id }) => id !== record.id))) {
        message($('#records-message'), 'deleteFailed', 'error');
        return;
      }
      message($('#records-message'), 'deleted');
      $('#records-nav').focus();
    });
    remove.dataset.delete = '';
    actions.append(exportButton, remove);
    const reference = element('details', '', 'card-block');
    reference.append(element('summary', t('originalCard')), cardView(card));
    body.append(outcome, interview, actions, reference);
    details.append(summary, body);
    container.append(details);
  }
}

function applyLanguage() {
  const draft = { notes: $('#evidence-notes')?.value, url: $('#evidence-link')?.value };
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  document.title = t('title');
  $('meta[name="description"]').content = t('description');
  $('#brand-subtitle').hidden = locale === 'en';
  for (const option of document.querySelectorAll('[data-language]')) {
    option.setAttribute('aria-pressed', String(option.dataset.language === locale));
  }
  localize();
  renderMessage($('#generation-message'));
  renderMessage($('#records-message'));
  renderRecords();
  renderOutput({ draft });
  setGoalChips();
  renderHot();
  renderFit();
}

function setBusy(mode) {
  busy = mode;
  syncForm();
}

async function createCard(repo, goal, pasted, previous) {
  const status = $('#generation-message');
  message(status);
  setBusy('reading');
  try {
    const material = pasted ? manualRepo(repo, pasted) : await readRepo(repo);
    view = { type: 'practice', repo: material, goal, previous };
    renderOutput({ focus: true });
  } catch (error) {
    const key = error instanceof GitHubError ? error.code : 'loadCardFailed';
    const suffix = ['offline', 'rateLimit', 'apiError'].includes(key) ? 'readFallback' : '';
    message(status, key, 'error', error.values, suffix);
    if (previous) status.scrollIntoView({ block: 'nearest' });
  } finally {
    setBusy('');
  }
}

async function discover(goal) {
  const status = $('#generation-message');
  const terms = searchTerms(goal);
  if (!terms.length) {
    message(status, 'noTerms', 'error');
    goalInput.focus();
    return;
  }

  message(status);
  void loadFit(goal, 'fitBasisCurrent');
  setBusy('searching');
  let result;
  try {
    result = await recommendRepositories(terms);
  } catch (error) {
    const key = error instanceof GitHubError ? error.code : 'searchFailed';
    result = { repositories: [], error: { key, values: error.values } };
  } finally {
    setBusy('');
  }
  view = { type: 'suggestions', goal, terms, ...result };
  renderOutput({ focus: true });
}

$('#practice-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy) return;
  const goal = goalInput.value.trim();
  if (!goal) {
    message($('#generation-message'), 'goalRequired', 'error');
    goalInput.focus();
    return;
  }
  const url = repoInput.value.trim();
  if (!url) {
    if (isVideoGoal(goal)) {
      showVideoCard(goal);
      void loadFit(goal, 'fitBasisCurrent');
    }
    else void discover(goal);
    return;
  }

  let repo;
  try {
    repo = parseRepo(url);
  } catch (error) {
    message($('#generation-message'), error.code, 'error');
    repoInput.focus();
    return;
  }
  const pasted = manualOption.open ? $('#manual-readme').value.trim() : '';
  const previous = view?.type === 'suggestions' ? view : view?.previous;
  void createCard(repo, goal, pasted, previous);
  void loadFit(goal, 'fitBasisCurrent');
});

function showVideoCard(goal) {
  message($('#generation-message'));
  view = { type: 'practice', repo: videoPracticeMaterials(), goal };
  renderOutput({ focus: true });
}

$('#search-instead').addEventListener('click', () => void discover(goalInput.value.trim()));

$('.dashboard-switch').addEventListener('click', (event) => {
  const range = event.target.closest('[data-range]')?.dataset.range;
  if (!range || range === hotRange) return;
  hotRange = range;
  void loadHot(range);
});
$('#hot-refresh').addEventListener('click', () => void loadHot(hotRange, true));
$('#fit-current').addEventListener('click', () => {
  const goal = goalInput.value.trim();
  if (goal) void loadFit(goal, 'fitBasisCurrent');
  else {
    fitFromRecords();
    if (!fit) goalInput.focus();
  }
});
$('#fit-examples').addEventListener('click', (event) => {
  const example = event.target.closest('[data-fit]')?.dataset.fit;
  if (example) void loadFit(t(example), 'fitBasisExample', example);
});

demo.addEventListener('click', () => {
  message($('#generation-message'));
  view = { type: 'demo' };
  renderOutput({ focus: true });
});

$('#goal-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-example]');
  if (!chip) return;
  goalInput.value = t(chip.dataset.example);
  setGoalChips();
  syncForm();
});
goalInput.addEventListener('input', () => {
  setGoalChips();
  syncForm();
});
repoInput.addEventListener('input', () => {
  if (!repoInput.value.trim()) manualOption.open = false;
  syncForm();
});
$('.language-picker').addEventListener('click', (event) => {
  const language = event.target.closest('[data-language]')?.dataset.language;
  if (!language || language === locale) return;
  locale = language;
  try {
    localStorage.setItem(localeKey, locale);
  } catch {
    // The current page can still switch languages without local storage.
  }
  applyLanguage();
});
window.addEventListener('hashchange', renderRoute);
$('#close-training').addEventListener('click', () => trainingDialog.close());
trainingDialog.addEventListener('close', pauseTrainingVideos);
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  records = loadRecords();
  renderRecords();
  if (!fit || fit.basis === 'fitBasisHistory') fitFromRecords();
  else renderFit();
});
applyLanguage();
renderRoute();
void loadHot(hotRange);
fitFromRecords();
