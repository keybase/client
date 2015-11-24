import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import remote from 'remote'
import ipc from 'ipc'

const currentWindow = remote.getCurrentWindow()

class RemoteStore {
  constructor () {
    ipc.on('stateChange', arg => {
      this.internalState = arg
      this._publishChange()
    })

    ipc.send('subscribeStore')

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
      ipc.send('dispatchAction', action)
    }
  }

  subscribe (listener) {
    this.listeners.push(listener)
    return listener => {
      this.listeners = this.listerns.filter(l => l !== listener)
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

    this.Component = require('../' + componentToLoad).default
  }

  componentDidMount () {
    currentWindow.on('hasProps', props => {
      // If we've received props, and the loaded state was false
      if (this.state.loaded === false) {
        currentWindow.show()
      }
      this.setState({props: props, loaded: true})
    })

    currentWindow.emit('needProps')
  }

  componentWillUnmount () {
    ipc.removeAllListeners('hasProps')
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
