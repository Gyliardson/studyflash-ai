import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  DependencySecurityError,
  buildLockProvenance,
  collectRuntimeEvidence,
  evaluatePolicy,
  parseJson,
  validateAuditReport,
  validateLockfile,
  validateManifest,
} from './check-npm-audit-production.mjs';

const ADVISORY = 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc';
const OTHER_ADVISORY = 'https://github.com/advisories/GHSA-dddd-eeee-ffff';

function manifest(dependencies = {}, devDependencies = {}) {
  return { name: 'fixture', version: '1.0.0', private: true, dependencies, devDependencies };
}

function lockfile(pkg, packages = {}) {
  return {
    name: 'fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: 'fixture',
        version: '1.0.0',
        dependencies: { ...(pkg.dependencies ?? {}) },
        devDependencies: { ...(pkg.devDependencies ?? {}) },
      },
      ...packages,
    },
  };
}

function audit(entries) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const entry of Object.values(entries)) counts[entry.severity] += 1;
  return {
    auditReportVersion: 2,
    vulnerabilities: entries,
    metadata: {
      vulnerabilities: { ...counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) },
      dependencies: { prod: 1, dev: 1, optional: 0, peer: 0, peerOptional: 0, total: 2 },
    },
  };
}

function advisory(packageName, url = ADVISORY, severity = 'high') {
  return {
    source: 1,
    name: packageName,
    dependency: packageName,
    title: `${packageName} fixture advisory`,
    url,
    severity,
    cwe: ['CWE-400'],
    cvss: { score: 7.5, vectorString: null },
    range: '<2.0.0',
  };
}

function vulnerability(packageName, { severity = 'high', via = [advisory(packageName)], isDirect = false, nodes = [`node_modules/${packageName}`], effects = [] } = {}) {
  return {
    name: packageName,
    severity,
    isDirect,
    via,
    effects,
    range: '<2.0.0',
    nodes,
    fixAvailable: true,
  };
}

function runtimeEvidence(runtimeNodes = [], ambiguousBundlePackages = []) {
  return {
    runtimeNodes: new Set(runtimeNodes),
    traceRuntimeNodes: new Set(runtimeNodes),
    bundleRuntimeNodes: new Set(),
    ambiguousBundlePackages: new Set(ambiguousBundlePackages),
    observedBundlePackages: new Set(),
    traceFiles: ['fixture.nft.json'],
    serverWebpackFiles: ['fixture.pack'],
  };
}

function policy(accepted = []) {
  return { version: 1, accepted };
}

function runScenario({ pkg, lock, report, evidence, accepted = [] }) {
  const fullReport = structuredClone(report);
  const productionReport = structuredClone(report);
  return evaluatePolicy({
    fullReport,
    productionReport,
    manifest: pkg,
    lockfile: lock,
    acceptedPolicy: policy(accepted),
    runtimeEvidence: evidence,
  });
}

function rootNode(version = '1.0.0', extra = {}) {
  return { version, ...extra };
}

test('CASE 1 / Mutation A: direct root production HIGH runtime reachable fails closed', () => {
  const pkg = manifest({ 'direct-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/direct-risk': rootNode() });
  const report = audit({ 'direct-risk': vulnerability('direct-risk', { isDirect: true }) });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/direct-risk']) });
  assert.equal(outcome.ok, false);
  assert.match(outcome.blocking.join('\n'), /direct root production-runtime high/);
});

test('CASE 2: transitive HIGH runtime reachable fails when unaccepted', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { dependencies: { 'transitive-risk': '1.0.0' } }),
    'node_modules/transitive-risk': rootNode(),
  });
  const report = audit({ 'transitive-risk': vulnerability('transitive-risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/transitive-risk']) });
  assert.equal(outcome.ok, false);
  assert.match(outcome.blocking.join('\n'), /unaccepted production-runtime high/);
});

test('CASE 3 / Mutation E: optional dependency HIGH runtime reachable fails', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { optionalDependencies: { 'optional-risk': '1.0.0' } }),
    'node_modules/optional-risk': rootNode('1.0.0', { optional: true }),
  });
  const report = audit({ 'optional-risk': vulnerability('optional-risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/optional-risk']) });
  assert.equal(outcome.ok, false);
});

test('CASE 4 / Mutation E: peer dependency HIGH runtime reachable fails', () => {
  const pkg = manifest({ parent: '1.0.0', 'peer-risk': '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { peerDependencies: { 'peer-risk': '1.0.0' } }),
    'node_modules/peer-risk': rootNode('1.0.0', { peer: true }),
  });
  const report = audit({ 'peer-risk': vulnerability('peer-risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/peer-risk']) });
  assert.equal(outcome.ok, false);
});

test('CASE 5 / Mutation B: root devDependency HIGH not runtime stays tooling even when npm isDirect=true', () => {
  const pkg = manifest({}, { 'dev-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/dev-risk': rootNode('1.0.0', { dev: true }) });
  const report = audit({ 'dev-risk': vulnerability('dev-risk', { isDirect: true }) });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence() });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.results[0].category, 'BUILD_TOOLING');
});

test('CASE 6: devOptional optional-peer-retained HIGH remains visible but is not a production-runtime blocker', () => {
  const pkg = manifest({ host: '1.0.0' }, { 'retained-risk': '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/host': rootNode('1.0.0', {
      peerDependencies: { 'retained-risk': '1.0.0' },
      peerDependenciesMeta: { 'retained-risk': { optional: true } },
    }),
    'node_modules/retained-risk': rootNode('1.0.0', { devOptional: true }),
  });
  const report = audit({ 'retained-risk': vulnerability('retained-risk', { isDirect: true }) });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence() });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.results[0].category, 'OPTIONAL_PEER_RETAINED_TOOLING');
});

test('CASE 7: the same devOptional-style package becomes blocking when runtime evidence contains it', () => {
  const pkg = manifest({ host: '1.0.0' }, { 'retained-risk': '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/host': rootNode('1.0.0', {
      peerDependencies: { 'retained-risk': '1.0.0' },
      peerDependenciesMeta: { 'retained-risk': { optional: true } },
    }),
    'node_modules/retained-risk': rootNode('1.0.0', { devOptional: true }),
  });
  const report = audit({ 'retained-risk': vulnerability('retained-risk', { isDirect: true }) });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/retained-risk']) });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results[0].category, 'PRODUCTION_RUNTIME');
});

test('CASE 8: runtime HIGH without reviewable advisory metadata fails closed', () => {
  const pkg = manifest({ risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode() });
  const report = audit({ risk: vulnerability('risk', { via: [] }) });
  assert.throws(
    () => runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/risk']) }),
    /no reviewable high\/critical advisory leaf/,
  );
});

test('CASE 9: exact existing accepted runtime transitive advisory preserves reviewed behavior', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { dependencies: { risk: '1.0.0' } }),
    'node_modules/risk': rootNode(),
  });
  const report = audit({ risk: vulnerability('risk') });
  const accepted = [{ package: 'risk', advisory: ADVISORY, rationale: 'fixture exact reviewed advisory' }];
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/risk']), accepted });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.reviewed.length, 1);
});

test('CASE 10: unaccepted runtime advisory fails', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { dependencies: { risk: '1.0.0' } }),
    'node_modules/risk': rootNode(),
  });
  const report = audit({ risk: vulnerability('risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/risk']) });
  assert.equal(outcome.ok, false);
});

test('CASE 11: malformed audit JSON fails closed', () => {
  assert.throws(() => parseJson('{broken', 'fixture audit'), /invalid JSON/);
});

test('CASE 12 / Mutation D: valid JSON npm audit error response fails closed', () => {
  assert.throws(
    () => validateAuditReport({ auditReportVersion: 2, error: { code: 'EAI_AGAIN' } }, 'fixture audit'),
    /audit error response detected/,
  );
});

test('CASE 13: missing vulnerabilities schema fails closed', () => {
  assert.throws(
    () => validateAuditReport({ auditReportVersion: 2, metadata: { vulnerabilities: {} } }, 'fixture audit'),
    /missing vulnerabilities object/,
  );
});

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function fakeNextEvidence({ pkg, lock, tracePackages = [], bundleText = '' }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studyflash-runtime-evidence-'));
  const nextDir = path.join(root, '.next');
  fs.mkdirSync(nextDir, { recursive: true });
  const targetFor = (name) => path.join(root, 'node_modules', ...name.split('/'), 'index.js');

  const nextServerTrace = path.join(nextDir, 'next-server.js.nft.json');
  writeJson(nextServerTrace, {
    version: 1,
    files: tracePackages.map((name) => path.relative(path.dirname(nextServerTrace), targetFor(name))),
  });

  const appOutput = 'app/probe/route.js';
  writeJson(path.join(nextDir, 'server', 'app-paths-manifest.json'), { '/probe': appOutput });
  const routeTrace = path.join(nextDir, 'server', `${appOutput}.nft.json`);
  writeJson(routeTrace, {
    version: 1,
    files: tracePackages.map((name) => path.relative(path.dirname(routeTrace), targetFor(name))),
  });

  const packPath = path.join(nextDir, 'cache', 'webpack', 'server-production', 'index.pack');
  fs.mkdirSync(path.dirname(packPath), { recursive: true });
  fs.writeFileSync(packPath, bundleText || `Compilation/modules|${targetFor(Object.keys(pkg.dependencies ?? {})[0] ?? Object.keys(pkg.devDependencies ?? {})[0])}`);

  return { root, nextDir, lock };
}

test('CASE 14 / Mutation C: missing runtime traces fails closed', () => {
  const pkg = manifest({ risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode() });
  validateManifest(pkg);
  validateLockfile(lock, pkg);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studyflash-missing-traces-'));
  const nextDir = path.join(root, '.next');
  fs.mkdirSync(nextDir, { recursive: true });
  assert.throws(() => collectRuntimeEvidence(nextDir, lock), /missing \.next\/next-server\.js\.nft\.json/);
});

test('CASE 15: malformed trace fails closed', () => {
  const pkg = manifest({ risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode() });
  const fixture = fakeNextEvidence({ pkg, lock, tracePackages: ['risk'] });
  const routeTrace = path.join(fixture.nextDir, 'server', 'app', 'probe', 'route.js.nft.json');
  fs.writeFileSync(routeTrace, '{not-json');
  assert.throws(() => collectRuntimeEvidence(fixture.nextDir, lock), /invalid JSON/);
});

test('CASE 16: scoped package path is normalized to the complete @scope/package identity', () => {
  const pkg = manifest({ '@scope/risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/@scope/risk': rootNode() });
  const fixture = fakeNextEvidence({
    pkg,
    lock,
    tracePackages: ['@scope/risk'],
    bundleText: `/workspace/node_modules/@scope/risk/index.js`,
  });
  const evidence = collectRuntimeEvidence(fixture.nextDir, lock);
  assert.ok(evidence.runtimeNodes.has('node_modules/@scope/risk'));
  assert.ok(evidence.observedBundlePackages.has('@scope/risk'));
});

test('BUNDLED-CODE RULE / Mutation A: vulnerable server package absent from nft still blocks when Webpack bundle evidence contains it', () => {
  const pkg = manifest({}, { 'bundled-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/bundled-risk': rootNode('1.0.0', { dev: true }) });
  const fixture = fakeNextEvidence({
    pkg,
    lock,
    tracePackages: [],
    bundleText: `/workspace/node_modules/bundled-risk/index.js`,
  });
  const evidence = collectRuntimeEvidence(fixture.nextDir, lock);
  assert.equal(evidence.traceRuntimeNodes.has('node_modules/bundled-risk'), false);
  assert.equal(evidence.bundleRuntimeNodes.has('node_modules/bundled-risk'), true);
  const report = audit({ 'bundled-risk': vulnerability('bundled-risk', { isDirect: true }) });
  const outcome = runScenario({ pkg, lock, report, evidence });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results[0].category, 'PRODUCTION_RUNTIME');
});

test('Mutation F: package-only advisory acceptance cannot replace exact package + advisory URL matching', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { dependencies: { risk: '1.0.0' } }),
    'node_modules/risk': rootNode(),
  });
  const report = audit({ risk: vulnerability('risk', { via: [advisory('risk', OTHER_ADVISORY)] }) });
  const accepted = [{ package: 'risk', advisory: ADVISORY, rationale: 'same package but different advisory' }];
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/risk']), accepted });
  assert.equal(outcome.ok, false);
});

test('metavulnerability containers resolve to the concrete advisory leaf instead of inheriting npm isDirect semantics', () => {
  const pkg = manifest({ client: '1.0.0' }, { cli: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/client': rootNode('1.0.0', {
      peerDependencies: { cli: '1.0.0' },
      peerDependenciesMeta: { cli: { optional: true } },
    }),
    'node_modules/cli': rootNode('1.0.0', { devOptional: true, dependencies: { config: '1.0.0' } }),
    'node_modules/config': rootNode('1.0.0', { devOptional: true, dependencies: { 'leaf-risk': '1.0.0' } }),
    'node_modules/leaf-risk': rootNode('1.0.0', { devOptional: true }),
  });
  const report = audit({
    cli: vulnerability('cli', { isDirect: true, via: ['config'], nodes: ['node_modules/cli'] }),
    config: vulnerability('config', { via: ['leaf-risk'], nodes: ['node_modules/config'], effects: ['cli'] }),
    'leaf-risk': vulnerability('leaf-risk', { nodes: ['node_modules/leaf-risk'], effects: ['config'] }),
  });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/client']) });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].package, 'leaf-risk');
  assert.equal(outcome.results[0].category, 'OPTIONAL_PEER_RETAINED_TOOLING');
});

test('provenance does not treat ordinary optional dependencies as optional-peer tooling', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { optionalDependencies: { risk: '1.0.0' } }),
    'node_modules/risk': rootNode('1.0.0', { optional: true }),
  });
  const { provenance } = buildLockProvenance(lock, pkg);
  assert.equal(provenance.get('node_modules/risk').prodWithoutOptionalPeer, true);
  assert.equal(provenance.get('node_modules/risk').prodWithOptionalPeer, false);
});

const runRealNextProbe = process.env.STUDYFLASH_NEXT_RUNTIME_PROBE === '1';
test('real Next.js Webpack probe proves a genuinely bundled server package is detected even when absent from nft', { skip: !runRealNextProbe }, () => {
  const frontendDir = process.env.STUDYFLASH_FRONTEND_DIR;
  assert.ok(frontendDir, 'STUDYFLASH_FRONTEND_DIR is required for the real Next runtime probe');
  const nextBin = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  assert.ok(fs.existsSync(nextBin), `Next.js binary not found at ${nextBin}`);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studyflash-next-bundle-probe-'));
  const nodeModules = path.join(root, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  for (const dependency of ['next', 'react', 'react-dom']) {
    fs.symlinkSync(path.join(frontendDir, 'node_modules', dependency), path.join(nodeModules, dependency), 'dir');
  }

  const probePackage = 'studyflash-runtime-bundle-probe';
  const probePackageDir = path.join(nodeModules, probePackage);
  fs.mkdirSync(probePackageDir, { recursive: true });
  writeJson(path.join(probePackageDir, 'package.json'), {
    name: probePackage,
    version: '1.0.0',
    type: 'module',
    exports: './index.js',
  });
  fs.writeFileSync(path.join(probePackageDir, 'index.js'), 'export const marker = "studyflash-runtime-bundle-probe-marker";\n');

  writeJson(path.join(root, 'package.json'), {
    name: 'studyflash-next-bundle-probe-app',
    version: '1.0.0',
    private: true,
    dependencies: {
      next: '16.3.0',
      react: '19.2.8',
      'react-dom': '19.2.8',
      [probePackage]: '1.0.0',
    },
  });
  fs.writeFileSync(
    path.join(root, 'next.config.mjs'),
    `export default { transpilePackages: ['${probePackage}'] };\n`,
  );
  const routeDir = path.join(root, 'app', 'api', 'probe');
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'route.js'), `import { marker } from '${probePackage}';\nexport async function GET() { return Response.json({ marker }); }\n`);

  const build = spawnSync(process.execPath, [nextBin, 'build', '--webpack'], {
    cwd: root,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    encoding: 'utf8',
    timeout: 180_000,
  });
  assert.equal(build.status, 0, `Next probe build failed:\n${build.stdout}\n${build.stderr}`);

  const pkg = manifest({ [probePackage]: '1.0.0' });
  const lock = lockfile(pkg, { [`node_modules/${probePackage}`]: rootNode() });
  const evidence = collectRuntimeEvidence(path.join(root, '.next'), lock);
  assert.equal(evidence.traceRuntimeNodes.has(`node_modules/${probePackage}`), false, 'probe package unexpectedly remained external in nft; bundled-only proof was not established');
  assert.equal(evidence.bundleRuntimeNodes.has(`node_modules/${probePackage}`), true, 'bundled package escaped Webpack bundle evidence');
});
