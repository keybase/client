'use strict'
/* @flow */

import { createStore, compose } from 'redux'
import { devTools } from 'redux-devtools'

export default function configureStoreNative (rootReducer, initialState, createStoreWithMiddleware) {
  const nativeCreateStoreWithMiddleware = compose(
    createStoreWithMiddleware,
    devTools()
  )(createStore)

  return nativeCreateStoreWithMiddleware(rootReducer, initialState)
}
