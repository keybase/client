// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import Flags from '../util/feature-flags'
import * as Tabs from '../constants/tabs'
import * as Styles from '../styles'
import ChatContainer from './chat-container.desktop'
import FilesPreview from './files-container.desktop'
import {isDarwin} from '../constants/platform'
import * as SafeElectron from '../util/safe-electron.desktop'
import {throttle} from 'lodash-es'

export type Props = {
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
  showingMenu: boolean,
|}

const ArrowTick = () => <Kb.Box style={styles.arrowTick} />

class MenubarRender extends React.Component<Props, State> {
  state: State = {
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
    return this.props.loggedIn ? this._renderLoggedIn() : this._renderLoggedOut()
  }

  _renderLoggedOut() {
    const menuColor = this.state.showingMenu ? Styles.globalColors.black_60 : Styles.globalColors.black_40
    const menuStyle = Styles.platformStyles({
      isElectron: {
        ...Styles.desktopStyles.clickable,
      },
    })

    return (
      <Kb.Box style={styles.widgetContainer}>
        {isDarwin && <style>{_realCSS}</style>}
        {isDarwin && <ArrowTick />}
        <Kb.Box style={Styles.collapseStyles([styles.topRow, {justifyContent: 'flex-end'}])}>
          <Kb.Icon
            style={menuStyle}
            color={menuColor}
            hoverColor={menuColor}
            type="iconfont-nav-more"
            onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
            ref={this.attachmentRef}
          />
          <Kb.FloatingMenu
            closeOnSelect={true}
            visible={this.state.showingMenu}
            attachTo={this._getAttachmentRef}
            items={this._menuItems(this.props.badgeInfo || {})}
            onHidden={() => this.setState({showingMenu: false})}
          />
        </Kb.Box>
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Kb.Icon
            type="icon-keybase-logo-logged-out-64"
            style={Kb.iconCastPlatformStyles(styles.logo)}
            color={Styles.globalColors.yellow}
          />
          <Kb.Text type="Body" small={true} style={{alignSelf: 'center', marginTop: 6}}>
            You're logged out of Keybase!
          </Kb.Text>
          <Kb.ButtonBar direction="row">
            <Kb.Button type="Primary" label="Log In" onClick={this.props.logIn} />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.Box>
    )
  }

  _menuView(title: string, iconType: Kb.IconType, count: number) {
    return (
      <Kb.Box2 direction="horizontal" style={{width: '100%'}}>
        <Kb.Box style={{marginRight: Styles.globalMargins.xsmall, position: 'relative'}}>
          <Kb.Icon type={iconType} color={Styles.globalColors.black_20} fontSize={20} />
          {!!count && <Kb.Badge badgeNumber={count} badgeStyle={{position: 'absolute', left: 14, top: -2}} />}
        </Kb.Box>
        <Kb.Text className="title" type="Body" style={Styles.collapseStyles([{color: undefined}])}>
          {title}
        </Kb.Text>
      </Kb.Box2>
    )
  }

  _menuItems(countMap: Object) {
    return [
      ...(Flags.walletsEnabled
        ? [
            {
              title: 'Wallet',
              view: this._menuView('Wallet', 'iconfont-nav-wallets', countMap[Tabs.walletsTab] || 0),
              onClick: () => this.props.openApp(Tabs.walletsTab),
            },
          ]
        : []),
      {
        title: 'Git',
        view: this._menuView('Git', 'iconfont-nav-git', countMap[Tabs.gitTab] || 0),
        onClick: () => this.props.openApp(Tabs.gitTab),
      },
      {
        title: 'Devices',
        view: this._menuView('Devices', 'iconfont-nav-devices', countMap[Tabs.devicesTab] || 0),
        onClick: () => this.props.openApp(Tabs.devicesTab),
      },
      {
        title: 'Settings',
        view: this._menuView('Settings', 'iconfont-nav-settings', countMap[Tabs.settingsTab] || 0),
        onClick: () => this.props.openApp(Tabs.settingsTab),
      },
      'Divider',
      ...(this.props.loggedIn ? [{title: 'Open main app', onClick: () => this.props.openApp()}] : []),
      {title: 'Open files', onClick: () => this.props.openApp(Tabs.fsTab)},
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

  _getAttachmentRef = () => this.attachmentRef.current

  _renderLoggedIn() {
    const badgeTypesInHeader: Array<Tabs.Tab> = [Tabs.peopleTab, Tabs.chatTab, Tabs.fsTab, Tabs.teamsTab]
    const badgesInMenu = [
      ...(Flags.walletsEnabled ? [Tabs.walletsTab] : []),
      Tabs.gitTab,
      Tabs.devicesTab,
      Tabs.settingsTab,
    ]
    const badgeCountInMenu = badgesInMenu.reduce(
      (acc, val) => (this.props.badgeInfo[val] ? acc + this.props.badgeInfo[val] : acc),
      0
    )

    return (
      <Kb.Box style={styles.widgetContainer}>
        {isDarwin && <style>{_realCSS}</style>}
        {isDarwin && <ArrowTick />}
        <Kb.Box style={styles.topRow}>
          <Kb.Box style={styles.headerBadgesContainer}>
            {badgeTypesInHeader.map(tab => (
              <BadgeIcon key={tab} tab={tab} countMap={this.props.badgeInfo} openApp={this.props.openApp} />
            ))}
          </Kb.Box>
          <Kb.Box
            style={Styles.collapseStyles([
              Styles.desktopStyles.clickable,
              {
                marginRight: Styles.globalMargins.tiny,
                position: 'relative',
              },
            ])}
            onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
          >
            <Kb.Icon
              color={Styles.globalColors.darkBlue4}
              hoverColor={Styles.globalColors.black_75}
              type="iconfont-nav-more"
              ref={this.attachmentRef}
            />
            {!!badgeCountInMenu && (
              <Kb.Badge
                badgeNumber={badgeCountInMenu}
                badgeStyle={{position: 'absolute', left: 14, top: -2}}
              />
            )}
          </Kb.Box>
          <Kb.FloatingMenu
            closeOnSelect={true}
            items={this._menuItems(this.props.badgeInfo || {})}
            visible={this.state.showingMenu}
            onHidden={() =>
              this.setState({
                showingMenu: false,
              })
            }
            attachTo={this._getAttachmentRef}
            position="bottom right"
          />
        </Kb.Box>
        {Flags.fileWidgetEnabled
          ? (
            <Kb.ScrollView>
              <ChatContainer convLimit={3} />
              <FilesPreview />
            </Kb.ScrollView>
          ) : (
            <ChatContainer />
          )
        }
        {this.props.isAsyncWriteHappening && (
          <Kb.Box style={styles.uploadingContainer}>
            <Kb.Icon type="icon-loader-uploading-16" />
            <Kb.Text type="BodySmall">UPLOADING CHANGES...</Kb.Text>
          </Kb.Box>
        )}
      </Kb.Box>
    )
  }
}

const _realCSS = `
body {
  background-color: ${Styles.globalColors.transparent};
}
`

const BadgeIcon = ({
  tab,
  countMap,
  openApp,
}: {
  tab: Tabs.Tab,
  countMap: Object,
  openApp: (tab: ?string) => void,
}) => {
  const count = countMap[tab]

  if (tab === Tabs.devicesTab && !count) {
    return null
  }

  const iconMap: {[key: Tabs.Tab]: Kb.IconType} = {
    [Tabs.peopleTab]: 'iconfont-nav-people',
    [Tabs.chatTab]: 'iconfont-nav-chat',
    [Tabs.devicesTab]: 'iconfont-nav-devices',
    [Tabs.fsTab]: 'iconfont-nav-files',
    [Tabs.teamsTab]: 'iconfont-nav-teams',
  }
  const iconType: ?Kb.IconType = iconMap[tab]

  if (!iconType) {
    return null
  }

  return (
    <Kb.Box
      style={{...Styles.desktopStyles.clickable, marginLeft: 7, marginRight: 7, position: 'relative'}}
      onClick={() => openApp(tab)}
    >
      <Kb.Icon
        color={Styles.globalColors.darkBlue4}
        hoverColor={Styles.globalColors.black_75}
        fontSize={22}
        type={iconType}
      />
      {!!count && <Kb.Badge badgeNumber={count} badgeStyle={{position: 'absolute', top: -6, right: -8}} />}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate({
  widgetContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    position: 'relative',
    marginTop: isDarwin ? 13 : 0,
    borderTopLeftRadius: Styles.globalMargins.xtiny,
    borderTopRightRadius: Styles.globalMargins.xtiny,
    backgroundColor: Styles.globalColors.darkBlue,
  },
  topRow: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.darkBlue2,
    flex: 1,
    minHeight: 40,
    maxHeight: 40,
    paddingLeft: 8,
    paddingRight: 8,
    borderTopLeftRadius: Styles.globalMargins.xtiny,
    borderTopRightRadius: Styles.globalMargins.xtiny,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerBadgesContainer: {
    ...Styles.globalStyles.flexBoxRow,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 24 + 8,
  },
  arrowTick: {
    height: 0,
    width: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    marginLeft: 'auto',
    marginRight: 'auto',
    top: -6,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Styles.globalColors.darkBlue2,
  },
  uploadingContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 32,
    backgroundColor: Styles.globalColors.white,
    padding: 8,
  },
})

export default MenubarRender
