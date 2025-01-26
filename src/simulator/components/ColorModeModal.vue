<template>
  <div class="modal fade" id="colorModeModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_colorMode" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_colorMode" v-html="$t('simulator:settings.colorMode.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="form-check" v-for="mode in COLOR_MODES" :key="mode">
            <input class="form-check-input" type="radio" name="colorMode" :id="'colorMode_' + mode" :value="mode"
              v-model="colorMode">
            <label class="form-check-label" :for="'colorMode_' + mode" v-html="$t(`simulator:colorModeModal.${mode}.title`)"></label>
            <div class="form-text" v-html="$t(`simulator:colorModeModal.${mode}.description`)"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" v-html="$t('simulator:common.closeButton')"></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useSceneStore } from '../store/scene'

const COLOR_MODES = [
  'linear',
  'linearRGB',
  'reinhard',
  'colorizedIntensity'
]

export default {
  name: 'ColorModeModal',
  setup() {
    const store = useSceneStore()

    return {
      colorMode: store.colorMode,
      COLOR_MODES
    }
  }
}
</script>
