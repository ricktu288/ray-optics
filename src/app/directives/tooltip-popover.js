/*
 * Copyright 2025 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as bootstrap from 'bootstrap'

/**
 * Vue directive for handling Bootstrap tooltips and popovers
 * Usage:
 * - For tooltips: v-tooltip-popover="{ title: 'Tooltip text' }"
 * - For popovers: v-tooltip-popover:popover="{ title: 'Title', content: 'Content', popoverImage: 'image.svg' }"
 */
export const vTooltipPopover = {
  mounted(el, binding) {
    const options = binding.value || {}
    const isPopover = binding.arg === 'popover'
    
    // Store initial options for comparison in updates
    el._lastOptions = { ...options }
    el._lastIsPopover = isPopover
    
    if (isPopover) {
      let content = options.content || ''
      if (options.popoverImage) {
        content = `<img src="../img/${options.popoverImage}" class="popover-image" id="dynamic-popover-image">${content}`
      }

      const popoverConfig = {
        title: options.title || '',
        content,
        trigger: options.trigger || 'hover',
        html: options.html !== false
      }
      
      if (options.placement) {
        popoverConfig.placement = options.placement
      }
      if (options.offset) {
        popoverConfig.offset = options.offset
      }

      const popover = new bootstrap.Popover(el, popoverConfig)

      if (options.popoverImage) {
        el.addEventListener('inserted.bs.popover', () => {
          const imgElement = document.querySelectorAll('#dynamic-popover-image')
          if (imgElement.length > 0) {
            imgElement[imgElement.length - 1].addEventListener('load', () => {
              popover.update()
            })
          }
        })
      }

      // Store popover instance for cleanup
      el._popover = popover
    } else if (options.title) { // Only create tooltip if title is provided
      const tooltipConfig = {
        title: options.title,
        trigger: options.trigger || 'hover',
        placement: options.placement || 'bottom'
      }
      
      if (options.offset) {
        tooltipConfig.offset = options.offset
      }

      const tooltip = new bootstrap.Tooltip(el, tooltipConfig)

      // Store tooltip instance for cleanup
      el._tooltip = tooltip
    }
  },
  
  updated(el, binding) {
    const options = binding.value || {}
    const isPopover = binding.arg === 'popover'
    const oldOptions = el._lastOptions || {}
    const oldIsPopover = el._lastIsPopover
    console.log('updated', el, options, oldOptions)
    
    // Store new options and arg for future comparison
    el._lastOptions = { ...options }
    el._lastIsPopover = isPopover
    
    // Only update if options or type have changed
    if (JSON.stringify(options) === JSON.stringify(oldOptions) && isPopover === oldIsPopover) {
      return
    }

    console.log('actually updated');

    // Clean up any existing instances
    if (el._popover) {
      el._popover.dispose()
      el._popover = null
    }
    if (el._tooltip) {
      el._tooltip.dispose()
      el._tooltip = null
    }
    
    if (isPopover) {
      let content = options.content || ''
      if (options.popoverImage) {
        content = `<img src="../img/${options.popoverImage}" class="popover-image" id="dynamic-popover-image">${content}`
      }

      const popoverConfig = {
        title: options.title || '',
        content,
        trigger: options.trigger || 'hover',
        html: options.html !== false
      }
      
      if (options.placement) {
        popoverConfig.placement = options.placement
      }
      if (options.offset) {
        popoverConfig.offset = options.offset
      }

      el._popover = new bootstrap.Popover(el, popoverConfig)

      if (options.popoverImage) {
        el.addEventListener('inserted.bs.popover', () => {
          const imgElement = document.querySelectorAll('#dynamic-popover-image')
          if (imgElement.length > 0) {
            imgElement[imgElement.length - 1].addEventListener('load', () => {
              el._popover.update()
            })
          }
        })
      }
    } else if (options.title) { // Only create tooltip if title is provided
      const tooltipConfig = {
        title: options.title,
        trigger: options.trigger || 'hover',
        placement: options.placement || 'bottom'
      }
      
      if (options.offset) {
        tooltipConfig.offset = options.offset
      }

      el._tooltip = new bootstrap.Tooltip(el, tooltipConfig)
    }
  },
  
  unmounted(el) {
    if (el._popover) {
      el._popover.dispose()
      el._popover = null
    }
    if (el._tooltip) {
      el._tooltip.dispose()
      el._tooltip = null
    }
  }
}
