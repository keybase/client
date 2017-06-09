// @flow
import * as favoriteAction from '../actions/favorite'
import React, {Component} from 'react'
import Render from './index.render'
import engine from '../engine'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {defaultKBFSPath} from '../constants/config'
import {executeActionsForContext} from '../util/quit-helper.desktop'
import {exec} from 'child_process'
import {isWindows} from '../constants/platform'
import {loginTab} from '../constants/tabs'
import {openDialog as openRekeyDialog} from '../actions/unlock-folders'
import {openInKBFS} from '../actions/kbfs'
import {shell, ipcRenderer} from 'electron'
import {navigateTo, switchTo} from '../actions/route-tree'

import type {KBFSStatus} from '../constants/favorite'
import type {Props as FolderProps} from '../folders/render'
import type {Tab} from '../constants/tabs'

export type Props = $Shape<{
  username: ?string,
  openRekeyDialog: () => void,
  favoriteList: () => void,
  openInKBFS: (target?: any) => void,
  loggedIn: ?boolean,
  switchTab: (tab: string) => void,
  onShowLoginTab: () => void,
  folderProps: ?FolderProps,
  kbfsStatus: KBFSStatus,
  badgeInfo: {[key: Tab]: number},
}>

const REQUEST_DELAY = 5000

class Menubar extends Component<void, Props, void> {
  _lastRequest: number

  constructor(props) {
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
        engine().listenOnConnect('menubar', () => {})
      })
    }

    if (module.hot && typeof module.hot.dispose === 'function') {
      module.hot.dispose(() => {
        try {
          engine().reset()
          ipcRenderer.send('unsubscribeMenubar')
          ipcRenderer.removeListener('menubarShow', onMenubarShow)
          ipcRenderer.removeListener('menubarHide', onMenubarHide)
        } catch (_) {}
      })
    }

    try {
      ipcRenderer.send('subscribeMenubar')
      ipcRenderer.on('menubarShow', onMenubarShow)
      ipcRenderer.on('menubarHide', onMenubarHide)
    } catch (_) {}
  }

  _checkForFolders(force) {
    const now = Date.now()

    if (now - this._lastRequest < REQUEST_DELAY) {
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

  componentDidMount() {
    this._checkForFolders()
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.props.username !== nextProps.username || this.props.loggedIn !== nextProps.loggedIn) {
      this._lastRequest = 0 // reset delay since user/loggedin changed
      this._checkForFolders()
      return true
    }

    if (
      this.props.folderProps !== nextProps.folderProps ||
      JSON.stringify(this.props.badgeInfo) !== JSON.stringify(nextProps.badgeInfo)
    ) {
      return true
    }

    return false
  }

  _closeMenubar() {
    ipcRenderer.send('closeMenubar')
  }

  _onRekey(path: ?string) {
    this.props.openRekeyDialog()
    this._closeMenubar()
  }

  _openFolder(path: ?string) {
    this.props.openInKBFS(path || defaultKBFSPath)
    this._closeMenubar()
  }

  _logIn() {
    this._showMain()
    this.props.onShowLoginTab()
    this._closeMenubar()
  }

  _showHelp() {
    ipcRenderer.send('openURL', 'help')
    this._closeMenubar()
  }

  _showMain() {
    ipcRenderer.send('showMain')
  }

  _showUser() {
    ipcRenderer.send('openURL', 'user', {username: this.props.username})
    this._closeMenubar()
  }

  _openShell() {
    if (isWindows) {
      let shellCmd =
        'start "Keybase Shell" "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Keybase\\Keybase Shell.lnk"'
      exec(shellCmd, err => {
        if (err) {
          console.log('Error starting Keybase Shell:', err)
        }
      })
    }
  }

  _quit() {
    executeActionsForContext('quitButton')
  }

  _showBug() {
    const version = __VERSION__ // eslint-disable-line no-undef
    shell.openExternal(
      `https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(version)}`
    )
  }

  render() {
    return (
      <Render
        folderProps={this.props.folderProps}
        loggedIn={!!this.props.loggedIn}
        logIn={() => this._logIn()}
        showHelp={() => this._showHelp()}
        showUser={() => this._showUser()}
        showKBFS={() => this._openFolder()}
        openApp={(tab?: Tab) => {
          this._showMain()
          tab && this.props.switchTab(tab)
        }}
        openShell={() => this._openShell()}
        showBug={() => this._showBug()}
        username={this.props.username}
        kbfsStatus={this.props.kbfsStatus}
        quit={() => this._quit()}
        refresh={() => this._checkForFolders(true)}
        onRekey={(path: string) => this._onRekey(path)}
        onFolderClick={(path: string) => this._openFolder(path)}
        badgeInfo={this.props.badgeInfo}
      />
    )
  }
}

// $FlowIssue type this connector
export default connect(
  state => ({
    username: state.config && state.config.username,
    loggedIn: state.config && state.config.loggedIn,
    folderProps: state.favorite && state.favorite.folderState,
    kbfsStatus: state.favorite && state.favorite.kbfsStatus,
    badgeInfo: (state.notifications && state.notifications.navBadges) || {},
  }),
  dispatch => ({
    ...bindActionCreators({...favoriteAction, openInKBFS, openRekeyDialog}, dispatch),
    onShowLoginTab: () => {
      dispatch(navigateTo([loginTab]))
    },
    switchTab: tab => {
      dispatch(switchTo([tab]))
    },
  })
)(Menubar)

export function selector(): (store: Object) => Object {
  return store => {
    return {
      config: {
        username: store.config.username,
        loggedIn: store.config.loggedIn,
        kbfsPath: store.config.kbfsPath,
        extendedConfig: store.config.extendedConfig,
      },
      notifications: {
        // This function is called in two contexts, one with immutable (main window deciding what to send) and one without (node thread sending to remote). This is VERY confusing and should change but
        // this is the only instance of a remote store we have that has immutable. i have some better ideas than this that have to wait until after mobile (CN)
        navBadges: store.notifications.get
          ? store.notifications.get('navBadges').toJS()
          : store.notifications.navBadges,
      },
      favorite: store.favorite,
      dev: {
        reloading: store.dev.reloading,
      },
    }
  }
}
