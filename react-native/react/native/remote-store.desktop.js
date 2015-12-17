/* @flow */
import {ipcRenderer} from 'electron'

export default class RemoteStore {
  listeners: Array<Function>;
  internalState: any;

  constructor (props: {substore?: ?string}) {
    ipcRenderer.on('stateChange', (event, arg) => {
      this.internalState = props.substore ? {[props.substore]: arg} : arg
      this._publishChange()
    })

    ipcRenderer.on('resubscribeStore', () => {
      ipcRenderer.send('subscribeStore', props.substore)
    })

    ipcRenderer.send('subscribeStore', props.substore)

    this.listeners = []
    this.internalState = {}
    // $FlowIssue With reading methods inside constructor
    this.dispatch = this.dispatch.bind(this)
  }

  getState (): any {
    return this.internalState
  }

  dispatch (action: any) {
    // TODO use our middlewares
    if (action.constructor === Function) {
      action(a => this.dispatch(a), () => this.getState())
    } else {
      ipcRenderer.send('dispatchAction', action)
    }
  }

  subscribe (listener: Function): () => void {
    this.listeners.push(listener)
    return listener => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  _publishChange () {
    this.listeners.forEach(l => {
      setImmediate(l)
    })
  }
}
