import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const plan = JSON.parse(await readFile(new URL("../.github/cleanup/jinmu-public-history.json", import.meta.url), "utf8"));
if (process.env.GITHUB_REPOSITORY !== plan.repository || !process.env.GITHUB_TOKEN || !process.env.GITHUB_SHA) throw new Error("Authorized repository workflow required");
const token = process.env.GITHUB_TOKEN;
const root = await mkdtemp(join(tmpdir(), "jinmu-history-"));
const mirror = join(root, "mirror.git");
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}` };
const git = (...args) => execFileSync("git", ["-C", mirror, ...args], { env: gitEnv, maxBuffer: 512 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
const api = async (endpoint, method = "GET") => {
  const response = await fetch(`https://api.github.com/repos/${plan.repository}/${endpoint}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`GitHub ${method} ${endpoint.split("?")[0]} returned ${response.status}`);
  return response.status === 204 ? null : response.json();
};
const paginate = async (endpoint, property) => {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api(`${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const values = property ? result[property] : result;
    if (!Array.isArray(values)) throw new Error("Unexpected GitHub pagination response");
    rows.push(...values);
    if (values.length < 100) return rows;
  }
  throw new Error("Pagination safety limit exceeded");
};
const contaminated = (path, text) => path.endsWith(".html")
  ? text.includes('class="article-body"')
  : [...text.matchAll(/\bcontent\s*:\s*(?:String\.raw)?`([\s\S]*?)(?<!\\)`/g)].some((match) => match[1].length > 200);

execFileSync("git", ["clone", "--mirror", `https://github.com/${plan.repository}.git`, mirror], { env: gitEnv, stdio: ["ignore", "pipe", "pipe"] });
const mainBefore = git("rev-parse", "refs/heads/main");
if (mainBefore !== process.env.GITHUB_SHA) throw new Error("Main moved after authorization; cleanup stopped");
if (git("rev-parse", `${mainBefore}^`) !== plan.approvedMain) throw new Error("This one-time cleanup was already consumed or its starting history changed");
const refs = git("for-each-ref", "--format=%(refname) %(objectname)", "refs/heads", "refs/tags").split("\n").map((line) => { const [ref, sha] = line.split(" "); return { ref, sha }; });
if (refs.length !== plan.expectedBranches || refs.some(({ ref }) => !ref.startsWith("refs/heads/"))) throw new Error("Branch/tag inventory changed; manual review required");
const mainTree = git("rev-parse", `${mainBefore}^{tree}`);
const objectLines = git("rev-list", "--objects", "--all").split("\n");
const blobs = objectLines.map((line) => ({ sha: line.slice(0, 40), path: line.slice(41) })).filter(({ path }) => plan.scopedPaths.includes(path));
const bad = blobs.filter(({ sha, path }) => contaminated(path, git("cat-file", "blob", sha)));
if (bad.length !== plan.expectedContaminatedBlobs) throw new Error("Contaminated blob inventory changed; cleanup stopped");
const badIds = new Set(bad.map(({ sha }) => sha));
const bodyFingerprints = [];
for (const item of bad) {
  if (item.path.endsWith(".html")) continue;
  const text = git("cat-file", "blob", item.sha);
  for (const match of text.matchAll(/\bcontent\s*:\s*(?:String\.raw)?`([\s\S]*?)(?<!\\)`/g)) {
    const phrase = match[1].split("\n").map((line) => line.trim()).find((line) => line.length > 35 && !line.startsWith("!"));
    if (phrase) bodyFingerprints.push(phrase.slice(0, 60));
  }
}
const treeHasBody = (sha) => {
  try { return git("ls-tree", "-r", sha, "--", ...plan.scopedPaths).split("\n").some((line) => badIds.has(line.split(/\s+/)[2])); }
  catch { throw new Error("A build commit is unavailable for safe artifact classification"); }
};
if (treeHasBody(mainBefore)) throw new Error("Current main still contains a public body; history-only cleanup stopped");
// Capture only old deployment archives proven to include the tainted root files.
const artifactInventory = await paginate("actions/artifacts", "artifacts");
const artifacts = artifactInventory.filter((artifact) => !artifact.expired && artifact.name === "github-pages" && artifact.workflow_run?.head_sha && treeHasBody(artifact.workflow_run.head_sha));

const deletedLogRuns = [];
const checkedLogRuns = [];
for (const workflow of plan.logWorkflows) {
  const runs = await paginate(`actions/workflows/${encodeURIComponent(workflow)}/runs`, "workflow_runs");
  for (const run of runs) {
    if (run.status !== "completed") throw new Error("A source-writing workflow is still active");
    const response = await fetch(`https://api.github.com/repos/${plan.repository}/actions/runs/${run.id}/logs`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(60000) });
    if ([404, 410].includes(response.status)) continue;
    if (!response.ok) throw new Error(`Cannot inspect old workflow logs (${response.status})`);
    const archive = join(root, `logs-${run.id}.zip`);
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    const logs = execFileSync("unzip", ["-p", archive], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).toString();
    checkedLogRuns.push(run.id);
    if (bodyFingerprints.some((phrase) => logs.includes(phrase))) {
      await api(`actions/runs/${run.id}/logs`, "DELETE");
      const check = await fetch(`https://api.github.com/repos/${plan.repository}/actions/runs/${run.id}/logs`, { headers: { Authorization: `Bearer ${token}` }, redirect: "manual", signal: AbortSignal.timeout(30000) });
      if (![404, 410].includes(check.status)) throw new Error("Deleted log archive remains downloadable");
      deletedLogRuns.push(run.id);
    }
  }
}
console.log(JSON.stringify({ stage: "old-body-log-cleanup", checked: checkedLogRuns.length, removed: deletedLogRuns.length, runIds: deletedLogRuns }));

const idsFile = join(root, "confirmed-body-blobs.txt");
await writeFile(idsFile, [...badIds].join("\n") + "\n");
git("filter-repo", "--force", "--strip-blobs-with-ids", idsFile, "--prune-empty", "never", "--prune-degenerate", "never", "--preserve-commit-hashes", "--preserve-commit-encoding", "--replace-refs", "delete-no-add", "--refs", ...refs.map(({ ref }) => ref));
if (git("rev-parse", "refs/heads/main^{tree}") !== mainTree) throw new Error("Current production tree changed; no rewritten history pushed");
const reachable = new Set(git("rev-list", "--objects", ...refs.map(({ ref }) => ref)).split("\n").map((line) => line.slice(0, 40)));
if ([...badIds].some((sha) => reachable.has(sha))) throw new Error("A contaminated blob remains in a writable public ref");
const updated = refs.filter(({ ref, sha }) => git("rev-parse", ref) !== sha);
for (const { ref, sha } of updated) {
  const paths = git("diff", "--name-only", sha, ref).split("\n").filter(Boolean);
  if (paths.some((path) => !plan.scopedPaths.includes(path))) throw new Error("An unrelated file changed in a branch; no rewritten history pushed");
}
git("-c", "remote.origin.mirror=false", "push", "--atomic", "origin", ...updated.map(({ ref, sha }) => `--force-with-lease=${ref}:${sha}`), ...updated.map(({ ref }) => `${ref}:${ref}`));
const remoteRefs = new Map(git("ls-remote", "--heads", "origin").split("\n").map((line) => { const [sha, ref] = line.split(/\s+/); return [ref, sha]; }));
if (refs.some(({ ref }) => remoteRefs.get(ref) !== git("rev-parse", ref))) throw new Error("Remote branch readback mismatch");
console.log(JSON.stringify({ stage: "history-cleanup", changedBranches: updated.length, removedBodyVersions: bad.length, currentProductionTreeUnchanged: true, otherFilesAndImagesPreserved: true, readOnlyPullRequestRefsNotMutated: true, newMain: remoteRefs.get("refs/heads/main") }));

const deletedArtifacts = [];
for (const artifact of artifacts) {
  await api(`actions/artifacts/${artifact.id}`, "DELETE");
  deletedArtifacts.push(artifact.id);
}
const remaining = await paginate("actions/artifacts", "artifacts");
if (remaining.some((artifact) => deletedArtifacts.includes(artifact.id))) throw new Error("A deleted old deployment artifact remains listed");
console.log(JSON.stringify({ stage: "old-deployment-artifact-cleanup", removed: deletedArtifacts.length, artifactIds: deletedArtifacts, currentDeploymentPreserved: true }));
