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

    //Describes how the ray intersects the grating
    rayIntersection: function(obj, ray) {
        return objTypes['lineobj'].rayIntersection(obj, ray);
    },

      // When the obj is shot by a ray
    shot: function(diffractiongrating, ray, rayIndex, rp) {
        const mm_in_nm = 1/1000000;
        var rx = ray.p1.x - rp.x;
        var ry = ray.p1.y - rp.y;
        var mx = diffractiongrating.p2.x - diffractiongrating.p1.x;
        var my = diffractiongrating.p2.y - diffractiongrating.p1.y;
        ray.exist = false;

        var wavelength = ray.wavelength || GREEN_WAVELENGTH;
        var brightness_s = ray.brightness_s;
        var brightness_p = ray.brightness_p;
    
        //Find which side the incoming ray is hitting the diffraction line segment
        var crossProduct = rx * my - ry * mx;
        var left_point = crossProduct > 0? diffractiongrating.p1 : diffractiongrating.p2;

        //If mirrored, reflect the rays rather than pass them
        var mirror = diffractiongrating.mirrored? -1 : 1;
        
        //Find angles
        var theta = Math.asin(wavelength * diffractiongrating.line_density * mm_in_nm);
        if (theta){
            var theta_left = Math.PI - Math.atan2(left_point.y - rp.y,left_point.x - rp.x);
            var theta_i = Math.PI - Math.atan2(ry,rx);
            var diff_angle = theta_left < theta_i? theta_left + 2 * Math.PI - theta_i : theta_left - theta_i; 
            //Emit diffracting rays on both sides of m0
            for (var m = 0; m * theta < diff_angle && m * theta < Math.PI; m++){
                var angle = (theta_i + m * theta) % (2 * Math.PI);
                var rx2 = Math.cos(Math.PI - angle);
                var ry2 = Math.sin(Math.PI - angle);
                var ray_left = graphs.ray(rp, graphs.point(rp.x - rx2 * mirror,rp.y - ry2 * mirror));
                ray_left.wavelength = wavelength;
                ray_left.brightness_s = brightness_s * (4 * theta/(Math.PI));
                ray_left.brightness_p = brightness_p * (4 * theta/(Math.PI));
                if (ray_left.brightness_s + ray_left.brightness_p > 0.01){
                    addRay(ray_left);
                }
            }

            for (var m = 0; m * theta < Math.PI - diff_angle && m * theta < Math.PI; m++){
                var angle = (theta_i - m * theta) % (2 * Math.PI);
                var rx2 = Math.cos(Math.PI - angle);
                var ry2 = Math.sin(Math.PI - angle);

                var ray_right = graphs.ray(rp, graphs.point(rp.x - rx2 * mirror,rp.y - ry2 * mirror));
                ray_right.wavelength = wavelength;
                ray_right.brightness_s = brightness_s * (4 * theta/(Math.PI));
                ray_right.brightness_p = brightness_p * (4 * theta/(Math.PI));
                if (ray_right.brightness_s + ray_right.brightness_p > 0.01){
                    addRay(ray_right);
                }
            }
        }
        
    },
};