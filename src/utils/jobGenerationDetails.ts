import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'
import { zWorkflowContainer } from '@/platform/remote/comfyui/jobs/jobTypes'

type ApiNode = {
  class_type?: string
  inputs?: Record<string, unknown>
  _meta?: { title?: string }
}

type JobSeedDetail = { nodeName: string; value: string }
type JobLoraStrengthDetail = { loraName: string; value: string }
type JobPromptDetail = { nodeName: string; value: string }

export type JobGenerationDetails = {
  seeds: JobSeedDetail[]
  strengths: JobLoraStrengthDetail[]
  prompts: JobPromptDetail[]
}

function isApiPrompt(value: unknown): value is Record<string, ApiNode> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every(
      (node) =>
        !!node &&
        typeof node === 'object' &&
        !Array.isArray(node) &&
        typeof (node as ApiNode).class_type === 'string'
    )
  )
}

/** API-format prompt graph from a job detail, even when an editor workflow is embedded. */
export function extractJobPromptGraph(
  job: JobDetail | undefined
): Record<string, ApiNode> | undefined {
  const parsed = zWorkflowContainer.safeParse(job?.workflow)
  if (!parsed.success) return undefined
  return isApiPrompt(parsed.data.prompt) ? parsed.data.prompt : undefined
}

function isLink(value: unknown): value is [string, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'number'
  )
}

function resolveValue(
  prompt: Record<string, ApiNode>,
  value: unknown,
  depth = 0
): unknown {
  if (depth > 8 || !isLink(value)) return value
  if (!(value[0] in prompt)) return value
  const inputs = prompt[value[0]].inputs
  if (!inputs) return value

  for (const key of [
    'value',
    'text',
    'string',
    'prompt',
    'seed',
    'noise_seed',
    'number',
    'int',
    'float'
  ] as const) {
    if (key in inputs) {
      return resolveValue(prompt, inputs[key], depth + 1)
    }
  }

  const first = Object.values(inputs)[0]
  return first === undefined ? value : resolveValue(prompt, first, depth + 1)
}

function nodeName(id: string, node: ApiNode): string {
  const title = node._meta?.title?.trim()
  if (title) return title
  if (node.class_type) return node.class_type
  return id
}

function loraBaseName(name: string): string {
  const parts = name.split(/[/\\]/)
  return parts[parts.length - 1] || name
}

function formatScalar(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const asNumber = Number(value)
    if (
      value.trim() !== '' &&
      Number.isFinite(asNumber) &&
      /^-?\d/.test(value)
    ) {
      return String(asNumber)
    }
    return value
  }
  return undefined
}

function formatNumber(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) return String(asNumber)
  }
  return undefined
}

function promptText(inputs: Record<string, unknown>): string | undefined {
  for (const key of ['text', 'prompt', 'string'] as const) {
    const raw = inputs[key]
    if (typeof raw === 'string' && raw.trim() !== '') return raw
  }
  return undefined
}

function isPromptNode(node: ApiNode, textKeyPresent: boolean): boolean {
  const classType = node.class_type ?? ''
  const title = (node._meta?.title ?? '').toLowerCase()
  if (/textencode/i.test(classType)) return true
  if (title.includes('prompt')) return true
  if (textKeyPresent && /cliptext|prompt/i.test(classType)) return true
  return false
}

export function extractJobGenerationDetails(
  prompt: unknown
): JobGenerationDetails {
  if (!isApiPrompt(prompt)) {
    return { seeds: [], strengths: [], prompts: [] }
  }

  const seeds: JobSeedDetail[] = []
  const strengths: JobLoraStrengthDetail[] = []
  const prompts: JobPromptDetail[] = []

  for (const [id, node] of Object.entries(prompt)) {
    const inputs = node.inputs
    if (!inputs) continue
    const name = nodeName(id, node)

    for (const key of ['seed', 'noise_seed'] as const) {
      if (!(key in inputs)) continue
      const formatted = formatScalar(resolveValue(prompt, inputs[key]))
      if (formatted === undefined) continue
      seeds.push({ nodeName: name, value: formatted })
    }

    const loraRaw = resolveValue(prompt, inputs.lora_name)
    if (typeof loraRaw === 'string' && loraRaw.trim() !== '') {
      const strengthRaw =
        inputs.strength_model ??
        inputs.model_strength ??
        inputs.strength_clip ??
        inputs.strength
      const strength = formatNumber(resolveValue(prompt, strengthRaw))
      if (strength !== undefined) {
        strengths.push({
          loraName: loraBaseName(loraRaw),
          value: strength
        })
      }
    }

    const text = promptText(
      Object.fromEntries(
        Object.entries(inputs).map(([k, v]) => [k, resolveValue(prompt, v)])
      )
    )
    if (text && isPromptNode(node, 'text' in inputs || 'prompt' in inputs)) {
      prompts.push({ nodeName: name, value: text })
    }
  }

  return { seeds, strengths, prompts }
}

export function hasJobGenerationDetails(
  details: JobGenerationDetails | null | undefined
): boolean {
  if (!details) return false
  return (
    details.seeds.length > 0 ||
    details.strengths.length > 0 ||
    details.prompts.length > 0
  )
}

/**
 * Flatten resolved scalar inputs from an API prompt graph to `node.input → value`.
 * Links are followed; model/latent wires that stay as links are skipped.
 */
export function flattenJobPromptFields(
  prompt: unknown
): Record<string, string> {
  if (!isApiPrompt(prompt)) return {}

  const fields: Record<string, string> = {}
  for (const [id, node] of Object.entries(prompt)) {
    const inputs = node.inputs
    if (!inputs) continue
    const name = nodeName(id, node)
    for (const [key, raw] of Object.entries(inputs)) {
      const resolved = resolveValue(prompt, raw)
      if (typeof resolved === 'boolean') {
        fields[`${name}.${key}`] = String(resolved)
        continue
      }
      const scalar = formatScalar(resolved)
      if (scalar !== undefined) {
        fields[`${name}.${key}`] = scalar
      }
    }
  }
  return fields
}

/** UI-facing rows we already extract, as flat key → value. */
export function flattenJobGenerationDetails(
  details: JobGenerationDetails
): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const seed of details.seeds) {
    fields[`seed (${seed.nodeName})`] = seed.value
  }
  for (const strength of details.strengths) {
    fields[`strength (${strength.loraName})`] = strength.value
  }
  for (const prompt of details.prompts) {
    fields[`prompt (${prompt.nodeName})`] = prompt.value
  }
  return fields
}
