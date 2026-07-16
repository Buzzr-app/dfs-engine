import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MCP_REGISTRY_NAME,
  NPM_PACKAGES,
  captureAdoptionMetrics,
  parseArguments,
  validateCompleteUtcWindow,
} from '../capture-adoption-metrics.mjs';

const baselineDownloads = new Map([
  ['@buzzr/bets-core', 34],
  ['@buzzr/dfs-cli', 9],
  ['@buzzr/dfs-engine', 38],
  ['@buzzr/dfs-engine-test-vectors', 16],
  ['@buzzr/dfs-provider-espn', 25],
  ['@buzzr/dfs-provider-sportradar', 18],
  ['@buzzr/dfs-react', 8],
  ['@buzzr/dfs-testkit', 19],
  ['@buzzr/entertainment-engine', 20],
  ['@buzzr/mcp', 4],
]);

const jsonResponse = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function createFetchFixture() {
  const requested = [];

  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    requested.push({ url: url.href, headers: new Headers(init.headers) });

    if (url.hostname === 'api.npmjs.org') {
      const packageName = decodeURIComponent(url.pathname.split('/').at(-1));
      assert.equal(url.pathname.split('/').at(-2), '2026-07-09:2026-07-15');
      return jsonResponse({
        start: '2026-07-09',
        end: '2026-07-15',
        package: packageName,
        downloads: baselineDownloads.get(packageName),
      });
    }

    if (url.hostname === 'api.github.com') {
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer test-token');

      if (url.pathname === '/repos/Buzzr-app/dfs-engine') {
        return jsonResponse({
          stargazers_count: 1,
          forks_count: 0,
          subscribers_count: 0,
          html_url: 'https://github.com/Buzzr-app/dfs-engine',
        });
      }
      if (url.pathname.endsWith('/traffic/clones')) {
        return jsonResponse({
          count: 98,
          uniques: 37,
          clones: [{ timestamp: '2026-07-15T00:00:00Z', count: 2, uniques: 2 }],
        });
      }
      if (url.pathname.endsWith('/traffic/views')) {
        return jsonResponse({
          count: 1,
          uniques: 1,
          views: [{ timestamp: '2026-07-15T00:00:00Z', count: 1, uniques: 1 }],
        });
      }
      if (url.pathname.endsWith('/traffic/popular/referrers')) {
        return jsonResponse([{ referrer: 'github.com', count: 1, uniques: 1 }]);
      }
      if (url.pathname.endsWith('/traffic/popular/paths')) {
        return jsonResponse([
          { path: '/Buzzr-app/dfs-engine', title: 'Buzzr DFS engine', count: 1, uniques: 1 },
        ]);
      }
      if (url.pathname.endsWith('/issues') && url.searchParams.get('state') === 'open') {
        return jsonResponse([
          { number: 11, created_at: '2026-06-01T00:00:00Z', state: 'open' },
          {
            number: 12,
            created_at: '2026-06-02T00:00:00Z',
            state: 'open',
            pull_request: { url: 'https://api.github.com/repos/Buzzr-app/dfs-engine/pulls/12' },
          },
        ]);
      }
      if (url.pathname.endsWith('/issues') && url.searchParams.get('state') === 'all') {
        return jsonResponse([
          { number: 13, created_at: '2026-07-10T12:00:00Z', state: 'closed' },
          {
            number: 14,
            created_at: '2026-07-11T12:00:00Z',
            state: 'closed',
            pull_request: { url: 'https://api.github.com/repos/Buzzr-app/dfs-engine/pulls/14' },
          },
          { number: 15, created_at: '2026-07-16T00:00:00Z', state: 'open' },
        ]);
      }
    }

    if (url.hostname === 'registry.modelcontextprotocol.io') {
      assert.equal(url.pathname, '/v0.1/servers');
      assert.equal(url.searchParams.get('search'), MCP_REGISTRY_NAME);
      assert.equal(url.searchParams.get('version'), 'latest');
      return jsonResponse({
        servers: [
          {
            server: { name: MCP_REGISTRY_NAME, version: '5.1.0', title: 'Buzzr Sports Engine' },
            _meta: {
              'io.modelcontextprotocol.registry/official': {
                status: 'active',
                publishedAt: '2026-07-16T14:00:00Z',
                isLatest: true,
              },
            },
          },
          {
            server: { name: `${MCP_REGISTRY_NAME}-similar`, version: '1.0.0' },
            _meta: {
              'io.modelcontextprotocol.registry/official': {
                status: 'active',
                publishedAt: '2026-07-15T14:00:00Z',
                isLatest: true,
              },
            },
          },
        ],
        metadata: { count: 2 },
      });
    }

    return jsonResponse({ message: `Unexpected request: ${url.href}` }, 404);
  };

  return { fetch, requested };
}

test('tracks the complete ten-package Buzzr public family', () => {
  assert.deepEqual(NPM_PACKAGES, [...baselineDownloads.keys()]);
});

test('requires explicit, completed UTC date windows', () => {
  const now = new Date('2026-07-16T12:00:00Z');

  assert.deepEqual(validateCompleteUtcWindow('2026-07-09', '2026-07-15', now), {
    startDate: '2026-07-09',
    endDate: '2026-07-15',
    timezone: 'UTC',
    inclusivity: 'start and end dates inclusive',
    completeDaysOnly: true,
  });
  assert.throws(
    () => validateCompleteUtcWindow('2026-07-09', '2026-07-16', now),
    /must be earlier than the current UTC date/,
  );
  assert.throws(
    () => validateCompleteUtcWindow('2026-07-15', '2026-07-09', now),
    /must not be after/,
  );
  assert.throws(() => validateCompleteUtcWindow('07-09-2026', '2026-07-15', now), /YYYY-MM-DD/);
});

test('requires both CLI window boundaries', () => {
  assert.deepEqual(parseArguments(['--start', '2026-07-09', '--end', '2026-07-15']), {
    startDate: '2026-07-09',
    endDate: '2026-07-15',
  });
  assert.throws(() => parseArguments(['--start', '2026-07-09']), /--start and --end are required/);
  assert.throws(() => parseArguments(['--start', '2026-07-09', '--wat']), /Unknown argument/);
});

test('captures source-backed adoption without claiming unique users', async () => {
  const fixture = createFetchFixture();
  const snapshot = await captureAdoptionMetrics({
    startDate: '2026-07-09',
    endDate: '2026-07-15',
    capturedAt: '2026-07-16T15:00:00.000Z',
    githubToken: 'test-token',
    fetch: fixture.fetch,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.capturedAt, '2026-07-16T15:00:00.000Z');
  assert.equal(snapshot.repository, 'Buzzr-app/dfs-engine');
  assert.equal(snapshot.npm.packages.length, 10);
  assert.equal(snapshot.npm.familyTotal, 191);
  assert.equal(snapshot.npm.interpretation.uniqueUsers, false);
  assert.match(snapshot.npm.source.api, /^https:\/\/api\.npmjs\.org\//);
  assert.equal(snapshot.npm.source.window.completeDaysOnly, true);

  assert.equal(snapshot.github.repository.stars, 1);
  assert.equal(snapshot.github.repository.forks, 0);
  assert.equal(snapshot.github.repository.subscribers, 0);
  assert.equal(snapshot.github.traffic.clones, 98);
  assert.equal(snapshot.github.traffic.uniqueCloners, 37);
  assert.equal(snapshot.github.traffic.views, 1);
  assert.equal(snapshot.github.traffic.uniqueViewers, 1);
  assert.deepEqual(snapshot.github.traffic.topReferrers, [
    { referrer: 'github.com', count: 1, uniques: 1 },
  ]);
  assert.equal(snapshot.github.traffic.topPaths[0].path, '/Buzzr-app/dfs-engine');
  assert.match(snapshot.github.source.trafficWindow, /rolling 14-day/i);
  assert.equal(snapshot.github.issues.openAtCapture, 1);
  assert.equal(snapshot.github.issues.openedInMeasurementWindow, 1);
  assert.equal(snapshot.github.issues.excludesPullRequests, true);

  assert.equal(snapshot.mcpRegistry.exactName, MCP_REGISTRY_NAME);
  assert.equal(snapshot.mcpRegistry.exactRecordCount, 1);
  assert.equal(snapshot.mcpRegistry.records[0].version, '5.1.0');
  assert.equal(snapshot.mcpAdoptionProxy.package, '@buzzr/mcp');
  assert.equal(snapshot.mcpAdoptionProxy.downloads, 4);
  assert.equal(snapshot.mcpAdoptionProxy.uniqueUsers, false);
  assert.match(snapshot.mcpAdoptionProxy.rationale, /privacy-preserving/i);

  const githubRequests = fixture.requested.filter(({ url }) =>
    url.startsWith('https://api.github.com/'),
  );
  assert(githubRequests.length >= 7);
  assert(githubRequests.every(({ headers }) => headers.get('authorization') === 'Bearer test-token'));
});

test('fails closed when an upstream response is not successful', async () => {
  await assert.rejects(
    captureAdoptionMetrics({
      startDate: '2026-07-09',
      endDate: '2026-07-15',
      capturedAt: '2026-07-16T15:00:00.000Z',
      githubToken: 'test-token',
      fetch: async () => jsonResponse({ message: 'rate limited' }, 429),
    }),
    /429.*rate limited/,
  );
});
