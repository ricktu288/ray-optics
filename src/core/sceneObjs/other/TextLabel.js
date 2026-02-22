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

import BaseSceneObj from '../BaseSceneObj.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * Text label
 * 
 * Tools -> Other -> Text
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {number} x - The x coordinate.
 * @property {number} y - The y coordinate.
 * @property {string} text - The text content.
 * @property {number} fontSize - The font size.
 * @property {string} font - The font name.
 * @property {string} fontStyle - The font style.
 * @property {string} alignment - The font alignment.
 * @property {boolean} smallCaps - Whether the text is in small caps.
 * @property {number} angle - The angle of the text in degrees.
 */
class TextLabel extends BaseSceneObj {
  static type = 'TextLabel';
  static serializableDefaults = {
    x: null,
    y: null,
    text: '',
    fontSize: 24,
    font: 'Serif',
    fontStyle: 'Normal',
    alignment: 'left',
    smallCaps: false,
    angle: 0,
    fillStyle: null
  };

  static getDescription(objData, scene, detailed = false) {
    const baseTitle = i18next.t('main:tools.TextLabel.title');
    if (!detailed) return baseTitle;
    const text = objData?.text ?? '';
    return text ? i18next.t('main:meta.colon', { name: baseTitle, value: text }) : baseTitle;
  }

  static getPropertySchema(objData, scene) {
    return [
      { key: '', type: 'point', label: i18next.t('simulator:sceneObjs.common.coordOrigin') },
      { key: 'text', type: 'text', label: i18next.t('simulator:sceneObjs.TextLabel.text') },
      { key: 'fontSize', type: 'number', label: i18next.t('simulator:sceneObjs.TextLabel.fontSize') },
      { key: 'font', type: 'text', label: i18next.t('simulator:sceneObjs.TextLabel.font') },
      { key: 'fontStyle', type: 'dropdown', label: i18next.t('simulator:sceneObjs.TextLabel.fontStyle'), options: {
        'Normal': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.normal'),
        'Bold': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.bold'),
        'Italic': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.italic'),
        'Bold Italic': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.boldItalic'),
        'Oblique': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.oblique'),
        'Bold Oblique': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.boldOblique'),
      }},
      { key: 'alignment', type: 'dropdown', label: i18next.t('simulator:sceneObjs.TextLabel.alignment'), options: {
        'left': i18next.t('simulator:sceneObjs.TextLabel.alignments.left'),
        'center': i18next.t('simulator:sceneObjs.TextLabel.alignments.center'),
        'right': i18next.t('simulator:sceneObjs.TextLabel.alignments.right'),
      }},
      { key: 'smallCaps', type: 'boolean', label: i18next.t('simulator:sceneObjs.TextLabel.smallCaps') },
      { key: 'angle', type: 'number', label: i18next.t('simulator:sceneObjs.TextLabel.angle') + ' (\u00B0)' },
      { key: 'fillStyle', type: 'style', styleKind: 'fill', label: i18next.t('simulator:sceneObjs.common.fillStyle') },
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.TextLabel.title'));
    objBar.createText('', this.text, function (obj, value) {
      obj.text = value;
    });

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontSize']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.TextLabel.fontSize'), 6, 96, 1, this.fontSize, function (obj, value) {
        obj.fontSize = value;
      }, null, true);
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['font']))) {
      const fontLines = i18next.t('simulator:sceneObjs.TextLabel.fonts').split('\n');
      const fonts = {};
      for (const line of fontLines) {
        const [key, value] = line.split(': ');
        fonts[key] = value;
      }
      fonts['custom'] = i18next.t('simulator:sceneObjs.TextLabel.enterFontName');

      objBar.createDropdown(i18next.t('simulator:sceneObjs.TextLabel.font'), fonts[this.font] ? this.font : 'custom', fonts, function (obj, value) {
        if (value != 'custom') {
          obj.font = value;
        } else {
          obj.font = "";
        }
      }, i18next.t('simulator:sceneObjs.TextLabel.fontNote'), true);

      // Create a text input for the custom font.
      if (!fonts[this.font]) {
        objBar.createText('', this.font, function (obj, value) {
          obj.font = value;
        });
      }
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontStyle']))) {
      objBar.createDropdown(i18next.t('simulator:sceneObjs.TextLabel.fontStyle'), this.fontStyle, {
        'Normal': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.normal'),
        'Bold': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.bold'),
        'Italic': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.italic'),
        'Bold Italic': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.boldItalic'),
        'Oblique': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.oblique'),
        'Bold Oblique': i18next.t('simulator:sceneObjs.TextLabel.fontStyles.boldOblique')
      }, function (obj, value) {
        obj.fontStyle = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['alignment']))) {
      objBar.createDropdown(i18next.t('simulator:sceneObjs.TextLabel.alignment'), this.alignment, {
        'left': i18next.t('simulator:sceneObjs.TextLabel.alignments.left'),
        'center': i18next.t('simulator:sceneObjs.TextLabel.alignments.center'),
        'right': i18next.t('simulator:sceneObjs.TextLabel.alignments.right')
      }, function (obj, value) {
        obj.alignment = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['smallCaps']))) {
      objBar.createBoolean(i18next.t('simulator:sceneObjs.TextLabel.smallCaps'), this.smallCaps, function (obj, value) {
        obj.smallCaps = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['angle']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.TextLabel.angle') + ' (°)', 0, 360, 1, this.angle, function (obj, value) {
        obj.angle = value;
      }, null, true);
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fillStyle']))) {
      objBar.createFillStyleControl(
        i18next.t('simulator:sceneObjs.common.fillStyle') + '<sup>Beta</sup>',
        this.fillStyle,
        this.scene.theme.decoration,
        function (value) {
          objBar.setOption(function (obj) {
            obj.fillStyle = JSON.parse(JSON.stringify(value));
          });
        },
        function (obj) {
          obj.fillStyle = null;
        }
      );
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    const style = this.fillStyle || this.scene.theme.decoration;
    const fillColor = style.color || this.scene.theme.decoration.color;
    ctx.fillStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(fillColor);
    ctx.textAlign = this.alignment;
    ctx.textBaseline = 'bottom';

    let font = '';
    if (this.fontStyle && this.fontStyle != 'Normal') font += this.fontStyle + ' ';
    if (this.smallCaps) font += 'small-caps '
    font += this.fontSize + 'px ' + this.font;
    ctx.font = font;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(-this.angle / 180 * Math.PI);
    let y_offset = 0;
    this.left = 0;
    this.right = 0;
    this.up = 0;
    this.down = 0;
    this.text.toString().split('\n').forEach(line => {
      ctx.fillText(line, 0, y_offset);
      let lineDimensions = ctx.measureText(line);
      this.left = Math.max(this.left, lineDimensions.actualBoundingBoxLeft);
      this.right = Math.max(this.right, lineDimensions.actualBoundingBoxRight);
      this.up = Math.max(this.up, lineDimensions.actualBoundingBoxAscent - y_offset);
      this.down = Math.max(this.down, -lineDimensions.actualBoundingBoxDescent + y_offset);
      if (lineDimensions.fontBoundingBoxAscent) {
        y_offset += lineDimensions.fontBoundingBoxAscent + lineDimensions.fontBoundingBoxDescent;
      } else {
        y_offset += this.fontSize * 1.15;
      }
    });
    ctx.restore();
    // precompute triganometry for faster calculations in 'clicked' function
    this.sin_angle = Math.sin(this.angle / 180 * Math.PI);
    this.cos_angle = Math.cos(this.angle / 180 * Math.PI);
  }

  move(diffX, diffY) {
    this.x = this.x + diffX;
    this.y = this.y + diffY;
    return true;
  }

  rotate(angle, center = null) {
    // Convert the input angle from radians to degrees
    // Note: In TextLabel, positive angles are clockwise (opposite of mathematical convention)
    const angleDegrees = -angle * 180 / Math.PI;
    
    // Use the text position as default center if none provided
    center = center || { x: this.x, y: this.y };
    
    // If rotating around a point other than the text position,
    // we need to move the text position accordingly
    if (center.x !== this.x || center.y !== this.y) {
      // Calculate the distance and current angle from center to text position
      const dx = this.x - center.x;
      const dy = this.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const currentAngle = Math.atan2(dy, dx);
      
      // Calculate the new position after rotation
      // Note: angle is positive for counterclockwise, so we use the standard convention here
      const newAngle = currentAngle + angle;
      this.x = center.x + distance * Math.cos(newAngle);
      this.y = center.y + distance * Math.sin(newAngle);
    }
    
    // Add the rotation angle to the text's angle property
    this.angle = (this.angle + angleDegrees) % 360;
    if (this.angle < 0) {
      this.angle += 360;
    }
    
    return true;
  }

  scale(scale, center = null) {
    // Use the text position as default center if none provided
    center = center || { x: this.x, y: this.y };
    
    // If scaling around a point other than the text position,
    // we need to move the text position accordingly
    if (center.x !== this.x || center.y !== this.y) {
      // Scale the distance from center to text position
      this.x = center.x + (this.x - center.x) * scale;
      this.y = center.y + (this.y - center.y) * scale;
    }
    
    // Scale the font size
    this.fontSize *= scale;
    
    return true;
  }

  getDefaultCenter() {
    return { x: this.x, y: this.y };
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    this.x = mousePos.x;
    this.y = mousePos.y;
    this.text = i18next.t('simulator:sceneObjs.TextLabel.textHere');
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    return {
      isDone: true
    };
  }

  checkMouseOver(mouse) {
    let dragContext = {};

    // translate and rotate the mouse point into the text's reference frame for easy comparison
    let relativeMouseX = mouse.pos.x - this.x
    let relativeMouseY = mouse.pos.y - this.y
    let rotatedMouseX = relativeMouseX * this.cos_angle - relativeMouseY * this.sin_angle;
    let rotatedMouseY = relativeMouseY * this.cos_angle + relativeMouseX * this.sin_angle;
    if (rotatedMouseX >= -this.left && rotatedMouseX <= this.right &&
      rotatedMouseY <= this.down && rotatedMouseY >= -this.up) {
      dragContext.part = 0;
      dragContext.mousePos0 = geometry.point(mouse.pos.x, mouse.pos.y);
      dragContext.mousePos0Snapped = mouse.getPosSnappedToGrid();
      dragContext.targetPoint_ = geometry.point(this.x, this.y); // Avoid setting 'targetPoint' (otherwise the xybox will appear and move the text to incorrect coordinates).
      dragContext.snapContext = {};
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    } else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
    }

    // 'dragContext.targetPoint_' object placement position (bottom left)
    // 'dragContext.mousePos0' is coordiates of where the drag started, not snapped
    // 'dragContext.mousePos0Snapped' is coordiates of where the drag started, snapped to grid
    // new location  =  current location (snapped)  +  object placement location  -  where drag started (snapped)
    this.x = mousePos.x + dragContext.targetPoint_.x - dragContext.mousePos0Snapped.x;
    this.y = mousePos.y + dragContext.targetPoint_.y - dragContext.mousePos0Snapped.y;
  }
};

export default TextLabel;