// Other -> Detector
objTypes['power'] = {

  // Create the obj
  create: function(mouse) {
    return {type: 'power', p1: mouse, p2: mouse, power: 0, normal: 0, shear: 0, irradianceMap: true, binSize: 1};
  },

  // Show the property box
  populateObjBar: function(obj, elem) {
    objBar.createBoolean(getMsg('irradiance_map'), !!obj.irradianceMap, function(obj, value) {
      obj.irradianceMap = value;
      if (value) {
        obj.binSize = 1;
      }
      if (obj == scene.objs[selectedObj]) {
        selectObj(selectedObj);
      }
    });
    
    if (obj.irradianceMap) {
      objBar.createNumber(getMsg('bin_size'), 0.01, 10, 0.01, obj.binSize || 1, function(obj, value) {
        obj.binSize = value;
      });

      objBar.createButton(getMsg('export_irradiance_map'), function(obj) {
        // Export the irradiance map to a CSV file
        var binSize = obj.binSize || 10;
        var binNum = Math.ceil(Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y)) / binSize);
        var binData = obj.binData;
        var csv = "data:text/csv;charset=utf-8,";

        // Write the header
        csv += "Position,Irradiance\n";

        // Write the data
        for (var i = 0; i < binNum; i++) {
          csv += i * binSize + "," + (binData[i] / binSize) + "\n";
        }
        var encodedUri = encodeURI(csv);
        
        // Download the file
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "irradiance_map.csv");
        document.body.appendChild(link);
        link.click();
      });
    }
  },

  // Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,

  // Draw the obj on canvas
  draw: function(obj, ctx, aboveLight) {
    if (!aboveLight) {
      ctx.globalCompositeOperation = 'lighter';

      ctx.strokeStyle = getMouseStyle(obj, 'rgb(192,192,192)')
      ctx.setLineDash([5,5]);
      ctx.beginPath();
      ctx.moveTo(obj.p1.x, obj.p1.y);
      ctx.lineTo(obj.p2.x, obj.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalCompositeOperation = 'lighter';
      var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
      
      var accuracy = Math.max(-Math.floor(Math.log10(totalTruncation)), 0);
      if (totalTruncation > 0 && accuracy <= 2) {
        var str1 = "P=" + obj.power.toFixed(accuracy) + "±" + totalTruncation.toFixed(accuracy);
        var str2 = "F⊥=" + obj.normal.toFixed(accuracy) + "±" + totalTruncation.toFixed(accuracy);
        var str3 = "F∥=" + obj.shear.toFixed(accuracy) + "±" + totalTruncation.toFixed(accuracy);
      } else {
        var str1 = "P=" + obj.power.toFixed(2);
        var str2 = "F⊥=" + obj.normal.toFixed(2);
        var str3 = "F∥=" + obj.shear.toFixed(2);
      }

      ctx.font = '16px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = getMouseStyle(obj, 'rgb(192,192,192)');
      ctx.fillText(str1, obj.p2.x, obj.p2.y);
      ctx.fillText(str2, obj.p2.x, obj.p2.y + 20);
      ctx.fillText(str3, obj.p2.x, obj.p2.y + 40);
      ctx.globalCompositeOperation = 'source-over';

      if (obj.irradianceMap && obj.binData) {
        // Define the unit vector of the x-axis of the plot (parallel to obj) and the y-axis of the plot (perpendicular to obj)
        var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
        var ux = (obj.p2.x - obj.p1.x) / len;
        var uy = (obj.p2.y - obj.p1.y) / len;
        var vx = uy;
        var vy = -ux;

        /*
        // Determine the maximum value of the irradiance map
        var max = 0;
        for (var i = 0; i < obj.binData.length; i++) {
          if (obj.binData[i] > max) {
            max = obj.binData[i];
          }
        }

        // Determine the first and last non-zero bin
        var first = 0;
        var last = obj.binData.length - 1;
        while (first < obj.binData.length && obj.binData[first] == 0) {
          first++;
        }

        while (last >= 0 && obj.binData[last] == 0) {
          last--;
        }
        */

        // Draw the irradiance map
        ctx.lineWidth = 1;
        ctx.strokeStyle = getMouseStyle(obj, 'rgb(255,255,255)');
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.moveTo(obj.p1.x, obj.p1.y);
        for (var i = 0; i < obj.binData.length; i++) {
          ctx.lineTo(obj.p1.x + ux * i * obj.binSize + vx * obj.binData[i] / obj.binSize * 20, obj.p1.y + uy * i * obj.binSize + vy * obj.binData[i] / obj.binSize * 20);
          ctx.lineTo(obj.p1.x + ux * (i+1) * obj.binSize + vx * obj.binData[i] / obj.binSize * 20, obj.p1.y + uy * (i+1) * obj.binSize + vy * obj.binData[i] / obj.binSize * 20);
        }
        ctx.lineTo(obj.p2.x, obj.p2.y);
        ctx.fill();
        ctx.stroke();


      }
    }

  },

  // Shoot rays
  shoot: function(obj) {
    obj.power = 0;
    obj.normal = 0;
    obj.shear = 0;

    if (obj.irradianceMap) {
      var binSize = obj.binSize || 10;
      var binNum = Math.ceil(Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y)) / binSize);
      var binData = [];
      for (var i = 0; i < binNum; i++) {
        binData[i] = 0;
      }
      obj.binData = binData;
    }
  },

  // When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, shootPoint) {
    var rcrosss = (ray.p2.x - ray.p1.x) * (obj.p2.y - obj.p1.y) - (ray.p2.y - ray.p1.y) * (obj.p2.x - obj.p1.x);
    var sint = rcrosss / Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y)) / Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
    var cost = ((ray.p2.x - ray.p1.x) * (obj.p2.x - obj.p1.x) + (ray.p2.y - ray.p1.y) * (obj.p2.y - obj.p1.y)) / Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y)) / Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
    ray.p2 = geometry.point(shootPoint.x + ray.p2.x - ray.p1.x, shootPoint.y + ray.p2.y - ray.p1.y);
    ray.p1 = geometry.point(shootPoint.x, shootPoint.y);

    obj.power += Math.sign(rcrosss) * (ray.brightness_s + ray.brightness_p);
    obj.normal += Math.sign(rcrosss) * sint * (ray.brightness_s + ray.brightness_p);
    obj.shear -= Math.sign(rcrosss) * cost * (ray.brightness_s + ray.brightness_p);

    if (obj.irradianceMap && obj.binData) {
      var binSize = obj.binSize || 10;
      var binNum = Math.ceil(Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y)) / binSize);
      var binIndex = Math.floor(Math.sqrt((shootPoint.x - obj.p1.x) * (shootPoint.x - obj.p1.x) + (shootPoint.y - obj.p1.y) * (shootPoint.y - obj.p1.y)) / binSize);
      obj.binData[binIndex] += Math.sign(rcrosss) * (ray.brightness_s + ray.brightness_p);
    }
  }

};
