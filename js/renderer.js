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
   * @private {!WebGLRenderingContext} The WebGL rendering context.
   */
  this.gl_ = Landscape.Renderer.setUpWebGL_.call(this);
};


/**
 * @type {function(this:Window, function(number) : ?) : number} Wrapper for
 *     requestAnimationFrame with vendor prefixes.
 */
Landscape.Renderer.requestAnimationFrame = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;


/**
 * @type {function(number)} Wrapper for cancelAnimationFrame with vendor
 *     prefixes.
 */
Landscape.Renderer.cancelAnimationFrame = window.cancelAnimationFrame ||
    window.mozCancelAnimationFrame;


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
      Landscape.Renderer.cancelAnimationFrame(this.renderingLoopId_);
    }
  }.bind(this), false);

  // Re-setup the whole WebGL.
  this.canvas_.addEventListener('webglcontextrestored', function() {
    this.gl_ = Landscape.Renderer.setUpWebGL_();
    // TODO (pjungeblut): Rendering loop needs to be restarted.
  }, false);
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

  // TODO (pjungeblut): Compile shaders, create programs.

  return gl;
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
 * Starts the rendering loop. Sets up a requestAnimationFrame loop.
 */
Landscape.Renderer.prototype.startRendering = function() {
  // TODO (pjungeblut): Start the rendering loop.
};
