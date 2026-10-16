import { describe, expect, it } from 'vitest'

import {
  extractJobGenerationDetails,
  extractJobPromptGraph,
  hasJobGenerationDetails
} from '@/utils/jobGenerationDetails'

describe('extractJobGenerationDetails', () => {
  it('extracts seeds, linked lora strength, and prompts', () => {
    const prompt = {
      '4': {
        class_type: 'LoraLoaderModelOnly',
        inputs: {
          lora_name: 'z-image/personas/bibi_lnx_v1.safetensors',
          strength_model: ['12', 0],
          model: ['1', 0]
        },
        _meta: { title: 'in:lora' }
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'bibi_lnx, young woman',
          clip: ['5', 0]
        },
        _meta: { title: 'in:prompt' }
      },
      '9': {
        class_type: 'KSampler',
        inputs: {
          seed: 2003,
          model: ['4', 0]
        },
        _meta: { title: 'in:seed' }
      },
      '12': {
        class_type: 'Mistralys_RandomFloat',
        inputs: {
          range_from: 0.5,
          range_to: 1.0,
          value: 0.8
        },
        _meta: { title: 'in:lora_strength' }
      }
    }

    expect(extractJobGenerationDetails(prompt)).toEqual({
      seeds: [{ nodeName: 'in:seed', value: '2003' }],
      strengths: [{ loraName: 'bibi_lnx_v1.safetensors', value: '0.8' }],
      prompts: [{ nodeName: 'in:prompt', value: 'bibi_lnx, young woman' }]
    })
  })

  it('extracts multiple seeds and noise_seed', () => {
    const prompt = {
      '1': {
        class_type: 'KSampler',
        inputs: { seed: 11 },
        _meta: { title: 'in:image_seed' }
      },
      '2': {
        class_type: 'RandomNoise',
        inputs: { noise_seed: 22 },
        _meta: { title: 'in:seed' }
      }
    }

    expect(extractJobGenerationDetails(prompt).seeds).toEqual([
      { nodeName: 'in:image_seed', value: '11' },
      { nodeName: 'in:seed', value: '22' }
    ])
  })

  it('reads prompt from prompt input on TextEncode nodes', () => {
    const prompt = {
      '11': {
        class_type: 'TextEncodeQwenImageEditPlus',
        inputs: { prompt: 'head_swap: keep lighting' },
        _meta: { title: 'in:prompt' }
      }
    }

    expect(extractJobGenerationDetails(prompt).prompts).toEqual([
      { nodeName: 'in:prompt', value: 'head_swap: keep lighting' }
    ])
  })

  it('returns empty details for invalid prompt', () => {
    expect(extractJobGenerationDetails(undefined)).toEqual({
      seeds: [],
      strengths: [],
      prompts: []
    })
    expect(hasJobGenerationDetails(extractJobGenerationDetails({}))).toBe(false)
  })
})

describe('extractJobPromptGraph', () => {
  it('returns workflow.prompt even when an editor workflow is embedded', () => {
    const apiPrompt = {
      '9': {
        class_type: 'KSampler',
        inputs: { seed: 7 },
        _meta: { title: 'in:seed' }
      }
    }

    const graph = extractJobPromptGraph({
      id: 'job-1',
      status: 'completed',
      create_time: 1,
      outputs_count: null,
      previewable_outputs_count: null,
      priority: 0,
      workflow: {
        prompt: apiPrompt,
        extra_data: {
          extra_pnginfo: {
            workflow: { nodes: [], links: [] }
          }
        }
      }
    })

    expect(graph).toEqual(apiPrompt)
    expect(extractJobGenerationDetails(graph).seeds).toEqual([
      { nodeName: 'in:seed', value: '7' }
    ])
  })
})
