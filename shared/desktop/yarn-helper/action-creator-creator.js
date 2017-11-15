// @flow
import prettier from 'prettier'
import path from 'path'
import json5 from 'json5'
import fs from 'fs'

type Payload = Object
type ErrorPayload = {
  canError: string,
  ...Payload,
}

type ActionNS = string
type ActionName = string
type ActionDesc = Payload | ErrorPayload

type Actions = {[key: ActionName]: ActionDesc}

type FileDesc = {
  skipReducer?: boolean, // doens't have a matching reducer so don't pull in Types to get state and don't gen the reducer map
  prelude: Array<string>, // anything to prepend to our generated file
  actions: Actions,
}

type CompileActionFn = (ns: ActionNS, actionName: ActionName, desc: ActionDesc) => string

const resetStore = `'common:resetStore'`

function compile(ns: ActionNS, {prelude, actions, skipReducer}: FileDesc): string {
  return `// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
${skipReducer ? '' : `import * as Types from '../constants/types/${ns}'`}
${prelude.join('\n')}

// Constants
export const resetStore = ${resetStore} // not a part of ${ns} but is handled by every reducer
${compileActions(ns, actions, compileReduxTypeConstant)}

// Action Creators
${compileActions(ns, actions, compileActionCreator)}

// Action Payloads
${compileActions(ns, actions, compileActionPayloads)}

// Reducer type
${skipReducer ? '// Skipped' : compileReducer(ns, actions)}

// All Actions
${compileAllActionsType(ns, actions)} | {type: ${resetStore}, payload: void}
  `
}

function compileReducer(ns: ActionNS, actions: Actions): string {
  const m = Object.keys(actions)
    .map(
      (name: ActionName) =>
        `'${ns}:${name}': (state: Types.State, action: ${capitalize(name)}Payload${actions[name].canError ? `|${capitalize(name)}ErrorPayload` : ''}) => Types.State`
    )
    .concat(
      `${resetStore}: (state: Types.State, action: {type: ${resetStore}, payload: void}) => Types.State`
    )
    .sort()
    .join(', ')
  return `// prettier-ignore
  export type ReducerMap = {|${m}|}`
}

function compileAllActionsType(ns: ActionNS, actions: Actions): string {
  const actionsTypes = Object.keys(actions)
    .map(
      (name: ActionName) =>
        `${capitalize(name)}Payload${actions[name].canError ? `\n | ${capitalize(name)}ErrorPayload` : ''}`
    )
    .sort()
    .join(' | ')
  return `// prettier-ignore
export type Actions = ${actionsTypes}`
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

function actionReduxTypeName(ns: ActionNS, actionName: ActionName): string {
  return `'${ns}:${actionName}'`
}

function printPayload(p: Object) {
  return Object.keys(p).length
    ? '(payload: {|' + Object.keys(p).map(key => `+${key}: ${p[key]}`).join(',\n') + '|})'
    : '()'
}

function compileActionPayloads(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  return (
    `export type ${capitalize(actionName)}Payload = More.ReturnType<typeof create${capitalize(actionName)}>` +
    (desc.canError
      ? `
export type ${capitalize(actionName)}ErrorPayload = More.ReturnType<typeof create${capitalize(actionName)}Error>`
      : '')
  )
}

function compileActionCreator(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  const {canError, ...noErrorPayload} = desc

  return (
    `export const create${capitalize(actionName)} = ${printPayload(noErrorPayload)} => (
  { error: false, payload${Object.keys(noErrorPayload).length ? '' : ': undefined'}, type: ${actionName}, }
)` +
    (canError
      ? `
  export const create${capitalize(actionName)}Error = ${printPayload(canError)} => (
    { error: true, payload${Object.keys(canError).length ? '' : ': undefined'}, type: ${actionName}, }
  )`
      : '')
  )
}

function compileReduxTypeConstant(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  return `export const ${actionName} = ${actionReduxTypeName(ns, actionName)}`
}

// load prettier rules from eslintrc
const prettierOptions = json5.parse(
  fs.readFileSync(path.join(__dirname, '../../../.eslintrc'), {encoding: 'utf8'})
).rules['prettier/prettier'][1]

// Allow extra wide
prettierOptions.printWidth = 500

function main() {
  const root = path.join(__dirname, '../../actions/json')
  const files = fs.readdirSync(root)
  files.filter(file => path.extname(file) === '.json').forEach(file => {
    const ns = path.basename(file, '.json')
    console.log(`Generating ${ns}`)
    const desc = json5.parse(fs.readFileSync(path.join(root, file)))
    const generated = prettier.format(compile(ns, desc), prettierOptions)
    const outPath = path.join(root, '..', ns + '-gen.js')
    console.log(generated)
    fs.writeFileSync(outPath, generated)
  })
}

main()
