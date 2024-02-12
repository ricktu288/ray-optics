var waitingRays = []; // The rays waiting for shooting
var waitingRayCount = 0; // Number of rays waiting for shooting
var colorMode = false;
var symbolicGrin = false; // Body merging functionality (used in GRIN objects such as 'grin_circlelens' and 'grin_refractor') uses symbolic math
var timerID = -1;
var isDrawing = false;
var isExporting = false;
var exportRayCountLimit = 100000;
var hasExceededTime = false;
var forceStop = false;
var lastDrawTime = -1;
var drawBeginTime = -1;
var stateOutdated = false; // The state has changed since last draw
var minShotLength = 1e-6; // The minimal length between two interactions with rays (when smaller than this, the interaction will be ignored)
var minShotLength_squared = minShotLength * minShotLength;
var totalTruncation = 0;
var canvasPainter;

const UV_WAVELENGTH = 380;
const VIOLET_WAVELENGTH = 420;
const BLUE_WAVELENGTH = 460;
const CYAN_WAVELENGTH = 500;
const GREEN_WAVELENGTH = 540;
const YELLOW_WAVELENGTH = 580;
const RED_WAVELENGTH = 620;
const INFRARED_WAVELENGTH = 700;

// Draw the scene
function draw(skipLight, skipGrid)
{
  stateOutdated = true;
  
  if (!skipLight) {
    totalTruncation = 0;
    drawBeginTime = new Date();
    document.getElementById('forceStop').style.display = 'none';
  }

  if (!skipLight && timerID != -1)
  {
    // If still handling the last draw, then stop
    clearTimeout(timerID);
    timerID = -1;
  }

  draw_(skipLight, skipGrid);
  
}


function draw_(skipLight, skipGrid) {
  if (!stateOutdated)
  {
    isDrawing = false;
    return;
  }
  stateOutdated = false;

  JSONOutput();

  if (ctx0.constructor != C2S) {
    var canvasPainter0 = new CanvasPainter(ctx0, {x: origin.x*dpr, y: origin.y*dpr}, (scale*dpr), backgroundImage);
    var canvasPainter1 = new CanvasPainter(ctx, {x: origin.x*dpr, y: origin.y*dpr}, (scale*dpr));
    
    canvasPainter0.cls();
    canvasPainter1.cls();
  }

  if (!skipLight) {
    delete canvasPainter;
    canvasPainter = new CanvasPainter(ctxLight, {x: origin.x*dpr, y: origin.y*dpr}, (scale*dpr));
    canvasPainter.cls();

    if (ctx0.constructor == C2S) {
      ctx.translate(origin.x / (scale*dpr), origin.y / (scale*dpr));
    }

    ctx.globalAlpha = 1;
    hasExceededTime = false;
    waitingRays = [];
    shotRayCount = 0;
  }

  if (!skipGrid && ctx0.constructor != C2S)
  {

    var canvasPainterGrid = new CanvasPainter(ctxGrid, {x: origin.x*dpr, y: origin.y*dpr}, (scale*dpr));
    canvasPainterGrid.cls();

    if (scene.showGridRefactored) {
      // Draw the grid

      ctxGrid.save();
      ctxGrid.setTransform((scale*dpr), 0, 0, (scale*dpr), 0, 0);
      var dashstep = 4;

      ctxGrid.strokeStyle = 'rgb(255,255,255,0.25)';

      var dashPattern;
      if (dashstep * scale <= 2) {
        // The dash pattern is too dense, so we just draw a solid line
        dashPattern = [];
      } else {
        // Set up the dash pattern: [dash length, space length]
        var dashPattern = [dashstep * 0.5, dashstep * 0.5];
      }

      // Apply the dash pattern to the context
      ctxGrid.setLineDash(dashPattern);

      // Draw vertical dashed lines
      ctxGrid.beginPath();
      for (var x = origin.x / scale % scene.gridSizeRefactored; x <= ctxGrid.canvas.width / (scale * dpr); x += scene.gridSizeRefactored) {
        ctxGrid.moveTo(x, origin.y / scale % scene.gridSizeRefactored - scene.gridSizeRefactored);
        ctxGrid.lineTo(x, ctxGrid.canvas.height / (scale * dpr));
      }
      ctxGrid.stroke();

      // Draw horizontal dashed lines
      ctxGrid.beginPath();
      for (var y = origin.y / scale % scene.gridSizeRefactored; y <= ctxGrid.canvas.height / (scale * dpr); y += scene.gridSizeRefactored) {
        ctxGrid.moveTo(origin.x / scale % scene.gridSizeRefactored - scene.gridSizeRefactored, y);
        ctxGrid.lineTo(ctxGrid.canvas.width / (scale * dpr), y);
      }
      ctxGrid.stroke();
      ctxGrid.setLineDash([]);
      ctxGrid.restore();
    }
  }
  

  if (!(ctx0.constructor == C2S && skipLight)) {
    // Sort the objects with z-index.
    var mapped = scene.objsRefactored.map(function(obj, i) {
      if (objTypes[obj.type].zIndex) {
        return {index: i, value: objTypes[obj.type].zIndex(obj)};
      } else {
        return {index: i, value: 0};
      }
    });
    mapped.sort(function(a, b) {
      return a.value - b.value;
    });
    // Draw the objects
    for (var j = 0; j < scene.objsRefactored.length; j++)
    {
      var i = mapped[j].index;
      objTypes[scene.objsRefactored[i].type].draw(scene.objsRefactored[i], ctx0, false);
      if (!skipLight && objTypes[scene.objsRefactored[i].type].shoot)
      {
        objTypes[scene.objsRefactored[i].type].shoot(scene.objsRefactored[i]); // If scene.objsRefactored[i] can shoot rays, shoot them.
      }
    }
  }

  if (!skipLight) {
    leftRayCount = 0;
    last_s_obj_index = -1;
    last_ray = null;
    last_intersection = null;
    waitingRaysIndex = -1;
    firstBreak = true;
    shootWaitingRays();
  }

  if (skipLight) {
    // Draw the "above light" layer of scene.objsRefactored. Note that we only draw this when skipLight is true because otherwise shootWaitingRays() will be called and the "above light" layer will still be drawn, since draw() is called again in shootWaitingRays() with skipLight set to true.

    for (var i = 0; i < scene.objsRefactored.length; i++)
    {
      objTypes[scene.objsRefactored[i].type].draw(scene.objsRefactored[i], ctx, true); // Draw scene.objsRefactored[i]
    }
    if (scene.modeRefactored == 'observer')
    {
      // Draw the observer
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.fillStyle = 'blue';
      ctx.arc(observer.c.x, observer.c.y, observer.r, 0, Math.PI * 2, false);
      ctx.fill();
    }
  }

  lastDrawTime = new Date();
}

function addRay(ray) {
  waitingRays[waitingRays.length] = ray;
}

function getRayDensity()
{
  if (scene.modeRefactored == 'images' || scene.modeRefactored == 'observer')
  {
    return scene.rayDensity_imagesRefactored;
  }
  else
  {
    return scene.rayDensity_lightRefactored;
  }
}

function setRayDensity(value)
{
  if (scene.modeRefactored == 'images' || scene.modeRefactored == 'observer')
  {
    scene.rayDensity_imagesRefactored = value;
  }
  else
  {
    scene.rayDensity_lightRefactored = value;
  }
}


var last_ray;
var last_intersection;
var last_s_obj_index;
var waitingRaysIndex;
var leftRayCount;
var firstBreak;

function shootWaitingRays() {
  timerID = -1;
  var st_time = new Date();
  var alpha0 = 1;
  ctxLight.globalAlpha = alpha0;
  var observed;
  var s_obj;
  var s_obj_index;
  var s_point;
  var s_point_temp;
  var s_lensq;
  var s_lensq_temp;
  var observed_point;
  var observed_intersection;
  var rpd;
  var surfaceMerging_objs = [];

  
  if (colorMode) {
    ctxLight.globalCompositeOperation = 'screen';
  }

  while (true) {
    if (new Date() - st_time > 50 && !isExporting)
    {
      // If already run for 200ms
      // Pause for 10ms and continue (prevent not responding)
      hasExceededTime = true;
      timerID = setTimeout(shootWaitingRays, firstBreak ? 100:1);
      firstBreak = false;
      document.getElementById('forceStop').style.display = '';
      document.getElementById('status').innerHTML = getMsg("ray_count") + shotRayCount + '<br>' + getMsg("total_truncation") + totalTruncation.toFixed(3) + '<br>' + getMsg("time_elapsed") + (new Date() - drawBeginTime) + '<br>';

      draw(true, true); // Redraw the scene.objsRefactored to avoid outdated information (e.g. detector readings).
      return;
    }
    if (isExporting && shotRayCount > exportRayCountLimit)
    {
      isDrawing = false;
      return;
    }
    if (forceStop) break;
    if (waitingRaysIndex >= waitingRays.length) {
      if (leftRayCount == 0) {
        break;
      }
      leftRayCount = 0;
      last_s_obj_index = -1;
      last_ray = null;
      last_intersection = null;
      waitingRaysIndex = -1;
      continue;
    }
    waitingRaysIndex++;





    var j = waitingRaysIndex;
    if (waitingRays[j] && waitingRays[j].exist)
    {
      // Start handling waitingRays[j]
      // Test which object will this ray shoot on first

      // Search every object intersected with the ray, and find which intersection is the nearest
      s_obj = null; // The current nearest object in search
      s_obj_index = -1;
      s_point = null;  // The intersection
      surfaceMerging_objs = []; // The objects whose surface is to be merged with s_obj
      s_lensq = Infinity;
      observed = false; // Whether waitingRays[j] is observed by the observer
      for (var i = 0; i < scene.objsRefactored.length; i++)
      {
        // if scene.objsRefactored[i] can affect the ray
        if (objTypes[scene.objsRefactored[i].type].rayIntersection) {
          // Test whether scene.objsRefactored[i] intersects with the ray
          s_point_temp = objTypes[scene.objsRefactored[i].type].rayIntersection(scene.objsRefactored[i], waitingRays[j]);
          if (s_point_temp)
          {
            // Here scene.objsRefactored[i] intersects with the ray at s_point_temp
            s_lensq_temp = graphs.length_squared(waitingRays[j].p1, s_point_temp);
            if (s_point && graphs.length_squared(s_point_temp, s_point) < minShotLength_squared && (objTypes[scene.objsRefactored[i].type].supportSurfaceMerging || objTypes[s_obj.type].supportSurfaceMerging))
            {
              // The ray is shot on two objects at the same time, and at least one of them supports surface merging

              if (objTypes[s_obj.type].supportSurfaceMerging)
              {
                if (objTypes[scene.objsRefactored[i].type].supportSurfaceMerging)
                {
                  // Both of them supports surface merging (e.g. two glasses with one common edge
                  surfaceMerging_objs[surfaceMerging_objs.length] = scene.objsRefactored[i];
                }
                else
                {
                  // Only the first shot object supports surface merging
                  // Set the object to be shot to be the one not supporting surface merging (e.g. if one surface of a glass coincides with a blocker, then only block the ray)
                  s_obj = scene.objsRefactored[i];
                  s_obj_index = i;
                  s_point = s_point_temp;
                  s_lensq = s_lensq_temp;

                  surfaceMerging_objs = [];
                }
              }
            }
            else if (s_lensq_temp < s_lensq && s_lensq_temp > minShotLength_squared)
            {
              s_obj = scene.objsRefactored[i]; // Update the object to be shot
              s_obj_index = i;
              s_point = s_point_temp;
              s_lensq = s_lensq_temp;

              surfaceMerging_objs = [];
            }
          }
        }
      }
      if (colorMode) {
        var color = wavelengthToColor(waitingRays[j].wavelength, (waitingRays[j].brightness_s + waitingRays[j].brightness_p), true);
      } else {
        ctxLight.globalAlpha = alpha0 * (waitingRays[j].brightness_s + waitingRays[j].brightness_p);
      }
      // If not shot on any object
      if (s_lensq == Infinity)
      {
        if (scene.modeRefactored == 'light' || scene.modeRefactored == 'extended_light')
        {
          if (colorMode) {
            canvasPainter.draw(waitingRays[j], color); // Draw the ray
          } else {
            canvasPainter.draw(waitingRays[j], 'rgb(255,255,128)'); // Draw the ray
          }
        }
        if (scene.modeRefactored == 'extended_light' && !waitingRays[j].isNew)
        {
          if (colorMode) {
            ctxLight.setLineDash([2, 2]);
            canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), color); // Draw the extension of the ray
            ctxLight.setLineDash([]);
          } else {
            canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), 'rgb(255,128,0)'); // Draw the extension of the ray
          }
        }

        if (scene.modeRefactored == 'observer')
        {
          observed_point = graphs.intersection_line_circle(waitingRays[j], observer)[2];
          if (observed_point)
          {
            if (graphs.intersection_is_on_ray(observed_point, waitingRays[j]))
            {
              observed = true;
            }
          }
        }
      }
      else
      {
        // Here the ray will be shot on s_obj at s_point after traveling for s_len
        if (scene.modeRefactored == 'light' || scene.modeRefactored == 'extended_light')
        {
          if (colorMode) {
            canvasPainter.draw(graphs.segment(waitingRays[j].p1, s_point), color); // Draw the ray
          } else {
            canvasPainter.draw(graphs.segment(waitingRays[j].p1, s_point), 'rgb(255,255,128)'); // Draw the ray
          }
        }
        if (scene.modeRefactored == 'extended_light' && !waitingRays[j].isNew)
        {
          if (colorMode) {
            ctxLight.setLineDash([2, 2]);
            canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), color); // Draw the backward extension of the ray
            ctxLight.setLineDash([1, 5]);
            canvasPainter.draw(graphs.ray(s_point, graphs.point(s_point.x * 2 - waitingRays[j].p1.x, s_point.y * 2 - waitingRays[j].p1.y)), color); // Draw the forward extension of the ray
            ctxLight.setLineDash([]);
          } else {
            canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), 'rgb(255,128,0)'); // Draw the backward extension of the ray
            canvasPainter.draw(graphs.ray(s_point, graphs.point(s_point.x * 2 - waitingRays[j].p1.x, s_point.y * 2 - waitingRays[j].p1.y)), 'rgb(80,80,80)'); // Draw the forward extension of the ray
          }

        }

        if (scene.modeRefactored == 'observer')
        {
          observed_point = graphs.intersection_line_circle(waitingRays[j], observer)[2];

          if (observed_point)
          {

            if (graphs.intersection_is_on_segment(observed_point, graphs.segment(waitingRays[j].p1, s_point)))
            {
              observed = true;
            }
          }
        }
      }
      if (scene.modeRefactored == 'observer' && last_ray)
      {
        if (!waitingRays[j].gap)
        {
          observed_intersection = graphs.intersection_2line(waitingRays[j], last_ray); // The intersection of the observed rays

          if (observed)
          {
            if (last_intersection && graphs.length_squared(last_intersection, observed_intersection) < 25)
            {
              // If the intersections are near each others
              if (graphs.intersection_is_on_ray(observed_intersection, graphs.ray(observed_point, waitingRays[j].p1)) && graphs.length_squared(observed_point, waitingRays[j].p1) > 1e-5)
              {


                if (colorMode) {
                  var color = wavelengthToColor(waitingRays[j].wavelength, (waitingRays[j].brightness_s + waitingRays[j].brightness_p) * 0.5, true);
                } else {
                  ctxLight.globalAlpha = alpha0 * ((waitingRays[j].brightness_s + waitingRays[j].brightness_p) + (last_ray.brightness_s + last_ray.brightness_p)) * 0.5;
                }
                if (s_point)
                {
                  rpd = (observed_intersection.x - waitingRays[j].p1.x) * (s_point.x - waitingRays[j].p1.x) + (observed_intersection.y - waitingRays[j].p1.y) * (s_point.y - waitingRays[j].p1.y);
                }
                else
                {
                  rpd = (observed_intersection.x - waitingRays[j].p1.x) * (waitingRays[j].p2.x - waitingRays[j].p1.x) + (observed_intersection.y - waitingRays[j].p1.y) * (waitingRays[j].p2.y - waitingRays[j].p1.y);
                }
                if (rpd < 0)
                {
                  // Virtual image
                  if (colorMode) {
                    ctxLight.fillStyle = color;
                    ctxLight.fillRect(observed_intersection.x - 1.5, observed_intersection.y - 1.5, 3, 3);
                  } else {
                    canvasPainter.draw(observed_intersection, 'rgb(255,128,0)'); // Draw the image
                  }
                }
                else if (rpd < s_lensq)
                {
                  // Real image
                  if (colorMode) {
                    canvasPainter.draw(observed_intersection, color); // Draw the image
                  } else {
                    canvasPainter.draw(observed_intersection, 'rgb(255,255,128)'); // Draw the image
                  }
                }
                  if (colorMode) {
                    ctxLight.setLineDash([1, 2]);
                    canvasPainter.draw(graphs.segment(observed_point, observed_intersection), color); // Draw the observed ray
                    ctxLight.setLineDash([]);
                  } else {
                    canvasPainter.draw(graphs.segment(observed_point, observed_intersection), 'rgb(0,0,255)'); // Draw the observed ray
                  }
              }
              else
              {
                if (colorMode) {
                  ctxLight.setLineDash([1, 2]);
                  canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), color); // Draw the observed ray
                  ctxLight.setLineDash([]);
                } else {
                  canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), 'rgb(0,0,255)'); // Draw the observed ray
                }
              }
            }
            else
            {
              if (last_intersection)
              {
                if (colorMode) {
                  ctxLight.setLineDash([1, 2]);
                  canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), color); // Draw the observed ray
                  ctxLight.setLineDash([]);
                } else {
                  canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), 'rgb(0,0,255)'); // Draw the observed ray
                }
              }
            }
          }
          last_intersection = observed_intersection;
        }
        else
        {
          last_intersection = null;
        }
      }

      if (scene.modeRefactored == 'images' && last_ray)
      {
        if (!waitingRays[j].gap)
        {

          observed_intersection = graphs.intersection_2line(waitingRays[j], last_ray);
          if (last_intersection && graphs.length_squared(last_intersection, observed_intersection) < 25)
          {
            if (colorMode) {
              var color = wavelengthToColor(waitingRays[j].wavelength, (waitingRays[j].brightness_s + waitingRays[j].brightness_p) * 0.5, true);
            } else {
              ctxLight.globalAlpha = alpha0 * ((waitingRays[j].brightness_s + waitingRays[j].brightness_p) + (last_ray.brightness_s + last_ray.brightness_p)) * 0.5;
            }

            if (s_point)
            {
              rpd = (observed_intersection.x - waitingRays[j].p1.x) * (s_point.x - waitingRays[j].p1.x) + (observed_intersection.y - waitingRays[j].p1.y) * (s_point.y - waitingRays[j].p1.y);
            }
            else
            {
              rpd = (observed_intersection.x - waitingRays[j].p1.x) * (waitingRays[j].p2.x - waitingRays[j].p1.x) + (observed_intersection.y - waitingRays[j].p1.y) * (waitingRays[j].p2.y - waitingRays[j].p1.y);
            }

            if (rpd < 0)
            {
              // Virtual image
              if (colorMode) {
                ctxLight.fillStyle = color;
                ctxLight.fillRect(observed_intersection.x - 1.5, observed_intersection.y - 1.5, 3, 3);
              } else {
                canvasPainter.draw(observed_intersection, 'rgb(255,128,0)'); // Draw the image
              }
            }
            else if (rpd < s_lensq)
            {
              // Real image
              if (colorMode) {
                canvasPainter.draw(observed_intersection, color); // Draw the image
              } else {
                canvasPainter.draw(observed_intersection, 'rgb(255,255,128)'); // Draw the image
              }
            }
            else
            {
              // Virtual object
              if (colorMode) {
                ctxLight.fillStyle = color;
                ctxLight.fillRect(observed_intersection.x - 0.5, observed_intersection.y - 0.5, 1, 1);
              } else {
                canvasPainter.draw(observed_intersection, 'rgb(80,80,80)');
              }
            }
          }
          last_intersection = observed_intersection;
        }

      }

      if (last_s_obj_index != s_obj_index)
      {
        waitingRays[j].gap = true;
      }
      waitingRays[j].isNew = false;

      last_ray = {p1: waitingRays[j].p1, p2: waitingRays[j].p2};
      last_s_obj_index = s_obj_index;
      if (s_obj)
      {
        objTypes[s_obj.type].shot(s_obj, waitingRays[j], j, s_point, surfaceMerging_objs);
      }
      else
      {
        waitingRays[j] = null;
      }

      shotRayCount = shotRayCount + 1;
      if (waitingRays[j] && waitingRays[j].exist)
      {
        leftRayCount = leftRayCount + 1;
      }
    }
  }

  //}
  if (colorMode && ctxLight.constructor != C2S) {
    // Inverse transformation of the color adjustment made in wavelengthToColor.
    // This is to avoid the color satiation problem when using the 'lighter' composition.
    // Currently not supported when exporting to SVG.

    var virtualCanvas = document.createElement('canvas');
    var virtualCtx = virtualCanvas.getContext('2d');

    virtualCanvas.width = ctxLight.canvas.width;
    virtualCanvas.height = ctxLight.canvas.height;

    virtualCtx.drawImage(ctxLight.canvas, 0, 0);

    var imageData = virtualCtx.getImageData(0.0, 0.0, virtualCanvas.width, virtualCanvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      if (data[i+3] == 0) continue; // Skip transparent pixels
      var a0 = data[i+3] / 256;
      var R = - Math.log(1-(data[i] / 256)) * a0;
      var G = - Math.log(1-(data[i+1] / 256)) * a0;
      var B = - Math.log(1-(data[i+2] / 256)) * a0;
      var factor = Math.max(R,G,B);
      var r = 255 * R / factor;
      var g = 255 * G / factor;
      var b = 255 * B / factor;
      data[i] = r;
      data[i+1] = g;
      data[i+2] = b;
      data[i+3] = 255 * Math.min(factor, 1);
    }
    virtualCtx.putImageData(imageData, 0, 0);
    ctxLight.globalCompositeOperation = 'source-over';

    ctxLight.setTransform(1,0,0,1,0,0);
    ctxLight.clearRect(0, 0, ctxLight.canvas.width, ctxLight.canvas.height);
    ctxLight.drawImage(virtualCanvas, 0, 0);
    ctx.setTransform(scale*dpr,0,0,scale*dpr,origin.x*dpr, origin.y*dpr);
  }
  ctxLight.globalAlpha = 1.0;
  
  if (forceStop)
  {
    document.getElementById('status').innerHTML = getMsg("ray_count") + shotRayCount + '<br>' + getMsg("total_truncation") + totalTruncation.toFixed(3) + '<br>' + getMsg("time_elapsed") + (new Date() - drawBeginTime) + '<br>' + getMsg("force_stopped");
    forceStop = false;
  }
  else if (hasExceededTime)
  {
    //document.getElementById('status').innerHTML = getMsg("ray_count") + shotRayCount + '<br>' + getMsg("total_truncation") + totalTruncation;
  }
  else
  {
    document.getElementById('status').innerHTML = getMsg("ray_count") + shotRayCount + '<br>' + getMsg("total_truncation") + totalTruncation.toFixed(3) + '<br>' + getMsg("time_elapsed") + (new Date() - drawBeginTime);
  }
  document.getElementById('forceStop').style.display = 'none';
  //ctx.stroke();
  setTimeout(draw_, 10);


  
  draw(true, true);
  

}


//Optical Filter Settings
function dichroicSettings(obj, elem){
  if (colorMode) {
    createBooleanAttr(getMsg('filter'), obj.isDichroic, function(obj, value) {
      obj.isDichroic = value;
      obj.wavelength = obj.wavelength || GREEN_WAVELENGTH;
      obj.isDichroicFilter = obj.isDichroicFilter || false;
      obj.bandwidth = obj.bandwidth || 10
      if (obj == scene.objsRefactored[selectedObj]) {
        selectObj(selectedObj);
      }
    }, elem);
    if (obj.isDichroic) {
      createBooleanAttr(getMsg('invert'), obj.isDichroicFilter, function(obj, value) {
        if(obj.isDichroic){
          obj.isDichroicFilter = value;
        }
      }, elem);
      createNumberAttr(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function(obj, value) { 
        obj.wavelength = value;
      }, elem);
      createNumberAttr("± " + getMsg('bandwidth'), 0, (INFRARED_WAVELENGTH - UV_WAVELENGTH) , 1, obj.bandwidth || 10, function(obj, value) { 
        obj.bandwidth = value;
      }, elem);
    }
  }
}

//Optical filter wavelength interaction check
//Checks to see if the wavelength of the ray interacts
function wavelengthInteraction(obj, ray){
var dichroicEnabled = colorMode && obj.isDichroic && obj.wavelength;
var rayHueMatchesMirror =  Math.abs(obj.wavelength - ray.wavelength) <= (obj.bandwidth || 0);
return !dichroicEnabled || (rayHueMatchesMirror != obj.isDichroicFilter);
}


// takes wavelength in nm and returns an rgb value
function wavelengthToColor(wavelength, brightness, transform) {
  // From https://scienceprimer.com/javascript-code-convert-light-wavelength-color
  var r,
      g,
      b,
      alpha,
      colorSpace,
      wl = wavelength,
      gamma = 1;

  if (wl >= UV_WAVELENGTH && wl < VIOLET_WAVELENGTH) {
    R = 0.5;
    G = 0;
    B = 1;
  } else if (wl >= VIOLET_WAVELENGTH && wl < BLUE_WAVELENGTH) {
    R = -0.5 * (wl - BLUE_WAVELENGTH) / (BLUE_WAVELENGTH - VIOLET_WAVELENGTH);
    G = 0;
    B = 1;
  } else if (wl >= BLUE_WAVELENGTH && wl < CYAN_WAVELENGTH) {
    R = 0;
    G = (wl - BLUE_WAVELENGTH) / (CYAN_WAVELENGTH - BLUE_WAVELENGTH);
    B = 1;  
  } else if (wl >= CYAN_WAVELENGTH && wl < GREEN_WAVELENGTH) {
    R = 0;
    G = 1;
    B = -1 * (wl - GREEN_WAVELENGTH) / (GREEN_WAVELENGTH - CYAN_WAVELENGTH);
  } else if (wl >= GREEN_WAVELENGTH && wl < YELLOW_WAVELENGTH) {
    R = (wl - GREEN_WAVELENGTH) / (YELLOW_WAVELENGTH - GREEN_WAVELENGTH);
    G = 1;
    B = 0;
  } else if (wl >= YELLOW_WAVELENGTH && wl < RED_WAVELENGTH) {
    R = 1;
    G = -1 * (wl - RED_WAVELENGTH) / (RED_WAVELENGTH - YELLOW_WAVELENGTH);
    B = 0.0;
  } else if (wl >= RED_WAVELENGTH && wl <= INFRARED_WAVELENGTH) {
    R = 1;
    G = 0;
    B = 0;
  } else {
    R = 0;
    G = 0;
    B = 0;
  }

  // intensty is lower at the edges of the visible spectrum.
  if (wl > INFRARED_WAVELENGTH || wl < UV_WAVELENGTH) {
      alpha = 0;
  } else if (wl > RED_WAVELENGTH) {
      alpha = (INFRARED_WAVELENGTH - wl) / (INFRARED_WAVELENGTH - RED_WAVELENGTH);
  } else if (wl < VIOLET_WAVELENGTH) {
      alpha = (wl - UV_WAVELENGTH) / (VIOLET_WAVELENGTH - UV_WAVELENGTH);
  } else {
      alpha = 1;
  }

  R *= alpha * brightness;
  G *= alpha * brightness;
  B *= alpha * brightness;

  if (ctx.constructor != C2S && transform) {
    // Adjust color to make (R,G,B) linear when using the 'screen' composition.
    // This is to avoid the color satiation problem when using the 'lighter' composition.
    // Currently not supported when exporting to SVG as it is currently under draft in CSS Color 4 
    R = 1 - Math.exp(-R);
    G = 1 - Math.exp(-G);
    B = 1 - Math.exp(-B);
  }

  return "rgb(" + (R * 100) + "%," + (G * 100) + "%," + (B * 100) + "%)";
 
}
