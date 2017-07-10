// @flow
/* eslint-disable no-native-reassign, no-global-assign, no-extend-native */
import 'core-js/es6/reflect' // required for babel-plugin-transform-builtin-extend in RN iOS and Android

// __DEV__
//  set by react-native to true if the app is being run in a simulator, false otherwise

// __PROD__
//  set opposite of __DEV__

// __STORYBOOK__
// if we're in storybook mode
if (typeof __STORYBOOK__ === 'undefined') {
  __STORYBOOK__ = false
}

// __SCREENSHOT__
//  indicates if the execution environment is visdiff
//  set to false if it isn't already set
if (typeof __SCREENSHOT__ === 'undefined') {
  __SCREENSHOT__ = false
}

// Needed for purepack
window.Buffer = require('buffer').Buffer

// Native String.startswith() sometimes incorrectly returns false on Android!
// See https://github.com/facebook/react-native/issues/11370 for a report.
// $FlowIssue redefining startsWith
String.prototype.startsWith = function(searchString, position) {
  position = position || 0
  return this.substr(position, searchString.length) === searchString
}
