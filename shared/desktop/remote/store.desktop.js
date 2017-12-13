// @flow
// This is a helper for remote windows.
// This acts as a fake store for remote windows
// On the main window we plumb through our props and we 'mirror' the props using this helper
// We start up and send a 'remoteWindowWantsProps' to the main window which then sends us 'props'
import {remote, BrowserWindow} from 'electron'
import {sendToMainWindow} from './util'

class RemoteStore {
  _window: ?BrowserWindow
  _subscribers: Array<Function> = []
  _internalState: any = {}
  _gotPropsCallback: ?() => void // let component know it loaded once so it can show itself. Set to null after calling once

  _onPropsUpdated = propsStr => {
    const props = JSON.parse(propsStr)
    // We get diffs of the top level props so we always overwrite
    this._internalState = {
      ...this._internalState,
      ...props,
    }

    this._publishChange()
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

  constructor(props: {windowComponent: string, windowParam: string, gotPropsCallback: () => void}) {
    this._gotPropsCallback = props.gotPropsCallback
    this._registerForRemoteUpdate()
    this._askMainWindowForOurProps(props)
  }

  getState(): any {
    return this._internalState
  }

  // We send all actions across the wire to be handled by the main window
  dispatch = (action: any) => {
    if (action.constructor === Function) {
      throw new Error('pure actions only allowed in remote store2')
    } else {
      sendToMainWindow(
        'dispatchAction',
        action,
        this._internalState.windowComponent,
        this._internalState.windowParam
      )
    }
  }

  subscribe(subscriber: Function): () => void {
    this._subscribers.push(subscriber)
    return subscriber => {
      this._subscribers = this._subscribers.filter(s => s !== subscriber)
    }
  }

  _publishChange() {
    this._subscribers.forEach(s => {
      setImmediate(s)
    })
  }
}

export default RemoteStore
