// @flow
import logger from '../logger'
import * as RS from 'redux-saga'
import * as Effects from 'redux-saga/effects'
import {convertToError} from '../util/errors'
import * as ConfigGen from '../actions/config-gen'
import type {TypedState} from '../constants/reducer'
import type {TypedActions} from '../actions/typed-actions-gen'
import put from './typed-put'

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
// Similar to safeTakeEveryPure
function safeTakeLatestPure<A, R, FinalEffect, FinalErrorEffect>(
  pattern: RS.Pattern,
  pureWorker: ((action: A, state: TypedState) => any) | ((action: A) => any),
  actionCreatorsWithResult?: (result: R, action: A) => FinalEffect,
  actionCreatorsWithError?: (result: R, action: A) => FinalErrorEffect
) {
  const safeTakeLatestPureWorker = function* safeTakeLatestPureWorker(action: A) {
    // If the pureWorker fn takes two arguments, let's pass the state
    try {
      let result
      if (pureWorker.length === 2) {
        const state: TypedState = yield Effects.select(s => s)
        // $FlowIssue - doesn't understand checking for arity
        result = yield pureWorker(action, state)
      } else {
        // $FlowIssue - doesn't understand checking for arity
        result = yield pureWorker(action)
      }

      if (actionCreatorsWithResult) {
        // $FlowIssue confused
        yield actionCreatorsWithResult(result, action)
      }
    } catch (e) {
      if (actionCreatorsWithError) {
        // $FlowIssue confused
        yield actionCreatorsWithError(e, action)
      } else {
        yield Effects.put(
          ConfigGen.createGlobalError({
            globalError: convertToError(e),
          })
        )
      }
    } finally {
      if (actionCreatorsWithError) {
        if (yield Effects.cancelled()) {
          // $FlowIssue confused
          yield actionCreatorsWithError(new Error('Canceled'), action)
        }
      }
    }
  }
  // $FlowIssue confused
  return Effects.takeLatest(pattern, safeTakeLatestPureWorker)
}

function _safeTakeLatestWithCatch(
  pattern: RS.Pattern,
  catchHandler: Function,
  worker: Function | Generator<any, void, any>,
  ...args: Array<any>
) {
  const safeTakeLatestWithCatchWorker = function* safeTakeLatestWithCatchWorker(...args) {
    try {
      yield Effects.call(worker, ...args)
    } catch (error) {
      // Convert to global error so we don't kill the takeLatest loop
      yield Effects.put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
      yield Effects.call(catchHandler, error)
    } finally {
      if (yield Effects.cancelled()) {
        logger.info('safeTakeLatestWithCatch cancelled')
      }
    }
  }

  // $FlowIssue confused
  return Effects.takeLatest(pattern, safeTakeLatestWithCatchWorker, ...args)
}

// Likely avoid using this. Saga canceling is tricky
function safeTakeLatest(
  pattern: RS.Pattern,
  worker: Function | Generator<any, void, any>,
  ...args: Array<any>
) {
  return _safeTakeLatestWithCatch(pattern, () => {}, worker, ...args)
}

export type {Effect, PutEffect, Channel} from 'redux-saga'
export {buffers, channel, delay, eventChannel} from 'redux-saga'
export {
  all,
  call,
  cancel,
  cancelled,
  fork,
  join,
  race,
  select,
  spawn,
  take,
  takeEvery,
  takeLatest,
  throttle,
} from 'redux-saga/effects'

export {
  put,
  safeTakeEvery,
  safeTakeEveryPure,
  actionToPromise,
  actionToAction,
  safeTakeLatest,
  safeTakeLatestPure,
  sequentially,
}
