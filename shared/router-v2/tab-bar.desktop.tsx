import './tab-bar.css'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as FsConstants from '../constants/fs'
import * as Kb from '../common-adapters'
import * as Kbfs from '../fs/common'
import * as Platforms from '../constants/platform'
import * as ProfileGen from '../actions/profile-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsConstants from '../constants/settings'
import * as SettingsGen from '../actions/settings-gen'
import * as Styles from '../styles'
import * as Tabs from '../constants/tabs'
import * as TrackerConstants from '../constants/tracker2'
import flags from '../util/feature-flags'
import AccountSwitcher from './account-switcher/container'
import RuntimeStats from '../app/runtime-stats'
import InviteFriends from '../people/invite-friends/tab-bar-button'
import openURL from '../util/open-url'
import {isLinux} from '../constants/platform'
import {quit} from '../desktop/app/ctl.desktop'
import {tabRoots} from './routes'

export type Props = {
  navigation: any
  selectedTab: Tabs.AppTab
}

const data = {
  [Tabs.chatTab]: {icon: 'iconfont-nav-2-chat', label: 'Chat'},
  [Tabs.cryptoTab]: {icon: 'iconfont-nav-2-crypto', label: 'Crypto'},
  [Tabs.devicesTab]: {icon: 'iconfont-nav-2-devices', label: 'Devices'},
  [Tabs.fsTab]: {icon: 'iconfont-nav-2-files', label: 'Files'},
  [Tabs.gitTab]: {icon: 'iconfont-nav-2-git', label: 'Git'},
  [Tabs.peopleTab]: {icon: 'iconfont-nav-2-people', label: 'People'},
  [Tabs.settingsTab]: {icon: 'iconfont-nav-2-settings', label: 'Settings'},
  [Tabs.teamsTab]: {icon: 'iconfont-nav-2-teams', label: 'Teams'},
  [Tabs.walletsTab]: {icon: 'iconfont-nav-2-wallets', label: 'Wallet'},
} as const

const tabs = Tabs.desktopTabOrder

const FilesTabBadge = () => {
  const uploadIcon = FsConstants.getUploadIconForFilesTab(Container.useSelector(state => state.fs.badge))
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.badgeIconUpload} /> : null
}

const Header = () => {
  const dispatch = Container.useDispatch()
  const [showingMenu, setShowingMenu] = React.useState(false)
  const attachmentRef = React.useRef<Kb.Box2>(null)
  const getAttachmentRef = () => attachmentRef.current
  const fullname = Container.useSelector(
    state => TrackerConstants.getDetails(state, state.config.username).fullname || ''
  )
  const username = Container.useSelector(state => state.config.username)
  const onProfileClick = () => dispatch(ProfileGen.createShowUserProfile({username}))
  const onClickWrapper = () => {
    setShowingMenu(false)
    onProfileClick()
  }

  const onAddAccount = () => dispatch(ProvisionGen.createStartProvision())
  const onHelp = () => openURL('https://book.keybase.io')
  const onQuit = () => {
    if (!__DEV__) {
      if (isLinux) {
        dispatch(SettingsGen.createStop({exitCode: RPCTypes.ExitCode.ok}))
      } else {
        dispatch(ConfigGen.createDumpLogs({reason: 'quitting through menu'}))
      }
    }
    // In case dump log doesn't exit for us
    Electron.remote.getCurrentWindow().hide()
    setTimeout(() => {
      quit()
    }, 2000)
  }
  const onSettings = () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
  const onSignOut = () => dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsConstants.logOutTab]}))

  const menuHeader = () => (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.ClickableBox onClick={onClickWrapper} style={styles.headerBox}>
        <Kb.ConnectedNameWithIcon
          username={username}
          onClick={onClickWrapper}
          metaTwo={
            <Kb.Text type="BodySmall" lineClamp={1} style={styles.fullname}>
              {fullname}
            </Kb.Text>
          }
        />
      </Kb.ClickableBox>
      <Kb.Button
        label="View/Edit profile"
        mode="Secondary"
        onClick={onClickWrapper}
        small={true}
        style={styles.button}
      />
      <AccountSwitcher />
    </Kb.Box2>
  )

  const menuItems = (): Kb.MenuItems => [
    {onClick: onAddAccount, title: 'Log in as another user'},
    {onClick: onSettings, title: 'Settings'},
    {onClick: onHelp, title: 'Help'},
    {danger: true, onClick: onSignOut, title: 'Sign out'},
    {danger: true, onClick: onQuit, title: 'Quit Keybase'},
  ]

  return (
    <>
      <Kb.ClickableBox onClick={() => setShowingMenu(true)}>
        <Kb.Box2
          direction="horizontal"
          gap="tiny"
          centerChildren={true}
          fullWidth={true}
          style={styles.nameContainer}
          alignItems="center"
          ref={attachmentRef}
        >
          <Kb.Avatar
            size={24}
            borderColor={Styles.globalColors.blue}
            username={username}
            style={styles.avatar}
          />
          <>
            <Kb.Text className="username" lineClamp={1} type="BodyTinySemibold" style={styles.username}>
              Hi {username}!
            </Kb.Text>
            <Kb.Icon
              type="iconfont-arrow-down"
              color={Styles.globalColors.blueLighter}
              fontSize={12}
              style={styles.caret}
            />
          </>
        </Kb.Box2>
      </Kb.ClickableBox>
      <Kb.FloatingMenu
        position="bottom left"
        containerStyle={styles.menu}
        header={menuHeader()}
        closeOnSelect={true}
        visible={showingMenu}
        attachTo={getAttachmentRef}
        items={menuItems()}
        onHidden={() => setShowingMenu(false)}
      />
    </>
  )
}

const keysMap = Tabs.desktopTabOrder.reduce((map, tab, index) => {
  map[`mod+${index + 1}`] = tab
  return map
}, {})
const hotKeys = Object.keys(keysMap)

const TabBar = (props: Props) => {
  const {selectedTab, navigation} = props
  const username = Container.useSelector(state => state.config.username)
  const badgeNumbers = Container.useSelector(state => state.notifications.navBadges)
  const fsCriticalUpdate = Container.useSelector(state => state.fs.criticalUpdate)

  const navRef = React.useRef(navigation.navigate)

  const onChangeTab = React.useCallback((tab: Tabs.AppTab) => {
    navRef.current(tab)
  }, [])
  const onNavUp = React.useCallback((tab: Tabs.AppTab) => {
    navRef.current(tabRoots[tab])
  }, [])
  const onHotKey = React.useCallback((cmd: string) => {
    navRef.current(keysMap[cmd])
  }, [])

  return username ? (
    <Kb.Box2 className="tab-container" direction="vertical" fullHeight={true}>
      <Kb.Box2 direction="vertical" style={styles.header} fullWidth={true}>
        <Kb.HotKey hotKeys={hotKeys} onHotKey={onHotKey} />
        <Kb.Box2 direction="horizontal" style={styles.osButtons} fullWidth={true} />
        <Header />
        <Kb.Divider style={styles.divider} />
      </Kb.Box2>
      {tabs.map((t, i) => (
        <Tab
          key={t}
          tab={t}
          index={i}
          isSelected={selectedTab === t}
          onTabClick={selectedTab === t ? onNavUp : onChangeTab}
          badge={t === Tabs.fsTab && fsCriticalUpdate ? (badgeNumbers.get(t) ?? 0) + 1 : badgeNumbers.get(t)}
        />
      ))}
      <RuntimeStats />
      {flags.inviteFriends && <InviteFriends />}
    </Kb.Box2>
  ) : null
}

type TabProps = {
  tab: Tabs.AppTab
  index: number
  isSelected: boolean
  onTabClick: (t: Tabs.AppTab) => void
  badge?: number
}

const Tab = React.memo((props: TabProps) => {
  const {tab, index, isSelected, onTabClick, badge} = props
  const {label} = data[tab]

  return (
    <Kb.ClickableBox feedback={false} key={tab} onClick={() => onTabClick(tab)}>
      <Kb.WithTooltip
        tooltip={`${label} (${Platforms.shortcutSymbol}${index + 1})`}
        toastClassName="tab-tooltip"
      >
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          className={isSelected ? 'tab-selected' : 'tab'}
          style={styles.tab}
        >
          <Kb.Box2 className="tab-highlight" direction="vertical" fullHeight={true} />
          <Kb.Box2 style={styles.iconBox} direction="horizontal">
            <Kb.Icon className="tab-icon" type={data[tab].icon} sizeType="Big" />
            {tab === Tabs.fsTab && <FilesTabBadge />}
          </Kb.Box2>
          <Kb.Text className="tab-label" type="BodySmallSemibold">
            {label}
          </Kb.Text>
          {!!badge && <Kb.Badge className="tab-badge" badgeNumber={badge} />}
        </Kb.Box2>
      </Kb.WithTooltip>
    </Kb.ClickableBox>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      avatar: {marginLeft: 14},
      badgeIcon: {
        bottom: -4,
        position: 'absolute',
        right: 8,
      },
      badgeIconUpload: {
        bottom: -Styles.globalMargins.xxtiny,
        height: Styles.globalMargins.xsmall,
        position: 'absolute',
        right: Styles.globalMargins.xsmall,
        width: Styles.globalMargins.xsmall,
      },
      button: {
        margin: Styles.globalMargins.xsmall,
      },
      caret: {marginRight: 12},
      divider: {marginTop: Styles.globalMargins.tiny},
      fullname: {maxWidth: 180},
      header: {flexShrink: 0, height: 80, marginBottom: 20},
      headerBox: {
        paddingTop: Styles.globalMargins.small,
      },
      iconBox: {
        justifyContent: 'flex-end',
        position: 'relative',
      },
      menu: {marginLeft: Styles.globalMargins.tiny},
      nameContainer: {height: 24},
      osButtons: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDragging,
          flexGrow: 1,
        },
      }),
      tab: {
        alignItems: 'center',
        paddingRight: 12,
        position: 'relative',
      },
      username: Styles.platformStyles({
        isElectron: {color: Styles.globalColors.blueLighter, flexGrow: 1, wordBreak: 'break-all'},
      }),
    } as const)
)

export default TabBar
