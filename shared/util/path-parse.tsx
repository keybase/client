/* eslint-disable */
// copy of https://raw.githubusercontent.com/jbgutierrez/path-parse/master/index.js removing isWindows platform usage
// TODO remove all this anyways
var isWindows = KB.__process.platform === 'win32'

// Regex to split a windows path into three parts: [*, device, slash,
// tail] windows-only
var splitDeviceRe = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/

// Regex to split the tail part of the above into [*, dir, basename, ext]
var splitTailRe = /^([\s\S]*?)((?:\.{1,2}|[^\\\/]+?|)(\.[^.\/\\]*|))(?:[\\\/]*)$/

// Function to split a filename into [root, dir, basename, ext]
function win32SplitPath(filename) {
  // Separate device+slash from tail
  var result = splitDeviceRe.exec(filename),
    // @ts-ignore
    device = (result[1] || '') + (result[2] || ''),
    // @ts-ignore
    tail = result[3] || ''
  // Split the tail into dir, basename and extension
  // @ts-ignore
  var result2 = splitTailRe.exec(tail),
    // @ts-ignore
    dir = result2[1],
    // @ts-ignore
    basename = result2[2],
    // @ts-ignore
    ext = result2[3]
  return [device, dir, basename, ext]
}

const win32parse = function(pathString) {
  if (typeof pathString !== 'string') {
    throw new TypeError("Parameter 'pathString' must be a string, not " + typeof pathString)
  }
  var allParts = win32SplitPath(pathString)
  if (!allParts || allParts.length !== 4) {
    throw new TypeError("Invalid path '" + pathString + "'")
  }
  return {
    root: allParts[0],
    dir: allParts[0] + allParts[1].slice(0, -1),
    base: allParts[2],
    ext: allParts[3],
    name: allParts[2].slice(0, allParts[2].length - allParts[3].length),
  }
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/
// const posix = {}

function posixSplitPath(filename) {
  // @ts-ignore
  return splitPathRe.exec(filename).slice(1)
}

// @ts-ignore
const posixparse = function(pathString) {
  if (typeof pathString !== 'string') {
    throw new TypeError("Parameter 'pathString' must be a string, not " + typeof pathString)
  }
  var allParts = posixSplitPath(pathString)
  if (!allParts || allParts.length !== 4) {
    throw new TypeError("Invalid path '" + pathString + "'")
  }
  allParts[1] = allParts[1] || ''
  allParts[2] = allParts[2] || ''
  allParts[3] = allParts[3] || ''

  return {
    root: allParts[0],
    dir: allParts[0] + allParts[1].slice(0, -1),
    base: allParts[2],
    ext: allParts[3],
    name: allParts[2].slice(0, allParts[2].length - allParts[3].length),
  }
}

// if (isWindows) module.exports = win32.parse
// [> posix <] else module.exports = posix.parse

// module.exports.posix = posix.parse
// module.exports.win32 = win32.parse
//

const parse = isWindows ? win32parse : posixparse
export {parse}
