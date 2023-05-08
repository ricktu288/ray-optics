/**
 * 优化canvasPainter.js 文件中的代码，
 *
 * 将重复的代码提取出来，减少代码冗余。例如，多次使用的颜色可以在函数外部定义，然后在函数内部使用。
 *
 * 避免使用不必要的条件语句。例如，当color存在时，可以使用逻辑或运算符来设置默认值。这可以减少代码行数并使代码更加简洁。
 *
 * 避免使用不必要的计算。例如，在计算直线端点的距离时，可以使用Math.hypot()函数来代替Math.abs()和Math.min()函数的组合。
 *
 * 避免使用不必要的变量。例如，在绘制射线时，可以将ang1和cvsLimit声明为局部变量，而不是在if语句之外声明。
 * 避免SVG导出时的bug
 * **/

var canvasPainter = {

    /**
     * Draw a geometric figure from graph.js
     * @method draw
     * @param {graph} graph
     * @param {String} [color='black']
     **/
    draw: function (graph, color) {
        switch (graph.type) {
            case 1: // point
                ctx.fillStyle = color || this.RED;
                ctx.fillRect(graph.x - 2.5, graph.y - 2.5, 5, 5);
                break;
            case 2: // line
                ctx.strokeStyle = color || this.BLACK;
                ctx.beginPath();
                var ang1 = Math.atan2(graph.p2.x - graph.p1.x, graph.p2.y - graph.p1.y);
                var cvsLimit = Math.hypot(graph.p1.x - origin.x, graph.p1.y - origin.y, canvas.height, canvas.width);
                ctx.moveTo(graph.p1.x - Math.sin(ang1) * cvsLimit, graph.p1.y - Math.cos(ang1) * cvsLimit);
                ctx.lineTo(graph.p1.x + Math.sin(ang1) * cvsLimit, graph.p1.y + Math.cos(ang1) * cvsLimit);
                ctx.stroke();
                break;
            case 3: // ray
                if (Math.abs(graph.p2.x - graph.p1.x) > 1e-5 || Math.abs(graph.p2.y - graph.p1.y) > 1e-5) {
                    ctx.strokeStyle = color || this.BLACK;
                    ctx.beginPath();
                    var ang1 = Math.atan2(graph.p2.x - graph.p1.x, graph.p2.y - graph.p1.y);
                    var cvsLimit = Math.hypot(graph.p1.x - origin.x, graph.p1.y - origin.y, canvas.height, canvas.width);
                    ctx.moveTo(graph.p1.x, graph.p1.y);
                    ctx.lineTo(graph.p1.x + Math.sin(ang1) * cvsLimit, graph.p1.y + Math.cos(ang1) * cvsLimit);
                    ctx.stroke();
                }
                break;
            case 4: // (line_)segment
                ctx.strokeStyle = color || this.BLACK;
                ctx.beginPath();
                ctx.moveTo(graph.p1.x, graph.p1.y);
                ctx.lineTo(graph.p2.x, graph.p2.y);
                ctx.stroke();
                break;
            case 5: // circle
                ctx.strokeStyle = color || this.BLACK;
                ctx.beginPath();
                if (typeof graph.r == 'object') {
                    var dx = graph.r.p1.x - graph.r.p2.x;
                    var dy = graph.r.p1.y - graph.r.p2.y;
                    ctx.arc(graph.c.x, graph.c.y, Math.sqrt(dx * dx + dy * dy), 0, Math.PI * 2, false);
                } else {
                    ctx.arc(graph.c.x, graph.c.y, graph.r, 0, Math.PI * 2, false);
                }
                ctx.stroke();
                break;
        }

    },

    /**
     * Clean the canvas
     * @method cls
     **/
    cls: function () {
        if (ctx.constructor !== C2S) {
            // 避免SVG导出时的bug
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(scale, 0, 0, scale, origin.x, origin.y);
            if (backgroundImage) {
                ctx.globalAlpha = 1;
                ctx.drawImage(backgroundImage, 0, 0);
            }
        } else if (!backgroundImage) {
            ctx.translate(origin.x / scale, origin.y / scale);
        }
    }
};