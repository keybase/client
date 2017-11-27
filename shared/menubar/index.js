// @flow
import * as KBFSGen from '../actions/kbfs-gen'
import * as FavoriteGen from '../actions/favorite-gen'
import React, {Component} from 'react'
import Render from './index.render'
import engine from '../engine'
import {connect} from 'react-redux'
import {defaultKBFSPath} from '../constants/config'
import {executeActionsForContext} from '../util/quit-helper.desktop'
import {loginTab, type Tab} from '../constants/tabs'
import {navigateTo, switchTo} from '../actions/route-tree'
import {openDialog as openRekeyDialog} from '../actions/unlock-folders'
import {shell, ipcRenderer} from 'electron'
import {type KBFSStatus} from '../constants/types/favorite'
import {type Props as FolderProps} from '../folders'

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

class Menubar extends Component<Props> {
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

const mapStateToProps = state => ({
  username: state.config && state.config.username,
  loggedIn: state.config && state.config.loggedIn,
  folderProps: state.favorite && state.favorite.folderState,
  kbfsStatus: state.favorite && state.favorite.kbfsStatus,
  badgeInfo: (state.notifications && state.notifications.navBadges) || {},
})

const mapDispatchToProps = dispatch => ({
  favoriteList: () => dispatch(FavoriteGen.createFavoriteList()),
  openRekeyDialog: () => dispatch(openRekeyDialog()),
  openInKBFS: path => dispatch(KBFSGen.createOpen({path})),
  onShowLoginTab: () => dispatch(navigateTo([loginTab])),
  switchTab: tab => dispatch(switchTo([tab])),
})

export default connect(mapStateToProps, mapDispatchToProps)(Menubar)
