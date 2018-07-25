// @flow
import logger from '../logger'
import * as RS from 'redux-saga'
import * as Effects from 'redux-saga/effects'
import * as ConfigGen from '../actions/config-gen'
import {convertToError} from '../util/errors'
import type {Action} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

export type SagaGenerator<Yield, Actions> = Generator<Yield, void, Actions>

function safeTakeEvery(
  pattern: RS.Pattern,
  worker: Function
): RS.ForkEffect<null, Function, $ReadOnlyArray<any>> {
  const safeTakeEveryWorker = function* safeTakeEveryWorker(action: Action): RS.Saga<void> {
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
function actionToPromise<A, RA>(
  pattern: RS.Pattern,
  f: (state: TypedState, action: A) => null | false | Promise<RA>
) {
  return safeTakeEvery(pattern, function*(action: A) {
    const state: TypedState = yield Effects.select()
    const toPut = yield Effects.call(f, state, action)
    if (toPut) {
      yield Effects.put(toPut)
    }
  })
}

// like safeTakeEveryPure but simpler, only 2 params and gives you a state first
function actionToAction<A, FinalAction>(
  pattern: RS.Pattern,
  f: (state: TypedState, action: A) => null | false | FinalAction
) {
  return safeTakeEvery(pattern, function*(action: A) {
    const state: TypedState = yield Effects.select()
    yield f(state, action)
  })
}

// Like safeTakeEvery but the worker is pure (not a generator) optionally pass in a third argument
// Which is a selector function that will select some state and pass it to pureWorker
// whatever purework returns will be yielded on.
// i.e. it can return put(someAction). That effectively transforms the input action into another action
// It can also return all([put(action1), put(action2)]) to dispatch multiple actions
function safeTakeEveryPure<A, R, FinalAction, FinalActionError>(
  pattern: RS.Pattern,
  pureWorker: ((action: A, state: TypedState) => any) | ((action: A) => any),
  actionCreatorsWithResult?: ?(result: R, action: A, updatedState: TypedState) => FinalAction,
  actionCreatorsWithError?: ?(result: R, action: A) => FinalActionError
) {
  return safeTakeEvery(pattern, function* safeTakeEveryPureWorker(action: A) {
    // If the pureWorker fn takes two arguments, let's pass the state
    try {
      let result
      if (pureWorker.length === 2) {
        const state: TypedState = yield Effects.select()
        // $FlowIssue - doesn't understand checking for arity
        result = yield pureWorker(action, state)
      } else {
        // $FlowIssue - doesn't understand checking for arity
        result = yield pureWorker(action)
      }

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
function safeTakeLatestPure<A, R, FinalAction, FinalActionError>(
  pattern: RS.Pattern,
  pureWorker: ((action: A, state: TypedState) => any) | ((action: A) => any),
  actionCreatorsWithResult?: (result: R, action: A) => FinalAction,
  actionCreatorsWithError?: (result: R, action: A) => FinalActionError
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

// If you `yield identity(x)` you get x back
// TODO deprecate
function identity<X>(x: X) {
  return Effects.call(() => x)
}

// these should be opaue types, but eslint doesn't support that yet
export type Ok<X> = {type: 'ok', payload: X}
export type Err<E> = {type: 'err', payload: E}
export type Result<X, E> = Ok<X> | Err<E>

// TODO deprecate, use promise instead
function callAndWrap<R, A1, A2, A3, A4, A5, Fn: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => R>(
  fn: Fn,
  a1: A1,
  a2: A2,
  a3: A3,
  a4: A4,
  a5: A5
) {
  const wrapper = function*() {
    try {
      const result = yield Effects.call(fn, a1, a2, a3, a4, a5)
      return {type: 'ok', payload: result}
    } catch (error) {
      return {type: 'err', payload: error}
    }
  }

  return Effects.call(wrapper)
}

export type {Effect, PutEffect, Channel} from 'redux-saga'
export {buffers, channel, delay} from 'redux-saga'
export {
  all,
  call,
  cancel,
  cancelled,
  fork,
  join,
  put,
  race,
  select,
  spawn,
  take,
  takeEvery,
  takeLatest,
  throttle,
} from 'redux-saga/effects'

export {
  callAndWrap,
  identity,
  safeTakeEvery,
  safeTakeEveryPure,
  actionToPromise,
  actionToAction,
  safeTakeLatest,
  safeTakeLatestPure,
  sequentially,
}
