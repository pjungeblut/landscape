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
 * @private {!Array.<string>} The ids of the script tags containing the shaders.
 */
Landscape.Renderer.SHADER_IDS_ = [
    'wireframeVertex',
    'wireframeFragment'];


/**
 * @private {!Array.<!{id: string, vertex: string, fragment: string}>} The
 *     combination of the shaders for the programs.
 */
Landscape.Renderer.PROGRAM_SHADERS_ = [
    {id: 'wireframe', vertex: 'wireframeVertex', fragment: 'wireframeFragment'}];


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
      var shader = Landscape.Renderer.createShaderFromScript(gl, id);
      shaders[id] = shader;
    }

    // Combines shaders to the programs.
    for (var i = 0; i < Landscape.Renderer.PROGRAM_SHADERS_.length; i++) {
      var id = Landscape.Renderer.PROGRAM_SHADERS_[i].id;
      var vertex = shaders[Landscape.Renderer.PROGRAM_SHADERS_[i].vertex];
      var fragment = shaders[Landscape.Renderer.PROGRAM_SHADERS_[i].fragment];
      var program = Landscape.Renderer.createProgram(gl, vertex, fragment);
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
 */
Landscape.Renderer.createShaderFromScript = function(gl, scriptId) {
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
 */
Landscape.Renderer.createProgram = function(gl, vertexShader, fragmentSahder) {
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
  if (this.renderingLoopId_ != 0) {
    Landscape.Renderer.cancelAnimationFrame_(this.renderingLoopId_);
  }
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

  this.renderWireframeRectangle();

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
