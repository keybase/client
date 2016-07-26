/* eslint-disable no-native-reassign */

// __DEV__
//  set by react-native to true if the app is being run in a simulator, false otherwise

// __PROD__
//  set opposite of __DEV__

// __SCREENSHOT__
//  indicates if the execution environment is visdiff
//  set to false if it isn't already set
if (typeof __SCREENSHOT__ === 'undefined') {
  __SCREENSHOT__ = false
}

// Needed for purepack
window.Buffer = require('buffer').Buffer
