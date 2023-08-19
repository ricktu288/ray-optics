var waitingRays = []; //待處理光線 The rays waiting for shooting
var waitingRayCount = 0; //待處理光線數量 Number of rays waiting for shooting
var rayDensity_light = 0.1; //光線密度(光線相關模式) The Ray Density when View is Rays or Extended rays
var rayDensity_images = 1; //光線密度(像相關模式) The Ray Density when View is All Images or Seen by Observer
var mode = 'light';
var extendLight = false;
var showLight = true;
var colorMode = false;
var timerID = -1;
var isDrawing = false;
var hasExceededTime = false;
var forceStop = false;
var lastDrawTime = -1;
var stateOutdated = false; //上次繪圖完後狀態已經變更 The state has changed since last draw
var minShotLength = 1e-6; //光線兩次作用的最短距離(小於此距離的光線作用會被忽略) The minimal length between two interactions with rays (when smaller than this, the interaction will be ignored)
var minShotLength_squared = minShotLength * minShotLength;
var totalTruncation = 0;

const UV_WAVELENGTH = 380;
const VIOLET_WAVELENGTH = 420;
const BLUE_WAVELENGTH = 460;
const CYAN_WAVELENGTH = 500;
const GREEN_WAVELENGTH = 540;
const YELLOW_WAVELENGTH = 580;
const RED_WAVELENGTH = 620;
const INFRARED_WAVELENGTH = 700;

// Draw the scene
function draw()
{
  stateOutdated = true;
  totalTruncation = 0;
  document.getElementById('forceStop').style.display = 'none';
  if (timerID != -1)
  {
    //若程式正在處理上一次的繪圖,則停止處理 If still handling the last draw, then stop
    clearTimeout(timerID);
    timerID = -1;
    isDrawing = false;
  }

  if (!isDrawing)
  {
    isDrawing = true;
    draw_();
  }
}


function draw_() {
  if (!stateOutdated)
  {
    isDrawing = false;
    return;
  }
  stateOutdated = false;

  JSONOutput();
  canvasPainter.cls();
  ctx.globalAlpha = 1;
  hasExceededTime = false;
  waitingRays = [];
  shotRayCount = 0;



  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (document.getElementById('showgrid').checked && ctx.constructor != C2S)
  {
    //畫出格線 Draw the grid
    ctx.strokeStyle = 'rgb(64,64,64)';
    var dashstep = 4;
    ctx.beginPath();
    for (var x = origin.x / scale % gridSize; x <= canvas.width / scale; x += gridSize)
    {
      for (var y = 0; y <= canvas.height / scale; y += dashstep)
      {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + dashstep * 0.5);
      }
    }
    for (var y = origin.y / scale % gridSize; y <= canvas.height / scale; y += gridSize)
    {
      for (var x = 0; x <= canvas.width / scale; x += dashstep)
      {
        ctx.moveTo(x, y);
        ctx.lineTo(x + dashstep * 0.5, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();

  // Sort the objects with z-index.
  var mapped = objs.map(function(obj, i) {
    if (objTypes[obj.type].zIndex) {
      return {index: i, value: objTypes[obj.type].zIndex(obj)};
    } else {
      return {index: i, value: 0};
    }
  });
  mapped.sort(function(a, b) {
    return a.value - b.value;
  });
  //畫出物件 Draw the objects
  for (var j = 0; j < objs.length; j++)
  {
    var i = mapped[j].index;
    objTypes[objs[i].type].draw(objs[i], canvas);
    if (objTypes[objs[i].type].shoot)
    {
      objTypes[objs[i].type].shoot(objs[i]); //若objs[i]能射出光線,讓它射出 If objs[i] can shoot rays, shoot them.
    }
  }
  if (colorMode && ctx.constructor != C2S) {
    // Transformation the color to the same representation as color rendering.
    // This is to avoid the color satiation problem when using the 'lighter' composition.
    // Currently not supported when exporting to SVG.
    var imageData = ctx.getImageData(0.0, 0.0, canvas.width, canvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
        var R = 1 - Math.exp(-data[i] / 256);
        var G = 1 - Math.exp(-data[i+1] / 256);
        var B = 1 - Math.exp(-data[i+2] / 256);
        data[i] = 255 * R;
        data[i+1] = 255 * G;
        data[i+2] = 255 * B;
    }
    ctx.putImageData(imageData, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  leftRayCount = 0;
  last_s_obj_index = -1;
  last_ray = null;
  last_intersection = null;
  waitingRaysIndex = -1;
  firstBreak = true;
  shootWaitingRays();
  if (mode == 'observer')
  {
    //畫出即時觀察者 Draw the observer
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = 'blue';
    ctx.arc(observer.c.x, observer.c.y, observer.r, 0, Math.PI * 2, false);
    ctx.fill();
  }
  lastDrawTime = new Date();
}

function addRay(ray) {
  waitingRays[waitingRays.length] = ray;
}

function getRayDensity()
{
  if (mode == 'images' || mode == 'observer')
  {
    return rayDensity_images;
  }
  else
  {
    return rayDensity_light;
  }
}

function setRayDensity(value)
{
  if (mode == 'images' || mode == 'observer')
  {
    rayDensity_images = value;
  }
  else
  {
    rayDensity_light = value;
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
  ctx.globalAlpha = alpha0;
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
    ctx.globalCompositeOperation = 'screen';
  }

  while (true) {
    if (new Date() - st_time > 50 && ctx.constructor != C2S)
    {
      //若已計算超過200ms If already run for 200ms
      //先休息10ms後再繼續(防止程式沒有回應) Pause for 10ms and continue (prevent not responding)
      hasExceededTime = true;
      timerID = setTimeout(shootWaitingRays, firstBreak ? 100:1);
      firstBreak = false;
      document.getElementById('forceStop').style.display = '';
      return;
    }
    if (new Date() - st_time > 5000 && ctx.constructor == C2S)
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
      //開始射出waitingRays[j](等待區的最後一條光線) Start handling waitingRays[j]
      //判斷這道光射出後,會先撞到哪一個物件 Test which object will this ray shoot on first

      //↓搜尋每一個"與這道光相交的物件",尋找"[物件與光線的交點]離[光線的頭]最近的物件" Search every object intersected with the ray, and find which intersection is the nearest
      s_obj = null; //"到目前為止,已檢查的物件中[與光線的交點]離[光線的頭]最近的物件" The current nearest object in search
      s_obj_index = -1;
      s_point = null;  //s_obj與光線的交點 The intersection
      surfaceMerging_objs = []; //要與射到的物件進行界面融合的物件 The objects whose surface is to be merged with s_obj
      s_lensq = Infinity;
      observed = false; //waitingRays[j]是否被觀察者看到 Whether waitingRays[j] is observed by the observer
      for (var i = 0; i < objs.length; i++)
      {
        //↓若objs[i]會影響到光 if objs[i] can affect the ray
        if (objTypes[objs[i].type].rayIntersection) {
          //↓判斷objs[i]是否與這道光相交 Test whether objs[i] intersects with the ray
          s_point_temp = objTypes[objs[i].type].rayIntersection(objs[i], waitingRays[j]);
          if (s_point_temp)
          {
            //此時代表objs[i]是"與這道光相交的物件",交點是s_point_temp Here objs[i] intersects with the ray at s_point_temp
            s_lensq_temp = graphs.length_squared(waitingRays[j].p1, s_point_temp);
            if (s_point && graphs.length_squared(s_point_temp, s_point) < minShotLength_squared && (objTypes[objs[i].type].supportSurfaceMerging || objTypes[s_obj.type].supportSurfaceMerging))
            {
              //這道光同時射到兩個物件,且至少有一個支援界面融合 The ray is shot on two objects at the same time, and at least one of them supports surface merging

              if (objTypes[s_obj.type].supportSurfaceMerging)
              {
                if (objTypes[objs[i].type].supportSurfaceMerging)
                {
                  //兩個都支援界面融合(例如兩個折射鏡以一條邊相連) Both of them supports surface merging (e.g. two glasses with one common edge
                  surfaceMerging_objs[surfaceMerging_objs.length] = objs[i];
                }
                else
                {
                  //只有先射到的界面支援界面融合 Only the first shot object supports surface merging
                  //將擬定射到的物件設為不支援界面融合者(如折射鏡邊界與一遮光片重合,則只執行遮光片的動作) Set the object to be shot to be the one not supporting surface merging (e.g. if one surface of a glass coincides with a blocker, then only block the ray)
                  s_obj = objs[i];
                  s_obj_index = i;
                  s_point = s_point_temp;
                  s_lensq = s_lensq_temp;

                  surfaceMerging_objs = [];
                }
              }
            }
            else if (s_lensq_temp < s_lensq && s_lensq_temp > minShotLength_squared)
            {
              s_obj = objs[i]; //更新"到目前為止,已檢查的物件中[物件與光線的交點]離[光線的頭]最近的物件" Update the object to be shot
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
        ctx.globalAlpha = alpha0 * (waitingRays[j].brightness_s + waitingRays[j].brightness_p);
      }
      //↓若光線沒有射到任何物件 If not shot on any object
      if (s_lensq == Infinity)
      {
        if (mode == 'light' || mode == 'extended_light')
        {
          if (colorMode) {
            canvasPainter.draw(waitingRays[j], color); //畫出這條光線 Draw the ray
          } else {
            canvasPainter.draw(waitingRays[j], 'rgb(255,255,128)'); //畫出這條光線 Draw the ray
          }
        }
        if (mode == 'extended_light' && !waitingRays[j].isNew)
        {
          if (colorMode) {
            ctx.setLineDash([2, 2]);
            canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), color); //畫出這條光的延長線 Draw the extension of the ray
            ctx.setLineDash([]);
          } else {
            canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), 'rgb(255,128,0)'); //畫出這條光的延長線 Draw the extension of the ray
          }
        }

        if (mode == 'observer')
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
        //此時,代表光線會在射出經過s_len(距離)後,在s_point(位置)撞到s_obj(物件) Here the ray will be shot on s_obj at s_point after traveling for s_len
        if (mode == 'light' || mode == 'extended_light')
        {
          if (colorMode) {
            canvasPainter.draw(graphs.segment(waitingRays[j].p1, s_point), color); //畫出這條光線 Draw the ray
          } else {
            canvasPainter.draw(graphs.segment(waitingRays[j].p1, s_point), 'rgb(255,255,128)'); //畫出這條光線 Draw the ray
          }
        }
        if (mode == 'extended_light' && !waitingRays[j].isNew)
        {
          if (colorMode) {
            ctx.setLineDash([2, 2]);
            canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), color); //畫出這條光的延長線 Draw the backward extension of the ray
            ctx.setLineDash([1, 5]);
            canvasPainter.draw(graphs.ray(s_point, graphs.point(s_point.x * 2 - waitingRays[j].p1.x, s_point.y * 2 - waitingRays[j].p1.y)), color); //畫出這條光向前的延長線 Draw the forward extension of the ray
            ctx.setLineDash([]);
          } else {
            canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), 'rgb(255,128,0)'); //畫出這條光的延長線 Draw the backward extension of the ray
            canvasPainter.draw(graphs.ray(s_point, graphs.point(s_point.x * 2 - waitingRays[j].p1.x, s_point.y * 2 - waitingRays[j].p1.y)), 'rgb(80,80,80)'); //畫出這條光向前的延長線 Draw the forward extension of the ray
          }

        }

        if (mode == 'observer')
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
      if (mode == 'observer' && last_ray)
      {
        if (!waitingRays[j].gap)
        {
          observed_intersection = graphs.intersection_2line(waitingRays[j], last_ray); //觀察到的光線之交點 The intersection of the observed rays

          if (observed)
          {
            if (last_intersection && graphs.length_squared(last_intersection, observed_intersection) < 25)
            {
              //當交點彼此相當靠近 If the intersections are near each others
              if (graphs.intersection_is_on_ray(observed_intersection, graphs.ray(observed_point, waitingRays[j].p1)) && graphs.length_squared(observed_point, waitingRays[j].p1) > 1e-5)
              {


                if (colorMode) {
                  var color = wavelengthToColor(waitingRays[j].wavelength, (waitingRays[j].brightness_s + waitingRays[j].brightness_p) * 0.5, true);
                } else {
                  ctx.globalAlpha = alpha0 * ((waitingRays[j].brightness_s + waitingRays[j].brightness_p) + (last_ray.brightness_s + last_ray.brightness_p)) * 0.5;
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
                  //虛像 Virtual image
                  if (colorMode) {
                    ctx.fillStyle = color;
                    ctx.fillRect(observed_intersection.x - 1.5, observed_intersection.y - 1.5, 3, 3);
                  } else {
                    canvasPainter.draw(observed_intersection, 'rgb(255,128,0)'); //畫出像 Draw the image
                  }
                }
                else if (rpd < s_lensq)
                {
                  //實像 Real image
                  if (colorMode) {
                    canvasPainter.draw(observed_intersection, color); //畫出像 Draw the image
                  } else {
                    canvasPainter.draw(observed_intersection, 'rgb(255,255,128)'); //畫出像 Draw the image
                  }
                }
                  if (colorMode) {
                    ctx.setLineDash([1, 2]);
                    canvasPainter.draw(graphs.segment(observed_point, observed_intersection), color); // Draw the observed ray
                    ctx.setLineDash([]);
                  } else {
                    canvasPainter.draw(graphs.segment(observed_point, observed_intersection), 'rgb(0,0,255)'); // Draw the observed ray
                  }
              }
              else
              {
                if (colorMode) {
                  ctx.setLineDash([1, 2]);
                  canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), color); //畫出觀察到的光線(射線) // Draw the observed ray
                  ctx.setLineDash([]);
                } else {
                  canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), 'rgb(0,0,255)'); //畫出觀察到的光線(射線) // Draw the observed ray
                }
              }
            }
            else
            {
              if (last_intersection)
              {
                if (colorMode) {
                  ctx.setLineDash([1, 2]);
                  canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), color); //畫出觀察到的光線(射線) // Draw the observed ray
                  ctx.setLineDash([]);
                } else {
                  canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), 'rgb(0,0,255)'); //畫出觀察到的光線(射線) // Draw the observed ray
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

      if (mode == 'images' && last_ray)
      {
        if (!waitingRays[j].gap)
        {

          observed_intersection = graphs.intersection_2line(waitingRays[j], last_ray);
          if (last_intersection && graphs.length_squared(last_intersection, observed_intersection) < 25)
          {
            if (colorMode) {
              var color = wavelengthToColor(waitingRays[j].wavelength, (waitingRays[j].brightness_s + waitingRays[j].brightness_p) * 0.5, true);
            } else {
              ctx.globalAlpha = alpha0 * ((waitingRays[j].brightness_s + waitingRays[j].brightness_p) + (last_ray.brightness_s + last_ray.brightness_p)) * 0.5;
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
              //虛像 Virtual image
              if (colorMode) {
                ctx.fillStyle = color;
                ctx.fillRect(observed_intersection.x - 1.5, observed_intersection.y - 1.5, 3, 3);
              } else {
                canvasPainter.draw(observed_intersection, 'rgb(255,128,0)'); //畫出像 Draw the image
              }
            }
            else if (rpd < s_lensq)
            {
              //實像 Real image
              if (colorMode) {
                canvasPainter.draw(observed_intersection, color); //畫出像 Draw the image
              } else {
                canvasPainter.draw(observed_intersection, 'rgb(255,255,128)'); //畫出像 Draw the image
              }
            }
            else
            {
              //虛物 Virtual object
              if (colorMode) {
                ctx.fillStyle = color;
                ctx.fillRect(observed_intersection.x - 0.5, observed_intersection.y - 0.5, 1, 1);
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
  if (colorMode && ctx.constructor != C2S) {
    // Inverse transformation of the color adjustment made in wavelengthToColor.
    // This is to avoid the color satiation problem when using the 'lighter' composition.
    // Currently not supported when exporting to SVG.
    var imageData = ctx.getImageData(0.0, 0.0, canvas.width, canvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
        var R = - Math.log(1-(data[i] / 256));
        var G = - Math.log(1-(data[i+1] / 256));
        var B = - Math.log(1-(data[i+2] / 256));
        var factor = Math.max(R,G,B,1);
        data[i] = 255 * R / factor;
        data[i+1] = 255 * G / factor;
        data[i+2] = 255 * B / factor;
    }
    ctx.putImageData(imageData, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1.0;
  for (var i = 0; i < objs.length; i++)
  {
    objTypes[objs[i].type].draw(objs[i], canvas, true); //畫出objs[i] Draw objs[i]
  }
  if (mode == 'observer')
  {
    //畫出即時觀察者 Draw the observer
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = 'blue';
    ctx.arc(observer.c.x, observer.c.y, observer.r, 0, Math.PI * 2, false);
    ctx.fill();
  }
  if (forceStop)
  {
    document.getElementById('status').innerHTML = shotRayCount + ' rays (stopped)';
    forceStop = false;
  }
  else if (hasExceededTime)
  {
    document.getElementById('status').innerHTML = shotRayCount + ' rays';
  }
  else
  {
    document.getElementById('status').innerHTML = shotRayCount + ' rays (' + (new Date() - st_time) + 'ms)';
  }
  document.getElementById('forceStop').style.display = 'none';
  //ctx.stroke();
  setTimeout(draw_, 10);

}


//Optical Filter Settings
function dichroicSettings(obj, elem){
  if (colorMode) {
    createBooleanAttr(getMsg('filter'), obj.isDichroic, function(obj, value) {
      obj.isDichroic = value;
      obj.wavelength = obj.wavelength || GREEN_WAVELENGTH;
      obj.isDichroicFilter = obj.isDichroicFilter || false;
      obj.bandwidth = obj.bandwidth || 10
      if (obj == objs[selectedObj]) {
        cartesianSign = value;
        localStorage.rayOpticsCartesianSign = value?"true":"false";
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
