// @flow
import prettier from 'prettier'

type Payload = Object
type ErrorPayload = {
  canError: string,
  ...Payload,
}

type ActionName = string
type ActionDesc = Payload | ErrorPayload

type ActionNS = string
type Actions = {[key: ActionName]: ActionDesc}

type ActionDescMap = {
  [key: ActionNS]: Actions,
}

type FileDesc = {
  prelude: string, // anything to prepend to our generated file
  actions: ActionDescMap,
}

// TODO read something like this from a file
// You can do require('.*.json')
const parsed: FileDesc = {
  prelude: "import * as Blah from './yo'",
  actions: {
    chat: {
      deleteRoom: {
        foo: 'Blah.yo',
        bar: 'number',
        canError: {
          errorCode: 'number',
        },
      },
      addRoom: {
        bam: 'string',
      },
    },
    devices: {},
  },
}

function compile({prelude, actions}: FileDesc): string {
  return `${prelude}

${compileActionDescMap(actions, compileActionType)}
${compileActionDescMap(actions, compileActionCreator)}
${compileActionDescMap(actions, compileReduxTypeConstant)}
  `
}

type CompileActionFn = (ns: ActionNS, actionName: ActionName, desc: ActionDesc) => string

function compileActionDescMap(actionDescMap: ActionDescMap, compileActionFn: CompileActionFn): string {
  return Object.keys(actionDescMap)
    .map((ns: ActionNS) => compileActions(ns, actionDescMap[ns], compileActionFn))
    .join('\n')
}

function compileActions(ns: ActionNS, actions: Actions, compileActionFn: CompileActionFn): string {
  return Object.keys(actions)
    .map((actionName: ActionName) => compileActionFn(ns, actionName, actions[actionName]))
    .join('\n')
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1)
}

function actionTypeName(ns: ActionNS, actionName: ActionName): string {
  return `${capitalize(ns)}${capitalize(actionName)}`
}

function actionReduxTypeName(ns: ActionNS, actionName: ActionName): string {
  return `'${ns}:${actionName}'`
}

function compileActionType(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  if (!desc.canError) {
    return `export type ${actionTypeName(ns, actionName)} = NoErrorTypedAction<${actionReduxTypeName(ns, actionName)}, ${JSON.stringify(desc)}>`
  }

  const {canError: errorPayload, ...noErrorPayload} = desc
  return `export type ${actionTypeName(ns, actionName)} = TypedAction<${actionReduxTypeName(ns, actionName)}, ${JSON.stringify(noErrorPayload)}, ${JSON.stringify(errorPayload)}>`
}

function compileActionCreator(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  const {canError, ...noErrorPayload} = desc
  return (
    `export function create${capitalize(ns)}${capitalize(actionName)}(payload: ${JSON.stringify(noErrorPayload)}): ${actionTypeName(ns, actionName)} {
  return {
    type: ${actionReduxTypeName(ns, actionName)},
    payload,
  }
}` +
    (canError
      ? `

export function create${capitalize(ns)}${capitalize(actionName)}Error(payload: ${JSON.stringify(canError)}): ${actionTypeName(ns, actionName)} {
  return {
    type: ${actionReduxTypeName(ns, actionName)},
    error: true,
    payload,
  }
}`
      : '')
  )
}

function compileReduxTypeConstant(ns: ActionNS, actionName: ActionName, desc: ActionDesc) {
  return `export const ${ns}${capitalize(actionName)} = ${actionReduxTypeName(ns, actionName)}`
}

const prettierOptions = {
  semi: false,
  printWidth: 110,
  trailingComma: 'es5',
  singleQuote: true,
  tabWidth: 2,
  parser: 'flow',
  bracketSpacing: false,
}

export {parsed}
export default (desc: FileDesc) => prettier.format(compile(desc), prettierOptions)
