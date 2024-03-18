import * as C from '@/constants'
import './tab-bar.css'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common'
import * as Platforms from '@/constants/platform'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Tabs from '@/constants/tabs'
import * as Common from './common.desktop'
import * as TrackerConstants from '@/constants/tracker2'
import AccountSwitcher from './account-switcher/container'
import RuntimeStats from '../app/runtime-stats'
import openURL from '@/util/open-url'
import {isLinux} from '@/constants/platform'
import KB2 from '@/util/electron.desktop'

const {hideWindow, ctlQuit} = KB2.functions

export type Props = {
  navigation: C.Router2.Navigator
  state: C.Router2.NavState
}

const FilesTabBadge = () => {
  const uploadIcon = C.useFSState(s => s.getUploadIconForFilesTab())
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.badgeIconUpload} /> : null
}

const Header = () => {
  const [showingMenu, setShowingMenu] = React.useState(false)
  const popupAnchor = React.useRef<Kb.MeasureRef>(null)
  const username = C.useCurrentUserState(s => s.username)
  const fullname = C.useTrackerState(s => TrackerConstants.getDetails(s, username).fullname || '')
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onClickWrapper = React.useCallback(() => {
    setShowingMenu(false)
    showUserProfile(username)
  }, [showUserProfile, username])

  const startProvision = C.useProvisionState(s => s.dispatch.startProvision)
  const stop = C.useSettingsState(s => s.dispatch.stop)
  const onAddAccount = React.useCallback(() => {
    startProvision()
  }, [startProvision])
  const onHelp = React.useCallback(() => openURL('https://book.keybase.io'), [])
  const dumpLogs = C.useConfigState(s => s.dispatch.dumpLogs)
  const onQuit = React.useCallback(() => {
    if (!__DEV__) {
      if (isLinux) {
        stop(T.RPCGen.ExitCode.ok)
      } else {
        C.ignorePromise(dumpLogs('quitting through menu'))
      }
    }
    // In case dump log doesn't exit for us
    hideWindow?.()
    setTimeout(() => {
      ctlQuit?.()
    }, 2000)
  }, [dumpLogs, stop])

  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onSettings = React.useCallback(() => switchTab(Tabs.settingsTab), [switchTab])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onSignOut = React.useCallback(() => navigateAppend(C.Settings.settingsLogOutTab), [navigateAppend])

  const menuHeader = React.useMemo(
    () => (
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
    ),
    [onClickWrapper, username, fullname]
  )

  const menuItems = React.useMemo(
    (): Kb.MenuItems => [
      {onClick: onAddAccount, title: 'Log in as another user'},
      {onClick: onSettings, title: 'Settings'},
      {onClick: onHelp, title: 'Help'},
      {danger: true, onClick: onSignOut, title: 'Sign out'},
      {danger: true, onClick: onQuit, title: 'Quit Keybase'},
    ],
    [onAddAccount, onSettings, onHelp, onSignOut, onQuit]
  )

  const showMenu = React.useCallback(() => {
    setShowingMenu(true)
  }, [])
  const hideMenu = React.useCallback(() => {
    setShowingMenu(false)
  }, [])

  return (
    <>
      <Kb.ClickableBox onClick={showMenu}>
        <Kb.Box2Measure
          direction="horizontal"
          gap="tiny"
          centerChildren={true}
          fullWidth={true}
          style={styles.nameContainer}
          alignItems="center"
          ref={popupAnchor}
        >
          <Kb.Avatar
            size={24}
            borderColor={Kb.Styles.globalColors.blue}
            username={username}
            style={styles.avatar}
          />
          <>
            <Kb.Text className="username" lineClamp={1} type="BodyTinySemibold" style={styles.username}>
              Hi {username}!
            </Kb.Text>
            <Kb.Icon
              type="iconfont-arrow-down"
              color={Kb.Styles.globalColors.blueLighter}
              fontSize={12}
              style={styles.caret}
            />
          </>
        </Kb.Box2Measure>
      </Kb.ClickableBox>
      <Kb.FloatingMenu
        position="bottom left"
        containerStyle={styles.menu}
        header={menuHeader}
        closeOnSelect={true}
        visible={showingMenu}
        attachTo={popupAnchor}
        items={menuItems}
        onHidden={hideMenu}
      />
    </>
  )
}

const keysMap = Tabs.desktopTabs.reduce<{[key: string]: (typeof Tabs.desktopTabs)[number]}>(
  (map, tab, index) => {
    map[`mod+${index + 1}`] = tab
    return map
  },
  {}
)
const hotKeys = Object.keys(keysMap)

const TabBar = React.memo(function TabBar(props: Props) {
  const {navigation, state} = props
  const username = C.useCurrentUserState(s => s.username)
  const onHotKey = React.useCallback(
    (cmd: string) => {
      navigation.navigate(keysMap[cmd] as string)
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
      {state?.routes?.map((route: {key?: string; name?: string}, index: number) => (
        <Tab
          key={route.key}
          tab={route.name as Tabs.AppTab}
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

const TabBadge = (p: {name: Tabs.Tab}) => {
  const {name} = p
  const badgeNumbers = C.useNotifState(s => s.navBadges)
  const fsCriticalUpdate = C.useFSState(s => s.criticalUpdate)
  const badge = (badgeNumbers.get(name) ?? 0) + (name === Tabs.fsTab && fsCriticalUpdate ? 1 : 0)
  return badge ? <Kb.Badge className="tab-badge" badgeNumber={badge} /> : null
}

const Tab = React.memo(function Tab(props: TabProps) {
  const {tab, index, isSelected, onSelectTab} = props
  const isPeopleTab = index === 0
  const {label} = Tabs.desktopTabMeta[tab]
  const current = C.useCurrentUserState(s => s.username)
  const setUserSwitching = C.useConfigState(s => s.dispatch.setUserSwitching)
  const login = C.useConfigState(s => s.dispatch.login)
  const onQuickSwitch = React.useMemo(
    () =>
      isPeopleTab
        ? () => {
            const accountRows = C.useConfigState.getState().configuredAccounts
            const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
            if (row) {
              setUserSwitching(true)
              login(row.username, '')
            } else {
              onSelectTab(tab)
            }
          }
        : undefined,
    [login, isPeopleTab, current, onSelectTab, tab, setUserSwitching]
  )

  // no long press on desktop so a quick version
  const [mouseTime, setMouseTime] = React.useState(0)
  const onMouseUp = React.useMemo(
    () =>
      isPeopleTab
        ? () => {
            if (mouseTime && Date.now() - mouseTime > 1000) {
              onQuickSwitch?.()
            }
            setMouseTime(0)
          }
        : undefined,
    [isPeopleTab, onQuickSwitch, mouseTime]
  )
  const onMouseDown = React.useMemo(
    () =>
      isPeopleTab
        ? () => {
            setMouseTime(Date.now())
          }
        : undefined,
    [isPeopleTab]
  )
  const onMouseLeave = React.useMemo(
    () =>
      isPeopleTab
        ? () => {
            setMouseTime(0)
          }
        : undefined,
    [isPeopleTab]
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
      <Kb.Box2Measure
        direction="horizontal"
        fullWidth={true}
        className={Kb.Styles.classNames(
          isSelected ? 'tab-selected' : 'tab',
          'tab-tooltip',
          'tooltip-top-right'
        )}
        style={styles.tab}
        tooltip={`${label} (${Platforms.shortcutSymbol}${index + 1})`}
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
      </Kb.Box2Measure>
    </Kb.ClickableBox>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatar: {marginLeft: 14},
      badgeIcon: {
        bottom: -4,
        position: 'absolute',
        right: 8,
      },
      badgeIconUpload: {
        bottom: -Kb.Styles.globalMargins.xxtiny,
        height: Kb.Styles.globalMargins.xsmall,
        position: 'absolute',
        right: Kb.Styles.globalMargins.xsmall,
        width: Kb.Styles.globalMargins.xsmall,
      },
      button: {
        margin: Kb.Styles.globalMargins.xsmall,
      },
      caret: {marginRight: 12},
      divider: {marginTop: Kb.Styles.globalMargins.tiny},
      fullname: {maxWidth: 180},
      header: {flexShrink: 0, height: 80, marginBottom: 20},
      headerBox: {
        paddingTop: Kb.Styles.globalMargins.small,
      },
      iconBox: {
        justifyContent: 'flex-end',
        position: 'relative',
      },
      menu: {marginLeft: Kb.Styles.globalMargins.tiny},
      nameContainer: {height: 24},
      osButtons: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDragging,
          flexGrow: 1,
        },
      }),
      tab: {
        alignItems: 'center',
        paddingRight: 12,
        position: 'relative',
      },
      username: Kb.Styles.platformStyles({
        isElectron: {color: Kb.Styles.globalColors.blueLighter, flexGrow: 1, wordBreak: 'break-all'},
      }),
    }) as const
)

export default TabBar
