<!--
  Copyright 2026 The Ray Optics Simulation authors and contributors

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
  <div class="sidebar-item-list" role="list" ref="listRoot" @dragover.prevent="onDragOverList" @drop.prevent="onDropList" @click.stop>
    <div class="sidebar-item-list-rows">
      <div
        v-for="(item, index) in items"
        :key="itemKeyValue(item, index)"
      class="sidebar-item-list-row"
        :class="rowClasses(index)"
        :style="rowStyle(index)"
        :data-index="index"
        role="listitem"
        @dragover.prevent
        @dragenter.prevent="onDragEnter(index)"
        @drop="onDrop(index)"
      @mouseenter="onRowHover(item, index)"
      @mouseleave="onRowLeave"
      @click="onRowClick(item, index)"
      >
        <div class="sidebar-item-list-left">
        <label class="sidebar-item-checkbox" :class="{ 'is-checked': isSelected(item, index) }" @click.stop>
            <input
              type="checkbox"
              class="sidebar-item-checkbox-input"
              :checked="isSelected(item, index)"
              @change="onToggleSelect($event, item, index)"
            >
            <span class="sidebar-item-checkbox-mark" aria-hidden="true"></span>
          </label>
          <button
            type="button"
            class="sidebar-item-drag sidebar-item-control"
            draggable="true"
            aria-label="Drag to reorder"
            @dragstart="onDragStart($event, index)"
            @dragend="onDragEnd"
            @pointerdown="onPointerDragStart($event, index)"
          @click.stop
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm8-10a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
            </svg>
          </button>
        </div>

        <div class="sidebar-item-list-content">
          <slot name="content" :item="item" :index="index" />
        </div>

        <div class="sidebar-item-list-actions">
          <button
            type="button"
            class="sidebar-item-action sidebar-item-control"
            aria-label="Duplicate item"
            @click="$emit('duplicate', item, index)"
          @click.stop
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 9.766 9.766">
              <g transform="matrix(.01973 0 0 .01973 .0020532 .061476)">
                <path d="m314.25 85.4h-227c-21.3 0-38.6 17.3-38.6 38.6v325.7c0 21.3 17.3 38.6 38.6 38.6h227c21.3 0 38.6-17.3 38.6-38.6v-325.7c-0.1-21.3-17.4-38.6-38.6-38.6zm11.5 364.2c0 6.4-5.2 11.6-11.6 11.6h-227c-6.4 0-11.6-5.2-11.6-11.6v-325.6c0-6.4 5.2-11.6 11.6-11.6h227c6.4 0 11.6 5.2 11.6 11.6z"/>
                <path d="m401.05 0h-227c-21.3 0-38.6 17.3-38.6 38.6 0 7.5 6 13.5 13.5 13.5s13.5-6 13.5-13.5c0-6.4 5.2-11.6 11.6-11.6h227c6.4 0 11.6 5.2 11.6 11.6v325.7c0 6.4-5.2 11.6-11.6 11.6-7.5 0-13.5 6-13.5 13.5s6 13.5 13.5 13.5c21.3 0 38.6-17.3 38.6-38.6v-325.7c0-21.3-17.3-38.6-38.6-38.6z"/>
              </g>
            </svg>
          </button>
          <button
            type="button"
            class="sidebar-item-action sidebar-item-control"
            aria-label="Delete item"
            @click="$emit('remove', item, index)"
          @click.stop
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <button v-if="showAddButton" type="button" class="sidebar-item-list-add" @click="$emit('create')">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
        <path d="M8 4a.5.5 0 0 1 .5.5V7.5H11.5a.5.5 0 0 1 0 1H8.5V11.5a.5.5 0 0 1-1 0V8.5H4.5a.5.5 0 0 1 0-1H7.5V4.5A.5.5 0 0 1 8 4z"/>
      </svg>
      <span>New item</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'SidebarItemList',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    selectedIds: {
      type: Array,
      default: () => []
    },
    itemKey: {
      type: String,
      default: 'id'
    },
    activeId: {
      type: [String, Number, null],
      default: null
    },
    showAddButton: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:selectedIds', 'remove', 'duplicate', 'reorder', 'create', 'selection-change', 'hover', 'select'],
  data() {
    return {
      dragIndex: null,
      hoverIndex: null,
      rowShiftPx: 12,
      didDrop: false,
      pointerDragActive: false,
      pointerId: null
    }
  },
  beforeUnmount() {
    this.detachPointerListeners()
  },
  methods: {
    itemKeyValue(item, index) {
      if (item && Object.prototype.hasOwnProperty.call(item, this.itemKey)) {
        return item[this.itemKey]
      }
      return index
    },
    isSelected(item, index) {
      const key = this.itemKeyValue(item, index)
      return this.selectedIds.includes(key)
    },
    isActive(item, index) {
      const key = this.itemKeyValue(item, index)
      return this.activeId !== null && this.activeId === key
    },
    onToggleSelect(event, item, index) {
      const key = this.itemKeyValue(item, index)
      const next = new Set(this.selectedIds)
      if (event.target.checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      const nextArray = Array.from(next)
      this.$emit('update:selectedIds', nextArray)
      this.$emit('selection-change', {
        item,
        index,
        selected: event.target.checked,
        selectedIds: nextArray
      })
    },
    onDragStart(event, index) {
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', `${index}`)
      }
      this.dragIndex = index
      this.didDrop = false
    },
    onDragEnd() {
      if (this.dragIndex !== null && this.hoverIndex !== null && !this.didDrop) {
        this.emitReorder(this.hoverIndex)
      }
      this.resetDragState()
    },
    onDragOverList(event) {
      if (this.dragIndex === null) {
        return
      }
      const index = this.indexFromEventTarget(event.target)
      if (index !== null) {
        this.hoverIndex = index
        return
      }
      const listBounds = this.getListBounds()
      if (!listBounds) {
        return
      }
      if (event.clientY <= listBounds.top) {
        this.hoverIndex = 0
      } else if (event.clientY >= listBounds.bottom) {
        this.hoverIndex = Math.max(this.items.length - 1, 0)
      }
    },
    onDropList() {
      if (this.dragIndex === null || this.hoverIndex === null) {
        this.resetDragState()
        return
      }
      this.emitReorder(this.hoverIndex)
      this.didDrop = true
      this.resetDragState()
    },
    onDragEnter(index) {
      if (this.dragIndex === null) {
        return
      }
      this.hoverIndex = index
    },
    onDrop(targetIndex) {
      if (this.dragIndex === null || this.dragIndex === targetIndex) {
        return
      }
      this.emitReorder(targetIndex)
      this.didDrop = true
      this.resetDragState()
    },
    onRowHover(item, index) {
      this.$emit('hover', { item, index })
    },
    onRowLeave() {
      this.$emit('hover', { item: null, index: -1 })
    },
    onRowClick(item, index) {
      this.$emit('select', { item, index })
    },
    onPointerDragStart(event, index) {
      if (event.pointerType === 'mouse') {
        return
      }
      event.preventDefault()
      this.pointerDragActive = true
      this.pointerId = event.pointerId
      this.dragIndex = index
      this.hoverIndex = index
      this.didDrop = false
      this.attachPointerListeners()
    },
    onPointerMove(event) {
      if (!this.pointerDragActive || (this.pointerId !== null && event.pointerId !== this.pointerId)) {
        return
      }
      const index = this.indexFromPoint(event.clientX, event.clientY)
      if (index !== null) {
        this.hoverIndex = index
        return
      }
      const listBounds = this.getListBounds()
      if (!listBounds) {
        return
      }
      if (event.clientY <= listBounds.top) {
        this.hoverIndex = 0
      } else if (event.clientY >= listBounds.bottom) {
        this.hoverIndex = Math.max(this.items.length - 1, 0)
      }
    },
    onPointerUp(event) {
      if (!this.pointerDragActive || (this.pointerId !== null && event.pointerId !== this.pointerId)) {
        return
      }
      if (this.dragIndex !== null && this.hoverIndex !== null && this.dragIndex !== this.hoverIndex) {
        this.emitReorder(this.hoverIndex)
      }
      this.detachPointerListeners()
      this.resetDragState()
    },
    onPointerCancel(event) {
      if (this.pointerId !== null && event.pointerId !== this.pointerId) {
        return
      }
      this.detachPointerListeners()
      this.resetDragState()
    },
    emitReorder(targetIndex) {
      if (this.dragIndex === null || this.dragIndex === targetIndex) {
        return
      }
      this.$emit('reorder', {
        fromIndex: this.dragIndex,
        toIndex: targetIndex,
        item: this.items[this.dragIndex]
      })
    },
    resetDragState() {
      this.dragIndex = null
      this.hoverIndex = null
      this.didDrop = false
      this.pointerDragActive = false
      this.pointerId = null
    },
    indexFromEventTarget(target) {
      const row = target?.closest ? target.closest('.sidebar-item-list-row') : null
      if (!row || !row.dataset) {
        return null
      }
      const index = Number(row.dataset.index)
      return Number.isNaN(index) ? null : index
    },
    indexFromPoint(clientX, clientY) {
      if (typeof document === 'undefined') {
        return null
      }
      const el = document.elementFromPoint(clientX, clientY)
      if (!el) {
        return null
      }
      return this.indexFromEventTarget(el)
    },
    getListBounds() {
      const listRoot = this.$refs.listRoot
      if (!listRoot || typeof listRoot.getBoundingClientRect !== 'function') {
        return null
      }
      return listRoot.getBoundingClientRect()
    },
    attachPointerListeners() {
      window.addEventListener('pointermove', this.onPointerMove)
      window.addEventListener('pointerup', this.onPointerUp)
      window.addEventListener('pointercancel', this.onPointerCancel)
    },
    detachPointerListeners() {
      window.removeEventListener('pointermove', this.onPointerMove)
      window.removeEventListener('pointerup', this.onPointerUp)
      window.removeEventListener('pointercancel', this.onPointerCancel)
    },
    rowClasses(index) {
      const isDropTarget = this.hoverIndex === index && this.dragIndex !== null
      return {
        'is-dragging': this.dragIndex === index,
        'is-drop-target': isDropTarget,
        'is-drop-before': isDropTarget && this.dragIndex > index,
        'is-drop-after': isDropTarget && this.dragIndex < index,
        'is-selected': this.isActive(this.items[index], index)
      }
    },
    rowStyle(index) {
      if (this.dragIndex === null || this.hoverIndex === null || this.dragIndex === this.hoverIndex) {
        return null
      }
      const isBetweenDown = this.dragIndex < this.hoverIndex
        && index > this.dragIndex
        && index <= this.hoverIndex
      const isBetweenUp = this.dragIndex > this.hoverIndex
        && index >= this.hoverIndex
        && index < this.dragIndex
      if (isBetweenDown) {
        return { transform: `translateY(-${this.rowShiftPx}px)` }
      }
      if (isBetweenUp) {
        return { transform: `translateY(${this.rowShiftPx}px)` }
      }
      return null
    }
  }
}
</script>

<style scoped>
.sidebar-item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-item-list-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.sidebar-item-list-row {
  display: flex;
  align-items: stretch;
  padding: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  position: relative;
}

.sidebar-item-list-row.is-dragging {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
  transform: scale(1.01);
  z-index: 2;
}

.sidebar-item-list-row.is-drop-target {
  background: rgba(255, 255, 255, 0.1);
}

.sidebar-item-list-row.is-selected {
  background: rgba(86, 219, 240, 0.25);
}

.sidebar-item-list-row.is-drop-before::before,
.sidebar-item-list-row.is-drop-after::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  background: rgba(120, 198, 255, 0.9);
  border-radius: 999px;
  box-shadow: 0 0 6px rgba(120, 198, 255, 0.7);
}

.sidebar-item-list-row.is-drop-before::before {
  top: -3px;
}

.sidebar-item-list-row.is-drop-after::after {
  bottom: -3px;
}

.sidebar-item-list-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.75);
}

.sidebar-item-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
}

.sidebar-item-checkbox-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.sidebar-item-checkbox-mark {
  width: 14px;
  height: 14px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  position: relative;
  box-sizing: border-box;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.sidebar-item-checkbox-mark::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 1px;
  width: 4px;
  height: 7px;
  border: solid rgba(255, 255, 255, 0.9);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  opacity: 0;
}

.sidebar-item-checkbox.is-checked {
  opacity: 1;
  pointer-events: auto;
}

.sidebar-item-checkbox.is-checked .sidebar-item-checkbox-mark {
  background: rgba(86, 219, 240, 0.35);
  border-color: rgba(86, 219, 240, 0.75);
  box-shadow: 0 0 0 1px rgba(86, 219, 240, 0.25);
}

.sidebar-item-checkbox.is-checked .sidebar-item-checkbox-mark::after {
  opacity: 1;
}

.sidebar-item-drag {
  border: none;
  padding: 1px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: grab;
  opacity: 0;
  pointer-events: none;
  touch-action: none;
}

.sidebar-item-list-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.sidebar-item-list-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: rgba(255, 255, 255, 0.75);
}

.sidebar-item-action {
  border: none;
  background: transparent;
  padding: 1px;
  color: inherit;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
}

.sidebar-item-list-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.35);
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.sidebar-item-list-row:hover .sidebar-item-control,
.sidebar-item-list-row:hover .sidebar-item-checkbox {
  opacity: 1;
  pointer-events: auto;
}
</style>
