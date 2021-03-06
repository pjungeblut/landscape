goog.provide('Landscape');

goog.require('Landscape.Controls');
goog.require('Landscape.Renderer');


/**
 * @const {string} The ID of the canvas to render into.
 */
Landscape.CANVAS_ID = 'landscapeCanvas';

// Initializes the renderer and the controls.
(function() {
  'use strict';

  /**
   * Gets the canvas to render to from the DOM. Throws an error, if there is no
   * canvas with ID Landscape.CANVAS_ID in the DOM.
   *
   * @return {!HTMLCanvasElement} The canvas to render into.
   */
  function getCanvas() {
    var canvas = document.getElementById(Landscape.CANVAS_ID);
    if (!canvas) {
      throw new Error('Could not find canvas with id \'' +
          Landscape.CANVAS_ID + '\' in the DOM.');
    }
    return /** @type {!HTMLCanvasElement} */ (canvas);
  }

  // Starts everything.
  window.addEventListener('load', function() {
    var controls = new Landscape.Controls();
    var renderer = new Landscape.Renderer(controls, getCanvas());
    renderer.startRendering();
  });
})();