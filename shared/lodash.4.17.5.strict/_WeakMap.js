var getNative = require('./_getNative'),
    root = require('./_root');

'use strict';

/* Built-in method references that are verified to be native. */
var WeakMap = getNative(root, 'WeakMap');

module.exports = WeakMap;
