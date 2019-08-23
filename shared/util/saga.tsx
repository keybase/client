import logger from '../logger'
import {LogFn} from '../logger/types'
import * as RS from 'redux-saga'
import * as Effects from 'redux-saga/effects'
import {convertToError} from '../util/errors'
import * as ConfigGen from '../actions/config-gen'
import {TypedState} from '../constants/reducer'
import {TypedActions, TypedActionsMap} from '../actions/typed-actions-gen'
import put from './typed-put'
import {isArray} from 'lodash-es'

export type SagaGenerator<Yield, Actions> = IterableIterator<Yield | Actions>

export class SagaLogger {
  error: LogFn
  warn: LogFn
  info: LogFn
  debug: LogFn
  isTagged = false
  constructor(actionType, fcnTag) {
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
function* sequentially(effects: Array<any>): Iterable<Array<any>> {
  const results: Array<unknown> = []
  for (let i = 0; i < effects.length; i++) {
    results.push(yield effects[i])
  }
  return results
}

export type MaybeAction = void | boolean | TypedActions | TypedActions[] | null

type ActionTypes = keyof TypedActionsMap
type ChainActionReturnInner = void | false | TypedActions | null
type ChainActionReturnInPromise = ChainActionReturnInner | Array<ChainActionReturnInner>
export type ChainActionReturn = ChainActionReturnInPromise | Promise<ChainActionReturnInPromise>
//
// Get the values of an Array. i.e. ValuesOf<["FOO", "BAR"]> => "FOO" | "BAR"
type ValuesOf<T extends any[]> = T[number]

interface ChainAction {
  <AT extends ActionTypes>(
    actions: AT,
    handler: (state: TypedState, action: TypedActionsMap[AT], logger: SagaLogger) => ChainActionReturn,
    loggerTag?: string
  ): IterableIterator<any>

  <AT extends ActionTypes[]>(
    actions: AT,
    handler: (
      state: TypedState,
      action: TypedActionsMap[ValuesOf<AT>],
      logger: SagaLogger
    ) => ChainActionReturn,
    loggerTag?: string
  ): IterableIterator<any>
}

/**
 * TODO deprecated less typed version. Use chainAction2 instead
 */
function* chainAction<Actions extends {readonly type: string}>(
  pattern: RS.Pattern,
  f: (state: TypedState, action: Actions, logger: SagaLogger) => ChainActionReturn,
  loggerTag?: string
) {
  // @ts-ignore
  return yield Effects.takeEvery<TypedActions>(pattern as RS.Pattern, function* chainActionHelper(
    action: TypedActions
  ) {
    const sl = new SagaLogger(action.type, loggerTag || 'unknown')
    try {
      const state: TypedState = yield* selectState()
      // @ts-ignore
      let toPut = yield Effects.call(f, state, action, sl)
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

export const chainAction2: ChainAction = (chainAction as unknown) as any

function* chainGenerator<
  Actions extends {
    readonly type: string
  }
>(
  pattern: RS.Pattern,
  f: (state: TypedState, action: Actions, logger: SagaLogger) => Iterable<any>,
  // tag for logger
  fcnTag?: string
): Iterable<any> {
  // @ts-ignore TODO fix
  return yield Effects.takeEvery<Actions>(pattern, function* chainGeneratorHelper(action: Actions) {
    const sl = new SagaLogger(action.type, fcnTag || 'unknown')
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

/***
 * Until TS 3.6 this can't be property typed: https://github.com/Microsoft/TypeScript/issues/2983
 */
function* callPromise<Args, T>(
  fn: (...args: Array<Args>) => Promise<T>,
  ...args: Array<Args>
): Iterable<any> {
  // @ts-ignore
  return yield Effects.call(fn, ...args)
}

// Used to delegate in a typed way (NOT WITH TS anymore) to what engine saga returns. short term use this but longer term
// generate generators instead and yield * directly
function* callRPCs(e: Effects.CallEffect): Iterable<any> {
  return yield e
}
function* selectState(): Iterable<TypedState> {
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

export type Effect = RS.Effect
export type PutEffect = Effects.PutEffect<TypedActions>
export type Channel<T> = RS.Channel<T>
export {buffers, channel, delay, eventChannel} from 'redux-saga'
export {
  all,
  call as callUntyped,
  cancel,
  cancelled,
  fork as _fork, // fork is pretty unsafe so lets mark it unusually
  join,
  race,
  spawn,
  take,
  takeEvery,
  takeLatest,
  throttle,
} from 'redux-saga/effects'

export {selectState, put, sequentially, chainGenerator, callPromise, callRPCs}
