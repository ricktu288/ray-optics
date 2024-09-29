import BaseSceneObj from '../BaseSceneObj.js';
import { getMsg } from '../../translations.js';
import geometry from '../../geometry.js';

/**
 * Text label
 * 
 * Tools -> Other -> Text
 * @class
 * @extends BaseSceneObj
 * @memberof rayOptics.sceneObjs
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
    angle: 0
  };

  // generic list of web safe fonts
  static fonts = [
    'Serif',
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Impact',
    'Lucida Sans'
  ];

  static fontStyles = {
    'Normal': getMsg('normal'),
    'Bold': getMsg('bold'),
    'Italic': getMsg('italic'),
    'Bold Italic': getMsg('bolditalic'),
    'Oblique': getMsg('oblique'),
    'Bold Oblique': getMsg('boldoblique')
  };

  static alignments = {
    'left': getMsg('left'),
    'center': getMsg('center'),
    'right': getMsg('right')
  };

  populateObjBar(objBar) {
    objBar.createText('', this.text, function (obj, value) {
      obj.text = value;
    });

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontSize']))) {
      objBar.createNumber(getMsg('fontSize'), 6, 96, 1, this.fontSize, function (obj, value) {
        obj.fontSize = value;
      }, null, true);
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['font']))) {
      objBar.createDropdown(getMsg('font'), this.font, this.constructor.fonts, function (obj, value) {
        obj.font = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontStyle']))) {
      objBar.createDropdown(getMsg('fontStyle'), this.fontStyle, this.constructor.fontStyles, function (obj, value) {
        obj.fontStyle = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['alignment']))) {
      objBar.createDropdown(getMsg('alignment'), this.alignment, this.constructor.alignments, function (obj, value) {
        obj.alignment = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['smallCaps']))) {
      objBar.createBoolean(getMsg('smallCaps'), this.smallCaps, function (obj, value) {
        obj.smallCaps = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['angle']))) {
      objBar.createNumber(getMsg('angle'), 0, 360, 1, this.angle, function (obj, value) {
        obj.angle = value;
      }, null, true);
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    ctx.fillStyle = isHovered ? 'cyan' : ('white');
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
    this.text.split('\n').forEach(line => {
      ctx.fillText(line, 0, y_offset);
      let lineDimensions = ctx.measureText(line);
      this.left = Math.max(this.left, lineDimensions.actualBoundingBoxLeft);
      this.right = Math.max(this.right, lineDimensions.actualBoundingBoxRight);
      this.up = Math.max(this.up, lineDimensions.actualBoundingBoxAscent - y_offset);
      this.down = Math.max(this.down, -lineDimensions.actualBoundingBoxDescent + y_offset);
      if (lineDimensions.fontBoundingBoxAscent) {
        y_offset += lineDimensions.fontBoundingBoxAscent + lineDimensions.fontBoundingBoxDescent;
      } else {
        y_offset += this.fontSize * 1.5;
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
  }
  
  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    this.x = mousePos.x;
    this.y = mousePos.y;
    this.text = getMsg('text_here');
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