/*
 * Copyright 2025 The Ray Optics Simulation authors and contributors
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
import { evaluateLatex } from '../equation.js';
import Simulator from '../Simulator.js';

/**
 * @typedef {Object} OutRay
 * Variables that can be used in the angle and brightness functions:
 * - \(\theta_0\): The angle of the incident ray.
 * - \(\lambda\): The wavelength of the incident ray.
 * - \(t\): The position of the incident ray on the surface.
 * - \(p\): The polarization of the incident ray. 0 for s-polarized, 1 for p-polarized.
 * - \(n_0\): The refractive index of the source medium (glass merged at the same side as the incident ray).
 * - \(n_1\): The refractive index of the destination medium (glass merged at the opposite side as the incident ray).
 * - \(\theta_1\), \(\theta_2\), ..., \(\theta_{j-1}\): The angles of the previous outgoing rays. For \(P_j\), \(\theta_j\) can also be used.
 * - \(P_1\), \(P_2\), ..., \(P_{j-1}\): The brightnesses of the previous outgoing rays.
 * @property {string} eqnTheta - The LaTeX expression of the angle \(\theta_j\) of the jth outgoing ray.
 * @property {string} eqnP - The LaTeX expression of the brightness \(P_j\) of the jth outgoing ray.
 */

/**
 * The base class for custom surfaces (surfaces where the ray interaction is defined by custom equations).
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Array<OutRay>} outRays - The expressions of the outgoing rays.
 */
class BaseCustomSurface extends BaseSceneObj {

  populateObjBar(objBar) {
    const self = this;

    objBar.createInfoBox('<ul><li>' + i18next.t('simulator:sceneObjs.BaseCustomSurface.info.angles', {theta_0: 'θ<sub>0</sub> (<code>theta_0</code>)', theta_j: 'θ<sub>j</sub>'}) + '</li><li>' + i18next.t('simulator:sceneObjs.BaseCustomSurface.info.brightnesses', {P_0: 'P<sub>0</sub> (<code>P_0</code>)', P_j: 'P<sub>j</sub>'}) + '</li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.BaseCustomSurface.info.previousFormulas') + '</li><li>' + i18next.t('simulator:sceneObjs.BaseCustomSurface.info.otherParams', {lambda: '<code>lambda</code>', p: '<code>p</code>'}) + '</li><li>' + i18next.t(`simulator:sceneObjs.${this.constructor.type}.info.incidentPos`, {t: '<code>t</code>'}) + '</li><li>' + i18next.t('simulator:sceneObjs.BaseCustomSurface.info.coating', {n_0: '<code>n_0</code>', n_1: '<code>n_1</code>'}) + '</li><li>' + i18next.t('simulator:sceneObjs.BaseCustomSurface.info.twoSides') + '</li><li>' + i18next.t('simulator:sceneObjs.BaseCustomSurface.info.module') + '</li></ul>' );
    
    // Create individual equations for each ray
    for (let i = 0; i < this.outRays.length; i++) {
      const rayIndex = i + 1; // 1-based indexing for display
      const currentIndex = i; // Capture the current index for closure
      
      // Create angle equation
      objBar.createEquation(`θ<sub>${rayIndex}</sub> =`, this.outRays[i].eqnTheta, function (obj, value) {
        obj.outRays[currentIndex].eqnTheta = value;
        self.initOutRayFns();
      });
      
      // Create brightness equation
      objBar.createEquation(`P<sub>${rayIndex}</sub> =`, this.outRays[i].eqnP, function (obj, value) {
        obj.outRays[currentIndex].eqnP = value;
        self.initOutRayFns();
      });
    }
    
    // Add "+" button to add new ray
    objBar.createButton(i18next.t('simulator:sceneObjs.BaseCustomSurface.addOutgoingRay'), function (obj) {
      obj.outRays.push({ eqnTheta: '\\theta_0', eqnP: 'P_0' });
      self.initOutRayFns();
    }, true, `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2 7.5h5.5V2h1v5.5H14v1H8.5V14h-1V8.5H2v-1z"/>
    </svg>
    `);
    
    // Add "-" button to remove last ray
    objBar.createButton(i18next.t('simulator:sceneObjs.BaseCustomSurface.removeOutgoingRay'), function (obj) {
      if (obj.outRays.length > 0) {
        obj.outRays.pop();
        self.initOutRayFns();
      }
    }, true, `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2 7.5h12v1H2z"/>
    </svg>
    `);

    objBar.createBoolean(i18next.t('simulator:sceneObjs.BaseCustomSurface.twoSided'), this.twoSided, function (obj, value) {
      obj.twoSided = value;
    });
  }

  handleOutRays(ray, rayIndex, incidentPoint, normal, incidentPos, surfaceMergingObjs, bodyMergingObj) {
    if (!this.fns) {
      this.initOutRayFns();
    }

    if (this.fns.length == 0) {
      // If there are no outgoing rays, just absorb the incident ray.
      return {
        isAbsorbed: true,
      };
    }


    // Determine the source and destination glasses (the overlapping glasses with the interior on the two sides of the surfaces, where the side of the incident ray is the source side)
    const sourceGlasses = [];
    const destinationGlasses = [];
    for (const obj of surfaceMergingObjs) {
      let incidentType = obj.getIncidentType(ray);
      if (incidentType == 1) {
        sourceGlasses.push(obj);
      } else if (incidentType == -1) {
        destinationGlasses.push(obj);
      } else {
        // An undefined behavior (e.g. incident on an edge point)
        return {
          isAbsorbed: true,
          isUndefinedBehavior: true,
        };
      }
    }

    // Determine the refractive indices of the source and destination glasses
    let n0 = 1;
    let n1 = 1;
    for (const obj of sourceGlasses) {
      n0 *= obj.getRefIndexAt(incidentPoint, ray);
    }
    for (const obj of destinationGlasses) {
      n1 *= obj.getRefIndexAt(incidentPoint, ray);
    }

    const normalAngle = Math.atan2(normal.y, normal.x);
    const rayAngle = Math.atan2(ray.p2.y - ray.p1.y, ray.p2.x - ray.p1.x);
    let incidentAngle = normalAngle - (rayAngle + Math.PI);

    // Normalize to -pi/2 to pi/2
    incidentAngle = (incidentAngle + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

    const originalBrightness_s = ray.brightness_s;
    const originalBrightness_p = ray.brightness_p;
    const originalWavelength = ray.wavelength;
    const originalBodyMergingObj = bodyMergingObj;
    const originalGap = ray.gap;

    const newRays = [];
    let isAbsorbed = false;
    let truncation = 0;

    const params = [
      {theta0: incidentAngle, P0: originalBrightness_s, lambda: originalWavelength || Simulator.GREEN_WAVELENGTH, t: incidentPos, n0: n0, n1: n1, p: 0},
      {theta0: incidentAngle, P0: originalBrightness_p,  lambda: originalWavelength || Simulator.GREEN_WAVELENGTH, t: incidentPos, n0: n0, n1: n1, p: 1},
    ]

    for (let i = 0; i < this.fns.length; i++) {
      let angles;
      let brightnesses;

      try {
         angles = [
          this.fns[i].angleFn(params[0]),
          this.fns[i].angleFn(params[1]),
        ];
      } catch (e) {
        this.error = `Error evaluating theta_${i+1}: ${e.toString()}`;
        return {
          isAbsorbed: true,
        };
      }

      params[0][`theta${i+1}`] = angles[0];
      params[1][`theta${i+1}`] = angles[1];

      try {
        brightnesses = [
          this.fns[i].brightnessFn(params[0]),
          this.fns[i].brightnessFn(params[1]),
        ];
      } catch (e) {
        this.error = `Error evaluating P_${i+1}: ${e.toString()}`;
        return {
          isAbsorbed: true,
        };
      }

      for (const p of [0, 1]) {
        if (!(brightnesses[p] > 0) || !Number.isFinite(angles[p])) {
          // The ray should be treated as invalid (setting the brightness to 0 will automatically prevent the ray from being added to newRays)
          brightnesses[p] = 0;
        }
      }

      params[0][`P${i+1}`] = brightnesses[0];
      params[1][`P${i+1}`] = brightnesses[1];

      let rayNum;
      if (angles[0] === angles[1]) {
        // Only need one ray (the two polarization components are going to the same direction, so just one ray with brightness_s and brightness_p).
        rayNum = 1;
      } else {
        // Need two rays (the two polarization components split to two different directions).
        rayNum = 2;
      }

      for (let j = 0; j < rayNum; j++) {
        // Initialize the outgoing ray.
        // The first ray should be handled differently, as it will directly replace the incident ray.
        // In case that the ray splits, directly initialized the two rays with only one polarization component.
        let ray1;
        if (i == 0 && j == 0) {
          ray1 = ray;
        } else if (rayNum == 2 && j == 0) {
          ray1 = {
            wavelength: originalWavelength,
            bodyMergingObj: originalBodyMergingObj,
            gap: originalGap,
          }
        } else if (rayNum == 2 && j == 1) {
          ray1 = {
            wavelength: originalWavelength,
            bodyMergingObj: originalBodyMergingObj,
            gap: originalGap,
          }
        } else {
          ray1 = {
            wavelength: originalWavelength,
            bodyMergingObj: originalBodyMergingObj,
            gap: originalGap,
          }
        }

        // Normalize angle to -pi to pi
        angles[j] = ((angles[j] + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

        // If the angle is between -pi/2 and pi/2 (that is, it is going to the destination medium), we need to call onRayExit/Enter to update the bodyMergingObj of the ray.
        if (angles[j] > -Math.PI / 2 && angles[j] < Math.PI / 2) {
          for (const obj of sourceGlasses) {
            obj.onRayExit(ray1);
          }
          for (const obj of destinationGlasses) {
            obj.onRayEnter(ray1);
          }
        }

        // Set the parameters of the outgoing ray.
        const outAngle = (normalAngle + Math.PI) - angles[j];
        if (rayNum == 1) {
          ray1.brightness_s = brightnesses[0];
          ray1.brightness_p = brightnesses[1];
        } else if (j == 0) {
          ray1.brightness_s = brightnesses[0];
          ray1.brightness_p = 0;
        } else {
          ray1.brightness_s = 0;
          ray1.brightness_p = brightnesses[1];
        }
        ray1.p1 = incidentPoint;
        ray1.p2 = geometry.point(incidentPoint.x + Math.cos(outAngle), incidentPoint.y + Math.sin(outAngle));

        // Truncate the outgoing ray if it is too weak.
        if (ray1.brightness_s + ray1.brightness_p > (this.scene.colorMode != 'default' ? 1e-6 : 0.01)) {
          if (ray1 !== ray) {
            newRays.push(ray1);
          }
        } else {
          truncation += ray1.brightness_s + ray1.brightness_p;
          if (ray1 === ray) {
            isAbsorbed = true;
          }
        }
      }
    }

    if (newRays.length > 1) {
      // When there are two or more outgoing rays, image detection will not work, so just disable it.
      for (let i = 0; i < newRays.length; i++) {
        newRays[i].gap = true;
      }
    }

    this.error = null;
    return {
      newRays,
      isAbsorbed,
      truncation,
    };
  }

  /* Utility Methods */

  /**
   * Parse the expressions of the outgoing rays and store them in the `fns` property.
   */
  initOutRayFns() {
    const self = this;

    function replaceVariables(fn) {
      let fn2 = fn.replaceAll("\\theta_0", "(theta0)").replaceAll("P_0", "(P0)").replaceAll("\\lambda", "(lambda)").replaceAll("n_0", "(n0)").replaceAll("n_1", "(n1)");
      
      // Replace \\theta_i and I_i where i is from 1 to the number of outgoing rays
      for (let i = self.outRays.length; i >= 1; i--) {
        // Backward to prevent \\theta_10 from being replaced as (theta1)0
        fn2 = fn2.replaceAll(`\\theta_${i}`, `(theta${i})`).replaceAll(`P_${i}`, `(P${i})`);
      }
      return fn2;
    }

    function buildFn(latex) {
      const eqn = replaceVariables(latex);
      const fn = evaluateLatex(eqn);
      const thetaDeps = [];
      for (let i = 0; i < self.outRays.length; i++) {
        thetaDeps.push(eqn.includes(`(theta${i+1})`));
      }
      return function (params) {
        // Patch evaluatex so that NaN in theta parameters can be propagated to the result rather than causing an error. This is required for example to allow the snell's law to be directly used in the angle function so that when the incident angle is larger than the critical angle, the refracted ray will automatically be dropped.
        for (let i = 0; i < self.outRays.length; i++) {
          if (`theta${i+1}` in params && !Number.isFinite(params[`theta${i+1}`]) && thetaDeps[i]) {
            return NaN;
          }
        }
        return fn(params);
      }
    }

    this.error = null;
    try {
    this.fns = this.outRays.map(outRay => {
      return {
        angleFn: buildFn(outRay.eqnTheta),
        brightnessFn: buildFn(outRay.eqnP)
        };
      });
    } catch (e) {
      this.fns = [];
      this.error = e.toString();
    }
  }
}

export default BaseCustomSurface;