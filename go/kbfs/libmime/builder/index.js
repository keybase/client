// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

/*
 *
 * This file is adapted from github.com/jshttp/mime-db, with following LICENSE:
 * 
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Jonathan Ong me@jongleberry.com
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
*/

/**
 * Convert these text files to JSON for browser usage.
 */

global.Promise = global.Promise || loadBluebird()

var co = require('co')
var cogent = require('cogent')

/**
 * Mime types and associated extensions are stored in the form:
 *
 *   <type> <ext> <ext> <ext>;
 */
var typeLineRegExp = /^\s*([\w-]+\/[\w+.-]+)((?:\s+[\w-]+)*);\s*$/gm

co(function * () {
  var url = 'http://hg.nginx.org/nginx/raw-file/default/conf/mime.types'
  var res = yield * cogent(url, {
    string: true
  })

  if (res.statusCode !== 200) {
    throw new Error('got status code ' + res.statusCode + ' from ' + url)
  }

  var json = {}
  var match = null

  typeLineRegExp.index = 0

  while ((match = typeLineRegExp.exec(res.text))) {
    var mime = match[1]

    // parse the extensions
    var extensions = (match[2] || '')
      .split(/\s+/)
      .filter(Boolean)
    var data = json[mime] || (json[mime] = {})

    // append the extensions
    appendExtensions(data, extensions)
  }

  printGo(json)
}).then()

/**
 * Append an extension to an object.
 */
function appendExtension (obj, extension) {
  if (!obj.extensions) {
    obj.extensions = []
  }

  if (obj.extensions.indexOf(extension) === -1) {
    obj.extensions.push(extension)
  }
}

/**
 * Append extensions to an object.
 */
function appendExtensions (obj, extensions) {
  if (extensions.length === 0) {
    return
  }

  for (var i = 0; i < extensions.length; i++) {
    var extension = extensions[i]

    // add extension to the type entry
    appendExtension(obj, extension)
  }
}

/**
 * Load the Bluebird promise.
 */
function loadBluebird () {
  var Promise = require('bluebird')

  // Silence all warnings
  Promise.config({
    warnings: false
  })

  return Promise
}

function getExtensionTypePairs(types) {
  return Object.keys(types).reduce( (accu, type) => {
    types[type].extensions.forEach( (ext) => accu.push({ext, type}) )
    return accu
  }, []).sort( (a, b) => a.ext < b.ext ? -1 : a.ext === b.ext ? 0 : 1)
}

function printGo(types) {
  process.stdout.write(`// Copyright 2018 Keybase Inc. All rights reserved.\n`)
  process.stdout.write(`// Use of this source code is governed by a BSD\n`)
  process.stdout.write(`// license that can be found in the LICENSE file.\n\n`)
  process.stdout.write(`// This file is auto-generated and should not be edited by hand.\n\n`)
  process.stdout.write(`package libmime\n\n`)
  process.stdout.write(`var mimeTypes = map[string]string{\n`)
  getExtensionTypePairs(types).forEach( ({ext, type}) => {
    process.stdout.write(`\t".${ext}": "${type}",\n`)
  })
  process.stdout.write(`}\n`)
}
