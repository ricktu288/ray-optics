"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ParseError extends Error {
    constructor(message = '', token, ...args) {
        super(...args);
        this.name = 'ParseError';
        this.message = `${token.lexeme} at ${token.pos}: ${message}`;
    }
}
exports.default = ParseError;
