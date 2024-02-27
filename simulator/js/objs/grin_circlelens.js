// Glass -> Gradient-index circle
objTypes['grin_circlelens'] = {

	supportSurfaceMerging: true, // Surface merging

	// Create the obj
	create: function (constructionPoint) {
		const p = '1 + e ^ (-((x ^ 2 + y ^ 2) / 50 ^ 2))';
		const p_tex = '1+e^{-\\frac{x^2+y^2}{50^2}}';
		const p_der_x = 'e ^ ((x ^ 2 + y ^ 2) * -1 / 2500) * x * -1 / 1250';
		const p_der_x_tex = '\\frac{{ e}^{\\left(\\frac{\\left({ x}^{2}+{ y}^{2}\\right)\\cdot-1}{2500}\\right)}\\cdot x\\cdot-1}{1250}';
		const p_der_y = 'e ^ ((x ^ 2 + y ^ 2) * -1 / 2500) * y * -1 / 1250';
		const p_der_y_tex = '\\frac{{ e}^{\\left(\\frac{\\left({ x}^{2}+{ y}^{2}\\right)\\cdot-1}{2500}\\right)}\\cdot y\\cdot-1}{1250}';
		const origin = geometry.point(constructionPoint.x, constructionPoint.y); // origin of refractive index function n(x,y)
		return { type: 'grin_circlelens', p1: constructionPoint, p2: constructionPoint, origin: origin, p: p, p_tex: p_tex, p_der_x: p_der_x, p_der_x_tex: p_der_x_tex, p_der_y: p_der_y, p_der_y_tex: p_der_y_tex, fn_p: evaluateLatex(p_tex), fn_p_der_x: evaluateLatex(p_der_x_tex), fn_p_der_y: evaluateLatex(p_der_y_tex), step_size: 1, eps: 1e-3 }; // Note that in this object, eps has units of [length]^2  },
	},

	// Show the property box
	populateObjBar: function (obj, objBar) {
		if (!obj.fn_p) { // to maintain the ctrl+z functionality
			try {
				obj.fn_p = evaluateLatex(obj.p_tex);
				obj.fn_p_der_x = evaluateLatex(obj.p_der_x_tex);
				obj.fn_p_der_y = evaluateLatex(obj.p_der_y_tex);
				delete obj.error;
			} catch (e) {
				obj.error = e.toString();
				delete obj.fn_p;
				delete obj.fn_p_der_x;
				delete obj.fn_p_der_y;
				return;
			}
		}
		objBar.createEquation('n(x,y) = ', obj.p_tex, function (obj, value) {
			try {
				obj.p = parseTex(value).toString().replaceAll("\\cdot", "*").replaceAll("\\frac", "/");
				obj.p_tex = value;
				obj.p_der_x = math.derivative(obj.p, 'x').toString();
				obj.p_der_x_tex = math.parse(obj.p_der_x).toTex().replaceAll("{+", "{"); // 'evaluateLatex' function can't and can handle expressions of the form '...num^{+exp}...' and '...num^{exp}...', respectively, where num and exp are numbers
				obj.p_der_y = math.derivative(obj.p, 'y').toString();
				obj.p_der_y_tex = math.parse(obj.p_der_y).toTex().replaceAll("{+", "{"); //
				obj.fn_p = evaluateLatex(obj.p_tex);
				obj.fn_p_der_x = evaluateLatex(obj.p_der_x_tex);
				obj.fn_p_der_y = evaluateLatex(obj.p_der_y_tex);
				delete obj.error;
			} catch (e) {
				obj.error = e.toString();
			}
		}, getMsg('grin_refractive_index'));

		objBar.createTuple(getMsg('refractiveindex_origin'), '(' + obj.origin.x + ',' + obj.origin.y + ')', function (obj, value) {
			const commaPosition = value.indexOf(',');
			if (commaPosition != -1) {
				const n_origin_x = parseFloat(value.slice(1, commaPosition));
				const n_origin_y = parseFloat(value.slice(commaPosition + 1, -1));
				obj.origin = geometry.point(n_origin_x, n_origin_y);
			}
		});

		if (objBar.showAdvanced(obj.step_size != 1 || obj.eps != 0.001 || scene.symbolicGrin)) {
			objBar.createNumber(getMsg('step_size'), 0.1, 1, 0.1, obj.step_size, function (obj, value) {
				obj.step_size = parseFloat(value);
			}, getMsg('step_size_note_popover'));

			objBar.createNumber(getMsg('eps'), 1e-3, 1e-2, 1e-3, obj.eps, function (obj, value) {
				obj.eps = parseFloat(value);
			}, getMsg('eps_' + obj.type + '_note_popover'));

			objBar.createBoolean(getMsg('symbolic_grin'), scene.symbolicGrin, function (obj, value) {
				scene.symbolicGrin = value;
			}, getMsg('symbolic_grin_note_popover'));
		}
	},

	// Use the prototype circleobj
	onConstructMouseUp: objTypes['circleobj'].onConstructMouseUp,
	onConstructMouseDown: objTypes['circleobj'].onConstructMouseDown,
	onConstructMouseMove: objTypes['circleobj'].onConstructMouseMove,
	move: objTypes['circleobj'].move,

	// Use the prototype circlelens
	checkMouseOver: objTypes['circlelens'].checkMouseOver,
	onDrag: objTypes['circlelens'].onDrag,
	getShotType: objTypes['circlelens'].getShotType,

	zIndex: objTypes['refractor'].zIndex,

	fillGlass: function (n, obj, ctx, aboveLight) {
		if (aboveLight) {
			// Draw the highlight only
			ctx.globalAlpha = 0.1;
			ctx.fillStyle = getMouseStyle(obj, 'transparent');
			ctx.fill('evenodd');
			ctx.globalAlpha = 1;
			return;
		}
		ctx.fillStyle = "rgba(255,0,255,0.15)";
		ctx.fill('evenodd');
		ctx.globalAlpha = 1;
	},

	// Draw the obj on canvas
	draw: function (obj, ctx, aboveLight) {

		if (obj.error) {
			ctx.textAlign = 'left';
			ctx.textBaseline = 'bottom';
			ctx.font = '12px serif';
			ctx.fillStyle = "red"
			ctx.fillText(obj.error.toString(), obj.p1.x, obj.p1.y);
		}

		ctx.beginPath();
		ctx.arc(obj.p1.x, obj.p1.y, geometry.length_segment(obj), 0, Math.PI * 2, false);
		this.fillGlass(2.3, obj, ctx, aboveLight);
		ctx.lineWidth = 1;
		//ctx.fillStyle="indigo";
		ctx.fillStyle = 'red';
		ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
		//ctx.fillStyle="rgb(255,0,255)";
		if (obj == mouseObj) {
			ctx.fillStyle = 'magenta';
			//ctx.fillStyle="Purple";
			ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
		}


	},

	// Test if a ray may shoot on this object (if yes, return the intersection)
	rayIntersection: function (obj, ray) {
		if (!obj.fn_p) { // to maintain the ctrl+z functionality
			try {
				obj.fn_p = evaluateLatex(obj.p_tex);
				obj.fn_p_der_x = evaluateLatex(obj.p_der_x_tex);
				obj.fn_p_der_y = evaluateLatex(obj.p_der_y_tex);
			} catch (e) {
				delete obj.fn_p;
				delete obj.fn_p_der_x;
				delete obj.fn_p_der_y;
				return;
			}
		}
		if (objTypes[obj.type].isInsideGlass(obj, ray.p1) || objTypes[obj.type].isOnBoundary(obj, ray.p1)) // if the first point of the ray is inside the circle, or on its boundary
		{
			let len = geometry.length(ray.p1, ray.p2);
			let x = ray.p1.x + (obj.step_size / len) * (ray.p2.x - ray.p1.x);
			let y = ray.p1.y + (obj.step_size / len) * (ray.p2.y - ray.p1.y);
			intersection_point = geometry.point(x, y);
			if (objTypes[obj.type].isInsideGlass(obj, intersection_point)) // if intersection_point is inside the circle
				return intersection_point;
		}
		return objTypes[obj.type.substring(obj.type.indexOf('_') + 1)].rayIntersection(obj, ray);
	},

	// When the obj is shot by a ray
	shot: function (obj, ray, rayIndex, rp, surfaceMerging_objs) {
		try {
			if ((objTypes[obj.type].isInsideGlass(obj, ray.p1) || objTypes[obj.type].isOutsideGlass(obj, ray.p1)) && objTypes[obj.type].isOnBoundary(obj, rp)) // if the ray is hitting the circle from the outside, or from the inside (meaning that the point rp is on the boundary of the circle, and the point ray.p1 is inside/outside the circle)
			{
				var midpoint = geometry.midpoint(geometry.line_segment(ray.p1, rp));
				var d = geometry.length_squared(obj.p1, obj.p2) - geometry.length_squared(obj.p1, midpoint);
				let p = obj.fn_p({ x: rp.x - obj.origin.x, y: rp.y - obj.origin.y }); // refractive index at the intersection point - rp
				if (d > 0) {
					// Shot from inside to outside
					var n1 = (!scene.colorMode) ? p : (p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)); // The refractive index of the source material (assuming the destination has 1)
					var normal = { x: obj.p1.x - rp.x, y: obj.p1.y - rp.y };
				}
				else if (d < 0) {
					// Shot from outside to inside
					var n1 = 1 / ((!scene.colorMode) ? p : (p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)));
					var normal = { x: rp.x - obj.p1.x, y: rp.y - obj.p1.y };
				}
				else {
					// Situation that may cause bugs (e.g. shot at an edge point)
					// To prevent shooting the ray to a wrong direction, absorb the ray
					ray.exist = false;
					return;
				}

				/*
				A bodyMerging object is an object containing three properties - "fn_p", "fn_p_der_x" and "fn_p_der_y", 
				which are the refractive index and its partial derivative functions, respectively, for some region of the simulation.
				Every ray has a temporary bodyMerging object ("bodyMerging_obj") as a property
				(this property exists only while the ray is inside a region of one or several overlapping grin objects - e.g. grin_circlelens and grin_refractor),
				which gets updated as the ray enters/exits into/from grin objects, using the
				"multRefIndex"/"devRefIndex" function, respectively.
				*/
				let r_bodyMerging_obj; // save the current bodyMerging_obj of the ray, to pass it later to the reflected ray in the 'refract' function
				if (surfaceMerging_objs.length) {
					var shotType;

					// Surface merging
					for (var i = 0; i < surfaceMerging_objs.length; i++) {
						let p = surfaceMerging_objs[i].fn_p({ x: rp.x - surfaceMerging_objs[i].origin.x, y: rp.y - surfaceMerging_objs[i].origin.y }) // refractive index at the intersection point - rp
						shotType = objTypes[surfaceMerging_objs[i].type].getShotType(surfaceMerging_objs[i], ray);
						if (shotType == 1) {
							// Shot from inside to outside
							n1 *= (!scene.colorMode) ? p : (p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001));
						}
						else if (shotType == -1) {
							// Shot from outside to inside
							n1 /= (!scene.colorMode) ? p : (p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001));
						}
						else if (shotType == 0) {
							// Equivalent to not shot on the obj (e.g. two interfaces overlap)
							//n1=n1;
						}
						else {
							// Situation that may cause bugs (e.g. shot at an edge point)
							// To prevent shooting the ray to a wrong direction, absorb the ray
							ray.exist = false;
							return;
						}
					}
				}
				else {
					if (objTypes[obj.type].isInsideGlass(obj, ray.p1)) {
						if (ray.bodyMerging_obj === undefined)
							ray.bodyMerging_obj = objTypes[obj.type].initRefIndex(obj, ray); // Initialize the bodyMerging object of the ray
						r_bodyMerging_obj = ray.bodyMerging_obj; // Save the current bodyMerging object of the ray
						ray.bodyMerging_obj = objTypes[obj.type].devRefIndex(ray.bodyMerging_obj, obj);	// The ray exits the "obj" grin object, and therefore its bodyMerging object is to be updated

					}
					else {
						r_bodyMerging_obj = ray.bodyMerging_obj; // Save the current bodyMerging object of the ray
						if (ray.bodyMerging_obj !== undefined)
							ray.bodyMerging_obj = objTypes[obj.type].multRefIndex(ray.bodyMerging_obj, obj); // The ray enters the "obj" grin object, and therefore its bodyMerging object is to be updated
						else
							ray.bodyMerging_obj = { p: obj.p, fn_p: obj.fn_p, fn_p_der_x: obj.fn_p_der_x, fn_p_der_y: obj.fn_p_der_y }; // Initialize the bodyMerging object of the ray
					}
				}
				objTypes[obj.type].refract(ray, rayIndex, rp, normal, n1, r_bodyMerging_obj);
			}
			else {
				if (ray.bodyMerging_obj === undefined)
					ray.bodyMerging_obj = objTypes[obj.type].initRefIndex(obj, ray); // Initialize the bodyMerging object of the ray
				next_point = objTypes[obj.type].step(obj, obj.origin, ray.p1, rp, ray);
				ray.p1 = rp;
				ray.p2 = next_point;
			}
		} catch (e) {
			ray.exist = false;
			return;
		}

	},

	// Identical to the circlelens "refract" function, except for the "r_bodyMerging_obj" parameter and the assigning to ray2.bodyMerging_obj
	refract: function (ray, rayIndex, s_point, normal, n1, r_bodyMerging_obj) {
		var normal_len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
		var normal_x = normal.x / normal_len;
		var normal_y = normal.y / normal_len;

		var ray_len = Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y));

		var ray_x = (ray.p2.x - ray.p1.x) / ray_len;
		var ray_y = (ray.p2.y - ray.p1.y) / ray_len;


		// Reference http://en.wikipedia.org/wiki/Snell%27s_law#Vector_form

		var cos1 = -normal_x * ray_x - normal_y * ray_y;
		var sq1 = 1 - n1 * n1 * (1 - cos1 * cos1);


		if (sq1 < 0) {
			// Total internal reflection
			ray.p1 = s_point;
			ray.p2 = geometry.point(s_point.x + ray_x + 2 * cos1 * normal_x, s_point.y + ray_y + 2 * cos1 * normal_y);


		}
		else {
			// Refraction
			var cos2 = Math.sqrt(sq1);

			var R_s = Math.pow((n1 * cos1 - cos2) / (n1 * cos1 + cos2), 2);
			var R_p = Math.pow((n1 * cos2 - cos1) / (n1 * cos2 + cos1), 2);
			// Reference http://en.wikipedia.org/wiki/Fresnel_equations#Definitions_and_power_equations

			// Handle the reflected ray
			var ray2 = geometry.ray(s_point, geometry.point(s_point.x + ray_x + 2 * cos1 * normal_x, s_point.y + ray_y + 2 * cos1 * normal_y));
			ray2.brightness_s = ray.brightness_s * R_s;
			ray2.brightness_p = ray.brightness_p * R_p;
			ray2.wavelength = ray.wavelength;
			ray2.gap = ray.gap;
			ray2.bodyMerging_obj = r_bodyMerging_obj;
			if (ray2.brightness_s + ray2.brightness_p > 0.01) {
				addRay(ray2);
			}
			else {
				totalTruncation += ray2.brightness_s + ray2.brightness_p;
				if (!ray.gap) {
					var amp = Math.floor(0.01 / ray2.brightness_s + ray2.brightness_p) + 1;
					if (rayIndex % amp == 0) {
						ray2.brightness_s = ray2.brightness_s * amp;
						ray2.brightness_p = ray2.brightness_p * amp;
						addRay(ray2);
					}
				}
			}

			// Handle the refracted ray
			ray.p1 = s_point;
			ray.p2 = geometry.point(s_point.x + n1 * ray_x + (n1 * cos1 - cos2) * normal_x, s_point.y + n1 * ray_y + (n1 * cos1 - cos2) * normal_y);
			ray.brightness_s = ray.brightness_s * (1 - R_s);
			ray.brightness_p = ray.brightness_p * (1 - R_p);
		}
	},

	// Receives an instance of a grin object(e.g. grin_circlelens and grin_refractor), and two points inside this lens,
	// and returns the next point to where the ray, connecting these two points, will travel, based on the ray trajectory equation (equation 11.1 in the cited text below)
	/*
	using Euler's method to solve the ray trajectory equation (based on sections 11.1 and 11.2, in the following text: https://doi.org/10.1007/BFb0012092)
	x_der_s and x_der_s_prev are the x-coordinate derivatives with respect to the arc-length parameterization, at two different points (similarly for y_der_s and y_der_s_prev)
	*/
	step: function (obj, origin, p1, p2, ray) {
		const len = geometry.length(p1, p2);
		const x = p2.x - origin.x;
		const y = p2.y - origin.y;
		const x_der_s_prev = (p2.x - p1.x) / len;
		const y_der_s_prev = Math.sign(p2.y - p1.y) * Math.sqrt(1 - x_der_s_prev ** 2);

		const x_der_s = x_der_s_prev + obj.step_size * (ray.bodyMerging_obj.fn_p_der_x({ x: x, y: y }) * (1 - x_der_s_prev ** 2) - ray.bodyMerging_obj.fn_p_der_y({ x: x, y: y }) * x_der_s_prev * y_der_s_prev) / ray.bodyMerging_obj.fn_p({ x: x, y: y });
		const y_der_s = y_der_s_prev + obj.step_size * (ray.bodyMerging_obj.fn_p_der_y({ x: x, y: y }) * (1 - y_der_s_prev ** 2) - ray.bodyMerging_obj.fn_p_der_x({ x: x, y: y }) * x_der_s_prev * y_der_s_prev) / ray.bodyMerging_obj.fn_p({ x: x, y: y });

		const x_new = origin.x + x + obj.step_size * x_der_s;
		const y_new = origin.y + y + obj.step_size * y_der_s;

		return geometry.point(x_new, y_new);
	},

	// Receives an instance of a grin object(e.g. grin_circlelens and grin_refractor) and a ray, and returns a bodyMerging object for the point ray.p1
	/*
	For example, "fn_p" is constructed by going through all of the grin objects in the "scene.objs" array,
	such that ray.p1 in their interior or on their boundary, and creating a product of all of their
	refractive index functions. "fn_p_der_x" and "fn_p_der_y" are created similarly, taking into account the partial derivative.
	*/
	initRefIndex: function (obj, ray) {
		let obj_tmp = {};
		for (let i = 0; i < scene.objs.length; i++) {
			if ((scene.objs[i].type === "grin_circlelens" || scene.objs[i].type === "grin_refractor") && (objTypes[scene.objs[i].type].isOnBoundary(scene.objs[i], ray.p1) || objTypes[scene.objs[i].type].isInsideGlass(scene.objs[i], ray.p1))) {
				if (obj_tmp.fn_p === undefined) {
					obj_tmp.p = scene.objs[i].p;
					obj_tmp.fn_p = scene.objs[i].fn_p;
					obj_tmp.fn_p_der_x = scene.objs[i].fn_p_der_x;
					obj_tmp.fn_p_der_y = scene.objs[i].fn_p_der_y;
				}
				else
					obj_tmp = objTypes[obj.type].multRefIndex(obj_tmp, scene.objs[i]);

			}
		}
		return obj_tmp;
	},

	// Receives an instance of a grin object("obj" - e.g. grin_circlelens and grin_refractor) and a bodyMerging object("bodyMerging_obj"),
	// and returns a bodyMerging object for the overlapping region of "obj" and "bodyMerging_obj"
	multRefIndex: function (bodyMerging_obj, obj) {
		if (scene.symbolicGrin) {
			let mul_p = math.simplify('(' + bodyMerging_obj.p + ')*' + '(' + obj.p + ')').toString();

			let mul_fn_p = evaluateLatex(math.parse(mul_p).toTex());

			let mul_fn_p_der_x = evaluateLatex(math.derivative(mul_p, 'x').toTex());

			let mul_fn_p_der_y = evaluateLatex(math.derivative(mul_p, 'y').toTex());

			return { p: mul_p, fn_p: mul_fn_p, fn_p_der_x: mul_fn_p_der_x, fn_p_der_y: mul_fn_p_der_y };
		}
		else {
			let [fn_p, fn_p_der_x, fn_p_der_y, new_fn_p, new_fn_p_der_x, new_fn_p_der_y] = [obj.fn_p, obj.fn_p_der_x, obj.fn_p_der_y, bodyMerging_obj.fn_p, bodyMerging_obj.fn_p_der_x, bodyMerging_obj.fn_p_der_y];

			let mul_fn_p = (function (fn_p, new_fn_p) {
				return function (param) {
					return fn_p(param) * new_fn_p(param);
				};
			})(fn_p, new_fn_p);

			let mul_fn_p_der_x = (function (fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x) {
				return function (param) {
					return fn_p(param) * new_fn_p_der_x(param) + fn_p_der_x(param) * new_fn_p(param); // product chain rule
				};
			})(fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x);

			let mul_fn_p_der_y = (function (fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y) {
				return function (param) {
					return fn_p(param) * new_fn_p_der_y(param) + fn_p_der_y(param) * new_fn_p(param); // product chain rule
				};
			})(fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y);

			return { fn_p: mul_fn_p, fn_p_der_x: mul_fn_p_der_x, fn_p_der_y: mul_fn_p_der_y };
		}
	},

	// Receives an instance of a grin object("obj" - e.g. grin_circlelens and grin_refractor) and a bodyMerging object("bodyMerging_obj"),
	// and returns a bodyMerging object for the region which includes "bodyMerging_obj" and excludes "obj"
	devRefIndex: function (bodyMerging_obj, obj) {
		if (scene.symbolicGrin) {
			let dev_p = math.simplify('(' + bodyMerging_obj.p + ')/' + '(' + obj.p + ')').toString();

			let dev_fn_p = evaluateLatex(math.parse(dev_p).toTex());

			let dev_fn_p_der_x = evaluateLatex(math.derivative(dev_p, 'x').toTex());

			let dev_fn_p_der_y = evaluateLatex(math.derivative(dev_p, 'y').toTex());

			return { p: dev_p, fn_p: dev_fn_p, fn_p_der_x: dev_fn_p_der_x, fn_p_der_y: dev_fn_p_der_y };
		}
		else {
			let [fn_p, fn_p_der_x, fn_p_der_y, new_fn_p, new_fn_p_der_x, new_fn_p_der_y] = [obj.fn_p, obj.fn_p_der_x, obj.fn_p_der_y, bodyMerging_obj.fn_p, bodyMerging_obj.fn_p_der_x, bodyMerging_obj.fn_p_der_y];

			let dev_fn_p = (function (fn_p, new_fn_p) {
				return function (param) {
					return new_fn_p(param) / fn_p(param);
				};
			})(fn_p, new_fn_p);

			let dev_fn_p_der_x = (function (fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x) {
				return function (param) {
					return new_fn_p_der_x(param) / fn_p(param) - new_fn_p(param) * fn_p_der_x(param) / (fn_p(param) ** 2); // product chain rule
				};
			})(fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x);

			let dev_fn_p_der_y = (function (fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y) {
				return function (param) {
					return new_fn_p_der_y(param) / fn_p(param) - new_fn_p(param) * fn_p_der_y(param) / (fn_p(param) ** 2); // product chain rule
				};
			})(fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y);

			return { fn_p: dev_fn_p, fn_p_der_x: dev_fn_p_der_x, fn_p_der_y: dev_fn_p_der_y };
		}
	},

	// Returns true if point is outside the circular glass, otherwise returns false
	isOutsideGlass: function (obj, point) {
		R_squared = geometry.length_squared(obj.p1, obj.p2);
		return (geometry.length_squared(obj.p1, point) - R_squared - obj.eps > 0 && geometry.length_squared(obj.p1, point) - R_squared + obj.eps > 0);
	},

	// Returns true if point is inside the circular glass, otherwise returns false
	isInsideGlass: function (obj, point) {
		R_squared = geometry.length_squared(obj.p1, obj.p2);
		return (geometry.length_squared(obj.p1, point) - R_squared - obj.eps < 0 && geometry.length_squared(obj.p1, point) - R_squared + obj.eps < 0);
	},

	// Returns true if point is on the boundary of the circular glass, otherwise returns false
	isOnBoundary: function (obj, point) {
		R_squared = geometry.length_squared(obj.p1, obj.p2);
		return (geometry.length_squared(obj.p1, point) - R_squared - obj.eps < 0 && geometry.length_squared(obj.p1, point) - R_squared + obj.eps > 0);
	}

};
