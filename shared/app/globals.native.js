// @flow
/* eslint-disable no-native-reassign, no-global-assign, no-extend-native */
// >>>>>>>>>>>>>>>>>>>>>>>      DO NOT REORDER ANYTHING in this file      <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
// This is supposed to bootstrap / polyfill / fixup the app. Do NOT add things here or change things unless you really know
// what's happening
//
require('core-js/es6/reflect') // required for babel-plugin-transform-builtin-extend in RN iOS and Android
// Needed for purepack
window.Buffer = require('buffer').Buffer
const {NativeModules} = require('react-native')

// __STORYBOOK__
// if we're in storybook mode
if (typeof __STORYBOOK__ === 'undefined') {
  __STORYBOOK__ = (NativeModules.Storybook && NativeModules.Storybook.isStorybook) || false
}

// __SCREENSHOT__
//  indicates if the execution environment is visdiff
//  set to false if it isn't already set
if (typeof __SCREENSHOT__ === 'undefined') {
  __SCREENSHOT__ = false
}

// Native String.startswith() sometimes incorrectly returns false on Android!
// See https://github.com/facebook/react-native/issues/11370 for a report.
// $FlowIssue redefining startsWith
String.prototype.startsWith = function(searchString, position) {
  position = position || 0
  return this.substr(position, searchString.length) === searchString
}

require('../dev/user-timings')
