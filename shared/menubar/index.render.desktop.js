// @flow
import Folders from '../folders/render'
import React, {Component} from 'react'
import UserAdd from './user-add'
import {Box, Icon, Text, Button, PopupMenu, Badge} from '../common-adapters/index'
import {folderTab, profileTab, chatTab, devicesTab} from '../constants/tabs'
import {globalStyles, globalColors} from '../styles'
import {isWindows, isDarwin} from '../constants/platform'

import type {Props} from './index.render'
import type {Tab} from '../constants/tabs'

type State = {
  showingPrivate: boolean,
  showingMenu: boolean,
}

type DefaultProps = {
  openToPrivate: boolean,
  openWithMenuShowing: boolean,
}

class MenubarRender extends Component<DefaultProps, Props, State> {
  static defaultProps: DefaultProps
  state: State

  constructor(props: Props & DefaultProps) {
    super(props)

    this.state = {
      showingPrivate: props.openToPrivate,
      showingMenu: props.openWithMenuShowing,
    }
  }

  render() {
    return this.props.loggedIn ? this._renderFolders() : this._renderLoggedOut()
  }

  _renderLoggedOut() {
    const styles = stylesPublic

    const menuColor = this.state.showingMenu ? globalColors.black_60 : globalColors.black_40
    const menuStyle = {...globalStyles.clickable, color: menuColor, hoverColor: menuColor, fontSize: 24}

    return (
      <Box style={styles.container}>
        {isDarwin &&
          <style>
            {_realCSS}
          </style>}
        {isDarwin && <ArrowTick />}
        <Box style={{...stylesTopRow, justifyContent: 'flex-end'}}>
          <Icon
            style={menuStyle}
            type="iconfont-hamburger"
            onClick={() => this.setState({showingMenu: !this.state.showingMenu})}
          />
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Icon type="icon-keybase-logo-logged-out-64" style={stylesLogo} />
          <Text type="Body" small={true} style={{alignSelf: 'center', marginTop: 6}}>
            You're logged out of Keybase!
          </Text>
          <Button
            type="Primary"
            label="Log In"
            onClick={this.props.logIn}
            style={{alignSelf: 'center', marginTop: 12}}
          />
        </Box>
        {this.state.showingMenu &&
          <PopupMenu
            style={styleMenu}
            items={this._menuItems()}
            onHidden={() => this.setState({showingMenu: false})}
          />}
      </Box>
    )
  }

  _menuItems() {
    return [
      ...(this.props.loggedIn ? [{title: 'Open Keybase', onClick: () => this.props.openApp()}] : []),
      {title: 'Open folders', onClick: this.props.showKBFS},
      ...(isWindows ? [{title: 'Keybase Shell', onClick: this.props.openShell}] : []),
      {title: 'Keybase.io', onClick: this.props.showUser},
      {title: 'Report a bug', onClick: this.props.showBug},
      {title: 'Help/Doc', onClick: this.props.showHelp},
      {title: 'Quit', onClick: this.props.quit},
    ]
  }

  _onAdd(path: string) {
    this.props.onFolderClick(path)
    this.props.refresh()
  }

  _renderFolders() {
    const newPrivate = {
      ...(this.props.folderProps && this.props.folderProps.private),
      ignored: [],
      extraRows: [
        <UserAdd
          key="useraddPriv"
          isPublic={false}
          onAdded={path => this._onAdd(path)}
          username={this.props.username}
        />,
      ],
    }

    const newPublic = {
      ...(this.props.folderProps && this.props.folderProps.public),
      ignored: [],
      extraRows: [
        <UserAdd
          key="useraddPub"
          isPublic={true}
          onAdded={path => this._onAdd(path)}
          username={this.props.username}
        />,
      ],
    }

    const styles = this.state.showingPrivate ? stylesPrivate : stylesPublic

    const mergedProps = {
      ...this.props.folderProps,
      onClick: this.props.onFolderClick,
      showComingSoon: false,
      smallMode: true,
      private: newPrivate,
      public: newPublic,
      onSwitchTab: showingPrivate => this.setState({showingPrivate}),
      showingPrivate: this.state.showingPrivate,
      onRekey: this.props.onRekey,
    }

    const badgeTypes: Array<Tab> = [folderTab, profileTab, chatTab, devicesTab]

    return (
      <Box style={styles.container}>
        {isDarwin &&
          <style>
            {_realCSS}
          </style>}
        {isDarwin && <ArrowTick />}
        <Box style={{...stylesTopRow, borderBottom: `1px solid ${globalColors.black_05}`}}>
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 24 + 8,
            }}
          >
            {badgeTypes.map(tab =>
              <BadgeIcon key={tab} tab={tab} countMap={this.props.badgeInfo} openApp={this.props.openApp} />
            )}
          </Box>
          <Icon
            style={{
              ...globalStyles.clickable,
              color: globalColors.black_40,
              hoverColor: globalColors.black,
              width: 24,
              marginLeft: 8,
            }}
            type="iconfont-hamburger"
            onClick={() => this.setState({showingMenu: !this.state.showingMenu})}
          />
        </Box>
        <Folders {...mergedProps} />
        {this.props.kbfsStatus &&
          this.props.kbfsStatus.isAsyncWriteHappening &&
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 32,
              backgroundColor: globalColors.white,
              padding: 8,
            }}
          >
            <Icon type="icon-loader-uploading-16" />
            <Text type="BodySmall">UPLOADING CHANGES...</Text>
          </Box>}
        {this.state.showingMenu &&
          <PopupMenu
            style={styleMenu}
            items={this._menuItems()}
            onHidden={() => this.setState({showingMenu: false})}
          />}
      </Box>
    )
  }
}

const _realCSS = `
body {
  background-color: ${globalColors.transparent};
}
`

const ArrowTick = () =>
  // Css triangle!
  <Box
    style={{
      height: 0,
      width: 0,
      position: 'absolute',
      left: 0,
      right: 0,
      marginLeft: 'auto',
      marginRight: 'auto',
      top: -6,
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
      borderBottom: `6px solid ${globalColors.white}`,
    }}
  />

const BadgeIcon = ({
  tab,
  countMap,
  openApp,
}: {
  tab: Tab,
  countMap: Object,
  openApp: (tab: ?string) => void,
}) => {
  const count = countMap[tab]

  if (tab === devicesTab && !count) {
    return null
  }

  const iconType = {
    [folderTab]: 'iconfont-folder',
    [profileTab]: 'iconfont-people',
    [chatTab]: 'iconfont-chat',
    [devicesTab]: 'iconfont-device',
    // $FlowIssue TODO
  }[tab]

  return (
    <Box
      style={{...globalStyles.clickable, marginLeft: 7, marginRight: 7, position: 'relative'}}
      onClick={() => openApp(tab)}
    >
      <Icon style={{color: count ? globalColors.blue : globalColors.lightGrey2}} type={iconType} />
      {!!count &&
        <Badge
          badgeNumber={count}
          badgeStyle={{position: 'absolute', left: 14, bottom: -3}}
          outlineColor={globalColors.white}
        />}
    </Box>
  )
}

MenubarRender.defaultProps = {
  openToPrivate: true,
  openWithMenuShowing: false,
}

const borderRadius = 4

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  position: 'relative',
  marginTop: 13,
  borderTopLeftRadius: borderRadius,
  borderTopRightRadius: borderRadius,
}

const stylesTopRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.white,
  flex: 1,
  minHeight: 32,
  maxHeight: 32,
  paddingLeft: 8,
  paddingRight: 8,
  borderTopLeftRadius: borderRadius,
  borderTopRightRadius: borderRadius,
}

const stylesPrivate = {
  container: {
    ...stylesContainer,
    backgroundColor: globalColors.darkBlue,
  },
}

const stylesPublic = {
  container: {
    ...stylesContainer,
    backgroundColor: globalColors.white,
  },
}

const stylesLogo = {
  alignSelf: 'center',
  color: globalColors.yellow,
  marginBottom: 12,
}

const styleMenu = {
  position: 'absolute',
  top: 29,
  right: 4,
}

export default MenubarRender
