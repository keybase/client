'use strict' // eslint-disable-line

var promise = require('bluebird')
var fs = promise.promisifyAll(require('fs'))
var path = require('path')
var codeGenerators = require('./js-code-generators.js')

var projects = {
  "chat1" : {
    root: './json/chat1',
    import: "import * as gregor1 from './flow-types-gregor'\nimport * as keybase1 from './flow-types'",
    out: 'js/flow-types-chat.js',
    incomingMaps: {},
    seenTypes: {},
    enums : {},
  },
  "keybase1" : {
    root: 'json/keybase1',
    out: 'js/flow-types.js',
    import: "import * as gregor1 from './flow-types-gregor'\n",
    incomingMaps: {},
    seenTypes: {},
    enums : {},
  },
  "gregor1" : {
    root: './json/gregor1',
    out: 'js/flow-types-gregor.js',
    incomingMaps: {},
    seenTypes: {},
    enums : {},
  },
}

const reduceArray = arr => arr.reduce((acc, cur) => acc.concat(cur), [])

Object.keys(projects).forEach( key => {
  const project = projects[key]
  fs.readdirAsync(project.root)
  .filter(jsonOnly)
  .map(file => load(file, project))
  .map(json => analyze(json, project))
  .reduce((acc, typeDefs) => acc.concat(typeDefs), [])
  .then(t => t.filter(key => key && key.length))
  .then(t => t.sort())
  .then(makeRpcUnionType)
  .then(typeDefs => write(typeDefs, project))
})

function jsonOnly (file) {
  return !!file.match(/.*\.json$/)
}

function load (file, project) {
  return fs.readFileAsync(path.join(project.root, file)).then(JSON.parse)
}

function analyze (json, project) {
  return reduceArray([].concat(
    analyzeEnums(json, project),
    analyzeTypes(json, project),
    analyzeMessages(json, project)
  ))
}

function fixCase (s) {
  return s.toLowerCase().replace(/(_\w)/g, s => capitalize(s[1]))
}

function analyzeEnums (json, project) {
  return json.types.filter(t => t.type === 'enum').map(t => {
    var en = {}

    t.symbols.forEach(function (s) {
      const parts = s.split('_')
      const val = parseInt(parts.pop(), 10)
      const name = fixCase(parts.join('_'))
      en[name] = val
    })

    project.enums[t.name] = en

    return {
      name: `${capitalize(json.protocol)}${t.name}`,
      map: en,
    }
  }).reduce((acc, t) => {
    return acc.concat([
      `export const ${t.name} = {
  ${Object.keys(t.map).map(k => {
    return `${k}: ${t.map[k]}` // eslint-disable-line
  }).join(',\n  ')},
}`,
    ])
  }, [])
}

function analyzeTypes (json, project) {
  return json.types.map(t => {
    if (project.seenTypes[t.name]) {
      return null
    }

    project.seenTypes[t.name] = true

    switch (t.type) {
      case 'record':
        return [`export type ${t.name} = ${parseRecord(t)}`]
      case 'enum':
        return [`export type ${t.name} = ${parseEnum(t)}`]
      case 'variant':
        return [`export type ${t.name} = ${parseVariant(t, project)}`]
      case 'fixed':
        return [`export type ${t.name} = any`]
      default:
        return null
    }
  })
}

function figureType (type) {
  if (!type) {
    type = 'null' // keep backwards compat with old script
  }
  if (type instanceof Array) {
    if (type.length === 2) {
      if (type[0] === null) {
        return `?${type[1]}`
      }
      if (type[1] === null) {
        return `?${type[0]}`
      }
    }

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
  // ui means an incoming rpc. simple regexp to filter this but it might break in the future if
  // the core side doesn't have a consisten naming convention. (must be case insensitive to pass correctly)
  const isUIProtocol = ['notifyCtl'].indexOf(json.protocol) === -1 && !!json.protocol.match(/^notify.*|.*ui$/i)

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
    const response = responseType === 'null' ? null : `type ${name}Result = ${responseType}`

    const isNotify = message.hasOwnProperty('notify')
    let r = null
    if (!isNotify) {
      const type = (responseType === 'null') ? '' : `result: ${name}Result`
      if (type) {
        r = `,\n    response: {
      error: RPCErrorHandler,
      result: (${type}) => void,
    }`
      } else {
        r = `,\n    response: CommonResponseHandler`
      }
    } else {
      r = ` /* ,\n    response: {} // Notify call
    */`
    }

    let p = params(true, '      ')
    if (p) { p = `\n${p}\n    ` }

    if (isUIProtocol) {
      project.incomingMaps[`keybase.1.${json.protocol}.${m}`] = `(
    params: Exact<{${p}}>${r}
  ) => void`
    }

    r = ''
    if (responseType !== 'null') {
      r = `, response: ${name}Result`
    }

    p = params(false, '  ')
    if (p) { p = `\n${p}\n` }

    const paramType = p ? `export type ${name}RpcParam = Exact<{${p}}>` : ''
    const callbackType = r ? `{callback?: ?(err: ?any${r}) => void}` : 'requestErrorCallback'
    const innerParamType = p ? `{param: ${name}RpcParam}` : null
    const rpc = isUIProtocol ? '' : `export function ${name}Rpc (request: Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>) {
  engineRpcOutgoing({...request, method: '${json.protocol}.${m}'})
}`

    const rpcPromise = isUIProtocol ? '' : codeGenerators.rpcPromiseGen(name, callbackType, innerParamType, responseType)
    const rpcChannelMap = isUIProtocol ? '' : codeGenerators.rpcChannelMap(name, callbackType, innerParamType, responseType)
    return [paramType, response, rpc, rpcPromise, rpcChannelMap]
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
    objectMapType += `  ${f.name}${(innerType[0] === '?') ? '?' : ''}: ${innerType},\n`
  })
  objectMapType += '}'

  return objectMapType
}

function parseVariant (t, project) {
  var parts = t.switch.type.split(".")
  if (parts.length > 1) {
    project = projects[parts.shift()]
  }
  var type = parts.shift()
  return "\n    " + t.cases.map(c => {
    var label = fixCase(c.label.name)
    var out = `{ ${t.switch.name} : ${project.enums[type][label]}`
    if (c.body !== null) {
      out += `, ${label} : ?${c.body}`
    }
    out += ` }`
    return out
  }).join("\n  | ")
}

function makeRpcUnionType (typeDefs) {
  const rpcTypes = typeDefs.map(t => {
    const m = t.match(/(\w*Rpc) \(/)
    return m && m[1]
  })
  .filter(t => t)
  .reduce((acc, t) => {
    const clean = t.trim()
    return acc.indexOf(clean) === -1 ? acc.concat([clean]) : acc
  }, [])
  .sort()
  .join('\n  | ')

  if (rpcTypes) {
    const unionRpcType = `export type rpc =
    ${rpcTypes}`
    return typeDefs.concat(unionRpcType)
  }

  return typeDefs
}

function write (typeDefs, project) {
  // Need any for weird flow issue where it gets confused by multiple
  // incoming call map types
  const callMapType = Object.keys(project.incomingMaps).length ? 'incomingCallMapType' : 'any'
  const typePrelude = `// @flow

// This file is auto-generated by client/protocol/Makefile.
${project.import || ''}
import engine from '../../engine'
import {RPCError} from '../../util/errors'
import {putOnChannelMap, createChannelMap, closeChannelMap} from '../../util/saga'
import type {Exact} from './more'
import type {ChannelConfig, ChannelMap} from './saga'
export type int = number
export type int64 = number
export type uint = number
export type uint64 = number
export type long = number
export type double = number
export type bytes = any
export type WaitingHandlerType = (waiting: boolean, method: string, sessionID: number) => void

// $FlowIssue we're calling an internal method on engine that's there just for us
const engineRpcOutgoing = (...args) => engine()._rpcOutgoing(...args)

type requestCommon = {
  waitingHandler?: WaitingHandlerType,
  incomingCallMap?: ${callMapType},
}

type requestErrorCallback = {
  callback?: ?(err: ?RPCError) => void
}

type RPCErrorHandler = (err: RPCError) => void

type CommonResponseHandler = {
  error: RPCErrorHandler,
  result: (...rest: Array<void>) => void,
}`

  const incomingMap = `export type incomingCallMapType = Exact<{\n` +
  Object.keys(project.incomingMaps).map(im => `  '${im}'?: ${project.incomingMaps[im]}`).join(',\n') + '\n}>\n'
  const toWrite = [typePrelude, codeGenerators.channelMapPrelude, typeDefs.join('\n\n'), incomingMap].join('\n')
  fs.writeFileSync(project.out, toWrite)
}
