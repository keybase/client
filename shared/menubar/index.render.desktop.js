// @flow
import React, {Component} from 'react'

import {Box, Icon, Text, Button, PopupMenu} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles/style-guide'
import Folders from '../folders/render'
import type {Props} from './index.render'
import UserAdd from './user-add'

type State = {
  showingPublic: boolean,
  showingMenu: boolean
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showingPublic: false,
      showingMenu: false
    }
  }

  render () {
    return this.props.loggedIn ? this._renderFolders() : this._renderLoggedOut()
  }

  _renderLoggedOut () {
    const styles = stylesPublic

    const menuColor = this.state.showingMenu ? globalColors.black : globalColors.black_40
    const menuStyle = {...globalStyles.clickable, color: menuColor, hoverColor: menuColor, fontSize: 12}

    return (
      <Box style={{...styles.container}}>
        <Box style={{...stylesTopRow, position: 'absolute'}}>
          <Icon
            style={menuStyle}
            type='fa-kb-iconfont-hamburger'
            onClick={() => this.setState({showingMenu: !this.state.showingMenu})} />
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Icon type='logo-128' style={stylesLogo} />
          <Text type='Body' small style={{alignSelf: 'center', marginTop: 6}}>You're logged out of Keybase!</Text>
          <Button type='Primary' label='Log In' onClick={this.props.logIn} style={{alignSelf: 'center', minWidth: 160, marginTop: 12}} />
        </Box>
        <PopupMenu visible={this.state.showingMenu} items={this._menuItems()} onHidden={() => this.setState({showingMenu: false})} />
      </Box>
    )
  }

  _menuItems () {
    return [
      {title: 'Open folders', onClick: this.props.showKBFS},
      {title: 'Keybase.io', onClick: this.props.showUser},
      {title: 'Report a bug', onClick: this.props.showBug},
      {title: 'Help/Doc', onClick: this.props.showHelp},
      {title: 'Quit', onClick: this.props.quit}
    ]
  }

  _onAdd (path: string) {
    this.props.onClick && this.props.onClick(path)
    this.props.refresh()
  }

  _renderFolders () {
    const newPrivate = {
      ...(this.props.folderProps && this.props.folderProps.private),
      ignored: [],
      extraRows: [<UserAdd
        key='useraddPriv'
        isPublic={false}
        onAdded={path => this._onAdd(path)}
        username={this.props.username} />]
    }

    const newPublic = {
      ...(this.props.folderProps && this.props.folderProps.public),
      ignored: [],
      extraRows: [<UserAdd
        key='useraddPub'
        isPublic
        onAdded={path => this._onAdd(path)}
        username={this.props.username} />]
    }

    const styles = this.state.showingPublic ? stylesPublic : stylesPrivate

    const mergedProps = {
      ...this.props,
      smallMode: true,
      private: newPrivate,
      public: newPublic,
      onSwitchTab: showingPublic => this.setState({showingPublic})
    }

    const menuColor = this.state.showingPublic
      ? (this.state.showingMenu ? globalColors.black : globalColors.black_40)
      : (this.state.showingMenu ? globalColors.white : globalColors.blue3_40)

    const menuStyle = {...globalStyles.clickable, color: menuColor, hoverColor: menuColor, fontSize: 24}

    return (
      <Box style={styles.container}>
        <Box style={stylesTopRow}>
          <Icon
            style={menuStyle}
            type='fa-kb-iconfont-hamburger'
            onClick={() => this.setState({showingMenu: !this.state.showingMenu})} />
        </Box>
        <Folders {...mergedProps} />
        <PopupMenu visible={this.state.showingMenu} items={this._menuItems()} onHidden={() => this.setState({showingMenu: false})} />
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  position: 'relative'
}

const stylesTopRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  minHeight: 34,
  padding: 10
}

const stylesPrivate = {
  container: {
    ...stylesContainer,
    backgroundColor: globalColors.darkBlue
  }
}

const stylesPublic = {
  container: {
    ...stylesContainer,
    backgroundColor: globalColors.white
  }
}

const stylesLogo = {
  alignSelf: 'center',
  color: globalColors.yellow,
  marginBottom: 12
}

export default Render
