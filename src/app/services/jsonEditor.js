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
import * as ace from 'ace-builds';
import "ace-builds/webpack-resolver";
import 'ace-builds/src-noconflict/theme-github_dark';
import 'ace-builds/src-noconflict/mode-json';
import "ace-builds/src-noconflict/worker-json";
import { Range } from 'ace-builds';
import { app } from '../services/app'
import { CustomJsonMode } from '../utils/customJsonMode'

/**
 * Service to manage the JSON editor instance and its interactions with the scene
 */
class JsonEditorService {
  constructor() {
    this.aceEditor = null
    this.debounceTimer = null
    this.lastCodeChangeIsFromScene = false
    this.manualParse = false
    this.isSynced = true
  }

  /**
   * Initialize the JSON editor with the given content
   */
  initialize() {
    if (this.aceEditor) return

    this.aceEditor = ace.edit("jsonEditor")
    this.aceEditor.setTheme("ace/theme/github_dark")
    this.aceEditor.session.setMode(new CustomJsonMode())
    this.aceEditor.session.setUseWrapMode(true)
    this.aceEditor.session.setUseSoftTabs(true)
    this.aceEditor.session.setTabSize(2)
    this.aceEditor.setHighlightActiveLine(false)
    this.aceEditor.container.style.background = "transparent"
    this.aceEditor.container.getElementsByClassName('ace_gutter')[0].style.background = "transparent"
    
    // Set initial content
    this.aceEditor.session.setValue(app.editor?.lastActionJson ?? '')
    this.isSynced = true

    // Set up change listener
    this.aceEditor.session.on('change', this.handleEditorChange.bind(this))
  }

  /**
   * Handle changes in the editor content
   */
  handleEditorChange() {
    if (this.lastCodeChangeIsFromScene) {
      setTimeout(() => {
        this.lastCodeChangeIsFromScene = false
      }, 100)
      return
    }

    this.isSynced = false
    if (!this.manualParse) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.parse()
      }, 500)
    } else {
      if (app.canvas) {
        // Dim the canvases to indicate that the scene is out of sync
        app.canvas.style.opacity = 0.5;
        app.canvasBelowLight.style.opacity = 0.5;
        app.canvasLight.style.opacity = 0.5;
        app.canvasLightWebGL.style.opacity = 0.5;
        app.canvasGrid.style.opacity = 0.5;
      }
      app.setHasUnsavedChange(true)
    }
  }

  /**
   * Parse the JSON content to the scene
   */
  parse() {
    try {
      app.editor?.loadJSON(this.aceEditor.session.getValue())
      window.error = null
      app.editor?.onActionComplete(true)
      if (!app.scene.error) {
        this.isSynced = true
        if (app.canvas) {
          app.canvas.style.opacity = 1.0;
          app.canvasBelowLight.style.opacity = 1.0;
          // Note that we do not reset the opacity of the light layer canvases, as they are done by the simulator (it will still be dimmed until the simulation is refreshed)
          app.canvasGrid.style.opacity = 1.0;
        }
      } else {
        app.setHasUnsavedChange(true)
      }
    } catch (e) {
      console.error('Error updating scene from JSON:', e)
    }
  }

  /**
   * Clean up the editor instance
   */
  cleanup() {
    if (!this.aceEditor) return

    if (!this.isSynced) {
      // Parse the scene to avoid losing any unsaved changes in the JSON editor.
      this.parse()
    }

    this.aceEditor.destroy()
    this.aceEditor = null
  }

  /**
   * Update the editor's content, optionally highlighting changes
   * @param {string} content - New content for the editor
   * @param {string} [oldContent] - Previous content for diff calculation
   */
  updateContent(content, oldContent) {
    if (!this.aceEditor) return
    if (!this.isSynced) return
    
    // Blur the editor to remove focus when content is updated
    this.aceEditor.blur()

    if (oldContent && content !== oldContent) {
      // Calculate the position of the first and last character that has changed
      var minLen = Math.min(content.length, oldContent.length);
      var startChar = 0;
      while (startChar < minLen && content[startChar] == oldContent[startChar]) {
        startChar++;
      }
      var endChar = 0;
      while (endChar < minLen && content[content.length - 1 - endChar] == oldContent[oldContent.length - 1 - endChar]) {
        endChar++;
      }

      // Convert character positions to row/column positions
      var startPos = this.aceEditor.session.doc.indexToPosition(startChar);
      var endPos = this.aceEditor.session.doc.indexToPosition(content.length - endChar);

      // Update content and highlight changes
      this.lastCodeChangeIsFromScene = true
      this.aceEditor.session.setValue(content)
      this.aceEditor.selection.setRange(new Range(startPos.row, startPos.column, endPos.row, endPos.column))

      // Scroll to the first line that has changed
      this.aceEditor.scrollToLine(startPos.row, true, true, function () { });
    } else {
      // Just update content without highlighting
      this.lastCodeChangeIsFromScene = true
      this.aceEditor.session.setValue(content)
    }
  }
}

// Export a singleton instance
export const jsonEditorService = new JsonEditorService()
