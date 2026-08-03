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

import geometry from '../../geometry.js';

export function createCpuRayRenderState() {
  return {
    lastRay: null,
    lastIntersection: null
  };
}

export function beginCpuRayRendering(ctxMain, rendering) {
  if (!ctxMain) return;
  ctxMain.globalAlpha = 1;
  ctxMain.globalCompositeOperation =
    rendering.simulateColors ? 'screen' : 'source-over';
}

/**
 * Render one ray from an immutable ray-buffer entry and its completed hit.
 * Inactive rays and zero-distance hits draw nothing. They are skipped without
 * resetting nearby-ray state so CPU-only power subsampling does not
 * break image and observer pairing.
 */
export function renderCpuRay({
  ray,
  hit,
  renderer,
  ctxMain,
  rendering,
  lengthScale,
  state,
  firstPass = false
}) {
  if (!isRayActive(ray) || !(hit.s > 0)) {
    return false;
  }
  if (!renderer) return false;

  const rayLine = {
    p1: {
      x: ray.originX,
      y: ray.originY
    },
    p2: {
      x: ray.originX + ray.directionX,
      y: ray.originY + ray.directionY
    },
    powerS: ray.powerS,
    powerP: ray.powerP,
    wavelength: ray.wavelength
  };
  const hasFiniteEnd = Number.isFinite(hit.s);
  const endPoint = hasFiniteEnd
    ? {
        x: ray.originX + hit.s * ray.directionX,
        y: ray.originY + hit.s * ray.directionY
      }
    : null;
  const segmentLengthSquared = hasFiniteEnd
    ? geometry.distanceSquared(rayLine.p1, endPoint)
    : Infinity;
  const power = ray.powerS + ray.powerP;
  const appearance = getRayAppearance(
    ray,
    power,
    renderer,
    rendering
  );
  let drew = false;

  if (rendering.mode === 'rays' || rendering.mode === 'extended') {
    if (hasFiniteEnd) {
      renderer.drawSegment(
        geometry.line(rayLine.p1, endPoint),
        appearance.rayColor,
        rendering.showRayArrows,
        appearance.rayDash
      );
    } else {
      renderer.drawRay(
        rayLine,
        appearance.rayColor,
        rendering.showRayArrows,
        appearance.rayDash
      );
    }
    drew = true;

    if (rendering.mode === 'extended' && !firstPass) {
      const backwardRay = geometry.line(
        rayLine.p1,
        geometry.point(
          rayLine.p1.x - ray.directionX,
          rayLine.p1.y - ray.directionY
        )
      );
      renderer.drawRay(
        backwardRay,
        appearance.extendedRayColor,
        undefined,
        appearance.extendedRayDash
      );
      if (hasFiniteEnd) {
        renderer.drawRay(
          geometry.line(
            endPoint,
            geometry.point(
              endPoint.x + ray.directionX,
              endPoint.y + ray.directionY
            )
          ),
          appearance.forwardExtendedRayColor,
          undefined,
          appearance.forwardExtendedRayDash
        );
      }
    }
  }

  let observedPoint = null;
  let observed = false;
  if (rendering.mode === 'observer' && rendering.observer) {
    observedPoint =
      geometry.lineCircleIntersections(rayLine, rendering.observer)[2];
    if (observedPoint) {
      observed = hasFiniteEnd
        ? geometry.intersectionIsOnSegment(
            observedPoint,
            geometry.line(rayLine.p1, endPoint)
          )
        : geometry.intersectionIsOnRay(observedPoint, rayLine);
    }
  }

  if (
    rendering.mode === 'observer' &&
    state.lastRay &&
    rendering.observer
  ) {
    const intersection =
      geometry.linesIntersection(rayLine, state.lastRay);
    if (observed) {
      drew = renderObservedRay({
        ray,
        rayLine,
        endPoint,
        segmentLengthSquared,
        observedPoint,
        intersection,
        renderer,
        ctxMain,
        rendering,
        lengthScale,
        state
      }) || drew;
    }
    state.lastIntersection = intersection;
  }

  if (rendering.mode === 'images' && state.lastRay) {
    const intersection =
      geometry.linesIntersection(rayLine, state.lastRay);
    if (
      state.lastIntersection &&
      geometry.distanceSquared(
        state.lastIntersection,
        intersection
      ) < 25 * lengthScale * lengthScale
    ) {
      drawImagePoint({
        ray,
        rayLine,
        endPoint,
        segmentLengthSquared,
        intersection,
        renderer,
        ctxMain,
        rendering,
        previousRay: state.lastRay,
        includeVirtualObject: true
      });
      drew = true;
    }
    state.lastIntersection = intersection;
  }

  state.lastRay = rayLine;
  return drew;
}

export function finishCpuRayRendering({
  renderer,
  ctxMain,
  rendering,
  colorMode
}) {
  if (!renderer) return;
  if (rendering.simulateColors && !renderer.isSVG) {
    renderer.applyColorTransformation();
  }
  if (colorMode !== 'default') renderer.flush();
  if (ctxMain) ctxMain.globalAlpha = 1;
}

function renderObservedRay({
  ray,
  rayLine,
  endPoint,
  segmentLengthSquared,
  observedPoint,
  intersection,
  renderer,
  ctxMain,
  rendering,
  lengthScale,
  state
}) {
  const intersectionsAreNear =
    state.lastIntersection &&
    geometry.distanceSquared(
      state.lastIntersection,
      intersection
    ) < 25 * lengthScale * lengthScale;
  if (!intersectionsAreNear) {
    if (state.lastIntersection) {
      drawObservedExtension(
        ray,
        observedPoint,
        rayLine.p1,
        renderer,
        rendering
      );
      return true;
    }
    return false;
  }

  const pointsTowardImage = geometry.intersectionIsOnRay(
    intersection,
    geometry.line(observedPoint, rayLine.p1)
  );
  const observerIsAwayFromOrigin =
    geometry.distanceSquared(observedPoint, rayLine.p1) >
    1e-5 * lengthScale * lengthScale;
  if (!pointsTowardImage || !observerIsAwayFromOrigin) {
    drawObservedExtension(
      ray,
      observedPoint,
      rayLine.p1,
      renderer,
      rendering
    );
    return true;
  }

  drawImagePoint({
    ray,
    rayLine,
    endPoint,
    segmentLengthSquared,
    intersection,
    renderer,
    ctxMain,
    rendering,
    previousRay: state.lastRay,
    includeVirtualObject: false
  });
  const appearance = getNearbyRayAppearance(
    ray,
    state.lastRay,
    renderer,
    ctxMain,
    rendering
  );
  renderer.drawSegment(
    geometry.line(observedPoint, intersection),
    rendering.simulateColors
      ? appearance.color
      : rendering.getThemeRayColor(
          'observedRay',
          appearance.alpha
        ),
    undefined,
    rendering.getThemeRayDash(
      rendering.simulateColors ? 'colorObservedRay' : 'observedRay'
    )
  );
  return true;
}

function drawObservedExtension(
  ray,
  observedPoint,
  origin,
  renderer,
  rendering
) {
  const power = ray.powerS + ray.powerP;
  const color = rendering.simulateColors
    ? rendering.wavelengthToColor(
        ray.wavelength,
        power,
        shouldTransformColor(renderer, rendering)
      )
    : rendering.getThemeRayColor('observedRay', power);
  renderer.drawRay(
    geometry.line(observedPoint, origin),
    color,
    undefined,
    rendering.getThemeRayDash(
      rendering.simulateColors ? 'colorObservedRay' : 'observedRay'
    )
  );
}

function drawImagePoint({
  ray,
  rayLine,
  endPoint,
  segmentLengthSquared,
  intersection,
  renderer,
  ctxMain,
  rendering,
  previousRay,
  includeVirtualObject
}) {
  const appearance = getNearbyRayAppearance(
    ray,
    previousRay,
    renderer,
    ctxMain,
    rendering
  );
  const endVector = endPoint
    ? {
        x: endPoint.x - rayLine.p1.x,
        y: endPoint.y - rayLine.p1.y
      }
    : {
        x: ray.directionX,
        y: ray.directionY
      };
  const imageVector = {
    x: intersection.x - rayLine.p1.x,
    y: intersection.y - rayLine.p1.y
  };
  const rayPositionDot =
    imageVector.x * endVector.x + imageVector.y * endVector.y;

  let imageType;
  if (rayPositionDot < 0) {
    imageType = 'virtualImage';
  } else if (rayPositionDot < segmentLengthSquared) {
    imageType = 'realImage';
  } else if (includeVirtualObject) {
    imageType = 'virtualObject';
  } else {
    return;
  }
  const themedType = rendering.simulateColors
    ? `color${imageType[0].toUpperCase()}${imageType.slice(1)}`
    : imageType;
  renderer.drawPoint(
    intersection,
    rendering.simulateColors
      ? appearance.color
      : rendering.getThemeImageColor(
          imageType,
          appearance.alpha
        ),
    rendering.getThemeImageSize(themedType)
  );
}

function getNearbyRayAppearance(
  ray,
  previousRay,
  renderer,
  ctxMain,
  rendering
) {
  if (rendering.simulateColors) {
    return {
      color: rendering.wavelengthToColor(
        ray.wavelength,
        0.5 * (ray.powerS + ray.powerP),
        shouldTransformColor(renderer, rendering)
      )
    };
  }
  const nearbyAlpha = 0.5 * (
    ray.powerS +
    ray.powerP +
    previousRay.powerS +
    previousRay.powerP
  );
  const usesLegacyCanvas = rendering.colorMode === 'default';
  if (ctxMain && usesLegacyCanvas) {
    ctxMain.globalAlpha = nearbyAlpha;
  }
  return {
    alpha: usesLegacyCanvas ? 1 : nearbyAlpha
  };
}

function getRayAppearance(ray, power, renderer, rendering) {
  if (rendering.simulateColors) {
    const color = rendering.wavelengthToColor(
      ray.wavelength,
      power,
      shouldTransformColor(renderer, rendering)
    );
    return {
      rayColor: color,
      rayDash: rendering.getThemeRayDash('colorRay'),
      extendedRayColor: color,
      extendedRayDash:
        rendering.getThemeRayDash('colorExtendedRay'),
      forwardExtendedRayColor: color,
      forwardExtendedRayDash:
        rendering.getThemeRayDash('colorForwardExtendedRay')
    };
  }
  return {
    rayColor: rendering.getThemeRayColor('ray', power),
    rayDash: rendering.getThemeRayDash('ray'),
    extendedRayColor:
      rendering.getThemeRayColor('extendedRay', power),
    extendedRayDash:
      rendering.getThemeRayDash('extendedRay'),
    forwardExtendedRayColor:
      rendering.getThemeRayColor('forwardExtendedRay', power),
    forwardExtendedRayDash:
      rendering.getThemeRayDash('forwardExtendedRay')
  };
}

function shouldTransformColor(renderer, rendering) {
  return !renderer.isSVG && rendering.colorMode === 'default';
}

function isRayActive(ray) {
  return ray.powerS !== 0 || ray.powerP !== 0;
}
