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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//const customMath_1 = __importDefault(require("./customMath"));
//const ParseError_1 = __importDefault(require("./ParseError"));
//const Token_1 = __importStar(require("./Token"));
/**
 * Create the corresponding MathJS node of a Token and its children.
 * @returns A newly constructed MathJS node.
 */
function createMathJSNode(token, children = []) {
    let fn = exports.typeToOperation[token.type];
    switch (token.type) {
        case 6 /* Times */:
            return new mathjs.FunctionNode('cross', children);
        case 4 /* Minus */:
            // mathjs differentiates between subtraction and the unary minus
            fn = children.length === 1 ? 'unaryMinus' : fn;
        // falls through
        case 3 /* Plus */:
        case 5 /* Star */:
        case 18 /* Frac */:
        case 7 /* Slash */:
            return new mathjs.OperatorNode(token.lexeme, fn, children);
        case 8 /* Caret */:
            if (children.length < 2) {
                throw new ParseError('Expected two children for ^ operator', token);
            }
            // manually check for ^T as the transpose operation
            if (children[1].isSymbolNode && children[1].name === 'T') {
                return new mathjs.FunctionNode('transpose', [children[0]]);
            }
            return new mathjs.OperatorNode(token.lexeme, fn, children);
        // mathjs built-in functions
        case 14 /* Bar */:
        case 17 /* Sqrt */:
        case 19 /* Sin */:
        case 20 /* Cos */:
        case 21 /* Tan */:
        case 22 /* Csc */:
        case 23 /* Sec */:
        case 24 /* Cot */:
        case 28 /* Sinh */:
        case 29 /* Cosh */:
        case 30 /* Tanh */:
        case 25 /* Arcsin */:
        case 26 /* Arccos */:
        case 27 /* Arctan */:
        case 31 /* Log */:
        case 32 /* Ln */:
        case 44 /* Eigenvalues */:
        case 45 /* Eigenvectors */:
        case 42 /* Det */:
        case 46 /* Cross */:
        case 47 /* Proj */:
        case 48 /* Comp */:
        case 49 /* Norm */:
        case 50 /* Inv */:
            return new mathjs.FunctionNode(fn, children);
        case 2 /* Equals */:
            return new mathjs.AssignmentNode(children[0], children[1]);
        case 1 /* Variable */:
            return new mathjs.SymbolNode(token.lexeme);
        case 0 /* Number */: {
            // convert string lexeme to number if posssible
            const constant = Number.isNaN(Number(token.lexeme)) ? token.lexeme : +token.lexeme;
            return new mathjs.ConstantNode(constant);
        }
        case 33 /* Pi */:
            return new mathjs.SymbolNode('pi');
        case 34 /* E */:
            return new mathjs.SymbolNode('e');
        case 37 /* Matrix */:
            return new mathjs.ArrayNode(children);
        case 41 /* T */:
            return new mathjs.SymbolNode('T');
        default:
            throw new ParseError('unknown token type', token);
    }
}
// Maps each left grouping token to its corresponding right grouping token
const rightGrouping = {
    [12 /* Lparen */]: 13 /* Rparen */,
    [10 /* Lbrace */]: 11 /* Rbrace */,
    [38 /* Left */]: 39 /* Right */,
    [14 /* Bar */]: 14 /* Bar */,
};
// Token types that are primaries or denote the start of a primary
const primaryTypes = [
    38 /* Left */,
    12 /* Lparen */,
    10 /* Lbrace */,
    14 /* Bar */,
    0 /* Number */,
    1 /* Variable */,
    18 /* Frac */,
    17 /* Sqrt */,
    19 /* Sin */,
    20 /* Cos */,
    21 /* Tan */,
    22 /* Csc */,
    23 /* Sec */,
    24 /* Cot */,
    25 /* Arcsin */,
    26 /* Arccos */,
    27 /* Arctan */,
    28 /* Sinh */,
    29 /* Cosh */,
    30 /* Tanh */,
    31 /* Log */,
    32 /* Ln */,
    42 /* Det */,
    33 /* Pi */,
    34 /* E */,
    35 /* Begin */,
    41 /* T */,
    43 /* Opname */,
];
class Parser {
    /**
       * A recursive descent parser for TeX math. The following context-free grammar is used:
       *
       * expr = term ((PLUS | MINUS) term)*
       *      | VARIABLE EQUALS expr
       *
       * term = factor ((STAR factor | primary))* //primary and factor must both not be numbers
       *
       * factor = MINUS? power
       *
       * power = primary (CARET primary)*
       *
       * primary = grouping
       *         | environnment
       *         | frac
       *         | function
       *         | NUMBER
       *         | VARIABLE
       *
       * grouping = LEFT LPAREN expr RIGHT RPAREN
       *          | LPAREN expr RPAREN
       *          | LBRACE expr RBRACE
       *          | LEFT BAR expr RIGHT BAR
       *          | BAR expr BAR
       *
       * environnment = matrix
       *
       * frac = FRAC LBRACE expr RBRACE LBRACE expr RBRACE
       *
       * matrix = BEGIN LBRACE MATRIX RBRACE ((expr)(AMP | DBLBACKSLASH))* END LBRACE MATRIX RBRACE
       *
       * function = (SQRT | SIN | COS | TAN | ...) argument
       *          | OPNAME LBRACE customfunc RBRACE argument
       *
       * argument = grouping
       *          | expr
       *
       * In general, each production is represented by one method (e.g. nextFactor(), nextPower()...)
       *
       * @param tokens A list of Tokens to be parsed.
       */
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }
    /**
       * Get the type that the current token matches.
       * @param types A variable number of token types to match the current token
       *              with.
       * @returns Returns the matched token type if there is a match.
       *          Otherwise returns undefined.
       */
    match(...types) {
        const { type } = this.tokens[this.pos];
        return (types.indexOf(type) !== -1) ? type : undefined;
    }
    /**
       * Get the next token and advance the position in the token stream.
       * @returns Returns the next token in the token stream.
       */
    nextToken() {
        return this.tokens[this.pos++];
    }
    /**
       * Get the current token in the token stream without consuming it.
       * @returns Returns the current token in the token stream.
       */
    currentToken() {
        return this.tokens[this.pos];
    }
    /**
       * Get the previous token in the token stream. Returns undefined
       * if the position is at the beginning of the stream.
       * @returns Returns the previous token in the token stream.
       */
    previousToken() {
        return this.tokens[this.pos - 1];
    }
    /**
       * Consume the next expression in the token stream according to the following production:
       *
       * expr => term ((PLUS | MINUS) term)*
       *       | VARIABLE EQUALS expr
       * @returns Returns the root node of an expression tree.
       */
    nextExpression() {
        let leftTerm = this.nextTerm();
        // VARIABLE EQUALS expr
        if (this.match(2 /* Equals */)) {
            if (!leftTerm.isSymbolNode) {
                throw new ParseError('expected variable (SymbolNode) on left hand of assignment', this.previousToken());
            }
            const equals = this.nextToken();
            const rightExpr = this.nextExpression();
            return createMathJSNode(equals, [leftTerm, rightExpr]);
        }
        // term ((PLUS | MINUS) term)*
        while (this.match(3 /* Plus */, 4 /* Minus */)) {
            // build the tree with left-associativity
            const operator = this.nextToken();
            const rightTerm = this.nextTerm();
            leftTerm = createMathJSNode(operator, [leftTerm, rightTerm]);
        }
        return leftTerm;
    }
    /**
       * Consume the next term according to the following production:
       *
       * term => factor (((STAR | TIMES) factor) | power)*
       * @returns Returns the root node of an expression tree.
       */
    nextTerm() {
        function isNumberNode(node) {
            return node.isConstantNode && !Number.isNaN(Number(node));
        }
        let leftFactor = this.nextFactor();
        let implicitMult = false;
        // since bmatrix is the only environnment supported, it suffices to only have
        // one token lookahead and assume that \begin is the start of a matrix.
        // However, if more environnment support is added, it would be necessary to
        // have more lookahead and ensure that the matrix begins with BEGIN LBRACE MATRIX.
        for (;;) {
            const lookaheadType = this.match(5 /* Star */, 6 /* Times */, 7 /* Slash */, ...primaryTypes);
            if (lookaheadType === undefined) {
                break;
            }
            let operator;
            let rightFactor;
            // multiplication between two adjacent factors is implicit as long as
            // they are not both numbers
            if (isNumberNode(leftFactor) && lookaheadType === 0 /* Number */) {
                throw new ParseError('multiplication is not implicit between two different'
                    + 'numbers: expected * or \\cdot', this.currentToken());
            }
            else if (this.match(5 /* Star */, 6 /* Times */, 7 /* Slash */)) {
                operator = this.nextToken();
                rightFactor = this.nextFactor();
            }
            else {
                const starPos = this.pos;
                // implicit multiplication is only vaild if the right factor is not negated
                // (2x != 2-x), so we parse a power instead of a factor
                rightFactor = this.nextPower();
                // multiplication is implicit: a multiplication (star) token needs to be created
                operator = new Token('*', 5 /* Star */, starPos);
                implicitMult = true;
            }
            leftFactor = createMathJSNode(operator, [leftFactor, rightFactor]);
            leftFactor.implicit = implicitMult;
        }
        return leftFactor;
    }
    /**
       * Consume the next factor according to the following production:
       *
       * factor => MINUS? power
       * @returns The root node of an expression tree.
       */
    nextFactor() {
        // match for optional factor negation
        if (this.match(4 /* Minus */)) {
            const negate = this.nextToken();
            const primary = this.nextPower();
            return createMathJSNode(negate, [primary]);
        }
        return this.nextPower();
    }
    /**
       * Consume the next power according to the following production:
       *
       * power => primary (CARET primary)*
       * @returns The root node of an expression tree.
       */
    nextPower() {
        let base = this.nextPrimary();
        while (this.match(8 /* Caret */)) {
            const caret = this.nextToken();
            const exponent = this.nextPrimary();
            base = createMathJSNode(caret, [base, exponent]);
        }
        return base;
    }
    /**
       * Try to consume a token of the given type. If the next token does not match,
       * an error is thrown.
       * @param errMsg Error message associated with the error if the match fails.
       * @param tokenTypes A variable amount of token types to match.
       * @returns Returns the consumed token on successful match.
       */
    tryConsume(errMsg, ...tokenTypes) {
        const lookaheadType = this.match(...tokenTypes);
        if (lookaheadType === undefined) {
            throw new ParseError(errMsg, this.currentToken());
        }
        return this.nextToken();
    }
    /**
       * Consume the next primary according to the following production:
       *
       * primary => grouping
       *          | environnment
       *          | frac
       *          | function
       *          | NUMBER
       *          | VARIABLE
       *
       * @returns The root node of an expression tree.
       */
    nextPrimary() {
        const lookaheadType = this.match(...primaryTypes);
        if (lookaheadType === undefined) {
            throw new ParseError('expected primary', this.currentToken());
        }
        let primary;
        switch (lookaheadType) {
            case 38 /* Left */:
            case 12 /* Lparen */:
            case 10 /* Lbrace */:
            case 14 /* Bar */:
                // nextGrouping can return an array of children
                // (if the grouping contains comma-seperated values, e.g. for a multi-value function),
                // so for a primary, we only take the first value (or if there is just one, the only value)
                [primary] = this.nextGrouping();
                break;
            case 0 /* Number */:
            case 1 /* Variable */:
            case 33 /* Pi */:
            case 34 /* E */:
            case 41 /* T */:
                primary = createMathJSNode(this.nextToken());
                break;
            case 17 /* Sqrt */:
            case 19 /* Sin */:
            case 20 /* Cos */:
            case 21 /* Tan */:
            case 22 /* Csc */:
            case 23 /* Sec */:
            case 24 /* Cot */:
            case 25 /* Arcsin */:
            case 26 /* Arccos */:
            case 27 /* Arctan */:
            case 28 /* Sinh */:
            case 29 /* Cosh */:
            case 30 /* Tanh */:
            case 31 /* Log */:
            case 32 /* Ln */:
            case 42 /* Det */:
                primary = this.nextUnaryFunc();
                break;
            case 43 /* Opname */:
                primary = this.nextCustomFunc();
                break;
            case 18 /* Frac */:
                primary = this.nextFrac();
                break;
            case 35 /* Begin */:
                // matrix is the only currently supported environnment: if more are added, another
                // token of lookahead would be required to know which environnment to parse
                primary = this.nextMatrix();
                break;
            default:
                throw new ParseError('unknown token encountered during parsing', this.nextToken());
        }
        return primary;
    }
    /**
       * Consume the next grouping according to the following production:
       *
       * grouping = LEFT LPAREN expr RIGHT RPAREN
       *          | LPAREN expr RPAREN
       *          | LBRACE expr RBRACE
       *          | LEFT BAR expr RIGHT BAR
       *          | BAR expr BAR
       *          | expr
       *
       * @returns The root node of an expression tree.
       */
    nextGrouping() {
        // token indicating start of grouping
        let leftRight = false; // flag indicating if grouping tokens are marked with \left and \right
        if (this.match(38 /* Left */)) {
            leftRight = true;
            this.nextToken(); // consume \left
        }
        const leftGrouping = this.tryConsume("expected '(', '|', '{'", 12 /* Lparen */, 14 /* Bar */, 10 /* Lbrace */);
        let grouping = this.nextExpression();
        if (leftGrouping.type === 14 /* Bar */) {
            // grouping with bars |x| also applies a function, so we create the corresponding function
            // here
            grouping = createMathJSNode(leftGrouping, [grouping]);
        }
        // a grouping can contain multiple children if the
        // grouping is parenthetical and the values are comma-seperated
        const children = [grouping];
        if (leftGrouping.type === 12 /* Lparen */) {
            while (this.match(9 /* Comma */)) {
                this.nextToken(); // consume comma
                children.push(this.nextExpression());
            }
        }
        if (leftRight) {
            this.tryConsume('expected \\right to match corresponding \\left after expression', 39 /* Right */);
        }
        // look for corresponding right grouping
        this.tryConsumeRightGrouping(leftGrouping);
        return children;
    }
    /**
       * Consume the next token corresponding to a built-in MathJS function.
       *
       * @returns The root node of an expression tree.
       */
    nextUnaryFunc() {
        const func = this.nextToken();
        const argument = this.nextArgument();
        return createMathJSNode(func, argument);
    }
    /**
       * Consume the next token corresponding to a user-defined function.
       *
       * customFn => OPNAME LBRACE identifier RBRACE grouping
       * @returns The root node of an expression tree.
       */
    nextCustomFunc() {
        this.nextToken(); // consume \\operatornmae
        this.tryConsume("expected '{' after \\operatorname", 10 /* Lbrace */);
        const customFunc = this.nextToken();
        this.tryConsume("expected '}' after operator name", 11 /* Rbrace */);
        const argument = this.nextArgument();
        return createMathJSNode(customFunc, argument);
    }
    /**
       * Consume the next group of arguments according to the following production:
       *
       * argument => grouping
       *           | expr
       *
       * @returns The root node of an expression tree.
       */
    nextArgument() {
        let argument;
        // try to match grouping e.g. (), {}, ||
        if (this.match(38 /* Left */, 12 /* Lparen */, 10 /* Lbrace */, 14 /* Bar */)) {
            // grouping around argument e.g. \sin (x)
            argument = this.nextGrouping();
        }
        else {
            // no grouping e.g. \sin x; consume the next token as the argument
            argument = [this.nextPrimary()];
        }
        return argument;
    }
    /**
       * Consume the next fraction according to the following production:
       *
       * frac => FRAC LBRACE expr RBRACE LBRACE expr RBRACE
       *
       * @returns The root node of an expression tree.
       */
    nextFrac() {
        const frac = this.nextToken();
        this.tryConsume("expected '{' for the numerator in \\frac", 10 /* Lbrace */);
        const numerator = this.nextExpression();
        this.tryConsume("expected '}' for the numerator in \\frac", 11 /* Rbrace */);
        let denominator;
        // {} is optional for the denominator of \frac
        if (this.match(10 /* Lbrace */)) {
            this.nextToken();
            denominator = this.nextExpression();
            this.tryConsume("expected '}' for the denominator in \\frac", 11 /* Rbrace */);
        }
        else {
            denominator = this.nextExpression();
        }
        return createMathJSNode(frac, [numerator, denominator]);
    }
    /**
       * Consume the next matrix environnment according to the following production:
       *
       * matrix => BEGIN LBRACE MATRIX RBRACE ((expr)(AMP | DBLBACKSLASH))* END LBRACE MATRIX RBRACE
       *
       * @returns The root node of an expression tree.
       */
    nextMatrix() {
        this.nextToken(); // consume \begin
        this.tryConsume("expected '{' after \\begin", 10 /* Lbrace */);
        const matrixToken = this.tryConsume("expected 'matrix' after '\\begin{' "
            + '(no other environnments'
            + 'are supported yet)', 37 /* Matrix */);
        this.tryConsume("expected '}' after \\begin{matrix", 11 /* Rbrace */);
        let row = [];
        const rows = [];
        // parse matrix elements
        for (;;) {
            const element = this.nextExpression();
            // '&' delimits columns; append 1 element to this row
            if (this.match(15 /* Amp */)) {
                this.nextToken();
                row.push(element);
            }
            else if (this.match(16 /* Dblbackslash */, 36 /* End */) !== undefined) {
                // '\\' delimits rows; add a new row
                const delimiter = this.nextToken();
                row.push(element);
                if (row.length === 1) {
                    rows.push(element);
                }
                else {
                    rows.push(createMathJSNode(matrixToken, row));
                }
                row = [];
                if (delimiter.type === 36 /* End */) {
                    break;
                }
            }
            else if (this.match(40 /* Eof */)) {
                throw new ParseError('unexpected EOF encountered while parsing matrix', this.currentToken());
            }
            else {
                throw new ParseError('unexpected delimiter while parsing matrix', this.currentToken());
            }
        }
        this.tryConsume("expected '{' after \\end", 10 /* Lbrace */);
        this.tryConsume("expected 'matrix' after '\\end{' (no other environnments"
            + 'are supported yet)', 37 /* Matrix */);
        this.tryConsume("expected '}' after \\end{matrix", 11 /* Rbrace */);
        return createMathJSNode(matrixToken, rows);
    }
    /**
       * Try to consume the right grouping token corresponding to the given left grouping token.
       * e.g. '(' => ')', '{' => '}'. If the token doesn't match, an error is thrown.
       *
       * @param leftGroupingToken A left grouping token.
       *
       */
    // Try to consume a right grouping character given the corresponding left grouping token
    // e.g. RPAREN for LPAREN, BAR for BAR
    tryConsumeRightGrouping(leftGroupingToken) {
        const rightGroupingType = rightGrouping[leftGroupingToken.type];
        // get any tokens that match with the required token type
        const expectedLexemes = Object.keys(exports.lexemeToType)
            .filter((key) => exports.lexemeToType[key] === rightGroupingType)
            // insert quotes (e.g. { => '{')
            .map((lexeme) => `'${lexeme}'`);
        const errMsg = `expected ${expectedLexemes.join(' or ')} to match corresponding '${leftGroupingToken.lexeme}'`;
        this.tryConsume(errMsg, rightGrouping[leftGroupingToken.type]);
    }
}
/**
 * Parse an array of TeX math tokens as a MathJS expression tree.
 *
 * @param tokens An array of tokens to parse.
 *
 * @returns The root node of a MathJS expression tree.
 */
function parseTokens(tokens) {
    return (new Parser(tokens)).nextExpression();
}
exports.default = parseTokens;
