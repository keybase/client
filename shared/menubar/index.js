// @flow
import React, {Component} from 'react'
import Render from './index.render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import engine from '../engine'
import {shell, ipcRenderer} from 'electron'
import * as favoriteAction from '../actions/favorite'
import {openInKBFS} from '../actions/kbfs'
import {openDialog as openRekeyDialog} from '../actions/unlock-folders'
import {navigateTo} from '../actions/route-tree'
import {loginTab} from '../constants/tabs'
import {executeActionsForContext} from '../util/quit-helper.desktop'
import {defaultKBFSPath} from '../constants/config'
import {exec} from 'child_process'

import type {KBFSStatus} from '../constants/favorite'
import type {Props as FolderProps} from '../folders/render'

export type Props = $Shape<{
  username: ?string,
  openRekeyDialog: () => void,
  favoriteList: () => void,
  openInKBFS: (target?: any) => void,
  loggedIn: ?boolean,
  onShowLoginTab: () => void,
  folderProps: ?FolderProps,
  kbfsStatus: KBFSStatus,
}>

const REQUEST_DELAY = 5000

class Menubar extends Component<void, Props, void> {
  _lastRequest: number;

  constructor (props) {
    super(props)

    this._lastRequest = 0

    const onMenubarShow = () => {
      setImmediate(() => {
        engine().listenOnConnect('menubar', () => {
          this._checkForFolders(true)
        })
      })
    }

    const onMenubarHide = () => {
      setImmediate(() => {
        engine().listenOnConnect('menubar', () => { })
      })
    }

    if (module.hot && typeof module.hot.dispose === 'function') {
      module.hot.dispose(() => {
        try {
          engine().reset()
          ipcRenderer.send('unsubscribeMenubar')
          ipcRenderer.removeListener('menubarShow', onMenubarShow)
          ipcRenderer.removeListener('menubarHide', onMenubarHide)
        } catch (_) { }
      })
    }

    try {
      ipcRenderer.send('subscribeMenubar')
      ipcRenderer.on('menubarShow', onMenubarShow)
      ipcRenderer.on('menubarHide', onMenubarHide)
    } catch (_) { }
  }

  _checkForFolders (force) {
    const now = Date.now()

    if ((now - this._lastRequest) < REQUEST_DELAY) {
      return
    }

    this._lastRequest = now

    setImmediate(() => {
      if (!force && this.props.folders) {
        return
      }

      if (this.props.username && this.props.loggedIn) {
        this.props.favoriteList()
      }
    })
  }

  componentDidMount () {
    this._checkForFolders()
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (this.props.username !== nextProps.username ||
        this.props.loggedIn !== nextProps.loggedIn) {
      this._lastRequest = 0 // reset delay since user/loggedin changed
      this._checkForFolders()
      return true
    }

    if (this.props.folderProps !== nextProps.folderProps) {
      return true
    }

    return false
  }

  _closeMenubar () {
    ipcRenderer.send('closeMenubar')
  }

  _onRekey (path: ?string) {
    this.props.openRekeyDialog()
    this._closeMenubar()
  }

  _openFolder (path: ?string) {
    this.props.openInKBFS(path || defaultKBFSPath)
    this._closeMenubar()
  }

  _logIn () {
    this._showMain()
    this.props.onShowLoginTab()
    this._closeMenubar()
  }

  _showHelp () {
    ipcRenderer.send('openURL', 'help')
    this._closeMenubar()
  }

  _showMain () {
    ipcRenderer.send('showMain')
  }

  _showUser () {
    ipcRenderer.send('openURL', 'user', {username: this.props.username})
    this._closeMenubar()
  }

  _openShell () {
    if (process.platform === 'win32') {
      let shellCmd = 'start "Keybase Shell" "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Keybase\\Keybase Shell.lnk"'
      exec(shellCmd, (err) => {
        if (err) {
          console.log('Error starting Keybase Shell:', err)
        }
      })
    }
  }

  _quit () {
    executeActionsForContext('quitButton')
  }

  _showBug () {
    const version = __VERSION__ // eslint-disable-line no-undef
    shell.openExternal(`https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(version)}`)
  }

  render () {
    return <Render
      folderProps={this.props.folderProps}
      loggedIn={!!this.props.loggedIn}
      logIn={() => this._logIn()}
      showHelp={() => this._showHelp()}
      showUser={() => this._showUser()}
      showKBFS={() => this._openFolder()}
      openApp={() => this._showMain()}
      openShell={() => this._openShell()}
      showBug={() => this._showBug()}
      username={this.props.username}
      kbfsStatus={this.props.kbfsStatus}
      quit={() => this._quit()}
      refresh={() => this._checkForFolders(true)}
      onRekey={(path: string) => this._onRekey(path)}
      onFolderClick={(path: string) => this._openFolder(path)}
    />
  }
}

// $FlowIssue type this connector
export default connect(
  state => ({
    username: state.config && state.config.username,
    loggedIn: state.config && state.config.loggedIn,
    folderProps: state.favorite && state.favorite.folderState,
    kbfsStatus: state.favorite && state.favorite.kbfsStatus,
  }),
  dispatch => ({
    onShowLoginTab: () => { dispatch(navigateTo([loginTab])) },
    ...bindActionCreators({...favoriteAction, openInKBFS, openRekeyDialog}, dispatch),
  })
)(Menubar)

export function selector (): (store: Object) => Object {
  return store => {
    return {
      config: {
        username: store.config.username,
        loggedIn: store.config.loggedIn,
        kbfsPath: store.config.kbfsPath,
        extendedConfig: store.config.extendedConfig,
      },
      favorite: store.favorite,
      dev: {
        reloading: store.dev.reloading,
      },
    }
  }
}
