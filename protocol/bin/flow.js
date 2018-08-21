// @noflow
'use strict'
const prettier = require('prettier')
const promise = require('bluebird')
const fs = promise.promisifyAll(require('fs'))
const path = require('path')
const camelcase = require('camelcase')
const colors = require('colors')
const json5 = require('json5')
const enabledCalls = json5.parse(fs.readFileSync(path.join(__dirname, 'enabled-calls.json')))

var projects = {
  chat1: {
    root: './json/chat1',
    import: ['Gregor1', 'Keybase1', 'Stellar1'],
    out: 'rpc-chat-gen',
    incomingMaps: {},
    seenTypes: {},
    enums: {},
    notEnabled: [],
  },
  keybase1: {
    root: 'json/keybase1',
    out: 'rpc-gen',
    import: ['Gregor1'],
    incomingMaps: {},
    seenTypes: {},
    enums: {},
    notEnabled: [],
  },
  gregor1: {
    root: './json/gregor1',
    out: 'rpc-gregor-gen',
    import: [],
    incomingMaps: {},
    seenTypes: {},
    enums: {},
    notEnabled: [],
  },
  stellar1: {
    root: './json/stellar1',
    out: 'rpc-stellar-gen',
    import: ['Keybase1'],
    incomingMaps: {},
    seenTypes: {},
    enums: {},
    notEnabled: [],
  },
}

const reduceArray = arr => arr.reduce((acc, cur) => acc.concat(cur), [])

const keys = Object.keys(projects)
keys.forEach(key => {
  const project = projects[key]
  fs
    .readdirAsync(project.root)
    .filter(jsonOnly)
    .map(file => load(file, project))
    .map(json => analyze(json, project))
    .reduce((map, next) => {
      map.consts = {...map.consts, ...next.consts}
      map.types = {...map.types, ...next.types}
      map.messages = {...map.messages, ...next.messages}
      return map
    }, {})
    .then(typeDefs => {
      writeFlow(typeDefs, project)
      write(typeDefs, project)
    })
})

function jsonOnly(file) {
  return !!file.match(/.*\.json$/)
}

function load(file, project) {
  return fs.readFileAsync(path.join(project.root, file)).then(JSON.parse)
}

function analyze(json, project) {
  lintJSON(json)
  return {
    consts: analyzeEnums(json, project),
    types: analyzeTypes(json, project),
    messages: analyzeMessages(json, project),
  }
}

function fixCase(s) {
  return s.toLowerCase().replace(/(_\w)/g, s => capitalize(s[1]))
}

function analyzeEnums(json, project) {
  return json.types
    .filter(t => t.type === 'enum')
    .map(t => {
      var en = {}

      t.symbols.forEach(s => {
        const parts = s.split('_')
        const val = parseInt(parts.pop(), 10)
        const name = fixCase(parts.join('_'))
        en[name] = val
      })

      project.enums[t.name] = en

      return {
        name: `${json.protocol}${t.name}`,
        map: en,
      }
    })
    .reduce((map, t) => {
      map[decapitalize(t.name)] = `\nexport const ${decapitalize(t.name)} = {
  ${Object.keys(t.map)
    .map(k => `${k}: ${t.map[k]}`)
    .join(',\n  ')},
}`
      return map
    }, {})
}

function analyzeTypes(json, project) {
  return json.types.reduce((map, t) => {
    if (project.seenTypes[t.name]) {
      return map
    }

    project.seenTypes[t.name] = true

    switch (t.type) {
      case 'record':
        map[t.name] = `export type ${t.name} = ${parseRecord(t)}`
        break
      case 'enum':
        map[t.name] = `export type ${t.name} =${parseEnum(t)}`
        break
      case 'variant':
        {
          const parsed = parseVariant(t, project)
          if (parsed) {
            map[t.name] = `export type ${t.name} =${parsed}`
          }
        }
        break
      case 'fixed':
        map[t.name] = `export type ${t.name} = ?string`
        break
    }
    return map
  }, {})
}

function figureType(type, prefix = '') {
  if (!type) {
    return 'null' // keep backwards compat with old script
  }
  if (type instanceof Array) {
    if (type.length === 2) {
      if (type[0] === null) {
        return `?${prefix}${capitalize(type[1])}`
      }
      if (type[1] === null) {
        return `?${prefix}${capitalize(type[0])}`
      }
    }

    return `(${type.map(t => t || 'null').join(' | ')})`
  } else if (typeof type === 'object') {
    switch (type.type) {
      case 'array':
        return `?Array<${prefix}${capitalize(type.items)}>`
      case 'map':
        return `{[key: string]: ${figureType(type.values)}}`
      default:
        console.log(`Unknown type: ${type}`)
        return 'unknown'
    }
  }

  return prefix + capitalize(type)
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function analyzeMessages(json, project) {
  // ui means an incoming rpc. simple regexp to filter this but it might break in the future if
  // the core side doesn't have a consistent naming convention. (must be case insensitive to pass correctly)
  const isUIProtocol =
    ['notifyCtl'].indexOf(json.protocol) === -1 &&
    !!json.protocol.match(/^(notify.*|.*ui|logsend)$/i) &&
    !json.protocol.match(/NotifyFSRequest/)

  return Object.keys(json.messages).reduce((map, m) => {
    const message = json.messages[m]

    lintMessage(m, message)

    const buildParams = incoming => {
      const arr = message.request
        .filter(r => incoming || r.name !== 'sessionID') // We have the engine handle this under the hood
        .map(r => {
          const rtype = figureType(r.type)
          return `${r.name}${r.hasOwnProperty('default') || rtype.startsWith('?') ? '?' : ''}: ${rtype}`
        })
      const noParams = !incoming && !arr.length
      return noParams ? 'void' : `$ReadOnly<{${arr.join(',')}}>`
    }

    const name = `${json.protocol}${capitalize(m)}`
    const responseType = figureType(message.response)
    const response =
      responseType === 'null' ? null : `export type ${capitalize(name)}Result = ${responseType}`

    const isNotify = message.hasOwnProperty('notify')
    let r = null
    if (!isNotify) {
      const type = responseType === 'null' ? '' : `result: ${capitalize(name)}Result`
      if (type) {
        r = `,response: {error: ({code: number, desc: string}) => void, result: (${type}) => void}`
      } else {
        r = ''
      }
    } else {
      r = ''
    }

    const inParams = buildParams(true)
    if (isUIProtocol) {
      project.incomingMaps[`${json.namespace}.${json.protocol}.${m}`] = `(params: ${
        inParams ? `${inParams}` : 'void'
      }${r}) => Effect | Array<Effect> | null | void`
    }

    r = ''
    if (responseType !== 'null') {
      r = `, response: ${capitalize(name)}Result`
    }

    const outParams = buildParams(false)
    const paramType = outParams ? `export type ${capitalize(name)}RpcParam = ${outParams}` : ''
    const innerParamType = outParams ? `${capitalize(name)}RpcParam` : null
    const methodName = `'${json.namespace}.${json.protocol}.${m}'`
    const rpcPromise = isUIProtocol
      ? ''
      : rpcPromiseGen(methodName, name, r, innerParamType, responseType, false)
    const rpcPromiseType = isUIProtocol
      ? ''
      : rpcPromiseGen(methodName, name, r, innerParamType, responseType, true)
    const rpcChannelMap = isUIProtocol
      ? ''
      : rpcChannelMapGen(methodName, name, r, innerParamType, responseType, false)
    const rpcChannelMapType = isUIProtocol
      ? ''
      : rpcChannelMapGen(methodName, name, r, innerParamType, responseType, true)
    const engineSaga = isUIProtocol
      ? ''
      : engineSagaGen(methodName, name, r, innerParamType, responseType, false)
    const engineSagaType = isUIProtocol
      ? ''
      : engineSagaGen(methodName, name, r, innerParamType, responseType, true)

    const cleanName = methodName.substring(1, methodName.length - 1)
    if (!enabledCalls[cleanName]) {
      project.notEnabled.push(methodName)
    }

    map[name] = {
      paramType,
      response,
      rpcPromise,
      rpcPromiseType,
      rpcChannelMap,
      rpcChannelMapType,
      engineSaga,
      engineSagaType,
    }
    return map
  }, {})
}

function enabledCall(methodName, type) {
  const cleanName = methodName.substring(1, methodName.length - 1)
  return enabledCalls[cleanName] && enabledCalls[cleanName][type]
}

function engineSagaGen(methodName, name, response, requestType, responseType, justType) {
  if (!enabledCall(methodName, 'engineSaga')) {
    return ''
  }

  return justType
    ? `declare export function ${name}RpcSaga (p: {params: ${requestType}, incomingCallMap: IncomingCallMapType, waitingKey?: string}): CallEffect<void>`
    : `export const ${name}RpcSaga = (p, incomingCallMap, waitingKey) => call(getEngineSaga(), {method: ${methodName}, params: p.params, incomingCallMap: p.incomingCallMap, waitingKey: p.waitingKey})`
}

function rpcChannelMapGen(methodName, name, response, requestType, responseType, justType) {
  if (!enabledCall(methodName, 'channelMap')) {
    return ''
  }
  return justType
    ? `declare export function ${name}RpcChannelMap (configKeys: Array<string>, request: ${requestType}): void /* not void but this is deprecated */`
    : `export const ${name}RpcChannelMap = (configKeys, request) => engine()._channelMapRpcHelper(configKeys, ${methodName}, request)`
}

function rpcPromiseGen(methodName, name, response, requestType, responseType, justType) {
  if (!enabledCall(methodName, 'promise')) {
    return ''
  }
  const resultType = responseType !== 'null' ? `${capitalize(name)}Result` : 'void'

  return justType
    ? `declare export function ${name}RpcPromise (params: ${requestType}, waitingKey?: string): Promise<${resultType}>`
    : `export const ${name}RpcPromise = (params, waitingKey) => new Promise((resolve, reject) => engine()._rpcOutgoing({method: ${methodName}, params, callback: (error, result) => error ? reject(error) : resolve(${
        resultType === 'void' ? '' : 'result'
      }), waitingKey}))`
}

// Type parsing
function parseInnerType(t) {
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

function parseEnumSymbol(s) {
  var parts = s.split('_')
  return parseInt(parts.pop(), 10)
}

function parseEnum(t) {
  return parseUnion(t.symbols.map(s => `${parseEnumSymbol(s)} // ${s}\n`))
}

function parseMaybe(t) {
  var maybeType = t.filter(x => x !== null)[0]
  return `?${maybeType}`
}

function parseUnion(unionTypes) {
  return unionTypes.map(parseInnerType).join(' | ')
}

function parseRecord(t) {
  lintRecord(t)
  if (t.typedef) {
    return capitalize(t.typedef)
  }

  const fields = t.fields
    .map(f => {
      const innerType = parseInnerType(f.type)
      const innerOptional = innerType[0] === '?'
      const capsInnerType = innerOptional ? `?${capitalize(innerType.substr(1))}` : capitalize(innerType)
      const name = f.mpackkey || f.name
      const comment = f.mpackkey ? ` /* ${f.name} */ ` : ''

      // If we have a maybe type, let's also make the key optional
      return `${name}${comment}${innerOptional ? '?' : ''}: ${capsInnerType},`
    })
    .join('')

  return `$ReadOnly<{${fields}}>`
}

function parseVariant(t, project) {
  var parts = t.switch.type.split('.')
  if (parts.length > 1) {
    project = projects[parts.shift()]
  }

  var type = parts.shift()
  const cases = t.cases
    .map(c => {
      if (c.label.def) {
        return null
        // const bodyStr = c.body ? `, 'default': ?${c.body}` : ''
        // return `{ ${t.switch.name}: any${bodyStr} }`
      } else {
        var label = fixCase(c.label.name)
        const bodyStr = c.body ? `, ${label}: ?${capitalize(c.body)}` : ''
        return `{ ${t.switch.name}: ${project.enums[type][label]}${bodyStr} }`
      }
    })
    .filter(Boolean)
    .join(' | ')
  return cases || 'void'
}

function writeFlow(typeDefs, project) {
  const importMap = {
    Gregor1: "import * as Gregor1 from './rpc-gregor-gen'",
    Keybase1: "import * as Keybase1 from './rpc-gen'",
    Stellar1: "import * as Stellar1 from './rpc-stellar-gen'",
  }
  const typePrelude = `// @flow strict
/* eslint-disable */

// This file is auto-generated by client/protocol/Makefile.
import type {CallEffect, Effect} from 'redux-saga'
${project.import.map(n => importMap[n] || '').join('\n')}
${project.import.map(n => `export type {${n}}`).join('\n')}
export type Bool = boolean
export type Boolean = boolean
export type Bytes = Buffer
export type Double = number
export type Int = number
export type Int64 = number
export type Long = number
export type String = string
export type Uint = number
export type Uint64 = number
`
  const consts = Object.keys(typeDefs.consts).map(k => typeDefs.consts[k])
  const types = Object.keys(typeDefs.types).map(k => typeDefs.types[k])
  const messageResponse = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].response)
  const messageParams = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].paramType)
  const messagePromise = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].rpcPromiseType)
  const messageChannelMap = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].rpcChannelMapType)
  const messageEngineSaga = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].engineSagaType)
  const callMapType = Object.keys(project.incomingMaps).length ? 'IncomingCallMapType' : 'void'
  const incomingMap =
    `\nexport type IncomingCallMapType = {|` +
    Object.keys(project.incomingMaps)
      .map(im => `  '${im}'?: ${project.incomingMaps[im]}`)
      .join(',') +
    '|}'
  const data = [
    ...[...consts, ...types, ...messageResponse].sort(),
    ...messageParams.sort(),
    incomingMap,
    ...[...messagePromise, ...messageChannelMap, ...messageEngineSaga].sort(),
  ]
    .filter(Boolean)
    .join('\n')

  const notEnabled = `// Not enabled calls. To enable add to enabled-calls.json: ${project.notEnabled.join(
    ' '
  )}`

  const toWrite = [typePrelude, data, notEnabled].join('\n')
  const destinationFile = `types/${project.out}` // Only used by prettier so we can set an override in .prettierrc
  const formatted = prettier.format(toWrite, prettier.resolveConfig.sync(destinationFile))
  fs.writeFileSync(`js/${project.out}.js.flow`, formatted)
}

function write(typeDefs, project) {
  // Need any for weird flow issue where it gets confused by multiple
  // incoming call map types
  const callMapType = Object.keys(project.incomingMaps).length ? 'IncomingCallMapType' : 'void'

  const typePrelude = `// @noflow // not using flow at all
/* eslint-disable */

// This file is auto-generated by client/protocol/Makefile.
// Not enabled: calls need to be turned on in enabled-calls.json
import {call} from 'redux-saga/effects'
import {getEngine as engine, getEngineSaga} from '../../engine/require'
`
  const consts = Object.keys(typeDefs.consts).map(k => typeDefs.consts[k])
  const messagePromise = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].rpcPromise)
  const messageChannelMap = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].rpcChannelMap)
  const messageEngineSaga = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].engineSaga)
  const data = [...consts, ...messagePromise, ...messageChannelMap, ...messageEngineSaga]
    .filter(Boolean)
    .sort()
    .join('\n')

  const toWrite = [typePrelude, data].join('\n')
  const destinationFile = `types/${project.out}` // Only used by prettier so we can set an override in .prettierrc
  const formatted = prettier.format(toWrite, prettier.resolveConfig.sync(destinationFile))
  fs.writeFileSync(`js/${project.out}.js`, formatted)
}

function decapitalize(s) {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

const shorthands = [
  {re: /Tty([A-Zs]|$)/g, into: 'TTY$1', re2: /^TTY/, into2: 'tty'},
  {re: /Tlf([A-Zs]|$)/g, into: 'TLF$1', re2: /^TLF/, into2: 'tlf'},
  {re: /Uid([A-Zs]|$)/g, into: 'UID$1', re2: /^UID/, into2: 'uid'},
  {re: /Kid([A-Zs]|$)/g, into: 'KID$1', re2: /^KID/, into2: 'kid'},
  {re: /Cli([A-Z]|$)/g, into: 'CLI$1', re2: /^CLI/, into2: 'cli'},
  {re: /Api([A-Zs]|$)/g, into: 'API$1', re2: /^API/, into2: 'api'},
  {re: /Btc([A-Z]|$)/g, into: 'BTC$1', re2: /^BTC/, into2: 'btc'},
  {re: /Pgp([A-Z]|$)/g, into: 'PGP$1', re2: /^PGP/, into2: 'pgp'},
  {re: /Gpg([A-Z]|$)/g, into: 'GPG$1', re2: /^GPG/, into2: 'gpg'},
  {re: /Uri([A-Zs]|$)/g, into: 'URI$1', re2: /^URI/, into2: 'uri'},
  {re: /Gui([A-Z]|$)/g, into: 'GUI$1', re2: /^GUI/, into2: 'gui'},

  {re: /Kbfs([A-Z]|$)/g, into: 'KBFS$1', re2: /^KBFS/, into2: 'kbfs'},
  {re: /Json([A-Z]|$)/g, into: 'JSON$1', re2: /^JSON/, into2: 'json'},

  {re: /Ed25519([A-Z]|$)/g, into: 'ED25519$1', re2: /^ED25519/, into2: 'ed25519'},

  {re: /Id([A-Zs]|$)/g, into: 'ID$1', re2: /^ID/, into2: 'id'},
  {re: /Kv([A-Zs]|$)/g, into: 'KV$1', re2: /^KV/, into2: 'kv'},
  {re: /Ui([A-Z]|$)/g, into: 'UI$1', re2: /^UI/, into2: 'ui'}, // this has to be placed after the one for UID
  {re: /Fs([A-Z]|$)/g, into: 'FS$1', re2: /^FS/, into2: 'fs'},
  {re: /Md([A-Z]|$)/g, into: 'MD$1', re2: /^MD/, into2: 'md'},
  {re: /Ok([A-Z]|$)/g, into: 'OK$1', re2: /^OK/, into2: 'ok'},
]

function camelcaseWithSpecialHandlings(s, shouldCapitalize) {
  const capitalized = capitalize(camelcase(s))
  let specialized = capitalized
  for (let shorthand of shorthands) {
    specialized = specialized.replace(shorthand.re, shorthand.into)
  }
  specialized = specialized.replace(/[Tt][Ll][Ff][Ii][Dd]([A-Zs]|$)/g, 'TLFID$1')

  // since the handling FS would replace TLFs with TLFS
  specialized = specialized.replace(/T[Ll]FS/g, 'TLFs')

  if (shouldCapitalize) {
    return specialized
  }

  for (let shorthand of shorthands) {
    specialized = specialized.replace(shorthand.re2, shorthand.into2)
  }

  return decapitalize(specialized)
}

function lintTypedef(record, typedef) {
  switch (typedef) {
    case 'int64':
    case 'uint':
    case 'uint64':
      lintError(
        `${record.name}: ${typedef} cannot be fully represented as a Javascript number (double)`,
        record.lint
      )
      break
  }
}

function lintRecord(record) {
  lintTypedef(record, record.typedef)
  const rName = camelcaseWithSpecialHandlings(record.name, true)
  if (rName !== record.name) {
    lintError(`Record name ${record.name} should be ${rName}`, record.lint)
  }
  record.fields.forEach(f => {
    const fName = camelcaseWithSpecialHandlings(f.name, false)
    if (fName !== f.name) {
      lintError(`Record variable name ${record.name}.${f.name} should be ${rName}.${fName}`, f.lint)
    }
    if (f.type === 'bool') {
      lintError(`Use boolean instead of bool: ${f.name}`)
    }
  })
}

function lintMessage(name, message) {
  const mName = camelcaseWithSpecialHandlings(name, false)
  if (mName !== name) {
    lintError(`Method name ${name} should be ${mName}`, message.lint)
  }

  message.request.forEach(f => {
    const fName = camelcaseWithSpecialHandlings(f.name, false)
    if (fName !== f.name) {
      lintError(`Method arg name ${f.name} should be ${fName}`, message.lint)
    }
    if (f.type === 'bool') {
      lintError(`Use boolean instead of bool: ${f.name}`)
    }
  })
}

function lintJSON(json) {
  const pName = camelcaseWithSpecialHandlings(json.protocol, true)
  if (pName !== json.protocol) {
    // Ignore protocol name lint errors by default
    // lintError(`Protocol names should be capitalized: ${json.protocol}`, 'ignore')
  }
}

function lintError(s, lint) {
  if (lint === 'ignore') {
    console.log('Ignoring lint error:', colors.yellow(s))
  } else {
    console.log(colors.red(s))
    process.exit(1)
  }
}
