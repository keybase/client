/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from '../base-react'
import Render from './index.render'
import {connect} from '../base-redux'
import {bindActionCreators} from 'redux'
import {getTLF} from '../util/kbfs'

import * as favoriteAction from '../actions/favorite'

import {remote, shell} from 'electron'
import {ipcRenderer} from 'electron'

import {kbfsPath} from '../constants/platform'

import type {Folder} from '../constants/types/flow-types'
import type {FolderInfo} from './index.render'

export type MenubarProps = {
  username: ?string,
  folders: ?Array<Folder>,
  favoriteList: () => void,
  debug: ?boolean
}

class Menubar extends Component {
  props: MenubarProps;

  constructor (props) {
    super(props)

    // Normally I'd put this into the store but it's just too slow to get the state correctly through props so we'd get flashes so
    // instead we manually manage loading state in this one circumstance. DO NOT DO THIS normally
    this.state = {
      loading: true
    }

    const onMenubarShow = () => {
      this.checkForFolders()
    }

    const onMenubarHide = () => {
      this.setState({loading: true})
    }

    if (module.hot) {
      module.hot.dispose(() => {
        ipcRenderer.send('unsubscribeMenubar')
        ipcRenderer.removeListener('menubarShow', onMenubarShow)
        ipcRenderer.removeListener('menubarHide', onMenubarHide)
      })
    }

    ipcRenderer.send('subscribeMenubar')
    ipcRenderer.on('menubarShow', onMenubarShow)
    ipcRenderer.on('menubarHide', onMenubarHide)
  }

  checkForFolders () {
    if (this.props.username && this.props.loggedIn && !this.props.loading) {
      this.setState({loading: true})
      this.props.favoriteList()
    }
  }

  componentWillReceiveProps (nextProps) {
    if (this.props.folders !== nextProps.folders) {
      this.setState({loading: false})
    }
  }

  componentDidMount () {
    this.checkForFolders()
  }

  closeMenubar () {
    ipcRenderer.send('closeMenubar')
  }

  openKBFS () {
    shell.openItem(kbfsPath)
    this.closeMenubar()
  }

  openKBFSPublic () {
    shell.openItem(`${kbfsPath}/public/${this.props.username}`)
    this.closeMenubar()
  }

  openKBFSPrivate () {
    shell.openItem(`${kbfsPath}/private/${this.props.username}`)
    this.closeMenubar()
  }

  showMain () {
    ipcRenderer.send('showMain')
    this.closeMenubar()
  }

  showHelp () {
    ipcRenderer.send('showHelp')
    this.closeMenubar()
  }

  render () {
    const openingMessage = this.props.username ? 'Keybase Alpha' : 'Looks like you aren\'t logged in. Try running `keybase login`'

    const openingButtonInfo = this.props.username && {text: 'WTF?', onClick: this.showHelp}
    const folders = (this.props.folders || []).map(function (f: Folder): FolderInfo {
      return {
        folderName: f.name,
        isPublic: !f.private,
        // TODO we don't get this information right now,
        isEmpty: false,
        openFolder: () => {
          setImmediate(() => shell.openItem(`${kbfsPath}${getTLF(!f.private, f.name)}`))
          this.closeMenubar()
        }
      }
    })

    return <Render
      username={this.props.username}
      openingMessage={openingMessage}
      debug={!!this.props.debug}
      openingButtonInfo={openingButtonInfo}
      openKBFS={() => this.openKBFS()}
      openKBFSPublic={() => this.openKBFSPublic()}
      openKBFSPrivate={() => this.openKBFSPrivate()}
      showMain={() => this.showMain()}
      showHelp={() => this.showHelp()}
      quit={() => remote.app.quit()}
      folders={folders}
      loading={this.state.loading}
    />
  }
}

export default connect(
  state => ({
    username: state.config && state.config.status && state.config.status.user && state.config.status.user.username,
    loggedIn: state.config && state.config.status && state.config.status.loggedIn,
    folders: state.favorite && state.favorite.folders
  }),
  dispatch => bindActionCreators(favoriteAction, dispatch)
)(Menubar)
