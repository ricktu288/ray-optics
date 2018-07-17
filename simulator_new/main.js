import { Painter } from "./canvas.js";
import { PointShape, LineShape, RayShape, SegmentShape, CircleShape } from "./shapes.js";

window.onload = function (/*e*/) {
  let canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  let ctx = canvas.getContext("2d");
  let p = new Painter(ctx, canvas.width, canvas.height);
  p.objs.push(new PointShape(100, 400));
  p.objs.push(new LineShape(200, 500, 300, 400));
  p.objs.push(new RayShape(100, 400, 200, 700));
  p.objs.push(new SegmentShape(300, 400, 400, 700));
  p.objs.push(new CircleShape(400, 400, 400, 700));
  // Start redrawing loop.
  setTimeout(p.Draw.bind(p), 10);
};