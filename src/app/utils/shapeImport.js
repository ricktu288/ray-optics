/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
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

/**
 * @module shapeImport
 * @description Pure helpers used by the "Import shapes" pipeline to
 * translate parsed vector shapes (see {@link module:svgImport}) into the
 * data the scene objects expect.
 *
 * Constructing scene objects, pushing them onto the scene graph, and
 * refreshing the simulator stay in `app.js`; this module builds the payloads
 * (`prepareImportedPaths`, `buildImportedObjectSpecs`) those steps consume.
 */

import {
  computePathsBBox,
  flattenArcSegments,
  flattenPathToPolyline,
  simplifyPaths,
} from './svgImport.js';

/* -------------------------------------------------------------------------- */
/* Color utilities                                                            */
/* -------------------------------------------------------------------------- */

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

/** Linear RGB mix toward `target`; hue is preserved compared to photographic inversion. */
function mixRgbToward(color, target, t) {
  return {
    r: clamp01(color.r + (target.r - color.r) * t),
    g: clamp01(color.g + (target.g - color.g) * t),
    b: clamp01(color.b + (target.b - color.b) * t),
    a: color.a ?? 1,
  };
}

function luminanceContrast(colorLum, bgLum) {
  return Math.abs(colorLum - bgLum);
}

/**
 * Compute a stable RGB hex key for a color object (alpha is intentionally
 * ignored: the user groups paths by RGB only).
 * @param {({r:number,g:number,b:number,a:(number|undefined)}|null)} color
 * @returns {string | null}
 */
export function colorToKey(color) {
  if (!color) return null;
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Collect the distinct stroke / fill color keys used by a list of parsed
 * paths, keeping an exemplar `{r, g, b, a}` for each so the UI can show a
 * proper swatch and (later) apply reversal if needed. Fill colors are only
 * collected for closed paths, since open paths don't receive a fill in the
 * importer.
 *
 * Entries are sorted by usage count, most-used first. Ties keep their
 * insertion order (i.e. the order in which colors were first seen).
 *
 * @param {Array<{stroke: any, fill: any, closed: boolean}>} paths
 * @returns {{strokes: Array<{key: string, color: {r:number,g:number,b:number,a:number}, count: number}>, fills: Array<{key: string, color: {r:number,g:number,b:number,a:number}, count: number}>}}
 */
export function collectShapeColors(paths) {
  const strokes = new Map();
  const fills = new Map();
  let order = 0;
  for (const path of paths || []) {
    if (path.stroke) {
      const key = colorToKey(path.stroke);
      if (!strokes.has(key)) strokes.set(key, { key, color: { ...path.stroke }, count: 0, _order: order++ });
      strokes.get(key).count++;
    }
    if (path.fill && path.closed) {
      const key = colorToKey(path.fill);
      if (!fills.has(key)) fills.set(key, { key, color: { ...path.fill }, count: 0, _order: order++ });
      fills.get(key).count++;
    }
  }
  const byCountDesc = (a, b) => (b.count - a.count) || (a._order - b._order);
  const strip = ({ _order, ...rest }) => rest;
  return {
    strokes: [...strokes.values()].sort(byCountDesc).map(strip),
    fills: [...fills.values()].sort(byCountDesc).map(strip),
  };
}

/** Relative luminance per ITU-R BT.709 of a normalized RGB color. */
export function relativeLuminance(c) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * If the stroke color's luminance is too close to the background's to stay
 * visible, blend the RGB toward white (dark theme) or toward black (light
 * theme) until luminance separation exceeds the threshold. Unlike
 * `rgb → 1-rgb` inversion, this preserves hue — only lightness moves.
 *
 * @param {({r:number,g:number,b:number,a:(number|undefined)}|null)} color
 * @param {({r:number,g:number,b:number,a:(number|undefined)}|null)} background
 * @param {number} [contrastThreshold=0.2]
 */
export function adjustColorForBackground(color, background, contrastThreshold = 0.2) {
  if (!color || !background) return color;
  const bl = relativeLuminance(background);
  if (luminanceContrast(relativeLuminance(color), bl) >= contrastThreshold) {
    return color;
  }

  const towardWhite = bl < 0.5;
  const target = towardWhite ? { r: 1, g: 1, b: 1 } : { r: 0, g: 0, b: 0 };

  let lo = 0;
  let hi = 1;
  let best = mixRgbToward(color, target, 1);
  for (let i = 0; i < 18; i++) {
    const t = (lo + hi) / 2;
    const mixed = mixRgbToward(color, target, t);
    if (luminanceContrast(relativeLuminance(mixed), bl) >= contrastThreshold) {
      best = mixed;
      hi = t;
    } else {
      lo = t;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/* Geometry utilities                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Apply the affine `{scale, offsetX, offsetY}` chosen in the import modal to
 * a parsed path, returning a new path in scene coordinates.
 *
 * - Line (`L`) and cubic (`C`) segments are simply mapped point-wise.
 * - Elliptical arc (`A`) segments survive exactly: the 2×2 shape matrix
 *   scales with the uniform factor, and the center / endpoint are mapped
 *   with the full affine. No flattening happens here — the caller should
 *   run {@link module:svgImport.flattenArcSegments} afterwards with the
 *   desired scene-space tolerance.
 *
 * @param {ParsedPath} path
 * @param {{scale:number, offsetX:number, offsetY:number}} opts
 */
export function transformPathToScene(path, opts) {
  const map = (pt) => ({ x: opts.offsetX + pt.x * opts.scale, y: opts.offsetY + pt.y * opts.scale });
  const s = opts.scale;
  return {
    ...path,
    start: map(path.start),
    segments: path.segments.map((seg) => {
      if (seg.type === 'L') return { type: 'L', end: map(seg.end) };
      if (seg.type === 'C') return { type: 'C', c1: map(seg.c1), c2: map(seg.c2), end: map(seg.end) };
      return {
        type: 'A',
        center: map(seg.center),
        mat: {
          a: seg.mat.a * s,
          b: seg.mat.b * s,
          c: seg.mat.c * s,
          d: seg.mat.d * s,
        },
        theta0: seg.theta0,
        theta1: seg.theta1,
        end: map(seg.end),
      };
    }),
  };
}

/**
 * Build the `points` array expected by CurveObjMixin from a parsed path
 * whose arcs have already been flattened to `L` / `C` segments.
 *
 * Each entry has the shape `{a1, c1, c2}` where `a1` is the anchor and
 * `c1`/`c2` are the two outgoing control points leading to the next anchor.
 * Open curves append a trailing `{a1}` (no outgoing controls).
 *
 * Straight `L` segments are expressed as cubics with collinear control
 * points so the resulting curve stays exactly a line.
 *
 * For a closed path:
 * - If the last segment already returns to the starting anchor, we drop the
 *   redundant entry (the mixin closes the loop implicitly).
 * - Otherwise we append a straight wrap-around segment.
 *
 * @param {{x:number, y:number}} start
 * @param {Array<{type: ('L'|'C'), c1: *, c2: *, end: *}>} segments
 * @param {boolean} closed
 */
export function buildCurvePoints(start, segments, closed) {
  const points = [];
  let anchor = { x: start.x, y: start.y };
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const end = { x: seg.end.x, y: seg.end.y };
    let c1, c2;
    if (seg.type === 'C') {
      c1 = { x: seg.c1.x, y: seg.c1.y };
      c2 = { x: seg.c2.x, y: seg.c2.y };
    } else {
      c1 = { x: anchor.x + (end.x - anchor.x) / 3, y: anchor.y + (end.y - anchor.y) / 3 };
      c2 = { x: anchor.x + 2 * (end.x - anchor.x) / 3, y: anchor.y + 2 * (end.y - anchor.y) / 3 };
    }
    points.push({ a1: { x: anchor.x, y: anchor.y }, c1, c2 });
    anchor = end;
  }
  if (closed) {
    const first = points[0]?.a1;
    if (first && Math.hypot(anchor.x - first.x, anchor.y - first.y) < 1e-6) {
      return points;
    }
    const c1 = { x: anchor.x + (first.x - anchor.x) / 3, y: anchor.y + (first.y - anchor.y) / 3 };
    const c2 = { x: anchor.x + 2 * (first.x - anchor.x) / 3, y: anchor.y + 2 * (first.y - anchor.y) / 3 };
    points.push({ a1: { x: anchor.x, y: anchor.y }, c1, c2 });
    return points;
  }
  points.push({ a1: { x: anchor.x, y: anchor.y } });
  return points;
}

/* -------------------------------------------------------------------------- */
/* Defaults / bounding boxes                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Given the imported SVG bounding box and the current viewport metrics,
 * derive `{scale, offsetX, offsetY}` that centers the imported geometry in
 * the visible viewport and has it occupy roughly `fillRatio` of the shorter
 * viewport dimension. Mirrors how the observer and the crop box initialize
 * themselves.
 *
 * The caller is responsible for feeding in the current viewport width /
 * height / origin / scale (this keeps the helper fully pure).
 *
 * @param {{minX:number,minY:number,maxX:number,maxY:number} | null} bbox
 * @param {{viewportWidth: number, viewportHeight: number, sceneOriginX: number, sceneOriginY: number, sceneScale: number, fillRatio: (number|undefined)}} viewport
 * @returns {{ scale:number, offsetX:number, offsetY:number, viewportCenter:{x:number,y:number} }}
 */
export function computeImportPlacement(bbox, viewport) {
  const {
    viewportWidth,
    viewportHeight,
    sceneOriginX,
    sceneOriginY,
    sceneScale,
    fillRatio = 0.6,
  } = viewport;
  const viewportCenter = {
    x: (viewportWidth * 0.5 - sceneOriginX) / sceneScale,
    y: (viewportHeight * 0.5 - sceneOriginY) / sceneScale,
  };
  if (!bbox) {
    return { scale: 1, offsetX: viewportCenter.x, offsetY: viewportCenter.y, viewportCenter };
  }
  const w = Math.max(bbox.maxX - bbox.minX, 1e-6);
  const h = Math.max(bbox.maxY - bbox.minY, 1e-6);
  const targetW = (viewportWidth / sceneScale) * fillRatio;
  const targetH = (viewportHeight / sceneScale) * fillRatio;
  const suggestedScale = Math.min(targetW / w, targetH / h);
  const scale = Number.isFinite(suggestedScale) && suggestedScale > 0 ? suggestedScale : 1;
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  return {
    scale,
    offsetX: viewportCenter.x - cx * scale,
    offsetY: viewportCenter.y - cy * scale,
    viewportCenter,
  };
}

/**
 * Vertical gap from the bottom of the imported bbox to the handle anchor (`p1.y`).
 * Uses twice the scene-space “handle radius” implied by the theme — same scaling as
 * {@link Handle#checkMouseOver}: `(handleArrow.size / 24) * 20 * scene.lengthScale`.
 *
 * @param {Object|null} scene
 */
export function importedHandleOffsetBelowBBox(scene) {
  const size = scene?.theme?.handleArrow?.size ?? 24;
  const ls = scene?.lengthScale ?? 1;
  const radiusScene = (size / 24) * 20 * ls;
  return 2 * radiusScene;
}

/* -------------------------------------------------------------------------- */
/* Parsed paths → placement defaults                                          */
/* -------------------------------------------------------------------------- */

/**
 * Scale / offset defaults for the import modal from parsed paths and viewport
 * metrics (same math as before in `app.js`, without reading `window` or scene).
 *
 * @param {Array} paths - Parsed paths (pre-placement SVG space).
 * @param {{viewportWidth: number, viewportHeight: number, sceneOriginX: number, sceneOriginY: number, sceneScale: number, fillRatio: (number|undefined)}} viewport
 * @returns {{ scale: number, offsetX: number, offsetY: number, bbox: Object|null, viewportCenter: {x:number,y:number} }}
 */
export function computeImportShapesDefaults(paths, viewport) {
  const bbox = computePathsBBox(paths);
  const placement = computeImportPlacement(bbox, viewport);
  return { ...placement, bbox };
}

/* -------------------------------------------------------------------------- */
/* Parsed paths → scene-space geometry → object specs                         */
/* -------------------------------------------------------------------------- */

/**
 * Placement, arc flattening, and cubic merge — same order as the live import.
 *
 * @param {Array} paths - Parsed paths from {@link module:svgImport.parseShapesFile}.
 * @param {{ scale:number, offsetX:number, offsetY:number, tolerance:number }} opts
 */
export function prepareImportedPaths(paths, opts) {
  const placed = paths.map((p) => transformPathToScene(p, opts));
  const arcTolerance = opts.tolerance > 0 ? opts.tolerance : 0.1;
  const flattened = flattenArcSegments(placed, arcTolerance);
  return opts.tolerance > 0 ? simplifyPaths(flattened, opts.tolerance) : flattened;
}

/**
 * Turn simplified scene-space paths into constructor payloads for scene objects.
 *
 * @param {Array} simplifiedPaths - Output of {@link prepareImportedPaths}.
 * @param {{tolerance: number, strokeActions: Object<string, {action: string}>, fillActions: Object<string, {action: string, refIndex: (number|undefined), cauchyB: (number|undefined)}>, backgroundColor: ({r:number,g:number,b:number,a:(number|undefined)}|null)}} opts
 * @returns {Array<{ type: string, props: Object }>}
 */
export function buildImportedObjectSpecs(simplifiedPaths, opts) {
  const tolerance = opts.tolerance > 0 ? opts.tolerance : 0.1;
  const strokeActions = opts.strokeActions || {};
  const fillActions = opts.fillActions || {};
  const bg = opts.backgroundColor ?? null;

  const specs = [];
  /** Merged Drawing index by display-color key (for paths without a source ID). */
  /** @type {Map<string, number>} */
  const drawingsByColor = new Map();

  for (const path of simplifiedPaths) {
    if (!path || !path.segments || path.segments.length < 1) continue;

    if (path.stroke) {
      const strokeKey = colorToKey(path.stroke);
      const strokeCfg = strokeActions[strokeKey];
      const strokeAction = strokeCfg ? strokeCfg.action : 'none';

      if (strokeAction === 'CurveMirror' || strokeAction === 'CustomCurveSurface') {
        const pts = buildCurvePoints(path.start, path.segments, !!path.closed);
        if (pts.length >= 2) {
          const props = {
            points: pts,
            isClosed: !!path.closed,
            notDone: false,
          };
          if (path.sourceId) props.name = path.sourceId;
          specs.push({
            type: strokeAction,
            props,
          });
        }
      } else if (strokeAction === 'Drawing') {
        const poly = flattenPathToPolyline(path, Math.max(tolerance, 0.1));
        if (poly.length >= 2) {
          if (path.closed && poly.length > 0) {
            const first = poly[0];
            const last = poly[poly.length - 1];
            if (first.x !== last.x || first.y !== last.y) poly.push({ x: first.x, y: first.y });
          }
          const stroke = [];
          for (const pt of poly) stroke.push(pt.x, pt.y);
          const displayColor = adjustColorForBackground(path.stroke, bg);
          const shouldKeepSeparate = !!path.sourceId;
          let drawingIdx = -1;
          if (!shouldKeepSeparate) {
            const drawingKey = colorToKey(displayColor);
            if (!drawingsByColor.has(drawingKey)) {
              drawingsByColor.set(drawingKey, specs.length);
              specs.push({
                type: 'Drawing',
                props: {
                  strokes: [],
                  isDrawing: false,
                  lineStyle: {
                    color: { r: displayColor.r, g: displayColor.g, b: displayColor.b, a: displayColor.a ?? 1 },
                  },
                },
              });
            }
            drawingIdx = drawingsByColor.get(drawingKey);
          } else {
            const props = {
              strokes: [],
              isDrawing: false,
              lineStyle: {
                color: { r: displayColor.r, g: displayColor.g, b: displayColor.b, a: displayColor.a ?? 1 },
              },
              name: path.sourceId,
            };
            specs.push({ type: 'Drawing', props });
            drawingIdx = specs.length - 1;
          }
          specs[drawingIdx].props.strokes.push(stroke);
        }
      }
    }

    if (path.closed && path.fill) {
      const fillKey = colorToKey(path.fill);
      const fillCfg = fillActions[fillKey];
      const fillAction = fillCfg ? fillCfg.action : 'none';

      if (fillAction === 'CurveGlass') {
        const pts = buildCurvePoints(path.start, path.segments, true);
        if (pts.length >= 2) {
          const props = {
            points: pts,
            notDone: false,
          };
          if (path.sourceId) props.name = path.sourceId;
          if (Number.isFinite(fillCfg.refIndex)) props.refIndex = fillCfg.refIndex;
          if (Number.isFinite(fillCfg.cauchyB)) props.cauchyB = fillCfg.cauchyB;
          specs.push({ type: 'CurveGlass', props });
        }
      } else if (fillAction === 'CurveGrinGlass') {
        const pts = buildCurvePoints(path.start, path.segments, true);
        if (pts.length >= 2) {
          const props = {
            points: pts,
            notDone: false,
          };
          if (path.sourceId) props.name = path.sourceId;
          specs.push({
            type: 'CurveGrinGlass',
            props,
          });
        }
      }
    }
  }

  return specs;
}

/**
 * Bounding box of geometry described by imported specs (mirrors scene-object
 * bbox logic used for handle placement).
 *
 * @param {Array<{ type: string, props: Object }>} specs
 * @returns {({minX:number,minY:number,maxX:number,maxY:number}|null)}
 */
export function boundingBoxFromImportedSpecs(specs) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  const push = (pt) => {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
    any = true;
  };

  for (const spec of specs || []) {
    const props = spec.props;
    if (!props) continue;

    if (props.points && props.points.length) {
      for (const row of props.points) {
        if (row.a1) push(row.a1);
        if (row.c1) push(row.c1);
        if (row.c2) push(row.c2);
      }
    }
    if (props.strokes) {
      for (const stroke of props.strokes) {
        for (let k = 0; k + 1 < stroke.length; k += 2) {
          push({ x: stroke[k], y: stroke[k + 1] });
        }
      }
    }
  }

  return any ? { minX, minY, maxX, maxY } : null;
}
