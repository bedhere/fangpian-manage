import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isExternalCollabRequest } from './external-collab-bridge';
import { allowedExternalRoute } from '../../../api/src/modules/external-collab/proxy-security';

let workspace = resolve(process.cwd());
while (!existsSync(join(workspace, 'pnpm-workspace.yaml')) && dirname(workspace) !== workspace) workspace = dirname(workspace);
const read = (path: string) => readFileSync(join(workspace, path), 'utf8');
type Route = { method: string; path: string };
const originalFixtureRoot = 'apps/external-collab/test/fixtures/original';
const catalog = JSON.parse(read(`${originalFixtureRoot}/config/apis.json`)) as Route[];
const business = catalog.filter(({ path }) => /^\/api\/(dashboard\/|tianji\/login\/|jobs\/)/.test(path));
const key = ({ method, path }: Route) => `${method} ${path}`;
function controllerRoutes(root: string): Route[] {
  return ['dashboard/dashboard.controller.ts', 'tianji-login/tianji-login.controller.ts'].flatMap((file) => {
    const source = read(`${root}/server/modules/${file}`);
    const prefix = source.match(/@Controller\('([^']+)'\)/)?.[1];
    return [...source.matchAll(/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/g)].map((match) => ({ method: match[1].toUpperCase(), path: `/${prefix}/${match[2]}` }));
  });
}
describe('exported collaboration API contract parity', () => {
  it('retains the exact original fixture bytes and all 34 original business endpoints', () => {
    const provenance = JSON.parse(read(`${originalFixtureRoot}/provenance.json`)) as { files: { path: string; sha256: string }[] };
    expect(provenance.files).toHaveLength(3);
    expect(business).toHaveLength(34);
    for (const fixture of provenance.files) expect(createHash('sha256').update(readFileSync(join(workspace, originalFixtureRoot, fixture.path))).digest('hex')).toBe(fixture.sha256);
  });
  it('matches the exported API catalog to both original and migrated controllers', () => {
    const declared = business.filter(({ path }) => !path.startsWith('/api/jobs/')).map(key).sort();
    for (const root of [`${originalFixtureRoot}/source`, 'apps/external-collab']) expect(controllerRoutes(root).map(key).sort()).toEqual(declared);
    expect(business.filter(({ path }) => path.startsWith('/api/jobs/'))).toEqual([expect.objectContaining({ method: 'GET', path: '/api/jobs/:id' })]);
    expect(read('apps/external-collab/server/platform/jobs.ts')).toMatch(/@Get\(':id'\)/);
  });
  it('accepts every published business method/path in both iframe RPC and main API', () => {
    for (const route of business) {
      const path = route.path.replace(':id', 'job_original_123');
      expect(isExternalCollabRequest({ type: 'external-collab:request', id: 'contract', method: route.method, path }), key(route)).toBe(true);
      expect(allowedExternalRoute(route.method, path.slice('/api/'.length)), key(route)).toBe(true);
    }
  });
  it('rejects unpublished method combinations in both boundaries and excludes example/platform administration endpoints', () => {
    for (const path of new Set(business.map((route) => route.path))) {
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        const expected = business.some((route) => route.path === path && route.method === method);
        const concrete = path.replace(':id', 'job_original_123');
        expect(isExternalCollabRequest({ type: 'external-collab:request', id: 'contract', method, path: concrete }), `${method} ${path}`).toBe(expected);
        expect(allowedExternalRoute(method, concrete.slice('/api/'.length)), `${method} ${path}`).toBe(expected);
      }
    }
    for (const route of catalog.filter(({ path }) => !business.some((businessRoute) => businessRoute.path === path))) {
      const path = route.path.replace(':id', 'example').replace(':name', 'example');
      expect(isExternalCollabRequest({ type: 'external-collab:request', id: 'contract', method: route.method, path })).toBe(false);
      expect(allowedExternalRoute(route.method, path.slice('/api/'.length))).toBe(false);
    }
  });
});

