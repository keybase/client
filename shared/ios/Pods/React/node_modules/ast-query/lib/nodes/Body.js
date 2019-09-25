'use strict';
var acorn = require('acorn-jsx');
var traverse = require('traverse');

/**
 * Function body node
 * @constructor
 * @private
 * @param {Object} node
 * @param {Object} acornOptions
 */
var Body = module.exports = function (node, acornOptions) {
  this.node = node;
  this.acornOptions = acornOptions;
};
Body.verbatims = {};

/**
 * Append code to the function body
 * @param  {String} code
 * @return {this}
 */
Body.prototype.append = function (code) {
  var values = postParse(acorn.parse(code, this.acornOptions).body);
  Array.prototype.push.apply(this.node, values);
  return this;
};

/**
 * Prepend code to the function body
 * @param  {String} code
 * @return {this}
 */
Body.prototype.prepend = function (code) {
  var values = postParse(acorn.parse(code, this.acornOptions).body);
  var insertionIndex = 0;
  var nodes = this.node;

  // Ensure "use strict" declaration is kept on top
  if (nodes[0] && nodes[0].expression && nodes[0].expression.type === 'Literal'
    && nodes[0].expression.value === 'use strict') {
    insertionIndex = 1;
  }

  values.forEach(function (value, index) {
    // insertionIndex + index to insert the instruction in order
    nodes.splice(insertionIndex + index, 0, value);
  });

  return this;
};

function postParse(tree) {
  var nodeValue;
  var tree = traverse(tree).map(function (node) {
    if (node && node.type === 'Literal' &&
      (nodeValue = node.value)[0] === 't' && nodeValue[1] === 'o' && nodeValue[2] === 'k') {
      if (Body.verbatims.hasOwnProperty(nodeValue)) {
        node['x-verbatim'] = Body.verbatims[nodeValue];
        Body.verbatims[nodeValue] = undefined;
      }
    }
  });
  return tree;
}