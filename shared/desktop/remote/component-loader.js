// @flow
// This loads up a remote component. It makes a pass-through store which accepts its props from the main window through ipc
// Also protects it with an error boundary
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
// $FlowIssue
import RemoteStore from './store'
import Root from '../renderer/container'
import Menubar from '../../menubar/remote-container.desktop'
import Pinentry from '../../pinentry/remote-container.desktop'
import Tracker from '../../tracker/remote-container.desktop'
import UnlockFolders from '../../unlock-folders/remote-container.desktop'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {globalColors, globalStyles} from '../../styles'
import {remote, BrowserWindow} from 'electron'
import {setupContextMenu} from '../app/menu-helper'
import ErrorBoundary from '../../common-adapters/error-boundary'

disableDragDrop()

module.hot && module.hot.accept()

type Props = {
  windowComponent: 'unlockFolders' | 'menubar' | 'pinentry' | 'tracker',
  windowParam: string,
}

class RemoteComponentLoader extends Component<Props> {
  _store: any
  _ComponentClass: any
  _window: ?BrowserWindow

  _isMenubar = () => {
    return this.props.windowComponent === 'menubar'
  }

  _onGotProps = () => {
    // Show when we get props, unless its the menubar
    if (this._window && !this._isMenubar()) {
      this._window.show()
    }
  }

  _onClose = () => {
    this._window && this._window.close()
  }

  _getComponent = (key: string) => {
    switch (key) {
      case 'unlockFolders':
        return UnlockFolders
      case 'menubar':
        return Menubar
      case 'pinentry':
        return Pinentry
      case 'tracker':
        return Tracker
      default:
        throw new TypeError('Invalid Remote Component passed through')
    }
  }

  componentWillMount() {
    this._window = remote.getCurrentWindow()
    const remoteStore = new RemoteStore({
      gotPropsCallback: this._onGotProps,
      windowComponent: this.props.windowComponent,
      windowParam: this.props.windowParam,
    })
    this._store = remoteStore.getStore()
    this._ComponentClass = this._getComponent(this.props.windowComponent)

    setupContextMenu(this._window)
  }

  render() {
    const TheComponent = this._ComponentClass
    return (
      <div id="RemoteComponentRoot" style={this._isMenubar() ? styles.menubarContainer : styles.container}>
        <ErrorBoundary closeOnClick={this._onClose}>
          <Root store={this._store}>
            <TheComponent />
          </Root>
        </ErrorBoundary>
      </div>
    )
  }
}

const styles = {
  container: {
    backgroundColor: globalColors.white,
    display: 'block',
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  loading: {
    backgroundColor: globalColors.grey,
  },
  // This is to keep that arrow and gap on top w/ transparency
  menubarContainer: {
    ...globalStyles.flexBoxColumn,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    flex: 1,
    marginTop: 0,
    position: 'relative',
  },
}

function load(options) {
  const node = document.getElementById('root')
  if (node) {
    ReactDOM.render(
      <RemoteComponentLoader windowComponent={options.windowComponent} windowParam={options.windowParam} />,
      node
    )
  }
}

window.load = load
