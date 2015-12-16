/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from '../base-react'
import Render from './index.render'
import {connect} from '../base-redux'

import {remote, shell} from 'electron'
import {ipcRenderer} from 'electron'

export type MenubarProps = {
  username: ?string
}

class Menubar extends Component {
  props: MenubarProps;
  render () {
    const openingMessage = this.props.username ? 'Be sure to drink your Ovaltine.' : "Looks like you aren't logged in. Try running `keybase login`"

    const closeMenubar = () => ipcRenderer.send('closeMenubar')

    // TODO change this to /keybase when all our mount points are `/keybase/...`
    // TODO Support linux
    const kbfsPath = `${process.env.HOME}/keybase`
    const openKBFS = () => { shell.openItem(kbfsPath); closeMenubar() }
    const openKBFSPublic = () => { shell.openItem(`${kbfsPath}/public/${this.props.username}`); closeMenubar() }
    const openKBFSPrivate = () => { shell.openItem(`${kbfsPath}/private/${this.props.username}`); closeMenubar() }

    const showMain = () => { ipcRenderer.send('showMain'); closeMenubar() }
    const showHelp = () => { ipcRenderer.send('showHelp'); closeMenubar() }
    const quit = () => remote.app.emit('destroy')

    const openingButtonInfo = this.props.username && {text: 'Get Started', onClick: showHelp}

    // TODO (pull this debug from somewhere
    return <Render {...{username: this.props.username, openingMessage: openingMessage, debug: true, openingButtonInfo, openKBFS, openKBFSPublic, openKBFSPrivate, showMain, showHelp, quit}}/>
  }
}

export default connect(
  state => ({username: state.config && state.config.status && state.config.status.user && state.config.status.user.username})
)(Menubar)
