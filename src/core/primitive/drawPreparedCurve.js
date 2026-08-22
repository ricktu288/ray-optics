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
 * Draw a prepared primitive curve for host-side diagnostics or highlighting.
 *
 * @param {Object} renderer
 * @param {Object} geometry
 * @param {number[]|Object} color
 * @param {number} [lineWidth=1]
 */
export function drawPreparedCurve(
  renderer,
  geometry,
  color,
  lineWidth = 1
) {
  const ctx = renderer.ctx;
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = renderer.rgbaToCssColor(color);
  ctx.lineWidth = lineWidth * renderer.lengthScale;
  ctx.beginPath();
  const start = getPreparedCurveEndpoint(geometry, false);
  ctx.moveTo(start.x, start.y);
  appendPreparedCurvePath(ctx, geometry);
  ctx.stroke();
  ctx.restore();
}

/**
 * Fill and outline an ordered set of prepared region-boundary curves.
 *
 * @param {Object} renderer
 * @param {Object[]} geometries
 * @param {number[]|Object} fillColor
 * @param {number[]|Object} outlineColor
 * @param {number} [lineWidth=1]
 */
export function drawPreparedRegion(
  renderer,
  geometries,
  fillColor,
  outlineColor,
  lineWidth = 1
) {
  const ctx = renderer.ctx;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = renderer.rgbaToCssColor(fillColor);
  ctx.strokeStyle = renderer.rgbaToCssColor(outlineColor);
  ctx.lineWidth = lineWidth * renderer.lengthScale;
  ctx.beginPath();

  let previousEnd = null;
  for (const geometry of geometries) {
    const start = getPreparedCurveEndpoint(geometry, false);
    const connectionTolerance = Math.max(
      geometry.positionTolerance,
      geometry.endpointTolerance ?? 0
    );
    if (
      !previousEnd ||
      Math.hypot(
        previousEnd.x - start.x,
        previousEnd.y - start.y
      ) > connectionTolerance
    ) {
      if (previousEnd) ctx.closePath();
      ctx.moveTo(start.x, start.y);
    } else {
      ctx.lineTo(start.x, start.y);
    }
    appendPreparedCurvePath(ctx, geometry);
    if (geometry.kind === 'circle') {
      ctx.closePath();
      previousEnd = null;
    } else {
      previousEnd = getPreparedCurveEndpoint(geometry, true);
    }
  }
  if (previousEnd) ctx.closePath();
  ctx.fill('evenodd');
  ctx.stroke();
  ctx.restore();
}

function appendPreparedCurvePath(ctx, geometry) {
  switch (geometry.kind) {
    case 'lineSegment':
    case 'smoothLineSegment': {
      const length = 1 / geometry.invLength;
      ctx.lineTo(
        geometry.originX + geometry.tangentX * length,
        geometry.originY + geometry.tangentY * length
      );
      break;
    }
    case 'circularArc': {
      const chordLength = 1 / geometry.invChordLength;
      const halfChordX = geometry.tangentX * chordLength * 0.5;
      const halfChordY = geometry.tangentY * chordLength * 0.5;
      const centerOffset =
        chordLength * (1 - geometry.bulge * geometry.bulge) /
        (4 * geometry.bulge);
      const centerX = geometry.originX - geometry.tangentY * centerOffset;
      const centerY = geometry.originY + geometry.tangentX * centerOffset;
      const startX = geometry.originX - halfChordX;
      const startY = geometry.originY - halfChordY;
      const startAngle = Math.atan2(startY - centerY, startX - centerX);
      const sweep = 4 * Math.atan(geometry.bulge);
      ctx.arc(
        centerX,
        centerY,
        chordLength * (1 + geometry.bulge * geometry.bulge) /
          (4 * Math.abs(geometry.bulge)),
        startAngle,
        startAngle + sweep,
        sweep < 0
      );
      break;
    }
    case 'cubicBezier': {
      const scale = 1 / geometry.invScale;
      const worldX = x => geometry.originX + x * scale;
      const worldY = y => geometry.originY + y * scale;
      ctx.bezierCurveTo(
        worldX(geometry.control1X),
        worldY(geometry.control1Y),
        worldX(geometry.control2X),
        worldY(geometry.control2Y),
        worldX(geometry.endX),
        worldY(geometry.endY)
      );
      break;
    }
    case 'circle':
      ctx.arc(
        geometry.centerX,
        geometry.centerY,
        1 / Math.abs(geometry.signedInvRadius),
        0,
        2 * Math.PI
      );
      break;
    default:
      throw new TypeError(
        `Unsupported prepared curve kind: ${JSON.stringify(geometry.kind)}`
      );
  }
}

function getPreparedCurveEndpoint(geometry, end) {
  switch (geometry.kind) {
    case 'lineSegment':
    case 'smoothLineSegment': {
      if (!end) {
        return { x: geometry.originX, y: geometry.originY };
      }
      const length = 1 / geometry.invLength;
      return {
        x: geometry.originX + geometry.tangentX * length,
        y: geometry.originY + geometry.tangentY * length
      };
    }
    case 'circularArc': {
      const direction = end ? 0.5 : -0.5;
      const chordLength = 1 / geometry.invChordLength;
      return {
        x: geometry.originX +
          direction * geometry.tangentX * chordLength,
        y: geometry.originY +
          direction * geometry.tangentY * chordLength
      };
    }
    case 'cubicBezier': {
      const scale = 1 / geometry.invScale;
      return {
        x: geometry.originX +
          (end ? geometry.endX : geometry.startX) * scale,
        y: geometry.originY +
          (end ? geometry.endY : geometry.startY) * scale
      };
    }
    case 'circle': {
      const radius = 1 / Math.abs(geometry.signedInvRadius);
      return {
        x: geometry.centerX + radius,
        y: geometry.centerY
      };
    }
    default:
      throw new TypeError(
        `Unsupported prepared curve kind: ${JSON.stringify(geometry.kind)}`
      );
  }
}
