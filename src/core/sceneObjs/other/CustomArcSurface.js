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

import BaseCustomSurface from '../BaseCustomSurface.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * A custom surface with shape of a circular arc.
 * 
 * Tools -> Other -> Custom Arc Surface
 * @class
 * @extends BaseCustomSurface
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {Point} p3 - The control point on the arc.
 * @property {Array<OutRay>} outRays - The expressions of the outgoing rays.
 * @property {boolean} twoSided - Whether the surface is two-sided.
 */
class CustomArcSurface extends BaseCustomSurface {
  static type = 'CustomArcSurface';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p3: null,
    outRays: [
      {
        eqnTheta: "\\theta_0",
        eqnP: "0.7\\cdot P_0"
      },
      {
        eqnTheta: "\\pi-\\theta_0",
        eqnP: "P_0-P_1"
      }
    ],
    twoSided: false,
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.CustomArcSurface.title'));
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    // Use theme colors and width
    const theme = this.scene.theme.customSurface;
    const color = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(theme.color);
    const baseWidth = theme.width * ls;

    ctx.fillStyle = 'rgb(255,0,255)';
    if (this.p3 && this.p2) {
      var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
      if (isFinite(center.x) && isFinite(center.y)) {
        var r = geometry.distance(center, this.p3);
        var a1 = Math.atan2(this.p1.y - center.y, this.p1.x - center.x);
        var a2 = Math.atan2(this.p2.y - center.y, this.p2.x - center.x);
        var a3 = Math.atan2(this.p3.y - center.y, this.p3.x - center.x);
        var anticlockwise = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2);
        
        if (this.twoSided) {
          // For two-sided surfaces, draw just one arc with the full width
          ctx.strokeStyle = color;
          ctx.lineWidth = baseWidth;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(center.x, center.y, r, a1, a2, anticlockwise);
          ctx.stroke();
        } else {
          // For one-sided surfaces, draw two arcs each with half the width
          const halfWidth = baseWidth / 2;
          
          // Draw the main solid arc
          ctx.strokeStyle = color;
          ctx.lineWidth = halfWidth;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(center.x, center.y, r, a1, a2, anticlockwise);
          ctx.stroke();

          // Determine which side should be dashed in a rotation-invariant way
          // Calculate the cross product to determine which side p3 is on relative to p2->p1 (exchanged roles)
          var crossProduct = (this.p1.x - this.p2.x) * (this.p3.y - this.p2.y) - (this.p1.y - this.p2.y) * (this.p3.x - this.p2.x);
          
          // Rule: left side is solid, right side is dashed (relative to p1->p2 direction)
          // By using p2->p1 cross product (exchanged roles), we get the correct left=solid, right=dashed behavior
          var drawDashedInner = crossProduct < 0;
          
          // Calculate the offset for the dashed arc
          var radiusOffset = drawDashedInner ? -halfWidth : halfWidth;
          var dashedRadius = r + radiusOffset;
          
          if (dashedRadius > 0) {
            // Draw the dashed arc
            ctx.lineWidth = halfWidth;
            ctx.setLineDash(theme.dash.map(d => d * ls));
            ctx.beginPath();
            ctx.arc(center.x, center.y, dashedRadius, a1, a2, anticlockwise);
            ctx.stroke();
          }
        }
        
        if (isHovered) {
          ctx.fillRect(this.p3.x - 1.5 * ls, this.p3.y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillStyle = 'rgb(255,0,0)';
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
        }
      } else {
        // The three points on the arc is colinear. Treat as a line segment.
        if (this.twoSided) {
          // For two-sided surfaces, draw just one line with the full width
          ctx.strokeStyle = color;
          ctx.lineWidth = baseWidth;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(this.p1.x, this.p1.y);
          ctx.lineTo(this.p2.x, this.p2.y);
          ctx.stroke();
        } else {
          // For one-sided surfaces, draw two lines each with half the width
          const halfWidth = baseWidth / 2;
          
          // Draw the main solid line
          ctx.strokeStyle = color;
          ctx.lineWidth = halfWidth;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(this.p1.x, this.p1.y);
          ctx.lineTo(this.p2.x, this.p2.y);
          ctx.stroke();

          // Calculate the perpendicular vector (normal to the line)
          const dx = this.p2.x - this.p1.x;
          const dy = this.p2.y - this.p1.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          
          if (length > 0) {
            // Normalize the perpendicular vector
            const perpX = -dy / length;
            const perpY = dx / length;
            
            // Shift distance is the half width
            const shiftDistance = halfWidth;
            
            // Calculate shifted points (shift toward the side where rays are ignored)
            // Since getIncidentType returns -1 for "outside to inside", we want to shift
            // toward the "outside" (negative cross product side)
            const shiftedP1x = this.p1.x - perpX * shiftDistance;
            const shiftedP1y = this.p1.y - perpY * shiftDistance;
            const shiftedP2x = this.p2.x - perpX * shiftDistance;
            const shiftedP2y = this.p2.y - perpY * shiftDistance;

            // Draw the dashed line with half width
            ctx.lineWidth = halfWidth;
            ctx.setLineDash(theme.dash.map(d => d * ls));
            ctx.beginPath();
            ctx.moveTo(shiftedP1x, shiftedP1y);
            ctx.lineTo(shiftedP2x, shiftedP2y);
            ctx.stroke();
          }
        }

        if (isHovered) {
          ctx.fillRect(this.p3.x - 1.5 * ls, this.p3.y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillStyle = 'rgb(255,0,0)';
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
        }
      }
    } else if (this.p2) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
    } else {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
    }

    // Reset line dash
    ctx.setLineDash([]);
  }


  move(diffX, diffY) {
    this.p1.x = this.p1.x + diffX;
    this.p1.y = this.p1.y + diffY;
    this.p2.x = this.p2.x + diffX;
    this.p2.y = this.p2.y + diffY;
    this.p3.x = this.p3.x + diffX;
    this.p3.y = this.p3.y + diffY;

    return true;
  }

  rotate(angle, center) {
    // Use p3 as default rotation center if none is provided
    const rotationCenter = center || this.p3;
    
    // Calculate differences from rotation center for all points
    const diff_p1_x = this.p1.x - rotationCenter.x;
    const diff_p1_y = this.p1.y - rotationCenter.y;
    const diff_p2_x = this.p2.x - rotationCenter.x;
    const diff_p2_y = this.p2.y - rotationCenter.y;
    const diff_p3_x = this.p3.x - rotationCenter.x;
    const diff_p3_y = this.p3.y - rotationCenter.y;

    // Apply rotation matrix to p1
    this.p1.x = rotationCenter.x + diff_p1_x * Math.cos(angle) - diff_p1_y * Math.sin(angle);
    this.p1.y = rotationCenter.y + diff_p1_x * Math.sin(angle) + diff_p1_y * Math.cos(angle);

    // Apply rotation matrix to p2
    this.p2.x = rotationCenter.x + diff_p2_x * Math.cos(angle) - diff_p2_y * Math.sin(angle);
    this.p2.y = rotationCenter.y + diff_p2_x * Math.sin(angle) + diff_p2_y * Math.cos(angle);
    
    // Apply rotation matrix to p3
    this.p3.x = rotationCenter.x + diff_p3_x * Math.cos(angle) - diff_p3_y * Math.sin(angle);
    this.p3.y = rotationCenter.y + diff_p3_x * Math.sin(angle) + diff_p3_y * Math.cos(angle);
    
    return true;
  }
  
  scale(scale, center) {
    // Use p3 as default scaling center if none is provided
    const scalingCenter = center || this.p3;
    
    // Calculate differences from scaling center for all points
    const diff_p1_x = this.p1.x - scalingCenter.x;
    const diff_p1_y = this.p1.y - scalingCenter.y;
    const diff_p2_x = this.p2.x - scalingCenter.x;
    const diff_p2_y = this.p2.y - scalingCenter.y;
    const diff_p3_x = this.p3.x - scalingCenter.x;
    const diff_p3_y = this.p3.y - scalingCenter.y;
    
    // Apply scaling to p1
    this.p1.x = scalingCenter.x + diff_p1_x * scale;
    this.p1.y = scalingCenter.y + diff_p1_y * scale;
    
    // Apply scaling to p2
    this.p2.x = scalingCenter.x + diff_p2_x * scale;
    this.p2.y = scalingCenter.y + diff_p2_y * scale;
    
    // Apply scaling to p3
    this.p3.x = scalingCenter.x + diff_p3_x * scale;
    this.p3.y = scalingCenter.y + diff_p3_y * scale;
    
    return true;
  }
  
  getDefaultCenter() {
    return this.p3;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.constructionPoint) {
      // Initialize the construction stage.
      this.constructionPoint = mouse.getPosSnappedToGrid();
      this.p1 = this.constructionPoint;
      this.p2 = null;
      this.p3 = null;
    }

    if (!this.p2 && !this.p3) {
      this.p2 = mouse.getPosSnappedToGrid();
      return;
    }

    if (this.p2 && !this.p3 && !mouse.snapsOnPoint(this.p1)) {
      if (shift) {
        this.p2 = mouse.getPosSnappedToDirection(this.p1, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      } else {
        this.p2 = mouse.getPosSnappedToGrid();
      }
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (!this.p3 && !mouse.snapsOnPoint(this.p1)) {
      if (shift) {
        this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      } else {
        this.p2 = mouse.getPosSnappedToGrid();
      }

      this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;

      return;
    }
    if (this.p3) {
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (this.p2 && !this.p3 && !mouse.snapsOnPoint(this.p1)) {
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
    if (this.p3 && !mouse.snapsOnPoint(this.p2)) {
      this.p3 = mouse.getPosSnappedToGrid();
      delete this.constructionPoint;
      return {
        isDone: true
      };
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(this.p1.x, this.p1.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p2) && geometry.distanceSquared(mouse.pos, this.p2) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p3)) {
      dragContext.part = 3;
      dragContext.targetPoint = geometry.point(this.p3.x, this.p3.y);
      return dragContext;
    }

    var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
    const mousePos = mouse.getPosSnappedToGrid();
    if (isFinite(center.x) && isFinite(center.y)) {
      var r = geometry.distance(center, this.p3);
      var a1 = Math.atan2(this.p1.y - center.y, this.p1.x - center.x);
      var a2 = Math.atan2(this.p2.y - center.y, this.p2.x - center.x);
      var a3 = Math.atan2(this.p3.y - center.y, this.p3.x - center.x);
      var a_m = Math.atan2(mouse.pos.y - center.y, mouse.pos.x - center.x);
      if (Math.abs(geometry.distance(center, mouse.pos) - r) < mouse.getClickExtent() && (((a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2)) == ((a2 < a_m && a_m < a1) || (a1 < a2 && a2 < a_m) || (a_m < a1 && a1 < a2)))) {
        // Dragging the entire obj
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
        dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        dragContext.snapContext = {};
        return dragContext;
      }
    } else {
      // The three points on the arc is colinear. Treat as a line segment.
      if (mouse.isOnSegment(this)) {
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
        dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        dragContext.snapContext = {};
        return dragContext;
      }
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    var basePoint;
    if (dragContext.part == 1) {
      // Dragging the first endpoint
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;

      this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p2 = ctrl ? geometry.point(2 * basePoint.x - this.p1.x, 2 * basePoint.y - this.p1.y) : basePoint;
    }
    if (dragContext.part == 2) {
      // Dragging the second endpoint
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p1;

      this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p1 = ctrl ? geometry.point(2 * basePoint.x - this.p2.x, 2 * basePoint.y - this.p2.y) : basePoint;
    }
    if (dragContext.part == 3) {
      // Dragging the third endpoint
      this.p3 = mouse.getPosSnappedToGrid();
    }
    if (dragContext.part == 0) {
      // Dragging the entire obj
      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
      } else {
        var mousePos = mouse.getPosSnappedToGrid();;
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment
      // Move the first point
      this.p1.x = this.p1.x - mouseDiffX;
      this.p1.y = this.p1.y - mouseDiffY;
      // Move the second point
      this.p2.x = this.p2.x - mouseDiffX;
      this.p2.y = this.p2.y - mouseDiffY;

      this.p3.x = this.p3.x - mouseDiffX;
      this.p3.y = this.p3.y - mouseDiffY;

      // Update the mouse position
      dragContext.mousePos1 = mousePos;
    }
  }

  checkRayIntersects(ray) {
    if (!this.p3) { return null; }
    var incidentData = this.getIncidentData(ray);
    if (!this.twoSided && incidentData.incidentType == -1) {
      return null;
    }
    return incidentData.s_point;
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    var incidentData = this.getIncidentData(ray);
    var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
    
    var incidentPos;
    
    if (isFinite(center.x) && isFinite(center.y)) {
      // Arc case: calculate incidentPos using angle relative to center
      var a1 = Math.atan2(this.p1.y - center.y, this.p1.x - center.x);
      var a2 = Math.atan2(this.p2.y - center.y, this.p2.x - center.x);
      var a_incident = Math.atan2(incidentPoint.y - center.y, incidentPoint.x - center.x);
      
      // Shift angles so p1 is 0
      var a1_shifted = 0;
      var a2_shifted = a2 - a1;
      var a_incident_shifted = a_incident - a1;
      
      // Normalize to 0-2π range
      if (a2_shifted < 0) a2_shifted += 2 * Math.PI;
      if (a_incident_shifted < 0) a_incident_shifted += 2 * Math.PI;
      
      // Calculate incidentPos: simple proportion along the arc
      if (Math.abs(a2_shifted) > 1e-10) {
        incidentPos = -1 + 2 * a_incident_shifted / a2_shifted;
      } else {
        incidentPos = 0; // Degenerate case
      }
    } else {
      // Colinear case: fall back to line segment behavior (same as CustomSurface)
      const dist1 = geometry.distance(incidentPoint, this.p1);
      const dist2 = geometry.distance(incidentPoint, this.p2);
      incidentPos = -1 + 2 * dist1 / (dist1 + dist2);
    }
    
    return this.handleOutRays(ray, rayIndex, incidentPoint, incidentData.normal, incidentPos, surfaceMergingObjs, ray.bodyMergingObj);
  }

  getIncidentData(ray) {
    var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
    
    if (isFinite(center.x) && isFinite(center.y)) {
      // Arc case: check all valid intersections and their incident types
      var rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(center, this.p2));
      var validIntersections = [];
      
      for (var i = 1; i <= 2; i++) {
        var isValid = !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(this.p1, this.p2), geometry.line(this.p3, rp_temp[i])), geometry.line(this.p3, rp_temp[i])) && 
                      geometry.intersectionIsOnRay(rp_temp[i], ray) && 
                      geometry.distanceSquared(rp_temp[i], ray.p1) > Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale;
        
        if (isValid) {
          // Calculate local tangent direction at this intersection point (perpendicular to radius)
          var radialX = rp_temp[i].x - center.x;
          var radialY = rp_temp[i].y - center.y;
          var tangentX = -radialY;  // 90° rotation of radial vector
          var tangentY = radialX;
          
          // Determine arc direction using the same logic as drawing (considering p3 position)
          var a1 = Math.atan2(this.p1.y - center.y, this.p1.x - center.x);
          var a2 = Math.atan2(this.p2.y - center.y, this.p2.x - center.x);
          var a3 = Math.atan2(this.p3.y - center.y, this.p3.x - center.x);
          var anticlockwise = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2);
          
          // If arc goes anticlockwise, flip tangent to match p1->p2 direction
          if (anticlockwise) {
            tangentX = -tangentX;
            tangentY = -tangentY;
          }
          
          // Cross product of ray direction with local tangent
          var rcrosst = (ray.p2.x - ray.p1.x) * tangentY - (ray.p2.y - ray.p1.y) * tangentX;
          
          var incidentType = NaN;
          if (rcrosst > 0) {
            incidentType = 1; // From inside to outside
          } else if (rcrosst < 0) {
            incidentType = -1; // From outside to inside
          }
          
          // Calculate normal vector (radial direction from center)
          var normal = { 
            x: center.x - rp_temp[i].x, 
            y: center.y - rp_temp[i].y 
          };
          
          var rayDirection = { 
            x: ray.p2.x - ray.p1.x, 
            y: ray.p2.y - ray.p1.y 
          };
          var dotProduct = rayDirection.x * normal.x + rayDirection.y * normal.y;
          if (dotProduct > 0) {
            normal.x = -normal.x;
            normal.y = -normal.y;
          }
          
          validIntersections.push({
            point: rp_temp[i],
            distance: geometry.distanceSquared(ray.p1, rp_temp[i]),
            incidentType: incidentType,
            normal: normal
          });
        }
      }
      
      if (validIntersections.length === 0) {
        return { s_point: null, normal: null, incidentType: NaN };
      }
      
      var selectedIntersection;
      
      // For two-sided surfaces, use the nearest intersection
      if (this.twoSided) {
        validIntersections.sort((a, b) => a.distance - b.distance);
        selectedIntersection = validIntersections[0];
      } else {
        // For one-sided surfaces, prefer forward-facing intersections (incidentType = 1)
        var forwardIntersections = validIntersections.filter(intersection => intersection.incidentType === 1);
        if (forwardIntersections.length > 0) {
          // Use the nearest forward-facing intersection
          forwardIntersections.sort((a, b) => a.distance - b.distance);
          selectedIntersection = forwardIntersections[0];
        } else {
          // If no forward-facing intersections, use the nearest intersection
          validIntersections.sort((a, b) => a.distance - b.distance);
          selectedIntersection = validIntersections[0];
        }
      }
      
      return { 
        s_point: selectedIntersection.point, 
        normal: selectedIntersection.normal, 
        incidentType: selectedIntersection.incidentType 
      };
    } else {
      // Colinear case: treat as a line segment
      var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.p1, this.p2));

      if (geometry.intersectionIsOnSegment(rp_temp, this) && geometry.intersectionIsOnRay(rp_temp, ray)) {
        // Calculate incident type using chord direction (same as CustomSurface)
        var rcrosss = (ray.p2.x - ray.p1.x) * (this.p2.y - this.p1.y) - (ray.p2.y - ray.p1.y) * (this.p2.x - this.p1.x);
        var incidentType;
        if (rcrosss > 0) {
          incidentType = 1; // From inside to outside
        } else if (rcrosss < 0) {
          incidentType = -1; // From outside to inside
        } else {
          incidentType = NaN;
        }
        
        // Calculate normal vector for line segment
        const rdots = (ray.p2.x - ray.p1.x) * (this.p2.x - this.p1.x) + (ray.p2.y - ray.p1.y) * (this.p2.y - this.p1.y);
        const ssq = (this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y);
        const normal = { 
          x: rdots * (this.p2.x - this.p1.x) - ssq * (ray.p2.x - ray.p1.x), 
          y: rdots * (this.p2.y - this.p1.y) - ssq * (ray.p2.y - ray.p1.y) 
        };

        return { s_point: rp_temp, normal: normal, incidentType: incidentType };
      } else {
        return { s_point: null, normal: null, incidentType: NaN };
      }
    }
  }


};

export default CustomArcSurface;