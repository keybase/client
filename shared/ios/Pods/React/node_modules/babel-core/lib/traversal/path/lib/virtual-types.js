"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _transformationHelpersReact = require("../../../transformation/helpers/react");

var react = _interopRequireWildcard(_transformationHelpersReact);

var _types = require("../../../types");

/**
 * [Please add a description.]
 */

var t = _interopRequireWildcard(_types);

var ReferencedIdentifier = {
  types: ["Identifier", "JSXIdentifier"],
  checkPath: function checkPath(_ref, opts) {
    var node = _ref.node;
    var parent = _ref.parent;

    if (!t.isIdentifier(node, opts)) {
      if (t.isJSXIdentifier(node, opts)) {
        if (react.isCompatTag(node.name)) return false;
      } else {
        // not a JSXIdentifier or an Identifier
        return false;
      }
    }

    // check if node is referenced
    return t.isReferenced(node, parent);
  }
};

/**
 * [Please add a description.]
 */

exports.ReferencedIdentifier = ReferencedIdentifier;
var BindingIdentifier = {
  types: ["Identifier"],
  checkPath: function checkPath(_ref2) {
    var node = _ref2.node;
    var parent = _ref2.parent;

    return t.isBinding(node, parent);
  }
};

/**
 * [Please add a description.]
 */

exports.BindingIdentifier = BindingIdentifier;
var Statement = {
  types: ["Statement"],
  checkPath: function checkPath(_ref3) {
    var node = _ref3.node;
    var parent = _ref3.parent;

    if (t.isStatement(node)) {
      if (t.isVariableDeclaration(node)) {
        if (t.isForXStatement(parent, { left: node })) return false;
        if (t.isForStatement(parent, { init: node })) return false;
      }

      return true;
    } else {
      return false;
    }
  }
};

/**
 * [Please add a description.]
 */

exports.Statement = Statement;
var Expression = {
  types: ["Expression"],
  checkPath: function checkPath(path) {
    if (path.isIdentifier()) {
      return path.isReferencedIdentifier();
    } else {
      return t.isExpression(path.node);
    }
  }
};

/**
 * [Please add a description.]
 */

exports.Expression = Expression;
var Scope = {
  types: ["Scopable"],
  checkPath: function checkPath(path) {
    return t.isScope(path.node, path.parent);
  }
};

/**
 * [Please add a description.]
 */

exports.Scope = Scope;
var Referenced = {
  checkPath: function checkPath(path) {
    return t.isReferenced(path.node, path.parent);
  }
};

/**
 * [Please add a description.]
 */

exports.Referenced = Referenced;
var BlockScoped = {
  checkPath: function checkPath(path) {
    return t.isBlockScoped(path.node);
  }
};

/**
 * [Please add a description.]
 */

exports.BlockScoped = BlockScoped;
var Var = {
  types: ["VariableDeclaration"],
  checkPath: function checkPath(path) {
    return t.isVar(path.node);
  }
};

/**
 * [Please add a description.]
 */

exports.Var = Var;
var DirectiveLiteral = {
  types: ["Literal"],
  checkPath: function checkPath(path) {
    return path.isLiteral() && path.parentPath.isExpressionStatement();
  }
};

/**
 * [Please add a description.]
 */

exports.DirectiveLiteral = DirectiveLiteral;
var Directive = {
  types: ["ExpressionStatement"],
  checkPath: function checkPath(path) {
    return path.get("expression").isLiteral();
  }
};

/**
 * [Please add a description.]
 */

exports.Directive = Directive;
var User = {
  checkPath: function checkPath(path) {
    return path.node && !!path.node.loc;
  }
};

/**
 * [Please add a description.]
 */

exports.User = User;
var Generated = {
  checkPath: function checkPath(path) {
    return !path.isUser();
  }
};

/**
 * [Please add a description.]
 */

exports.Generated = Generated;
var Flow = {
  types: ["Flow", "ImportDeclaration", "ExportDeclaration"],
  checkPath: function checkPath(_ref4) {
    var node = _ref4.node;

    if (t.isFlow(node)) {
      return true;
    } else if (t.isImportDeclaration(node)) {
      return node.importKind === "type" || node.importKind === "typeof";
    } else if (t.isExportDeclaration(node)) {
      return node.exportKind === "type";
    } else {
      return false;
    }
  }
};
exports.Flow = Flow;