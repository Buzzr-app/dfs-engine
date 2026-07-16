import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

const root = resolve(new URL('../', import.meta.url).pathname);
const checkExternal = process.argv.includes('--external');
const trackedMarkdown = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean)
  .filter((path) => !path.startsWith('docs/api/') && !/^packages\/[^/]+\/docs\//.test(path));

function linesOutsideCodeFences(content) {
  const lines = [];
  let fence = null;
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const marker = line.match(/^\s*(```+|~~~+)/)?.[1] ?? null;
    if (marker) {
      if (!fence) fence = marker[0];
      else if (marker[0] === fence) fence = null;
      continue;
    }
    if (!fence) lines.push({ number: index + 1, text: line });
  }
  return lines;
}

function stripInlineCode(line) {
  return line.replace(/`[^`]*`/g, '');
}

function normalizeDestination(raw) {
  const value = raw.trim();
  if (value.startsWith('<')) {
    const end = value.indexOf('>');
    return end === -1 ? value.slice(1) : value.slice(1, end);
  }
  return value.split(/\s+["']/u, 1)[0];
}

function markdownDestinations(line) {
  return [...line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) =>
    normalizeDestination(match[1]),
  );
}

function trimBareUrl(value) {
  let url = value.replace(/[.,;:!?]+$/u, '');
  while (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
    url = url.slice(0, -1);
  }
  return url;
}

function bareUrls(line) {
  return [...stripInlineCode(line).matchAll(/https?:\/\/[^\s<>"'`\]]+/g)].map((match) =>
    trimBareUrl(match[0]),
  );
}

function githubSlug(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function documentAnchors(content) {
  const anchors = new Set();
  const counts = new Map();
  for (const { text } of linesOutsideCodeFences(content)) {
    const heading = text.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)?.[1];
    if (heading) {
      const base = githubSlug(heading);
      const count = counts.get(base) ?? 0;
      counts.set(base, count + 1);
      anchors.add(count === 0 ? base : `${base}-${count}`);
    }
    for (const match of text.matchAll(/<(?:a\s+name|[^>]+\sid)=["']([^"']+)["']/gi)) {
      anchors.add(match[1]);
    }
  }
  return anchors;
}

const documents = new Map(
  await Promise.all(
    trackedMarkdown.map(async (path) => [path, await readFile(resolve(root, path), 'utf8')]),
  ),
);
const anchorCache = new Map();
const localFailures = [];
const externalReferences = new Map();
let localReferenceCount = 0;

for (const [path, content] of documents) {
  for (const { number, text } of linesOutsideCodeFences(content)) {
    const destinations = markdownDestinations(text);
    for (const href of destinations) {
      if (!href || /^(?:mailto:|data:|javascript:)/i.test(href)) continue;
      if (/^https?:/i.test(href)) {
        const references = externalReferences.get(href) ?? [];
        references.push(`${path}:${number}`);
        externalReferences.set(href, references);
        continue;
      }
      if (['link', 'url'].includes(href.toLowerCase()) || /[{}]/.test(href)) continue;

      localReferenceCount += 1;
      const [encodedTarget, encodedFragment = ''] = href.split('#', 2);
      let targetPath;
      try {
        targetPath = encodedTarget
          ? resolve(dirname(resolve(root, path)), decodeURIComponent(encodedTarget))
          : resolve(root, path);
      } catch {
        localFailures.push(`${path}:${number} has malformed link ${href}`);
        continue;
      }
      try {
        await access(targetPath);
      } catch {
        localFailures.push(`${path}:${number} links to missing ${href}`);
        continue;
      }

      if (encodedFragment && ['.md', ''].includes(extname(targetPath).toLowerCase())) {
        const relativeTarget = targetPath.slice(root.length + 1);
        const targetContent = documents.get(relativeTarget);
        if (targetContent !== undefined) {
          const anchors = anchorCache.get(relativeTarget) ?? documentAnchors(targetContent);
          anchorCache.set(relativeTarget, anchors);
          const fragment = decodeURIComponent(encodedFragment).toLowerCase();
          if (!anchors.has(fragment)) {
            localFailures.push(`${path}:${number} links to missing anchor ${href}`);
          }
        }
      }
    }

    if (checkExternal) {
      for (const url of bareUrls(text)) {
        const references = externalReferences.get(url) ?? [];
        references.push(`${path}:${number}`);
        externalReferences.set(url, references);
      }
    }
  }
}

assert.deepEqual(
  localFailures,
  [],
  `Broken local documentation links:\n${localFailures.join('\n')}`,
);

function localPagesTarget(url) {
  const parsed = new URL(url);
  if (
    parsed.origin !== 'https://buzzr-app.github.io' ||
    !parsed.pathname.startsWith('/dfs-engine/')
  ) {
    return null;
  }
  const relative = parsed.pathname.slice('/dfs-engine/'.length) || 'index.html';
  return resolve(root, 'docs/api', relative.endsWith('/') ? `${relative}index.html` : relative);
}

async function fetchReachability(url) {
  const localTarget = localPagesTarget(url);
  if (localTarget) {
    await access(localTarget);
    return;
  }

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          Range: 'bytes=0-0',
          'User-Agent': 'Buzzr-doc-link-check/1.0 (+https://github.com/Buzzr-app/dfs-engine)',
        },
        signal: controller.signal,
      });
      await response.body?.cancel();
      if (response.status === 404 || response.status === 410) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      return;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

if (checkExternal) {
  const queue = [...externalReferences.keys()].sort();
  const failures = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, queue.length) }, async () => {
      while (cursor < queue.length) {
        const url = queue[cursor];
        cursor += 1;
        try {
          await fetchReachability(url);
        } catch (error) {
          failures.push(
            `${url} (${externalReferences.get(url).join(', ')}): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }),
  );
  assert.deepEqual(failures, [], `Broken external documentation links:\n${failures.join('\n')}`);
}

console.log(
  `Documentation links passed: ${trackedMarkdown.length} files, ${localReferenceCount} local references${
    checkExternal ? `, ${externalReferences.size} external URLs` : ''
  }.`,
);
