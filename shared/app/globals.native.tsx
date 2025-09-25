// >>>>>>>>>>>>>>>>>>>>>>>      DO NOT REORDER ANYTHING in this file      <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
// This is supposed to bootstrap / polyfill / fixup the app. Do NOT add things here or change things unless you really know
// what's happening
import type Immer from 'immer'
global.__FILE_SUFFIX__ = ''
global.__PROFILE__ = false
global.__HOT__ = false
const immer = require('immer') as typeof Immer
immer.enableMapSet()
import '../util/why-did-you-render'
