/**
 * Docker Hub API helpers for operational scripts.
 *
 * Common usage:
 *   import { getDockerHubBearerToken, patchRepo } from './lib/dockerhub'
 *
 * Required env vars:
 *   Auth (provide bearer directly, or exchange credentials via /v2/auth/token):
 *   DOCKERHUB_BEARER_TOKEN
 *   OR DOCKERHUB_IDENTIFIER + DOCKERHUB_SECRET
 *   OR DOCKERHUB_USERNAME + (DOCKERHUB_PASSWORD | DOCKERHUB_TOKEN)
 *
 * Optional env vars:
 *   DOCKERHUB_REPO, DOCKERHUB_README_PATH, DOCKERHUB_SHORT_DESCRIPTION.
 */

import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { logDebug, logInfo, logStep, summarizeMarkdown } from './utils'

const USER_AGENT = 'wal-0 sync-dockerhub-readme'

export interface ParsedArgs {
  repo: string | undefined
  readmePath: string | undefined
  shortDescription: string | undefined
}

export interface RepoComponents {
  namespace: string
  repository: string
}

export interface AssertRepoAdminAccessOptions {
  repo: string
  token: string
}

export interface PatchRepoOptions {
  repo: string
  token: string
  readme: string
  shortDescription: string
}

/** Resolves the README path from env vars, CLI args, or the default path. */
export function resolveReadmePath(args: ParsedArgs): string {
  return process.env.DOCKERHUB_README_PATH || args.readmePath || './README.md'
}

/** Splits a Docker Hub repo string into namespace and repository components. */
export function splitRepo(repo: string): RepoComponents {
  const trimmed = repo.trim()
  const parts = trimmed.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid --repo value "${repo}". Expected format: <namespace>/<repository>.`
    )
  }

  return { namespace: parts[0], repository: parts[1] }
}

/** Reads a README file from disk as UTF-8 text. */
export async function readReadme(readmePath: string): Promise<string> {
  logInfo(`Reading ${readmePath}`)
  return readFile(readmePath, 'utf8')
}

/** Normalizes Docker Hub's short description and enforces its length limit. */
export function normalizeShortDescription(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > 100 ? `${cleaned.slice(0, 97)}...` : cleaned
}

/** Resolves the Docker Hub short description from env vars, args, or README text. */
export function resolveShortDescription(
  args: ParsedArgs,
  readme: string
): string {
  const { title, firstParagraph } = summarizeMarkdown(readme)

  return normalizeShortDescription(
    process.env.DOCKERHUB_SHORT_DESCRIPTION ||
      args.shortDescription ||
      firstParagraph ||
      title
  )
}

/** Builds the common Docker Hub API headers for authenticated JSON requests. */
export function bearerHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': USER_AGENT,
  }
}

/** Reads a response body as text, returning an empty string if reading fails. */
export async function readResponseText(response: Response): Promise<string> {
  return response.text().catch(() => '')
}

/** Gets a Docker Hub bearer token from env vars or exchanges credentials for one. */
export async function getDockerHubBearerToken(): Promise<string> {
  const directBearer = process.env.DOCKERHUB_BEARER_TOKEN
  if (directBearer) {
    logInfo('Using DOCKERHUB_BEARER_TOKEN')
    return directBearer
  }

  if (
    process.env.DOCKERHUB_TOKEN &&
    process.env.DOCKERHUB_TOKEN.split('.').length === 3
  ) {
    logInfo('Using DOCKERHUB_TOKEN as bearer JWT')
    return process.env.DOCKERHUB_TOKEN
  }

  const identifier =
    process.env.DOCKERHUB_IDENTIFIER || process.env.DOCKERHUB_USERNAME
  const secret =
    process.env.DOCKERHUB_SECRET ||
    process.env.DOCKERHUB_PASSWORD ||
    process.env.DOCKERHUB_TOKEN

  if (!identifier || !secret) {
    throw new Error(
      'Missing Docker Hub credentials. Provide DOCKERHUB_BEARER_TOKEN, or (DOCKERHUB_IDENTIFIER + DOCKERHUB_SECRET), or (DOCKERHUB_USERNAME + DOCKERHUB_PASSWORD/DOCKERHUB_TOKEN).'
    )
  }

  logStep('Exchanging credentials for bearer token')
  const response = await fetch('https://hub.docker.com/v2/auth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify({ identifier, secret }),
  })

  if (!response.ok) {
    const text = await readResponseText(response)
    throw new Error(
      `Docker Hub auth token exchange failed (${response.status}): ${text}`
    )
  }

  const json = (await response.json().catch(() => null)) as {
    access_token?: string
  } | null
  if (!json?.access_token) {
    throw new Error('Docker Hub auth response missing access_token')
  }

  return json.access_token
}

/** Verifies whether the authenticated Docker Hub account has repo admin access. */
export async function assertRepoAdminAccess({
  repo,
  token,
}: AssertRepoAdminAccessOptions): Promise<void> {
  const { namespace, repository } = splitRepo(repo)
  const url = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}`
  const headers = bearerHeaders(token)

  const response = await fetch(url, { method: 'GET', headers })
  logDebug(`Preflight GET ${url} -> ${response.status}`)
  if (!response.ok) return

  const data = (await response.json().catch(() => null)) as {
    permissions?: { read: boolean; write: boolean; admin: boolean }
  } | null
  const permissions = data?.permissions
  if (!permissions) return

  logDebug(
    `Permissions: read=${Boolean(permissions.read)} write=${Boolean(permissions.write)} admin=${Boolean(permissions.admin)}`
  )

  if (permissions.admin === false) {
    throw new Error(
      'Docker Hub token is valid, but the authenticated account is not an admin of this repository. Updating full_description/description typically requires repo admin rights and a PAT with repo:admin.'
    )
  }
}

/** Updates Docker Hub's README and optional short description for a repository. */
export async function patchRepo({
  repo,
  token,
  readme,
  shortDescription,
}: PatchRepoOptions): Promise<void> {
  const { namespace, repository } = splitRepo(repo)

  const v2BetaUrl = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}`
  const legacyUrl = `https://hub.docker.com/v2/repositories/${repo}/`
  const headers = bearerHeaders(token)

  const body = {
    full_description: readme,
    ...(shortDescription ? { description: shortDescription } : {}),
  }

  const attemptPatch = (url: string): Promise<Response> =>
    fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) })

  let response = await attemptPatch(v2BetaUrl)

  if (response.status === 404 || response.status === 405) {
    response = await attemptPatch(legacyUrl)
  }

  if (!response.ok) {
    const text = await readResponseText(response)
    if (response.status === 403) {
      const hint =
        '\n\nHint: 403 usually means the token is valid but lacks permission to edit this repository.\n' +
        '- If using a PAT, ensure it includes repo:admin (repo:write may not be sufficient for editing description/README).\n' +
        '- If using an organization access token (dckr_oat_*), set DOCKERHUB_IDENTIFIER to the org/namespace (not your username).\n' +
        '- Ensure the authenticated account is an admin/owner of the Docker Hub repo.\n'
      throw new Error(
        `Docker Hub PATCH failed (${response.status}): ${text}${hint}`
      )
    }

    throw new Error(`Docker Hub PATCH failed (${response.status}): ${text}`)
  }
}
