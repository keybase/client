// @flow

import {put, cps} from 'redux-saga/effects'

export function * cpsWithWaiting (waitingFn: (isWaiting: boolean) => any, cpsFn: any, ...args: any): any {
  yield put(waitingFn(true))
  const value = yield cps(cpsFn, ...args)
  yield put(waitingFn(false))
  return value
}

