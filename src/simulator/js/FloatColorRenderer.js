class FloatColorRenderer {
  constructor(gl, origin, scale, lengthScale) {
    this.gl = gl;
    if (!this.gl) {
      throw new Error('Unable to initialize WebGL. Your browser may not support it.');
    }

    // Enable floating point texture
    const ext = this.gl.getExtension('OES_texture_float');
    if (!ext) {
      throw new Error('OES_texture_float not supported');
    }

    this.canvas = gl.canvas;
    this.origin = origin;
    this.scale = scale;
    this.lengthScale = lengthScale;
    this.rayCache = [];
    this.segmentCache = [];
    this.pointCache = [];
    this.arrowCache = [];
    this.hasFirstFlush = false;
    
    // Create reusable buffers
    this.lineBuffer = this.gl.createBuffer();
    this.pointBuffer = this.gl.createBuffer();
    this.arrowBuffer = this.gl.createBuffer();
    
    this.initializeShaders();
    this.initializeFramebuffer();
  }

  initializeFramebuffer() {
    const gl = this.gl;
    
    // Create floating point texture
    this.floatTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.floatTexture);
    
    // Use RGBA format for the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Create and set up framebuffer
    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.floatTexture, 0);
    
    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer is not complete: ' + status);
    }
    
    // Create quad buffer for final render
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]), gl.STATIC_DRAW);
    
    // Reset bindings
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  initializeShaders() {
    // Vertex shader for rays
    const rayVertexSource = `
      attribute vec2 position;
      uniform vec2 u_resolution;
      uniform vec2 u_origin;
      uniform float u_scale;
      uniform bool u_isScreenSpace;
      
      varying vec2 v_position;
      varying vec2 v_resolution;
      
      void main() {
        vec2 pos;
        if (u_isScreenSpace) {
          pos = position;
        } else {
          pos = position * u_scale + u_origin;
        }
        
        // Convert to clip space
        vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y;
        gl_Position = vec4(clipSpace, 0.0, 1.0);
        
        // Pass values to fragment shader
        v_position = pos;
        v_resolution = u_resolution;
      }
    `;

    // Fragment shader for rays - just output color for additive blending
    const rayFragmentSource = `
      precision highp float;
      uniform vec4 u_color;
      uniform bool u_isScreenSpace;
      
      varying vec2 v_position;
      varying vec2 v_resolution;
      
      void main() {
        gl_FragColor = u_color;
      }
    `;

    // Vertex shader for points
    const pointVertexSource = `
      attribute vec2 position;
      uniform vec2 u_resolution;
      uniform vec2 u_origin;
      uniform float u_scale;
      uniform vec2 u_point;
      uniform float u_size;
      
      varying vec2 v_position;
      varying vec2 v_resolution;
      
      void main() {
        // Calculate point position
        vec2 pointPos = u_point * u_scale + u_origin;
        vec2 pos = pointPos + position * u_size * u_scale;
        
        // Convert to clip space
        vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y;
        gl_Position = vec4(clipSpace, 0.0, 1.0);
        
        // Pass values to fragment shader
        v_position = pos;
        v_resolution = u_resolution;
      }
    `;

    // Fragment shader for points - same as rays
    const pointFragmentSource = rayFragmentSource;

    // Vertex shader for final pass
    const quadVertexSource = `
      attribute vec2 position;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        v_texCoord = position * 0.5 + 0.5;
      }
    `;

    // Fragment shader for final pass - normalize accumulated colors
    const quadFragmentSource = `
      precision highp float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      
      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        float maxComponent = max(max(color.r, color.g), color.b);
        if (maxComponent > 1.0) {
          color.rgb /= maxComponent;
        }
        gl_FragColor = vec4(color.rgb, min(maxComponent, 1.0));
      }
    `;

    // Compile ray shaders
    const rayVertexShader = this.compileShader(this.gl, rayVertexSource, this.gl.VERTEX_SHADER);
    const rayFragmentShader = this.compileShader(this.gl, rayFragmentSource, this.gl.FRAGMENT_SHADER);
    
    // Create ray program
    this.rayProgram = this.gl.createProgram();
    this.gl.attachShader(this.rayProgram, rayVertexShader);
    this.gl.attachShader(this.rayProgram, rayFragmentShader);
    this.gl.linkProgram(this.rayProgram);

    if (!this.gl.getProgramParameter(this.rayProgram, this.gl.LINK_STATUS)) {
      this.gl.deleteProgram(this.rayProgram);
      return;
    }

    // Get ray program locations
    this.positionAttributeLocation = this.gl.getAttribLocation(this.rayProgram, 'position');
    this.resolutionUniformLocation = this.gl.getUniformLocation(this.rayProgram, 'u_resolution');
    this.originUniformLocation = this.gl.getUniformLocation(this.rayProgram, 'u_origin');
    this.scaleUniformLocation = this.gl.getUniformLocation(this.rayProgram, 'u_scale');
    this.isScreenSpaceLocation = this.gl.getUniformLocation(this.rayProgram, 'u_isScreenSpace');
    this.colorUniformLocation = this.gl.getUniformLocation(this.rayProgram, 'u_color');

    // Compile point shaders
    const pointVertexShader = this.compileShader(this.gl, pointVertexSource, this.gl.VERTEX_SHADER);
    const pointFragmentShader = this.compileShader(this.gl, pointFragmentSource, this.gl.FRAGMENT_SHADER);
    
    // Create point program
    this.pointProgram = this.gl.createProgram();
    this.gl.attachShader(this.pointProgram, pointVertexShader);
    this.gl.attachShader(this.pointProgram, pointFragmentShader);
    this.gl.linkProgram(this.pointProgram);

    if (!this.gl.getProgramParameter(this.pointProgram, this.gl.LINK_STATUS)) {
      this.gl.deleteProgram(this.pointProgram);
      return;
    }

    // Get point program locations
    this.pointPositionAttributeLocation = this.gl.getAttribLocation(this.pointProgram, 'position');
    this.pointResolutionUniformLocation = this.gl.getUniformLocation(this.pointProgram, 'u_resolution');
    this.pointOriginUniformLocation = this.gl.getUniformLocation(this.pointProgram, 'u_origin');
    this.pointScaleUniformLocation = this.gl.getUniformLocation(this.pointProgram, 'u_scale');
    this.pointPositionUniformLocation = this.gl.getUniformLocation(this.pointProgram, 'u_point');
    this.pointSizeUniformLocation = this.gl.getUniformLocation(this.pointProgram, 'u_size');
    this.pointColorUniformLocation = this.gl.getUniformLocation(this.pointProgram, 'u_color');

    // Compile quad shaders
    const quadVertexShader = this.compileShader(this.gl, quadVertexSource, this.gl.VERTEX_SHADER);
    const quadFragmentShader = this.compileShader(this.gl, quadFragmentSource, this.gl.FRAGMENT_SHADER);
    
    // Create quad program
    this.quadProgram = this.gl.createProgram();
    this.gl.attachShader(this.quadProgram, quadVertexShader);
    this.gl.attachShader(this.quadProgram, quadFragmentShader);
    this.gl.linkProgram(this.quadProgram);

    if (!this.gl.getProgramParameter(this.quadProgram, this.gl.LINK_STATUS)) {
      this.gl.deleteProgram(this.quadProgram);
      return;
    }

    // Get quad program locations
    this.quadPositionLocation = this.gl.getAttribLocation(this.quadProgram, 'position');
    this.textureLocation = this.gl.getUniformLocation(this.quadProgram, 'u_texture');

    // Create point vertices (unit square)
    const pointVertices = new Float32Array([
      -0.5, -0.5,
       0.5, -0.5,
      -0.5,  0.5,
       0.5,  0.5
    ]);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, pointVertices, this.gl.STATIC_DRAW);
  }

  compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Draw a point.
   * @param {Point} p
   * @param {number[]} [color=[0, 0, 0, 1]]
   * @param {number} [size=5]
   */
  drawPoint(p, color = [0, 0, 0, 1], size = 5) {
    this.pointCache.push({ p, color, size });
    
    // If cache is too large, flush immediately
    if (this.pointCache.length >= FloatColorRenderer.MAX_CACHE_SIZE) {
      this.flush();
    }
  }

  /**
   * Draw a ray.
   * @param {Line} r
   * @param {number[]} [color=[0, 0, 0, 1]]
   * @param {boolean} [showArrow=false]
   * @param {number[]} [lineDash=[]]
   */
  drawRay(r, color = [0, 0, 0, 1], showArrow = false, lineDash = []) {
    // Check if ray has a valid direction
    const dx = r.p2.x - r.p1.x;
    const dy = r.p2.y - r.p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 1e-5 * this.lengthScale) {
      return;
    }

    const unitX = dx / length;
    const unitY = dy / length;

    // Calculate canvas limit for ray length
    const cvsLimit = (Math.abs(r.p1.x + this.origin.x) + Math.abs(r.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);

    // Calculate arrow parameters
    const arrowSize = 5 * this.lengthScale;
    const arrowDistance = 150 * this.lengthScale;

    if (showArrow && arrowSize >= this.lengthScale * 1.2) {
      // Draw first part (from start to arrow)
      const firstSegment = {
        p1: r.p1,
        p2: {
          x: r.p1.x + unitX * arrowDistance,
          y: r.p1.y + unitY * arrowDistance
        }
      };

      if (lineDash && lineDash.length > 0) {
        this.drawDashedSegment(firstSegment, color, lineDash);
      } else {
        this.segmentCache.push({ s: firstSegment, color });
      }

      // Add arrow
      const arrowX = r.p1.x + unitX * arrowDistance;
      const arrowY = r.p1.y + unitY * arrowDistance;
      const perpX = -unitY;
      const perpY = unitX;
      const baseWidth = this.lengthScale;
      const tipWidth = arrowSize;

      this.arrowCache.push({
        points: [
          // Front points (wide part)
          arrowX - (tipWidth/2) * perpX,
          arrowY - (tipWidth/2) * perpY,
          arrowX + (tipWidth/2) * perpX,
          arrowY + (tipWidth/2) * perpY,
          // Back points (narrow part)
          arrowX + arrowSize * unitX + (baseWidth/2) * perpX,
          arrowY + arrowSize * unitY + (baseWidth/2) * perpY,
          arrowX + arrowSize * unitX - (baseWidth/2) * perpX,
          arrowY + arrowSize * unitY - (baseWidth/2) * perpY
        ],
        color
      });

      // Draw second part (from arrow to infinity)
      const secondRay = {
        p1: {
          x: arrowX + arrowSize * unitX,
          y: arrowY + arrowSize * unitY
        },
        p2: {
          x: r.p1.x + unitX * cvsLimit,
          y: r.p1.y + unitY * cvsLimit
        }
      };

      if (lineDash && lineDash.length > 0) {
        this.drawDashedSegment(secondRay, color, lineDash);
      } else {
        this.rayCache.push({ r: secondRay, color });
      }
    } else {
      // Draw without arrow
      if (lineDash && lineDash.length > 0) {
        // For dashed lines, create segments
        let dashPos = 0;
        let isDraw = true;
        let currentPos = 0;
        
        while (currentPos < cvsLimit) {
          const dashLength = lineDash[dashPos] * this.lengthScale;
          
          if (isDraw) {
            const segStart = {
              x: r.p1.x + currentPos * unitX,
              y: r.p1.y + currentPos * unitY
            };
            const segEnd = {
              x: r.p1.x + Math.min(currentPos + dashLength, cvsLimit) * unitX,
              y: r.p1.y + Math.min(currentPos + dashLength, cvsLimit) * unitY
            };
            this.segmentCache.push({ 
              s: { p1: segStart, p2: segEnd }, 
              color 
            });
          }
          
          currentPos += dashLength;
          dashPos = (dashPos + 1) % lineDash.length;
          isDraw = !isDraw;
        }
      } else {
        this.rayCache.push({ r, color });
      }
    }
    
    // If cache is too large, flush immediately
    if (this.rayCache.length >= FloatColorRenderer.MAX_CACHE_SIZE || 
        this.segmentCache.length >= FloatColorRenderer.MAX_CACHE_SIZE ||
        this.arrowCache.length >= FloatColorRenderer.MAX_CACHE_SIZE) {
      this.flush();
    }
  }

  drawDashedSegment(s, color, lineDash) {
    const dx = s.p2.x - s.p1.x;
    const dy = s.p2.y - s.p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 1e-5 * this.lengthScale) {
      return;
    }

    const unitX = dx / length;
    const unitY = dy / length;
    
    let dashPos = 0;
    let isDraw = true;
    let currentPos = 0;
    
    while (currentPos < length) {
      const dashLength = lineDash[dashPos] * this.lengthScale;
      const remainingLength = length - currentPos;
      
      if (isDraw) {
        const segStart = {
          x: s.p1.x + currentPos * unitX,
          y: s.p1.y + currentPos * unitY
        };
        const segEnd = {
          x: s.p1.x + Math.min(currentPos + dashLength, length) * unitX,
          y: s.p1.y + Math.min(currentPos + dashLength, length) * unitY
        };
        this.segmentCache.push({ 
          s: { p1: segStart, p2: segEnd }, 
          color 
        });
      }
      
      currentPos += dashLength;
      dashPos = (dashPos + 1) % lineDash.length;
      isDraw = !isDraw;
      
      if (currentPos >= length) break;
    }
  }

  drawSegment(s, color = [0, 0, 0, 1], showArrow = false, lineDash = []) {
    const dx = s.p2.x - s.p1.x;
    const dy = s.p2.y - s.p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 1e-5 * this.lengthScale) {
      return;
    }

    const arrowSize = Math.min(length * 0.15, 5 * this.lengthScale);
    const arrowPosition = 0.67;

    if (showArrow && arrowSize >= this.lengthScale * 1.2) {
      const unitX = dx / length;
      const unitY = dy / length;

      // Calculate arrow position
      const arrowX = s.p1.x + dx * arrowPosition;
      const arrowY = s.p1.y + dy * arrowPosition;

      // Draw first part (from start to arrow)
      const firstSegment = {
        p1: s.p1,
        p2: {
          x: arrowX - arrowSize/2 * unitX,
          y: arrowY - arrowSize/2 * unitY
        }
      };

      if (lineDash && lineDash.length > 0) {
        this.drawDashedSegment(firstSegment, color, lineDash);
      } else {
        this.segmentCache.push({ s: firstSegment, color });
      }

      // Add arrow
      const perpX = -unitY;
      const perpY = unitX;
      const baseWidth = this.lengthScale;
      const tipWidth = arrowSize;

      this.arrowCache.push({
        points: [
          // Front points (wide part)
          arrowX - arrowSize/2 * unitX - (tipWidth/2) * perpX,
          arrowY - arrowSize/2 * unitY - (tipWidth/2) * perpY,
          arrowX - arrowSize/2 * unitX + (tipWidth/2) * perpX,
          arrowY - arrowSize/2 * unitY + (tipWidth/2) * perpY,
          // Back points (narrow part)
          arrowX + arrowSize/2 * unitX + (baseWidth/2) * perpX,
          arrowY + arrowSize/2 * unitY + (baseWidth/2) * perpY,
          arrowX + arrowSize/2 * unitX - (baseWidth/2) * perpX,
          arrowY + arrowSize/2 * unitY - (baseWidth/2) * perpY
        ],
        color
      });

      // Draw second part (from arrow to end)
      const secondSegment = {
        p1: {
          x: arrowX + arrowSize/2 * unitX,
          y: arrowY + arrowSize/2 * unitY
        },
        p2: s.p2
      };

      if (lineDash && lineDash.length > 0) {
        this.drawDashedSegment(secondSegment, color, lineDash);
      } else {
        this.segmentCache.push({ s: secondSegment, color });
      }
    } else {
      // Draw without arrow
      if (lineDash && lineDash.length > 0) {
        this.drawDashedSegment(s, color, lineDash);
      } else {
        this.segmentCache.push({ s, color });
      }
    }
    
    // If cache is too large, flush immediately
    if (this.segmentCache.length >= FloatColorRenderer.MAX_CACHE_SIZE ||
        this.arrowCache.length >= FloatColorRenderer.MAX_CACHE_SIZE) {
      this.flush();
    }
  }

  flush() {
    if (!this.rayProgram || !this.quadProgram || !this.pointProgram) {
      return;
    }

    const gl = this.gl;
    const canvas = gl.canvas;

    // First pass: render rays to floating point texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Only clear on first use
    if (!this.hasFirstFlush) {
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.hasFirstFlush = true;
    }
    
    // Enable additive blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    // Draw points
    if (this.pointCache.length > 0) {
      gl.useProgram(this.pointProgram);
      
      // Set shared uniforms
      gl.uniform2f(this.pointResolutionUniformLocation, canvas.width, canvas.height);
      gl.uniform2f(this.pointOriginUniformLocation, this.origin.x, this.origin.y);
      gl.uniform1f(this.pointScaleUniformLocation, this.scale);

      // Bind point vertices
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
      gl.enableVertexAttribArray(this.pointPositionAttributeLocation);
      gl.vertexAttribPointer(this.pointPositionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

      // Draw each point
      this.pointCache.forEach(({ p, color, size }) => {
        const [r, g, b, a] = color;
        gl.uniform2f(this.pointPositionUniformLocation, p.x, p.y);
        gl.uniform1f(this.pointSizeUniformLocation, size * this.lengthScale);
        gl.uniform4f(this.pointColorUniformLocation, r * a, g * a, b * a, 1.0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    }

    // Draw rays and segments
    gl.useProgram(this.rayProgram);

    // Set shared uniforms
    gl.uniform2f(this.resolutionUniformLocation, canvas.width, canvas.height);
    gl.uniform2f(this.originUniformLocation, this.origin.x, this.origin.y);
    gl.uniform1f(this.scaleUniformLocation, this.scale);

    // Use the reusable line buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.enableVertexAttribArray(this.positionAttributeLocation);
    gl.vertexAttribPointer(this.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Switch to scene space for rays and segments
    gl.uniform1i(this.isScreenSpaceLocation, false);

    // Draw rays
    this.rayCache.forEach(({ r, color }) => {
      const [r_, g, b, a] = this.correctRasterizationBias(color, r.p2.x - r.p1.x, r.p2.y - r.p1.y);
      gl.uniform4f(this.colorUniformLocation, r_ * a, g * a, b * a, 1.0);

      // Calculate canvas limit for ray length
      const cvsLimit = (Math.abs(r.p1.x + this.origin.x) + Math.abs(r.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
      const rayEnd = {
        x: r.p1.x + (r.p2.x - r.p1.x) * cvsLimit,
        y: r.p1.y + (r.p2.y - r.p1.y) * cvsLimit
      };

      const vertices = this.createRectangleFromLine(r.p1, rayEnd);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    // Draw segments
    this.segmentCache.forEach(({ s, color }) => {
      const [r, g, b, a] = this.correctRasterizationBias(color, s.p2.x - s.p1.x, s.p2.y - s.p1.y);
      gl.uniform4f(this.colorUniformLocation, r * a, g * a, b * a, 1.0);

      const vertices = this.createRectangleFromLine(s.p1, s.p2);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    // Draw arrows
    if (this.arrowCache.length > 0) {
      // Use the same program as rays and points
      gl.useProgram(this.rayProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuffer);
      gl.enableVertexAttribArray(this.positionAttributeLocation);
      gl.vertexAttribPointer(this.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
      
      this.arrowCache.forEach(({ points, color }) => {
        const [r, g, b, a] = color;
        gl.uniform4f(this.colorUniformLocation, r * a, g * a, b * a, 1.0);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      });
    }

    // Second pass: render floating point texture to screen with normalization
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Disable blending for final pass
    gl.disable(gl.BLEND);
    
    gl.useProgram(this.quadProgram);

    // Bind the floating point texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.floatTexture);
    gl.uniform1i(this.textureLocation, 0);

    // Draw fullscreen quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.quadPositionLocation);
    gl.vertexAttribPointer(this.quadPositionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Clear caches
    this.rayCache.length = 0;
    this.segmentCache.length = 0;
    this.pointCache.length = 0;
    this.arrowCache.length = 0;
  }

  createRectangleFromLine(p1, p2, width = 1) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 1e-5 * this.lengthScale) {
      return new Float32Array(0);
    }

    // Calculate unit vectors
    const unitX = dx / length;
    const unitY = dy / length;
    const perpX = -unitY * (width * this.lengthScale / 2);
    const perpY = unitX * (width * this.lengthScale / 2);

    // Create rectangle vertices
    return new Float32Array([
      // First triangle
      p1.x + perpX, p1.y + perpY,
      p1.x - perpX, p1.y - perpY,
      p2.x + perpX, p2.y + perpY,
      // Second triangle
      p2.x + perpX, p2.y + perpY,
      p1.x - perpX, p1.y - perpY,
      p2.x - perpX, p2.y - perpY
    ]);
  }

  // Utility function to correct rasterization bias based on ray direction
  correctRasterizationBias(color, dx, dy) {
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return color;
    
    // Calculate correction factor based on direction
    // For diagonal lines (45 degrees), the correction is sqrt(2)
    // For horizontal/vertical lines, the correction is 1
    const correctionFactor = length / Math.max(Math.abs(dx), Math.abs(dy));
    
    return color//.map(component => component * correctionFactor);
  }

  destroy() {
    const gl = this.gl;
    
    // Delete buffers
    gl.deleteBuffer(this.lineBuffer);
    gl.deleteBuffer(this.pointBuffer);
    gl.deleteBuffer(this.arrowBuffer);
    gl.deleteBuffer(this.quadBuffer);
    
    // Delete textures
    gl.deleteTexture(this.floatTexture);
    
    // Delete framebuffer
    gl.deleteFramebuffer(this.framebuffer);
    
    // Delete shader programs
    gl.deleteProgram(this.rayProgram);
    gl.deleteProgram(this.pointProgram);
    gl.deleteProgram(this.quadProgram);
  }

  applyColorTransformation() {
    // Stub for applyColorTransformation
  }

  static MAX_CACHE_SIZE = 500;
}

export default FloatColorRenderer;
