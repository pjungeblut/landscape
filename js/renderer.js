goog.provide('Landscape.Renderer');



/**
 * Main class for the landscape renderer.
 * Initializes the WebGL canvas and sets everything up to enable rendering.
 *
 * @param {!HTMLCanvasElement} canvas The canvas to render into.
 * @constructor
 */
Landscape.Renderer = function(canvas) {
  /**
   * @private {number} The id of the rendering loop. Rendering is done in a
   *     requestAnimationFrame loop that needs to be stopped when the context is
   *     lost.
   *     A value of 0 indicates that there is no active rendering loop. Any
   *     non-zero value may be a valid id.
   */
  this.renderingLoopId_ = 0;

  /**
   * @const @private {!HTMLCanvasElement} The canvas to render into.
   */
  this.canvas_ = canvas;
  Landscape.Renderer.setUpCanvas_.call(this);

  /**
   * @private {!Object.<string, !WebGLProgram>} The programs as defined in
   *     in Landscape.Renderer.PROGRAM_SHADERS_.
   */
  this.programs_ = {};

  /**
   * @private {!WebGLRenderingContext} The WebGL rendering context.
   */
  this.gl_ = Landscape.Renderer.setUpWebGL_.call(this);

  /**
   * @private {!Float32Array} The buffer with the grid vertices.
   */
  this.gridVertices_ = new Float32Array(0);

  /**
   * @private {!Uint16Array} The buffer with the indices for the grid triangle
   *     strips.
   */
  this.gridIndices_ = new Uint16Array(0);
};


/**
 * @private {function(this:Window, function(number) : ?) : number} Wrapper for
 *     requestAnimationFrame with vendor prefixes.
 */
Landscape.Renderer.requestAnimationFrame_ = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;


/**
 * @private {function(number)} Wrapper for cancelAnimationFrame with vendor
 *     prefixes.
 */
Landscape.Renderer.cancelAnimationFrame_ = window.cancelAnimationFrame ||
    window.mozCancelAnimationFrame;


/**
 * @private @const {!Array.<string>} The ids of the script tags containing the
 *     shaders.
 */
Landscape.Renderer.SHADER_IDS_ = [
    'wireframeVertex',
    'wireframeFragment'
];


/**
 * @private @const {!Array.<!{id: string, vertex: string, fragment: string}>}
 *     The combination of the shaders for the programs.
 */
Landscape.Renderer.PROGRAM_SHADERS_ = [
    {id: 'wireframe', vertex: 'wireframeVertex', fragment: 'wireframeFragment'},
    {id: 'mountains', vertex: 'wireframeVertex', fragment: 'wireframeFragment'}
];


/**
 * @private @const {number} The dimension of the grid in x and z direction.
 *     Since UNSIGNED_SHORT is used in the element array buffer, the grid can't
 *     contain more than 2^16 vertices. Thus, the dimension should be less then
 *     2^8.
 *     With extension OES_element_index_uint UNSIGNED_INT is added and would
 *     allow up to 2^16 indices. But most probably this would kill the
 *     performance anyway.
 */
Landscape.Renderer.GRID_DIMENSION_ = 20;


/**
 * Sets up the canvas for use. Handles context loss.
 *
 * @this {!Landscape.Renderer}
 * @private
 */
Landscape.Renderer.setUpCanvas_ = function() {
  // The GPU is a shared resource, the WebGL context can be lost. In this
  // case, everything needs to be set up again.
  // For more detail: https://www.khronos.org/webgl/wiki/HandlingContextLost

  // Prevent the default in this case to save the page from crashing.
  // Also stop the rendering loop to avoid errors.
  this.canvas_.addEventListener('webglcontextlost', function(event) {
    event.preventDefault();
    if (this.renderingLoopId_ !== 0) {
      Landscape.Renderer.cancelAnimationFrame_(this.renderingLoopId_);
    }
  }.bind(this), false);

  // Re-setup the whole WebGL.
  this.canvas_.addEventListener('webglcontextrestored', function() {
    this.gl_ = Landscape.Renderer.setUpWebGL_();
    this.startRendering();
  }.bind(this), false);
};


/**
 * Initializes WebGL. Gets the WebGL context, compiles shaders and creates
 * programs.
 *
 * Throws an error, if the WebGL context could not be created.
 *
 * @return {!WebGLRenderingContext} The WebGL context.
 * @this {!Landscape.Renderer}
 * @private
 */
Landscape.Renderer.setUpWebGL_ = function() {
  // Configuring the WebGL context.
  var attributes = {
    alpha: true,
    depth: true,
    stencil: false,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false
  };

  // Gets the WebGL context.
  var gl = /** @type{!WebGLRenderingContext} */ (
      this.canvas_.getContext('webgl', attributes) ||
      this.canvas_.getContext('experimental-webgl', attributes));
  if (!gl) {
    throw new Error('Could not get a WebGL context.');
  }

  // The routines to compile shaders and link programs throw errors if they
  // fail. In this case all shaders/program already created successfully need
  // to be deleted.
  try {
    // Enables the required extensions.
    // Wireframe rendering needs the OES_standard_derivates extension to avoid
    // aliasing effects.
    Landscape.Renderer.enableExtension_(gl, 'OES_standard_derivatives');

    // Compiles the shaders.
    var shaders = {};
    for (var i = 0; i < Landscape.Renderer.SHADER_IDS_.length; i++) {
      var id = Landscape.Renderer.SHADER_IDS_[i];
      var shader = Landscape.Renderer.createShaderFromScript_(gl, id);
      shaders[id] = shader;
    }

    // Combines shaders to the programs.
    for (var i = 0; i < Landscape.Renderer.PROGRAM_SHADERS_.length; i++) {
      var id = Landscape.Renderer.PROGRAM_SHADERS_[i].id;
      var vertex = shaders[Landscape.Renderer.PROGRAM_SHADERS_[i].vertex];
      var fragment = shaders[Landscape.Renderer.PROGRAM_SHADERS_[i].fragment];
      var program = Landscape.Renderer.createProgram_(gl, vertex, fragment);
      this.programs_[id] = program;
    }
  } catch (e) {
    // There was an error when creating a shader/a program.
    // Deletes all shaders and programs.
    for (var shader in shaders) {
      gl.deleteShader(shaders[shader]);
    }
    for (var program in this.programs_) {
      gl.deleteProgram(this.programs_[program]);
    }

    // Throw the error again to stop the program without any memory leaking.
    throw new Error(e.message);
  }

  return gl;
};


/**
 * Enables a WebGL extension.
 *
 * Throws an error, if the extension is not available.
 *
 * @param {!WebGLRenderingContext} gl The WebGL context.
 * @param {string} extension The name of the extension.
 * @private
 */
Landscape.Renderer.enableExtension_ = function(gl, extension) {
  var ext = gl.getExtension(extension);
  if (!ext) {
    throw new Error('Could not load extension: ' + extension);
  }
};


/**
 * Creates a shader object from a script tag.
 *
 * The type of the script tag determines the type of the shader.
 *   x-shader/x-vertex => Vertex Shader
 *   x-shader/x-fragment => Fragment Shader
 *
 * Throws an error, if there is no script with the specified id or if the shader
 * type could not be determined.
 *
 * @param {!WebGLRenderingContext} gl The WebGL context.
 * @param {string} scriptId The id if the script tag to read the shader from.
 * @return {!WebGLShader}
 * @private
 */
Landscape.Renderer.createShaderFromScript_ = function(gl, scriptId) {
  // Reads the shader code.
  var shaderScript = document.getElementById(scriptId);
  if (!shaderScript) {
    throw new Error('Could not find script with id \'' + scriptId + '\' ' +
        'containing shader code');
  }
  var shaderSource = shaderScript.text;

  // Determines the shader type.
  var shaderType;
  if (shaderScript.type === 'x-shader/x-vertex') {
    shaderType = gl.VERTEX_SHADER;
  } else if (shaderScript.type === 'x-shader/x-fragment') {
    shaderType = gl.FRAGMENT_SHADER;
  } else {
    throw new Error('The shader script with if \'' + scriptId + '\' does ' +
        'not contain a valid type for the shader.');
  }

  // Compiles the shader.
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  // Checks, whether there was a problem during compilation.
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) &&
      !gl.isContextLost()) {
    var error = gl.getShaderInfoLog(shader);
    var message = 'Error compiling shader \'' + shader + '\': ' + error;
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
};


/**
 * Creates a WebGLProgram.
 *
 * Throws an error, if a program could not be created/linked.
 * 
 * @param {!WebGLRenderingContext} gl The WebGL context.
 * @param {!WebGLShader} vertexShader The vertex shader.
 * @param {!WebGLShader} fragmentSahder The fragment shader.
 * @return {!WebGLProgram} The program to use for the draw call.
 * @private
 */
Landscape.Renderer.createProgram_ = function(gl, vertexShader, fragmentSahder) {
  // Creates the program and attaches the shaders.
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentSahder);

  // Links the program and checks for errors.
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    var error = gl.getProgramInfoLog(program);
    var message = 'Error linking program: ' + error;
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
};


/**
 * Starts the rendering loop. Starts a requestAnimationFrame loop.
 */
Landscape.Renderer.prototype.startRendering = function() {
  // Stop any active rendering loops.
  if (this.renderingLoopId_ != 0) {
    Landscape.Renderer.cancelAnimationFrame_(this.renderingLoopId_);
  }

  // Load the buffers. They are only created once and then used in every frame.
  this.gridVertices_ = this.generateGrid_();
  this.gridIndices_ = this.generateGridIndices_();

  // Start the rendering.
  this.renderingLoopId_ = Landscape.Renderer.requestAnimationFrame_(
      this.renderFrame_.bind(this));
};


/**
 * Renders a frame.
 *
 * @param {number} timestamp The timestamp this frame was
 *     triggered.
 * @private
 */
Landscape.Renderer.prototype.renderFrame_ = function(timestamp) {
  // Resize the canvas to the current display size.
  this.resize_();

  this.drawMountains_();

  // Proceed with the next frame.
  this.renderingLoopId_ = Landscape.Renderer.requestAnimationFrame_(
      this.renderFrame_.bind(this));
};


/**
 * Resizes the WebGL context to fill the whole canvas.
 * Also takes the device pixel ratio into account. This might be a serious
 * performance killer.
 * http://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
 *
 * @private
 */
Landscape.Renderer.prototype.resize_ = function() {
  var pixelRatio = window.devicePixelRatio || 1;

  // Looks up the size the browser displays the canvas in CSS pixels and compute
  // the size needed to make the drawing buffer match it in device pixels.
  var displayWidth = Math.floor(this.gl_.canvas.clientWidth * pixelRatio);
  var displayHeight = Math.floor(this.gl_.canvas.clientHeight * pixelRatio);

  // Checks, whether the canvas is of a different size.
  if (this.gl_.canvas.width != displayWidth ||
      this.gl_.canvas.height != displayHeight) {
    // Resizes the canvas.
    this.gl_.canvas.width = displayWidth;
    this.gl_.canvas.height = displayHeight;

    // Sets the WebGL viewport.
    this.gl_.viewport(0, 0, displayWidth, displayHeight);
  }
};


Landscape.Renderer.prototype.renderWireframeRectangle = function() {
  var program = this.programs_['wireframe'];
  this.gl_.useProgram(program);

  var positionLoc = this.gl_.getAttribLocation(program, 'a_position');
  var buffer = this.gl_.createBuffer();
  this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, buffer);
  this.gl_.bufferData(
      this.gl_.ARRAY_BUFFER,
      new Float32Array([
      -0.5, -0.5,
      0.5, -0.5,
      -0.5, 0.5,
      0.5, 0.5]),
      this.gl_.STATIC_DRAW);
  this.gl_.enableVertexAttribArray(positionLoc);
  this.gl_.vertexAttribPointer(positionLoc, 2, this.gl_.FLOAT, false, 0, 0);

  var barycentricLoc = this.gl_.getAttribLocation(program, 'a_barycentric');
  var buffer2 = this.gl_.createBuffer();
  this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, buffer2);
  this.gl_.bufferData(
      this.gl_.ARRAY_BUFFER,
      new Float32Array([
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0,
        1.0, 0.0, 0.0
      ]),
      this.gl_.STATIC_DRAW);
  this.gl_.enableVertexAttribArray(barycentricLoc);
  this.gl_.vertexAttribPointer(barycentricLoc, 3, this.gl_.FLOAT, false, 0, 0);

  this.gl_.drawArrays(this.gl_.TRIANGLE_STRIP, 0, 4);
};


/**
 * Draws the mountains.
 *
 * Generates a grid in the xz plane of size GRID_DIMENSION_ * GRID_DIMENSION_.
 * The vertex shader will displace the vertices of the grid by a height map.
 *
 * @private
 */
Landscape.Renderer.prototype.drawMountains_ = function() {
  // Program 'mountains' will do the displacement mapping as well as texturing.
  var program = this.programs_['mountains'];
  this.gl_.useProgram(program);

  // Creates the vertex buffer.
  var positionLoc = this.gl_.getAttribLocation(program, 'a_position');
  var gridBuffer = this.gl_.createBuffer();
  this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, gridBuffer);
  this.gl_.bufferData(this.gl_.ARRAY_BUFFER, this.gridVertices_,
      this.gl_.STATIC_DRAW);
  this.gl_.enableVertexAttribArray(positionLoc);
  this.gl_.vertexAttribPointer(positionLoc, 2, this.gl_.FLOAT, false, 0, 0);

  // Creates the index buffer. Vertices are used several times.
  var gridIndicesBuffer = this.gl_.createBuffer();
  this.gl_.bindBuffer(this.gl_.ELEMENT_ARRAY_BUFFER, gridIndicesBuffer);
  this.gl_.bufferData(this.gl_.ELEMENT_ARRAY_BUFFER, this.gridIndices_,
      this.gl_.STATIC_DRAW);

  // Creates the buffer for the barycentric coordinates. This one won't be
  // needed anymore, as soon as texturing is done. Just for debugging.
  // TODO (pjungeblut): Remove this as soon as possible.
  var barycentricLoc = this.gl_.getAttribLocation(program, 'a_barycentric');
  var buffer2 = this.gl_.createBuffer();
  this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, buffer2);
  var barycentric = this.generateBarycentric();
  this.gl_.bufferData(this.gl_.ARRAY_BUFFER, barycentric, this.gl_.STATIC_DRAW);
  this.gl_.enableVertexAttribArray(barycentricLoc);
  this.gl_.vertexAttribPointer(barycentricLoc, 3, this.gl_.FLOAT, false, 0, 0);

  // Draws the grid. The whole grid is displayed as one triangle strip per line.
  var dimension = Landscape.Renderer.GRID_DIMENSION_;
  var verticesPerStrip = 2 * dimension + 2;
  for (var i = 0; i < dimension; i++) {
    // The offset must be a multiple of the size of UNSIGNED_SHORT, which is
    // two bytes long.
    this.gl_.drawElements(this.gl_.TRIANGLE_STRIP, verticesPerStrip,
        this.gl_.UNSIGNED_SHORT, i * verticesPerStrip * 2);
  }
};


/**
 * Generates the vertices for the grid used for the mountains.
 *
 * The grid will contain of GRID_DIMENSION_ squares in each direction, aligned
 * around the origin. Each of the squares will itself consist of two triangles.
 * The vertices will be ordered by lines from bottom to top (increasing in x).
 * Each line will be ordered from left to right (increasing y value).
 *
 * @return {!Float32Array} The vertices of the grid.
 * @private
 */
Landscape.Renderer.prototype.generateGrid_ = function() {
  var dimension = Landscape.Renderer.GRID_DIMENSION_;
  var size = 2 * (dimension + 1) * (dimension + 1);
  var array = new Float32Array(size);

  var half = dimension / 2;
  for (var i = -half, idx = 0; i <= half; i++) {
    for (var j = -half; j <= half; j++) {
      array[idx++] = j;
      array[idx++] = i;
    }
  }
  return array;
};


/**
 * Generated the grid indices for a shared vertex representation of the grids.
 * The indices will be ordered to allow the use of GRID_DIMENSION_
 * TRIANGLE_STRIPs. One for each line of the grid.
 *
 * @return {!Uint16Array} The indices to use for the grid.
 * @private
 */
Landscape.Renderer.prototype.generateGridIndices_ = function() {
  var dimension = Landscape.Renderer.GRID_DIMENSION_;
  var size = (2 * dimension + 2) * dimension;
  var array = new Uint16Array(size);

  // Create one TRIANGLE_STRIP per line of the grid, from small x to greater x.
  for (var i = 0, idx = 0; i < dimension; i++) {
    var start1 = i * (dimension + 1);
    var start2 = (i + 1) * (dimension + 1);
    array[idx++] = start1;
    array[idx++] = start2;

    for (var j = 1; j <= dimension; j++) {
      array[idx++] = start1 + j;
      array[idx++] = start2 + j;
    }
  }

  return array;
};


// TODO (pjungeblut): Remove me, as soon as the grid is displayed correctly.
Landscape.Renderer.prototype.generateBarycentric = function() {
  var dimension = Landscape.Renderer.GRID_DIMENSION_;
  var size = 3 * (dimension + 1) * (dimension + 1);
  var array = new Float32Array(size);

  var possibilites = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ];

  for (var i = 0; i <= dimension; i++) {
    for (var j = 0; j <= dimension; j++) {
      var coord;
      switch(i % 3) {
        case 0:
          coord = 0;
          break;
        case 1:
          coord = 2;
          break;
        case 2:
          coord = 1;
          break;
      }
      coord = (coord + j) % 3;

      var idx = 3 * (i * (dimension + 1) + j);
      array[idx] = possibilites[3 * coord];
      array[idx + 1] = possibilites[3 * coord + 1];
      array[idx + 2] = possibilites[3 * coord + 2];
    }
  }

  return array;
};
