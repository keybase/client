/* eslint-disable no-global-assign */
// >>>>>>>>>>>>>>>>>>>>>>>      DO NOT REORDER ANYTHING in this file      <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
// This is supposed to bootstrap / polyfill / fixup the app. Do NOT add things here or change things unless you really know
// what's happening
import 'fastestsmallesttextencoderdecoder'
import {encode as btoa, decode as atob} from 'base-64'

global.btoa = btoa
global.atob = atob
__FILE_SUFFIX__ = ''
__PROFILE__ = false
__HOT__ = false
