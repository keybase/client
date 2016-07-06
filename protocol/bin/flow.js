'use strict' // eslint-disable-line

var promise = require('bluebird')
var fs = promise.promisifyAll(require('fs'))
var path = require('path')

var projects = [
  {root: 'json', out: 'js/flow-types.js', import: "import * as gregor1 from './flow-types-gregor'\n", incomingMaps: {}, seenTypes: {}},
  {root: '../go/vendor/github.com/keybase/gregor/protocol/gregor1', out: 'js/flow-types-gregor.js', incomingMaps: {}, seenTypes: {}},
]

projects.forEach(project => {
  fs.readdirAsync(project.root)
  .filter(jsonOnlySkipGregor)
  .map(file => load(file, project))
  .map(json => analyze(json, project))
  .reduce((acc, typeDefs) => acc.concat(typeDefs), [])
  .then(t => t.sort())
  .then(makeRpcUnionType)
  .then(typeDefs => write(typeDefs, project))
})

function jsonOnlySkipGregor (file) {
  return !!file.match(/.*\.json$/)
}

function load (file, project) {
  return fs.readFileAsync(path.join(project.root, file)).then(JSON.parse)
}

function analyze (json, project) {
  return json.types.map(t => {
    if (project.seenTypes[t.name]) {
      return ''
    }

    project.seenTypes[t.name] = true

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
  }).concat(analyzeMessages(json, project))
}

function figureType (type) {
  if (!type) {
    type = 'null' // keep backwards compat with old script
  }
  if (type instanceof Array) {
    return `(${type.map(t => t || 'null').join(' | ')})`
  } else if (typeof type === 'object') {
    switch (type.type) {
      case 'array':
        return `?Array<${type.items}>`
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

function analyzeMessages (json, project) {
  return Object.keys(json.messages).map(m => {
    const message = json.messages[m]

    const params = (incoming, prefix) => (
      message.request
        .filter(r => incoming || (r.name !== 'sessionID')) // We have the engine handle this under the hood
        .map(r => {
          const rtype = figureType(r.type)
          return `${prefix}${r.name}${r.hasOwnProperty('default') || rtype.startsWith('?') ? '?' : ''}: ${rtype}`
        }).join(',\n')
    )

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

    project.incomingMaps[`keybase.1.${json.protocol}.${m}`] = `(
    params: {${p}}${r}
  ) => void`

    r = ''
    if (responseType !== 'null') {
      r = `, response: ${name}Result`
    }

    p = params(false, '    ')
    if (p) { p = `\n${p}\n  ` }

    const rpc = `export type ${name}Rpc = $Exact<{
  method: '${json.protocol}.${m}',${p ? `\n  param: {${p}},` : ''}
  waitingHandler?: (waiting: boolean, method: string, sessionID: string) => void,
  incomingCallMap?: incomingCallMapType,
  callback: (null | (err: ?any${r}) => void)
}>`

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
  if (rpcTypes) {
    const unionRpcType = `export type rpc =
    ${rpcTypes}\n\n`
    return typeDefs.concat(unionRpcType)
  }
  return typeDefs
}

function write (typeDefs, project) {
  const s = fs.createWriteStream(project.out)

  const typePrelude = `/* @flow */

// This file is auto-generated by client/protocol/Makefile.
${project.import || ''}
import type {$Exact} from './more'
export type int = number
export type int64 = number
export type long = number
export type double = number
export type bytes = any
export type RPCError = {
  code: number,
  desc: string
}

`

  const incomingMap = `export type incomingCallMapType = {\n` +
  Object.keys(project.incomingMaps).map(im => `  '${im}'?: ${project.incomingMaps[im]}`).join(',\n') + '\n}\n\n'
  s.write(typePrelude + typeDefs.join('') + incomingMap)
  s.close()
}
