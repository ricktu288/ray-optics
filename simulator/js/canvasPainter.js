var canvasPainter = {

  /**
  * Draw a geometric figure from graph.js
  * @method draw
  * @param {graph} graph
  * @param {String} [color='black']
  **/
  draw: function(graph, color) {
    // point
    if (graph.type == 1) {
      ctx.fillStyle = color ? color : 'red';
      ctx.fillRect(graph.x - 2.5, graph.y - 2.5, 5, 5);
    }
    // line
    else if (graph.type == 2) {
      ctx.strokeStyle = color ? color : 'black';
      ctx.beginPath();
      var ang1 = Math.atan2((graph.p2.x - graph.p1.x), (graph.p2.y - graph.p1.y)); //從斜率取得角度 Get the angle from the slope 
      var cvsLimit = (Math.abs(graph.p1.x + origin.x) + Math.abs(graph.p1.y + origin.y) + canvas.height + canvas.width) / Math.min(1, scale);  //取一個會超出繪圖區的距離(當做直線端點) Choose a distance exceeding the edge of the drawing area (for the endpoint of the line) Choose a distance exceeding the edge of the drawing area (for the endpoint of the line)
      ctx.moveTo(graph.p1.x - Math.sin(ang1) * cvsLimit, graph.p1.y - Math.cos(ang1) * cvsLimit);
      ctx.lineTo(graph.p1.x + Math.sin(ang1) * cvsLimit, graph.p1.y + Math.cos(ang1) * cvsLimit);
      ctx.stroke();
    }
    // ray
    else if (graph.type == 3) {
      ctx.strokeStyle = color ? color : 'black';
      var ang1, cvsLimit;
      if (Math.abs(graph.p2.x - graph.p1.x) > 1e-5 || Math.abs(graph.p2.y - graph.p1.y) > 1e-5)
      {
        ctx.beginPath();
        ang1 = Math.atan2((graph.p2.x - graph.p1.x), (graph.p2.y - graph.p1.y)); //從斜率取得角度 Get the angle from the slope 
        cvsLimit = (Math.abs(graph.p1.x + origin.x) + Math.abs(graph.p1.y + origin.y) + canvas.height + canvas.width) / Math.min(1, scale);  //取一個會超出繪圖區的距離(當做直線端點) Choose a distance exceeding the edge of the drawing area (for the endpoint of the line)
        ctx.moveTo(graph.p1.x, graph.p1.y);
        ctx.lineTo(graph.p1.x + Math.sin(ang1) * cvsLimit, graph.p1.y + Math.cos(ang1) * cvsLimit);
        ctx.stroke();
      }
    }
    // (line_)segment
    else if (graph.type == 4) {
      ctx.strokeStyle = color ? color : 'black';
      ctx.beginPath();
      ctx.moveTo(graph.p1.x, graph.p1.y);
      ctx.lineTo(graph.p2.x, graph.p2.y);
      ctx.stroke();
    }
    // circle
    else if (graph.type == 5) {
      ctx.strokeStyle = color ? color : 'black';
      ctx.beginPath();
      if (typeof graph.r == 'object') {
        var dx = graph.r.p1.x - graph.r.p2.x;
        var dy = graph.r.p1.y - graph.r.p2.y;
        ctx.arc(graph.c.x, graph.c.y, Math.sqrt(dx * dx + dy * dy), 0, Math.PI * 2, false);
      } else {
        ctx.arc(graph.c.x, graph.c.y, graph.r, 0, Math.PI * 2, false);
      }
      ctx.stroke();
    }
  },

  /**
  * Clean the canvas
  * @method cls
  **/
  cls: function() {
    if (ctx.constructor != C2S) {
        //only do this when not being exported to SVG to avoid bug
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale,0,0,scale,origin.x, origin.y);
        if (backgroundImage) {
            ctx.globalAlpha = 1;
            ctx.drawImage(backgroundImage,0,0);
        }
    } else if (!backgroundImage) {
        ctx.translate(origin.x / scale, origin.y / scale);
    }
  }
};
