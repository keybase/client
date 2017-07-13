// @flow
import {batchedSubscribe} from 'redux-batched-subscribe'
import {compose, applyMiddleware} from 'redux'
import throttle from 'lodash/throttle'

const throttleNotify = throttle(notify => notify(), 200)

export default function storeEnhancer(middleware: Array<any>): Function {
  return compose(applyMiddleware(...middleware), batchedSubscribe(throttleNotify))
}
