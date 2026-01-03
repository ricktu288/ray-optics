<template>
  <div class="module-editor">
    <div class="module-editor-title">
      Module:
      <span class="module-editor-module-name">{{ moduleName }}</span>
    </div>
    <div class="module-editor-body">
      Dummy UI (coming soon).
    </div>
  </div>
</template>

<script>
export default {
  name: 'ModuleEditor',
  props: {
    moduleName: { type: String, required: true }
  }
}
</script>

<style scoped>
.module-editor-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.module-editor-module-name {
  font-family: monospace;
}

.module-editor-body {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
}
</style>


