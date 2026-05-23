/**
 * Shared generic utilities for operational scripts under scripts/.
 *
 * Common usage:
 *   import { logStep, logSuccess, summarizeMarkdown } from './lib/utils'
 *
 * Optional env vars:
 *   DEBUG, DOCKERHUB_DEBUG — enable debug logging via logDebug.
 */

import process from 'node:process'
import { styleText } from 'node:util'

const DEBUG =
  process.env.DEBUG === '1' ||
  process.env.DEBUG === 'true' ||
  process.env.DOCKERHUB_DEBUG === '1' ||
  process.env.DOCKERHUB_DEBUG === 'true'

type LogColor = Parameters<typeof styleText>[0]

export interface MarkdownSummary {
  title: string
  firstParagraph: string
}

/** Writes a consistently formatted log message to stderr. */
function writeLog(color: LogColor, label: string, message: string): void {
  process.stderr.write(`${styleText(color, label)} ${message}\n`)
}

/** Writes a neutral informational message to stderr. */
export function logInfo(message: string): void {
  writeLog('blue', 'info', message)
}

/** Writes a successful completion message to stderr. */
export function logSuccess(message: string): void {
  writeLog('green', 'done', message)
}

/** Writes the current workflow step to stderr. */
export function logStep(message: string): void {
  writeLog('cyan', 'step', message)
}

/** Writes a failure message to stderr. */
export function logError(message: string): void {
  writeLog('red', 'error', message)
}

/** Writes a debug message when DOCKERHUB_DEBUG is enabled. */
export function logDebug(message: string): void {
  if (DEBUG) writeLog('magenta', 'debug', message)
}

/** Extracts the first H1 title and first paragraph after a heading. */
export function summarizeMarkdown(markdown: string): MarkdownSummary {
  const lines = markdown.split(/\r?\n/)

  const title =
    lines
      .map((line) => line.trim())
      .find((line) => line.startsWith('# '))
      ?.replace(/^#\s+/, '')
      .trim() ?? ''

  let seenHeading = false
  const paragraph: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (paragraph.length) break
      continue
    }
    if (trimmed.startsWith('#')) {
      seenHeading = true
      continue
    }
    if (!seenHeading) continue
    paragraph.push(trimmed)
  }

  const firstParagraph = paragraph.join(' ').trim()
  return { title: title || firstParagraph || 'Docker image', firstParagraph }
}
