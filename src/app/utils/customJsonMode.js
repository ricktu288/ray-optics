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

const oop = ace.require("ace/lib/oop");
const JsonMode = ace.require("ace/mode/json").Mode;
const JsonHighlightRules = ace.require("ace/mode/json_highlight_rules").JsonHighlightRules;
const CstyleBehaviour = ace.require("ace/mode/behaviour/cstyle").CstyleBehaviour;

// Custom highlight rules that extend the original JSON rules for math.js expressions and statements in module definitions.
const CustomJsonHighlightRules = function() {
    // Start with the original JSON highlight rules
    JsonHighlightRules.call(this);
    
    // Highlight text between backticks in strings (for math.js expression in an object template)
    if (this.$rules.string) {
        this.$rules.string.unshift({
            token: ["string", "support.function", "string"], 
            regex: /(`)(.*?)(`)/
        });
    }
    
    // Store original start rules
    const originalStartRules = this.$rules.start.slice();
    
    // Clear start rules and rebuild with math.js detection
    this.$rules.start = [
        // Detect array contexts which are arrays of math statements in a module definition: "params", "vars", "for" followed by ": ["
        {
            token: ["variable", "text", "punctuation.separator.dictionary.pair.json", "text", "punctuation.definition.array.begin.json"],
            regex: /("(?:params|vars|for)")(\s*)(:)(\s*)(\[)/,
            next: "mathjs-array"
        },
        // Detect string contexts which are math statements in a module definition: "for", "if" followed by ": ""
        {
            token: ["variable", "text", "punctuation.separator.dictionary.pair.json", "text"],
            regex: /("(?:for|if)")(\s*)(:)(\s*)(?=")/,
            next: "mathjs-single"
        },
        // Keep all original rules
        ...originalStartRules
    ];
    
    // Define math statement array state
    this.$rules["mathjs-array"] = [
        {
            token: "punctuation.definition.string.begin.json",
            regex: /"/,
            next: "mathjs-string"
        },
        {
            token: "punctuation.separator.array.json", 
            regex: /,/
        },
        {
            token: "text",
            regex: /\s+/
        },
        {
            token: "punctuation.definition.array.end.json",
            regex: /\]/,
            next: "start"
        }
    ];
    
    // Define state for content inside strings in mathjs arrays
    this.$rules["mathjs-string"] = [
        {
            token: "support.function",
            regex: /[^=:"]+/
        },
        {
            token: "string",
            regex: /[=:]/
        },
        {
            token: "punctuation.definition.string.end.json",
            regex: /"/,
            next: "mathjs-array"
        }
    ];
    
    // Define math statement string state  
    this.$rules["mathjs-single"] = [
        {
            token: "punctuation.definition.string.begin.json",
            regex: /"/,
            next: "mathjs-single-string"
        }
    ];
    
    // Define state for content inside strings in mathjs single statements
    this.$rules["mathjs-single-string"] = [
        {
            token: "support.function",
            regex: /[^=:"]+/
        },
        {
            token: "string",
            regex: /[=:]/
        },
        {
            token: "punctuation.definition.string.end.json",
            regex: /"/,
            next: "start"
        }
    ];
};

oop.inherits(CustomJsonHighlightRules, JsonHighlightRules);

// Custom behavior for backtick auto-pairing
const CustomJsonBehaviour = function() {
    CstyleBehaviour.call(this);
    
    // Add backtick auto-pairing
    this.add("backticks", "insertion", function(state, action, editor, session, text) {
        if (text == '`') {
            var selection = editor.getSelectionRange();
            var selected = session.doc.getTextRange(selection);
            if (selected !== "" && selected !== '`') {
                return {
                    text: '`' + selected + '`',
                    selection: [1, selected.length + 1]
                };
            } else {
                var cursor = editor.getCursorPosition();
                var line = session.doc.getLine(cursor.row);
                var rightChar = line.substring(cursor.column, cursor.column + 1);
                var leftChar = line.substring(cursor.column - 1, cursor.column);
                
                // Don't auto-pair if there's already a backtick to the right
                if (rightChar == '`') {
                    return {
                        text: '',
                        selection: [1, 1]
                    };
                }
                
                // Auto-pair backticks
                return {
                    text: '``',
                    selection: [1, 1]
                };
            }
        }
    });
};

oop.inherits(CustomJsonBehaviour, CstyleBehaviour);

// Custom JSON Mode
const CustomJsonMode = function() {
    JsonMode.call(this);
    this.HighlightRules = CustomJsonHighlightRules;
    this.$behaviour = new CustomJsonBehaviour();
};

oop.inherits(CustomJsonMode, JsonMode);

export { CustomJsonMode }; 