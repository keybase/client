var getNative = require('./_getNative'),
    root = require('./_root');

'use strict';

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView');

module.exports = DataView;
