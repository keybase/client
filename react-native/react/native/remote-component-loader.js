import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import remote from 'remote'
import {ipcRenderer} from 'electron'

const currentWindow = remote.getCurrentWindow()

window.console.log = (...args) => ipcRenderer.send('console.log', args)
window.console.warn = (...args) => ipcRenderer.send('console.warn', args)
window.console.error = (...args) => ipcRenderer.send('console.error', args)

class RemoteStore {
  constructor (props) {
    ipcRenderer.on('stateChange', (event, arg) => {
      this.internalState = props.substore ? {[props.substore]: arg} : arg
      this._publishChange()
    })

    ipcRenderer.send('subscribeStore', props.substore)

    this.listeners = []
    this.internalState = {}
  }

  getState () {
    return this.internalState
  }

  dispatch (action) {
    // TODO use our middlewares
    if (action.constructor === Function) {
      action(a => this.dispatch(a), () => this.getState())
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
      setImmediate(l)
    })
  }
}

function getQueryVariable(variable) {
  var query = window.location.search.substring(1)
    var vars = query.split("&")
    for (var i=0;i<vars.length;i++) {
      var pair = vars[i].split("=")
        if(pair[0] == variable){
          return pair[1]
        }
    }
  return false
}

class RemoteComponentLoader extends Component {
  constructor (props) {
    super(props)
    this.state = {loaded: false}

    const substore = getQueryVariable('substore')
    this.store = new RemoteStore({substore})
    this.store.dispatch = this.store.dispatch.bind(this.store)

    const componentToLoad = getQueryVariable('component')

    if (!componentToLoad) {
      throw new TypeError('Remote Component not passed through hash')
    }

    const component = {
      tracker: require('../tracker'),
      pinentry: require('../pinentry')
    }

    this.Component = component[componentToLoad] || <p>Error</p>
  }

  componentWillMount () {
    currentWindow.on('hasProps', props => {
      // Maybe we need to wait for the state to arrive at the beginning
      if (props.waitForState &&
          // Make sure we only do this if we haven't loaded the state yet
          !this.state.loaded &&
          // Only do this if the store hasn't been filled yet.
          Object.keys(this.store.getState()).length === 0) {
        const unsub = this.store.subscribe(() => {
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
        setImmediate(() => this.setState({props: props, loaded: true}))
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
      <Provider store={this.store}>
        <Component {...this.state.props}/>
      </Provider>
    )
  }
}

ReactDOM.render(<RemoteComponentLoader/>, document.getElementById('remoteComponent'))
