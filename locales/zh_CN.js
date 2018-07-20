if (typeof locales == 'undefined') locales = {};
locales["zh-CN"] = {
  "lang": {
    "message": "简体中文"
  },
  "font": {
    "message": ""
  },
  "page_title": {
    "message": "几何光学模拟 - 首页"
  },
  "title": {
    "message": "几何光学模拟"
  },
  "description": {
    "message": "开放源代码的网页程序，可模拟光的反射与折射。<br>以HTML、CSS和JavaScript写成。"
  },
  "start": {
    "message": "启动程序"
  },
  "github_link": {
    "message": "至GitHub查看"
  },
  "start-old": {
    "message": "旧版"
  },
  "tools": {
    "message": "工具"
  },
  "ray": {
    "message": "单一光线"
  },
  "ray_desc": {
    "message": "由两点决定一条光线。"
  },
  "beam": {
    "message": "平行光"
  },
  "beam_desc": {
    "message": "由一线段产生一束平行光，密度由\"光线密度\"滑杆决定。"
  },
  "point_source": {
    "message": "点光源"
  },
  "point_source_desc": {
    "message": "由一点向四周发射光线，数量由\"光线密度\"滑杆决定。"
  },
  "mirror": {
    "message": "镜子"
  },
  "mirror_desc": {
    "message": "模拟光线射到镜子时的反射。"
  },
  "mirror_arc": {
    "message": "镜子 (圆弧)"
  },
  "mirror_arc_desc": {
    "message": "圆弧形的镜子，由三点决定。"
  },
  "ideal_curved_mirror": {
    "message": "理想曲面镜"
  },
  "ideal_curved_mirror_desc": {
    "message": "完全符合面镜公式(1/p + 1/q = 1/f)的理想化\"曲面\"镜，可直接设定其焦距(单位为像素)。"
  },
  "glass_halfplane": {
    "message": "透光物"
  },
  "glass_halfplane_desc": {
    "message": "模拟光线经过透光物体界面时的反射与折射。计算光强度时假设为非偏振光。"
  },
  "glass_circle": {
    "message": "透光物 (圆形)"
  },
  "glass_circle_desc": {
    "message": "圆形透光物，由圆心与表面上一点决定。"
  },
  "glass": {
    "message": "透光物 (其他形状)"
  },
  "glass_desc": {
    "message": "任何由线段与圆弧组成的透光物，包括三棱镜与\"球面\"透镜。"
  },
  "ideal_lens": {
    "message": "透光物 (理想透镜)"
  },
  "ideal_lens_desc": {
    "message": "完全符合薄透镜公式(1/p + 1/q = 1/f)的理想化透镜，可直接设定其焦距(单位为像素)。"
  },
  "blocker": {
    "message": "吸光片"
  },
  "blocker_desc": {
    "message": "线段形状的吸光片，光线射到其上后就不会再射出。"
  },
  "ruler": {
    "message": "直尺"
  },
  "ruler_desc": {
    "message": "指定原点与另一点。刻度单位为像素。"
  },
  "protractor": {
    "message": "量角器"
  },
  "protractor_desc": {
    "message": "指定圆心和圆周上一点作为零度位置。刻度单位为度。"
  },
  "views": {
    "message": "呈现方式"
  },
  "rays": {
    "message": "光线"
  },
  "rays_desc": {
    "message": "画出光线。当\"光线密度\"高时，光线呈现连续。"
  },
  "extended_rays": {
    "message": "延长光线"
  },
  "extended_rays_desc": {
    "message": "除光线实际路径外，亦画出其延长线。橘色、灰色分别表示向后、向前的延长线。"
  },
  "all_images": {
    "message": "所有像"
  },
  "all_images_desc": {
    "message": "点出像的位置。黄点表示实像，橘点表示虚像，灰点(图中没有)表示虚物。注意\"光线密度\"不够高时有些像无法正常显示。"
  },
  "seen_by_observer": {
    "message": "观察者所见"
  },
  "seen_by_observer_desc": {
    "message": "模拟从某位置见到的光线与像。蓝色圆形为观察者，与其相交的光线被其「观察」到。观察者无法知道光线真正的起始位置，但若其在某处相交，它会认为光线是从该处来的。光线以蓝色表示，相交处以橘色表示。"
  },
  "language": {
    "message": "语言：简体中文"
  },
  "footer_message": {
    "message": "由 <a href='https://github.com/ricktu288' style='color:rgba(255,255,255,0.25)'>ricktu288</a>, <a href='https://github.com/j3soon' style='color:rgba(255,255,255,0.25)'>j3soon</a> 开发"
  }
};