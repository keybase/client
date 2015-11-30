import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import remote from 'remote'
import {ipcRenderer} from 'electron'

const currentWindow = remote.getCurrentWindow()

class RemoteStore {
  constructor () {
    ipcRenderer.on('stateChange', (event, arg) => {
      this.internalState = arg
      this._publishChange()
    })

    ipcRenderer.send('subscribeStore')

    this.listeners = []
    this.internalState = {}
  }

  getState () {
    return this.internalState
  }

  dispatch (action) {
    // TODO use our middlewares
    if (action.constructor === Function) {
      action(a => this.dispatch(a))
    } else {
      ipcRenderer.send('dispatchAction', action)
    }
  }

  subscribe (listener) {
    this.listeners.push(listener)
    return listener => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  _publishChange () {
    this.listeners.forEach(l => {
      l()
    })
  }
}

const store = new RemoteStore()
store.dispatch = store.dispatch.bind(store)

class RemoteComponentLoader extends Component {
  constructor (props) {
    super(props)
    this.state = {loaded: false}

    const componentToLoad = window.location.hash.substring(1)
    if (!componentToLoad) {
      throw new TypeError('Remote Component not passed through hash')
    }

    const component = require('../' + componentToLoad)
    this.Component = component.default || component
  }

  componentWillMount () {
    currentWindow.on('hasProps', props => {
      // Maybe we need to wait for the state to arrive at the beginning
      if (props.waitForState &&
          // Make sure we only do this if we haven't loaded the state yet
          !this.state.loaded &&
          // Only do this if the store hasn't been filled yet.
          Object.keys(store.getState()).length === 0) {
        const unsub = store.subscribe(() => {
          currentWindow.show()
          this.setState({props: props, loaded: true})
          unsub()
        })
      } else {
        // If we've received props, and the loaded state was false
        // That means we should show the window
        if (this.state.loaded === false) {
          currentWindow.show()
        }
        this.setState({props: props, loaded: true})
      }
    })

    currentWindow.emit('needProps')
  }

  componentWillUnmount () {
    ipcRenderer.removeAllListeners('hasProps')
  }

  render () {
    const Component = this.Component
    if (!this.state.loaded) {
      return <div>loading</div>
    }
    return (
      <Provider store={store}>
        <Component {...this.state.props}/>
      </Provider>
    )
  }
}

ReactDOM.render(<RemoteComponentLoader/>, document.getElementById('remoteComponent'))
