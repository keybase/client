'use strict'

var promise = require('bluebird')
var fs = promise.promisifyAll(require('fs'))
var path = require('path')
var root = 'json'

fs.readdirAsync(root).filter(jsonOnly).map(load).map(analyze).reduce(collectTypes, []).then(makeRpcUnionType).then(write)

var typePrelude = `/* @flow */

export type int = number
export type long = number
export type double = number
export type bytes = any

`

let incomingMaps = {}

function jsonOnly (file) {
  return !!file.match(/.*\.json$/)
}

function load (file) {
  return fs.readFileAsync(path.join(root, file)).then(JSON.parse)
}

var seenTypes = {
}

function analyze (json) {
  return json.types.map(function (t) {
    switch (t.type) {
      case 'record':
        return addRecord(`${json.protocol}_`, t)
      case 'enum':
        return addEnum(`${json.protocol}_`, t)
      case 'fixed':
        return addFixed(`${json.protocol}_`, t)
      default:
        return ''
    }
  }).concat(analyzeMessages(json))
}

function figureKBType (protocol, rawType) {
  return seenTypes[rawType] ? `${protocol}_${rawType}` : rawType
}

function figureType (protocol, rawType) {
  const type = figureKBType(protocol, rawType)

  if (type instanceof Array) {
    return `(${type.join(' | ')})`
  } else if (typeof type === 'object') {
    switch (type.type) {
      case 'array':
        return `Array<${figureKBType(protocol, type.items)}>`
      case 'map':
        return `{string: ${figureKBType(protocol, type.values)}}`
      default:
        console.log(`Unknown type: ${type}`)
        return 'unknown'
    }
  }

  return type
}

function analyzeMessages (json) {
  return Object.keys(json.messages).map(function (m) {
    const message = json.messages[m]

    function params (incoming, prefix) {
      return message.request.filter(function (r) {
        return incoming || (r.name !== 'sessionID') // We have the engine handle this under the hood
      }).map(function (r) {
        return `${prefix}${r.name}: ${figureType(json.protocol, r.type)}`
      }).join(',\n')
    }

    const name = `${json.protocol}_${m}`
    const responseType = figureType(json.protocol, message.response)
    let response = '/* void response */'
    if (responseType !== 'null') {
      response = `export type ${name}_result = ${responseType}`
    }

    const isNotify = message.hasOwnProperty('notify')
    let r = ' /* Notify call, No response */'
    if (!isNotify) {
      const type = (responseType === 'null') ? '' : `result: ${name}_result`
      r = `,\n    response: {
      error: (err: string) => void,
      result: (${type}) => void
    }`
    }

    let p = params(true, '      ')
    if (p) { p = `\n${p}\n    ` }

    incomingMaps[`keybase.1.${json.protocol}.${m}`] = `(
    params: {${p}}${r}
  ) => void`

    r = ''
    if (responseType !== 'null') {
      r = `, response: ${name}_result`
    }

    p = params(false, '    ')
    if (p) { p = `\n${p}\n  ` }

    const rpc = `export type ${name}_rpc = {
  method: '${json.protocol}.${m}',
  param: {${p}},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any${r}) => void)
}`

    return [
      `// ${json.protocol}.${m} ////////////////////////////////////////`,
      response, rpc, ''].join('\n\n')
  })
}

function addFixed (namespace, t) {
  var typeDef = `export type ${namespace}${t.name} = any\n\n`

  if (!seenTypes[t.name]) {
    seenTypes[t.name] = true
    typeDef += addFixed('', t)
  }
  return typeDef
}

function addEnum (namespace, t) {
  var typeDef = `export type ${namespace}${t.name} = ${parseEnum(t)}\n\n`

  if (!seenTypes[t.name]) {
    seenTypes[t.name] = true
    typeDef += addEnum('', t)
  }
  return typeDef
}

function addRecord (namespace, t) {
  var typeDef = `export type ${namespace}${t.name} = ${parseRecord(t)}\n\n`

  if (!seenTypes[t.name]) {
    seenTypes[t.name] = true
    typeDef += addRecord('', t)
  }

  return typeDef
}

// Type parsing
function parseInnerType (t) {
  if (t.constructor === Array) {
    if (t.length === 2 && t.indexOf('null') >= 0) {
      return parseMaybe(t)
    }
    return parseUnion(t)
  } else if (t === 'null') {
    return 'void'
  }

  switch (t.type) {
    case 'record':
      return parseRecord(t)
    case 'array':
      return parseArray(t)
    default:
      return t
  }
}

function parseEnumSymbol (s) {
  var parts = s.split('_')
  return parseInt(parts.pop(), 10)
}

function parseEnum (t) {
  // Special case, we're always gui
  if (t.name === 'ClientType') {
    return '2 /* FORCE GUI ONLY */'
  }

  return parseUnion(t.symbols.map(s => `${parseEnumSymbol(s)} /* '${s}' */`))
}

function parseMaybe (t) {
  var maybeType = t.filter(x => x !== 'null')[0]
  return `?${maybeType}`
}

function parseUnion (unionTypes) {
  return unionTypes.map(parseInnerType).join(' | ')
}

function parseRecord (t) {
  if (t.typedef) {
    return t.typedef
  }

  var objectMapType = '{'

  if (t.fields.length) {
    objectMapType += '\n'
  }

  t.fields.forEach(function (f) {
    var innerType = parseInnerType(f.type)

    // If we have a maybe type, let's also make the key optional
    objectMapType += `  ${f.name}${(innerType[0] === '?') ? '?' : ''}: ${innerType};\n`
  })
  objectMapType += '}'

  return objectMapType
}

function parseArray (t) {
  return `Array<${t.items}>`
}

function collectTypes (acc, typeDefs) {
  return acc.concat(typeDefs)
}

function makeRpcUnionType (typeDefs) {
  const rpcTypes = typeDefs.map(t => t.match(/(\w*_rpc)/g)).filter(t => t).reduce((acc, t) => acc.concat(t), []).join(' | ')
  const unionRpcType = `export type rpc = ${rpcTypes}\n\n`
  return typeDefs.concat(unionRpcType)
}

function write (typeDefs) {
  var s = fs.createWriteStream('js/flow-types.js')

  const incomingMap = `export type incomingCallMapType = {\n` +
  Object.keys(incomingMaps).map(im => `  '${im}'?: ${incomingMaps[im]}`).join(',\n') + '\n}\n\n'
  s.write(typePrelude + incomingMap + typeDefs.join(''))
  s.close()
}
