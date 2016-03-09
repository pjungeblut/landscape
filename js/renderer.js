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
  Landscape.Renderer.setUpCanvas.call(this, canvas);
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
 * @param {!HTMLCanvasElement} canvas The canvas to set up.
 * @this {!Landscape.Renderer}
 */
Landscape.Renderer.setUpCanvas = function(canvas) {
  // The GPU is a shared resource, the WebGL context can be lost. In this
  // case, everything needs to be set up again.
  // For more detail: https://www.khronos.org/webgl/wiki/HandlingContextLost

  // Prevent the default in this case to save the page from crashing.
  // Also stop the rendering loop to avoid errors.
  canvas.addEventListener('webglcontextlost', function(event) {
    event.preventDefault();
    if (this.renderingLoopId_ !== 0) {
      Landscape.Renderer.cancelAnimationFrame(this.renderingLoopId_);
    }
  }.bind(this), false);

  // Re-setup the whole WebGL.
  canvas.addEventListener('webglcontextrestored', function() {
    // TODO (pjungeblut): Re-Setup everything.
  }, false);
};


/**
 * Starts the rendering loop. Sets up a requestAnimationFrame loop.
 */
Landscape.Renderer.prototype.startRendering = function() {
  // TODO (pjungeblut): Start the rendering loop.
};
