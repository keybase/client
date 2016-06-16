'use strict' // eslint-disable-line

var promise = require('bluebird')
var fs = promise.promisifyAll(require('fs'))
var path = require('path')
var root = 'json'

fs
.readdirAsync(root)
.filter(jsonOnlySkipGregor)
.map(load)
.map(analyze)
.reduce((acc, typeDefs) => acc.concat(typeDefs), [])
.then(t => t.sort())
.then(makeRpcUnionType)
.then(write)

let incomingMaps = {}

function jsonOnlySkipGregor (file) {
  return file !== 'gregor.json' && file !== "gregor_ui.json" && !!file.match(/.*\.json$/)
}

function load (file) {
  return fs.readFileAsync(path.join(root, file)).then(JSON.parse)
}

var seenTypes = {
}

function analyze (json) {
  return json.types.map(t => {
    if (seenTypes[t.name]) {
      return ''
    }

    seenTypes[t.name] = true

    switch (t.type) {
      case 'record':
        return `export type ${t.name} = ${parseRecord(t)}\n\n`
      case 'enum':
        return `export type ${t.name} =${parseEnum(t)}\n\n`
      case 'fixed':
        return `export type ${t.name} = any\n\n`
      default:
        return ''
    }
  }).concat(analyzeMessages(json))
}

function figureType (type) {
  if (!type) {
    type = 'null' // keep backwards compat with old script
  }
  if (type instanceof Array) {
    return `(${type.map(t => t ? t : 'null').join(' | ')})`
  } else if (typeof type === 'object') {
    switch (type.type) {
      case 'array':
        return `Array<${type.items}>`
      case 'map':
        return `{[key: string]: ${type.values}}`
      default:
        console.log(`Unknown type: ${type}`)
        return 'unknown'
    }
  }

  return type
}

function capitalize (s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function analyzeMessages (json) {
  return Object.keys(json.messages).map(m => {
    const message = json.messages[m]

    function params (incoming, prefix) {
      return message.request.filter(r => {
        return incoming || (r.name !== 'sessionID') // We have the engine handle this under the hood
      }).map(r => {
        return `${prefix}${r.name}${r.hasOwnProperty('default') ? '?' : ''}: ${figureType(r.type)}`
      }).join(',\n')
    }

    const name = `${json.protocol}${capitalize(m)}`
    const responseType = figureType(message.response)
    const response = `export type ${name}Result = ${responseType === 'null' ? 'void' : responseType}`

    const isNotify = message.hasOwnProperty('notify')
    let r = null
    if (!isNotify) {
      const type = (responseType === 'null') ? '' : `result: ${name}Result`
      r = `,\n    response: {
      error: (err: RPCError) => void,
      result: (${type}) => void
    }`
    } else {
      r = ` /* ,\n    response: {} // Notify call
    */`
    }

    let p = params(true, '      ')
    if (p) { p = `\n${p}\n    ` }

    incomingMaps[`keybase.1.${json.protocol}.${m}`] = `(
    params: {${p}}${r}
  ) => void`

    r = ''
    if (responseType !== 'null') {
      r = `, response: ${name}Result`
    }

    p = params(false, '    ')
    if (p) { p = `\n${p}\n  ` }

    const rpc = `export type ${name}Rpc = {
  method: '${json.protocol}.${m}',${p ? `\n  param: {${p}},` : ''}
  incomingCallMap?: incomingCallMapType,
  callback: (null | (err: ?any${r}) => void)
}`

    return [response, rpc, ''].join('\n\n')
  })
}

// Type parsing
function parseInnerType (t) {
  if (!t) {
    t = 'null' // keep backwards compat with old script
  }
  if (t.constructor === Array) {
    if (t.length === 2 && t.indexOf(null) >= 0) {
      return parseMaybe(t)
    }
    return parseUnion(t)
  } else if (t === 'null') {
    return 'void'
  }

  switch (t.type) {
    case 'record':
      return parseRecord(t)
    default:
      return figureType(t)
  }
}

function parseEnumSymbol (s) {
  var parts = s.split('_')
  return parseInt(parts.pop(), 10)
}

function parseEnum (t) {
  // Special case, we're always gui
  if (t.name === 'ClientType') {
    return ' 2 // FORCE GUI ONLY'
  }

  return parseUnion(t.symbols.map(s => `${parseEnumSymbol(s)} // ${s}`))
}

function parseMaybe (t) {
  var maybeType = t.filter(x => x !== null)[0]
  return `?${maybeType}`
}

function parseUnion (unionTypes) {
  return '\n    ' + unionTypes.map(parseInnerType).join('\n  | ')
}

function parseRecord (t) {
  if (t.typedef) {
    return t.typedef
  }

  var objectMapType = '{'

  if (t.fields.length) {
    objectMapType += '\n'
  }

  t.fields.forEach(f => {
    var innerType = parseInnerType(f.type)

    // If we have a maybe type, let's also make the key optional
    objectMapType += `  ${f.name}${(innerType[0] === '?') ? '?' : ''}: ${innerType};\n`
  })
  objectMapType += '}'

  return objectMapType
}

function makeRpcUnionType (typeDefs) {
  const rpcTypes = typeDefs.map(t => t.match(/(\w*Rpc)/g)).filter(t => t).reduce((acc, t) => acc.concat(t), []).join('\n  | ')
  const unionRpcType = `export type rpc =
    ${rpcTypes}\n\n`
  return typeDefs.concat(unionRpcType)
}

function write (typeDefs) {
  const s = fs.createWriteStream('js/flow-types.js')

  const typePrelude = `/* @flow */

// This file is auto-generated by client/protocol/Makefile.

export type int = number
export type long = number
export type double = number
export type bytes = any
export type RPCError = {
  code: number,
  desc: string
}

`

  const incomingMap = `export type incomingCallMapType = {\n` +
  Object.keys(incomingMaps).map(im => `  '${im}'?: ${incomingMaps[im]}`).join(',\n') + '\n}\n\n'
  s.write(typePrelude + typeDefs.join('') + incomingMap)
  s.close()
}
