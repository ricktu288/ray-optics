"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//const mathjs_1 = require("mathjs");
// use BigNumber to reduce floating-point rounding errors
const mathjs = math.create(math.all, {
    number: 'BigNumber',
    precision: 64,
});
// Additional functions to be passed to the scope of math.evaluate(scope)
// (not defined in mathjs)
const mathImport = {
    lastFn: '',
    lastArgs: [],
    eigenvalues: (matrix) => mathjs.eigs(matrix).values,
    eigenvectors: (matrix) => mathjs.eigs(matrix).vectors,
    comp: (a, b) => mathjs.divide(mathjs.dot(a, b), mathjs.norm(a)),
    proj: (a, b) => mathjs.multiply(mathjs.divide(a, mathjs.norm(a)), mathjs.divide(mathjs.dot(a, b), mathjs.norm(a))), // projection of b along a
};
mathjs.import(mathImport, {
    override: true,
});
// hacky way to disable unit parsing
// https://github.com/josdejong/mathjs/issues/1220
const units = mathjs.Unit.UNITS;
Object.keys(units).forEach((unit) => { delete units[unit]; });
exports.default = mathjs;
