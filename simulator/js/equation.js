
function evaluateLatex(latex) {
  var latex_replaced = latex
    .replace("\\pi","PI")
    .replace("\\log","log")
    .replace("\\exp","exp")
    .replace("\\arcsin","asin")
    .replace("\\arccos","acos")
    .replace("\\arctan","atan")
    .replace("\\min","min")
    .replace("\\operatorname{floor}","floor");
  console.log(latex_replaced);
  return evaluatex(
    latex_replaced,
    {
      "pi": Math.PI,
      "e": Math.E
    },
    {latex: true});
}


