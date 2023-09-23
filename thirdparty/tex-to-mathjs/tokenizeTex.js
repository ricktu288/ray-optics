"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
//const Token_1 = __importStar(require("./Token"));
function isWhitespace(c) {
    return c.trim() === '';
}
function isAlpha(c) {
    return /^[A-Za-z]{1,1}$/.test(c);
}
function isControl(c) {
    return /[^ -~]/.test(c);
}
function isDigit(c) {
    return c >= '0' && c <= '9';
}
// Returns the next word starting at pos in the string.
// If the string begins with non-alphabetic characters at pos, returns an empty string.
function scanWord(str, pos) {
    if (!isAlpha(str[pos])) {
        return '';
    }
    let end = pos;
    // consume characters until a non-alphabetic character is encountered
    while (isAlpha(str[end])) {
        end += 1;
    }
    return str.slice(pos, end);
}
// Returns the next number starting at pos in the string.
// If the string begins with a non-digit at pos, returns an empty string.
function scanNumber(str, pos) {
    if (!isDigit(str[pos])) {
        return '';
    }
    let end = pos + 1;
    // consume characters until a non-digit is found
    while (isDigit(str[end])) {
        end += 1;
    }
    if (str[end] === '.') {
        end += 1;
        // decimal number
        while (isDigit(str[end])) {
            end += 1;
        }
    }
    return str.slice(pos, end);
}
class LexError extends Error {
    constructor(message = '', pos, ...args) {
        super(...args);
        this.name = 'LexError';
        this.message = `at ${pos}: ${message}`;
    }
}
// Convert a TeX string to an array of tokens
function tokenizeTex(texStr) {
    let i = 0;
    const { length } = texStr;
    const tokens = [];
    while (i < length) {
        // skip leading whitespace
        while (isWhitespace(texStr[i])) {
            i += 1;
        }
        let lexeme = '';
        let type = 40 /* Eof */;
        const c = texStr[i];
        // don't accept control characters
        if (isControl(c)) {
            throw new LexError('invalid control sequence encountered '
                + '(forgot to escape backslashes (\\begin => \\\\begin)?', i);
        }
        // scan for single-char non-alphabetical lexemes
        if (!isAlpha(c) && c in exports.lexemeToType) {
            type = exports.lexemeToType[c];
            lexeme = c;
        }
        else if (c === '\\') {
            // scan for multi-char lexemes starting with \
            const nextChar = texStr[i + 1];
            if (nextChar === '\\') {
                // double backslash
                type = 16 /* Dblbackslash */;
                lexeme = '\\\\';
            }
            else if (nextChar === ' ') {
                // space character: ignore
                type = 51 /* Space */;
                lexeme = '\\ ';
            }
            else {
                // TeX command
                const command = scanWord(texStr, i + 1);
                if (command === undefined) {
                    // an alpha char must immediately follow the backslash
                    // or the command is malformed
                    throw new LexError('expected command '
                        + '(a non-alphabetic character was encountered)', i);
                }
                else {
                    lexeme = `\\${command}`;
                    type = exports.lexemeToType[lexeme];
                    if (type === undefined) {
                        throw new LexError(`unknown command "${lexeme}"`, i);
                    }
                }
            }
        }
        else if (isDigit(c)) {
            // scan for numbers
            // the position i passed to scanNumber includes the current digit character
            // because the first character is part of the number
            lexeme = scanNumber(texStr, i);
            type = 0 /* Number */;
        }
        else if (isAlpha(c)) {
            // scan for identifiers
            const identifier = scanWord(texStr, i);
            if (identifier in exports.lexemeToType) {
                // identifier is a "keyword" (e.g. matrix)
                lexeme = identifier;
                type = exports.lexemeToType[identifier];
            }
            else {
                // identifier has no meaning; interpret as a sequence of single-char lexemes
                const ch = identifier[0];
                if (ch in exports.lexemeToType) {
                    // single-char alphabetical lexeme
                    lexeme = ch;
                    type = exports.lexemeToType[ch];
                }
                else {
                    // unrecognized alphabetical lexeme: treat as variable
                    lexeme = ch;
                    type = 1 /* Variable */;
                }
            }
        }
        else {
            throw new LexError(`unrecognized character "${c}"`, i);
        }
        // ignore space characters
        if (type !== 51 /* Space */) {
            tokens.push(new Token(lexeme, type, i));
        }
        i += lexeme.length;
    }
    tokens.push(new Token('EOF', 40 /* Eof */, i));
    return tokens;
}
exports.default = tokenizeTex;
//export default tokenizeTex