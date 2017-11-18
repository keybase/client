// @flow
// This is a helper for remote windows.
// This acts as a fake store for remote windows
// On the main window we plumb through our props and we 'mirror' the props using this helper
// We start up and send a 'remoteWindowWantsProps' to the main window which then sends us 'props'
import {ipcRenderer, remote} from 'electron'

class RemoteStore {
  listeners: Array<Function> = []
  internalState: any = {}

  _onPropsUpdated = props => {
    this.internalState = props
    this._publishChange()
  }

  _registerForRemoteUpdate = () => {
    this._window = remote.getCurrentWindow()
    this._window.on('props', this._onPropsUpdated)
  }

  _askMainWindowForOurProps = props => {
    const wcs = remote.BrowserWindow
      .getAllWindows()
      .map(w => w.webContents)
      .filter(wc => wc.getURL().indexOf('mainWindow') !== -1)
    if (wcs && wcs.length > 0) {
      wcs[0].send('remoteWindowWantsProps', props.component, props.selectorParams)
    }
  }

  constructor(props: {component: string, selectorParams?: ?string}) {
    this._registerForRemoteUpdate()
    this._askMainWindowForOurProps(props)
  }

  getState(): any {
    return this.internalState
  }

  dispatch = (action: any) => {
    if (action.constructor === Function) {
      throw new Error('pure actions only allowed in remote store2')
    } else {
      ipcRenderer.send('dispatchAction', action)
    }
  }

  subscribe(listener: Function): () => void {
    this.listeners.push(listener)
    return listener => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  _publishChange() {
    this.listeners.forEach(l => {
      setImmediate(l)
    })
  }
}

export default RemoteStore
