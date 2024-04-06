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

        var wavelength = (ray.wavelength || GREEN_WAVELENGTH) * mm_in_nm;
        var interval = 1/diffractiongrating.line_density;
    
        //Find which side the incoming ray is hitting the diffraction line segment
        var crossProduct = rx * my - ry * mx;
        var left_point = crossProduct > 0? diffractiongrating.p1 : diffractiongrating.p2;

        //If mirrored, reflect the rays rather than pass them
        var mirror = diffractiongrating.mirrored? -1 : 1;
        
        //Find angles
        var theta_left = Math.PI - Math.atan2(left_point.y - rp.y,left_point.x - rp.x);
        var theta_i = Math.PI - Math.atan2(ry,rx);
        var incidence_angle = Math.PI/2 - (theta_left < theta_i? theta_left + 2 * Math.PI - theta_i : theta_left - theta_i);
        //console.log(incidence_angle)

        var m_min = -Math.floor(interval/wavelength*(1-Math.sin(incidence_angle)));
        var m_max = -Math.ceil(interval/wavelength*(-1-Math.sin(incidence_angle)));

        console.log(m_min, m_max);
        for (var m = m_min; m <= m_max; m++) {
            var diffracted_angle = Math.asin(Math.sin(incidence_angle) - m * wavelength / interval);
            //console.log(diffracted_angle);

            var rot_c = Math.cos(mirror * (-Math.PI/2 - diffracted_angle));
            var rot_s = Math.sin(mirror * (-Math.PI/2 - diffracted_angle));
            var diffracted_ray = graphs.ray(rp, graphs.point(rp.x + (left_point.x-rp.x) * rot_c - (left_point.y-rp.y) * rot_s, rp.y + (left_point.x-rp.x) * rot_s + (left_point.y-rp.y) * rot_c));
            
            diffracted_ray.wavelength = ray.wavelength;
            diffracted_ray.brightness_s = ray.brightness_s;
            diffracted_ray.brightness_p = ray.brightness_p;

            // There is currently no good way to make image detection work here. So just set gap to true to disable image detection for the diffracted rays.
            diffracted_ray.gap = true;

            addRay(diffracted_ray);
        }
    },
};