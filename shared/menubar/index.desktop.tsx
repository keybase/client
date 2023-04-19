import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as FsConstants from '../constants/fs'
import * as FsGen from '../actions/fs-gen'
import * as FsTypes from '../constants/types/fs'
import * as Kb from '../common-adapters'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Styles from '../styles'
import * as Tabs from '../constants/tabs'
import ChatContainer from './chat-container.desktop'
import FilesPreview from './files-container.desktop'
import OutOfDate from './out-of-date'
import Upload from '../fs/footer/upload'
import openUrl from '../util/open-url'
import type * as ConfigTypes from '../constants/types/config'
import {Loading} from '../fs/simple-screens'
import {_setDarkModePreference} from '../styles/dark-mode'
import {isLinux, isDarwin} from '../constants/platform'
import {type _InnerMenuItem} from '../common-adapters/floating-menu/menu-layout'
import {useUploadCountdown} from '../fs/footer/use-upload-countdown'
import KB2 from '../util/electron.desktop'

const {hideWindow, ctlQuit} = KB2.functions

export type Props = {
  daemonHandshakeState: ConfigTypes.DaemonHandshakeState
  darkMode: boolean
  diskSpaceStatus: FsTypes.DiskSpaceStatus
  loggedIn: boolean
  kbfsDaemonStatus: FsTypes.KbfsDaemonStatus
  kbfsEnabled: boolean
  outOfDate?: ConfigTypes.OutOfDate
  showingDiskSpaceBanner: boolean
  username: string
  navBadges: Map<string, number>
  windowShownCount: number

  // UploadCountdownHOCProps
  endEstimate?: number
  files: number
  fileName: string | null
  totalSyncingBytes: number
}

const ArrowTick = () => <Kb.Box style={styles.arrowTick} />
type UWCDProps = {
  endEstimate?: number
  files: number
  fileName: string | null
  totalSyncingBytes: number
  isOnline: boolean
  smallMode: boolean
}
const UploadWithCountdown = (p: UWCDProps) => {
  const {endEstimate, files, fileName, totalSyncingBytes, isOnline, smallMode} = p

  const np = useUploadCountdown({
    endEstimate,
    fileName,
    files,
    isOnline,
    smallMode,
    totalSyncingBytes,
  })

  return <Upload {...np} />
}

const useMenuItems = (
  p: Props & {showBadges?: boolean; openApp: (tab?: Tabs.AppTab) => void}
): ReadonlyArray<_InnerMenuItem> => {
  const {showBadges, navBadges, daemonHandshakeState, username, kbfsEnabled, openApp} = p
  const dispatch = Container.useDispatch()
  const countMap = navBadges
  const startingUp = daemonHandshakeState !== 'done'
  const common = [
    {onClick: () => openUrl(`https://keybase.io/${username || ''}`), title: 'Keybase.io'},
    {
      onClick: () => {
        const version = __VERSION__
        openUrl(
          `https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(
            version
          )}`
        )
      },
      title: 'Report a bug',
    },
    {
      onClick: () => {
        openUrl('https://keybase.io/docs')
        hideWindow?.()
      },
      title: 'Help',
    },
    {
      onClick: () => {
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
      },
      title: 'Quit Keybase',
    },
  ]

  if (startingUp) {
    return common
  }

  const openAppItem = [{onClick: () => openApp(), title: 'Open main app'}, 'Divider'] as const

  if (showBadges) {
    return [
      {
        onClick: () => openApp(Tabs.walletsTab),
        title: 'Wallet',
        view: (
          <TabView title="Wallet" iconType="iconfont-nav-2-wallets" count={countMap.get(Tabs.walletsTab)} />
        ),
      },
      {
        onClick: () => openApp(Tabs.gitTab),
        title: 'Git',
        view: <TabView title="Git" iconType="iconfont-nav-2-git" count={countMap.get(Tabs.gitTab)} />,
      },
      {
        onClick: () => openApp(Tabs.devicesTab),
        title: 'Devices',
        view: (
          <TabView title="Devices" iconType="iconfont-nav-2-devices" count={countMap.get(Tabs.devicesTab)} />
        ),
      },
      {
        onClick: () => openApp(Tabs.settingsTab),
        title: 'Settings',
        view: (
          <TabView
            title="Settings"
            iconType="iconfont-nav-2-settings"
            count={countMap.get(Tabs.settingsTab)}
          />
        ),
      },
      'Divider' as const,
      ...openAppItem,
      ...(kbfsEnabled
        ? ([
            {
              onClick: () => {
                dispatch(FsGen.createOpenPathInSystemFileManager({path: FsConstants.defaultPath}))
              },
              title: `Open folders in ${Styles.fileUIName}`,
            },
            'Divider',
          ] as const)
        : []),
      ...common,
    ] as const
  }
  return [...openAppItem, ...common] as const
}

const IconBar = (p: Props & {showBadges?: boolean}) => {
  const {navBadges, showBadges} = p
  const dispatch = Container.useDispatch()
  const openApp = (tab?: Tabs.AppTab) => {
    dispatch(ConfigGen.createShowMain())
    tab && dispatch(RouteTreeGen.createSwitchTab({tab}))
  }

  const menuItems = useMenuItems({...p, openApp})

  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      closeOnSelect={true}
      items={menuItems}
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      attachTo={attachTo}
      position="bottom right"
    />
  ))

  const badgeCountInMenu = badgesInMenu.reduce((acc, val) => navBadges.get(val) ?? 0 + acc, 0)

  return (
    <Kb.Box style={styles.topRow}>
      <Kb.Box style={styles.headerBadgesContainer}>
        {showBadges
          ? badgeTypesInHeader.map(tab => (
              <BadgeIcon key={tab} tab={tab} countMap={navBadges} openApp={openApp} />
            ))
          : null}
      </Kb.Box>
      <Kb.Box
        style={{
          ...Styles.desktopStyles.clickable,
          marginRight: Styles.globalMargins.tiny,
          position: 'relative',
        }}
      >
        <Kb.Icon
          color={
            Styles.isDarkMode() ? Styles.globalColors.black_50OrBlack_60 : Styles.globalColors.blueDarker
          }
          hoverColor={Styles.globalColors.whiteOrWhite}
          onClick={toggleShowingPopup}
          type="iconfont-nav-2-hamburger"
          sizeType="Big"
          ref={popupAnchor as any}
        />
        {!!badgeCountInMenu && <Kb.Badge badgeNumber={badgeCountInMenu} badgeStyle={styles.badge} />}
      </Kb.Box>
      {popup}
    </Kb.Box>
  )
}

const badgeTypesInHeader = [Tabs.peopleTab, Tabs.chatTab, Tabs.fsTab, Tabs.teamsTab]
const badgesInMenu = [Tabs.walletsTab, Tabs.gitTab, Tabs.devicesTab, Tabs.settingsTab]
const LoggedIn = (p: Props) => {
  const {endEstimate, files, kbfsDaemonStatus, totalSyncingBytes, fileName} = p
  const {outOfDate, windowShownCount} = p

  const dispatch = Container.useDispatch()
  const refreshUserFileEdits = Container.useThrottledCallback(() => {
    dispatch(FsGen.createUserFileEditsLoad())
  }, 5000)

  React.useEffect(() => {
    refreshUserFileEdits()
  }, [refreshUserFileEdits, windowShownCount])

  return (
    <>
      <OutOfDate outOfDate={outOfDate} />
      <Kb.ScrollView style={styles.flexOne}>
        <ChatContainer convLimit={5} />
        {kbfsDaemonStatus.rpcStatus === FsTypes.KbfsDaemonRpcStatus.Connected ? (
          <FilesPreview />
        ) : (
          <Kb.Box2 direction="vertical" fullWidth={true} style={{height: 200}}>
            <Loading />
          </Kb.Box2>
        )}
      </Kb.ScrollView>
      <Kb.Box style={styles.footer}>
        <UploadWithCountdown
          endEstimate={endEstimate}
          isOnline={kbfsDaemonStatus.onlineStatus !== FsTypes.KbfsDaemonOnlineStatus.Offline}
          files={files}
          fileName={fileName}
          totalSyncingBytes={totalSyncingBytes}
          smallMode={true}
        />
      </Kb.Box>
    </>
  )
}

const LoggedOut = (p: {daemonHandshakeState: ConfigTypes.DaemonHandshakeState; loggedIn: boolean}) => {
  const {daemonHandshakeState, loggedIn} = p

  const fullyLoggedOut = daemonHandshakeState === 'done' && !loggedIn

  const text = fullyLoggedOut
    ? 'You are logged out of Keybase.'
    : daemonHandshakeState === 'waitingForWaiters'
    ? 'Connecting interface to crypto engine... This may take a few seconds.'
    : 'Starting up Keybase...'

  const dispatch = Container.useDispatch()
  const logIn = () => {
    dispatch(ConfigGen.createShowMain())
    dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]}))
  }
  return (
    <>
      <Kb.BoxGrow>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          style={{alignItems: 'center', justifyContent: 'center', padding: Styles.globalMargins.small}}
        >
          <Kb.Box2 direction="vertical">
            <Kb.Icon
              type="icon-keybase-logo-logged-out-64"
              style={styles.logo}
              color={Styles.globalColors.yellow}
            />
            <Kb.Text type="Body" style={{alignSelf: 'center', marginTop: 6}}>
              {text}
            </Kb.Text>
            {fullyLoggedOut ? (
              <Kb.ButtonBar direction="row">
                <Kb.Button label="Log in" onClick={logIn} />
              </Kb.ButtonBar>
            ) : null}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.BoxGrow>
    </>
  )
}

const MenubarRender = (p: Props) => {
  const {darkMode, loggedIn, daemonHandshakeState} = p
  _setDarkModePreference(darkMode ? 'alwaysDark' : 'alwaysLight')
  let content: React.ReactNode = null
  if (daemonHandshakeState === 'done' && loggedIn) {
    content = <LoggedIn {...p} />
  } else {
    content = <LoggedOut daemonHandshakeState={daemonHandshakeState} loggedIn={loggedIn} />
  }

  return (
    <Kb.Box2
      direction="vertical"
      style={styles.widgetContainer}
      className={darkMode ? 'darkMode' : 'lightMode'}
      key={darkMode ? 'darkMode' : 'light'}
    >
      {isDarwin && <style>{_realCSS}</style>}
      {isDarwin && <ArrowTick />}
      <IconBar {...p} showBadges={loggedIn} />
      {content}
    </Kb.Box2>
  )
}

const TabView = (p: {title: string; iconType: Kb.IconType; count?: number}) => {
  const {count, iconType, title} = p
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={{alignItems: 'center'}}>
      <Kb.Box style={{marginRight: Styles.globalMargins.tiny, position: 'relative'}}>
        <Kb.Icon type={iconType} color={Styles.globalColors.blue} sizeType="Big" />
        {!!count && <Kb.Badge badgeNumber={count} badgeStyle={styles.badge} />}
      </Kb.Box>
      <Kb.Text className="title" type="BodySemibold" style={Styles.collapseStyles([{color: undefined}])}>
        {title}
      </Kb.Text>
    </Kb.Box2>
  )
}

// TODO
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
  const count = countMap.get(tab)
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
  flexOne: {flexGrow: 1},
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
