import * as React from 'react'
import * as Kb from '../common-adapters'
import * as ConfigTypes from '../constants/types/config'
import * as FsTypes from '../constants/types/fs'
import * as Tabs from '../constants/tabs'
import * as Styles from '../styles'
import {_setDarkModePreference} from '../styles/dark-mode'
import ChatContainer from './chat-container.desktop'
import FilesPreview from './files-container.desktop'
import {isDarwin} from '../constants/platform'
import * as SafeElectron from '../util/safe-electron.desktop'
import OutOfDate from './out-of-date'
import Upload from '../fs/footer/upload'
import UploadCountdownHOC from '../fs/footer/upload-countdown-hoc'
import {Loading} from '../fs/simple-screens'
import SpaceWarning from './space-warning'
import flags from '../util/feature-flags'

export type Props = {
  daemonHandshakeState: ConfigTypes.DaemonHandshakeState
  darkMode: boolean
  diskSpaceStatus: FsTypes.DiskSpaceStatus
  logIn: () => void
  loggedIn: boolean
  kbfsDaemonStatus: FsTypes.KbfsDaemonStatus
  kbfsEnabled: boolean
  updateNow: () => void
  onHideDiskSpaceBanner: () => void
  onRekey: (path: string) => void
  onRetrySync: () => void
  openApp: (tab?: string) => void
  outOfDate?: ConfigTypes.OutOfDate
  showInFinder: () => void
  quit: () => void
  refreshUserFileEdits: () => void
  showBug: () => void
  showHelp: () => void
  showUser: (username?: string) => void
  showingDiskSpaceBanner: boolean
  username: string | null
  waitForKbfsDaemon: () => void
  badgeInfo: {[K in string]: number}

  // UploadCountdownHOCProps
  endEstimate?: number
  files: number
  fileName: string | null
  totalSyncingBytes: number
}

type State = {
  showingMenu: boolean
}

const ArrowTick = () => <Kb.Box style={styles.arrowTick} />
const UploadWithCountdown = UploadCountdownHOC(Upload)

class MenubarRender extends React.Component<Props, State> {
  state: State = {showingMenu: false}
  attachmentRef = React.createRef<Kb.Icon>()

  _refreshUserFileEditsOrWaitForKbfsDaemon = () =>
    this.props.loggedIn &&
    (this.props.kbfsDaemonStatus.rpcStatus === FsTypes.KbfsDaemonRpcStatus.Connected
      ? this.props.refreshUserFileEdits()
      : this.props.waitForKbfsDaemon())

  componentDidMount() {
    this._refreshUserFileEditsOrWaitForKbfsDaemon()
    SafeElectron.getRemote()
      .getCurrentWindow()
      .on('show', this._refreshUserFileEditsOrWaitForKbfsDaemon)
  }

  componentWillUnmount() {
    SafeElectron.getRemote()
      .getCurrentWindow()
      .removeListener('show', this._refreshUserFileEditsOrWaitForKbfsDaemon)
  }

  render() {
    _setDarkModePreference(this.props.darkMode ? 'alwaysDark' : 'alwaysLight')
    // TODO: refactor all this duplicated code!
    if (this.props.daemonHandshakeState !== 'done') {
      return this._renderDaemonHandshakeWait()
    }
    return this.props.loggedIn ? this._renderLoggedIn() : this._renderLoggedOut()
  }

  _renderLoggedOut() {
    return (
      <Kb.Box
        className={this.props.darkMode ? 'darkMode' : 'lightMode'}
        key={this.props.darkMode ? 'darkMode' : 'light'}
        style={styles.widgetContainer}
      >
        {isDarwin && <style>{_realCSS}</style>}
        {isDarwin && <ArrowTick />}
        <Kb.Box
          style={Styles.collapseStyles([
            styles.topRow,
            {justifyContent: 'flex-end'},
            Styles.desktopStyles.clickable,
          ])}
        >
          <Kb.Icon
            color={Styles.isDarkMode() ? 'rgba(255, 255, 255, 0.85)' : Styles.globalColors.blueDarker}
            hoverColor={Styles.globalColors.white}
            type="iconfont-nav-2-hamburger"
            sizeType="Big"
            style={styles.hamburgerIcon}
            onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
            ref={this.attachmentRef}
          />
          <Kb.FloatingMenu
            closeOnSelect={true}
            visible={this.state.showingMenu}
            attachTo={this._getAttachmentRef}
            items={this._menuItems()}
            onHidden={() => this.setState({showingMenu: false})}
          />
        </Kb.Box>
        <OutOfDate outOfDate={this.props.outOfDate} updateNow={this.props.updateNow} />
        <SpaceWarning
          diskSpaceStatus={this.props.diskSpaceStatus}
          onRetry={this.props.onRetrySync}
          onClose={this.props.onHideDiskSpaceBanner}
          hidden={!this.props.showingDiskSpaceBanner}
        />
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <Kb.Icon
            type="icon-keybase-logo-logged-out-64"
            style={Kb.iconCastPlatformStyles(styles.logo)}
            color={Styles.globalColors.yellow}
          />
          <Kb.Text type="Body" style={{alignSelf: 'center', marginTop: 6}}>
            You are logged out of Keybase.
          </Kb.Text>
          <Kb.ButtonBar direction="row">
            <Kb.Button label="Log in" onClick={this.props.logIn} />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.Box>
    )
  }

  _renderDaemonHandshakeWait() {
    const text =
      this.props.daemonHandshakeState === 'waitingForWaiters'
        ? `Connecting interface to crypto engine... This may take a few seconds.`
        : `Starting up Keybase...`

    return (
      <Kb.Box
        style={styles.widgetContainer}
        className={this.props.darkMode ? 'darkMode' : 'lightMode'}
        key={this.props.darkMode ? 'darkMode' : 'light'}
      >
        {isDarwin && <style>{_realCSS}</style>}
        {isDarwin && <ArrowTick />}
        <Kb.Box
          style={Styles.collapseStyles([
            styles.topRow,
            {justifyContent: 'flex-end'},
            Styles.desktopStyles.clickable,
          ])}
        >
          <Kb.Icon
            color={Styles.globalColors.blueDarker}
            hoverColor={Styles.globalColors.white}
            type="iconfont-nav-2-hamburger"
            sizeType="Big"
            style={styles.hamburgerIcon}
            onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
            ref={this.attachmentRef}
          />
          <Kb.FloatingMenu
            closeOnSelect={true}
            visible={this.state.showingMenu}
            attachTo={this._getAttachmentRef}
            items={this._menuItems()}
            onHidden={() => this.setState({showingMenu: false})}
          />
        </Kb.Box>
        <OutOfDate outOfDate={this.props.outOfDate} updateNow={this.props.updateNow} />
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <Kb.Icon
            type="icon-keybase-logo-logged-out-64"
            style={Kb.iconCastPlatformStyles(styles.logo)}
            color={Styles.globalColors.yellow}
          />
          <Kb.Text
            type="BodySmall"
            style={{
              alignSelf: 'center',
              marginTop: 6,
              paddingLeft: Styles.globalMargins.small,
              paddingRight: Styles.globalMargins.small,
            }}
          >
            {text}
          </Kb.Text>
        </Kb.Box>
      </Kb.Box>
    )
  }

  _menuView(title, iconType, count) {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={{alignItems: 'center'}}>
        <Kb.Box style={{marginRight: Styles.globalMargins.tiny, position: 'relative'}}>
          <Kb.Icon type={iconType} color={Styles.globalColors.blue} sizeType="Big" />
          {!!count && <Kb.Badge badgeNumber={count || 0} badgeStyle={styles.badge} />}
        </Kb.Box>
        <Kb.Text className="title" type="BodySemibold" style={Styles.collapseStyles([{color: undefined}])}>
          {title}
        </Kb.Text>
      </Kb.Box2>
    )
  }

  _menuItems(): Kb.MenuItems {
    const countMap = this.props.badgeInfo || {}
    const startingUp = this.props.daemonHandshakeState !== 'done'
    const loggedOut = !this.props.username

    const sectionTabs =
      startingUp || loggedOut
        ? []
        : ([
            {
              onClick: () => this.props.openApp(Tabs.walletsTab),
              title: 'Wallet',
              view: this._menuView('Wallet', 'iconfont-nav-2-wallets', countMap[Tabs.walletsTab]),
            },
            {
              onClick: () => this.props.openApp(Tabs.gitTab),
              title: 'Git',
              view: this._menuView('Git', 'iconfont-nav-2-git', countMap[Tabs.gitTab]),
            },
            {
              onClick: () => this.props.openApp(Tabs.devicesTab),
              title: 'Devices',
              view: this._menuView('Devices', 'iconfont-nav-2-devices', countMap[Tabs.devicesTab]),
            },
            {
              onClick: () => this.props.openApp(Tabs.settingsTab),
              title: 'Settings',
              view: this._menuView('Settings', 'iconfont-nav-2-settings', countMap[Tabs.settingsTab]),
            },
            'Divider',
          ] as const)

    const openApp = startingUp
      ? []
      : [{onClick: () => this.props.openApp(), title: 'Open main app'}, 'Divider']

    const showFinder =
      startingUp || loggedOut || !this.props.kbfsEnabled
        ? []
        : [{onClick: this.props.showInFinder, title: `Open folders in ${Styles.fileUIName}`}, 'Divider']

    const webLink = startingUp ? [] : [{onClick: () => this.props.showUser(), title: 'Keybase.io'}]

    return [
      ...sectionTabs,
      ...openApp,
      ...showFinder,
      ...webLink,
      {onClick: this.props.showBug, title: 'Report a bug'},
      {onClick: this.props.showHelp, title: 'Help'},
      {onClick: this.props.quit, title: 'Quit Keybase'},
    ] as any
  }

  _getAttachmentRef = () => this.attachmentRef.current

  _renderLoggedIn() {
    const badgeTypesInHeader = [Tabs.peopleTab, Tabs.chatTab, Tabs.fsTab, Tabs.teamsTab]
    const badgesInMenu = [Tabs.walletsTab, Tabs.gitTab, Tabs.devicesTab, Tabs.settingsTab]
    // TODO move this into container
    const badgeCountInMenu = badgesInMenu.reduce(
      (acc, val) => (this.props.badgeInfo[val] ? acc + this.props.badgeInfo[val] : acc),
      0
    )

    return (
      <Kb.Box
        style={styles.widgetContainer}
        className={this.props.darkMode ? 'darkMode' : 'lightMode'}
        key={this.props.darkMode ? 'darkMode' : 'light'}
      >
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
          >
            <Kb.Icon
              color={
                Styles.isDarkMode() ? Styles.globalColors.black_50OrBlack_60 : Styles.globalColors.blueDarker
              }
              hoverColor={Styles.globalColors.whiteOrWhite}
              onClick={() => this.setState(prevState => ({showingMenu: !prevState.showingMenu}))}
              type="iconfont-nav-2-hamburger"
              sizeType="Big"
              ref={this.attachmentRef}
            />
            {!!badgeCountInMenu && <Kb.Badge badgeNumber={badgeCountInMenu} badgeStyle={styles.badge} />}
          </Kb.Box>
          <Kb.FloatingMenu
            closeOnSelect={true}
            items={this._menuItems()}
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
        <OutOfDate outOfDate={this.props.outOfDate} updateNow={this.props.updateNow} />
        <Kb.ScrollView>
          <ChatContainer convLimit={5} />
          {this.props.kbfsDaemonStatus.rpcStatus === FsTypes.KbfsDaemonRpcStatus.Connected ? (
            <FilesPreview />
          ) : (
            <Kb.Box2 direction="vertical" fullWidth={true} style={{height: 200}}>
              <Loading />
            </Kb.Box2>
          )}
        </Kb.ScrollView>
        <Kb.Box style={styles.footer}>
          <UploadWithCountdown
            endEstimate={this.props.endEstimate}
            isOnline={
              !flags.kbfsOfflineMode ||
              this.props.kbfsDaemonStatus.onlineStatus !== FsTypes.KbfsDaemonOnlineStatus.Offline
            }
            files={this.props.files}
            fileName={this.props.fileName}
            totalSyncingBytes={this.props.totalSyncingBytes}
          />
        </Kb.Box>
      </Kb.Box>
    )
  }
}

const _realCSS = `
body {
  background-color: ${Styles.globalColors.transparent};
}
`

const iconMap = {
  [Tabs.peopleTab]: 'iconfont-nav-2-people',
  [Tabs.chatTab]: 'iconfont-nav-2-chat',
  [Tabs.devicesTab]: 'iconfont-nav-2-devices',
  [Tabs.fsTab]: 'iconfont-nav-2-files',
  [Tabs.teamsTab]: 'iconfont-nav-2-teams',
} as const
const BadgeIcon = ({tab, countMap, openApp}) => {
  const count = countMap[tab]
  const iconType = iconMap[tab]

  if ((tab === Tabs.devicesTab && !count) || !iconType) {
    return null
  }

  return (
    <Kb.Box style={{...Styles.desktopStyles.clickable, position: 'relative'}}>
      <Kb.Icon
        color={Styles.isDarkMode() ? Styles.globalColors.black_50OrBlack_60 : Styles.globalColors.blueDarker}
        hoverColor={Styles.globalColors.whiteOrWhite}
        onClick={() => openApp(tab)}
        sizeType="Big"
        style={styles.navIcons}
        type={iconType}
      />
      {!!count && <Kb.Badge badgeNumber={count} badgeStyle={styles.badge} />}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  arrowTick: {
    borderBottomColor: Styles.isDarkMode() ? '#2d2d2d' : Styles.globalColors.blueDark,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderLeftWidth: 6,
    borderRightColor: 'transparent',
    borderRightWidth: 6,
    borderStyle: 'solid',
    height: 0,
    left: 0,
    marginLeft: 'auto',
    marginRight: 'auto',
    position: 'absolute',
    right: 0,
    top: -6,
    width: 0,
  },
  badge: {
    position: 'absolute',
    right: -2,
    top: -4,
  },
  footer: {width: 360},
  hamburgerIcon: {
    marginRight: Styles.globalMargins.tiny,
  },
  headerBadgesContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginLeft: 24 + 8,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  navIcons: {paddingLeft: Styles.globalMargins.xtiny, paddingRight: Styles.globalMargins.xtiny},
  topRow: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.isDarkMode() ? '#2d2d2d' : Styles.globalColors.blueDark,
    borderTopLeftRadius: Styles.globalMargins.xtiny,
    borderTopRightRadius: Styles.globalMargins.xtiny,
    flex: 1,
    maxHeight: 40,
    minHeight: 40,
    paddingLeft: 8,
    paddingRight: 8,
  },
  widgetContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.white,
    borderTopLeftRadius: Styles.globalMargins.xtiny,
    borderTopRightRadius: Styles.globalMargins.xtiny,
    flex: 1,
    height: '100%',
    marginTop: isDarwin ? 13 : 0,
    position: 'relative',
    width: '100%',
  },
}))

export default MenubarRender
