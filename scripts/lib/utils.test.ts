/**
 * Tests utility behavior shared by operational scripts.
 *
 * Common usage:
 *   bun test scripts/lib/utils.test.ts
 *
 * Required env vars:
 *   None.
 */

import { describe, expect, test } from 'bun:test'

import { normalizeShortDescription, splitRepo } from './dockerhub'
import { summarizeMarkdown } from './utils'

describe('Docker Hub README utilities', () => {
  test('splits a namespace/repository Docker Hub repo name', () => {
    expect(splitRepo('commandoss/auth-proxy')).toEqual({
      namespace: 'commandoss',
      repository: 'auth-proxy',
    })
  })

  test('summarizes a README title and first paragraph', () => {
    expect(
      summarizeMarkdown(`# Auth Proxy

Forward authenticated requests.
Continues on the same paragraph.

## Usage
Run it.`)
    ).toEqual({
      title: 'Auth Proxy',
      firstParagraph:
        'Forward authenticated requests. Continues on the same paragraph.',
    })
  })

  test('normalizes Docker Hub short descriptions to 100 characters', () => {
    const text =
      '  A description\nwith extra    spacing and a long tail that exceeds the Docker Hub short description field limit.  '

    expect(normalizeShortDescription(text)).toBe(
      'A description with extra spacing and a long tail that exceeds the Docker Hub short description fi...'
    )
  })
})
