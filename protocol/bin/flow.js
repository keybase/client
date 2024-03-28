'use strict'
const prettier = require('prettier')
const util = require('util')
const fs = require('fs')
const path = require('path')
const camelcase = require('camelcase')
const colors = require('colors')
const json5 = require('json5')
const enabledCalls = json5.parse(fs.readFileSync(path.join(__dirname, 'enabled-calls.json')))

// Sanity check this json file
Object.keys(enabledCalls).forEach(rpc =>
  Object.keys(enabledCalls[rpc]).forEach(type => {
    if (!['promise', 'incoming', 'engineListener', 'custom'].includes(type)) {
      console.log(colors.red('ERROR! Invalid enabled call?\n\n '), rpc, type)
      process.exit(1)
    }
  })
)

var projects = {
  chat1: {
    customResponseIncomingMaps: {},
    enums: {},
    import: ['Gregor1', 'Keybase1', 'Stellar1'],
    incomingMaps: {},
    notEnabled: [],
    out: 'rpc-chat-gen',
    root: './json/chat1',
    seenTypes: {},
  },
  keybase1: {
    customResponseIncomingMaps: {},
    enums: {},
    import: ['Gregor1'],
    incomingMaps: {},
    notEnabled: [],
    out: 'rpc-gen',
    root: 'json/keybase1',
    seenTypes: {},
  },
  gregor1: {
    customResponseIncomingMaps: {},
    enums: {},
    import: [],
    incomingMaps: {},
    notEnabled: [],
    out: 'rpc-gregor-gen',
    root: './json/gregor1',
    seenTypes: {},
  },
  stellar1: {
    customResponseIncomingMaps: {},
    enums: {},
    import: ['Keybase1'],
    incomingMaps: {},
    notEnabled: [],
    out: 'rpc-stellar-gen',
    root: './json/stellar1',
    seenTypes: {},
  },
}

function jsonOnly(file) {
  return !!file.match(/.*\.json$/)
}

function load(file, project) {
  return JSON.parse(fs.readFileSync(path.join(project.root, file)))
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
        name: t.name,
        map: en,
      }
    })
    .reduce((map, t) => {
      map[decapitalize(t.name)] = `\nexport enum ${t.name} {
  ${Object.keys(t.map)
    .map(k => `${k} = ${t.map[k]}`)
    .join(',\n  ')},
}`
      return map
    }, {})
}

const typeOverloads = {}

function analyzeTypes(json, project) {
  return json.types.reduce((map, t) => {
    if (project.seenTypes[t.name]) {
      return map
    }

    project.seenTypes[t.name] = true

    if (typeOverloads[t.name]) {
      map[t.name] = typeOverloads[t.name]
      return map
    }

    switch (t.type) {
      case 'record':
        map[t.name] = `export type ${t.name} = ${parseRecord(t)}`
        break
      case 'enum':
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
        map[t.name] = `export type ${t.name} = string | null`
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
        return `${prefix}${capitalize(type[1])} | null`
      }
      if (type[1] === null) {
        return `${prefix}${capitalize(type[0])} | null`
      }
    }

    return `(${type.map(t => t || 'null').join(' | ')})`
  } else if (typeof type === 'object') {
    switch (type.type) {
      case 'array':
        return `ReadonlyArray<${prefix}${capitalize(type.items)}> | null`
      case 'map':
        return `{[key: string]: ${figureType(type.values)}} | null`
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

    const arr = message.request
      .filter(r => r.name !== 'sessionID') // We have the engine handle this under the hood
      .map(r => {
        const rtype = figureType(r.type)
        return `readonly ${r.name}${
          r.hasOwnProperty('default') || rtype.endsWith('| null') ? '?' : ''
        }: ${rtype}`
      })
    const noParams = !arr.length
    const inParam = noParams ? 'undefined' : `{${arr.join(',')}}`
    const name = `${json.protocol}${capitalize(m)}`
    const outParam = figureType(message.response)
    const methodName = `'${json.namespace}.${json.protocol}.${m}'`
    const isUIMethod = isUIProtocol || enabledCall(methodName, 'incoming')

    if (isUIMethod) {
      project.incomingMaps[methodName] = `(params: MessageTypes[${methodName}]['inParam']) => void`
      if (!message.hasOwnProperty('notify')) {
        project.customResponseIncomingMaps[
          methodName
        ] = `(params: MessageTypes[${methodName}]['inParam'], response: {error: IncomingErrorCallback, result: (res: MessageTypes[${methodName}]['outParam']) => void}) => void`
      }
    }

    const rpcPromise = isUIMethod ? '' : rpcPromiseGen(methodName, name, false, json, project)
    const rpcPromiseType = isUIMethod ? '' : rpcPromiseGen(methodName, name, true, json, project)
    const engineListener = isUIMethod ? '' : engineListenerGen(methodName, name, false)
    const engineListenerType = isUIMethod ? '' : engineListenerGen(methodName, name, true)

    if (rpcPromise.length) {
      project.hasEngine = true
    }
    if (engineListener) {
      project.hasEngineListener = true
    }

    const cleanName = methodName.substring(1, methodName.length - 1)
    if (!enabledCalls[cleanName]) {
      project.notEnabled.push(methodName)
    }

    // Must be an rpc we use
    if (rpcPromiseType || engineListenerType || isUIMethod) {
      map[methodName] = {
        inParam,
        outParam: outParam === 'null' ? 'void' : outParam,
        rpcPromise,
        rpcPromiseType,
        engineListener,
        engineListenerType,
      }
    }
    return map
  }, {})
}

function enabledCall(methodName, type) {
  const cleanName = methodName.substring(1, methodName.length - 1)
  return enabledCalls[cleanName] && enabledCalls[cleanName][type]
}

function engineListenerGen(methodName, name, justType) {
  if (!enabledCall(methodName, 'engineListener')) {
    return ''
  }
  return justType
    ? `declare export function ${name}RpcListener (p: {params: MessageTypes[${methodName}]['inParam'], incomingCallMap: IncomingCallMapType, customResponseIncomingCallMap?: CustomResponseIncomingCallMap, waitingKey?: WaitingKey}): CallEffect<void, () => void, Array<void>>`
    : `export const ${name}RpcListener = (p: {params: MessageTypes[${methodName}]['inParam'], incomingCallMap: IncomingCallMapType, customResponseIncomingCallMap?: CustomResponseIncomingCallMap, waitingKey?: WaitingKey}) => getEngineListener<typeof p, Promise<MessageTypes[${methodName}]['outParam']>>()({method: ${methodName}, params: p.params, incomingCallMap: p.incomingCallMap, customResponseIncomingCallMap: p.customResponseIncomingCallMap, waitingKey: p.waitingKey})`
}

function rpcPromiseGen(methodName, name, justType, json, project) {
  if (!enabledCall(methodName, 'promise')) {
    return ''
  }

  // if we have no params, make it optional
  const lookupName = methodName.split('.').at(-1).replaceAll("'", '')
  const r = json.messages[lookupName].request
  const hasParams =
    r !== null &&
    (Array.isArray(r) &&
      r.reduce((cnt, i) => {
        if (i && i.name !== 'sessionID') {
          cnt++
        }
        return cnt
      }, 0)) > 0
  const inParams = hasParams ? `params: MessageTypes[${methodName}]['inParam']` : 'params?: undefined'
  return justType
    ? `declare export function ${name}RpcPromise (${inParams}, waitingKey?: WaitingKey): Promise<MessageTypes[${methodName}]['outParam']>`
    : `export const ${name}RpcPromise = (${inParams}, waitingKey?: WaitingKey) => new Promise<MessageTypes[${methodName}]['outParam']>((resolve, reject) => engine()._rpcOutgoing({method: ${methodName}, params, callback: (error: SimpleError, result: MessageTypes[${methodName}]['outParam']) => error ? reject(error) : resolve(result), waitingKey}))`
}

function maybeIfNot(s) {
  if (s.endsWith('| null')) return s
  return `${s} | null`
}

// Type parsing
function parseInnerType(t) {
  if (!t) {
    return 'void' // keep backwards compat with old script
  }

  if (t.constructor === Array) {
    if (t.length === 2 && t[0] === null) {
      return maybeIfNot(figureType(t[1]))
    } else {
      return parseUnion(t)
    }
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
      const innerOptional = innerType.endsWith('| null')
      const capsInnerType = capitalize(innerType)
      const name = f.mpackkey || f.name
      const comment = f.mpackkey ? ` /* ${f.name} */ ` : ''

      // If we have a maybe type, let's also make the key optional
      return `readonly ${name}${comment}${innerOptional ? '?' : ''}: ${capsInnerType},`
    })
    .join('')

  return `{${fields}}`
}

function parseVariant(t, project) {
  var parts = t.switch.type.split('.')
  if (parts.length > 1) {
    project = projects[parts.shift()]
  }

  const rootType = t.switch.type
  const rootEnum = project.enums[rootType]

  let unhandled = new Set(Object.keys(rootEnum))
  var type = parts.shift()
  const cases = t.cases
    .map(c => {
      if (c.label.def) {
        return null
      } else {
        var label = fixCase(c.label.name)
        unhandled.delete(label)
        let bodyType = ''
        if (c.body === null) {
          bodyType = 'null'
        } else if (typeof c.body === 'string') {
          bodyType = capitalize(c.body)
        } else if (c.body.type === 'array') {
          bodyType = `ReadonlyArray<${capitalize(c.body.items)}>`
        }
        const bodyStr = c.body ? `, ${label}: ${bodyType}` : ''
        return `{ ${t.switch.name}: ${type}.${label}${bodyStr} }`
      }
    })
    .filter(Boolean)

  const otherCases = [...unhandled].map(label => `{ ${t.switch.name}: ${type}.${label}}`)
  const s = [...cases, ...otherCases].join(' | ')

  return s || 'void'
}

function writeActions() {
  const staticActions = {}

  const seenProjects = {}

  const data = {
    actions: Object.keys(projects).reduce((map, p) => {
      const callMap = projects[p].incomingMaps
      callMap &&
        Object.keys(callMap).reduce((m, method) => {
          const name = method
            .replace(/'/g, '')
            .split('.')
            .map((p, idx) => (idx ? capitalize(p) : p))
            .join('')

          seenProjects[p] = true
          let response = ''
          if (projects[p].customResponseIncomingMaps[method]) {
            response = `, response: {error: ${p}Types.IncomingErrorCallback, result: (param: ${p}Types.MessageTypes[${method}]['outParam']) => void}`
          }

          m[name] = {
            params: `${p}Types.MessageTypes[${method}]['inParam'] ${response}`,
          }
          return m
        }, map)
      return map
    }, staticActions),
  }

  const toWrite = JSON.stringify(
    {
      prelude: Object.keys(seenProjects).map(
        p => `import type * as ${p}Types from '@/constants/types/${projects[p].out}'`
      ),
      ...data,
    },
    null,
    4
  )
  fs.writeFileSync(`js/engine-gen.json`, toWrite)
}

function writeAll() {
  const imports = Object.keys(projects)
    .map(
      p => `import type {
  CustomResponseIncomingCallMap as ${p}CustomResponseIncomingCallMap,
  IncomingCallMapType as ${p}IncomingCallMap,
} from './${projects[p].out}'
`
    )
    .join('\n')

  const exports = `
  export type IncomingCallMapType = ${Object.keys(projects)
    .map(p => `${p}IncomingCallMap`)
    .join(' & ')}
  export type CustomResponseIncomingCallMapType = ${Object.keys(projects)
    .map(p => `${p}CustomResponseIncomingCallMap`)
    .join(' & ')}
  `
  const toWrite = [imports, exports].join('\n')
  const destinationFile = `types/rpc-all-gen.tsx` // Only used by prettier so we can set an override in .prettierrc
  const formatted = prettier.format(toWrite, {
    ...prettier.resolveConfig.sync(destinationFile),
    parser: 'typescript',
  })
  fs.writeFileSync(`js/rpc-all-gen.tsx`, formatted)
}

function writeFlow(typeDefs, project) {
  const importMap = {
    Gregor1: "import * as Gregor1 from './rpc-gregor-gen'",
    Keybase1: "import * as Keybase1 from './rpc-gen'",
    Stellar1: "import * as Stellar1 from './rpc-stellar-gen'",
  }

  const engineImports = [
    project.hasEngine ? 'getEngine as engine' : '',
    project.hasEngineListener ? 'getEngineListener' : '',
  ]
    .filter(f => f.length)
    .join(', ')
  const engineImport = engineImports.length ? `import {${engineImports}} from '@/engine/require'` : ''
  const typePrelude = `/* eslint-disable */

// This file is auto-generated by client/protocol/Makefile.
${engineImport}
${project.import.map(n => importMap[n] || '').join('\n')}
${project.import.map(n => `export {${n}}`).join('\n')}
export type Bool = boolean
export type Boolean = boolean
export type Bytes = Uint8Array
export type Double = number
export type Int = number
export type Int64 = number
export type Long = number
export type String = string
export type Uint = number
export type Uint64 = number
${project.hasEngine ? 'type WaitingKey = string | ReadonlyArray<string>' : ''}
type SimpleError = {code?: number, desc?: string}
export type IncomingErrorCallback = (err?: SimpleError | null) => void

`
  const consts = Object.keys(typeDefs.consts).map(k => typeDefs.consts[k])
  const types = Object.keys(typeDefs.types).map(k => typeDefs.types[k])
  const messagePromise = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].rpcPromise)
  const messageEngineListener = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].engineListener)
  // const callMapType = Object.keys(project.incomingMaps).length ? 'IncomingCallMapType' : 'void'
  const incomingMap = `\nexport type IncomingCallMapType = {
    ${Object.keys(project.incomingMaps)
      .filter(im => enabledCall(im, 'incoming'))
      .map(im => `  ${im}?: ${project.incomingMaps[im]}`)
      .join(',')}
    }`

  const customResponseCallMapType = Object.keys(project.customResponseIncomingMaps).length
    ? 'CustomResponseIncomingCallMap'
    : 'void'
  const customResponseIncomingMap = `\nexport type CustomResponseIncomingCallMap = {
    ${Object.keys(project.customResponseIncomingMaps)
      .filter(im => enabledCall(im, 'custom'))
      .map(im => `  ${im}?: ${project.customResponseIncomingMaps[im]}`)
      .join(',')}
    }`

  const messageTypesData = Object.keys(typeDefs.messages)
    .map(k => {
      const data = typeDefs.messages[k]
      const types = {}
      return `  ${k}: {
    inParam: ${data.inParam},
    outParam: ${data.outParam || 'void'},
  },`
    })
    .sort()
    .join('\n')

  const messageTypes = `\nexport type MessageTypes = {
${messageTypesData}
}`

  const data = [
    messageTypes,
    ...[...consts, ...types].sort(),
    incomingMap,
    customResponseIncomingMap,
    ...[...messagePromise, ...messageEngineListener].sort(),
  ]
    .filter(Boolean)
    .join('\n')

  const notEnabled = `// Not enabled calls. To enable add to enabled-calls.json:\n// ${project.notEnabled.join(
    '\n// '
  )}`

  const toWrite = [typePrelude, data, notEnabled].join('\n')
  const destinationFile = `types/${project.out}` // Only used by prettier so we can set an override in .prettierrc
  const formatted = prettier.format(toWrite, {
    ...prettier.resolveConfig.sync(destinationFile),
    parser: 'typescript',
  })
  fs.writeFileSync(`js/${project.out}.tsx`, formatted)
}

function write(typeDefs, project) {
  // Need any for weird flow issue where it gets confused by multiple
  // incoming call map types
  //const callMapType = Object.keys(project.incomingMaps).length ? 'IncomingCallMapType' : 'void'

  const typePrelude = `/* eslint-disable */

// This file is auto-generated by client/protocol/Makefile.
// Not enabled: calls need to be turned on in enabled-calls.json
import {getEngine as engine} from '@/engine/require'
`
  const consts = Object.keys(typeDefs.consts).map(k => typeDefs.consts[k])
  const messagePromise = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].rpcPromise)
  const messageEngineListener = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].engineListener)
  const data = [...consts, ...messagePromise, ...messageEngineListener].filter(Boolean).sort().join('\n')

  const toWrite = [typePrelude, data].join('\n')
  const destinationFile = `types/${project.out}` // Only used by prettier so we can set an override in .prettierrc
  const formatted = prettier.format(toWrite, {
    ...prettier.resolveConfig.sync(destinationFile),
    parser: 'typescript',
  })
  fs.writeFileSync(`js/${project.out}.tsx`, formatted)
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
  for (const shorthand of shorthands) {
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
    // console.log('Ignoring lint error:', colors.yellow(s))
  } else {
    console.log(colors.red(s))
    process.exit(1)
  }
}

const keys = Object.keys(projects)
keys.forEach(key => {
  const project = projects[key]
  const typeDefs = fs
    .readdirSync(project.root)
    .filter(jsonOnly)
    .map(file => load(file, project))
    .map(json => analyze(json, project))
    .reduce((map, next) => {
      map.consts = {...map.consts, ...next.consts}
      map.types = {...map.types, ...next.types}
      map.messages = {...map.messages, ...next.messages}
      return map
    }, {})
  writeFlow(typeDefs, project)
})
writeAll()
writeActions()
