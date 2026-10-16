<template>
  <div v-if="hasAny" class="flex flex-col gap-2">
    <div
      v-if="details.seeds.length || details.strengths.length"
      class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1"
    >
      <template v-for="(seed, index) in details.seeds" :key="`seed-${index}`">
        <div class="text-xs/normal font-normal text-text-primary">
          {{ t('queue.jobDetails.seedLabel', { name: seed.nodeName }) }}
        </div>
        <div
          class="min-w-0 truncate text-xs/normal font-normal text-text-secondary"
        >
          {{ seed.value }}
        </div>
      </template>
      <template
        v-for="(strength, index) in details.strengths"
        :key="`strength-${index}`"
      >
        <div class="text-xs/normal font-normal text-text-primary">
          {{ t('queue.jobDetails.strengthLabel', { name: strength.loraName }) }}
        </div>
        <div
          class="min-w-0 truncate text-xs/normal font-normal text-text-secondary"
        >
          {{ strength.value }}
        </div>
      </template>
    </div>

    <div v-if="details.prompts.length" class="flex flex-col gap-1">
      <CollapsibleRoot
        v-for="(prompt, index) in details.prompts"
        :key="`prompt-${index}-${prompt.nodeName}`"
        v-slot="{ open }"
        :default-open="false"
      >
        <CollapsibleTrigger
          class="flex w-full items-center gap-1 rounded-sm text-left text-xs/normal font-normal text-text-primary hover:bg-interface-panel-hover-surface"
          :aria-label="
            open
              ? t('queue.jobDetails.collapsePrompt')
              : t('queue.jobDetails.expandPrompt')
          "
        >
          <i
            :class="
              cn(
                'icon-[lucide--chevron-right] size-3.5 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-90'
              )
            "
          />
          <span class="min-w-0 truncate">{{
            t('queue.jobDetails.promptLabel', { name: prompt.nodeName })
          }}</span>
        </CollapsibleTrigger>
        <CollapsibleContent
          class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
        >
          <div
            class="mt-1 max-h-40 overflow-y-auto rounded-sm bg-interface-panel-hover-surface px-2 py-1.5 text-xs/normal wrap-break-word whitespace-pre-wrap text-text-secondary"
          >
            {{ prompt.value }}
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import type { JobGenerationDetails } from '@/utils/jobGenerationDetails'
import { hasJobGenerationDetails } from '@/utils/jobGenerationDetails'

const { details } = defineProps<{
  details: JobGenerationDetails
}>()

const { t } = useI18n()

const hasAny = computed(() => hasJobGenerationDetails(details))
</script>
