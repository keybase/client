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
  prelude: Array<string>, // anything to prepend to our generated file
  actions: Actions,
}

type CompileActionFn = (ns: ActionNS, actionName: ActionName, desc: ActionDesc) => string

function compile(ns: ActionNS, {prelude, actions}: FileDesc): string {
  return `// @flow
/* eslint-disable */
import {type PayloadType, type ReturnType} from '../constants/types/more'
${prelude.join('\n')}

// Constants
${compileActions(ns, actions, compileReduxTypeConstant)}

// Action Creators
${compileActions(ns, actions, compileActionCreator)}

// Action Payloads
${compileActions(ns, actions, compileActionPayloads)}

// All Actions
${compileAllActionsType(ns, actions)}
  `
}

function compileAllActionsType(ns: ActionNS, actions: Actions): string {
  const actionsTypes = Object.keys(actions)
    .map(
      (name: ActionName) =>
        `ReturnType<typeof create${capitalize(name)}>` +
        (actions[name].canError ? `\n  | ReturnType<typeof create${capitalize(name)}Error>` : '')
    )
    .sort()
    .join('\n  | ')
  return `// prettier-ignore
export type Actions =
  | ${actionsTypes}`
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
    ? '(payload: {|' + Object.keys(p).map(key => `${key}: ${p[key]}`).join(',\n') + '|})'
    : '()'
}

function compileActionPayloads(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  return `export type ${capitalize(actionName)}Payload = ReturnType<typeof create${capitalize(actionName)}>`
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
    const desc = json5.parse(fs.readFileSync(path.join(root, file)))
    const generated = prettier.format(compile(ns, desc), prettierOptions)
    const outPath = path.join(root, '..', ns + '-gen.js')
    console.log(generated)
    fs.writeFileSync(outPath, generated)
  })
}

main()
