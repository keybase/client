'use strict'

var promise = require('bluebird')
var fs = promise.promisifyAll(require('fs'))
var path = require('path')
var root = 'json'

fs.readdirAsync(root).filter(jsonOnly).map(load).map(analyze).reduce(collectTypes, []).then(write)

var typePrelude = `/* @flow */

export type int = number
export type long = number
export type double = number
export type bytes = any
`

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

function analyzeMessages (json) {
  return Object.keys(json.messages).map(function (m) {
    const params = json.messages[m].request.map(function (r) {
      let type = seenTypes[r.type] ? `${json.protocol}_${r.type}` : r.type

      if (type instanceof Array) {
        type = `(${type.join(' | ')})`
      } else if (typeof type === 'object') {
        switch (type.type) {
          case 'array':
            type = `Array<${type.items}>`
            break
          case 'map':
            type = `{string: ${type.values}}`
            break
          default:
            console.log(`Unknown type: ${type}`)
            break
        }
      }

      return `${r.name}: ${type}`
    }).join(', ')

    return `export type ${json.protocol}_${m} = (${params}) => void;\n\n` +
      `export const ${json.protocol}_${m}_method = 'keybase.1.${json.protocol}.${m}';\n\n`
  })
}

function addFixed (namespace, t) {
  var typeDef = `export type ${namespace}${t.name} = any`
  typeDef += '\n\n'

  if (!seenTypes[t.name]) {
    seenTypes[t.name] = true
    typeDef += addFixed('', t)
  }
  return typeDef
}

function addEnum (namespace, t) {
  var typeDef = `export type ${namespace}${t.name} = `
  typeDef += parseEnum(t)
  typeDef += '\n\n'

  if (!seenTypes[t.name]) {
    seenTypes[t.name] = true
    typeDef += addEnum('', t)
  }
  return typeDef
}

function addRecord (namespace, t) {
  var typeDef = `export type ${namespace}${t.name} = `
  typeDef += parseRecord(t)
  typeDef += '\n\n'

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
  var objectMapType = '{\n'
  t.fields.forEach(function (f) {
    var innerType = parseInnerType(f.type)

    // If we have a maybe type, let's also make the key optional
    if (innerType[0] === '?') {
      objectMapType += `  ${f.name}?: ${innerType};\n`
    } else {
      objectMapType += `  ${f.name}: ${innerType};\n`
    }
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

function write (typeDefs) {
  var s = fs.createWriteStream('js/flow-types.js')
  s.write(typePrelude + typeDefs.join(''))
  s.close()
}
