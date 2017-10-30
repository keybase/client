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
  prelude: string, // anything to prepend to our generated file
  actions: Actions,
}

type CompileActionFn = (ns: ActionNS, actionName: ActionName, desc: ActionDesc) => string

function compile(ns: ActionNS, {prelude, actions}: FileDesc): string {
  return `// @flow
/* eslint-disable */
${prelude}

type _ExtractReturn<B, F: (...args: any[]) => B> = B
export type ReturnType<F> = _ExtractReturn<*, F>
export type PayloadType<F> = $PropertyType<ReturnType<F>, 'payload'>

// Constants
${compileActions(ns, actions, compileReduxTypeConstant)}

// Action Creators
${compileActions(ns, actions, compileActionCreator)}

// All Actions
${compileAllActionsType(ns, actions)}
  `
}

function compileAllActionsType(ns: ActionNS, actions: Actions): string {
  return `export type Actions = ${Object.keys(actions)
    .map((name: ActionName) => `ReturnType<typeof create${capitalize(name)}>`)
    .join('|')}`
}

function compileActions(ns: ActionNS, actions: Actions, compileActionFn: CompileActionFn): string {
  return Object.keys(actions)
    .map((actionName: ActionName) => compileActionFn(ns, actionName, actions[actionName]))
    .join('\n')
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1)
}

function actionReduxTypeName(ns: ActionNS, actionName: ActionName): string {
  return `'${ns}:${actionName}'`
}

function printPayload(p: Object) {
  return '{|' + Object.keys(p).map(key => `${key}: ${p[key]}`).join(',\n') + '|}'
}

function compileActionCreator(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  const {canError, ...noErrorPayload} = desc
  return (
    `export const create${capitalize(actionName)} = (payload: ${printPayload(noErrorPayload)}) => (
  {
    type: ${actionName},
    payload,
  }
)` +
    (canError
      ? `

export const create${capitalize(actionName)}Error = (payload: ${printPayload(canError)}) => (
  {
    type: ${actionName},
    error: true,
    payload,
  }
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
