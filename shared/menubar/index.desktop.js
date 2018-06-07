// @flow
import Folders, {type FolderType, type Props as FolderProps} from '../folders/index.desktop'
import React, {Component} from 'react'
import UserAdd from './user-add.desktop'
import {Box, Icon, Text, Button, PopupMenu, Badge, ButtonBar, type IconType} from '../common-adapters'
import {fsTab, peopleTab, chatTab, devicesTab, type Tab} from '../constants/tabs'
import {globalStyles, globalColors, desktopStyles, collapseStyles, platformStyles} from '../styles'
import {isDarwin} from '../constants/platform'
import * as SafeElectron from '../util/safe-electron.desktop'
import {throttle} from 'lodash-es'

export type Props = {
  folderProps: ?FolderProps,
  isAsyncWriteHappening: boolean,
  logIn: () => void,
  loggedIn: boolean,
  onFolderClick: (path: ?string) => void,
  onRekey: (path: string) => void,
  openApp: () => void,
  quit: () => void,
  refresh: () => void,
  showBug: () => void,
  showHelp: () => void,
  showUser: (username: ?string) => void,
  username: ?string,
  badgeInfo: Object,
}

type State = {
  selected: FolderType,
  showingMenu: boolean,
}

class MenubarRender extends Component<Props, State> {
  state: State = {
    selected: 'private',
    showingMenu: false,
  }

  _onShow = throttle(() => {
    this.props.refresh()
  }, 1000 * 5)

  constructor(props: Props) {
    super(props)
    SafeElectron.getRemote()
      .getCurrentWindow()
      .on('show', this._onShow)
  }

  render() {
    return this.props.loggedIn ? this._renderFolders() : this._renderLoggedOut()
  }

  _renderLoggedOut() {
    const styles = stylesPublic

    const menuColor = this.state.showingMenu ? globalColors.black_60 : globalColors.black_40
    const menuStyle = platformStyles({
      isElectron: {
        ...desktopStyles.clickable,
      },
    })

    return (
      <Box style={styles.container}>
        {isDarwin && <style>{_realCSS}</style>}
        {isDarwin && <ArrowTick />}
        <Box style={{...stylesTopRow, justifyContent: 'flex-end'}}>
          <Icon
            style={menuStyle}
            color={menuColor}
            hoverColor={menuColor}
            type="iconfont-hamburger"
            onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
          />
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Icon type="icon-keybase-logo-logged-out-64" style={stylesLogo} color={globalColors.yellow} />
          <Text type="Body" small={true} style={{alignSelf: 'center', marginTop: 6}}>
            You're logged out of Keybase!
          </Text>
          <ButtonBar direction="row">
            <Button type="Primary" label="Log In" onClick={this.props.logIn} />
          </ButtonBar>
        </Box>
        {this.state.showingMenu && (
          <PopupMenu
            style={styleMenu}
            items={this._menuItems()}
            onHidden={() => this.setState({showingMenu: false})}
          />
        )}
      </Box>
    )
  }

  _menuItems() {
    return [
      ...(this.props.loggedIn ? [{title: 'Open Keybase', onClick: () => this.props.openApp()}] : []),
      {title: 'Open folders', onClick: () => this.props.onFolderClick()},
      {title: 'Keybase.io', onClick: () => this.props.showUser()},
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

    const styles = this.state.selected === 'private' ? stylesPrivate : stylesPublic

    const mergedProps = {
      ...this.props.folderProps,
      onClick: this.props.onFolderClick,
      private: newPrivate,
      public: newPublic,
      onSwitchTab: selected => this.setState({selected}),
      selected: this.state.selected,
      onRekey: this.props.onRekey,
    }

    const badgeTypes: Array<Tab> = [fsTab, peopleTab, chatTab, devicesTab]

    return (
      <Box style={styles.container}>
        {isDarwin && <style>{_realCSS}</style>}
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
            {badgeTypes.map(tab => (
              <BadgeIcon key={tab} tab={tab} countMap={this.props.badgeInfo} openApp={this.props.openApp} />
            ))}
          </Box>
          <Icon
            style={collapseStyles([
              desktopStyles.clickable,
              {
                width: 16,
                marginLeft: 8,
              },
            ])}
            color={globalColors.black_40}
            hoverColor={globalColors.black}
            type="iconfont-hamburger"
            onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
          />
        </Box>
        <Folders {...mergedProps} />
        {this.props.isAsyncWriteHappening && (
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
          </Box>
        )}
        {this.state.showingMenu && (
          <PopupMenu
            style={styleMenu}
            items={this._menuItems()}
            onHidden={() => this.setState({showingMenu: false})}
          />
        )}
      </Box>
    )
  }
}

const _realCSS = `
body {
  background-color: ${globalColors.transparent};
}
`

const ArrowTick = () => (
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
)

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

  const iconMap: {[key: Tab]: IconType} = {
    [chatTab]: 'iconfont-nav-chat',
    [devicesTab]: 'iconfont-nav-devices',
    [fsTab]: 'iconfont-nav-files',
    [peopleTab]: 'iconfont-nav-people',
  }
  const iconType: ?IconType = iconMap[tab]

  if (!iconType) {
    return null
  }

  return (
    <Box
      style={{...desktopStyles.clickable, marginLeft: 7, marginRight: 7, position: 'relative'}}
      onClick={() => openApp(tab)}
    >
      <Icon color={count ? globalColors.blue : globalColors.lightGrey2} fontSize={20} type={iconType} />
      {!!count && <Badge badgeNumber={count} badgeStyle={{position: 'absolute', left: 18, top: 0}} />}
    </Box>
  )
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
  marginBottom: 12,
}

const styleMenu = {
  position: 'absolute',
  top: 29,
  right: 4,
}

export default MenubarRender
