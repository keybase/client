// @noflow
'use strict'
const prettier = require('prettier')
const json5 = require('json5')
const promise = require('bluebird')
const fs = promise.promisifyAll(require('fs'))
const path = require('path')
const camelcase = require('camelcase')
const colors = require('colors')

// load prettier rules from eslintrc
const prettierOptions = json5.parse(
  fs.readFileSync(path.join(__dirname, '../../.eslintrc'), {encoding: 'utf8'})
).rules['prettier/prettier'][1]

// Allow extra wide
prettierOptions.printWidth = 9999

var projects = {
  chat1: {
    root: './json/chat1',
    import: "import * as Gregor1 from './flow-types-gregor'\nimport * as Keybase1 from './flow-types'",
    out: 'js/flow-types-chat.js',
    incomingMaps: {},
    seenTypes: {},
    enums: {},
  },
  keybase1: {
    root: 'json/keybase1',
    out: 'js/flow-types.js',
    import: "import * as Gregor1 from './flow-types-gregor'\n",
    incomingMaps: {},
    seenTypes: {},
    enums: {},
  },
  gregor1: {
    root: './json/gregor1',
    out: 'js/flow-types-gregor.js',
    incomingMaps: {},
    seenTypes: {},
    enums: {},
  },
}

const reduceArray = arr => arr.reduce((acc, cur) => acc.concat(cur), [])

Object.keys(projects).forEach(key => {
  const project = projects[key]
  fs
    .readdirAsync(project.root)
    .filter(jsonOnly)
    .map(file => load(file, project))
    .map(json => analyze(json, project))
    .reduce((acc, typeDefs) => acc.concat(typeDefs), [])
    .then(t => t.filter(key => key && key.length))
    .then(t => t.sort())
    .then(makeRpcUnionType)
    .then(typeDefs => write(typeDefs, project))
})

function jsonOnly(file) {
  return !!file.match(/.*\.json$/)
}

function load(file, project) {
  return fs.readFileAsync(path.join(project.root, file)).then(JSON.parse)
}

function analyze(json, project) {
  lintJSON(json)
  return reduceArray(
    [].concat(analyzeEnums(json, project), analyzeTypes(json, project), analyzeMessages(json, project))
  )
}

function fixCase(s) {
  return s.toLowerCase().replace(/(_\w)/g, s => capitalize(s[1]))
}

function analyzeEnums(json, project) {
  return json.types
    .filter(t => t.type === 'enum')
    .map(t => {
      var en = {}

      t.symbols.forEach(function(s) {
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
    .reduce((acc, t) => {
      return acc.concat([
        `\nexport const ${decapitalize(t.name)} = {
  ${Object.keys(t.map)
    .map(k => {
      return `${k}: ${t.map[k]}`
    })
    .join(',\n  ')},
}`,
      ])
    }, [])
}

function analyzeTypes(json, project) {
  return json.types.map(t => {
    if (project.seenTypes[t.name]) {
      return null
    }

    project.seenTypes[t.name] = true

    switch (t.type) {
      case 'record':
        return [`\nexport type ${t.name} = ${parseRecord(t)}`]
      case 'enum':
        return [`\nexport type ${t.name} =${parseEnum(t)}`]
      case 'variant':
        return [`\nexport type ${t.name} =${parseVariant(t, project)}`]
      case 'fixed':
        return [`\nexport type ${t.name} = any`]
      default:
        return null
    }
  })
}

function figureType(type) {
  if (!type) {
    return 'null' // keep backwards compat with old script
  }
  if (type instanceof Array) {
    if (type.length === 2) {
      if (type[0] === null) {
        return `?${capitalize(type[1])}`
      }
      if (type[1] === null) {
        return `?${capitalize(type[0])}`
      }
    }

    return `(${type.map(t => t || 'null').join(' | ')})`
  } else if (typeof type === 'object') {
    switch (type.type) {
      case 'array':
        return `?Array<${capitalize(type.items)}>`
      case 'map':
        return `{[key: string]: ${figureType(type.values)}}`
      default:
        console.log(`Unknown type: ${type}`)
        return 'unknown'
    }
  }

  return capitalize(type)
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function analyzeMessages(json, project) {
  // ui means an incoming rpc. simple regexp to filter this but it might break in the future if
  // the core side doesn't have a consisten naming convention. (must be case insensitive to pass correctly)
  const isUIProtocol =
    ['notifyCtl'].indexOf(json.protocol) === -1 &&
    !!json.protocol.match(/^(notify.*|.*ui|logsend)$/i) &&
    !json.protocol.match(/NotifyFSRequest/)

  return Object.keys(json.messages).map(m => {
    const message = json.messages[m]

    lintMessage(m, message)

    const buildParams = (incoming) => {
      const arr = message.request
        .filter(r => incoming || r.name !== 'sessionID') // We have the engine handle this under the hood
        .map(r => {
          const rtype = figureType(r.type)
          return `${r.name}${r.hasOwnProperty('default') || rtype.startsWith('?') ? '?' : ''}: ${rtype}`
        })
        .concat(...(incoming ? [] : [
          'incomingCallMap?: IncomingCallMapType',
          'waitingHandler?: WaitingHandlerType',
        ]))

      // if its just the incomingCallMpa or waitingHandler we can skip passing anything
      const isOptional = (!incoming && arr.length === 2) ? '?' : ''
      return `${isOptional}{|${arr.join(',')}|}`
    }

    const name = `${json.protocol}${capitalize(m)}`
    const responseType = figureType(message.response)
    const response = responseType === 'null' ? null : `type ${capitalize(name)}Result = ${responseType}`

    const isNotify = message.hasOwnProperty('notify')
    let r = null
    if (!isNotify) {
      const type = responseType === 'null' ? '' : `result: ${capitalize(name)}Result`
      if (type) {
        r = `,response: {error: RPCErrorHandler, result: (${type}) => void}`
      } else {
        r = `,response: CommonResponseHandler`
      }
    } else {
      r = ''
    }

    const inParams = buildParams(true)
    if (isUIProtocol) {
      project.incomingMaps[`keybase.1.${json.protocol}.${m}`] = `(params: ${inParams ? `${inParams}` : 'void'}${r}) => void`
    }

    r = ''
    if (responseType !== 'null') {
      r = `, response: ${capitalize(name)}Result`
    }

    const outParams = buildParams(false)
    const paramType = outParams ? `\nexport type ${capitalize(name)}RpcParam = ${outParams}` : ''
    const innerParamType = outParams ? `${capitalize(name)}RpcParam` : null
    const methodName = `'${json.namespace}.${json.protocol}.${m}'`
    const rpcPromise = isUIProtocol
      ? ''
      : rpcPromiseGen(methodName, name, r, innerParamType, responseType)
    const rpcChannelMap = isUIProtocol
      ? ''
      : rpcChannelMapGen(methodName, name, r, innerParamType, responseType)
    return [paramType, response, rpcPromise, rpcChannelMap]
  })
}

function rpcChannelMapGen(methodName, name, response, requestType, responseType) {
  return `\nexport const ${name}RpcChannelMap = (configKeys: Array<string>, request: ${requestType}): EngineChannel => engine()._channelMapRpcHelper(configKeys, ${methodName}, request)`
}

function rpcPromiseGen(methodName, name, response, requestType, responseType) {
  const resultType = responseType !== 'null' ? `${capitalize(name)}Result` : 'void'
  return `\nexport const ${name}RpcPromise = (request: ${requestType}): Promise<${resultType}> => new Promise((resolve, reject) => engine()._rpcOutgoing(${methodName}, request, (error: RPCError, result: ${resultType}) => error ? reject(error) : resolve(${resultType === 'void' ? '' : 'result'})))`
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

      // If we have a maybe type, let's also make the key optional
      return `${f.name}${innerOptional ? '?' : ''}: ${capsInnerType},`
    })
    .join('')

  return `{|${fields}|}`
}

function parseVariant(t, project) {
  var parts = t.switch.type.split('.')
  if (parts.length > 1) {
    project = projects[parts.shift()]
  }

  var type = parts.shift()
  return (
    t.cases
      .map(c => {
        if (c.label.def) {
          const bodyStr = c.body ? `, 'default': ?${c.body}` : ''
          return `{ ${t.switch.name}: any${bodyStr} }`
        } else {
          var label = fixCase(c.label.name)
          const bodyStr = c.body ? `, ${label}: ?${capitalize(c.body)}` : ''
          return `{ ${t.switch.name}: ${project.enums[type][label]}${bodyStr} }`
        }
      })
      .join(' | ')
  )
}

function makeRpcUnionType(typeDefs) {
  const rpcTypes = typeDefs
    .map(t => {
      const m = t.match(/(\w*Rpc) \(/)
      return m && m[1]
    })
    .filter(t => t)
    .reduce((acc, t) => {
      const clean = t.trim()
      return acc.indexOf(clean) === -1 ? acc.concat([clean]) : acc
    }, [])
    .sort()
    .join('|')

  if (rpcTypes) {
    const unionRpcType = `\nexport type rpc =
    ${rpcTypes}`
    return typeDefs.concat(unionRpcType)
  }

  return typeDefs
}
// TODO add back these eslint overrides after prettier is in no-unused-vars,no-use-before-define,prettier/prettier
function write(typeDefs, project) {
  // Need any for weird flow issue where it gets confused by multiple
  // incoming call map types
  const callMapType = Object.keys(project.incomingMaps).length ? 'IncomingCallMapType' : 'any'
  const typePrelude = `// @flow
/* eslint-disable */

// This file is auto-generated by client/protocol/Makefile.
${project.import || ''}
import engine, {EngineChannel} from '../../engine'
import type {Boolean, Bool, Bytes, Double, Int, Int64, Long, String, Uint, Uint64, WaitingHandlerType, RPCErrorHandler, CommonResponseHandler, RPCError} from '../../engine/types'
`
  const incomingMap =
    `\nexport type IncomingCallMapType = {|` +
    Object.keys(project.incomingMaps).map(im => `  '${im}'?: ${project.incomingMaps[im]}`).join(',') +
    '|}\n'
  const toWrite = [typePrelude, typeDefs.join('\n'), incomingMap].join('\n')
  // const formatted = prettier.format(toWrite, prettierOptions)
  // TODO disabling prettier short term
  fs.writeFileSync(project.out, /*formatted*/ toWrite)
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
