// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as ConfigTypes from '../constants/types/config'
import Flags from '../util/feature-flags'
import * as Tabs from '../constants/tabs'
import * as Styles from '../styles'
import ChatContainer from './chat-container.desktop'
import FilesPreview from './files-container.desktop'
import {isDarwin} from '../constants/platform'
import * as SafeElectron from '../util/safe-electron.desktop'
import OutOfDate from './out-of-date'
import Upload from '../fs/footer/upload'
import UploadCountdownHOC, {type UploadCountdownHOCProps} from '../fs/footer/upload-countdown-hoc'
import type {DaemonHandshakeState} from '../constants/types/config'

export type Props = {
  daemonHandshakeState: DaemonHandshakeState,
  logIn: () => void,
  loggedIn: boolean,
  updateNow: () => void,
  onRekey: (path: string) => void,
  openApp: (tab: ?string) => void,
  outOfDate?: ConfigTypes.OutOfDate,
  showInFinder: (tab: ?string) => void,
  quit: () => void,
  refresh: () => void,
  showBug: () => void,
  showHelp: () => void,
  showUser: (username: ?string) => void,
  username: ?string,
  badgeInfo: {[string]: number},
} & UploadCountdownHOCProps

type State = {|
  showingMenu: boolean,
|}

const ArrowTick = () => <Kb.Box style={styles.arrowTick} />
const UploadWithCountdown = UploadCountdownHOC(Upload)

class MenubarRender extends React.Component<Props, State> {
  state: State = {
    showingMenu: false,
  }

  attachmentRef = React.createRef<Kb.Icon>()

  _refreshIfLoggedIn = () => this.props.loggedIn && this.props.refresh()

  componentDidMount() {
    this._refreshIfLoggedIn()
    SafeElectron.getRemote()
      .getCurrentWindow()
      .on('show', this._refreshIfLoggedIn)
  }

  componentWillUnmount() {
    SafeElectron.getRemote()
      .getCurrentWindow()
      .removeListener('show', this._refreshIfLoggedIn)
  }

  render() {
    // TODO: refactor all this duplicated code!
    if (this.props.daemonHandshakeState !== 'done') {
      return this._renderDaemonHandshakeWait()
    }
    return this.props.loggedIn ? this._renderLoggedIn() : this._renderLoggedOut()
  }

  _renderLoggedOut() {
    const menuColor = this.state.showingMenu ? Styles.globalColors.black_50 : Styles.globalColors.black_50

    return (
      <Kb.Box style={styles.widgetContainer}>
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

  _renderDaemonHandshakeWait() {
    const menuColor = this.state.showingMenu ? Styles.globalColors.black_50 : Styles.globalColors.black_50
    const text =
      this.props.daemonHandshakeState === 'waitingForWaiters'
        ? `Connecting UI services to crypto engine... This may take a few seconds`
        : `Starting up Keybase`

    return (
      <Kb.Box style={styles.widgetContainer}>
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
            items={this._menuItems(this.props.badgeInfo || {}, true)}
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
            type="Body"
            small={true}
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

  _menuView(title: string, iconType: Kb.IconType, count: number) {
    return (
      <Kb.Box2 direction="horizontal" style={{width: '100%'}}>
        <Kb.Box style={{marginRight: Styles.globalMargins.xsmall, position: 'relative'}}>
          <Kb.Icon type={iconType} color={Styles.globalColors.black_20} fontSize={20} />
          {!!count && <Kb.Badge badgeNumber={count} badgeStyle={{left: 14, position: 'absolute', top: -2}} />}
        </Kb.Box>
        <Kb.Text className="title" type="Body" style={Styles.collapseStyles([{color: undefined}])}>
          {title}
        </Kb.Text>
      </Kb.Box2>
    )
  }

  _menuItems(countMap: Object, startingUp?: boolean = false) {
    const wallet = Flags.walletsEnabled
      ? [
          {
            onClick: () => this.props.openApp(Tabs.walletsTab),
            title: 'Wallet',
            view: this._menuView('Wallet', 'iconfont-nav-wallets', countMap[Tabs.walletsTab] || 0),
          },
        ]
      : []

    const tabs = [
      ...wallet,
      {
        onClick: () => this.props.openApp(Tabs.gitTab),
        title: 'Git',
        view: this._menuView('Git', 'iconfont-nav-git', countMap[Tabs.gitTab] || 0),
      },
      {
        onClick: () => this.props.openApp(Tabs.devicesTab),
        title: 'Devices',
        view: this._menuView('Devices', 'iconfont-nav-devices', countMap[Tabs.devicesTab] || 0),
      },
      {
        onClick: () => this.props.openApp(Tabs.settingsTab),
        title: 'Settings',
        view: this._menuView('Settings', 'iconfont-nav-settings', countMap[Tabs.settingsTab] || 0),
      },
    ]

    const openMainApp = [{onClick: () => this.props.openApp(), title: 'Open main app'}]

    return [
      ...(startingUp ? [] : tabs),
      !startingUp ? 'Divider' : null,
      ...(this.props.loggedIn && !startingUp ? openMainApp : []),
      !startingUp
        ? {
            onClick: () => this.props.showInFinder('/'),
            title: `Open folders in ${Styles.fileUIName}`,
          }
        : null,
      !startingUp ? 'Divider' : null,
      !startingUp ? {onClick: () => this.props.showUser(), title: 'Keybase.io'} : null,
      {onClick: this.props.showBug, title: 'Report a bug'},
      {onClick: this.props.showHelp, title: 'Help'},
      {onClick: this.props.quit, title: 'Quit app'},
    ].filter(i => !!i)
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
                badgeStyle={{left: 14, position: 'absolute', top: -2}}
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
        <OutOfDate outOfDate={this.props.outOfDate} updateNow={this.props.updateNow} />
        <Kb.ScrollView>
          <ChatContainer convLimit={3} />
          <FilesPreview />
        </Kb.ScrollView>
        <UploadWithCountdown
          endEstimate={this.props.endEstimate}
          files={this.props.files}
          fileName={this.props.fileName}
          totalSyncingBytes={this.props.totalSyncingBytes}
        />
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
    <Kb.Box style={{...Styles.desktopStyles.clickable, marginLeft: 7, marginRight: 7, position: 'relative'}}>
      <Kb.Icon
        color={Styles.globalColors.darkBlue4}
        hoverColor={Styles.globalColors.white}
        onClick={() => openApp(tab)}
        fontSize={22}
        type={iconType}
      />
      {!!count && <Kb.Badge badgeNumber={count} badgeStyle={{position: 'absolute', right: -8, top: -6}} />}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate({
  arrowTick: {
    borderBottomColor: Styles.globalColors.darkBlue2,
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
  topRow: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.darkBlue2,
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
    marginTop: isDarwin ? 13 : 0,
    position: 'relative',
  },
})

export default MenubarRender
