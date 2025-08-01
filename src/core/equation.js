/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
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

import evaluatex from 'evaluatex/dist/evaluatex.js';

export function evaluateLatex(latex) {
  var latex_replaced = latex
    .replaceAll("\\cdot","*")
    .replaceAll("\\pi","(PI)")
    .replaceAll("\\log"," log")
    .replaceAll("\\exp"," exp")
    .replaceAll("\\arcsin"," asin")
    .replaceAll("\\arccos"," acos")
    .replaceAll("\\arctan"," atan")
    .replaceAll("\\sinh"," sinh")
    .replaceAll("\\cosh"," cosh")
    .replaceAll("\\tanh"," tanh")
    .replaceAll("\\operatorname{asin}"," asin")
    .replaceAll("\\operatorname{acos}"," acos")
    .replaceAll("\\operatorname{atan}"," atan")
    .replaceAll("\\operatorname{asinh}"," asinh")
    .replaceAll("\\operatorname{acosh}"," acosh")
    .replaceAll("\\operatorname{atanh}"," atanh")
    .replaceAll("\\operatorname{arcsinh}"," asinh")
    .replaceAll("\\operatorname{arccosh}"," acosh")
    .replaceAll("\\operatorname{arctanh}"," atanh")
    .replaceAll("\\operatorname{floor}"," floor")
    .replaceAll("\\operatorname{ceil}"," ceil")
    .replaceAll("\\operatorname{round}"," round")
    .replaceAll("\\operatorname{trunc}"," trunc")
    .replaceAll("\\operatorname{sign}"," sign")
    .replaceAll("\\operatorname{sgn}"," sign")
    .replaceAll("\\max"," max")
    .replaceAll("\\min"," min")
    .replaceAll("\\operatorname{abs}"," abs")
    .replaceAll("\\left|","|")
    .replaceAll("\\right|","|")
    .replaceAll("\\mathrm{sech}"," sech");
  //console.log(latex_replaced);
  return evaluatex(
    latex_replaced,
    {
      "pi": Math.PI,
      "e": Math.E,
      "sech": function(x) {
        return 1/Math.cosh(x); // This is to make tanh works in GRIN lens, whose derivative is sech^2.
      }
    },
    {latex: true});
}


