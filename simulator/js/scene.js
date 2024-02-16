class Scene {
    constructor() {
        this.objs = [];
        this.mode = 'light';
        this.rayDensity_light = 0.1;
        this.rayDensity_images = 1;
        this.showGrid = false;
        this.grid = false;
        this.lockobjs = false;
        this.gridSize = 20;
        this.observer = null;
        this.origin = { x: 0, y: 0 };
        this.scale = 1;
        this.colorMode = false;
        this.symbolicGrin = false;
    }
};