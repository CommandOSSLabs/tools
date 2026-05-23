#!/usr/bin/env bun

/**
 * Sync a local README into a Docker Hub repository description.
 *
 * Common usage:
 *   bun scripts/sync-dockerhub-readme.mts --repo <namespace/name> --readme ./README.md
 *
 * Required env vars:
 *   Provide either DOCKERHUB_BEARER_TOKEN, or credentials via
 *   DOCKERHUB_IDENTIFIER + DOCKERHUB_SECRET, or
 *   DOCKERHUB_USERNAME + (DOCKERHUB_PASSWORD | DOCKERHUB_TOKEN).
 *
 * Optional env vars:
 *   DOCKERHUB_REPO, DOCKERHUB_README_PATH, DOCKERHUB_SHORT_DESCRIPTION,
 *   DOCKERHUB_DEBUG.
 */

import process from 'node:process'
import { parseArgs as parseNodeArgs } from 'node:util'

import {
  assertRepoAdminAccess,
  getDockerHubBearerToken,
  type ParsedArgs,
  patchRepo,
  readReadme,
  resolveReadmePath,
  resolveShortDescription,
} from './lib/dockerhub'
import { logError, logStep, logSuccess } from './lib/utils'

/** Prints CLI usage and exits with the provided status code. */
function usageAndExit(code = 0): never {
  process.stderr.write(`Usage: bun scripts/sync-dockerhub-readme.mts --repo <namespace/name> [--readme <path>] [--short-description <text>]

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
`)
  process.exit(code)
}

/** Parses command-line arguments for this script. */
function parseCliArgs(argv: string[]): ParsedArgs {
  try {
    const { values } = parseNodeArgs({
      args: argv,
      allowPositionals: false,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        repo: { type: 'string' },
        readme: { type: 'string' },
        'short-description': { type: 'string' },
      },
    })
    if (values.help) usageAndExit(0)
    return {
      repo: values.repo,
      readmePath: values.readme,
      shortDescription: values['short-description'],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logError(message)
    process.stderr.write('\n')
    usageAndExit(1)
  }
}

/** Resolves the Docker Hub repository from env vars or CLI args. */
function resolveRepo(args: ParsedArgs): string {
  const repo = process.env.DOCKERHUB_REPO || args.repo
  if (!repo) {
    logError(
      'Missing required Docker Hub repository name. Provide DOCKERHUB_REPO or --repo.'
    )
    process.stderr.write('\n')
    usageAndExit(1)
  }
  return repo
}

/** Runs the Docker Hub README sync workflow from CLI args through API update. */
async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2))
  const repo = resolveRepo(args)
  const readmePath = resolveReadmePath(args)

  logStep(`Syncing Docker Hub README for ${repo}`)
  const readme = await readReadme(readmePath)
  const shortDescription = resolveShortDescription(args, readme)
  const token = await getDockerHubBearerToken()

  await assertRepoAdminAccess({ repo, token })

  logStep('Updating Docker Hub repository description')
  await patchRepo({ repo, token, readme, shortDescription })

  logSuccess(`Synced README to Docker Hub: ${repo}`)
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  logError(message)
  process.exit(1)
}
