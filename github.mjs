import { repositoryQuery } from './discovery.mjs';

export class GitHubError extends Error {
  constructor(code, values) {
    super(code);
    this.code = code;
    this.values = values;
  }
}

const API = 'https://api.github.com';

export function parseRepo(input) {
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new GitHubError('urlFormat');
  }
  const parts = url.pathname.replace(/\/$/, '').split('/').slice(1);
  const [owner, rawRepo] = parts;
  const repo = rawRepo?.replace(/\.git$/i, '');
  if (
    url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port
    || parts.length !== 2 || !/^[a-z\d][a-z\d-]*$/i.test(owner ?? '') || !/^[a-z\d_.-]+$/i.test(repo ?? '')
  ) {
    throw new GitHubError('urlHome');
  }
  return { slug: owner + '/' + repo, url: 'https://github.com/' + owner + '/' + repo };
}

async function request(path, signal) {
  let response;
  try {
    response = await fetch(API + path, {
      headers: { Accept: 'application/vnd.github+json' },
      signal
    });
  } catch {
    throw new GitHubError('offline');
  }

  if (response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0' && !response.ok) {
    throw new GitHubError('rateLimit');
  }
  if (response.status === 404) {
    throw new GitHubError('notFound');
  }
  if (!response.ok) {
    throw new GitHubError('apiError', { status: response.status });
  }
  return response.json();
}

function fileUrl(repoUrl, kind, commit, path) {
  return repoUrl + '/' + kind + '/' + commit + '/' + path.split('/').map(encodeURIComponent).join('/');
}

function decodeReadme(data) {
  if (data?.encoding !== 'base64' || typeof data.content !== 'string' || !data.content) {
    return '';
  }
  return new TextDecoder().decode(Uint8Array.from(atob(data.content), (char) => char.charCodeAt(0)));
}

export async function readRepo(repo) {
  const signal = AbortSignal.timeout(15000);
  const base = '/repos/' + repo.slug;
  const info = await request(base, signal);
  const commits = await request(base + '/commits?per_page=1&sha=' + encodeURIComponent(info.default_branch), signal);
  const commit = commits[0]?.sha;
  if (!/^[a-f\d]{40}$/.test(commit ?? '')) {
    throw new GitHubError('noCommit');
  }
  const ref = '?ref=' + commit;
  const [readmeResult, rootResult] = await Promise.allSettled([
    request(base + '/readme' + ref, signal),
    request(base + '/contents' + ref, signal)
  ]);
  const readme = readmeResult.status === 'fulfilled' ? readmeResult.value : null;
  const root = rootResult.status === 'fulfilled' && Array.isArray(rootResult.value) ? rootResult.value : [];
  const readmeText = decodeReadme(readme);
  if (!readmeText && !root.length) {
    throw new GitHubError('noSources');
  }
  const repoUrl = parseRepo(info.html_url).url;
  return {
    slug: info.full_name,
    url: repoUrl,
    description: info.description ?? '',
    language: info.language ?? '',
    commit,
    kind: 'githubSource',
    readmeText,
    readmePath: readmeText ? readme.path : '',
    readmeUrl: readmeText ? fileUrl(repoUrl, 'blob', commit, readme.path) : '',
    entries: root.filter(({ type }) => type === 'file' || type === 'dir').map(({ type, path }) => ({
      path, type, url: fileUrl(repoUrl, type === 'file' ? 'blob' : 'tree', commit, path)
    })),
    note: readmeText ? '' : 'rootOnly'
  };
}

export function manualRepo(repo, readmeText) {
  return {
    ...repo,
    kind: 'manualSource',
    readmeText,
    readmePath: '',
    readmeUrl: '',
    entries: [],
    note: 'manualNote'
  };
}

function publicProject(repo) {
  if (repo.fork || repo.archived || repo.disabled || repo.private || !repo.owner?.login) return null;
  try {
    return {
      ...parseRepo(repo.html_url),
      owner: repo.owner.login,
      description: repo.description ?? '',
      language: repo.language ?? '',
      stars: repo.stargazers_count ?? 0,
      pushedAt: repo.pushed_at
    };
  } catch {
    return null;
  }
}

export async function popularRepositories(range) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const base = 'is:public archived:false fork:false';
  const q = range === 'recent' ? base + ' stars:>=1 created:>=' + cutoff : base + ' stars:>=10000';
  const query = new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: '12' });
  const result = await request('/search/repositories?' + query, AbortSignal.timeout(10000));
  return {
    repositories: (result.items ?? []).map(publicProject).filter(Boolean).slice(0, 3),
    partial: Boolean(result.incomplete_results),
    fetchedAt: Date.now()
  };
}

const recommendationCache = new Map();

export function recommendRepositories(terms) {
  const key = JSON.stringify(terms);
  const cached = recommendationCache.get(key);
  if (cached && Date.now() < cached.expires) return cached.request;
  const entry = { expires: Infinity, request: null };
  entry.request = fetchRecommendations(terms).then((result) => {
    entry.expires = Date.now() + (result.partial ? 30_000 : 300_000);
    return result;
  }).catch((error) => {
    if (recommendationCache.get(key) === entry) recommendationCache.delete(key);
    throw error;
  });
  if (recommendationCache.size >= 20) recommendationCache.delete(recommendationCache.keys().next().value);
  recommendationCache.set(key, entry);
  return entry.request;
}

async function fetchRecommendations(terms) {
  const signal = AbortSignal.timeout(15000);
  const searches = await Promise.allSettled(terms.map((term) => {
    const params = new URLSearchParams({ q: repositoryQuery(term), per_page: '12' });
    return request('/search/repositories?' + params, signal);
  }));
  if (searches.every(({ status }) => status === 'rejected')) throw searches[0].reason;

  const candidates = new Map();
  for (const [searchIndex, result] of searches.entries()) {
    if (result.status !== 'fulfilled') continue;
    for (const [index, repo] of (result.value.items ?? []).entries()) {
      const project = publicProject(repo);
      if (!project) continue;
      const key = project.slug.toLowerCase();
      const candidate = candidates.get(key) ?? {
        ...project,
        terms: [],
        score: 0
      };
      candidate.terms.push(terms[searchIndex]);
      candidate.score += (searchIndex === 0 ? 1.25 : 1) / (index + 1);
      candidates.set(key, candidate);
    }
  }

  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score || b.stars - a.stars);
  const seenOwners = new Set();
  const diverse = [];
  const sameOwner = [];
  for (const repo of ranked) {
    const key = repo.owner.toLowerCase();
    (seenOwners.has(key) ? sameOwner : diverse).push(repo);
    seenOwners.add(key);
  }
  return {
    repositories: [...diverse, ...sameOwner].slice(0, 6),
    partial: searches.some((result) => result.status === 'rejected' || result.value.incomplete_results)
  };
}
