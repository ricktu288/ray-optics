<!--
  Copyright 2025 The Ray Optics Simulation authors and contributors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<template>
  <span
    ref="iconEl"
    class="info-icon info-popover-icon"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    v-tooltip-popover:popover="popoverOptions"
    @keydown.enter.prevent="onKeyActivate"
    @keydown.space.prevent="onKeyActivate"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      class="bi bi-info-circle"
      viewBox="0 0 16 16"
    >
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
      <path
        d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
      />
    </svg>
  </span>
</template>

<script>
import { computed, ref } from 'vue'
import { vTooltipPopover } from '../directives/tooltip-popover'

export default {
  name: 'InfoPopoverIcon',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    title: { type: String, default: '' },
    content: { type: String, required: true },
    ariaLabel: { type: String, default: 'Info' },
    trigger: { type: String, default: 'click' },
    placement: { type: String, default: 'bottom' },
    html: { type: Boolean, default: true },
    offset: { type: [String, Array], default: undefined },
    popoverImage: { type: String, default: '' }
  },
  setup(props) {
    const iconEl = ref(null)

    const popoverOptions = computed(() => ({
      title: props.title || '',
      content: props.content,
      trigger: props.trigger,
      placement: props.placement,
      html: props.html,
      offset: props.offset,
      popoverImage: props.popoverImage || undefined
    }))

    const onKeyActivate = () => {
      // Bootstrap popovers trigger on click; mirror that for keyboard users.
      iconEl.value?.click?.()
    }

    return {
      iconEl,
      popoverOptions,
      onKeyActivate
    }
  }
}
</script>

<style scoped>
.info-popover-icon {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
</style>

