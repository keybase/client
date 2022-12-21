import './tab-bar.css'
import * as ConfigGen from '../actions/config-gen'
import * as LoginGen from '../actions/login-gen'
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
import * as Common from './common.desktop'
import * as TrackerConstants from '../constants/tracker2'
import AccountSwitcher from './account-switcher/container'
import RuntimeStats from '../app/runtime-stats'
import HiddenString from '../util/hidden-string'
import openURL from '../util/open-url'
import {isLinux} from '../constants/platform'
import KB2 from '../util/electron.desktop'

const {hideWindow, ctlQuit} = KB2.functions

export type Props = {
  navigation: any
  state: any
}

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
    hideWindow?.()
    setTimeout(() => {
      ctlQuit?.()
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

const keysMap = Tabs.desktopTabs.reduce((map, tab, index) => {
  map[`mod+${index + 1}`] = tab
  return map
}, {})
const hotKeys = Object.keys(keysMap)

const TabBar = React.memo(function TabBar(props: Props) {
  const {navigation, state} = props
  const username = Container.useSelector(state => state.config.username)

  const onHotKey = React.useCallback(
    (cmd: string) => {
      navigation.navigate(keysMap[cmd])
    },
    [navigation]
  )

  const onSelectTab = Common.useSubnavTabAction(navigation, state)

  return username ? (
    <Kb.Box2 className="tab-container" direction="vertical" fullHeight={true}>
      <Kb.Box2 direction="vertical" style={styles.header} fullWidth={true}>
        <Kb.HotKey hotKeys={hotKeys} onHotKey={onHotKey} />
        <Kb.Box2 direction="horizontal" style={styles.osButtons} fullWidth={true} />
        <Header />
        <Kb.Divider style={styles.divider} />
      </Kb.Box2>
      {state.routes.map((route, index) => (
        <Tab
          key={route.key}
          tab={route.name}
          index={index}
          isSelected={index === state.index}
          onSelectTab={onSelectTab}
        />
      ))}
      <RuntimeStats />
    </Kb.Box2>
  ) : null
})

type TabProps = {
  tab: Tabs.AppTab
  index: number
  isSelected: boolean
  onSelectTab: (t: Tabs.AppTab) => void
}

const TabBadge = (p: {name}) => {
  const {name} = p
  const badgeNumbers = Container.useSelector(state => state.notifications.navBadges)
  const fsCriticalUpdate = Container.useSelector(state => state.fs.criticalUpdate)
  const badge = (badgeNumbers.get(name) ?? 0) + (name === Tabs.fsTab && fsCriticalUpdate ? 1 : 0)
  return badge ? <Kb.Badge className="tab-badge" badgeNumber={badge} /> : null
}

const Tab = React.memo(function Tab(props: TabProps) {
  const {tab, index, isSelected, onSelectTab} = props
  const {label} = Tabs.desktopTabMeta[tab]

  const dispatch = Container.useDispatch()

  const accountRows = Container.useSelector(state => state.config.configuredAccounts)
  const current = Container.useSelector(state => state.config.username)
  const onQuickSwitch = React.useMemo(
    () =>
      index === 0
        ? () => {
            const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
            if (row) {
              dispatch(ConfigGen.createSetUserSwitching({userSwitching: true}))
              dispatch(LoginGen.createLogin({password: new HiddenString(''), username: row.username}))
            } else {
              onSelectTab(tab)
            }
          }
        : undefined,
    [accountRows, dispatch, index, current, onSelectTab, tab]
  )

  // no long press on desktop so a quick version
  const [mouseTime, setMouseTime] = React.useState(0)
  const onMouseUp = React.useMemo(
    () =>
      index === 0
        ? () => {
            if (mouseTime && Date.now() - mouseTime > 1000) {
              onQuickSwitch?.()
            }
            setMouseTime(0)
          }
        : undefined,
    [index, onQuickSwitch, mouseTime]
  )
  const onMouseDown = React.useMemo(
    () =>
      index === 0
        ? () => {
            setMouseTime(Date.now())
          }
        : undefined,
    [index]
  )
  const onMouseLeave = React.useMemo(
    () =>
      index === 0
        ? () => {
            setMouseTime(0)
          }
        : undefined,
    [index]
  )

  const onClick = React.useCallback(() => {
    onSelectTab(tab)
  }, [onSelectTab, tab])

  return (
    <Kb.ClickableBox
      feedback={false}
      key={tab}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
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
            <Kb.Icon className="tab-icon" type={Tabs.desktopTabMeta[tab].icon} sizeType="Big" />
            {tab === Tabs.fsTab && <FilesTabBadge />}
          </Kb.Box2>
          <Kb.Text className="tab-label" type="BodySmallSemibold">
            {label}
          </Kb.Text>
          <TabBadge name={tab} />
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
