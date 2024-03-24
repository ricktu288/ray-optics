// Blocker -> Diffraction Grating
objTypes['diffractiongrating'] = {

    // Create the obj
    create: function(mouse) {
        return {type: 'diffractiongrating', p1: mouse, p2: mouse, line_density: 1000, mirrored: false};
    },

    // Use the prototype lineobj
    c_mousedown: objTypes['lineobj'].c_mousedown,
    c_mousemove: objTypes['lineobj'].c_mousemove,
    c_mouseup: objTypes['lineobj'].c_mouseup,
    move: objTypes['lineobj'].move,
    clicked: objTypes['lineobj'].clicked,
    dragging: objTypes['lineobj'].dragging,

    // Draw the obj on canvas
    draw: function(obj, ctx, aboveLight) {
    ctx.strokeStyle = getMouseStyle(obj, 'rgb(70,70,70)');
    ctx.beginPath();
    ctx.setLineDash([15, 15]);
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    },

    // Show the property box
    p_box: function(obj, elem) {
        createNumberAttr(getMsg('lines/mm'), 1, 2500, 5, obj.line_density, function(obj, value) {
            obj.line_density = value;
        }, elem);
        createBooleanAttr(getMsg('mirrored'), obj.mirrored, function(obj, value) {
            obj.mirrored = value;
        }, elem);
    },

    //Describes how the ray 
    rayIntersection: function(obj, ray) {
        return objTypes['lineobj'].rayIntersection(obj, ray);
        
    },

      // When the obj is shot by a ray
    shot: function(diffractiongrating, ray, rayIndex, rp) {
        const mm_in_nm = 1000000;
        var rx = ray.p1.x - rp.x;
        var ry = ray.p1.y - rp.y;
        var mx = diffractiongrating.p2.x - diffractiongrating.p1.x;
        var my = diffractiongrating.p2.y - diffractiongrating.p1.y;

        var wavelength = ray.wavelength? ray.wavelength : GREEN_WAVELENGTH;
        var brightness = ray.brightness? ray.brightness : 1;
       
        var crossProduct = rx * my - ry * mx;

        if (crossProduct > 0) {
            var right_point = diffractiongrating.p2;
            var left_point = diffractiongrating.p1;
            console.log("s_p2 is to the left of the ray.");
        } else if (crossProduct < 0) {
            var right_point = diffractiongrating.p1;
            var left_point = diffractiongrating.p2;
        }

        //If mirrored, reflect the rays rather than pass them
        var mirror = diffractiongrating.mirrored? -1 : 1;
        var ray_diff = graphs.ray(rp,graphs.point(rp.x - rx * mirror, rp.y - ry * mirror));

        ray_diff.wavelength = wavelength;
        ray_diff.brightness = brightness;

        addRay(ray_diff);
        
        //Find angles
        var theta = Math.asin(wavelength * diffractiongrating.line_density / mm_in_nm);
        if (theta){
            var theta_left = Math.PI - Math.atan2(left_point.y - rp.y,left_point.x - rp.x);
            var theta_i = Math.PI - Math.atan2(ry,rx);
            var diff_angle = theta_left < theta_i? theta_left + 2 * Math.PI - theta_i : theta_left - theta_i;
            //console.log("Incident Angle: ",theta_i," Theta: ",theta, " Left Angle: ", theta_left, "Right Angle: ", theta_right," Diff Angle: ", diff_angle);
            
            
            for (var m = 1; m * theta < diff_angle && m * theta < Math.PI; m++ ){
                var angle = (theta_i + m * theta) % (2 * Math.PI);
                var rx2 = Math.cos(Math.PI - angle);
                var ry2 = Math.sin(Math.PI - angle);

                var ray_left = graphs.ray(rp,graphs.point(rp.x - rx2 * mirror, rp.y - ry2 * mirror));
                ray_left.wavelength = wavelength;
                ray_left.brightness = brightness * (0.25 * m);
                    
                addRay(ray_left);
            }

            for (var m = 1; m * theta < Math.PI - diff_angle && m * theta < Math.PI; m++ ){
                var angle = (theta_i - m * theta) % (2 * Math.PI);
                var rx2 = Math.cos(Math.PI - angle);
                var ry2 = Math.sin(Math.PI - angle);

                var ray_right = graphs.ray(rp,graphs.point(rp.x - rx2 * mirror, rp.y - ry2 * mirror));
                ray_right.wavelength = wavelength;
                ray_right.brightness = brightness * (0.25 * m);
                    
                addRay(ray_right);
            }
        }
        

    },
};