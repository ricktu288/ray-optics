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
import { useSceneStore } from '../store/scene'

/**
 * Service to manage the JSON editor instance and its interactions with the scene
 */
class JsonEditorService {
  constructor() {
    this.aceEditor = null
    this.debounceTimer = null
    this.lastCodeChangeIsFromScene = false
  }

  /**
   * Initialize the JSON editor with the given content
   */
  initialize() {
    if (this.aceEditor) return

    this.aceEditor = ace.edit("jsonEditor")
    this.aceEditor.setTheme("ace/theme/github_dark")
    this.aceEditor.session.setMode("ace/mode/json")
    this.aceEditor.session.setUseWrapMode(true)
    this.aceEditor.session.setUseSoftTabs(true)
    this.aceEditor.session.setTabSize(2)
    this.aceEditor.setHighlightActiveLine(false)
    this.aceEditor.container.style.background = "transparent"
    this.aceEditor.container.getElementsByClassName('ace_gutter')[0].style.background = "transparent"
    
    // Set initial content
    this.aceEditor.session.setValue(window.editor?.lastActionJson ?? '')

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

    clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      const scene = useSceneStore()
      scene.handleJsonEditorUpdate(this.aceEditor.session.getValue())
    }, 500)
  }

  /**
   * Clean up the editor instance
   */
  cleanup() {
    if (!this.aceEditor) return

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

    if (oldContent && content !== oldContent && !this.aceEditor.isFocused()) {
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

      // Convert the character positions to line numbers
      var startLineNum = content.substr(0, startChar).split("\n").length - 1;
      var endLineNum = content.substr(0, content.length - endChar).split("\n").length - 1;

      // Set selection range to highlight changes using the Range object
      var selectionRange = new Range(startLineNum, 0, endLineNum + 1, 0);

      this.lastCodeChangeIsFromScene = true;
      this.aceEditor.setValue(content);
      this.aceEditor.selection.setSelectionRange(selectionRange);

      // Scroll to the first line that has changed
      this.aceEditor.scrollToLine(startLineNum, true, true, function () { });
    } else {
      this.aceEditor.session.setValue(content)
    }
  }

  /**
   * Check if the editor is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return !!this.aceEditor
  }

  /**
   * Check if the editor has focus
   * @returns {boolean}
   */
  hasFocus() {
    return this.aceEditor?.isFocused() ?? false
  }
}

// Export a singleton instance
export const jsonEditorService = new JsonEditorService()
