/* eslint-disable no-global-assign */
// >>>>>>>>>>>>>>>>>>>>>>>      DO NOT REORDER ANYTHING in this file      <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
// This is supposed to bootstrap / polyfill / fixup the app. Do NOT add things here or change things unless you really know
// what's happening
//
// Needed for purepack
// @ts-ignore
globalThis.buffer = global.Buffer = window.Buffer = require('buffer/').Buffer
__FILE_SUFFIX__ = ''
__PROFILE__ = false
__HOT__ = false
