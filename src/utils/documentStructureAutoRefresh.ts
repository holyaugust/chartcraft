/** 准备文档阶段改过正文后，进入结构梳理时是否自动重新梳理 */
export function shouldAutoRerunStructureAfterPrepare(input: {
  workflowStep: string
  prepareContentChanged: boolean
  hasContent: boolean
  structureBusy: boolean
  hasStructureReport: boolean
  structureStale: boolean
}): boolean {
  if (input.workflowStep !== 'structure') return false
  if (!input.prepareContentChanged) return false
  if (!input.hasContent || input.structureBusy) return false
  if (!input.hasStructureReport) return true
  return input.structureStale
}
