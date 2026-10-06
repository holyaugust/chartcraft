export const MAX_WRITE_REFERENCE_FILES = 5

export const WRITE_REFERENCE_ACCEPT =
  '.docx,.doc,.txt,.md,.markdown,.pdf,.xlsx,.xls,.csv,.pptx,.jpg,.jpeg,.png,.webp,.gif'

export function takeReferenceUploadBatch<T>(
  existingCount: number,
  incoming: T[],
  max = MAX_WRITE_REFERENCE_FILES,
): { accepted: T[]; ignoredCount: number; atCapacity: boolean } {
  const room = Math.max(0, max - existingCount)
  if (room === 0) {
    return { accepted: [], ignoredCount: incoming.length, atCapacity: true }
  }
  return {
    accepted: incoming.slice(0, room),
    ignoredCount: Math.max(0, incoming.length - room),
    atCapacity: false,
  }
}
