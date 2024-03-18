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
       
        var theta_offset = 0;
        //If mirrored, reflect the rays rather than pass them
        
        if (!diffractiongrating.mirrored){
            var ray_diff = graphs.ray(rp,graphs.point(rp.x - rx, rp.y - ry));   
        }
        else{
            var ray_diff = graphs.ray(rp,graphs.point(rp.x + rx, rp.y + ry));
            theta_offset = Math.PI;
        }

        ray_diff.wavelength = ray.wavelength;
        ray_diff.brightness = ray.brightness;

        addRay(ray_diff);

        //Max number of m before theta > 90 degrees
        var m = Math.floor(mm_in_nm / (wavelength * diffractiongrating.line_density));
        //Find angle between coherence
        magnitude = Math.sqrt(rx * rx + ry * ry);
        var theta_i = Math.atan2(ry,rx);
        var theta = Math.asin(this.keepAngleInAsinBounds(wavelength * diffractiongrating.line_density / mm_in_nm)) + theta_offset;
        
        
        for (var i = 1; i <= m; i++){
            var rx2 = magnitude * Math.cos(theta_i - i * theta);
            var ry2 = magnitude * Math.sin(theta_i - i * theta);

            var ray_pos = graphs.ray(rp,graphs.point(rp.x - rx2, rp.y - ry2));
            ray_diff.wavelength = ray.wavelength;
            ray_diff.brightness = ray.brightness;
                
            addRay(ray_pos);

            var rx2 = magnitude * Math.cos(theta_i + i * theta);
            var ry2 = magnitude * Math.sin(theta_i + i * theta);

            var ray_neg = graphs.ray(rp,graphs.point(rp.x - rx2, rp.y - ry2));
            ray_diff.wavelength = ray.wavelength;
            ray_diff.brightness = ray.brightness;
                
            addRay(ray_neg);
        }

    },
    keepAngleInAsinBounds: function(angle) {
        while (angle < -Math.PI / 2) {
            angle += 2 * Math.PI;
        }
        while (angle > Math.PI / 2) {
            angle -= 2 * Math.PI;
        }
        return angle;
    }
};