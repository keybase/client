import * as ConfigGen from '../actions/config-gen'
import * as Effects from 'redux-saga/effects'
import logger from '../logger'
import put from './typed-put'
import type * as RS from 'redux-saga'
import type * as Types from '@redux-saga/types'
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'
import {convertToError} from './errors'

// Useful in safeTakeEveryPure when you have an array of effects you want to run in order
function* sequentially(effects: Array<any>): Generator<any, Array<any>, any> {
  const results: Array<unknown> = []
  for (const effect of effects) {
    results.push(yield effect)
  }
  return results
}

export type MaybeAction = boolean | TypedActions | TypedActions[] | null

function* chainGenerator<
  Actions extends {
    readonly type: string
  }
>(
  pattern: Types.Pattern<any>,
  f: (state: TypedState, action: Actions) => Generator<any, any, any>
): Generator<any, void, any> {
  // @ts-ignore TODO fix
  return yield Effects.takeEvery<Actions>(pattern, function* chainGeneratorHelper(action: Actions) {
    try {
      const state: TypedState = yield* selectState()
      yield* f(state, action)
    } catch (error_) {
      const error = error_ as any
      logger.warn(error.message)
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error as Object),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        logger.info('chainGenerator cancelled')
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
