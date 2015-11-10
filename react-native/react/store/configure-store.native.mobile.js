'use strict'

import { createStore } from 'redux'

export default function configureStoreNative (rootReducer, initialState, createStoreWithMiddleware) {
  const nativeCreateStoreWithMiddleware = createStoreWithMiddleware(createStore)
  return nativeCreateStoreWithMiddleware(rootReducer, initialState)
}
