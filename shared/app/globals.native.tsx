/* eslint-disable no-global-assign */
// >>>>>>>>>>>>>>>>>>>>>>>      DO NOT REORDER ANYTHING in this file      <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
// This is supposed to bootstrap / polyfill / fixup the app. Do NOT add things here or change things unless you really know
// what's happening
import 'fastestsmallesttextencoderdecoder'
import {encode as btoa, decode as atob} from 'base-64'
/* eslint-disable */
// Needs jsc 5.4+
// @ts-ignore
if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: function (obj: object, prop: PropertyKey): boolean {
      return Object.prototype.hasOwnProperty.call(obj, prop)
    },
    writable: true,
    enumerable: false,
    configurable: true,
  })
}

// Needs jsc 5.4+
// @ts-ignore
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: function <T>(this: T[], index: number): T | undefined {
      if (index < 0) {
        index = this.length + index
      }
      return this[index]
    },
    writable: true,
    enumerable: false,
    configurable: true,
  })
}

global.btoa = btoa
global.atob = atob
__FILE_SUFFIX__ = ''
__PROFILE__ = false
__HOT__ = false
/* eslint-enable */
