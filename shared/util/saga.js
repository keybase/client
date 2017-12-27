// @flow
import logger from '../logger'
import mapValues from 'lodash/mapValues'
import isEqual from 'lodash/isEqual'
import map from 'lodash/map'
import forEach from 'lodash/forEach'
import {buffers, channel, delay} from 'redux-saga'
import {
  actionChannel,
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
} from 'redux-saga/effects'
import * as ConfigGen from '../actions/config-gen'
import {convertToError} from '../util/errors'

import type {Action} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'
import type {ChannelConfig, ChannelMap, SagaGenerator, Channel} from '../constants/types/saga'

type SagaMap = {[key: string]: any}
type Effect = any

function createChannelMap<T>(channelConfig: ChannelConfig<T>): ChannelMap<T> {
  return mapValues(channelConfig, (v, k) => {
    const ret = channel(v())
    // to help debug what's going on in dev/user-timings
    // $FlowIssue doesn't like us setting this on a sealed object
    ret.userTimingName = k
    return ret
  })
}

function putOnChannelMap<T>(channelMap: ChannelMap<T>, k: string, v: T): void {
  const c = channelMap[k]
  if (c) {
    c.put(v)
  } else {
    logger.error('Trying to put, but no registered channel for', k)
  }
}

// TODO type this properly
function effectOnChannelMap<T>(effectFn: any, channelMap: ChannelMap<T>, k: string): any {
  const c = channelMap[k]
  if (c) {
    return effectFn(c)
  } else {
    logger.error('Trying to do effect, but no registered channel for', k)
  }
}

function takeFromChannelMap<T>(channelMap: ChannelMap<T>, k: string): any {
  return effectOnChannelMap(take, channelMap, k)
}

// Map a chanmap method -> channel to a saga map method -> saga using the given effectFn
function mapSagasToChanMap<T>(
  effectFn: (c: Channel<T>, saga: SagaGenerator<any, any>) => any,
  sagaMap: SagaMap,
  channelMap: ChannelMap<T>
): Array<Effect> {
  // Check that all method names are accounted for
  if (!isEqual(Object.keys(channelMap).sort(), Object.keys(sagaMap).sort())) {
    logger.warn('Missing or extraneous saga handlers')
  }
  return map(sagaMap, (saga, methodName) =>
    effectOnChannelMap(c => effectFn(c, saga), channelMap, methodName)
  )
}

function closeChannelMap<T>(channelMap: ChannelMap<T>): void {
  forEach(channelMap, c => c.close())
}

function singleFixedChannelConfig<T>(ks: Array<string>): ChannelConfig<T> {
  return ks.reduce((acc, k) => {
    acc[k] = () => buffers.expanding(1)
    return acc
  }, {})
}

function safeTakeEvery(pattern: string | Array<any> | Function, worker: Function, ...args: Array<any>) {
  const safeTakeEveryWorker = function* safeTakeEveryWorker(...args) {
    try {
      yield call(worker, ...args)
    } catch (error) {
      // Convert to global error so we don't kill the takeEvery loop
      yield put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
    } finally {
      if (yield cancelled()) {
        logger.info('safeTakeEvery cancelled')
      }
    }
  }

  // $FlowIssue confused
  return takeEvery(pattern, safeTakeEveryWorker, ...args)
}

// Useful in safeTakeEveryPure when you have an array of effects you want to run in order
function* sequentially(effects: Array<any>): Generator<any, Array<any>, any> {
  const results = []
  for (let i = 0; i < effects.length; i++) {
    results.push(yield effects[i])
  }
  return results
}

// Like safeTakeEvery but the worker is pure (not a generator) optionally pass in a third argument
// Which is a selector function that will select some state and pass it to pureWorker
// whatever purework returns will be yielded on.
// i.e. it can return put(someAction). That effectively transforms the input action into another action
// It can also return all([put(action1), put(action2)]) to dispatch multiple actions
function safeTakeEveryPure<A, R, FinalAction, FinalActionError>(
  pattern: string | Array<any> | Function,
  pureWorker: ((action: A, state: TypedState) => any) | ((action: A) => any),
  actionCreatorsWithResult?: (result: R, action: A, state: TypedState) => FinalAction,
  actionCreatorsWithError?: (result: R, action: A) => FinalActionError
) {
  return safeTakeEvery(pattern, function* safeTakeEveryPureWorker(action: A) {
    // If the pureWorker fn takes two arguments, let's pass the state
    try {
      let result
      if (pureWorker.length === 2) {
        const state: TypedState = yield select()
        // $FlowIssue - doesn't understand checking for arity
        result = yield pureWorker(action, state)
      } else {
        // $FlowIssue - doesn't understand checking for arity
        result = yield pureWorker(action)
      }

      if (actionCreatorsWithResult) {
        if (actionCreatorsWithResult.length === 3) {
          const state: TypedState = yield select()
          yield actionCreatorsWithResult(result, action, state)
        } else {
          // $FlowIssue - doesn't understand checking for arity
          yield actionCreatorsWithResult(result, action)
        }
      }
    } catch (e) {
      if (actionCreatorsWithError) {
        yield actionCreatorsWithError(e, action)
      }
    }
  })
}
// Similar to safeTakeEveryPure
function safeTakeLatestPure<A, R, FinalAction, FinalActionError>(
  pattern: string | Array<any> | Function,
  pureWorker: ((action: A, state: TypedState) => any) | ((action: A) => any),
  actionCreatorsWithResult?: (result: R, action: A, state: TypedState) => FinalAction,
  actionCreatorsWithError?: (result: R, action: A) => FinalActionError
) {
  const safeTakeLatestPureWorker = function* safeTakeLatestPureWorker(action: A) {
    // If the pureWorker fn takes two arguments, let's pass the state
    try {
      let result
      if (pureWorker.length === 2) {
        const state: TypedState = yield select(s => s)
        // $FlowIssue - doesn't understand checking for arity
        result = yield pureWorker(action, state)
      } else {
        // $FlowIssue - doesn't understand checking for arity
        result = yield pureWorker(action)
      }

      if (actionCreatorsWithResult) {
        if (actionCreatorsWithResult.length === 3) {
          const state: TypedState = yield select(s => s)
          // $FlowIssue - doesn't understand checking for arity
          yield actionCreatorsWithResult(result, action, state)
        } else {
          // $FlowIssue - doesn't understand checking for arity
          yield actionCreatorsWithResult(result, action)
        }
      }
    } catch (e) {
      if (actionCreatorsWithError) {
        // $FlowIssue confused
        yield actionCreatorsWithError(e, action)
      }
    } finally {
      if (actionCreatorsWithError) {
        if (yield cancelled()) {
          // $FlowIssue confused
          yield actionCreatorsWithError(new Error('Canceled'), action)
        }
      }
    }
  }
  // $FlowIssue confused
  return takeLatest(pattern, safeTakeLatestPureWorker)
}

function safeTakeLatestWithCatch(
  pattern: string | Array<any> | Function | Channel<any>,
  catchHandler: Function,
  worker: Function | SagaGenerator<any, any>,
  ...args: Array<any>
) {
  const safeTakeLatestWithCatchWorker = function* safeTakeLatestWithCatchWorker(...args) {
    try {
      yield call(worker, ...args)
    } catch (error) {
      // Convert to global error so we don't kill the takeLatest loop
      yield put(
        ConfigGen.createGlobalError({
          globalError: convertToError(error),
        })
      )
      yield call(catchHandler, error)
    } finally {
      if (yield cancelled()) {
        logger.info('safeTakeLatestWithCatch cancelled')
      }
    }
  }

  // $FlowIssue confused
  return takeLatest(pattern, safeTakeLatestWithCatchWorker, ...args)
}

function safeTakeLatest(
  pattern: string | Array<any> | Function | Channel<any>,
  worker: Function | SagaGenerator<any, any>,
  ...args: Array<any>
) {
  return safeTakeLatestWithCatch(pattern, () => {}, worker, ...args)
}

function cancelWhen(predicate: (originalAction: Action, checkAction: Action) => boolean, worker: Function) {
  const wrappedWorker = function*(action: Action): SagaGenerator<any, any> {
    yield race({
      result: call(worker, action),
      cancel: take((checkAction: Action) => predicate(action, checkAction)),
    })
  }

  return wrappedWorker
}

function safeTakeSerially(pattern: string | Array<any> | Function, worker: Function, ...args: Array<any>) {
  const safeTakeSeriallyWorker = function* safeTakeSeriallyWorker(...args) {
    try {
      yield call(worker, ...args)
    } catch (error) {
      // Convert to global error so we don't kill the loop
      yield put(dispatch => {
        dispatch(
          ConfigGen.createGlobalError({
            globalError: convertToError(error),
          })
        )
      })
    } finally {
      if (yield cancelled()) {
        logger.info('safeTakeSerially cancelled')
      }
    }
  }

  return fork(function* safeTakeSeriallyForkWorker() {
    const chan = yield actionChannel(pattern, buffers.expanding(10))
    while (true) {
      const action = yield take(chan)
      yield call(safeTakeSeriallyWorker, action, ...args)
    }
  })
}

// If you `yield identity(x)` you get x back
function identity<X>(x: X) {
  return call(() => x)
}

// these should be opaue types, but eslint doesn't support that yet
type Ok<X> = {type: 'ok', payload: X}
type Err<E> = {type: 'err', payload: E}
type Result<X, E> = Ok<X> | Err<E>

type Fn0<R> = () => R
type Fn1<T1, R> = (t1: T1) => R
type Fn2<T1, T2, R> = (t1: T1, t2: T2) => R
type Fn3<T1, T2, T3, R> = (t1: T1, t2: T2, t3: T3) => R

type CallAndWrap = (<R, Fn: Fn0<Promise<R>>, WR: Result<R, *>, WFn: Fn0<WR>>(
  fn: Fn
  // $FlowIssue gives expected polymorphic type error
) => $Call<call<WR, WFn>>) &
  (<R, T1, Fn: Fn1<T1, Promise<R>>, WR: Result<R, *>, WFn: Fn1<T1, WR>>(
    fn: Fn,
    t1: T1
    // $FlowIssue gives expected polymorphic type error
  ) => $Call<call<T1, WR, WFn>>) &
  (<R, T1, T2, Fn: Fn2<T1, T2, Promise<R>>, WR: Result<R, *>, WFn: Fn2<T1, T2, WR>>(
    fn: Fn,
    t1: T1,
    t2: T2
    // $FlowIssue gives expected polymorphic type error
  ) => $Call<call<T1, T2, WR, WFn>>) &
  (<R, T1, T2, T3, Fn: Fn3<T1, T2, T3, Promise<R>>, WR: Result<R, *>, WFn: Fn3<T1, T2, T3, WR>>(
    fn: Fn,
    t1: T1,
    t2: T2,
    t3: T3
    // $FlowIssue gives expected polymorphic type error
  ) => $Call<call<T1, T2, T3, WR, WFn>>)
// TODO this doesn't type as well as it could
const callAndWrap: CallAndWrap = (fn, ...args) => {
  const wrapper = function*() {
    try {
      // $FlowIssue - ignore this part for now
      const result = yield call(fn, ...args)
      return {type: 'ok', payload: result}
    } catch (error) {
      return {type: 'err', payload: error}
    }
  }

  return call(wrapper)
}

export type {SagaGenerator, Ok, Err, Result}

export {
  all,
  buffers,
  call,
  callAndWrap,
  cancel,
  cancelWhen,
  cancelled,
  channel,
  closeChannelMap,
  createChannelMap,
  delay,
  effectOnChannelMap,
  fork,
  identity,
  join,
  mapSagasToChanMap,
  put,
  putOnChannelMap,
  race,
  safeTakeEvery,
  safeTakeEveryPure,
  safeTakeLatest,
  safeTakeLatestPure,
  safeTakeLatestWithCatch,
  safeTakeSerially,
  select,
  sequentially,
  singleFixedChannelConfig,
  spawn,
  take,
  takeFromChannelMap,
}
