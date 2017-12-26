// @flow
// This is a helper for remote windows.
// This acts as a fake store for remote windows
// On the main window we plumb through our props and we 'mirror' the props using this helper
// We start up and send a 'remoteWindowWantsProps' to the main window which then sends us 'props'
import {remote, BrowserWindow} from 'electron'
import {sendToMainWindow} from './util'
import {createStore, applyMiddleware, type Store} from 'redux'

const updateStore = 'remoteStore:update'

class RemoteStore {
  _window: ?BrowserWindow
  _store: Store<*, *, *>
  _gotPropsCallback: ?() => void // let component know it loaded once so it can show itself. Set to null after calling once

  getStore = () => this._store

  _onPropsUpdated = propsStr => {
    // setImmediate since this can be a side effect of the reducer which redux doesn't like
    setImmediate(() => {
      this._store.dispatch({
        payload: {propsStr},
        type: updateStore,
      })
    })

    if (this._gotPropsCallback) {
      this._gotPropsCallback()
      this._gotPropsCallback = null
    }
  }

  _registerForRemoteUpdate = () => {
    this._window = remote.getCurrentWindow()
    this._window.on('props', this._onPropsUpdated)
  }

  // Search for the main window and ask it directly for our props
  _askMainWindowForOurProps = props => {
    sendToMainWindow('remoteWindowWantsProps', props.windowComponent, props.windowParam)
  }

  _reducer = (state: any, action: any) => {
    switch (action.type) {
      case updateStore: {
        const props = JSON.parse(action.payload.propsStr)
        // We get diffs of the top level props so we always overwrite
        return {
          ...state,
          ...props,
        }
      }
    }

    return state
  }

  constructor(props: {windowComponent: string, windowParam: string, gotPropsCallback: () => void}) {
    this._store = createStore(this._reducer, {}, applyMiddleware(sendToRemoteMiddleware))
    this._gotPropsCallback = props.gotPropsCallback
    this._registerForRemoteUpdate()
    this._askMainWindowForOurProps(props)
  }
}

const sendToRemoteMiddleware = ({getState, dispatch}) => next => action => {
  if (action.constructor === Function) {
    throw new Error('pure actions only allowed in remote store2')
  } else if (action.type === updateStore) {
    // Don't forward our internal updateStore call
    return next(action)
  } else {
    const {windowComponent, windowParam} = getState()
    sendToMainWindow('dispatchAction', action, windowComponent, windowParam)
  }
  return next(action)
}

export default RemoteStore
