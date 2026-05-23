#!/usr/bin/env bun

const DEBUG =
	process.env.DOCKERHUB_DEBUG === "1" || process.env.DOCKERHUB_DEBUG === "true";

const log = {
	info: (message: string) => process.stderr.write(`ℹ️  ${message}\n`),
	ok: (message: string) => process.stderr.write(`✅ ${message}\n`),
	step: (message: string) => process.stderr.write(`🔄 ${message}\n`),
	auth: (message: string) => process.stderr.write(`🔐 ${message}\n`),
	doc: (message: string) => process.stderr.write(`📄 ${message}\n`),
	debug: (message: string) => {
		if (DEBUG) process.stderr.write(`🧪 ${message}\n`);
	},
};

function usageAndExit(code = 0): never {
	process.stderr.write(`Usage: bun scripts/sync-dockerhub-readme.ts --repo <namespace/name> [--readme <path>] [--short-description <text>]

Env vars:
  DOCKERHUB_REPO               (required unless --repo is provided)
  DOCKERHUB_README_PATH        (optional; overrides --readme; default: ./README.md)
  DOCKERHUB_SHORT_DESCRIPTION  (optional; overrides --short-description)

Auth (either provide bearer directly, or exchange credentials via /v2/auth/token):
  DOCKERHUB_BEARER_TOKEN
  OR DOCKERHUB_IDENTIFIER + DOCKERHUB_SECRET
  OR DOCKERHUB_USERNAME + (DOCKERHUB_PASSWORD | DOCKERHUB_TOKEN)

Debug:
  DOCKERHUB_DEBUG=1
`);

	process.exit(code);
}

interface ParsedArgs {
	repo: string | undefined;
	readmePath: string | undefined;
	shortDescription: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
	const args: ParsedArgs = {
		repo: undefined,
		readmePath: undefined,
		shortDescription: undefined,
	};

	for (let index = 0; index < argv.length; index++) {
		const value = argv[index];

		if (value === "--help" || value === "-h") usageAndExit(0);
		if (value === "--repo") args.repo = argv[++index];
		else if (value === "--readme") args.readmePath = argv[++index];
		else if (value === "--short-description")
			args.shortDescription = argv[++index];
		else {
			process.stderr.write(`Unknown arg: ${value}\n\n`);
			usageAndExit(1);
		}
	}

	return args;
}

interface RepoComponents {
	namespace: string;
	repository: string;
}

function splitRepo(repo: string): RepoComponents {
	const trimmed = (repo || "").trim();
	const parts = trimmed.split("/");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		throw new Error(
			`Invalid --repo value "${repo}". Expected format: <namespace>/<repository>.`,
		);
	}

	return { namespace: parts[0], repository: parts[1] };
}

interface MarkdownSummary {
	title: string;
	firstParagraph: string;
}

function toTitleAndFirstParagraph(markdown: string): MarkdownSummary {
	const lines = markdown.split(/\r?\n/);

	const title =
		lines
			.map((line) => line.trim())
			.find((line) => line.startsWith("# "))
			?.replace(/^#\s+/, "")
			.trim() ?? "";

	// First paragraph after the first heading
	let seenHeading = false;
	const paragraph: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (paragraph.length) break;
			continue;
		}
		if (trimmed.startsWith("#")) {
			seenHeading = true;
			continue;
		}
		if (!seenHeading) continue;
		paragraph.push(trimmed);
	}

	const firstParagraph = paragraph.join(" ").trim();
	return { title: title || firstParagraph || "Docker image", firstParagraph };
}

function normalizeShortDescription(text: string): string {
	const cleaned = (text || "").replace(/\s+/g, " ").trim();
	if (!cleaned) return "";
	return cleaned.length > 100 ? `${cleaned.slice(0, 97)}...` : cleaned;
}

function bearerHeaders(token: string): Record<string, string> {
	return {
		authorization: `Bearer ${token}`,
		"content-type": "application/json",
		"user-agent": "wal-0 sync-dockerhub-readme",
	};
}

async function readResponseText(response: Response): Promise<string> {
	return response.text().catch(() => "");
}

async function getDockerHubBearerToken(): Promise<string> {
	const directBearer = process.env.DOCKERHUB_BEARER_TOKEN;
	if (directBearer) {
		log.auth("Using DOCKERHUB_BEARER_TOKEN");
		return directBearer;
	}

	// Back-compat: if DOCKERHUB_TOKEN is already a JWT bearer, accept it.
	if (
		process.env.DOCKERHUB_TOKEN &&
		process.env.DOCKERHUB_TOKEN.split(".").length === 3
	) {
		log.auth("Using DOCKERHUB_TOKEN as bearer JWT");
		return process.env.DOCKERHUB_TOKEN;
	}

	const identifier =
		process.env.DOCKERHUB_IDENTIFIER || process.env.DOCKERHUB_USERNAME;
	const secret =
		process.env.DOCKERHUB_SECRET ||
		process.env.DOCKERHUB_PASSWORD ||
		process.env.DOCKERHUB_TOKEN;

	if (!identifier || !secret) {
		throw new Error(
			"Missing Docker Hub credentials. Provide DOCKERHUB_BEARER_TOKEN, or (DOCKERHUB_IDENTIFIER + DOCKERHUB_SECRET), or (DOCKERHUB_USERNAME + DOCKERHUB_PASSWORD/DOCKERHUB_TOKEN).",
		);
	}

	log.auth("Exchanging credentials for bearer token");
	const response = await fetch("https://hub.docker.com/v2/auth/token", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"user-agent": "wal-0 sync-dockerhub-readme",
		},
		body: JSON.stringify({ identifier, secret }),
	});

	if (!response.ok) {
		const text = await readResponseText(response);
		throw new Error(
			`Docker Hub auth token exchange failed (${response.status}): ${text}`,
		);
	}

	const json = (await response.json().catch(() => null)) as {
		access_token?: string;
	} | null;
	if (!json?.access_token)
		throw new Error("Docker Hub auth response missing access_token");

	return json.access_token;
}

interface AssertRepoAdminAccessOptions {
	repo: string;
	token: string;
}

async function assertRepoAdminAccess({
	repo,
	token,
}: AssertRepoAdminAccessOptions): Promise<void> {
	const { namespace, repository } = splitRepo(repo);
	const url = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}`;
	const headers = bearerHeaders(token);

	const response = await fetch(url, { method: "GET", headers });
	log.debug(`Preflight GET ${url} -> ${response.status}`);
	if (!response.ok) return;

	const data = (await response.json().catch(() => null)) as {
		permissions?: { read: boolean; write: boolean; admin: boolean };
	} | null;
	const permissions = data?.permissions;
	if (!permissions) return;

	log.debug(
		`Permissions: read=${Boolean(permissions.read)} write=${Boolean(permissions.write)} admin=${Boolean(permissions.admin)}`,
	);

	if (permissions.admin === false) {
		throw new Error(
			"Docker Hub token is valid, but the authenticated account is not an admin of this repository. Updating full_description/description typically requires repo admin rights and a PAT with repo:admin.",
		);
	}
}

interface PatchRepoOptions {
	repo: string;
	token: string;
	readme: string;
	shortDescription: string;
}

async function patchRepo({
	repo,
	token,
	readme,
	shortDescription,
}: PatchRepoOptions): Promise<void> {
	const { namespace, repository } = splitRepo(repo);

	// Prefer the Docker Hub API (2-beta) namespace endpoint.
	const v2BetaUrl = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}`;
	// Legacy endpoint (kept as fallback in case accounts rely on it).
	const legacyUrl = `https://hub.docker.com/v2/repositories/${repo}/`;

	const headers = bearerHeaders(token);

	const body = {
		full_description: readme,
		...(shortDescription ? { description: shortDescription } : {}),
	};

	const attempt = (url: string): Promise<Response> =>
		fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) });

	let response = await attempt(v2BetaUrl);

	// Some accounts/endpoints may not support PATCH on the v2-beta route yet.
	if (response.status === 404 || response.status === 405) {
		response = await attempt(legacyUrl);
	}

	if (!response.ok) {
		const text = await readResponseText(response);
		if (response.status === 403) {
			const hint =
				"\n\nHint: 403 usually means the token is valid but lacks permission to edit this repository.\n" +
				"- If using a PAT, ensure it includes repo:admin (repo:write may not be sufficient for editing description/README).\n" +
				"- If using an organization access token (dckr_oat_*), set DOCKERHUB_IDENTIFIER to the org/namespace (not your username).\n" +
				"- Ensure the authenticated account is an admin/owner of the Docker Hub repo.\n";
			throw new Error(
				`Docker Hub PATCH failed (${response.status}): ${text}${hint}`,
			);
		}

		throw new Error(`Docker Hub PATCH failed (${response.status}): ${text}`);
	}
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));

	const repo = process.env.DOCKERHUB_REPO || args.repo;
	if (!repo) {
		process.stderr.write(
			"Missing required Docker Hub repository name. Provide DOCKERHUB_REPO or --repo.\n\n",
		);
		usageAndExit(1);
	}

	const readmePath =
		process.env.DOCKERHUB_README_PATH || args.readmePath || "./README.md";
	log.step(`Syncing Docker Hub README for ${repo}`);
	log.doc(`Reading ${readmePath}`);
	const readme = await Bun.file(readmePath).text();

	const { title, firstParagraph } = toTitleAndFirstParagraph(readme);
	const shortDescription = normalizeShortDescription(
		process.env.DOCKERHUB_SHORT_DESCRIPTION ||
			args.shortDescription ||
			firstParagraph ||
			title,
	);

	const token = await getDockerHubBearerToken();
	await assertRepoAdminAccess({ repo, token });
	log.step("Updating Docker Hub repository description");
	await patchRepo({ repo, token, readme, shortDescription });

	log.ok(`Synced README to Docker Hub: ${repo}`);
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`❌ ${message}\n`);
	process.exit(1);
}
