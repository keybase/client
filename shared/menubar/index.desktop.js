// @flow
import Folders, {type FolderType, type Props as FolderProps} from '../folders/index.desktop'
import React, {Component} from 'react'
import UserAdd from './user-add.desktop'
import flags from '../util/feature-flags'
import {Box, Box2, Icon, Text, Button, FloatingMenu, Badge, ButtonBar, type IconType} from '../common-adapters'
import {
  fsTab,
  peopleTab,
  chatTab,
  devicesTab,
  teamsTab,
  walletsTab,
  gitTab,
  settingsTab,
  type Tab,
} from '../constants/tabs'
import {globalStyles, globalColors, globalMargins, desktopStyles, collapseStyles, platformStyles} from '../styles'
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
  openApp: (tab: ?string) => void,
  quit: () => void,
  refresh: () => void,
  showBug: () => void,
  showHelp: () => void,
  showUser: (username: ?string) => void,
  username: ?string,
  badgeInfo: {[string]: number},
}

type State = {|
  selected: FolderType,
  showingMenu: boolean,
|}

class MenubarRender extends Component<Props, State> {
  state: State = {
    selected: 'private',
    showingMenu: false,
  }

  attachmentRef = React.createRef()

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
    // TODO: refactor all this duplicated code!
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
            type="iconfont-nav-more"
            onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
            ref={this.attachmentRef}
          />
          <FloatingMenu
            visible={this.state.showingMenu}
            attachTo={this.attachmentRef.current}
            items={this._menuItems(this.props.badgeInfo || {})}
            onHidden={() => this.setState({showingMenu: false})}
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
      </Box>
    )
  }

  _menuView(title: string, iconType: IconType, count: number) {
    return (
      <Box2 direction="horizontal" style={{width: '100%'}}>
        <Box style={{marginRight: globalMargins.xsmall, position: 'relative'}}>
          <Icon type={iconType} color={globalColors.black_20} fontSize={20} />
          {!!count && <Badge badgeNumber={count} badgeStyle={{position: 'absolute', left: 14, top: -2}} />}
        </Box>
        <Text
          className="title"
          type="Body"
          style={collapseStyles([{color: undefined}])}
        >
          {title}
        </Text>
      </Box2>
    )
  }

  _menuItems(countMap: Object) {
    return [
      ...(flags.walletsEnabled ? [{title: 'Wallet', view: this._menuView('Wallet', 'iconfont-nav-wallets', countMap[walletsTab] || 0), onClick: () => this.props.openApp(walletsTab)}] : []),
      {title: 'Git', view: this._menuView('Git', 'iconfont-nav-git', countMap[gitTab] || 0), onClick: () => this.props.openApp(gitTab)},
      {title: 'Devices', view: this._menuView('Devices', 'iconfont-nav-devices', countMap[devicesTab] || 0), onClick: () => this.props.openApp(devicesTab)},
      {title: 'Settings', view: this._menuView('Settings', 'iconfont-nav-settings', countMap[settingsTab] || 0), onClick: () => this.props.openApp(settingsTab)},
      'Divider',
      ...(this.props.loggedIn ? [{title: 'Open main app', onClick: () => this.props.openApp()}] : []),
      {title: 'Open folders', onClick: () => this.props.openApp(fsTab)},
      'Divider',
      {title: 'Keybase.io', onClick: () => this.props.showUser()},
      {title: 'Report a bug', onClick: this.props.showBug},
      {title: 'Help', onClick: this.props.showHelp},
      {title: 'Quit app', onClick: this.props.quit},
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

    const badgeTypesInHeader: Array<Tab> = [peopleTab, chatTab, fsTab, teamsTab]
    const badgesInMenu: Set<string> = new Set([
      ...(flags.walletsEnabled ? [walletsTab] : []),
      gitTab,
      devicesTab,
      settingsTab,
    ])
    const badgeCountInMenu = Object.entries(this.props.badgeInfo).reduce(
      // $FlowIssue can't figure out mixed -> number in val[1].
      (acc, val) => badgesInMenu.has(val[0]) ? acc + val[1] : acc,
      0
    )

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
            {badgeTypesInHeader.map(tab => (
              <BadgeIcon key={tab} tab={tab} countMap={this.props.badgeInfo} openApp={this.props.openApp} />
            ))}
          </Box>
          <Box
            style={collapseStyles([
              desktopStyles.clickable,
              {
                marginRight: globalMargins.tiny,
                position: 'relative',
              },
            ])}
            onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
          >
            <Icon
              color={globalColors.darkBlue4}
              hoverColor={globalColors.black_75}
              type="iconfont-nav-more"
              ref={this.attachmentRef}
            />
            {!!badgeCountInMenu && <Badge
              badgeNumber={badgeCountInMenu}
              badgeStyle={{position: 'absolute', left: 14, top: -2}} />}
          </Box>
          <FloatingMenu
            items={this._menuItems(this.props.badgeInfo || {})}
            visible={this.state.showingMenu}
            onHidden={() =>
              this.setState({
                showingMenu: false,
              })
            }
            attachTo={this.attachmentRef.current}
            position="bottom right"
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
    [peopleTab]: 'iconfont-nav-people',
    [chatTab]: 'iconfont-nav-chat',
    [devicesTab]: 'iconfont-nav-devices',
    [fsTab]: 'iconfont-nav-files',
    [teamsTab]: 'iconfont-nav-teams',
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
      <Icon color={globalColors.darkBlue4} hoverColor={globalColors.black_75} fontSize={22} type={iconType} />
      {!!count && <Badge badgeNumber={count} badgeStyle={{position: 'absolute', left: 14, top: -2}} />}
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
  backgroundColor: globalColors.darkBlue2,
  flex: 1,
  minHeight: 40,
  maxHeight: 40,
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

export default MenubarRender
