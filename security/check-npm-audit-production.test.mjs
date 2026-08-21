import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  buildLockProvenance,
  collectRuntimeEvidence,
  evaluatePolicy,
  parseJson,
  validateAuditPair,
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

function runScenario({ pkg, lock, report, fullReport = report, productionReport = report, evidence, accepted = [] }) {
  assert.ok(fullReport, 'fullReport or report is required');
  assert.ok(productionReport, 'productionReport or report is required');
  return evaluatePolicy({
    fullReport: structuredClone(fullReport),
    productionReport: structuredClone(productionReport),
    manifest: pkg,
    lockfile: lock,
    acceptedPolicy: policy(accepted),
    runtimeEvidence: evidence,
  });
}

function rootNode(version = '1.0.0', extra = {}) {
  return { version, ...extra };
}

function exactAcceptance(packageName, advisoryUrl = ADVISORY) {
  return [{ package: packageName, advisory: advisoryUrl, rationale: 'fixture exact reviewed advisory' }];
}

test('CASE 1: direct production runtime HIGH always fails', () => {
  const pkg = manifest({ 'direct-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/direct-risk': rootNode() });
  const report = audit({ 'direct-risk': vulnerability('direct-risk', { isDirect: true }) });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/direct-risk']) });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results[0].category, 'PRODUCTION_RUNTIME');
});

test('CASE 2: transitive production runtime HIGH always fails', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { dependencies: { 'transitive-risk': '1.0.0' } }),
    'node_modules/transitive-risk': rootNode(),
  });
  const report = audit({ 'transitive-risk': vulnerability('transitive-risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/transitive-risk']) });
  assert.equal(outcome.ok, false);
  assert.match(outcome.blocking.join('\n'), /production-runtime high/);
});

test('CASE 3: optional runtime HIGH always fails', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { optionalDependencies: { 'optional-risk': '1.0.0' } }),
    'node_modules/optional-risk': rootNode('1.0.0', { optional: true }),
  });
  const report = audit({ 'optional-risk': vulnerability('optional-risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/optional-risk']) });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results[0].category, 'PRODUCTION_RUNTIME');
});

test('CASE 4: peer runtime HIGH always fails', () => {
  const pkg = manifest({ parent: '1.0.0', 'peer-risk': '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { peerDependencies: { 'peer-risk': '1.0.0' } }),
    'node_modules/peer-risk': rootNode('1.0.0', { peer: true }),
  });
  const report = audit({ 'peer-risk': vulnerability('peer-risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/peer-risk']) });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results[0].category, 'PRODUCTION_RUNTIME');
});

test('CASE 5: dev-only HIGH remains visible and nonblocking when absent from runtime', () => {
  const pkg = manifest({}, { 'dev-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/dev-risk': rootNode('1.0.0', { dev: true }) });
  const report = audit({ 'dev-risk': vulnerability('dev-risk', { isDirect: true }) });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence() });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].category, 'BUILD_TOOLING');
});

test('CASE 6: devOptional optional-peer-retained HIGH remains visible and nonblocking when non-runtime', () => {
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

test('CASE 7 / Mutation D: devOptional package becomes blocking when runtime evidence contains it', () => {
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

test('CASE 8 / Mutations A+C+D: full-only dev HIGH with runtime evidence is classified runtime and fails', () => {
  const pkg = manifest({}, { 'bundled-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/bundled-risk': rootNode('1.0.0', { dev: true }) });
  const fullReport = audit({ 'bundled-risk': vulnerability('bundled-risk', { isDirect: true }) });
  const productionReport = audit({});
  const outcome = runScenario({
    pkg,
    lock,
    fullReport,
    productionReport,
    evidence: runtimeEvidence(['node_modules/bundled-risk']),
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].category, 'PRODUCTION_RUNTIME');
  assert.equal(outcome.results[0].presentInProductionAudit, false);
});

test('CASE 9: full-only dev HIGH without runtime evidence remains visible nonblocking tooling', () => {
  const pkg = manifest({}, { 'dev-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/dev-risk': rootNode('1.0.0', { dev: true }) });
  const fullReport = audit({ 'dev-risk': vulnerability('dev-risk', { isDirect: true }) });
  const productionReport = audit({});
  const outcome = runScenario({ pkg, lock, fullReport, productionReport, evidence: runtimeEvidence() });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].category, 'BUILD_TOOLING');
  assert.equal(outcome.results[0].presentInProductionAudit, false);
});

test('CASE 10 / Mutation B: exact accepted transitive runtime HIGH still fails', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { dependencies: { risk: '1.0.0' } }),
    'node_modules/risk': rootNode(),
  });
  const report = audit({ risk: vulnerability('risk') });
  const outcome = runScenario({
    pkg,
    lock,
    report,
    evidence: runtimeEvidence(['node_modules/risk']),
    accepted: exactAcceptance('risk'),
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reviewed.length, 0);
});

test('CASE 11 / Mutation B: exact accepted optional runtime HIGH still fails', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { optionalDependencies: { risk: '1.0.0' } }),
    'node_modules/risk': rootNode('1.0.0', { optional: true }),
  });
  const report = audit({ risk: vulnerability('risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/risk']), accepted: exactAcceptance('risk') });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reviewed.length, 0);
});

test('CASE 12 / Mutation B: exact accepted peer runtime HIGH still fails', () => {
  const pkg = manifest({ parent: '1.0.0', risk: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { peerDependencies: { risk: '1.0.0' } }),
    'node_modules/risk': rootNode('1.0.0', { peer: true }),
  });
  const report = audit({ risk: vulnerability('risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/risk']), accepted: exactAcceptance('risk') });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reviewed.length, 0);
});

test('CASE 13: exact accepted tooling-only HIGH remains nonblocking and is logged as reviewed tooling', () => {
  const pkg = manifest({}, { risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode('1.0.0', { dev: true }) });
  const fullReport = audit({ risk: vulnerability('risk', { isDirect: true }) });
  const productionReport = audit({});
  const outcome = runScenario({ pkg, lock, fullReport, productionReport, evidence: runtimeEvidence(), accepted: exactAcceptance('risk') });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.results[0].category, 'BUILD_TOOLING');
  assert.equal(outcome.reviewed.length, 1);
  assert.match(outcome.reviewed[0], /reviewed non-runtime BUILD_TOOLING/);
});

test('CASE 14: unaccepted runtime HIGH fails', () => {
  const pkg = manifest({ parent: '1.0.0' });
  const lock = lockfile(pkg, {
    'node_modules/parent': rootNode('1.0.0', { dependencies: { risk: '1.0.0' } }),
    'node_modules/risk': rootNode(),
  });
  const report = audit({ risk: vulnerability('risk') });
  const outcome = runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/risk']) });
  assert.equal(outcome.ok, false);
});

test('CASE 15: HIGH without reviewable advisory metadata fails closed', () => {
  const pkg = manifest({ risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode() });
  const report = audit({ risk: vulnerability('risk', { via: [] }) });
  assert.throws(() => runScenario({ pkg, lock, report, evidence: runtimeEvidence(['node_modules/risk']) }), /no reviewable high\/critical advisory leaf/);
});

test('CASE 16: malformed audit JSON fails closed', () => {
  assert.throws(() => parseJson('{broken', 'fixture audit'), /invalid JSON/);
});

test('CASE 17: npm audit error response fails closed', () => {
  assert.throws(() => validateAuditReport({ auditReportVersion: 2, error: { code: 'EAI_AGAIN' } }, 'fixture audit'), /audit error response detected/);
});

test('CASE 18 / Mutation G: omit-dev advisory absent from full audit fails pair validation', () => {
  const pkg = manifest({}, { risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode('1.0.0', { dev: true }) });
  const fullReport = audit({});
  const productionReport = audit({ risk: vulnerability('risk') });
  assert.throws(() => runScenario({ pkg, lock, fullReport, productionReport, evidence: runtimeEvidence() }), /production advisory .* is absent from full audit/);
});

test('CASE 19: legitimately divergent full and omit-dev reports are supported', () => {
  const fullReport = audit({ risk: vulnerability('risk') });
  const productionReport = audit({});
  validateAuditReport(fullReport);
  validateAuditReport(productionReport);
  const pair = validateAuditPair(fullReport, productionReport);
  assert.equal(pair.fullLeaves.size, 1);
  assert.equal(pair.prodLeaves.size, 0);
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

test('CASE 20: missing runtime traces fails closed', () => {
  const pkg = manifest({ risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode() });
  validateManifest(pkg);
  validateLockfile(lock, pkg);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studyflash-missing-traces-'));
  const nextDir = path.join(root, '.next');
  fs.mkdirSync(nextDir, { recursive: true });
  assert.throws(() => collectRuntimeEvidence(nextDir, lock), /missing \.next\/next-server\.js\.nft\.json/);
});

test('CASE 21: malformed runtime trace fails closed', () => {
  const pkg = manifest({ risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode() });
  const fixture = fakeNextEvidence({ pkg, lock, tracePackages: ['risk'] });
  const routeTrace = path.join(fixture.nextDir, 'server', 'app', 'probe', 'route.js.nft.json');
  fs.writeFileSync(routeTrace, '{not-json');
  assert.throws(() => collectRuntimeEvidence(fixture.nextDir, lock), /invalid JSON/);
});

test('CASE 22: scoped package path is normalized to complete @scope/package identity', () => {
  const pkg = manifest({ '@scope/risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/@scope/risk': rootNode() });
  const fixture = fakeNextEvidence({
    pkg,
    lock,
    tracePackages: ['@scope/risk'],
    bundleText: '/workspace/node_modules/@scope/risk/index.js',
  });
  const evidence = collectRuntimeEvidence(fixture.nextDir, lock);
  assert.ok(evidence.runtimeNodes.has('node_modules/@scope/risk'));
  assert.ok(evidence.observedBundlePackages.has('@scope/risk'));
});

test('CASE 23: bundled package runtime detection works when package is absent from nft', () => {
  const pkg = manifest({}, { 'bundled-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/bundled-risk': rootNode('1.0.0', { dev: true }) });
  const fixture = fakeNextEvidence({ pkg, lock, tracePackages: [], bundleText: '/workspace/node_modules/bundled-risk/index.js' });
  const evidence = collectRuntimeEvidence(fixture.nextDir, lock);
  assert.equal(evidence.traceRuntimeNodes.has('node_modules/bundled-risk'), false);
  assert.equal(evidence.bundleRuntimeNodes.has('node_modules/bundled-risk'), true);
});

test('CASE 24 / Mutations A+C: bundled full-only advisory omitted by production audit still fails', () => {
  const pkg = manifest({}, { 'bundled-risk': '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/bundled-risk': rootNode('1.0.0', { dev: true }) });
  const fixture = fakeNextEvidence({ pkg, lock, tracePackages: [], bundleText: '/workspace/node_modules/bundled-risk/index.js' });
  const evidence = collectRuntimeEvidence(fixture.nextDir, lock);
  const fullReport = audit({ 'bundled-risk': vulnerability('bundled-risk', { isDirect: true }) });
  const productionReport = audit({});
  const outcome = runScenario({ pkg, lock, fullReport, productionReport, evidence });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results[0].category, 'PRODUCTION_RUNTIME');
  assert.equal(outcome.results[0].presentInProductionAudit, false);
});

test('CASE 25 / Mutation F: ambiguous runtime package attribution is UNRESOLVED and acceptance cannot bypass it', () => {
  const pkg = manifest({}, { risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode('1.0.0', { dev: true }) });
  const report = audit({ risk: vulnerability('risk', { isDirect: true }) });
  const outcome = runScenario({
    pkg,
    lock,
    report,
    evidence: runtimeEvidence([], ['risk']),
    accepted: exactAcceptance('risk'),
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results[0].category, 'UNRESOLVED');
  assert.equal(outcome.reviewed.length, 0);
});

test('Mutation E: acceptance remains exact package + advisory pair for non-runtime reviewed tooling', () => {
  const pkg = manifest({}, { risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode('1.0.0', { dev: true }) });
  const fullReport = audit({ risk: vulnerability('risk', { via: [advisory('risk', OTHER_ADVISORY)], isDirect: true }) });
  const productionReport = audit({});
  const outcome = runScenario({
    pkg,
    lock,
    fullReport,
    productionReport,
    evidence: runtimeEvidence(),
    accepted: exactAcceptance('risk', ADVISORY),
  });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.results[0].category, 'BUILD_TOOLING');
  assert.equal(outcome.reviewed.length, 0);
});

test('audit-pair metadata mismatch: omit-dev audited nodes must exist in the full vulnerability node set', () => {
  const fullReport = audit({ risk: vulnerability('risk', { nodes: ['node_modules/risk'] }) });
  const productionReport = audit({ risk: vulnerability('risk', { nodes: ['node_modules/risk-prod-only'] }) });
  assert.throws(() => validateAuditPair(fullReport, productionReport), /omit-dev node node_modules\/risk-prod-only .* absent from full audit vulnerability nodes/);
});

test('metavulnerability containers resolve to concrete advisory leaves using full-audit nodes', () => {
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
  const fullReport = audit({
    cli: vulnerability('cli', { isDirect: true, via: ['config'], nodes: ['node_modules/cli'] }),
    config: vulnerability('config', { via: ['leaf-risk'], nodes: ['node_modules/config'], effects: ['cli'] }),
    'leaf-risk': vulnerability('leaf-risk', { nodes: ['node_modules/leaf-risk'], effects: ['config'] }),
  });
  const productionReport = audit({});
  const outcome = runScenario({ pkg, lock, fullReport, productionReport, evidence: runtimeEvidence(['node_modules/client']) });
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

test('unsupported auditReportVersion fails closed', () => {
  const report = audit({});
  report.auditReportVersion = 1;
  assert.throws(() => validateAuditReport(report), /unsupported or missing auditReportVersion/);
});

test('inconsistent audit metadata totals fail closed', () => {
  const report = audit({ risk: vulnerability('risk') });
  report.metadata.vulnerabilities.total += 1;
  assert.throws(() => validateAuditReport(report), /metadata vulnerability total is inconsistent/);
});

test('missing lockfile node for a full-audit advisory fails closed', () => {
  const pkg = manifest({}, { risk: '1.0.0' });
  const lock = lockfile(pkg, { 'node_modules/risk': rootNode('1.0.0', { dev: true }) });
  delete lock.packages['node_modules/risk'];
  const fullReport = audit({ risk: vulnerability('risk') });
  const productionReport = audit({});
  assert.throws(() => runScenario({ pkg, lock, fullReport, productionReport, evidence: runtimeEvidence() }), /missing root dev dependency node risk|audited node .* missing from package-lock/);
});

test('invalid vulnerability via reference fails closed', () => {
  const report = audit({ risk: vulnerability('risk', { via: ['missing-risk'] }) });
  assert.throws(() => validateAuditReport(report), /references missing vulnerability missing-risk/);
});

const runRealNextProbe = process.env.STUDYFLASH_NEXT_RUNTIME_PROBE === '1';
test('real Next.js Webpack probe: full-only vulnerable bundled server package omitted by omit-dev still fails', { skip: !runRealNextProbe }, () => {
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
  fs.writeFileSync(path.join(root, 'next.config.mjs'), `export default { transpilePackages: ['${probePackage}'] };\n`);
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

  const pkg = manifest({}, { [probePackage]: '1.0.0' });
  const lock = lockfile(pkg, { [`node_modules/${probePackage}`]: rootNode('1.0.0', { dev: true }) });
  const evidence = collectRuntimeEvidence(path.join(root, '.next'), lock);
  assert.equal(evidence.traceRuntimeNodes.has(`node_modules/${probePackage}`), false, 'probe package unexpectedly remained external in nft; bundled-only proof was not established');
  assert.equal(evidence.bundleRuntimeNodes.has(`node_modules/${probePackage}`), true, 'bundled package escaped Webpack bundle evidence');

  const fullReport = audit({ [probePackage]: vulnerability(probePackage, { isDirect: true }) });
  const productionReport = audit({});
  const outcome = runScenario({ pkg, lock, fullReport, productionReport, evidence });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results[0].category, 'PRODUCTION_RUNTIME');
  assert.equal(outcome.results[0].presentInProductionAudit, false);
});
