import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import {remote, ipcRenderer} from 'electron'
import RemoteStore from './remote-store'
import {ipcLogsRenderer} from '../app/console-helper'
import hello from '../shared/util/hello'
import {globalColors} from '../shared/styles/style-guide'

import tracker from '../shared/tracker'
import pinentry from '../shared/pinentry'
import unlockFolders from '../shared/unlock-folders'

import {setupContextMenu} from '../app/menu-helper'
import loadPerf from '../shared/util/load-perf'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../shared/styles/material-theme.desktop'

ipcLogsRenderer()

if (module.hot) {
  module.hot.accept()
}

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
  currentWindow.show()
  currentWindow.webContents.once('did-finish-load', () => {
    currentWindow.show()
  })
}

function getQueryVariable (variable) {
  var query = window.location.search.substring(1)
  var vars = query.split('&')
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=')
    if (pair[0] === variable) {
      return pair[1]
    }
  }
  return false
}

class RemoteComponentLoader extends Component {
  constructor (props) {
    super(props)
    this.state = {
      loaded: false,
      unmounted: false,
    }

    loadPerf()

    const componentToLoad = getQueryVariable('component')
    const selectorParams = getQueryVariable('selectorParams')
    let title = getQueryVariable('title')
    title = title && decodeURI(title)

    if (title) {
      document.title = title
    }

    hello(process.pid, 'Remote Component: ' + (title || ''), process.argv, __VERSION__) // eslint-disable-line no-undef

    const component = {tracker, pinentry, unlockFolders}

    if (!componentToLoad || !component[componentToLoad]) {
      throw new TypeError('Invalid Remote Component passed through')
    }

    this.store = new RemoteStore({component: componentToLoad, selectorParams})
    this.Component = component[componentToLoad]
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
    const Component = this.Component
    if (!this.state.loaded) {
      return <div style={styles.loading}></div>
    }
    if (this.state.unmounted) {
      return <div />
    }
    return (
      <div style={styles.container}>
        <MuiThemeProvider muiTheme={materialTheme}>
          <Provider store={this.store}>
            <Component {...this.state.props} />
          </Provider>
        </MuiThemeProvider>
      </div>
    )
  }
}

const styles = {
  container: {
    overflow: 'hidden',
    backgroundColor: globalColors.white,
  },
  loading: {
    backgroundColor: globalColors.grey5,
  },
}

ReactDOM.render(<RemoteComponentLoader />, document.getElementById('remoteComponent'))
