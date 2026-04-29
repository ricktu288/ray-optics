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

import BaseGlass from './BaseGlass.js';
import geometry from '../geometry.js';
import Simulator from '../Simulator.js';
import i18next from 'i18next';
import { evaluateLatex } from '../equation.js';
import { parseTex } from 'tex-math-parser'
import * as math from 'mathjs';

/**
 * @typedef {Object} BodyMergingObj
 * Every ray has a temporary bodyMerging object ("bodyMergingObj") as a property (this property exists only while the ray is inside a region of one or several overlapping grin objects - e.g. CircleGrinGlass and GrinGlass), which gets updated as the ray enters/exits into/from grin objects, using the "multRefIndex"/"devRefIndex" function, respectively.
 * @property {function} fn_p - The refractive index function for the equivalent region of the simulation.
 * @property {function} fn_p_der_x - The x derivative of `fn_p` for the equivalent region of the simulation.
 * @property {function} fn_p_der_y - The y derivative of `fn_p` for the equivalent region of the simulation.
 */

/**
 * The base class for glasses.
 * @class
 * @extends BaseGlass
 * @property {string} p - The refractive index function (a function of x and y, related to `origin`) of the glass in math.js string.
 * @property {string} refIndexFn - The refractive index function of the glass in LaTeX.
 * @property {string} p_der_x - The x derivative of `p` in math.js string.
 * @property {string} p_der_x_tex - The x derivative of `p` in LaTeX.
 * @property {string} p_der_y - The y derivative of `p` in math.js string.
 * @property {string} p_der_y_tex - The y derivative of `p` in LaTeX.
 * @property {Point} origin - The origin of (x,y) used in the above equationns.
 * @property {function} fn_p - The evaluatex function for `p`, where (x,y) has been shifted to the absolute coordinates.
 * @property {function} fn_p_der_x - The evaluatex function for `p_der_x`, where (x,y) has been shifted to the absolute coordinates.
 * @property {function} fn_p_der_y - The evaluatex function for `p_der_y`, where (x,y) has been shifted to the absolute coordinates.
 * @property {number} stepSize - The step size for the ray trajectory equation.
 * @property {number} intersectTol - The epsilon for the intersection calculations.
 */
class BaseGrinGlass extends BaseGlass {
  static MAX_REF_INDEX_MAP_SAMPLES = 50000;

  static getPropertySchema(objData, scene) {
    const refIndexFnInfo = '<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.mathjs') + '<br><code>+ - * / ^ sqrt sin cos tan sec csc cot sinh cosh tanh log asin acos atan asinh acosh atanh</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.customFunctions') + '</li><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.lambda', { lambda: '<code>lambda</code>' }) + '</li><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.diff') + '</li></ul>';

    const absorptionFnInfo = '<ul><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.absorptionFnInfo.absorption') + '</li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.mathjs') + '<br><code>+ - * / ^ sqrt sin cos tan sec csc cot sinh cosh tanh log exp asin acos atan asinh acosh atanh floor round ceil max min abs sign</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.customFunctions') + '</li></ul>';

    const intersectTolInfo = '<p>' + i18next.t(`simulator:sceneObjs.${objData.type}.epsInfo.units`) + '</p><p>' + i18next.t(`simulator:sceneObjs.${objData.type}.epsInfo.functions`) + '</p>';

    return [
      { key: 'refIndexFn', type: 'equation', label: 'n(x,y)',
        variables: ['x', 'y', 'lambda'], differentiable: true,
        info: refIndexFnInfo },
      { key: 'absorptionFn', type: 'equation', label: 'α(x,y)',
        variables: ['x', 'y', 'lambda'],
        info: absorptionFnInfo },
      { key: 'plotFns', type: 'boolean', label: i18next.t('simulator:sceneObjs.BaseGrinGlass.plotFns') },
      { key: 'stepSize', type: 'number', label: i18next.t('simulator:sceneObjs.BaseGrinGlass.stepSize'),
        info: '<p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.stepSizeInfo') + '</p>' },
      { key: 'intersectTol', type: 'number', label: i18next.t('simulator:sceneObjs.BaseGrinGlass.intersectTol'),
        info: intersectTolInfo },
      { key: 'partialReflect', type: 'boolean', label: i18next.t('simulator:sceneObjs.BaseGlass.partialReflect') },
    ];
  }

  constructor(scene, jsonObj) {
    super(scene, jsonObj);
    this.initFns();
  }

  populateObjBar(objBar) {
    if (!this.fn_p) {
      this.initFns();
    }
    objBar.createEquation('n(x,y) = ', this.refIndexFn, function (obj, value) {
      obj.refIndexFn = value;
      obj.initFns();
    }, '<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log arcsin arccos arctan</code></li><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.lambda', {lambda: '<code>lambda</code>'}) + '</li><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.diff') + '</li><li>' + (this.constructor.type === 'ParamGrinGlass' ? '' : i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.origin') + '</li><li>') + i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.accuracy') + '</li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');

    objBar.createEquation('α(x,y) = ', this.absorptionFn, function (obj, value) {
      obj.absorptionFn = value;
      obj.initFns();
    }, '<ul><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.absorptionFnInfo.absorption') + '</li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');

    if (this.constructor.type !== 'ParamGrinGlass') {
      objBar.createTuple(i18next.t('simulator:sceneObjs.common.coordOrigin'), '(' + this.origin.x + ',' + this.origin.y + ')', function (obj, value) {
        const commaPosition = value.indexOf(',');
        if (commaPosition != -1) {
          const n_origin_x = parseFloat(value.slice(1, commaPosition));
          const n_origin_y = parseFloat(value.slice(commaPosition + 1, -1));
          obj.origin = geometry.point(n_origin_x, n_origin_y);
          obj.initFns();
        }
      });
    }

    objBar.createBoolean(i18next.t('simulator:sceneObjs.BaseGrinGlass.plotFns') + ' <sup style="color: #fffa;">Beta</sup>', this.plotFns, function (obj, value) {
      obj.plotFns = value;
    });

    if (objBar.showAdvanced(!this.arePropertiesDefault(['stepSize']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.BaseGrinGlass.stepSize'), 0.1 * this.scene.lengthScale, 1 * this.scene.lengthScale, 0.1 * this.scene.lengthScale, this.stepSize, function (obj, value) {
        obj.stepSize = parseFloat(value);
      }, '<p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.stepSizeInfo') + '</p>', true);
    }
    if (objBar.showAdvanced(!this.arePropertiesDefault(['intersectTol']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.BaseGrinGlass.intersectTol'), 1e-3, 1e-2, 1e-3, this.intersectTol, function (obj, value) {
        obj.intersectTol = parseFloat(value);
      }, '<p>' + i18next.t(`simulator:sceneObjs.${this.constructor.type}.epsInfo.units`) + '</p><p>' + i18next.t(`simulator:sceneObjs.${this.constructor.type}.epsInfo.functions`) + '</p>', true);
    }

    if (objBar.showAdvanced(this.scene.symbolicBodyMerging)) {
      objBar.createBoolean(i18next.t('simulator:sceneObjs.BaseGrinGlass.symbolicBodyMerging'), this.scene.symbolicBodyMerging, function (obj, value) {
        obj.scene.symbolicBodyMerging = value;
      }, '<p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.symbolicBodyMergingInfo.all') + '</p><p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.symbolicBodyMergingInfo.impl') + '</p><p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.symbolicBodyMergingInfo.implNote') + '</p>');
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['partialReflect']))) {
      objBar.createBoolean(i18next.t('simulator:sceneObjs.BaseGlass.partialReflect'), this.partialReflect, function (obj, value) {
        obj.partialReflect = value;
      });
    }

  }

  getZIndex() {
    return 0;
  }

  fillGlass(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    if (isAboveLight) {
      // Draw the highlight only
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = isHovered ? this.scene.highlightColorCss : ('transparent');
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      return;
    }

    if (this.plotFns && this.fn_p) {
      const cache = this.getGrinMapCache(canvasRenderer);
      if (cache) {
        ctx.drawImage(cache.canvas, cache.bounds.xMin, cache.bounds.yMin, cache.bounds.width, cache.bounds.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        return;
      }
    }

    this.fillGlassSolid(canvasRenderer);
  }

  fillGlassSolid(canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    ctx.fillStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.grinGlass.color);
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
  }

  getGrinMapCache(canvasRenderer) {
    this._grinMapCache = this.buildGrinMapCache(
      this._grinMapCache,
      canvasRenderer,
      {
        glassColorR: this.scene.theme.glass.color.r,
        glassColorG: this.scene.theme.glass.color.g,
        glassColorB: this.scene.theme.glass.color.b,
        glassAbsorptionColorR: this.scene.theme.glassAbsorption.color.r,
        glassAbsorptionColorG: this.scene.theme.glassAbsorption.color.g,
        glassAbsorptionColorB: this.scene.theme.glassAbsorption.color.b,
        absorptionIsZero: this.absorptionIsZero
      },
      (sceneX, sceneY) => {
        const refIndexAppearance = this.getGrinRefIndexAppearance(this.fn_p({ x: sceneX, y: sceneY, z: Simulator.GREEN_WAVELENGTH }));
        const absorptionAppearance = this.absorptionIsZero || !this.fn_alpha
          ? null
          : this.getGrinAbsorptionAppearance(this.fn_alpha({ x: sceneX, y: sceneY, z: Simulator.GREEN_WAVELENGTH }));
        return this.combineGrinAppearances(refIndexAppearance, absorptionAppearance);
      }
    );
    return this._grinMapCache;
  }

  buildGrinMapCache(existingCache, canvasRenderer, cacheData, sampleToAppearance) {
    const bounds = this.getGrinFillBounds();
    if (!bounds) {
      return null;
    }

    const width = Math.max(bounds.xMax - bounds.xMin, 0);
    const height = Math.max(bounds.yMax - bounds.yMin, 0);
    if (!(width > 0) || !(height > 0)) {
      return null;
    }

    const minSampleStep = canvasRenderer.lengthScale;
    const estimatedSampleStep = Math.sqrt((width * height) / BaseGrinGlass.MAX_REF_INDEX_MAP_SAMPLES);
    const sampleStep = Math.max(minSampleStep, estimatedSampleStep);
    const widthSamples = Math.max(1, Math.ceil(width / sampleStep));
    const heightSamples = Math.max(1, Math.ceil(height / sampleStep));
    const cacheKey = JSON.stringify({
      obj: this.serialize(),
      lengthScale: canvasRenderer.lengthScale,
      sampleStep,
      widthSamples,
      heightSamples,
      ...cacheData
    });

    if (existingCache?.key === cacheKey) {
      return existingCache;
    }

    const cacheCanvas = this.createGrinCacheCanvas(widthSamples, heightSamples);
    const cacheCtx = cacheCanvas?.getContext?.('2d');
    if (!cacheCanvas || !cacheCtx) {
      return null;
    }

    const imageData = cacheCtx.createImageData(widthSamples, heightSamples);
    const data = imageData.data;
    const regionMask = this.getGrinRegionMask(cacheCtx, bounds, sampleStep, widthSamples, heightSamples);

    for (let sy = 0; sy < heightSamples; sy++) {
      const sceneY = Math.min(bounds.yMax, bounds.yMin + (sy + 0.5) * sampleStep);
      for (let sx = 0; sx < widthSamples; sx++) {
        const sceneX = Math.min(bounds.xMax, bounds.xMin + (sx + 0.5) * sampleStep);

        const sampleOffset = sy * widthSamples + sx;
        const sampleInsideRegion = regionMask
          ? regionMask[sampleOffset] > 0
          : (this.isInsideGlass({ x: sceneX, y: sceneY }) || this.isOnBoundary({ x: sceneX, y: sceneY }));
        if (!sampleInsideRegion) {
          continue;
        }

        const appearance = sampleToAppearance(sceneX, sceneY);
        if (appearance === null) {
          continue;
        }

        const offset = (sy * widthSamples + sx) * 4;
        data[offset] = appearance.r;
        data[offset + 1] = appearance.g;
        data[offset + 2] = appearance.b;
        data[offset + 3] = appearance.a;
      }
    }

    cacheCtx.putImageData(imageData, 0, 0);
    return {
      key: cacheKey,
      canvas: cacheCanvas,
      bounds: {
        xMin: bounds.xMin,
        yMin: bounds.yMin,
        width,
        height
      }
    };
  }

  createGrinCacheCanvas(width, height) {
    return this.scene.simulator?.createTempCanvas(width, height) || null;
  }

  getGrinRegionMask(cacheCtx, bounds, sampleStep, widthSamples, heightSamples) {
    if (!this.drawGrinRegionPath) {
      return null;
    }

    cacheCtx.save();
    try {
      cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
      cacheCtx.clearRect(0, 0, widthSamples, heightSamples);
      cacheCtx.beginPath();

      cacheCtx.setTransform(
        1 / sampleStep,
        0,
        0,
        1 / sampleStep,
        -bounds.xMin / sampleStep,
        -bounds.yMin / sampleStep
      );
      this.drawGrinRegionPath(cacheCtx);
      cacheCtx.fillStyle = '#fff';
      cacheCtx.fill('evenodd');

      cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
      const mask = cacheCtx.getImageData(0, 0, widthSamples, heightSamples).data;
      const alphaMask = new Uint8Array(widthSamples * heightSamples);
      for (let i = 0; i < alphaMask.length; i++) {
        alphaMask[i] = mask[i * 4 + 3];
      }
      return alphaMask;
    } catch (e) {
      return null;
    } finally {
      cacheCtx.restore();
      cacheCtx.save();
      cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
      cacheCtx.clearRect(0, 0, widthSamples, heightSamples);
      cacheCtx.restore();
    }
  }

  getGrinRefIndexAppearance(refIndex) {
    if (!Number.isFinite(refIndex) || refIndex <= 0) {
      return null;
    }

    const alpha = Math.max(0, Math.min(1, Math.abs(Math.log(refIndex) / Math.log(1.5) * 0.2)));
    if (alpha === 0) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    if (refIndex < 1) {
      return {
        r: 255,
        g: 0,
        b: 0,
        a: Math.round(alpha * this.scene.theme.glass.color.r * 255)
      };
    }

    const glassColor = this.scene.theme.glass.color;
    return {
      r: Math.round(glassColor.r * 255),
      g: Math.round(glassColor.g * 255),
      b: Math.round(glassColor.b * 255),
      a: Math.round(alpha * 255)
    };
  }

  getGrinAbsorptionAppearance(absorptionRate) {
    if (!Number.isFinite(absorptionRate)) {
      return null;
    }

    const strength = Math.max(0, Math.min(1, Math.abs(absorptionRate) * this.scene.lengthScale * 20));
    if (strength === 0) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    if (absorptionRate < 0) {
      return {
        r: 255,
        g: 0,
        b: 0,
        a: Math.round(strength * this.scene.theme.glass.color.r * 255)
      };
    }

    const absorptionColor = this.scene.theme.glassAbsorption.color;
    return {
      r: Math.round(absorptionColor.r * 255),
      g: Math.round(absorptionColor.g * 255),
      b: Math.round(absorptionColor.b * 255),
      a: Math.round(strength * 255)
    };
  }

  combineGrinAppearances(...appearances) {
    const validAppearances = appearances.filter(Boolean);
    if (validAppearances.length === 0) {
      return null;
    }

    let accumulatedAlpha = 0;
    let accumulatedRed = 0;
    let accumulatedGreen = 0;
    let accumulatedBlue = 0;

    for (const appearance of validAppearances) {
      const alpha = Math.max(0, Math.min(1, (appearance.a ?? 0) / 255));
      accumulatedAlpha += alpha;
      accumulatedRed += (appearance.r / 255) * alpha;
      accumulatedGreen += (appearance.g / 255) * alpha;
      accumulatedBlue += (appearance.b / 255) * alpha;
    }

    const finalAlpha = Math.max(0, Math.min(1, accumulatedAlpha));
    if (finalAlpha === 0) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    return {
      r: Math.round(Math.max(0, Math.min(1, accumulatedRed / finalAlpha)) * 255),
      g: Math.round(Math.max(0, Math.min(1, accumulatedGreen / finalAlpha)) * 255),
      b: Math.round(Math.max(0, Math.min(1, accumulatedBlue / finalAlpha)) * 255),
      a: Math.round(finalAlpha * 255)
    };
  }

  getGrinFillBounds() {
    return null;
  }

  getRefIndexAt(point, ray) {
    return this.fn_p({ x: point.x, y: point.y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });
  }

  onRayEnter(ray) {
    if (!ray.bodyMergingObj) {
      ray.bodyMergingObj = this.initRefIndex(ray);
    }
    ray.bodyMergingObj = this.multRefIndex(ray.bodyMergingObj);
  }

  onRayExit(ray) {
    if (!ray.bodyMergingObj) {
      ray.bodyMergingObj = this.initRefIndex(ray);
    }
    ray.bodyMergingObj = this.devRefIndex(ray.bodyMergingObj);
  }


  /* Utility Methods */

  /**
   * Do the partial derivatives of the refractive index function and parse the functions.
   */
  initFns() {
    this.error = null;
    try {
      this.p = parseTex(this.refIndexFn.replaceAll("\\lambda", "z")).toString().replaceAll("\\cdot", "*").replaceAll("\\frac", "/");
      this.p_der_x = math.derivative(this.p, 'x').toString();
      this.p_der_x_tex = math.parse(this.p_der_x).toTex().replaceAll("{+", "{"); // 'evaluateLatex' function can't and can handle expressions of the form '...num^{+exp}...' and '...num^{exp}...', respectively, where num and exp are numbers
      this.p_der_y = math.derivative(this.p, 'y').toString();
      this.p_der_y_tex = math.parse(this.p_der_y).toTex().replaceAll("{+", "{");
      this.fn_p = evaluateLatex(this.shiftOrigin(this.refIndexFn.replaceAll("\\lambda", "z")));
      this.fn_p_der_x = evaluateLatex(this.shiftOrigin(this.p_der_x_tex));
      this.fn_p_der_y = evaluateLatex(this.shiftOrigin(this.p_der_y_tex));

      this.fn_alpha = evaluateLatex(this.shiftOrigin(this.absorptionFn.replaceAll("\\lambda", "z")));
    } catch (e) {
      delete this.fn_p;
      delete this.fn_p_der_x;
      delete this.fn_p_der_y;
      delete this.fn_alpha;
      this.error = e.toString();
    }
  }

  /**
   * Shifts the x and y variables in `equation` from related to `this.origin` to  the absolute coordinates.
   * @param {string} equation
   * @returns {string} 
   */
  shiftOrigin(equation) {
    return equation.replaceAll("x", "(x-" + this.origin.x + ")").replaceAll("y", "(y-" + this.origin.y + ")");
  }
  
  /**
   * Receives a bodyMerging object and returns a new bodyMerging object for the overlapping region of `bodyMergingObj` and the current GRIN glass.
   * @param {BodyMergingObj} bodyMergingObj 
   * @returns {BodyMergingObj}
   */
  multRefIndex(bodyMergingObj) {
    if (this.scene.symbolicBodyMerging) {
      let mul_p = math.simplify('(' + bodyMergingObj.p + ')*' + '(' + this.shiftOrigin(this.p) + ')').toString();

      let mul_fn_p = evaluateLatex(math.parse(mul_p).toTex());

      let mul_fn_p_der_x = evaluateLatex(math.derivative(mul_p, 'x').toTex());

      let mul_fn_p_der_y = evaluateLatex(math.derivative(mul_p, 'y').toTex());

      let sum_alpha = '\\left(' + bodyMergingObj.alpha + '\\right) + \\left(' + this.shiftOrigin(this.absorptionFn.replaceAll("\\lambda", "z")) + '\\right)';

      let sum_fn_alpha = evaluateLatex(sum_alpha);

      return { p: mul_p, fn_p: mul_fn_p, fn_p_der_x: mul_fn_p_der_x, fn_p_der_y: mul_fn_p_der_y, alpha: sum_alpha, fn_alpha: sum_fn_alpha };
    } else {
      let [fn_p, fn_p_der_x, fn_p_der_y, new_fn_p, new_fn_p_der_x, new_fn_p_der_y] = [this.fn_p, this.fn_p_der_x, this.fn_p_der_y, bodyMergingObj.fn_p, bodyMergingObj.fn_p_der_x, bodyMergingObj.fn_p_der_y];

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

      let sum_fn_alpha = (function (fn_alpha, new_fn_alpha) {
        return function (param) {
          return fn_alpha(param) + new_fn_alpha(param);
        };
      })(this.fn_alpha, bodyMergingObj.fn_alpha);

      return { fn_p: mul_fn_p, fn_p_der_x: mul_fn_p_der_x, fn_p_der_y: mul_fn_p_der_y, fn_alpha: sum_fn_alpha };
    }
  }

  /**
   * Receives a bodyMerging object and returns a new bodyMerging object for the region of `bodyMergingObj` excluding current GRIN glass.
   * @param {BodyMergingObj} bodyMergingObj 
   * @returns {BodyMergingObj}
   */
  devRefIndex(bodyMergingObj) {
    if (this.scene.symbolicBodyMerging) {
      let dev_p = math.simplify('(' + bodyMergingObj.p + ')/' + '(' + this.shiftOrigin(this.p) + ')').toString();

      let dev_fn_p = evaluateLatex(math.parse(dev_p).toTex());

      let dev_fn_p_der_x = evaluateLatex(math.derivative(dev_p, 'x').toTex());

      let dev_fn_p_der_y = evaluateLatex(math.derivative(dev_p, 'y').toTex());

      let diff_alpha = '\\left(' + bodyMergingObj.alpha + '\\right) - \\left(' + this.shiftOrigin(this.absorptionFn.replaceAll("\\lambda", "z")) + '\\right)';

      let diff_fn_alpha = evaluateLatex(diff_alpha);

      return { p: dev_p, fn_p: dev_fn_p, fn_p_der_x: dev_fn_p_der_x, fn_p_der_y: dev_fn_p_der_y, alpha: diff_alpha, fn_alpha: diff_fn_alpha };
    } else {
      let [fn_p, fn_p_der_x, fn_p_der_y, new_fn_p, new_fn_p_der_x, new_fn_p_der_y] = [this.fn_p, this.fn_p_der_x, this.fn_p_der_y, bodyMergingObj.fn_p, bodyMergingObj.fn_p_der_x, bodyMergingObj.fn_p_der_y];

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

      let diff_fn_alpha = (function (fn_alpha, new_fn_alpha) {
        return function (param) {
          return new_fn_alpha(param) - fn_alpha(param);
        };
      })(this.fn_alpha, bodyMergingObj.fn_alpha);

      return { fn_p: dev_fn_p, fn_p_der_x: dev_fn_p_der_x, fn_p_der_y: dev_fn_p_der_y, fn_alpha: diff_fn_alpha };
    }
  }

  /**
   * Receives a ray, and returns a bodyMerging object for the point ray.p1
   * @param {Ray} ray 
   * @returns {BodyMergingObj}
   */
  initRefIndex(ray) {
    let obj_tmp;
    for (let obj of this.scene.opticalObjs) {
      if ((obj instanceof BaseGrinGlass) && (obj.isOnBoundary(ray.p1) || obj.isInsideGlass(ray.p1))) {
        if (!obj_tmp) {
          obj_tmp = {};
          obj_tmp.p = obj.shiftOrigin(obj.p);
          obj_tmp.fn_p = obj.fn_p;
          obj_tmp.fn_p_der_x = obj.fn_p_der_x;
          obj_tmp.fn_p_der_y = obj.fn_p_der_y;
          obj_tmp.alpha = obj.shiftOrigin(obj.absorptionFn.replaceAll("\\lambda", "z"));
          obj_tmp.fn_alpha = obj.fn_alpha;
        } else {
          obj_tmp = obj.multRefIndex(obj_tmp);
        }
      }
    }
    if (!obj_tmp) {
      obj_tmp = { p: 1, fn_p: function () { return 1; }, fn_p_der_x: function () { return 0; }, fn_p_der_y: function () { return 0; }, alpha: '0', fn_alpha: function () { return 0; } };
    }
    return obj_tmp;
  }

  /**
   * Receives two points inside this lens, and returns the next point to where the ray, connecting these two points, will travel, based on the ray trajectory equation (equation 11.1 in the cited text below)
   * Using Euler's method to solve the ray trajectory equation (based on sections 11.1 and 11.2, in the following text: https://doi.org/10.1007/BFb0012092)
  x_der_s and x_der_s_prev are the x-coordinate derivatives with respect to the arc-length parameterization, at two different points (similarly for y_der_s and y_der_s_prev)
   * @param {Point} p1
   * @param {Point} p2
   * @param {Ray} ray
   */
  step(p1, p2, ray) {
    const len = geometry.distance(p1, p2);
    const x = p2.x;
    const y = p2.y;
    const x_der_s_prev = (p2.x - p1.x) / len;
    const y_der_s_prev = Math.sign(p2.y - p1.y) * Math.sqrt(1 - x_der_s_prev ** 2);

    const x_der_s = x_der_s_prev + this.stepSize * (ray.bodyMergingObj.fn_p_der_x({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH }) * (1 - x_der_s_prev ** 2) - ray.bodyMergingObj.fn_p_der_y({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH }) * x_der_s_prev * y_der_s_prev) / ray.bodyMergingObj.fn_p({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });
    const y_der_s = y_der_s_prev + this.stepSize * (ray.bodyMergingObj.fn_p_der_y({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH }) * (1 - y_der_s_prev ** 2) - ray.bodyMergingObj.fn_p_der_x({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH }) * x_der_s_prev * y_der_s_prev) / ray.bodyMergingObj.fn_p({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });

    const x_new = x + this.stepSize * x_der_s;
    const y_new = y + this.stepSize * y_der_s;

    // Absorption
    const alpha = ray.bodyMergingObj.fn_alpha({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });
    const absorption = Math.exp(-alpha * this.stepSize);

    ray.brightness_s *= absorption;
    ray.brightness_p *= absorption;

    return geometry.point(x_new, y_new);
  }




  /* Abstract methods */

  /**
   * Returns `true` if `point` is outside the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isOutsideGlass(point) {
    // To be implemented in subclasses.
  }

  /**
   * Returns `true` if `point` is inside the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isInsideGlass(point) {
    // To be implemented in subclasses.
  }

  /**
   * Returns `true` if `point` is on the boundary of the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isOnBoundary(point) {
    // To be implemented in subclasses.
  }

};

export default BaseGrinGlass;