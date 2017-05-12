// @flow
import {ipcRenderer} from 'electron'

class RemoteStore {
  listeners: Array<Function> = []
  internalState: any = {}

  _onStateChange = (event, arg) => {
    this.internalState = arg
    this._publishChange()
  }

  constructor(props: {component: string, selectorParams?: ?string}) {
    ipcRenderer.on('stateChange', this._onStateChange)
    ipcRenderer.send('subscribeStore', props.component, props.selectorParams)
  }

  cleanup() {
    ipcRenderer.removeListener('stateChange', this._onStateChange)
  }

  getState(): any {
    return this.internalState
  }

  dispatch = (action: any) => {
    this._dispatch(action)
  }

  _dispatch(action: any) {
    // TODO use our middlewares
    if (action.constructor === Function) {
      return action(a => this.dispatch(a), () => this.getState())
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
