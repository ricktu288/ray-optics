
function evaluateLatex(latex) {
  var latex_replaced = latex
    .replaceAll("\\pi","PI")
    .replaceAll("\\log","log")
    .replaceAll("\\exp","exp")
    .replaceAll("\\arcsin","asin")
    .replaceAll("\\arccos","acos")
    .replaceAll("\\arctan","atan")
    .replaceAll("\\sinh","sinh")
    .replaceAll("\\cosh","cosh")
    .replaceAll("\\tanh","tanh")
    .replaceAll("\\operatorname{asin}","asin")
    .replaceAll("\\operatorname{acos}","acos")
    .replaceAll("\\operatorname{atan}","atan")
    .replaceAll("\\operatorname{asinh}","asinh")
    .replaceAll("\\operatorname{acosh}","acosh")
    .replaceAll("\\operatorname{atanh}","atanh")
    .replaceAll("\\operatorname{arcsinh}","asinh")
    .replaceAll("\\operatorname{arccosh}","acosh")
    .replaceAll("\\operatorname{arctanh}","atanh")
    .replaceAll("\\operatorname{floor}","floor")
    .replaceAll("\\operatorname{round}","round")
    .replaceAll("\\operatorname{trunc}","trunc")
    .replaceAll("\\operatorname{sign}","sign")
    .replaceAll("\\operatorname{sgn}","sign")
    .replaceAll("\\max","max")
    .replaceAll("\\min","min")
    .replaceAll("\\operatorname{abs}","abs")
    .replaceAll("\\left|","|")
    .replaceAll("\\right|","|");
  //console.log(latex_replaced);
  return evaluatex(
    latex_replaced,
    {
      "pi": Math.PI,
      "e": Math.E
    },
    {latex: true});
}


