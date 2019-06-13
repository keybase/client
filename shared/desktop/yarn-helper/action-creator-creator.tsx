import prettier from 'prettier'
import path from 'path'
import json5 from 'json5'
import fs from 'fs'

interface Payload {
  _description?: string
}

type ErrorPayload = {
  canError: string
} & Payload

type ActionNS = string
type ActionName = string
type ActionDesc = any

type Actions = {[K in ActionName]: ActionDesc}

type FileDesc = {
  prelude: Array<string>
  actions: Actions
}

type CompileActionFn = (ns: ActionNS, actionName: ActionName, desc: ActionDesc) => string

const reservedPayloadKeys = ['_description']

function compile(ns: ActionNS, {prelude, actions}: FileDesc): string {
  return `// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
${prelude.join('\n')}

// Constants
export const resetStore = 'common:resetStore' // not a part of ${ns} but is handled by every reducer. NEVER dispatch this
export const typePrefix = '${ns}:'
${compileActions(ns, actions, compileReduxTypeConstant)}

// Payload Types
${compileActions(ns, actions, compilePayloadTypes)}

// Action Creators
${compileActions(ns, actions, compileActionCreator)}

// Action Payloads
${compileActions(ns, actions, compileActionPayloads)}

// All Actions
${compileAllActionsType(ns, actions)}  | {type: 'common:resetStore', payload: null}
  `
}

function canError(x: ActionDesc): x is ErrorPayload {
  return !!(x as ErrorPayload).canError
}

function compileAllActionsType(ns: ActionNS, actions: Actions): string {
  const actionsTypes = Object.keys(actions)
    .map(
      (name: ActionName) =>
        `${capitalize(name)}Payload` +
        (canError(actions[name]) ? `\n  | ${capitalize(name)}PayloadError` : '')
    )
    .sort()
    .join('\n  | ')
  return `// prettier-ignore
export type Actions =
  | ${actionsTypes}
`
}

function compileActions(ns: ActionNS, actions: Actions, compileActionFn: CompileActionFn): string {
  return Object.keys(actions)
    .map((actionName: ActionName) => compileActionFn(ns, actionName, actions[actionName]))
    .sort()
    .join('\n')
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1)
}

function payloadKeys(p: Object) {
  return Object.keys(p).filter(key => !reservedPayloadKeys.includes(key))
}

function payloadOptional(p: Object) {
  const keys = payloadKeys(p)
  return keys.length && keys.every(key => key.endsWith('?'))
}

function printPayload(p: Object) {
  return payloadKeys(p).length
    ? '{' +
        payloadKeys(p)
          .map(key => `readonly ${key}: ${Array.isArray(p[key]) ? p[key].join(' | ') : p[key]}`)
          .join(',\n') +
        '}'
    : 'void'
}

function compileActionPayloads(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  return (
    `export type ${capitalize(actionName)}Payload = {readonly payload: _${capitalize(
      actionName
    )}Payload, readonly type: typeof ${actionName}}` +
    (canError(desc)
      ? `\n export type ${capitalize(
          actionName
        )}PayloadError = {readonly error: true, readonly payload: _${capitalize(
          actionName
        )}PayloadError, readonly type: typeof ${actionName}}`
      : '')
  )
}

function compilePayloadTypes(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  const {canError, ...noErrorPayload} = desc as ErrorPayload

  return (
    `type _${capitalize(actionName)}Payload = ${printPayload(noErrorPayload)}` +
    (canError ? `\n type _${capitalize(actionName)}PayloadError = ${printPayload(canError)}` : '')
  )
}

function compileActionCreator(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  const {canError: canErrorStr, ...noErrorPayload} = desc as ErrorPayload
  return (
    (desc._description
      ? `/**
     * ${desc._description}
     */
    `
      : '') +
    `export const create${capitalize(actionName)} = (payload: _${capitalize(actionName)}Payload${
      payloadOptional(noErrorPayload) ? ' = Object.freeze({})' : ''
    }): ${capitalize(actionName)}Payload => (
  { payload, type: ${actionName}, }
)` +
    (canError(desc)
      ? `\n export const create${capitalize(actionName)}Error = (payload: _${capitalize(
          actionName
        )}PayloadError): ${capitalize(actionName)}PayloadError  => (
    { error: true, payload, type: ${actionName}, }
  )`
      : '')
  )
}

function compileReduxTypeConstant(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  return `export const ${actionName} = '${ns}:${actionName}'`
}

const cleanName = c => c.replace(/-/g, '')
function makeTypedActions(created) {
  return `// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */
  ${created.map(c => `import {Actions as ${cleanName(c)}Actions} from './${c}-gen'`).join('\n')}

  export type TypedActions = ${created.map(c => `${cleanName(c)}Actions`).join(' | ')}
`
}

function main() {
  const root = path.join(__dirname, '../../actions/json')
  const files = fs.readdirSync(root)
  const created = []
  files
    .filter(file => path.extname(file) === '.json')
    .forEach(file => {
      const ns = path.basename(file, '.json')
      created.push(ns)
      console.log(`Generating ${ns}`)
      const desc = json5.parse(fs.readFileSync(path.join(root, file)))
      const outPath = path.join(root, '..', ns + '-gen.tsx')
      const generated = prettier.format(compile(ns, desc), {
        ...prettier.resolveConfig.sync(outPath),
        parser: 'typescript',
      })
      fs.writeFileSync(outPath, generated)
    })

  console.log(`Generating typed-actions-gen`)
  const outPath = path.join(root, '..', 'typed-actions-gen.tsx')
  const typedActions = makeTypedActions(created)
  const generated = prettier.format(typedActions, prettier.resolveConfig.sync(outPath))
  fs.writeFileSync(outPath, generated)
}

main()
