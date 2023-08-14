import * as ReduxToolKit from '@reduxjs/toolkit'
import * as C from '../constants'
import {listenerMiddleware} from '../util/redux-toolkit'
import {type Store} from 'redux'

let theStore: Store<any, any>

export const getGlobalStore = () => theStore

// don't setup listeners again
if (__DEV__ && !globalThis.DEBUGlistenersInited) {
  globalThis.DEBUGlistenersInited = false
}

const empty = ReduxToolKit.createSlice({
  initialState: {},
  name: 'empty',
  reducers: {},
}).reducer

export default function makeStore() {
  const store = ReduxToolKit.configureStore({
    devTools: false,
    middleware: () => [listenerMiddleware.middleware],
    reducer: {empty},
  })
  // @ts-ignore
  theStore = store

  return {
    initListeners: () => {
      if (__DEV__) {
        if (globalThis.DEBUGlistenersInited) {
          console.log('Dev reloading not registering listeners again')
          return
        } else {
          globalThis.DEBUGlistenersInited = true
        }
      }
      // register our subsciptions
      C.useFSState.getState().dispatch.setupSubscriptions()
      C.useConfigState.getState().dispatch.setupSubscriptions()
      // start our 'forks'
      store.dispatch({type: 'config:initListenerLoops'})
    },
    store,
  }
}
