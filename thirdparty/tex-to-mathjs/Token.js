"use strict";
var exports={};
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeToOperation = exports.lexemeToType = void 0;
exports.lexemeToType = {
    '=': 2 /* Equals */,
    '+': 3 /* Plus */,
    '-': 4 /* Minus */,
    '*': 5 /* Star */,
    '\\cdot': 5 /* Star */,
    '\\times': 6 /* Times */,
    '^': 8 /* Caret */,
    '/': 7 /* Slash */,
    ',': 9 /* Comma */,
    '{': 10 /* Lbrace */,
    '}': 11 /* Rbrace */,
    '(': 12 /* Lparen */,
    ')': 13 /* Rparen */,
    '|': 14 /* Bar */,
    '&': 15 /* Amp */,
    bmatrix: 37 /* Matrix */,
    '\\\\': 16 /* Dblbackslash */,
    '\\sqrt': 17 /* Sqrt */,
    '\\frac': 18 /* Frac */,
    '\\sin': 19 /* Sin */,
    '\\cos': 20 /* Cos */,
    '\\tan': 21 /* Tan */,
    '\\csc': 22 /* Csc */,
    '\\sec': 23 /* Sec */,
    '\\cot': 24 /* Cot */,
    '\\arcsin': 25 /* Arcsin */,
    '\\arccos': 26 /* Arccos */,
    '\\arctan': 27 /* Arctan */,
    '\\sinh': 28 /* Sinh */,
    '\\cosh': 29 /* Cosh */,
    '\\tanh': 30 /* Tanh */,
    '\\log': 31 /* Log */,
    '\\ln': 32 /* Ln */,
    '\\pi': 33 /* Pi */,
    e: 34 /* E */,
    '\\begin': 35 /* Begin */,
    '\\end': 36 /* End */,
    '\\left': 38 /* Left */,
    '\\right': 39 /* Right */,
    T: 41 /* T */,
    '\\det': 42 /* Det */,
    '\\operatorname': 43 /* Opname */,
    eigenvectors: 45 /* Eigenvectors */,
    eigenvalues: 44 /* Eigenvalues */,
    cross: 46 /* Cross */,
    proj: 47 /* Proj */,
    comp: 48 /* Comp */,
    norm: 49 /* Norm */,
    inv: 50 /* Inv */,
};
/**
 * A mapping from a token type to the operation it represents.
 * The operation is the name of a function in the mathjs namespace,
 * or of a function to be defined in scope (i.e. in the argument to math.evaluate())
 */
exports.typeToOperation = {
    [3 /* Plus */]: 'add',
    [4 /* Minus */]: 'subtract',
    [5 /* Star */]: 'multiply',
    [6 /* Times */]: 'multiply',
    [8 /* Caret */]: 'pow',
    [7 /* Slash */]: 'divide',
    [18 /* Frac */]: 'divide',
    [14 /* Bar */]: 'abs',
    [17 /* Sqrt */]: 'sqrt',
    [19 /* Sin */]: 'sin',
    [20 /* Cos */]: 'cos',
    [21 /* Tan */]: 'tan',
    [22 /* Csc */]: 'csc',
    [23 /* Sec */]: 'sec',
    [24 /* Cot */]: 'cot',
    [25 /* Arcsin */]: 'asin',
    [26 /* Arccos */]: 'acos',
    [27 /* Arctan */]: 'atan',
    [28 /* Sinh */]: 'sinh',
    [29 /* Cosh */]: 'cosh',
    [30 /* Tanh */]: 'tanh',
    [31 /* Log */]: 'log10',
    [32 /* Ln */]: 'log',
    [42 /* Det */]: 'det',
    [45 /* Eigenvectors */]: 'eigenvectors',
    [44 /* Eigenvalues */]: 'eigenvalues',
    [46 /* Cross */]: 'cross',
    [47 /* Proj */]: 'proj',
    [48 /* Comp */]: 'comp',
    [49 /* Norm */]: 'norm',
    [50 /* Inv */]: 'inv',
};
class Token {
    /**
       * A token in a TeX string.
       * @param {string} lexeme string literal of the token
       * @param {TokenType} type type of the token
       * @param {Number} pos position of the token in the input string
       *
       * @constructor Token
       */
    constructor(lexeme, type, pos) {
        this.lexeme = lexeme;
        this.type = type;
        this.pos = pos;
    }
}
exports.default = Token;
