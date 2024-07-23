import * as C from '@/constants'
import * as R from '@/constants/remote'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as RemoteGen from '@/actions/remote-gen'
import ChatContainer from './chat-container.desktop'
import FilesPreview from './files-container.desktop'
import KB2 from '@/util/electron.desktop'
import OutOfDate from './out-of-date'
import Upload from '@/fs/footer/upload'
import openUrl from '@/util/open-url'
import {Loading} from '@/fs/simple-screens'
import {isLinux, isDarwin} from '@/constants/platform'
import {type _InnerMenuItem} from '@/common-adapters/floating-menu/menu-layout'
import {useUploadCountdown} from '@/fs/footer/use-upload-countdown'
import type {DeserializeProps} from './remote-serializer.desktop'
import {DarkCSSInjector} from '@/desktop/renderer/dark-injector.desktop'

const {hideWindow, ctlQuit} = KB2.functions

export type Props = Pick<DeserializeProps, 'remoteTlfUpdates' | 'conversationsToSend'> & {
  daemonHandshakeState: T.Config.DaemonHandshakeState
  darkMode: boolean
  diskSpaceStatus: T.FS.DiskSpaceStatus
  loggedIn: boolean
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
  kbfsEnabled: boolean
  outOfDate: T.Config.OutOfDate
  showingDiskSpaceBanner: boolean
  username: string
  navBadges: ReadonlyMap<string, number>
  windowShownCount: number

  // UploadCountdownHOCProps
  endEstimate?: number
  files: number
  fileName?: string
  totalSyncingBytes: number
}

const ArrowTick = () => <Kb.Box style={styles.arrowTick} />
type UWCDProps = {
  endEstimate?: number
  files: number
  fileName?: string
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
  p: Props & {showBadges?: boolean; openApp: (tab?: C.Tabs.AppTab) => void}
): ReadonlyArray<_InnerMenuItem> => {
  const {showBadges, navBadges, daemonHandshakeState, username, kbfsEnabled, openApp} = p
  const countMap = navBadges
  const startingUp = daemonHandshakeState !== 'done'

  const ret = React.useMemo(() => {
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
              R.remoteDispatch(RemoteGen.createStop({exitCode: T.RPCGen.ExitCode.ok}))
            } else {
              R.remoteDispatch(RemoteGen.createDumpLogs({reason: 'quitting through menu'}))
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
          onClick: () => openApp(C.Tabs.gitTab),
          title: 'Git',
          view: <TabView title="Git" iconType="iconfont-nav-2-git" count={countMap.get(C.Tabs.gitTab)} />,
        },
        {
          onClick: () => openApp(C.Tabs.devicesTab),
          title: 'Devices',
          view: (
            <TabView
              title="Devices"
              iconType="iconfont-nav-2-devices"
              count={countMap.get(C.Tabs.devicesTab)}
            />
          ),
        },
        {
          onClick: () => openApp(C.Tabs.settingsTab),
          title: 'Settings',
          view: (
            <TabView
              title="Settings"
              iconType="iconfont-nav-2-settings"
              count={countMap.get(C.Tabs.settingsTab)}
            />
          ),
        },
        'Divider' as const,
        ...openAppItem,
        ...(kbfsEnabled
          ? ([
              {
                onClick: () => {
                  R.remoteDispatch(RemoteGen.createOpenPathInSystemFileManager({path: '/keybase'}))
                },
                title: `Open folders in ${Kb.Styles.fileUIName}`,
              },
              'Divider',
            ] as const)
          : []),
        ...common,
      ] as const
    }
    return [...openAppItem, ...common] as const
  }, [username, countMap, kbfsEnabled, openApp, showBadges, startingUp])
  return ret
}

const IconBar = (p: Props & {showBadges?: boolean}) => {
  const {navBadges, showBadges} = p
  const openApp = React.useCallback((tab?: C.Tabs.AppTab) => {
    R.remoteDispatch(RemoteGen.createShowMain())
    tab && R.remoteDispatch(RemoteGen.createSwitchTab({tab}))
  }, [])

  const menuItems = useMenuItems({...p, openApp})

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          closeOnSelect={true}
          items={menuItems}
          visible={true}
          onHidden={hidePopup}
          attachTo={attachTo}
          position="bottom right"
        />
      )
    },
    [menuItems]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

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
        style={Kb.Styles.platformStyles({
          isElectron: {
            ...Kb.Styles.desktopStyles.clickable,
            marginRight: Kb.Styles.globalMargins.tiny,
            position: 'relative',
          } as const,
        })}
      >
        <Kb.Icon
          color={
            Kb.Styles.isDarkMode()
              ? Kb.Styles.globalColors.black_50OrBlack_60
              : Kb.Styles.globalColors.blueDarker
          }
          hoverColor={Kb.Styles.globalColors.whiteOrWhite}
          onClick={showPopup}
          type="iconfont-nav-2-hamburger"
          sizeType="Big"
          ref={popupAnchor}
        />
        {!!badgeCountInMenu && <Kb.Badge badgeNumber={badgeCountInMenu} badgeStyle={styles.badge} />}
      </Kb.Box>
      {popup}
    </Kb.Box>
  )
}

const badgeTypesInHeader = [C.Tabs.peopleTab, C.Tabs.chatTab, C.Tabs.fsTab, C.Tabs.teamsTab] as const
const badgesInMenu = [C.Tabs.gitTab, C.Tabs.devicesTab, C.Tabs.settingsTab] as const
const LoggedIn = (p: Props) => {
  const {endEstimate, files, kbfsDaemonStatus, totalSyncingBytes, fileName} = p
  const {outOfDate, windowShownCount, conversationsToSend, remoteTlfUpdates} = p

  const refreshUserFileEdits = C.useThrottledCallback(() => {
    R.remoteDispatch(RemoteGen.createUserFileEditsLoad())
  }, 5000)

  React.useEffect(() => {
    refreshUserFileEdits()
  }, [refreshUserFileEdits, windowShownCount])

  return (
    <>
      <OutOfDate outOfDate={outOfDate} />
      <Kb.ScrollView style={styles.flexOne}>
        <ChatContainer convLimit={5} conversationsToSend={conversationsToSend} />
        {kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected ? (
          <FilesPreview remoteTlfUpdates={remoteTlfUpdates} />
        ) : (
          <Kb.Box2 direction="vertical" fullWidth={true} style={{height: 200}}>
            <Loading />
          </Kb.Box2>
        )}
      </Kb.ScrollView>
      <Kb.Box style={styles.footer}>
        <UploadWithCountdown
          endEstimate={endEstimate}
          isOnline={kbfsDaemonStatus.onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline}
          files={files}
          fileName={fileName}
          totalSyncingBytes={totalSyncingBytes}
          smallMode={true}
        />
      </Kb.Box>
    </>
  )
}

const LoggedOut = (p: {daemonHandshakeState: T.Config.DaemonHandshakeState; loggedIn: boolean}) => {
  const {daemonHandshakeState, loggedIn} = p

  const fullyLoggedOut = daemonHandshakeState === 'done' && !loggedIn

  const text = fullyLoggedOut
    ? 'You are logged out of Keybase.'
    : daemonHandshakeState === 'waitingForWaiters'
      ? 'Connecting interface to crypto engine... This may take a few seconds.'
      : 'Starting up Keybase...'

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const logIn = () => {
    R.remoteDispatch(RemoteGen.createShowMain())
    navigateAppend(C.Tabs.loginTab)
  }
  return (
    <>
      <Kb.BoxGrow>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          style={{alignItems: 'center', justifyContent: 'center', padding: Kb.Styles.globalMargins.small}}
        >
          <Kb.Box2 direction="vertical">
            <Kb.Icon
              type="icon-keybase-logo-logged-out-64"
              style={styles.logo}
              color={Kb.Styles.globalColors.yellow}
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
  const {loggedIn, daemonHandshakeState} = p

  const [lastDM, setLastDM] = React.useState(p.darkMode)
  if (p.darkMode !== lastDM) {
    setLastDM(p.darkMode)
    C.useDarkModeState.getState().dispatch.setDarkModePreference(p.darkMode ? 'alwaysDark' : 'alwaysLight')
  }

  const darkMode = C.useDarkModeState(s => s.isDarkMode())

  let content: React.ReactNode
  if (daemonHandshakeState === 'done' && loggedIn) {
    content = <LoggedIn {...p} />
  } else {
    content = <LoggedOut daemonHandshakeState={daemonHandshakeState} loggedIn={loggedIn} />
  }

  React.useEffect(() => {
    document.body.classList.add('isWidget')
  }, [])

  return (
    <Kb.Styles.DarkModeContext.Provider value={darkMode}>
      <DarkCSSInjector />
      <Kb.Box2 direction="vertical" style={styles.widgetContainer} key={darkMode ? 'darkMode' : 'light'}>
        {isDarwin && <ArrowTick />}
        <IconBar {...p} showBadges={loggedIn} />
        {content}
      </Kb.Box2>
    </Kb.Styles.DarkModeContext.Provider>
  )
}

const TabView = (p: {title: string; iconType: Kb.IconType; count?: number}) => {
  const {count, iconType, title} = p
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={{alignItems: 'center'}}>
      <Kb.Box style={{marginRight: Kb.Styles.globalMargins.tiny, position: 'relative'}}>
        <Kb.Icon type={iconType} color={Kb.Styles.globalColors.blue} sizeType="Big" />
        {!!count && <Kb.Badge badgeNumber={count} badgeStyle={styles.badge} />}
      </Kb.Box>
      <Kb.Text className="title" type="BodySemibold" style={Kb.Styles.collapseStyles([{color: undefined}])}>
        {title}
      </Kb.Text>
    </Kb.Box2>
  )
}

const iconMap = {
  [C.Tabs.peopleTab]: 'iconfont-nav-2-people',
  [C.Tabs.chatTab]: 'iconfont-nav-2-chat',
  [C.Tabs.devicesTab]: 'iconfont-nav-2-devices',
  [C.Tabs.fsTab]: 'iconfont-nav-2-files',
  [C.Tabs.teamsTab]: 'iconfont-nav-2-teams',
  [C.Tabs.gitTab]: undefined,
  [C.Tabs.settingsTab]: undefined,
} as const

type Tabs = (typeof badgeTypesInHeader)[number] | (typeof badgesInMenu)[number]

const BadgeIcon = (p: {tab: Tabs; countMap: ReadonlyMap<string, number>; openApp: (t: Tabs) => void}) => {
  const {tab, countMap, openApp} = p
  const count = countMap.get(tab)
  const iconType = iconMap[tab]

  if ((tab === C.Tabs.devicesTab && !count) || !iconType) {
    return null
  }

  return (
    <Kb.Box
      style={Kb.Styles.platformStyles({
        isElectron: {...Kb.Styles.desktopStyles.clickable, position: 'relative'},
      })}
    >
      <Kb.Icon
        color={
          Kb.Styles.isDarkMode()
            ? Kb.Styles.globalColors.black_50OrBlack_60
            : Kb.Styles.globalColors.blueDarker
        }
        hoverColor={Kb.Styles.globalColors.whiteOrWhite}
        onClick={() => openApp(tab)}
        sizeType="Big"
        style={styles.navIcons}
        type={iconType}
      />
      {!!count && <Kb.Badge badgeNumber={count} badgeStyle={styles.badge} />}
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  arrowTick: {
    borderBottomColor: Kb.Styles.isDarkMode() ? '#2d2d2d' : Kb.Styles.globalColors.blueDark,
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
    marginRight: Kb.Styles.globalMargins.tiny,
  },
  headerBadgesContainer: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginLeft: 24 + 8,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  navIcons: {paddingLeft: Kb.Styles.globalMargins.xtiny, paddingRight: Kb.Styles.globalMargins.xtiny},
  topRow: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Kb.Styles.isDarkMode() ? '#2d2d2d' : Kb.Styles.globalColors.blueDark,
    borderTopLeftRadius: Kb.Styles.globalMargins.xtiny,
    borderTopRightRadius: Kb.Styles.globalMargins.xtiny,
    flex: 1,
    maxHeight: 40,
    minHeight: 40,
    paddingLeft: 8,
    paddingRight: 8,
  },
  widgetContainer: {
    backgroundColor: Kb.Styles.globalColors.white,
    borderTopLeftRadius: Kb.Styles.globalMargins.xtiny,
    borderTopRightRadius: Kb.Styles.globalMargins.xtiny,
    flex: 1,
    height: '100%',
    marginTop: isDarwin ? 13 : 0,
    position: 'relative',
    width: '100%',
  },
}))

export default MenubarRender
