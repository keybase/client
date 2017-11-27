// @flow
// This loads up a remote component. It makes a pass-through store which accepts its props from the main window through ipc
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

class RemoteComponentLoader extends Component<any> {
  _store: any
  _ComponentClass: any
  _window: ?BrowserWindow

  _onGotProps = () => {
    if (this._window) {
      this._window.show()
    }
  }

  componentWillMount() {
    const component = this.props.component
    const selectorParams = this.props.selectorParams
    const components = {pinentry}
    // const components = {tracker, pinentry, unlockFolders, purgeMessage}

    if (!component || !components[component]) {
      throw new TypeError('Invalid Remote Component passed through')
    }

    this._window = remote.getCurrentWindow()
    this._store = new RemoteStore({component, gotPropsCallback: this._onGotProps, selectorParams})
    this._ComponentClass = components[component]

    setupContextMenu(this._window)
  }

  render() {
    const TheComponent = this._ComponentClass
    return (
      <div id="RemoteComponentRoot" style={styles.container}>
        <Root store={this._store}>
          <TheComponent />
        </Root>
      </div>
    )
  }
}

const styles = {
  container: {
    backgroundColor: globalColors.white,
    display: 'block',
    overflow: 'hidden',
  },
  loading: {
    backgroundColor: globalColors.grey,
  },
}

function load(options) {
  setupAvatar()
  const node = document.getElementById('root')
  if (node) {
    ReactDOM.render(
      <RemoteComponentLoader component={options.component} selectorParams={options.selectorParams} />,
      node
    )
  }
}

window.load = load
