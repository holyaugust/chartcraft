import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), './DocumentWorkspace.tsx'),
  'utf8',
)

describe('DocumentWorkspace layout genre suggestion', () => {
  it('stores promptContext.genreId and passes it into suggestLayoutGenre', () => {
    expect(workspaceSource).toContain('setProofreadGenreId(promptContext.genreId)')
    expect(workspaceSource).toMatch(/suggestLayoutGenre\(\s*proofreadGenreId\s*,\s*content\s*\)/)
    expect(workspaceSource).not.toMatch(/suggestLayoutGenre\(\s*null\s*,\s*content\s*\)/)
  })
})
