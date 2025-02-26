<template>
  <template v-if="layout === 'desktop'">
    <div class="dropdown">
      <button 
        class="btn shadow-none btn-primary dropdown-toggle" 
        type="button" 
        :id="id + 'ToolsDropdown'" 
        data-bs-toggle="dropdown" 
        aria-expanded="false"
      >{{ title }}</button>
      <ul class="dropdown-menu" :aria-labelledby="id + 'ToolsDropdown'">
        <slot></slot>
      </ul>
    </div>
  </template>

  <template v-if="layout === 'mobile'">
    <ul :id="'mobile-dropdown-' + id" style="display:none">
      <slot></slot>
    </ul>
  </template>
</template>

<script>
export default {
  name: 'ToolsCategory',
  props: {
    id: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    layout: {
      type: String,
      required: true
    }
  }
}
</script>
