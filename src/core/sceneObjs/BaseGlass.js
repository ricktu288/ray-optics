/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import BaseSceneObj from './BaseSceneObj.js';
import i18next from 'i18next';
import geometry from '../geometry.js';

/**
 * The base class for glasses.
 * @class
 * @extends BaseSceneObj
 * @property {number} refIndex - The refractive index of the glass, or the Cauchy coefficient A of the glass if "Simulate Colors" is on.
 * @property {number} cauchyB - The Cauchy coefficient B of the glass if "Simulate Colors" is on, in micrometer squared.
 */
class BaseGlass extends BaseSceneObj {

  populateObjBar(objBar) {
    if (this.scene.simulateColors) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.BaseGlass.cauchyCoeff') + " A", 1, 3, 0.01, this.refIndex, function (obj, value) {
        obj.refIndex = value * 1;
      }, '<p>*' + i18next.t('simulator:sceneObjs.BaseGlass.refIndexInfo.relative') + '</p><p>' + i18next.t('simulator:sceneObjs.BaseGlass.refIndexInfo.effective') + '</p>');
      objBar.createNumber("B(μm²)", 0.0001, 0.02, 0.0001, this.cauchyB, function (obj, value) {
        obj.cauchyB = value;
      });
    } else {
      objBar.createNumber(i18next.t('simulator:sceneObjs.BaseGlass.refIndex') + '*', 0.5, 2.5, 0.01, this.refIndex, function (obj, value) {
        obj.refIndex = value * 1;
      }, '<p>*' + i18next.t('simulator:sceneObjs.BaseGlass.refIndexInfo.relative') + '</p><p>' + i18next.t('simulator:sceneObjs.BaseGlass.refIndexInfo.effective') + '</p>');
    }
  }

  getZIndex() {
    return this.refIndex * (-1); // The material with (relative) refractive index < 1 should be draw after the one with > 1 so that the color subtraction in fillGlass works.
  }

  /* Utility methods */

  /**
   * Fill the glass with the color that represents the refractive index. To be called in `draw` of a subclass when the path has been set up with `canvasRenderer.ctx.beginPath()`, etc.
   * @param {CanvasRenderer} canvasRenderer - The canvas renderer.
   * @param {boolean} isAboveLight - Whether the rendering layer is above the light layer.
   * @param {boolean} isHovered - Whether the object is hovered by the mouse, which determines the style of the object to be drawn, e.g., with lighlighted color.
   */
  fillGlass(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    const n = this.refIndex;

    if (isAboveLight) {
      // Draw the highlight only
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = isHovered ? 'cyan' : ('transparent');
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      return;
    }
    if (n >= 1) {
      ctx.globalCompositeOperation = 'lighter';
      var alpha = Math.log(n) / Math.log(1.5) * 0.2;
      if (!canvasRenderer.isSVG) {
        ctx.fillStyle = "rgb(" + Math.round(alpha * 255) + "," + Math.round(alpha * 255) + "," + Math.round(alpha * 255) + ")";
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "white";
      }
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

    } else {
      var alpha = Math.log(1 / n) / Math.log(1.5) * 0.2;
      if (!canvasRenderer.isSVG) {
        // Subtract the gray color.
        // Use a trick to make the color become red (indicating nonphysical) if the total refractive index is lower than one.

        // A trick to work around a buggy behavior in some browser (at least in Google Chrome 105 on macOS 12.2.1 on iMac 2021) that the color in the lower left corner of the canvas is filled to the glass. Reason unknown.
        // TODO: Find out the reason behind this behavior.
        var imageData = ctx.getImageData(0.0, 0.0, ctx.canvas.width, ctx.canvas.height);
        var data = imageData.data;
        ctx.putImageData(imageData, 0, 0);

        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = "rgb(" + (alpha * 100) + "%," + (0) + "%," + (0) + "%)";
        ctx.fill('evenodd');

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "white";
        ctx.globalAlpha = 1;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.setTransform(canvasRenderer.scale, 0, 0, canvasRenderer.scale, canvasRenderer.origin.x, canvasRenderer.origin.y);

        ctx.globalCompositeOperation = 'lighter';

        ctx.fillStyle = "rgb(" + (0) + "%," + (alpha * 100) + "%," + (alpha * 100) + "%)";
        ctx.fill('evenodd');

        ctx.globalCompositeOperation = 'difference';

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.setTransform(canvasRenderer.scale, 0, 0, canvasRenderer.scale, canvasRenderer.origin.x, canvasRenderer.origin.y);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      } else {
        // canvas2svg does not support globalCompositeOperation. Use the old appearance.
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(70,70,70)');
        ctx.lineWidth = 1 * ls;
        ctx.stroke();
      }
    }
  }

  /**
   * Do the refraction calculation at the surface of the glass.
   * @param {Ray} ray - The ray to be refracted.
   * @param {number} rayIndex - The index of the ray in the ray array.
   * @param {Point} incidentPoint - The incident point.
   * @param {Point} normal - The normal vector at the incident point.
   * @param {number} n1 - The effective refractive index of the current object (after determining the direction of incident of the current object, but before merging the surface with other objects).
   * @param {Array<BaseSceneObj>} surfaceMergingObjs - The objects that are to be merged with the current object.
   * @param {BaseGrinGlass} bodyMergingObj - The object that is to be merged with the current object.
   * @returns {SimulationReturn} The return value for `onRayIncident`.
   */
  refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, bodyMergingObj) {

    // Surface merging
    for (var i = 0; i < surfaceMergingObjs.length; i++) {
      let incidentType = surfaceMergingObjs[i].getIncidentType(ray);
      if (incidentType == 1) {
        // From inside to outside
        n1 *= surfaceMergingObjs[i].getRefIndexAt(incidentPoint, ray);
        surfaceMergingObjs[i].onRayExit(ray);
      } else if (incidentType == -1) {
        // From outside to inside
        n1 /= surfaceMergingObjs[i].getRefIndexAt(incidentPoint, ray);
        surfaceMergingObjs[i].onRayEnter(ray);
      } else if (incidentType == 0) {
        // Equivalent to not intersecting with the obj (e.g. two interfaces overlap)
        //n1=n1;
      } else {
        // Situation that may cause bugs (e.g. incident on an edge point)
        // To prevent shooting the ray to a wrong direction, absorb the ray
        return {
          isAbsorbed: true
        };
      }
    }

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
      ray.p1 = incidentPoint;
      ray.p2 = geometry.point(incidentPoint.x + ray_x + 2 * cos1 * normal_x, incidentPoint.y + ray_y + 2 * cos1 * normal_y);
      if (bodyMergingObj) {
        ray.bodyMergingObj = bodyMergingObj;
      }
    } else {
      // Refraction
      var cos2 = Math.sqrt(sq1);

      var R_s = Math.pow((n1 * cos1 - cos2) / (n1 * cos1 + cos2), 2);
      var R_p = Math.pow((n1 * cos2 - cos1) / (n1 * cos2 + cos1), 2);
      // Reference http://en.wikipedia.org/wiki/Fresnel_equations#Definitions_and_power_equations

      let newRays = [];
      let truncation = 0;

      // Handle the reflected ray
      var ray2 = geometry.line(incidentPoint, geometry.point(incidentPoint.x + ray_x + 2 * cos1 * normal_x, incidentPoint.y + ray_y + 2 * cos1 * normal_y));
      ray2.brightness_s = ray.brightness_s * R_s;
      ray2.brightness_p = ray.brightness_p * R_p;
      ray2.wavelength = ray.wavelength;
      ray2.gap = ray.gap;
      if (bodyMergingObj) {
        ray2.bodyMergingObj = bodyMergingObj;
      }
      if (ray2.brightness_s + ray2.brightness_p > (this.scene.colorMode != 'default' ? 1e-6 : 0.01)) {
        newRays.push(ray2);
      } else {
        truncation += ray2.brightness_s + ray2.brightness_p;
        if (!ray.gap && !this.scene.colorMode != 'default') {
          var amp = Math.floor(0.01 / ray2.brightness_s + ray2.brightness_p) + 1;
          if (rayIndex % amp == 0) {
            ray2.brightness_s = ray2.brightness_s * amp;
            ray2.brightness_p = ray2.brightness_p * amp;
            newRays.push(ray2);
          }
        }
      }

      // Handle the refracted ray
      ray.p1 = incidentPoint;
      ray.p2 = geometry.point(incidentPoint.x + n1 * ray_x + (n1 * cos1 - cos2) * normal_x, incidentPoint.y + n1 * ray_y + (n1 * cos1 - cos2) * normal_y);
      ray.brightness_s = ray.brightness_s * (1 - R_s);
      ray.brightness_p = ray.brightness_p * (1 - R_p);

      if (ray.brightness_s + ray.brightness_p > (this.scene.colorMode != 'default' ? 1e-6 : 0)) {
        return {
          newRays: newRays,
          truncation: truncation
        };
      } else {
        return {
          isAbsorbed: true,
          newRays: newRays,
          truncation: truncation + ray.brightness_s + ray.brightness_p
        };
      }
    }
  }


  /**
   * Get the refractive index at a point for a ray
   * @param {Point} point - The point to get the refractive index. For normal glasses, this parameter is not used. But it will be used in GRIN glasses.
   * @param {Ray} ray - The ray to be refracted.
   * @returns {number} - The refractive index at the point.
   */
  getRefIndexAt(point, ray) {
    if (this.scene.simulateColors) {
      return this.refIndex + this.cauchyB / (ray.wavelength * ray.wavelength * 0.000001);
    } else {
      return this.refIndex;
    }
  }


  /* Abstract methods */

  /**
   * Get whether the ray is incident from inside to outside or from outside to inside.
   * @param {Ray} ray - The ray to be checked.
   * @returns {number} - 1 if the ray is incident from inside to outside, -1 if the ray is incident from outside to inside, 0 if the ray is equivalent to not intersecting the glass (e.g. intersecting with two overlapping surfaces of the glass), and NaN for other situations (e.g. parallel to a surface).
   */
  getIncidentType(ray) {
    // To be implemented in subclasses.
  }

  /**
   * Handle the event when a ray enters the glass. This is called during the surface merging process, and is called by the glass object who is handling the surface merging, rather than by the simulator. Unlike `onRayIncident` which is only called for one representative object who is responsible for handling the surface merging, this function is called for every object that consistute the merged surface.  For notmal glasses nothing needs to be done in this function, but for GRIN glasses, the body-merging object in the ray should be updated here, so that the ray knows that it now feels a different refractive index gradient.
   * @param {Ray} ray - The ray that enters the glass.
   */
  onRayEnter(ray) {
    // Nothing to do for normal glasses.
  }

  /**
   * Handle the event when a ray exits the glass. This is called during the surface merging process, and is called by the glass object who is handling the surface merging, rather than by the simulator. Unlike `onRayIncident` which is only called for one representative object who is responsible for handling the surface merging, this function is called for every object that consistute the merged surface.  For notmal glasses nothing needs to be done in this function, but for GRIN glasses, the body-merging object in the ray should be updated here, so that the ray knows that it now feels a different refractive index gradient.
   * @param {Ray} ray - The ray that exits the glass.
   */
  onRayExit(ray) {
    // Nothing to do for normal glasses.
  }

};

export default BaseGlass;