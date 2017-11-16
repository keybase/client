// @flow
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
// $FlowIssue
import RemoteStore from './remote-store2'
import Root from './container'
import pinentry from '../../pinentry/remote-container'
// import purgeMessage from '../../pgp/container.desktop'
// import tracker from '../../tracker'
// import unlockFolders from '../../unlock-folders'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {getUserImageMap, loadUserImageMap, getTeamImageMap, loadTeamImageMap} from '../../util/pictures'
import {globalColors} from '../../styles'
import {initAvatarLookup, initAvatarLoad} from '../../common-adapters'
import {remote, ipcRenderer} from 'electron'
import {setupContextMenu} from '../app/menu-helper'
import {setupSource} from '../../util/forward-logs'

setupSource()
disableDragDrop()

function setupAvatar() {
  initAvatarLookup(getUserImageMap, getTeamImageMap)
  initAvatarLoad(loadUserImageMap, loadTeamImageMap)
}

module.hot && module.hot.accept()
// module.hot &&
// module.hot.dispose(() => {
// engine().reset()
// })

// Defer this since it's a sync call
const getCurrentWindow = (function() {
  let currentWindow = null

  return function() {
    if (!currentWindow) {
      currentWindow = remote.getCurrentWindow()
    }

    return currentWindow
  }
})()

// const showOnLoad = currentWindow => {
// // On Windows we can try showing before Windows is ready
// // This will result in a dropped .show request
// // We add a listener to `did-finish-load` so we can show it when
// // Windows is ready.
// currentWindow.show()
// currentWindow.webContents.once('did-finish-load', () => {
// currentWindow.show()
// })
// }

class RemoteComponentLoader extends Component<any> {
  store: any
  ComponentClass: any

  componentWillMount() {
    const component = this.props.component
    const selectorParams = this.props.selectorParams
    const components = {pinentry}
    // const components = {tracker, pinentry, unlockFolders, purgeMessage}

    if (!component || !components[component]) {
      throw new TypeError('Invalid Remote Component passed through')
    }

    this.store = new RemoteStore({component, selectorParams})
    this.ComponentClass = components[component]

    const currentWindow = getCurrentWindow()
    setupContextMenu(currentWindow)
  }

  render() {
    const TheComponent = this.ComponentClass
    return (
      <div id="RemoteComponentRoot" style={styles.container}>
        <Root store={this.store}>
          <TheComponent />
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
    backgroundColor: globalColors.grey,
  },
}

function load(options) {
  setupAvatar()
  ReactDOM.render(
    <RemoteComponentLoader component={options.component} selectorParams={options.selectorParams} />,
    // $FlowIssue wants this to be non-null
    document.getElementById('root')
  )
}

window.load = load
