// This is a helper for remote windows.
// This acts as a fake store for remote windows
// On the main window we plumb through our props and we 'mirror' the props using this helper
// We start up and send an action to the main window which then sends us 'props'
import * as Electron from 'electron'
import {mainWindowDispatch} from './util.desktop'
import {createStore, applyMiddleware, Store} from 'redux'
import {TypedActions} from '../../actions/typed-actions-gen'
import * as ConfigGen from '../../actions/config-gen'

const updateStore = 'remoteStore:update'
// Special action that's not sent
type UpdateStoreAction = {
  type: typeof updateStore
  payload: {
    propsStr: string
  }
}

class RemoteStore {
  _window: Electron.BrowserWindow | null = null
  _store: Store<any, any>
  _gotPropsCallback: (() => void) | null = null // let component know it loaded once so it can show itself. Set to null after calling once
  _deserialize: (arg0: any, arg1: any) => any

  getStore = () => this._store

  _onPropsUpdated = propsStr => {
    // setImmediate since this can be a side effect of the reducer which redux doesn't like
    setTimeout(() => {
      this._store.dispatch({
        payload: {propsStr},
        type: updateStore,
      })
    }, 0)

    if (this._gotPropsCallback) {
      this._gotPropsCallback()
      this._gotPropsCallback = null
    }
  }

  _registerForRemoteUpdate = () => {
    this._window = Electron.remote.getCurrentWindow()
    // @ts-ignore custom event
    this._window.on('KBprops', this._onPropsUpdated)
  }

  _reducer = (state: any, action: any) => {
    switch (action.type) {
      case updateStore: {
        return this._deserialize(state, JSON.parse(action.payload.propsStr))
      }
    }

    return state
  }

  constructor(props: {
    windowComponent: string
    windowParam: string
    gotPropsCallback: () => void
    deserialize: (arg0: any, arg1: any) => any
  }) {
    this._store = createStore(
      this._reducer,
      props.deserialize(undefined, undefined),
      applyMiddleware(sendToRemoteMiddleware as any)
    )
    this._deserialize = props.deserialize
    this._gotPropsCallback = props.gotPropsCallback
    this._registerForRemoteUpdate()

    if (__DEV__) {
      global.DEBUGStore = this._store
    }

    // Search for the main window and ask it directly for our props
    mainWindowDispatch(
      ConfigGen.createRemoteWindowWantsProps({
        component: props.windowComponent,
        param: props.windowParam,
      })
    )
  }
}

const sendToRemoteMiddleware = () => (next: (action: TypedActions | UpdateStoreAction) => void) => (
  action: TypedActions | UpdateStoreAction
) => {
  if (action.constructor === Function) {
    throw new Error('pure actions only allowed in remote store2')
  } else if (action.type === updateStore) {
    // Don't forward our internal updateStore call
    return next(action)
  } else {
    mainWindowDispatch(action)
  }
  return next(action)
}

export default RemoteStore
