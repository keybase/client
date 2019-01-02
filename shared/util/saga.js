// @flow
import logger from '../logger'
import * as RS from 'redux-saga'
import * as Effects from 'redux-saga/effects'
import {convertToError} from '../util/errors'
import * as ConfigGen from '../actions/config-gen'
import type {TypedState} from '../constants/reducer'
import type {TypedActions} from '../actions/typed-actions-gen'
import put from './typed-put'
import {isArray} from 'lodash-es'

export type SagaGenerator<Yield, Actions> = Generator<Yield, void, Actions>

function safeTakeEvery(
  pattern: RS.Pattern,
  worker: Function
): RS.ForkEffect<null, Function, $ReadOnlyArray<any>> {
  const safeTakeEveryWorker = function* safeTakeEveryWorker(action: TypedActions): RS.Saga<void> {
    try {
      yield Effects.call(worker, action)
    } catch (error) {
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        logger.info('safeTakeEvery cancelled')
      }
    }
  }

  return Effects.takeEvery(pattern, safeTakeEveryWorker)
}

// Useful in safeTakeEveryPure when you have an array of effects you want to run in order
function* sequentially(effects: Array<any>): Generator<any, Array<any>, any> {
  const results = []
  for (let i = 0; i < effects.length; i++) {
    results.push(yield effects[i])
  }
  return results
}

// TODO I couldn't get flow to figure out how to infer this, or even force you to explicitly do it
// maybe flow-strict fixes this
type MaybeAction = void | boolean | TypedActions | null
function* chainAction<Actions>(
  pattern: RS.Pattern,
  f: (
    state: TypedState,
    action: Actions
  ) => MaybeAction | $ReadOnlyArray<MaybeAction> | Promise<MaybeAction | $ReadOnlyArray<MaybeAction>>
): Generator<any, void, any> {
  type Fn = Actions => RS.Saga<void>
  return yield Effects.takeEvery<Actions, void, Fn>(pattern, function* chainActionHelper(
    action: Actions
  ): RS.Saga<void> {
    try {
      const state = yield* selectState()
      let toPut = yield Effects.call(f, state, action)
      if (toPut) {
        const outActions: Array<TypedActions> = isArray(toPut) ? toPut : [toPut]
        for (var out of outActions) {
          if (out) {
            yield Effects.put(out)
          }
        }
      }
    } catch (error) {
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        logger.info('chainAction cancelled')
      }
    }
  })
}

function* chainGenerator<Actions>(
  pattern: RS.Pattern,
  f: (state: TypedState, action: Actions) => Generator<any, void, any>
): Generator<any, void, any> {
  type Fn = Actions => RS.Saga<void>
  return yield Effects.takeEvery<Actions, void, Fn>(pattern, function* chainActionHelper(
    action: Actions
  ): RS.Saga<void> {
    try {
      const state = yield* selectState()
      yield* f(state, action)
    } catch (error) {
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        logger.info('chainGenerator cancelled')
      }
    }
  })
}

// Helper that expects a function which returns a promise that resolves to a put
function actionToPromise<A>(
  pattern: RS.Pattern,
  f: (state: TypedState, action: A) => null | false | void | Promise<TypedActions | null | false | void>
) {
  return Effects.takeEvery(pattern, function* actionToPromiseHelper(action: A): RS.Saga<void> {
    try {
      const state: TypedState = yield Effects.select()
      const toPut = yield Effects.call(f, state, action)
      if (toPut) {
        yield Effects.put(toPut)
      }
    } catch (error) {
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        logger.info('actionToPromise cancelled')
      }
    }
  })
}

// like safeTakeEveryPure but simpler, only 2 params and gives you a state first
function actionToAction<A, E>(pattern: RS.Pattern, f: (state: TypedState, action: A) => E) {
  return Effects.takeEvery(pattern, function* actionToActionHelper(action: A): Generator<any, void, any> {
    try {
      const state: TypedState = yield Effects.select()
      yield f(state, action)
    } catch (error) {
      // Convert to global error so we don't kill the takeEvery loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield Effects.cancelled()) {
        logger.info('actionToAction cancelled')
      }
    }
  })
}

// Like safeTakeEvery but the worker is pure (not a generator) optionally pass in a third argument
// Which is a selector function that will select some state and pass it to pureWorker
// whatever purework returns will be yielded on.
// i.e. it can return put(someAction). That effectively transforms the input action into another action
// It can also return all([put(action1), put(action2)]) to dispatch multiple actions
function safeTakeEveryPure<A, R, FinalEffect, FinalErrorEffect>(
  pattern: RS.Pattern,
  pureWorker: (action: A, state: TypedState) => any,
  actionCreatorsWithResult?: ?(result: R, action: A, updatedState: TypedState) => FinalEffect,
  actionCreatorsWithError?: ?(result: R, action: A) => FinalErrorEffect
) {
  return safeTakeEvery(pattern, function* safeTakeEveryPureWorker(action: A) {
    // If the pureWorker fn takes two arguments, let's pass the state
    try {
      const state: TypedState = yield Effects.select()
      const result = yield pureWorker(action, state)

      if (actionCreatorsWithResult) {
        if (actionCreatorsWithResult.length === 3) {
          // add a way to get the updated state
          const state: TypedState = yield Effects.select()
          yield actionCreatorsWithResult(result, action, state)
        } else {
          // $FlowIssue we pass undefined if they don't use it
          yield actionCreatorsWithResult(result, action, undefined)
        }
      }
    } catch (e) {
      if (actionCreatorsWithError) {
        yield actionCreatorsWithError(e, action)
      } else {
        yield Effects.put(
          ConfigGen.createGlobalError({
            globalError: convertToError(e),
          })
        )
      }
    }
  })
}

/***
 * Note: Due to how flow handles generators (https://github.com/facebook/flow/issues/2613), when you
 * const values = yield Saga.call(myFunction, param1, param2)
 * values will be of type any. In order to work around this, you can instead do
 * const values = yield * Saga.callPromise(myFunction, param1, param2) and values will be typed
 *
 * Here is a rule of thumb when to use callUntyped vs callPromise
 * If you are yielding inside your own generator, you should yield * callPromise
 * Otherwise you can use callUntyped, for example if you have a side effect that returns a call to redux-saga (aka you
 * don't consume it) then you can use callUntyped (we don't care what we return to redux saga basically)
 *
 * I don't love this but I think most of the calls we make likely don't need to exist outside of rpcs call. Those can
 * all be of the form yield * Saga.callPromise
 *
 */
function* callPromise<Args, T>(fn: (...args: Args) => Promise<T>, ...args: Args): Generator<any, T, any> {
  // $FlowIssue doesn't understand args will be an array
  return yield Effects.call(fn, ...args)
}
// Used to delegate in a typed way to what engine saga returns. short term use this but longer term
// generate generators instead and yield * directly
function* callRPCs(e: RS.CallEffect<any, any, any>): Generator<any, void, any> {
  return yield e
}

function* selectState(): Generator<any, TypedState, any> {
  const state: TypedState = yield Effects.select()
  return state
}

export type {Effect, PutEffect, Channel} from 'redux-saga'
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

export {
  selectState,
  put,
  safeTakeEvery,
  safeTakeEveryPure,
  actionToPromise,
  actionToAction,
  sequentially,
  callPromise,
  chainAction,
  chainGenerator,
  callRPCs,
}
