/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from 'react'
import Render from './index.render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {getTLF} from '../util/kbfs'
import engine from '../engine'

import * as favoriteAction from '../actions/favorite'
import {openInKBFS} from '../actions/kbfs'
import {switchTab} from '../actions/tabbed-router'

import {remote} from 'electron'
import {ipcRenderer} from 'electron'
import {loginTab} from '../constants/tabs'

import type {Props as RenderProps} from './index.render'
// import type {Folder} from '../constants/types/flow-types'
// import type {FolderInfo} from './index.render'

export type Props = {
  username: ?string,
  // folders: ?Array<Folder>,
  favoriteList: () => void,
  openInKBFS: (target?: any) => void,
  loggedIn: ?boolean,
  switchTab: (tab: string) => void
} & RenderProps

const REQUEST_DELAY = 5000

class Menubar extends Component<void, Props, void> {
  _lastRequest: number;

  constructor (props) {
    super(props)

    this._lastRequest = 0

    const onMenubarShow = () => {
      setImmediate(() => {
        engine.listenOnConnect('menubar', () => {
          this.checkForFolders(true)
        })
      })
    }

    const onMenubarHide = () => {
      setImmediate(() => {
        engine.listenOnConnect('menubar', () => { })
      })
    }

    if (module.hot) {
      module.hot.dispose(() => {
        try {
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

  checkForFolders (force) {
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
    this.checkForFolders()
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (this.props.username !== nextProps.username ||
        this.props.loggedIn !== nextProps.loggedIn) {
      this._lastRequest = 0 // reset delay since user/loggedin changed
      this.checkForFolders()
      return true
    }

    if (this.props.public !== nextProps.public) {
      return true
    }
    if (this.props.private !== nextProps.private) {
      return true
    }

    return false
  }

  closeMenubar () {
    ipcRenderer.send('closeMenubar')
  }

  openKBFS () {
    this.props.openInKBFS()
    this.closeMenubar()
  }

  openKBFSPublic (sub) {
    this.props.openInKBFS(`/public/${sub}`)
    this.closeMenubar()
  }

  openKBFSPrivate (sub) {
    this.props.openInKBFS(`/private/${sub}`)
    this.closeMenubar()
  }

  showMain () {
    ipcRenderer.send('showMain')
    this.props.switchTab(loginTab)
    this.closeMenubar()
  }

  logIn () {
    ipcRenderer.send('showMain')
    this.props.switchTab(loginTab)
    this.closeMenubar()
  }

  showHelp () {
    ipcRenderer.send('openURL', 'help')
    this.closeMenubar()
  }

  showUser (username: ?string) {
    ipcRenderer.send('openURL', 'user', {username})
    this.closeMenubar()
  }

  render () {
    // const {username} = this.props
    // const folders = (this.props.folders || []).map((f: Folder) : FolderInfo => { // eslint-disable-line arrow-parens
      // return {
        // type: 'folder',
        // folderName: f.name,
        // isPublic: !f.private,
        // // TODO we don't get this information right now,
        // isEmpty: false,
        // openFolder: () => {
          // setImmediate(() => this.props.openInKBFS(`${getTLF(!f.private, f.name)}`))
          // this.closeMenubar()
        // }
      // }
    // })

    // const loading = !!username && !this.props.folders
    // const loading = false

    return <Render {...this.props} />
      // username={username}
      // openKBFS={() => this.openKBFS()}
      // openKBFSPublic={username => this.openKBFSPublic(username)}
      // openKBFSPrivate={username => this.openKBFSPrivate(username)}
      // showMain={() => this.showMain()}
      // showHelp={() => this.showHelp()}
      // showUser={user => this.showUser(user)}
      // logIn={() => this.logIn()}
      // quit={() => remote.app.quit()}
      // folders={folders}
      // loading={loading}
      // loggedIn={this.props.loggedIn || false}
  }
}

export default connect(
  state => ({
    username: state.config && state.config.status && state.config.status.user && state.config.status.user.username,
    loggedIn: state.config && state.config.status && state.config.status.loggedIn,
    folders: [] // state.favorite && state.favorite.folders
  }),
  dispatch => bindActionCreators({...favoriteAction, openInKBFS, switchTab}, dispatch)
)(Menubar)

export function selector (): (store: Object) => Object {
  return store => {
    return {
      config: store.config,
      favorite: store.favorite
    }
  }
}
