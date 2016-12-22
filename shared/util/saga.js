// @flow
import {mapValues, forEach} from 'lodash'
import {buffers, channel, takeEvery, takeLatest} from 'redux-saga'
import {take, call, put} from 'redux-saga/effects'
import {globalError} from '../constants/config'
import {convertToError} from '../util/errors'

import type {ChannelConfig, ChannelMap} from '../constants/types/saga'

function createChannelMap<T> (channelConfig: ChannelConfig<T>): ChannelMap<T> {
  return mapValues(channelConfig, v => {
    return channel(v())
  })
}

function putOnChannelMap<T> (channelMap: ChannelMap<T>, k: string, v: T): void {
  const c = channelMap[k]
  if (c) {
    c.put(v)
  } else {
    console.error('Trying to put, but no registered channel for', k)
  }
}

// TODO type this properly
function effectOnChannelMap<T> (effect: any, channelMap: ChannelMap<T>, k: string): any {
  const c = channelMap[k]
  if (c) {
    return effect(c)
  } else {
    console.error('Trying to do effect, but no registered channel for', k)
  }
}

function takeFromChannelMap<T> (channelMap: ChannelMap<T>, k: string): any {
  return effectOnChannelMap(take, channelMap, k)
}

function closeChannelMap<T> (channelMap: ChannelMap<T>): void {
  forEach(channelMap, c => c.close())
}

function singleFixedChannelConfig<T> (ks: Array<string>): ChannelConfig<T> {
  return ks.reduce((acc, k) => {
    acc[k] = () => buffers.expanding(1)
    return acc
  }, {})
}

function safeTakeEvery (pattern: string | Array<any> | Function, worker: Function, ...args: Array<any>) {
  const wrappedWorker = function * (...args) {
    try {
      yield call(worker, ...args)
    } catch (error) {
      // Convert to global error so we don't kill the takeEvery loop
      yield put((dispatch) => {
        dispatch({
          type: globalError,
          payload: convertToError(error),
        })
      })
    }
  }

  return takeEvery(pattern, wrappedWorker, ...args)
}

function safeTakeLatest (pattern: string | Array<any> | Function, worker: Function, ...args: Array<any>) {
  const wrappedWorker = function * (...args) {
    try {
      yield call(worker, ...args)
    } catch (error) {
      // Convert to global error so we don't kill the takeLatest loop
      yield put((dispatch) => {
        dispatch({
          type: globalError,
          payload: convertToError(error),
        })
      })
    }
  }

  return takeLatest(pattern, wrappedWorker, ...args)
}

export {
  closeChannelMap,
  createChannelMap,
  effectOnChannelMap,
  putOnChannelMap,
  safeTakeEvery,
  safeTakeLatest,
  singleFixedChannelConfig,
  takeFromChannelMap,
}
