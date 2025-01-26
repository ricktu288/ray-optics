<template>
  <div class="modal fade" id="colorModeModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_colorMode" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_colorMode" v-html="$t('simulator:settings.colorMode.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="form-check">
            <input class="form-check-input" type="radio" name="colorMode" id="colorMode_linear" value="linear"
              v-model="colorMode">
            <label class="form-check-label" for="colorMode_linear" v-html="$t('simulator:colorModeModal.linear.title')"></label>
            <div class="form-text" v-html="$t('simulator:colorModeModal.linear.description')"></div>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="colorMode" id="colorMode_linearRGB" value="linearRGB"
              v-model="colorMode">
            <label class="form-check-label" for="colorMode_linearRGB" v-html="$t('simulator:colorModeModal.linearRGB.title')"></label>
            <div class="form-text" v-html="$t('simulator:colorModeModal.linearRGB.description')"></div>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="colorMode" id="colorMode_reinhard" value="reinhard"
              v-model="colorMode">
            <label class="form-check-label" for="colorMode_reinhard" v-html="$t('simulator:colorModeModal.reinhard.title')"></label>
            <div class="form-text" v-html="$t('simulator:colorModeModal.reinhard.description')"></div>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="colorMode" id="colorMode_colorizedIntensity" value="colorizedIntensity"
              v-model="colorMode">
            <label class="form-check-label" for="colorMode_colorizedIntensity" v-html="$t('simulator:colorModeModal.colorizedIntensity.title')"></label>
            <div class="form-text" v-html="$t('simulator:colorModeModal.colorizedIntensity.description')"></div>
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

export default {
  name: 'ColorModeModal',
  setup() {
    const store = useSceneStore()
    return {
      colorMode: store.colorMode
    }
  }
}
</script>
