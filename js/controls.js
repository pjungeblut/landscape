goog.provide('Landscape.Controls');



/**
 * Manges the control panel to set the parameters.
 * @constructor
 */
Landscape.Controls = function() {
};


/**
 * @private @const {string} The id of the slider with the x coordinate of the
 *     camera position.
 */
Landscape.Controls.CAMERY_X_ID_ = 'camerax';


/**
 * @private @const {string} The id of the slider with the y coordinate of the
 *     camera position.
 */
Landscape.Controls.CAMERY_Y_ID_ = 'cameray';


/**
 * @private @const {string} The id of the slider with the z coordinate of the
 *     camera position.
 */
Landscape.Controls.CAMERY_Z_ID_ = 'cameraZ';


/**
 * Fetches an element from the DOM by its id.
 *
 * @param {string} id The id of the element in the DOM.
 * @return {!HTMLElement} The element.
 * @private
 */
Landscape.Controls.getElement_ = function(id) {
  var element = document.getElementById(id);
  if (!element) {
    throw new Error('Couldn\'t find element with id \'' + id + '\' in the ' +
        'DOM.');
  }
  return element;
};
