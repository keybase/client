import logger from '../logger'
import {LogFn} from '../logger/types'
import * as RS from 'redux-saga'
import * as Types from '@redux-saga/types'
import * as Effects from 'redux-saga/effects'
import {convertToError} from './errors'
import * as ConfigGen from '../actions/config-gen'
import {TypedState} from '../constants/reducer'
import {TypedActions, TypedActionsMap} from '../actions/typed-actions-gen'
import put from './typed-put'
import isArray from 'lodash/isArray'

type ActionType = keyof TypedActionsMap

export class SagaLogger {
  error: LogFn
  warn: LogFn
  info: LogFn
  debug: LogFn
  isTagged = false
  constructor(actionType: ActionType, fcnTag: string) {
    const prefix = `${fcnTag} [${actionType}]:`
    this.debug = (...args) => logger.debug(prefix, ...args)
    this.error = (...args) => logger.error(prefix, ...args)
    this.info = (...args) => logger.info(prefix, ...args)
    this.warn = (...args) => logger.warn(prefix, ...args)
  }
  // call this first in your saga if you want chainAction / chainGenerator to log
  // before and after you run
  tag = () => {
    this.info('->')
    this.isTagged = true
  }
}

// Useful in safeTakeEveryPure when you have an array of effects you want to run in order
function* sequentially(effects: Array<any>): Generator<any, Array<any>, any> {
  const results: Array<unknown> = []
  for (let i = 0; i < effects.length; i++) {
    results.push(yield effects[i])
  }
  return results
}

export type MaybeAction = void | boolean | TypedActions | TypedActions[] | null

type ActionTypes = keyof TypedActionsMap
export type ChainActionReturn =
  | void
  | TypedActions
  | null
  | boolean
  | Array<ChainActionReturn>
  | Promise<ChainActionReturn>
//
// Get the values of an Array. i.e. ValuesOf<["FOO", "BAR"]> => "FOO" | "BAR"
type ValuesOf<T extends any[]> = T[number]

interface ChainAction2 {
  <AT extends ActionTypes>(
    actions: AT,
    handler: (state: TypedState, action: TypedActionsMap[AT], logger: SagaLogger) => ChainActionReturn
  ): Generator<void, void, void>

  <AT extends ActionTypes[]>(
    actions: AT,
    handler: (
      state: TypedState,
      action: TypedActionsMap[ValuesOf<AT>],
      logger: SagaLogger
    ) => ChainActionReturn
  ): Generator<void, void, void>
}
interface ChainAction {
  <AT extends ActionTypes>(
    actions: AT,
    handler: (action: TypedActionsMap[AT], logger: SagaLogger) => ChainActionReturn
  ): Generator<void, void, void>

  <AT extends ActionTypes[]>(
    actions: AT,
    handler: (action: TypedActionsMap[ValuesOf<AT>], logger: SagaLogger) => ChainActionReturn
  ): Generator<void, void, void>
}

function* chainAction2Impl<Actions extends {readonly type: string}>(
  pattern: Types.Pattern<any>,
  f: (state: TypedState, action: Actions, logger: SagaLogger) => ChainActionReturn
) {
  return yield Effects.takeEvery<TypedActions>(pattern as Types.Pattern<any>, function* chainAction2Helper(
    action: TypedActions
  ) {
    const sl = new SagaLogger(action.type as ActionType, f.name ?? 'unknown')
    try {
      let state: TypedState = yield* selectState()
      // @ts-ignore
      const toPut = yield Effects.call(f, state, action, sl)
      // release memory
      // @ts-ignore
      action = undefined
      // @ts-ignore
      state = undefined
      if (toPut) {
        const outActions: Array<TypedActions> = isArray(toPut) ? toPut : [toPut]
        for (var out of outActions) {
          if (out) {
            yield Effects.put(out)
          }
        }
      }
      if (sl.isTagged) {
        sl.info('-> ok')
      }
    } catch (error) {
      sl.warn(error.message)
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        sl.info('chainAction cancelled')
      }
    }
  })
}

export const chainAction2: ChainAction2 = (chainAction2Impl as unknown) as any

function* chainActionImpl<Actions extends {readonly type: string}>(
  pattern: Types.Pattern<any>,
  f: (action: Actions, logger: SagaLogger) => ChainActionReturn
) {
  return yield Effects.takeEvery<TypedActions>(pattern as Types.Pattern<any>, function* chainActionHelper(
    action: TypedActions
  ) {
    const sl = new SagaLogger(action.type as ActionType, f.name ?? 'unknown')
    try {
      // @ts-ignore
      const toPut = yield Effects.call(f, action, sl)
      // release memory
      // @ts-ignore
      action = undefined
      if (toPut) {
        const outActions: Array<TypedActions> = isArray(toPut) ? toPut : [toPut]
        for (var out of outActions) {
          if (out) {
            yield Effects.put(out)
          }
        }
      }
      if (sl.isTagged) {
        sl.info('-> ok')
      }
    } catch (error) {
      sl.warn(error.message)
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        sl.info('chainAction cancelled')
      }
    }
  })
}
export const chainAction: ChainAction = (chainActionImpl as unknown) as any

function* chainGenerator<
  Actions extends {
    readonly type: string
  }
>(
  pattern: Types.Pattern<any>,
  f: (state: TypedState, action: Actions, logger: SagaLogger) => Generator<any, any, any>
): Generator<any, void, any> {
  // @ts-ignore TODO fix
  return yield Effects.takeEvery<Actions>(pattern, function* chainGeneratorHelper(action: Actions) {
    const sl = new SagaLogger(action.type as ActionType, f.name ?? 'unknown')
    try {
      const state: TypedState = yield* selectState()
      yield* f(state, action, sl)
      if (sl.isTagged) {
        sl.info('-> ok')
      }
    } catch (error) {
      sl.warn(error.message)
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        sl.info('chainGenerator cancelled')
      }
    }
  })
}

function* selectState(): Generator<any, TypedState, void> {
  // @ts-ignore codemod issue
  const state: TypedState = yield Effects.select()
  return state
}

/**
 * The return type of an rpc to help typing yields
 */
export type RPCPromiseType<F extends (...rest: any[]) => any, RF = ReturnType<F>> = RF extends Promise<
  infer U
>
  ? U
  : RF

export type Effect<T> = Types.Effect<T>
export type PutEffect = Effects.PutEffect<TypedActions>
export type Channel<T> = RS.Channel<T>
export {buffers, channel, eventChannel} from 'redux-saga'
export {
  all,
  call as callUntyped,
  cancel,
  cancelled,
  delay,
  fork as _fork, // fork is pretty unsafe so lets mark it unusually
  join,
  race,
  spawn,
  take,
  takeEvery,
  takeLatest,
  throttle,
} from 'redux-saga/effects'

export {selectState, put, sequentially, chainGenerator}
