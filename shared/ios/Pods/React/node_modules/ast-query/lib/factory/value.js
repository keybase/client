'use strict';
var acorn = require('acorn-jsx');
var escodegen = require('escodegen-wallaby');
var Literal = require('../nodes/Literal.js');
var ObjectExpression = require('../nodes/ObjectExpression.js');
var FunctionExpression = require('../nodes/FunctionExpression.js');
var ArrayExpression = require('../nodes/ArrayExpression.js');

var esprimaOptions = {
  comment: true,
  range: true,
  loc: false,
  tokens: true,
  raw: false
};

var acornOptions = {
  ranges: true
};

/**
 * Create a value node from a value string
 * @param  {String} valStr Value string
 * @return {Object}        Value node
 */
exports.create = function (valStr) {
  this.comments = [];
  this.tokens = [];
  acornOptions.onComment = this.comments;
  acornOptions.onToken = this.tokens;
  var tree = acorn.parse('var astValFactory = ' + valStr, acornOptions);
  tree = escodegen.attachComments(tree, this.comments, this.tokens);
  return tree.body[0].declarations[0].init;
};

/**
 * Wrap a value node in a relevant type helper.
 * @param  {Object} node AST node
 * @return {Object}      Wrapped node
 */
exports.wrap = function (node) {
  if (node.type === 'Literal') {
    return new Literal(node);
  }
  if (node.type === 'ObjectExpression') {
    return new ObjectExpression(node);
  }
  if (node.type === 'FunctionExpression') {
    return new FunctionExpression(node);
  }
  if (node.type === 'ArrayExpression') {
    // Prewrap the elements so it isn't consider a list of node
    return new ArrayExpression([node]);
  }
  return node;
};
