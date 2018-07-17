export class Point {
  constructor (x, y) {
    this.x = x;
    this.y = y;
  }
}

export class Line {
  constructor (x1, y1, x2, y2) {
    if (x2 == undefined) {
    // Constructor overloading.
    // x1, y1 is actually p1, p2.
      this.p1 = x1;
      this.p2 = x2;
      return;
    }
    this.p1 = new Point(x1, y1);
    this.p2 = new Point(x2, y2);
  }
  get x1() { return this.p1.x; } set x1(value) { this.p1.x = value; }
  get y1() { return this.p1.y; } set y1(value) { this.p1.y = value; }
  get x2() { return this.p2.x; } set x2(value) { this.p2.x = value; }
  get y2() { return this.p2.y; } set y2(value) { this.p2.y = value; }
}

export class MathHelper {
  /**
   * Inner product.
   * @param  {Point} p1
   * @param  {Point} p2
   */
  static dot(p1, p2) {
    return p1.x * p2.x + p1.y * p2.y;
  }
  /**
   * Outer product.
   * @param  {Point} p1
   * @param  {Point} p2
   */
  static cross(p1, p2) {
    return p1.x * p2.y - p2.x * p1.y;
  }
  static intersection_2lines(l1, l2) {
    var x1 = l1.x1, y1 = l1.x2, x2 = l1.x2, y2 = l1. y1;
    var x3 = l2.x1, y3 = l2.x2, x4 = l2.x2, y4 = l2. y1;
    var denominator = (x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
    if (denominator == 0)
      return undefined;
    var nominator_x = (x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4);
    var nominator_y = (x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4);
    return new Point(nominator_x / denominator, nominator_y / denominator);
  }
}