import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_SEVERITIES = new Set(['high', 'critical']);
const VALID_SEVERITIES = new Set(['info', 'low', 'moderate', 'high', 'critical']);

export class DependencySecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DependencySecurityError';
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new DependencySecurityError(message);
}

export function parseJson(text, label = 'JSON') {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new DependencySecurityError(`${label}: invalid JSON (${error.message})`);
  }
}

function readJson(filePath, label) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new DependencySecurityError(`${label}: cannot read ${filePath} (${error.message})`);
  }
  return parseJson(text, label);
}

export function validateAuditReport(report, label = 'npm audit report') {
  assert(isPlainObject(report), `${label}: expected an object`);
  assert(!Object.hasOwn(report, 'error') && !Object.hasOwn(report, 'errors'), `${label}: npm audit error response detected`);
  assert(report.auditReportVersion === 2, `${label}: unsupported or missing auditReportVersion`);
  assert(Object.hasOwn(report, 'vulnerabilities') && isPlainObject(report.vulnerabilities), `${label}: missing vulnerabilities object`);
  assert(isPlainObject(report.metadata), `${label}: missing metadata object`);
  assert(isPlainObject(report.metadata.vulnerabilities), `${label}: missing metadata.vulnerabilities`);

  const counts = report.metadata.vulnerabilities;
  let computedTotal = 0;
  for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
    assert(Number.isInteger(counts[severity]) && counts[severity] >= 0, `${label}: metadata.vulnerabilities.${severity} must be a non-negative integer`);
    computedTotal += counts[severity];
  }
  assert(Number.isInteger(counts.total) && counts.total >= 0, `${label}: metadata.vulnerabilities.total must be a non-negative integer`);
  assert(counts.total === computedTotal, `${label}: metadata vulnerability total is inconsistent`);

  for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities)) {
    assert(isPlainObject(vulnerability), `${label}: ${packageName} vulnerability metadata must be an object`);
    assert(vulnerability.name === packageName, `${label}: ${packageName} vulnerability name mismatch`);
    assert(VALID_SEVERITIES.has(vulnerability.severity), `${label}: ${packageName} has invalid severity`);
    assert(typeof vulnerability.isDirect === 'boolean', `${label}: ${packageName} isDirect must be boolean`);
    assert(Array.isArray(vulnerability.via), `${label}: ${packageName}.via must be an array`);
    assert(Array.isArray(vulnerability.effects), `${label}: ${packageName}.effects must be an array`);
    assert(Array.isArray(vulnerability.nodes) && vulnerability.nodes.length > 0, `${label}: ${packageName}.nodes must be a non-empty array`);
    for (const node of vulnerability.nodes) {
      assert(typeof node === 'string' && node.startsWith('node_modules/'), `${label}: ${packageName} has an invalid audited node path`);
    }

    for (const via of vulnerability.via) {
      if (typeof via === 'string') {
        assert(via.length > 0, `${label}: ${packageName} has an empty via reference`);
        assert(Object.hasOwn(report.vulnerabilities, via), `${label}: ${packageName} references missing vulnerability ${via}`);
        continue;
      }

      assert(isPlainObject(via), `${label}: ${packageName} has structurally invalid advisory metadata`);
      assert(typeof via.name === 'string' && via.name.length > 0, `${label}: ${packageName} advisory is missing name`);
      assert(typeof via.dependency === 'string' && via.dependency.length > 0, `${label}: ${packageName} advisory is missing dependency`);
      assert(VALID_SEVERITIES.has(via.severity), `${label}: ${packageName} advisory has invalid severity`);
      if (FAIL_SEVERITIES.has(via.severity)) {
        assert(typeof via.url === 'string' && via.url.length > 0, `${label}: ${packageName} high/critical advisory is missing URL`);
      }
    }
  }

  return report;
}

export function validateManifest(manifest, label = 'package.json') {
  assert(isPlainObject(manifest), `${label}: expected an object`);
  for (const field of ['dependencies', 'devDependencies']) {
    if (manifest[field] === undefined) continue;
    assert(isPlainObject(manifest[field]), `${label}: ${field} must be an object`);
    for (const [name, spec] of Object.entries(manifest[field])) {
      assert(typeof name === 'string' && name.length > 0 && typeof spec === 'string' && spec.length > 0, `${label}: invalid ${field} entry`);
    }
  }
  return manifest;
}

export function validateLockfile(lockfile, manifest, label = 'package-lock.json') {
  assert(isPlainObject(lockfile), `${label}: expected an object`);
  assert(lockfile.lockfileVersion === 3, `${label}: expected lockfileVersion 3`);
  assert(isPlainObject(lockfile.packages), `${label}: missing packages object`);
  assert(isPlainObject(lockfile.packages['']), `${label}: missing root package node`);

  const root = lockfile.packages[''];
  for (const field of ['dependencies', 'devDependencies']) {
    const manifestEntries = manifest[field] ?? {};
    const lockEntries = root[field] ?? {};
    assert(isPlainObject(lockEntries), `${label}: root ${field} must be an object`);
    const manifestNames = Object.keys(manifestEntries).sort();
    const lockNames = Object.keys(lockEntries).sort();
    assert(JSON.stringify(manifestNames) === JSON.stringify(lockNames), `${label}: root ${field} names differ from package.json`);
    for (const name of manifestNames) {
      assert(lockEntries[name] === manifestEntries[name], `${label}: root ${field}.${name} differs from package.json`);
    }
  }

  for (const [key, entry] of Object.entries(lockfile.packages)) {
    assert(isPlainObject(entry), `${label}: package node ${key || '<root>'} must be an object`);
  }

  return lockfile;
}

export function validateAcceptedPolicy(policy, label = 'accepted advisory policy') {
  assert(isPlainObject(policy), `${label}: expected an object`);
  assert(policy.version === 1, `${label}: unsupported or missing version`);
  assert(Array.isArray(policy.accepted), `${label}: accepted must be an array`);
  const pairs = new Set();
  for (const entry of policy.accepted) {
    assert(isPlainObject(entry), `${label}: accepted entry must be an object`);
    assert(typeof entry.package === 'string' && entry.package.length > 0, `${label}: accepted entry missing package`);
    assert(typeof entry.advisory === 'string' && entry.advisory.length > 0, `${label}: accepted entry missing advisory`);
    assert(typeof entry.rationale === 'string' && entry.rationale.length > 0, `${label}: accepted entry missing rationale`);
    const key = `${entry.package}|${entry.advisory}`;
    assert(!pairs.has(key), `${label}: duplicate exact package/advisory pair ${key}`);
    pairs.add(key);
  }
  return policy;
}

function parentPackageKey(key) {
  if (!key || !key.includes('/node_modules/')) return '';
  return key.slice(0, key.lastIndexOf('/node_modules/'));
}

export function packageNameFromLockKey(key) {
  assert(typeof key === 'string' && key.startsWith('node_modules/'), `invalid lockfile package key: ${key}`);
  const marker = key.lastIndexOf('node_modules/');
  const tail = key.slice(marker + 'node_modules/'.length);
  const parts = tail.split('/');
  assert(parts[0], `invalid lockfile package key: ${key}`);
  if (parts[0].startsWith('@')) {
    assert(parts[1], `invalid scoped lockfile package key: ${key}`);
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

function resolveDependencyNode(fromKey, dependencyName, packages) {
  let cursor = fromKey;
  while (true) {
    const candidate = cursor ? `${cursor}/node_modules/${dependencyName}` : `node_modules/${dependencyName}`;
    if (Object.hasOwn(packages, candidate)) return candidate;
    if (!cursor) break;
    cursor = parentPackageKey(cursor);
  }
  return null;
}

export function buildLockProvenance(lockfile, manifest) {
  const packages = lockfile.packages;
  const edges = new Map();

  for (const [key, entry] of Object.entries(packages)) {
    if (key === '') continue;
    const byName = new Map();

    for (const name of Object.keys(entry.dependencies ?? {})) byName.set(name, 'dependency');
    for (const name of Object.keys(entry.optionalDependencies ?? {})) byName.set(name, 'optionalDependency');
    for (const name of Object.keys(entry.peerDependencies ?? {})) {
      const isOptional = entry.peerDependenciesMeta?.[name]?.optional === true;
      byName.set(name, isOptional ? 'optionalPeer' : 'peer');
    }

    const nodeEdges = [];
    for (const [name, kind] of byName.entries()) {
      const target = resolveDependencyNode(key, name, packages);
      if (target) nodeEdges.push({ name, kind, target });
    }
    edges.set(key, nodeEdges);
  }

  const provenance = new Map();
  for (const key of Object.keys(packages)) {
    if (key === '') continue;
    provenance.set(key, {
      devReachable: false,
      prodWithoutOptionalPeer: false,
      prodWithOptionalPeer: false,
    });
  }

  const prodQueue = [];
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const node = resolveDependencyNode('', name, packages);
    assert(node, `package-lock.json: missing root production dependency node ${name}`);
    prodQueue.push([node, false]);
  }
  const seenProd = new Set();
  while (prodQueue.length > 0) {
    const [node, usedOptionalPeer] = prodQueue.shift();
    const stateKey = `${node}|${usedOptionalPeer ? '1' : '0'}`;
    if (seenProd.has(stateKey)) continue;
    seenProd.add(stateKey);
    const record = provenance.get(node);
    assert(record, `package-lock.json: missing provenance record for ${node}`);
    if (usedOptionalPeer) record.prodWithOptionalPeer = true;
    else record.prodWithoutOptionalPeer = true;
    for (const edge of edges.get(node) ?? []) {
      prodQueue.push([edge.target, usedOptionalPeer || edge.kind === 'optionalPeer']);
    }
  }

  const devQueue = [];
  for (const name of Object.keys(manifest.devDependencies ?? {})) {
    const node = resolveDependencyNode('', name, packages);
    assert(node, `package-lock.json: missing root dev dependency node ${name}`);
    devQueue.push(node);
  }
  const seenDev = new Set();
  while (devQueue.length > 0) {
    const node = devQueue.shift();
    if (seenDev.has(node)) continue;
    seenDev.add(node);
    const record = provenance.get(node);
    assert(record, `package-lock.json: missing dev provenance record for ${node}`);
    record.devReachable = true;
    for (const edge of edges.get(node) ?? []) devQueue.push(edge.target);
  }

  return { provenance, edges };
}

function listFilesRecursive(root) {
  const output = [];
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...listFilesRecursive(full));
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

function lockNodeForAbsolutePath(absPath, frontendRoot, sortedLockKeys) {
  const relative = path.relative(frontendRoot, absPath).replaceAll('\\', '/');
  if (relative.startsWith('../') || path.isAbsolute(relative)) return null;
  for (const key of sortedLockKeys) {
    if (relative === key || relative.startsWith(`${key}/`)) return key;
  }
  return null;
}

function extractPackageNames(text) {
  const packages = new Set();
  const regex = /node_modules[\\/](?:(@[^\\/\0\s!"'<>|?]+)[\\/]([^\\/\0\s!"'<>|?]+)|([^\\/\0\s!"'<>|?]+))/g;
  for (const match of text.matchAll(regex)) {
    const name = match[1] ? `${match[1]}/${match[2]}` : match[3];
    if (name && name !== '.pnpm') packages.add(name);
  }
  return packages;
}

function scanPackFileForPackageNames(filePath) {
  const names = new Set();
  const fd = fs.openSync(filePath, 'r');
  try {
    const chunk = Buffer.allocUnsafe(1024 * 1024);
    let carry = '';
    let position = 0;
    while (true) {
      const bytes = fs.readSync(fd, chunk, 0, chunk.length, position);
      if (bytes === 0) break;
      position += bytes;
      const text = carry + chunk.subarray(0, bytes).toString('latin1');
      for (const name of extractPackageNames(text)) names.add(name);
      carry = text.slice(-512);
    }
  } finally {
    fs.closeSync(fd);
  }
  return names;
}

export function collectRuntimeEvidence(nextDir, lockfile) {
  assert(fs.existsSync(nextDir) && fs.statSync(nextDir).isDirectory(), `runtime evidence: missing Next.js build directory ${nextDir}`);
  const frontendRoot = path.dirname(path.resolve(nextDir));
  const lockKeys = Object.keys(lockfile.packages).filter((key) => key !== '').sort((a, b) => b.length - a.length);
  const lockNodesByPackage = new Map();
  for (const key of lockKeys) {
    const name = packageNameFromLockKey(key);
    const nodes = lockNodesByPackage.get(name) ?? [];
    nodes.push(key);
    lockNodesByPackage.set(name, nodes);
  }

  const allNextFiles = listFilesRecursive(nextDir);
  const traceFiles = allNextFiles.filter((file) => {
    const relative = path.relative(nextDir, file).replaceAll('\\', '/');
    return relative === 'next-server.js.nft.json' || (relative.startsWith('server/') && relative.endsWith('.nft.json'));
  });
  assert(traceFiles.some((file) => path.relative(nextDir, file).replaceAll('\\', '/') === 'next-server.js.nft.json'), 'runtime evidence: missing .next/next-server.js.nft.json');
  const routeTraceFiles = traceFiles.filter((file) => path.relative(nextDir, file).replaceAll('\\', '/').startsWith('server/'));
  assert(routeTraceFiles.length > 0, 'runtime evidence: zero relevant server route traces');

  const appManifestPath = path.join(nextDir, 'server', 'app-paths-manifest.json');
  assert(fs.existsSync(appManifestPath), 'runtime evidence: missing server/app-paths-manifest.json');
  const appManifest = parseJson(fs.readFileSync(appManifestPath, 'utf8'), 'runtime evidence app-paths-manifest');
  assert(isPlainObject(appManifest) && Object.keys(appManifest).length > 0, 'runtime evidence: app-paths-manifest is empty or malformed');
  for (const outputPath of Object.values(appManifest)) {
    assert(typeof outputPath === 'string' && outputPath.endsWith('.js'), 'runtime evidence: app-paths-manifest contains an unexpected entry');
    const expectedTrace = path.join(nextDir, 'server', `${outputPath}.nft.json`);
    assert(fs.existsSync(expectedTrace), `runtime evidence: missing expected route trace ${path.relative(nextDir, expectedTrace)}`);
  }

  const traceRuntimeNodes = new Set();
  for (const traceFile of traceFiles) {
    const trace = parseJson(fs.readFileSync(traceFile, 'utf8'), `runtime trace ${path.relative(nextDir, traceFile)}`);
    assert(isPlainObject(trace), `runtime trace ${path.relative(nextDir, traceFile)} must be an object`);
    assert(trace.version === 1, `runtime trace ${path.relative(nextDir, traceFile)} has unsupported version`);
    assert(Array.isArray(trace.files), `runtime trace ${path.relative(nextDir, traceFile)} is missing files array`);
    for (const fileEntry of trace.files) {
      assert(typeof fileEntry === 'string' && fileEntry.length > 0, `runtime trace ${path.relative(nextDir, traceFile)} contains invalid file entry`);
      const resolved = path.resolve(path.dirname(traceFile), fileEntry);
      const lockNode = lockNodeForAbsolutePath(resolved, frontendRoot, lockKeys);
      if (lockNode) traceRuntimeNodes.add(lockNode);
    }
  }

  const webpackCacheRoot = path.join(nextDir, 'cache', 'webpack');
  assert(fs.existsSync(webpackCacheRoot) && fs.statSync(webpackCacheRoot).isDirectory(), 'runtime evidence: missing Webpack production cache');
  const webpackFiles = listFilesRecursive(webpackCacheRoot).filter((file) => {
    const relative = path.relative(webpackCacheRoot, file).replaceAll('\\', '/');
    return /^(server-production|server-production\.pack|edge-server-production|edge-server-production\.pack)\//.test(relative);
  });
  const serverWebpackFiles = webpackFiles.filter((file) => /^server-production(?:\.pack)?\//.test(path.relative(webpackCacheRoot, file).replaceAll('\\', '/')));
  assert(serverWebpackFiles.length > 0, 'runtime evidence: missing server-production Webpack cache files');

  const observedBundlePackages = new Set();
  for (const file of webpackFiles) {
    for (const name of scanPackFileForPackageNames(file)) {
      if (lockNodesByPackage.has(name)) observedBundlePackages.add(name);
    }
  }
  assert(observedBundlePackages.size > 0, 'runtime evidence: Webpack server bundle evidence contained no recognizable package identities');

  const bundleRuntimeNodes = new Set();
  const ambiguousBundlePackages = new Set();
  for (const name of observedBundlePackages) {
    const nodes = lockNodesByPackage.get(name) ?? [];
    if (nodes.length === 1) bundleRuntimeNodes.add(nodes[0]);
    else if (nodes.length > 1) ambiguousBundlePackages.add(name);
  }

  const runtimeNodes = new Set([...traceRuntimeNodes, ...bundleRuntimeNodes]);
  return {
    runtimeNodes,
    traceRuntimeNodes,
    bundleRuntimeNodes,
    ambiguousBundlePackages,
    observedBundlePackages,
    traceFiles,
    serverWebpackFiles,
  };
}

function resolveHighSeverityLeaves(report, packageName, stack = []) {
  assert(!stack.includes(packageName), `npm audit report: cyclic vulnerability via chain ${[...stack, packageName].join(' -> ')}`);
  const vulnerability = report.vulnerabilities[packageName];
  assert(vulnerability, `npm audit report: missing vulnerability ${packageName}`);
  const leaves = [];

  for (const via of vulnerability.via) {
    if (typeof via === 'string') {
      leaves.push(...resolveHighSeverityLeaves(report, via, [...stack, packageName]));
      continue;
    }
    if (!FAIL_SEVERITIES.has(via.severity)) continue;
    const leafPackage = via.dependency || via.name;
    assert(typeof leafPackage === 'string' && leafPackage.length > 0, `npm audit report: advisory under ${packageName} has no dependency identity`);
    assert(Object.hasOwn(report.vulnerabilities, leafPackage), `npm audit report: advisory leaf ${leafPackage} has no vulnerability node`);
    leaves.push({
      package: leafPackage,
      severity: via.severity,
      advisory: via.url,
      title: via.title ?? '',
    });
  }

  if (FAIL_SEVERITIES.has(vulnerability.severity)) {
    assert(leaves.length > 0, `npm audit report: ${packageName} is ${vulnerability.severity} but has no reviewable high/critical advisory leaf`);
  }
  return leaves;
}

function highSeverityLeafMap(report) {
  const leaves = new Map();
  for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!FAIL_SEVERITIES.has(vulnerability.severity)) continue;
    for (const leaf of resolveHighSeverityLeaves(report, packageName)) {
      const key = `${leaf.package}|${leaf.advisory}|${leaf.severity}`;
      leaves.set(key, leaf);
    }
  }
  return leaves;
}

export function validateAuditPair(fullReport, productionReport) {
  const fullLeaves = highSeverityLeafMap(fullReport);
  const prodLeaves = highSeverityLeafMap(productionReport);
  for (const key of prodLeaves.keys()) {
    assert(fullLeaves.has(key), `npm audit evidence mismatch: production advisory ${key} is absent from full audit`);
  }
  return { fullLeaves, prodLeaves };
}

function classifyLeaf({ leaf, productionReport, manifest, lockfile, provenance, runtimeEvidence }) {
  const vulnerability = productionReport.vulnerabilities[leaf.package];
  assert(vulnerability, `classification: missing vulnerability node for ${leaf.package}`);
  const nodeRecords = vulnerability.nodes.map((node) => {
    const lockEntry = lockfile.packages[node];
    assert(lockEntry, `classification: audited node ${node} is missing from package-lock.json`);
    const origin = provenance.get(node);
    assert(origin, `classification: no provenance record for ${node}`);
    return { node, lockEntry, origin };
  });

  if (nodeRecords.some(({ node }) => runtimeEvidence.runtimeNodes.has(node))) {
    return {
      category: 'PRODUCTION_RUNTIME',
      rationale: 'at least one audited lockfile node is present in complete Next.js server trace/bundle evidence',
    };
  }

  if (runtimeEvidence.ambiguousBundlePackages.has(leaf.package)) {
    return {
      category: 'UNRESOLVED',
      rationale: 'server bundle evidence contains this package name but multiple lockfile nodes prevent safe version/node attribution',
    };
  }

  if (nodeRecords.some(({ origin }) => origin.prodWithoutOptionalPeer)) {
    return {
      category: 'UNRESOLVED',
      rationale: 'audited node is reachable from a root production dependency without crossing an optional-peer boundary but is absent from runtime evidence',
    };
  }

  const allDev = nodeRecords.every(({ origin }) => origin.devReachable);
  const anyProdViaOptionalPeer = nodeRecords.some(({ origin }) => origin.prodWithOptionalPeer);
  const allProdPathsOptionalPeerOnly = nodeRecords.every(({ origin }) => !origin.prodWithoutOptionalPeer && origin.prodWithOptionalPeer);
  const allDevOptional = nodeRecords.every(({ lockEntry }) => lockEntry.devOptional === true);

  if (allDev && anyProdViaOptionalPeer && allProdPathsOptionalPeerOnly && allDevOptional) {
    return {
      category: 'OPTIONAL_PEER_RETAINED_TOOLING',
      rationale: 'all audited nodes are dev-reachable, devOptional, and any production-graph provenance crosses an optional-peer boundary; complete runtime evidence contains none of those nodes',
    };
  }

  const noProdPath = nodeRecords.every(({ origin }) => !origin.prodWithoutOptionalPeer && !origin.prodWithOptionalPeer);
  if (allDev && noProdPath) {
    const directDev = Object.hasOwn(manifest.devDependencies ?? {}, leaf.package);
    return {
      category: directDev ? 'BUILD_TOOLING' : 'DEV_ONLY',
      rationale: 'audited nodes are reachable only from root devDependencies and are absent from complete runtime evidence',
    };
  }

  return {
    category: 'UNRESOLVED',
    rationale: 'lockfile/runtime evidence does not prove a safe non-runtime classification',
  };
}

export function evaluatePolicy({ fullReport, productionReport, manifest, lockfile, acceptedPolicy, runtimeEvidence }) {
  validateAuditReport(fullReport, 'full npm audit');
  validateAuditReport(productionReport, 'omit-dev npm audit');
  validateManifest(manifest);
  validateLockfile(lockfile, manifest);
  validateAcceptedPolicy(acceptedPolicy);
  const { prodLeaves } = validateAuditPair(fullReport, productionReport);
  const { provenance } = buildLockProvenance(lockfile, manifest);

  const accepted = new Set(acceptedPolicy.accepted.map((entry) => `${entry.package}|${entry.advisory}`));
  const results = [];
  const blocking = [];
  const reviewed = [];

  for (const leaf of prodLeaves.values()) {
    const classification = classifyLeaf({ leaf, productionReport, manifest, lockfile, provenance, runtimeEvidence });
    const result = { ...leaf, ...classification };
    results.push(result);

    if (classification.category === 'UNRESOLVED') {
      blocking.push(`${leaf.package}: ${leaf.severity} ${leaf.advisory} — UNRESOLVED (${classification.rationale})`);
      continue;
    }

    if (classification.category !== 'PRODUCTION_RUNTIME') continue;

    const directProduction = Object.hasOwn(manifest.dependencies ?? {}, leaf.package);
    if (directProduction) {
      blocking.push(`${leaf.package}: direct root production-runtime ${leaf.severity} ${leaf.advisory}`);
      continue;
    }

    const exactKey = `${leaf.package}|${leaf.advisory}`;
    if (accepted.has(exactKey)) {
      reviewed.push(`${leaf.package}: exact reviewed runtime transitive advisory ${leaf.advisory}`);
    } else {
      blocking.push(`${leaf.package}: unaccepted production-runtime ${leaf.severity} ${leaf.advisory}`);
    }
  }

  return { ok: blocking.length === 0, results, blocking, reviewed };
}

function formatCounts(report) {
  const counts = report.metadata.vulnerabilities;
  return `critical=${counts.critical}, high=${counts.high}, moderate=${counts.moderate}, low=${counts.low}, info=${counts.info}, total=${counts.total}`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    assert(key?.startsWith('--') && value, `CLI: expected --key value pairs, got ${key ?? '<missing>'}`);
    args[key.slice(2)] = value;
  }
  for (const required of ['audit-all', 'audit-production', 'manifest', 'lockfile', 'accepted', 'next-dir']) {
    assert(args[required], `CLI: missing --${required}`);
  }
  return args;
}

export function runCli(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const fullReport = validateAuditReport(readJson(args['audit-all'], 'full npm audit'), 'full npm audit');
    const productionReport = validateAuditReport(readJson(args['audit-production'], 'omit-dev npm audit'), 'omit-dev npm audit');
    const manifest = validateManifest(readJson(args.manifest, 'package.json'));
    const lockfile = validateLockfile(readJson(args.lockfile, 'package-lock.json'), manifest);
    const acceptedPolicy = validateAcceptedPolicy(readJson(args.accepted, 'accepted advisory policy'));
    validateAuditPair(fullReport, productionReport);
    const runtimeEvidence = collectRuntimeEvidence(args['next-dir'], lockfile);
    const outcome = evaluatePolicy({ fullReport, productionReport, manifest, lockfile, acceptedPolicy, runtimeEvidence });

    console.log(`Full dependency audit raw counts: ${formatCounts(fullReport)}`);
    console.log(`Production/omit-dev audit raw counts: ${formatCounts(productionReport)}`);
    console.log(`Runtime evidence: traces=${runtimeEvidence.traceFiles.length}, traceNodes=${runtimeEvidence.traceRuntimeNodes.size}, bundleNodes=${runtimeEvidence.bundleRuntimeNodes.size}, bundlePackages=${runtimeEvidence.observedBundlePackages.size}`);

    for (const result of outcome.results) {
      if (result.category === 'PRODUCTION_RUNTIME') {
        console.log(`PRODUCTION RUNTIME ${result.severity.toUpperCase()}: package=${result.package} advisory=${result.advisory} rationale=${result.rationale}`);
      } else if (result.category === 'UNRESOLVED') {
        console.error(`UNRESOLVED ${result.severity.toUpperCase()}: package=${result.package} advisory=${result.advisory} rationale=${result.rationale}`);
      } else {
        console.log(`TOOLING ${result.severity.toUpperCase()} — NON-RUNTIME BLOCKER CLASSIFICATION: package=${result.package} advisory=${result.advisory} classification=${result.category} rationale=${result.rationale}; vulnerability remains present and should be replaced by the supported upstream patch when available`);
      }
    }
    for (const item of outcome.reviewed) console.log(`Accepted by exact advisory policy: ${item}`);

    if (!outcome.ok) {
      console.error('Unresolved policy-relevant dependency advisories:');
      for (const item of outcome.blocking) console.error(`- ${item}`);
      return 1;
    }

    console.log('Dependency security classifier: PASS');
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`DEPENDENCY SECURITY CLASSIFIER FAIL-CLOSED: ${message}`);
    return 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = runCli();
