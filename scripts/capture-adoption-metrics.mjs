#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const NPM_PACKAGES = Object.freeze([
  '@buzzr/bets-core',
  '@buzzr/dfs-cli',
  '@buzzr/dfs-engine',
  '@buzzr/dfs-engine-test-vectors',
  '@buzzr/dfs-provider-espn',
  '@buzzr/dfs-provider-sportradar',
  '@buzzr/dfs-react',
  '@buzzr/dfs-testkit',
  '@buzzr/entertainment-engine',
  '@buzzr/mcp',
]);

export const MCP_REGISTRY_NAME = 'io.github.Buzzr-app/dfs-engine';

const REPOSITORY = 'Buzzr-app/dfs-engine';
const NPM_DOWNLOADS_API = 'https://api.npmjs.org/downloads/point';
const GITHUB_API = 'https://api.github.com';
const MCP_REGISTRY_API = 'https://registry.modelcontextprotocol.io/v0.1/servers';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value, label) {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a real UTC date in YYYY-MM-DD format.`);
  }

  return parsed;
}

export function validateCompleteUtcWindow(startDate, endDate, now = new Date()) {
  const start = parseDateOnly(startDate, '--start');
  const end = parseDateOnly(endDate, '--end');
  if (start > end) {
    throw new Error('--start must not be after --end.');
  }

  const currentUtcDate = now.toISOString().slice(0, 10);
  if (endDate >= currentUtcDate) {
    throw new Error('--end must be earlier than the current UTC date so every day is complete.');
  }

  return {
    startDate,
    endDate,
    timezone: 'UTC',
    inclusivity: 'start and end dates inclusive',
    completeDaysOnly: true,
  };
}

export function parseArguments(arguments_) {
  const values = {};

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument !== '--start' && argument !== '--end') {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a YYYY-MM-DD value.`);
    }
    values[argument === '--start' ? 'startDate' : 'endDate'] = value;
    index += 1;
  }

  if (!values.startDate || !values.endDate) {
    throw new Error('--start and --end are required.');
  }

  return values;
}

function normalizeCapturedAt(capturedAt) {
  const value = capturedAt instanceof Date ? capturedAt : new Date(capturedAt);
  if (Number.isNaN(value.valueOf())) {
    throw new Error('capturedAt must be a valid timestamp.');
  }
  return value.toISOString();
}

function requireNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} was not a finite number.`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} was not an array.`);
  }
  return value;
}

async function requestJson(fetchImplementation, url, init = {}) {
  const response = await fetchImplementation(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
  const body = await response.text();

  let parsed;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(`GET ${url} returned non-JSON data (${response.status}).`);
  }

  if (!response.ok) {
    const detail = parsed?.message ?? parsed?.error ?? body.slice(0, 200) ?? 'unknown error';
    throw new Error(`GET ${url} failed (${response.status}): ${detail}`);
  }

  return parsed;
}

function createGithubHeaders(githubToken) {
  if (!githubToken?.trim()) {
    throw new Error(
      'GitHub traffic requires GH_TOKEN/GITHUB_TOKEN or a working `gh auth token` login.',
    );
  }

  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${githubToken.trim()}`,
    'user-agent': 'buzzr-adoption-capture',
    'x-github-api-version': '2022-11-28',
  };
}

function githubUrl(path, parameters = {}) {
  const url = new URL(path, GITHUB_API);
  for (const [name, value] of Object.entries(parameters)) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  return url.href;
}

async function fetchAllGithubIssues({ fetchImplementation, headers, state, since }) {
  const issues = [];
  let page = 1;
  let firstRequestUrl;

  while (page <= 1_000) {
    const requestUrl = githubUrl(`/repos/${REPOSITORY}/issues`, {
      state,
      per_page: 100,
      since,
      page,
    });
    firstRequestUrl ??= requestUrl;
    const batch = requireArray(
      await requestJson(fetchImplementation, requestUrl, { headers }),
      `GitHub ${state} issues`,
    );
    issues.push(...batch);
    if (batch.length < 100) return { issues, sourceUrl: firstRequestUrl };
    page += 1;
  }

  throw new Error('GitHub issues pagination exceeded 1,000 pages.');
}

async function captureNpm({ startDate, endDate, fetchImplementation, window }) {
  const packages = await Promise.all(
    NPM_PACKAGES.map(async (name) => {
      const sourceUrl = `${NPM_DOWNLOADS_API}/${startDate}:${endDate}/${encodeURIComponent(name)}`;
      const response = await requestJson(fetchImplementation, sourceUrl);
      if (response.package !== name || response.start !== startDate || response.end !== endDate) {
        throw new Error(`npm returned mismatched package or window metadata for ${name}.`);
      }
      return {
        name,
        downloads: requireNumber(response.downloads, `${name} downloads`),
        sourceUrl,
      };
    }),
  );

  return {
    source: {
      api: NPM_DOWNLOADS_API,
      documentation: 'https://github.com/npm/registry/blob/main/docs/download-counts.md',
      window,
    },
    packages,
    familyTotal: packages.reduce((sum, package_) => sum + package_.downloads, 0),
    interpretation: {
      unit: 'package downloads',
      uniqueUsers: false,
      note: 'One consumer can download multiple packages or download the same package more than once.',
    },
  };
}

async function captureGithub({ startDate, endDate, fetchImplementation, githubToken }) {
  const headers = createGithubHeaders(githubToken);
  const repoUrl = githubUrl(`/repos/${REPOSITORY}`);
  const clonesUrl = githubUrl(`/repos/${REPOSITORY}/traffic/clones`, { per: 'day' });
  const viewsUrl = githubUrl(`/repos/${REPOSITORY}/traffic/views`, { per: 'day' });
  const referrersUrl = githubUrl(`/repos/${REPOSITORY}/traffic/popular/referrers`);
  const pathsUrl = githubUrl(`/repos/${REPOSITORY}/traffic/popular/paths`);
  const windowStart = `${startDate}T00:00:00.000Z`;
  const endExclusive = parseDateOnly(endDate, '--end');
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const [repo, clones, views, topReferrers, topPaths, openIssueResult, windowIssueResult] =
    await Promise.all([
      requestJson(fetchImplementation, repoUrl, { headers }),
      requestJson(fetchImplementation, clonesUrl, { headers }),
      requestJson(fetchImplementation, viewsUrl, { headers }),
      requestJson(fetchImplementation, referrersUrl, { headers }),
      requestJson(fetchImplementation, pathsUrl, { headers }),
      fetchAllGithubIssues({ fetchImplementation, headers, state: 'open' }),
      fetchAllGithubIssues({
        fetchImplementation,
        headers,
        state: 'all',
        since: windowStart,
      }),
    ]);

  const isIssue = (item) => item && typeof item === 'object' && !item.pull_request;
  const openIssues = openIssueResult.issues.filter(isIssue);
  const issuesOpenedInWindow = windowIssueResult.issues.filter((item) => {
    if (!isIssue(item)) return false;
    const createdAt = new Date(item.created_at);
    return createdAt >= new Date(windowStart) && createdAt < endExclusive;
  });

  return {
    source: {
      api: GITHUB_API,
      repositoryUrl: `https://github.com/${REPOSITORY}`,
      documentation: {
        repository: 'https://docs.github.com/en/rest/repos/repos#get-a-repository',
        traffic: 'https://docs.github.com/en/rest/metrics/traffic',
        issues: 'https://docs.github.com/en/rest/issues/issues#list-repository-issues',
      },
      trafficWindow:
        'GitHub-defined rolling 14-day window at capture time; it is independent of the explicit npm and issue window.',
      requests: {
        repository: repoUrl,
        clones: clonesUrl,
        views: viewsUrl,
        topReferrers: referrersUrl,
        topPaths: pathsUrl,
        openIssues: openIssueResult.sourceUrl,
        issuesOpenedInMeasurementWindow: windowIssueResult.sourceUrl,
      },
    },
    repository: {
      stars: requireNumber(repo.stargazers_count, 'GitHub stars'),
      forks: requireNumber(repo.forks_count, 'GitHub forks'),
      subscribers: requireNumber(repo.subscribers_count, 'GitHub subscribers'),
    },
    traffic: {
      clones: requireNumber(clones.count, 'GitHub clones'),
      uniqueCloners: requireNumber(clones.uniques, 'GitHub unique cloners'),
      cloneDays: requireArray(clones.clones, 'GitHub clone days'),
      views: requireNumber(views.count, 'GitHub views'),
      uniqueViewers: requireNumber(views.uniques, 'GitHub unique viewers'),
      viewDays: requireArray(views.views, 'GitHub view days'),
      topReferrers: requireArray(topReferrers, 'GitHub top referrers'),
      topPaths: requireArray(topPaths, 'GitHub top paths'),
    },
    issues: {
      openAtCapture: openIssues.length,
      openedInMeasurementWindow: issuesOpenedInWindow.length,
      measurementWindow: {
        startDate,
        endDate,
        timezone: 'UTC',
        inclusivity: 'start and end dates inclusive',
      },
      excludesPullRequests: true,
    },
  };
}

async function captureMcpRegistry(fetchImplementation) {
  const firstUrl = new URL(MCP_REGISTRY_API);
  firstUrl.searchParams.set('search', MCP_REGISTRY_NAME);
  firstUrl.searchParams.set('version', 'latest');
  firstUrl.searchParams.set('limit', '100');
  const queryUrl = firstUrl.href;
  const exactRecords = [];
  const visitedCursors = new Set();
  let cursor;

  do {
    const url = new URL(queryUrl);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await requestJson(fetchImplementation, url.href);
    const servers = requireArray(response.servers ?? [], 'MCP Registry servers');

    for (const record of servers) {
      if (record?.server?.name !== MCP_REGISTRY_NAME) continue;
      const official = record?._meta?.['io.modelcontextprotocol.registry/official'] ?? {};
      exactRecords.push({
        name: record.server.name,
        version: record.server.version,
        title: record.server.title ?? null,
        status: official.status ?? null,
        publishedAt: official.publishedAt ?? null,
        isLatest: official.isLatest ?? null,
      });
    }

    cursor = response.metadata?.nextCursor;
    if (cursor && visitedCursors.has(cursor)) {
      throw new Error('MCP Registry returned a repeated pagination cursor.');
    }
    if (cursor) visitedCursors.add(cursor);
  } while (cursor);

  return {
    source: {
      api: MCP_REGISTRY_API,
      documentation: 'https://registry.modelcontextprotocol.io/docs',
      queryUrl,
      querySemantics: 'latest active records matching search, then exact server-name filtering',
    },
    exactName: MCP_REGISTRY_NAME,
    exactRecordCount: exactRecords.length,
    records: exactRecords,
  };
}

export async function captureAdoptionMetrics({
  startDate,
  endDate,
  capturedAt = new Date(),
  githubToken,
  fetch: fetchImplementation = globalThis.fetch,
}) {
  const window = validateCompleteUtcWindow(startDate, endDate, new Date(capturedAt));
  if (typeof fetchImplementation !== 'function') {
    throw new Error('A Fetch API implementation is required.');
  }

  const [npm, github, mcpRegistry] = await Promise.all([
    captureNpm({ startDate, endDate, fetchImplementation, window }),
    captureGithub({ startDate, endDate, fetchImplementation, githubToken }),
    captureMcpRegistry(fetchImplementation),
  ]);
  const mcpDownloads = npm.packages.find(({ name }) => name === '@buzzr/mcp').downloads;

  return {
    schemaVersion: 1,
    capturedAt: normalizeCapturedAt(capturedAt),
    repository: REPOSITORY,
    npm,
    github,
    mcpRegistry,
    mcpAdoptionProxy: {
      metric: 'npm package downloads',
      package: '@buzzr/mcp',
      downloads: mcpDownloads,
      window,
      uniqueUsers: false,
      rationale:
        'Aggregate @buzzr/mcp downloads are a privacy-preserving MCP adoption proxy; they do not identify clients or unique users.',
    },
  };
}

function resolveGithubToken(environment = process.env) {
  const environmentToken = environment.GH_TOKEN ?? environment.GITHUB_TOKEN;
  if (environmentToken?.trim()) return environmentToken.trim();

  const result = spawnSync('gh', ['auth', 'token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();

  throw new Error(
    'GitHub traffic requires GH_TOKEN/GITHUB_TOKEN or a working `gh auth token` login.',
  );
}

async function main() {
  if (process.argv.slice(2).some((argument) => argument === '--help' || argument === '-h')) {
    process.stdout.write(
      'Usage: npm run --silent capture:adoption -- --start YYYY-MM-DD --end YYYY-MM-DD\n' +
        'Both boundaries are inclusive complete UTC dates. JSON is written to stdout.\n',
    );
    return;
  }

  const { startDate, endDate } = parseArguments(process.argv.slice(2));
  validateCompleteUtcWindow(startDate, endDate);
  const snapshot = await captureAdoptionMetrics({
    startDate,
    endDate,
    githubToken: resolveGithubToken(),
  });
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`Adoption capture failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
