const scene_update = {
  "rayDensity_light": "rayModeDensity",
  "rayDensity_images": "imageModeDensity",
  "grid": "snapToGrid",
  "lockobjs": "lockObjs",
  "colorMode": "simulateColors",
  "symbolicGrin": "symbolicBodyMerging"
}

const mode_update = {
  "light": "rays",
  "extended_light": "extended"
}

const obj_update = {
  "laser": {
    "type": "SingleRay",
    "p": "brightness"
  },
  "parallel": {
    "type": "Beam",
    "p": "brightness",
    "divergence": "emisAngle"
  },
  "radiant": {
    "type": "PointSource",
    "p": "brightness"
  },
  "led": {
    "type": "AngleSource",
    "p": "emisAngle"
  },
  "mirror": {
    "type": "Mirror",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "arcmirror": {
    "type": "ArcMirror",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "parabolicmirror": {
    "type": "ParabolicMirror",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "curvedmirror": {
    "type": "CustomMirror",
    "p": "eqn",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "idealmirror": {
    "type": "IdealMirror",
    "p": "focalLength",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "beamsplitter": {
    "type": "BeamSplitter",
    "p": "transRatio",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "halfplane": {
    "type": "PlaneGlass",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB"
  },
  "circlelens": {
    "type": "CircleGlass",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB"
  },
  "refractor": {
    "type": "Glass",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB"
  },
  "curvedglass": {
    "type": "CustomGlass",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB"
  },
  "lens": {
    "type": "IdealLens",
    "p": "focalLength"
  },
  "sphericallens": {
    "type": "SphericalLens",
    "p": "refIndex",
    "cauchyCoeff": "cauchyB",
    "definedBy": "defBy"
  },
  "grin_circlelens": {
    "type": "CircleGrinGlass",
    "p_tex": "refIndexFn",
    "step_size": "stepSize",
    "eps": "intersectTol"
  },
  "grin_refractor": {
    "type": "GrinGlass",
    "p_tex": "refIndexFn",
    "step_size": "stepSize",
    "eps": "intersectTol"
  },
  "blackline": {
    "type": "Blocker",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "blackcircle": {
    "type": "CircleBlocker",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "aperture": {
    "type": "Aperture",
    "isDichroic": "filter",
    "isDichroicFilter": "invert"
  },
  "diffractiongrating": {
    "type": "DiffractionGrating",
    "line_density": "lineDensity",
    "slit_ratio": "slitRatio"
  },
  "ruler": {
    "type": "Ruler",
    "p": "scaleInterval"
  },
  "protractor": {
    "type": "Protractor"
  },
  "power": {
    "type": "Detector",
    "irradianceMap": "irradMap"
  },
  "text": {
    "type": "TextLabel",
    "p": "text",
    "fontName": "font",
    "fontAlignment": "alignment",
    "fontSmallCaps": "smallCaps",
    "fontAngle": "angle"
  },
  "line": {
    "type": "LineArrow",
    "arrow1": "arrow",
    "arrow2": "backArrow"
  },
  "drawing": {
    "type": "Drawing",
    "points": "strokes"
  },
  "handle": {
    "type": "Handle"
  },
  "cropbox": {
    "type": "CropBox"
  }
}

/**
 * Update the scene JSON data to the latest version.
 * @param {Object} jsonData 
 * @returns {Object} The updated JSON data.
 */
function versionUpdate(jsonData) {
  if (!jsonData.version) {
    // Chrome App version 1.0 and earlier (2011/11/1--2014/6/29)

    let str1 = JSON.stringify(jsonData).replace(/"point"|"xxa"|"aH"/g, '1').replace(/"circle"|"xxf"/g, '5').replace(/"k"/g, '"objs"').replace(/"L"/g, '"p1"').replace(/"G"/g, '"p2"').replace(/"F"/g, '"p3"').replace(/"bA"/g, '"exist"').replace(/"aa"/g, '"parallel"').replace(/"ba"/g, '"mirror"').replace(/"bv"/g, '"lens"').replace(/"av"/g, '"notDone"').replace(/"bP"/g, '"lightAlpha"').replace(/"ab"|"observed_light"|"observed_images"/g, '"observer"');
    jsonData = JSON.parse(str1);
    if (!jsonData.objs) {
      jsonData = { objs: jsonData };
    }
    if (!jsonData.mode) {
      jsonData.mode = 'light';
    }
    if (!jsonData.rayDensity_light) {
      jsonData.rayDensity_light = 1;
    }
    if (!jsonData.rayDensity_images) {
      jsonData.rayDensity_images = 1;
    }
    if (!jsonData.scale) {
      jsonData.scale = 1;
    }
    jsonData.version = 1;
  }

  if (jsonData.version == 1) {
    // Chrome App versions 1.1 to 1.2 (2014/6/30--2015/3/2)
    jsonData.origin = { x: 0, y: 0 };
    jsonData.version = 2;
  }

  if (jsonData.version == 2) {
    // Chrome App version 2.0 and web app versions 2.x to 4.x (2015/3/3--2024/5/20)

    // Update scene properties
    for (let key in scene_update) {
      if (jsonData[key] !== undefined) {
        jsonData[scene_update[key]] = jsonData[key];
        delete jsonData[key];
      }
    }

    // Update mode
    if (jsonData.mode in mode_update) {
      jsonData.mode = mode_update[jsonData.mode];
    }

    // Update object types and their properties
    jsonData.objs = jsonData.objs.map(objData => {
      if (objData.type in obj_update) {
        for (let key in obj_update[objData.type]) {
          if (key !== "type" && objData[key] !== undefined) {
            objData[obj_update[objData.type][key]] = objData[key];
            delete objData[key];
          }
        }
        objData.type = obj_update[objData.type].type;
      }
      return objData;
    });

    // Update deep properties
    function updateProperties(obj) {
      if (typeof obj === 'object') {
        if (obj.exist !== undefined) {
          delete obj.exist;
        }
        if (typeof obj.type === 'number') {
          delete obj.type;
        }
        if (obj.byHandle !== undefined) {
          delete obj.byHandle;
        }
        if (obj.targetObj_index !== undefined) {
          obj.targetObjIndex = obj.targetObj_index;
          delete obj.targetObj_index;
        }

        for (let key in obj) {
          updateProperties(obj[key]);
        }
      }
    }
    updateProperties(jsonData.objs);


    // Data version number 3 and 4 do not exist since app version 3.x and 4.x do not change the data format. The next app release will be called version 5.0 so the data version number is updated to 5 to match the app version. Starting from this version, the data version number will always match the app version major number.
    jsonData.version = 5;
  }

  return jsonData;
}