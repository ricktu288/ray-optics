"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Find the last function node to be evaluated in a MathJS expression tree.
 * @param root The root node of a MathJS expression tree
 * @returns The last function node to be evaluated, or null if there are none
 */
function lastFunctionNode(root) {
    // reverse postfix
    if (root.type === 'FunctionNode') {
        return root;
    }
    if (!root.items || root.items.length < 1) {
        return null;
    }
    for (let i = root.items.length - 1; i >= 0; --i) {
        const result = lastFunctionNode(root.items[i]);
        if (!result) {
            return result;
        }
    }
    // no function node found
    return null;
}
exports.default = lastFunctionNode;
