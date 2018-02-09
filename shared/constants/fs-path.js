// This file is adapted from node.js path module source code, with following
// license:
//
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// @flow
import {stringToPath, pathToString, type Path} from './types/fs'

function normalizeStringPosix(path, allowAboveRoot) {
  var res = ''
  var lastSegmentLength = 0
  var lastSlash = -1
  var dots = 0
  var code
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i)
    else if (code === 47 /* / */) break
    else code = 47 /* / */
    if (code === 47 /* / */) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          res.charCodeAt(res.length - 1) !== 46 /* . */ ||
          res.charCodeAt(res.length - 2) !== 46 /* . */
        ) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf('/')
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = ''
                lastSegmentLength = 0
              } else {
                res = res.slice(0, lastSlashIndex)
                lastSegmentLength = res.length - 1 - res.lastIndexOf('/')
              }
              lastSlash = i
              dots = 0
              continue
            }
          } else if (res.length === 2 || res.length === 1) {
            res = ''
            lastSegmentLength = 0
            lastSlash = i
            dots = 0
            continue
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) res += '/..'
          else res = '..'
          lastSegmentLength = 2
        }
      } else {
        if (res.length > 0) res += '/' + path.slice(lastSlash + 1, i)
        else res = path.slice(lastSlash + 1, i)
        lastSegmentLength = i - lastSlash - 1
      }
      lastSlash = i
      dots = 0
    } else if (code === 46 /* . */ && dots !== -1) {
      ++dots
    } else {
      dots = -1
    }
  }
  return res
}

export const normalize = (p: Path): Path => {
  let path = pathToString(p)

  if (path.length === 0) return '.'

  const isAbsolute = path.charCodeAt(0) === 47 /* / */
  const trailingSeparator = path.charCodeAt(path.length - 1) === 47 /* / */

  // Normalize the path
  path = normalizeStringPosix(path, !isAbsolute)

  if (path.length === 0 && !isAbsolute) path = '.'
  if (path.length > 0 && trailingSeparator) path += '/'

  if (isAbsolute) return stringToPath('/' + path)
}

export const join = (...paths: Array<Path>): Path => {
  if (paths.length === 0) return '.'
  var joined
  for (var i = 0; i < paths.length; ++i) {
    var arg = pathToString(paths[i])
    if (arg.length > 0) {
      if (joined === undefined) joined = arg
      else joined += '/' + arg
    }
  }
  if (joined === undefined) return '.'
  return normalize(stringToPath(joined))
}
