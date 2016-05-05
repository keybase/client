// @flow
import React, {Component} from 'react'

import {Box, Icon, Text, Button} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles/style-guide'
import Folders from '../folders/render'
import type {Props} from './index.render'

type State = {
  showingPublic: boolean,
  showingMenu: boolean
}

const Menu = ({showHelp, showUser, showKBFS, showBug, quit, hideMenu}) => {
  const realCSS = `
  .menu-hover:hover {
    background-color: ${globalColors.blue4}
  }
  `

  return (
    <Box style={stylesMenuCatcher} onClick={() => hideMenu()}>
      <style>{realCSS}</style>
      <Box style={stylesMenu}>
        <Text className='menu-hover' type='Body' style={stylesMenuText} onClick={showKBFS}>Open folders in Finder</Text>
        <Text className='menu-hover' type='Body' style={stylesMenuText} onClick={showUser}>Keybase.io</Text>
        <Text className='menu-hover' type='Body' style={stylesMenuText} onClick={showBug}>Report a bug</Text>
        <Text className='menu-hover' type='Body' style={stylesMenuText} onClick={showHelp}>Help/Doc</Text>
        <Text className='menu-hover' type='Body' style={stylesMenuText} onClick={quit}>Quit</Text>
      </Box>
    </Box>
  )
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

    return (
      <Box style={{...styles.container, justifyContent: 'center'}}>
        <Icon type='logo-128' style={stylesLogo} />
        <Text type='Body' small style={{alignSelf: 'center', marginTop: 6}}>You're logged out of Keybase!</Text>
        <Button type='Primary' label='Log In' onClick={this.props.logIn} style={{alignSelf: 'center', minWidth: 160, marginTop: 12}} />
      </Box>
    )
  }

  _renderFolders () {
    const noIgnorePrivate = {
      ...this.props.private,
      ignored: []
    }

    const noIgnorePublic = {
      ...this.props.public,
      ignored: []
    }

    const styles = this.state.showingPublic ? stylesPublic : stylesPrivate

    const mergedProps = {
      ...this.props,
      smallMode: true,
      private: noIgnorePrivate,
      public: noIgnorePublic,
      onSwitchTab: showingPublic => this.setState({showingPublic}),
      onClick: this.props.onClick
    }

    const menuColor = this.state.showingPublic
      ? (this.state.showingMenu ? globalColors.black : globalColors.black_40)
      : (this.state.showingMenu ? globalColors.white : globalColors.blue3_40)

    const menuStyle = {color: menuColor, hoverColor: menuColor, fontSize: 12}

    return (
      <Box style={styles.container}>
        <Box style={stylesTopRow}>
          <Icon
            style={menuStyle}
            type='fa-custom-icon-hamburger'
            onClick={() => this.setState({showingMenu: !this.state.showingMenu})} />
        </Box>
        <Folders {...mergedProps} />
        {this.state.showingMenu &&
          <Menu {...this.props} hideMenu={() => this.setState({showingMenu: false})} />}
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

const stylesMenuCatcher = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0
}

const stylesMenu = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  backgroundColor: globalColors.white,
  borderRadius: 3,
  paddingTop: 7,
  paddingBottom: 7,
  marginTop: 29,
  marginLeft: 4
}

const stylesMenuText = {
  lineHeight: '30px',
  paddingLeft: 15,
  paddingRight: 15
}

export default Render
