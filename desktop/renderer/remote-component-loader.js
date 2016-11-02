// @flow
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
// $FlowIssue
import RemoteStore from './remote-store'
import Root from './container'
import engine, {makeEngine} from '../shared/engine'
import hello from '../shared/util/hello'
import loadPerf from '../shared/util/load-perf'
import pinentry from '../shared/pinentry'
import purgeMessage from '../shared/pgp/container.desktop'
import tracker from '../shared/tracker'
import unlockFolders from '../shared/unlock-folders'
import {disable as disableDragDrop} from '../shared/util/drag-drop'
// $FlowIssue
import {globalColors} from '../shared/styles'
import {remote, ipcRenderer} from 'electron'
import {setupContextMenu} from '../app/menu-helper'
// $FlowIssue
import {setupSource} from '../shared/util/forward-logs'

setupSource()
disableDragDrop()
makeEngine()

// $FlowIssue
module.hot && module.hot.accept()
// $FlowIssue
module.hot && module.hot.dispose(() => {
  engine().reset()
})

// Defer this since it's a sync call
const getCurrentWindow = (function () {
  let currentWindow = null

  return function () {
    if (!currentWindow) {
      currentWindow = remote.getCurrentWindow()
    }

    return currentWindow
  }
})()

const showOnLoad = currentWindow => {
  // On Windows we can try showing before Windows is ready
  // This will result in a dropped .show request
  // We add a listener to `did-finish-load` so we can show it when
  // Windows is ready.
  currentWindow.show()
  currentWindow.webContents.once('did-finish-load', () => {
    currentWindow.show()
  })
}

type State = {
  loaded: boolean,
  unmounted: boolean,
  props?: any,
}

class RemoteComponentLoader extends Component<void, any, State> {
  state: State;
  store: any;
  ComponentClass: any;

  constructor (props) {
    super(props)
    this.state = {
      loaded: false,
      unmounted: false,
    }

    loadPerf()

    const title = this.props.title
    hello(process.pid, 'Remote Component: ' + (title || ''), process.argv, __VERSION__) // eslint-disable-line no-undef

    const component = this.props.component
    const selectorParams = this.props.selectorParams
    const components = {tracker, pinentry, unlockFolders, purgeMessage}

    if (!component || !components[component]) {
      throw new TypeError('Invalid Remote Component passed through')
    }

    this.store = new RemoteStore({component, selectorParams})
    this.ComponentClass = components[component]
  }

  componentWillMount () {
    const currentWindow = getCurrentWindow()
    setupContextMenu(currentWindow)

    currentWindow.on('hasProps', props => {
      // Maybe we need to wait for the state to arrive at the beginning
      if (props.waitForState &&
          // Make sure we only do this if we haven't loaded the state yet
          !this.state.loaded &&
          // Only do this if the store hasn't been filled yet
          Object.keys(this.store.getState()).length === 0) {
        const unsub = this.store.subscribe(() => {
          unsub()
          showOnLoad(getCurrentWindow())
          this.setState({props: props, loaded: true})
        })
      } else {
        // If we've received props, and the loaded state was false, that
        // means we should show the window
        if (this.state.loaded === false) {
          showOnLoad(getCurrentWindow())
        }
        setImmediate(() => this.setState({props: props, loaded: true}))
      }
    })

    const onRemoteUnmount = () => {
      setImmediate(() => this.setState({unmounted: true}))
      // Hide the window since we've effectively told it to close
      try {
        getCurrentWindow().hide()
      } catch (_) { }

      ipcRenderer.removeListener('remoteUnmount', onRemoteUnmount)
    }

    ipcRenderer.on('remoteUnmount', onRemoteUnmount)

    try {
      ipcRenderer.send('registerRemoteUnmount', currentWindow.id)
    } catch (_) { }

    currentWindow.emit('needProps')
  }

  componentDidUpdate (prevProps, prevState) {
    if (!prevState.unmounted && this.state.unmounted) {
      // Close the window now that the remote-component's unmount
      // lifecycle method has finished
      try {
        getCurrentWindow().close()
      } catch (_) { }
    }
  }

  componentWillUnmount () {
    try {
      getCurrentWindow().removeAllListeners('hasProps')
    } catch (_) { }
  }

  render () {
    if (!this.state.loaded) {
      return <div style={styles.loading} />
    }
    if (this.state.unmounted) {
      return <div />
    }
    return (
      <div id='RemoteComponentRoot' style={styles.container}>
        <Root store={this.store}>
          <this.ComponentClass {...this.state.props} />
        </Root>
      </div>
    )
  }
}

const styles = {
  container: {
    overflow: 'hidden',
    display: 'block',
    backgroundColor: globalColors.white,
  },
  loading: {
    backgroundColor: globalColors.grey5,
  },
}

function load (options) {
  ReactDOM.render(<RemoteComponentLoader
    title={options.title}
    component={options.component}
    selectorParams={options.selectorParams}
    />, document.getElementById('root'))
}

window.load = load
