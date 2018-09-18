// @flow
// This loads up a remote component. It makes a pass-through store which accepts its props from the main window through ipc
// Also protects it with an error boundary
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import RemoteStore from './store.desktop'
import Root from '../renderer/container.desktop'
import Menubar from '../../menubar/remote-container.desktop'
import {deserialize as menubarDeserialize} from '../../menubar/remote-serializer.desktop'
import Pinentry from '../../pinentry/remote-container.desktop'
import Tracker from '../../tracker/remote-container.desktop'
import UnlockFolders from '../../unlock-folders/remote-container.desktop'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {globalColors, globalStyles} from '../../styles'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {setupContextMenu} from '../app/menu-helper.desktop'
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
  _window: ?SafeElectron.BrowserWindowType

  constructor(props) {
    super(props)
    this._window = SafeElectron.getRemote().getCurrentWindow()
    const remoteStore = new RemoteStore({
      deserialize: this._getDeserializer(props.windowComponent),
      gotPropsCallback: this._onGotProps,
      windowComponent: props.windowComponent,
      windowParam: props.windowParam,
    })
    this._store = remoteStore.getStore()
    this._ComponentClass = this._getComponent(props.windowComponent)

    setupContextMenu(this._window)
  }

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

  _getDeserializer = (key: string) => {
    switch (key) {
      case 'unlockFolders':
        return () => ({})
      case 'menubar':
        return menubarDeserialize
      case 'pinentry':
        return () => ({})
      case 'tracker':
        return () => ({})
      default:
        throw new TypeError('Invalid Remote Component passed through')
    }
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
