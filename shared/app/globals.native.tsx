/* eslint-disable no-native-reassign, no-global-assign, no-extend-native */
// >>>>>>>>>>>>>>>>>>>>>>>      DO NOT REORDER ANYTHING in this file      <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
// This is supposed to bootstrap / polyfill / fixup the app. Do NOT add things here or change things unless you really know
// what's happening
//
// Needed for purepack
// @ts-ignore
globalThis.buffer = global.Buffer = window.Buffer = require('buffer/').Buffer
// const {NativeModules} = require('react-native')

// __STORYBOOK__
// if we're in storybook mode
// if (typeof __STORYBOOK__ === 'undefined') {
//   __STORYBOOK__ = (NativeModules.Storybook && NativeModules.Storybook.isStorybook) || false
// }
__STORYBOOK__ = false

// We don't storyshot RN
__STORYSHOT__ = false

require('./preload.native')
