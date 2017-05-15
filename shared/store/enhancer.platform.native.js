// @flow
import {compose, applyMiddleware} from 'redux'
import {batchedSubscribe} from 'redux-batched-subscribe'
import {throttle} from 'lodash'

const throttleNotify = throttle(notify => notify(), 200)

export default function storeEnhancer(middleware: Array<any>): Function {
  return compose(applyMiddleware(...middleware), batchedSubscribe(throttleNotify))
}
