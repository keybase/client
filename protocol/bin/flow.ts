'use strict'

import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import colors from 'colors'
import json5 from 'json5'

type EnabledCallType = 'promise' | 'incoming' | 'engineListener' | 'custom'
type EnabledCalls = Record<string, Partial<Record<EnabledCallType, boolean>>>
type EnumMap = Record<string, number>
type IncomingMap = Record<string, string>
type SeenTypes = Record<string, boolean>
type ProjectImport = 'Gregor1' | 'Keybase1' | 'Stellar1'
type ProjectKey = 'chat1' | 'keybase1' | 'gregor1' | 'stellar1'

type ArrayTypeRef = {
  items: string
  type: 'array'
}

type MapTypeRef = {
  type: 'map'
  values: TypeRef
}

type TypeRef = string | null | ReadonlyArray<string | null> | ArrayTypeRef | MapTypeRef | RecordDefinition

type JsonLint = 'ignore' | string | undefined

type FieldDefinition = {
  fields?: ReadonlyArray<FieldDefinition>
  lint?: JsonLint
  mpackkey?: string
  name: string
  type: TypeRef
  typedef?: string
}

type MessageArgument = FieldDefinition & {
  default?: unknown
}

type RecordDefinition = {
  fields: ReadonlyArray<FieldDefinition>
  lint?: JsonLint
  name: string
  type: 'record'
  typedef?: string
}

type EnumDefinition = {
  lint?: JsonLint
  name: string
  symbols: ReadonlyArray<string>
  type: 'enum'
}

type VariantCase = {
  body: null | string | ArrayTypeRef
  label: {
    def?: boolean
    name: string
  }
}

type VariantDefinition = {
  cases: ReadonlyArray<VariantCase>
  lint?: JsonLint
  name: string
  switch: {
    name: string
    type: string
  }
  type: 'variant'
}

type FixedDefinition = {
  lint?: JsonLint
  name: string
  type: 'fixed'
}

type TypeDefinition = RecordDefinition | EnumDefinition | VariantDefinition | FixedDefinition

type MessageDefinition = {
  lint?: JsonLint
  notify?: unknown
  request: ReadonlyArray<MessageArgument>
  response?: TypeRef
}

type ProtocolJSON = {
  messages: Record<string, MessageDefinition>
  namespace: string
  protocol: string
  types: ReadonlyArray<TypeDefinition>
}

type MessageData = {
  engineListener: string
  engineListenerType: string
  inParam: string
  outParam: string
  rpcPromise: string
  rpcPromiseType: string
}

type AnalysisResult = {
  consts: Record<string, string>
  messages: Record<string, MessageData>
  types: Record<string, string>
}

type ProjectState = {
  customResponseIncomingMaps: IncomingMap
  enums: Record<string, EnumMap>
  hasEngine?: boolean
  hasEngineListener?: boolean
  import: ReadonlyArray<ProjectImport>
  incomingMaps: IncomingMap
  notEnabled: Array<string>
  out: string
  root: string
  seenTypes: SeenTypes
}

type ActionValue = string | ReadonlyArray<string>
type ActionDescription = {
  _description?: string | ReadonlyArray<string>
} & Record<string, ActionValue | undefined>
type ActionMap = Record<string, ActionDescription>

type CompileActionsArgs = {
  actions: ActionMap
  prelude: Array<string>
}
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const enabledCalls = json5.parse(fs.readFileSync(path.join(__dirname, 'enabled-calls.json'), 'utf8'))

const primitiveTypeMap: Record<string, string> = {
  bool: 'boolean',
  boolean: 'boolean',
  bytes: 'Uint8Array',
  double: 'number',
  int: 'number',
  int64: 'number',
  long: 'number',
  string: 'string',
  uint: 'number',
  uint64: 'number',
}

// Sanity check this json file
Object.keys(enabledCalls).forEach(rpc =>
  Object.keys(enabledCalls[rpc]).forEach(type => {
    if (!['promise', 'incoming', 'engineListener', 'custom'].includes(type)) {
      console.log(colors.red('ERROR! Invalid enabled call?\n\n '), rpc, type)
      process.exit(1)
    }
  })
)

const projects: Record<ProjectKey, ProjectState> = {
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

function jsonOnly(file: string): boolean {
  return !!file.match(/.*\.json$/)
}

function load(file: string, project: ProjectState): ProtocolJSON {
  return JSON.parse(fs.readFileSync(path.join(project.root, file), 'utf8')) as ProtocolJSON
}

function analyze(json: ProtocolJSON, project: ProjectState): AnalysisResult {
  lintJSON(json)
  return {
    consts: analyzeEnums(json, project),
    types: analyzeTypes(json, project),
    messages: analyzeMessages(json, project),
  }
}

function fixCase(s: string): string {
  return s.toLowerCase().replace(/(_\w)/g, s => capitalize(s[1]))
}

function analyzeEnums(json: ProtocolJSON, project: ProjectState): Record<string, string> {
  return json.types
    .filter((t): t is EnumDefinition => t.type === 'enum')
    .map(t => {
      const en: EnumMap = {}

      t.symbols.forEach(s => {
        const parts = s.split('_')
        const val = parseInt(parts.pop() ?? '', 10)
        const name = fixCase(parts.join('_'))
        en[name] = val
      })

      project.enums[t.name] = en

      return {
        name: t.name,
        map: en,
      }
    })
    .reduce<Record<string, string>>((map, t) => {
      map[decapitalize(t.name)] = `\nexport enum ${t.name} {
  ${Object.keys(t.map)
    .map(k => `${k} = ${t.map[k]}`)
    .join(',\n  ')},
}`
      return map
    }, {})
}

const typeOverloads: Record<string, string> = {}

function analyzeTypes(json: ProtocolJSON, project: ProjectState): Record<string, string> {
  return json.types.reduce<Record<string, string>>((map, t) => {
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

function figureType(type: TypeRef | undefined, prefix = ''): string {
  if (!type) {
    return 'null' // keep backwards compat with old script
  }

  if (Array.isArray(type)) {
    if (type.length === 2) {
      if (type[0] === null) {
        return `${renderTypeName(type[1], prefix)} | null`
      }
      if (type[1] === null) {
        return `${renderTypeName(type[0], prefix)} | null`
      }
    }

    return `(${type.map(t => (t === null ? 'null' : renderTypeName(t, prefix))).join(' | ')})`
  } else if (typeof type === 'object') {
    switch (type.type) {
      case 'array':
        return `ReadonlyArray<${renderTypeName(type.items, prefix)}> | null`
      case 'map':
        return `{[key: string]: ${figureType(type.values)}} | null`
      default:
        console.log(`Unknown type: ${type}`)
        return 'unknown'
    }
  }

  return renderTypeName(type, prefix)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function renderTypeName(type: string, prefix = ''): string {
  return primitiveTypeMap[type] ?? prefix + capitalize(type)
}

function analyzeMessages(json: ProtocolJSON, project: ProjectState): Record<string, MessageData> {
  // ui means an incoming rpc. simple regexp to filter this but it might break in the future if
  // the core side doesn't have a consistent naming convention. (must be case insensitive to pass correctly)
  const isUIProtocol =
    ['notifyCtl'].indexOf(json.protocol) === -1 &&
    !!json.protocol.match(/^(notify.*|.*ui|logsend)$/i) &&
    !json.protocol.match(/NotifyFSRequest/)

  return Object.keys(json.messages).reduce<Record<string, MessageData>>((map, m) => {
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
      project.incomingMaps[methodName] = `(params: RpcIn<${methodName}>) => void`
      if (!message.hasOwnProperty('notify')) {
        project.customResponseIncomingMaps[
          methodName
        ] = `(params: RpcIn<${methodName}>, response: RpcResponse<${methodName}>) => void`
      }
    }

    const rpcPromise = isUIMethod ? '' : rpcPromiseGen(methodName, name, false)
    const rpcPromiseType = isUIMethod ? '' : rpcPromiseGen(methodName, name, true)
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

function enabledCall(methodName: string, type: EnabledCallType): boolean | undefined {
  const cleanName = methodName.substring(1, methodName.length - 1)
  return enabledCalls[cleanName] && enabledCalls[cleanName][type]
}

function engineListenerGen(methodName: string, name: string, justType: boolean): string {
  if (!enabledCall(methodName, 'engineListener')) {
    return ''
  }
  return justType
    ? `declare export const ${name}RpcListener: ListenerFn<${methodName}>`
    : `export const ${name}RpcListener = createListener(${methodName})`
}

function rpcPromiseGen(methodName: string, name: string, justType: boolean): string {
  if (!enabledCall(methodName, 'promise')) {
    return ''
  }
  return justType
    ? `declare export const ${name}RpcPromise: RpcFn<${methodName}>`
    : `export const ${name}RpcPromise = createRpc(${methodName})`
}

function maybeIfNot(s: string): string {
  if (s.endsWith('| null')) return s
  return `${s} | null`
}

// Type parsing
function parseInnerType(t: TypeRef | undefined): string {
  if (!t) {
    return 'void' // keep backwards compat with old script
  }

  if (Array.isArray(t)) {
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

function parseUnion(unionTypes: ReadonlyArray<TypeRef | string>): string {
  return unionTypes.map(parseInnerType).join(' | ')
}

function parseRecord(t: RecordDefinition): string {
  lintRecord(t)
  if (t.typedef) {
    return renderTypeName(t.typedef)
  }

  const fields = t.fields
    .map(f => {
      const innerType = parseInnerType(f.type)
      const innerOptional = innerType.endsWith('| null')
      const name = f.mpackkey || f.name
      const comment = f.mpackkey ? ` /* ${f.name} */ ` : ''

      // If we have a maybe type, let's also make the key optional
      return `readonly ${name}${comment}${innerOptional ? '?' : ''}: ${innerType},`
    })
    .join('')

  return `{${fields}}`
}

function parseVariant(t: VariantDefinition, project: ProjectState): string {
  let parts = t.switch.type.split('.')
  if (parts.length > 1) {
    const projectKey = parts.shift()
    if (projectKey && projectKey in projects) {
      project = projects[projectKey as ProjectKey]
    }
  }

  const rootType = t.switch.type
  const rootEnum = project.enums[rootType]

  const unhandled = new Set(Object.keys(rootEnum))
  const type = parts.shift() ?? ''
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
          bodyType = renderTypeName(c.body)
        } else if (c.body.type === 'array') {
          bodyType = `ReadonlyArray<${renderTypeName(c.body.items)}>`
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

async function writeActions(): Promise<void> {
  const staticActions: ActionMap = {}

  const seenProjects: Partial<Record<ProjectKey, true>> = {}

  const data = {
    actions: Object.keys(projects).reduce<ActionMap>((map, p) => {
      const projectKey = p as ProjectKey
      const callMap = projects[projectKey].incomingMaps
      callMap &&
        Object.keys(callMap).reduce((m, method) => {
          seenProjects[projectKey] = true
          let response = ''
          if (projects[projectKey].customResponseIncomingMaps[method]) {
            response = `, response: ${projectKey}Types.RpcResponse<${method}>`
          }

          m[method] = {
            params: `${projectKey}Types.RpcIn<${method}> ${response}`,
          }
          return m
        }, map)
      return map
    }, staticActions),
  }

  return writeEngineActions({
    prelude: Object.keys(seenProjects).map(
      p => `import type * as ${p}Types from '@/constants/rpc/${projects[p as ProjectKey].out}'`
    ),
    ...data,
  })
}

const reservedPayloadKeys = ['_description'] as const

function payloadHasType(payload: ActionDescription | undefined, toFind: RegExp): boolean {
  return payload
    ? Object.keys(payload).some(param => {
        const ps = payload[param]
        if (Array.isArray(ps)) {
          return ps.some(p => toFind.test(p))
        } else {
          return toFind.test(ps || '')
        }
      })
    : false
}

function actionHasType(actions: ActionMap, toFind: RegExp): boolean {
  return Object.keys(actions).some(key => payloadHasType(actions[key], toFind))
}

function compileActionsFile({prelude, actions}: CompileActionsArgs): string {
  const rpcGenImport = actionHasType(actions, /(^|\W)RPCTypes\./)
    ? "import type * as RPCTypes from '@/constants/rpc/rpc-gen'\n"
    : ''
  const actionNames = Object.keys(actions).sort()
  const actionSpec = actionNames
    .map(name => `  '${name}': ${printPayload(actions[name])},`)
    .join('\n')

  return `// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
${rpcGenImport}${prelude.join('\n')}

type ActionSpec = {
${actionSpec}
}

export type ActionKey = keyof ActionSpec
type EngineActionMap = {
  [K in ActionKey]: {readonly payload: ActionSpec[K]; readonly type: K}
}

export type ActionPayload<K extends ActionKey = ActionKey> = ActionSpec[K]
export type EngineAction<K extends ActionKey = ActionKey> = EngineActionMap[K]
export type EngineActions = EngineAction
export type Actions = EngineActions
export type ActionType = ActionKey
export type ActionOf<T extends ActionType> = Extract<Actions, {readonly type: T}>
export type PayloadOf<T extends ActionType> = ActionOf<T> extends {readonly payload: infer P} ? P : never
export type ParamsOf<T extends ActionType> = PayloadOf<T> extends {readonly params: infer P} ? P : never
export type ResponseOf<T extends ActionType> = PayloadOf<T> extends {readonly response: infer R} ? R : never
`
}

function payloadKeys(p: ActionDescription): Array<string> {
  return Object.keys(p).filter(key => !reservedPayloadKeys.includes(key))
}

function printPayload(p: ActionDescription): string {
  return payloadKeys(p).length
    ? '{' +
        payloadKeys(p)
          .map(key => {
            const val = p[key]
            return `readonly ${key}: ${Array.isArray(val) ? val.join(' | ') : val}`
          })
          .join(',\n') +
        '}'
    : 'undefined'
}

async function writeEngineActions(desc: CompileActionsArgs): Promise<void> {
  const outPath = path.join(__dirname, '../../shared/constants/rpc', 'index.tsx')
  fs.writeFileSync(outPath, compileActionsFile(desc))
}

async function writeAll(): Promise<void> {
  const imports = Object.keys(projects)
    .map(
      p => `import type {
  CustomResponseIncomingCallMap as ${p}CustomResponseIncomingCallMap,
  IncomingCallMapType as ${p}IncomingCallMap,
} from './${projects[p as ProjectKey].out}'
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
  fs.writeFileSync(`js/rpc-all-gen.tsx`, toWrite)
}

async function writeFlow(typeDefs: AnalysisResult, project: ProjectState): Promise<void> {
  const importMap: Record<ProjectImport, string> = {
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
  const messageKeys = Object.keys(typeDefs.messages).sort()
  const promiseMethods = messageKeys.filter(k => typeDefs.messages[k].rpcPromise)
  const listenerMethods = messageKeys.filter(k => typeDefs.messages[k].engineListener)
  const incomingMethods = Object.keys(project.incomingMaps)
    .filter(im => enabledCall(im, 'incoming'))
    .sort()
  const customIncomingMethods = Object.keys(project.customResponseIncomingMaps)
    .filter(im => enabledCall(im, 'custom'))
    .sort()
  const promiseMethodUnion = promiseMethods.length ? promiseMethods.join(' | ') : 'never'
  const listenerMethodUnion = listenerMethods.length ? listenerMethods.join(' | ') : 'never'
  const incomingMethodUnion = incomingMethods.length ? incomingMethods.join(' | ') : 'never'
  const customIncomingMethodUnion = customIncomingMethods.length ? customIncomingMethods.join(' | ') : 'never'
  const rpcHelpers = [
    `export type MessageKey = keyof MessageTypes`,
    `export type RpcIn<M extends MessageKey> = MessageTypes[M]['inParam']`,
    `export type RpcOut<M extends MessageKey> = MessageTypes[M]['outParam']`,
    `export type RpcResponse<M extends MessageKey> = {error: IncomingErrorCallback, result: (res: RpcOut<M>) => void}`,
    project.hasEngine
      ? `type PromiseMethod = ${promiseMethodUnion}
export type RpcFn<M extends PromiseMethod> = [RpcIn<M>] extends [undefined]
  ? (params?: undefined, waitingKey?: WaitingKey) => Promise<RpcOut<M>>
  : (params: RpcIn<M>, waitingKey?: WaitingKey) => Promise<RpcOut<M>>
const createRpc = <M extends PromiseMethod>(method: M): RpcFn<M> =>
  ((params?: RpcIn<M>, waitingKey?: WaitingKey) =>
    new Promise<RpcOut<M>>((resolve, reject) =>
      engine()._rpcOutgoing({
        method,
        params,
        callback: (error: SimpleError, result: RpcOut<M>) => error ? reject(error) : resolve(result),
        waitingKey,
      }))) as RpcFn<M>`
      : '',
    project.hasEngineListener
      ? `type ListenerMethod = ${listenerMethodUnion}
type ListenerArgs<M extends ListenerMethod> = {
  params: RpcIn<M>,
  incomingCallMap: IncomingCallMapType,
  customResponseIncomingCallMap?: CustomResponseIncomingCallMap,
  waitingKey?: WaitingKey,
}
export type ListenerFn<M extends ListenerMethod> = (p: ListenerArgs<M>) => Promise<RpcOut<M>>
const createListener = <M extends ListenerMethod>(method: M): ListenerFn<M> =>
  ((p: ListenerArgs<M>) =>
    getEngineListener<ListenerArgs<M>, Promise<RpcOut<M>>>()({
      method,
      params: p.params,
      incomingCallMap: p.incomingCallMap,
      customResponseIncomingCallMap: p.customResponseIncomingCallMap,
      waitingKey: p.waitingKey,
    })) as ListenerFn<M>`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
  const typePrelude = `/* eslint-disable */

// This file is auto-generated by client/protocol/Makefile.
${engineImport}
${project.import.map(n => importMap[n] || '').join('\n')}
${project.import.map(n => `export {${n}}`).join('\n')}
${project.hasEngine ? 'type WaitingKey = string | ReadonlyArray<string>' : ''}
type SimpleError = {code?: number, desc?: string}
export type IncomingErrorCallback = (err?: SimpleError | null) => void

`
  const consts = Object.keys(typeDefs.consts).map(k => typeDefs.consts[k])
  const types = Object.keys(typeDefs.types).map(k => typeDefs.types[k])
  const messagePromise = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].rpcPromise)
  const messageEngineListener = Object.keys(typeDefs.messages).map(k => typeDefs.messages[k].engineListener)
  const incomingMap = `\ntype IncomingMethod = ${incomingMethodUnion}
export type IncomingCallMapType = Partial<{[M in IncomingMethod]: (params: RpcIn<M>) => void}>`

  const customResponseIncomingMap = `\ntype CustomIncomingMethod = ${customIncomingMethodUnion}
export type CustomResponseIncomingCallMap = Partial<{[M in CustomIncomingMethod]: (params: RpcIn<M>, response: RpcResponse<M>) => void}>`

  const messageTypesData = Object.keys(typeDefs.messages)
    .map(k => {
      const data = typeDefs.messages[k]
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
    rpcHelpers,
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
  fs.writeFileSync(`js/${project.out}.tsx`, toWrite)
}

function decapitalize(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

function localCamelcase(s: string): string {
  if (!/[^A-Za-z0-9]/.test(s)) {
    return s
  }

  const parts = s.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (!parts.length) {
    return s
  }

  const [first, ...rest] = parts
  return (
    first.toLowerCase() +
    rest.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('')
  )
}

const shorthands: ReadonlyArray<{
  into: string
  into2: string
  re: RegExp
  re2: RegExp
}> = [
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

function camelcaseWithSpecialHandlings(s: string, shouldCapitalize: boolean): string {
  const capitalized = capitalize(localCamelcase(s))
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

  for (const shorthand of shorthands) {
    specialized = specialized.replace(shorthand.re2, shorthand.into2)
  }

  return decapitalize(specialized)
}

function lintTypedef(record: RecordDefinition, typedef: string | undefined): void {
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

function lintRecord(record: RecordDefinition): void {
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

function lintMessage(name: string, message: MessageDefinition): void {
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

function lintJSON(json: ProtocolJSON): void {
  const pName = camelcaseWithSpecialHandlings(json.protocol, true)
  if (pName !== json.protocol) {
    // Ignore protocol name lint errors by default
    // lintError(`Protocol names should be capitalized: ${json.protocol}`, 'ignore')
  }
}

function lintError(s: string, lint?: JsonLint): void {
  if (lint === 'ignore') {
    // console.log('Ignoring lint error:', colors.yellow(s))
  } else {
    console.log(colors.red(s))
    process.exit(1)
  }
}

async function main(): Promise<void> {
  const keys = Object.keys(projects)
  for (const key of keys) {
    const project = projects[key as ProjectKey]
    const typeDefs = fs
      .readdirSync(project.root)
      .filter(jsonOnly)
      .map(file => load(file, project))
      .map(json => analyze(json, project))
      .reduce<AnalysisResult>(
        (map, next) => {
          map.consts = {...map.consts, ...next.consts}
          map.types = {...map.types, ...next.types}
          map.messages = {...map.messages, ...next.messages}
          return map
        },
        {consts: {}, messages: {}, types: {}}
      )
    await writeFlow(typeDefs, project)
  }
  await writeAll()
  await writeActions()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
