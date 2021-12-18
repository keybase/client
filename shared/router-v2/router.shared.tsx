import * as Tabs from '../constants/tabs'
import * as Kbfs from '../fs/common'
import * as FsConstants from '../constants/fs'
import Loading from '../login/loading'
import * as Styles from '../styles'
import {IconType} from '../common-adapters/icon.constants-gen'
import * as ConfigConstants from '../constants/config'
import * as ConfigGen from '../actions/config-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/router2'
import * as Container from '../util/container'
import * as React from 'react'
import * as Kb from '../common-adapters'

export const phoneTabs = [Tabs.peopleTab, Tabs.chatTab, Tabs.fsTab, Tabs.teamsTab, Tabs.settingsTab]
const tabletTabs = [
  Tabs.peopleTab,
  Tabs.chatTab,
  Tabs.fsTab,
  Tabs.teamsTab,
  Tabs.walletsTab,
  Tabs.settingsTab,
]
const desktopTabs = [
  Tabs.peopleTab,
  Tabs.chatTab,
  Tabs.cryptoTab,
  Tabs.fsTab,
  Tabs.teamsTab,
  Tabs.walletsTab,
  Tabs.gitTab,
  Tabs.devicesTab,
  Tabs.settingsTab,
]

const settingsTabChildrenPhone: Array<Tabs.Tab> = [
  Tabs.gitTab,
  Tabs.devicesTab,
  Tabs.walletsTab,
  Tabs.settingsTab,
]
const settingsTabChildrenTablet: Array<Tabs.Tab> = [Tabs.gitTab, Tabs.devicesTab, Tabs.settingsTab]
export const settingsTabChildren = Container.isPhone ? settingsTabChildrenPhone : settingsTabChildrenTablet

export const tabs = Styles.isTablet ? tabletTabs : phoneTabs

type TabData = {
  icon: IconType
  label: string
}
export const tabToData: {[key: string]: TabData} = {
  [Tabs.chatTab]: {icon: 'iconfont-nav-2-chat', label: 'Chat'},
  [Tabs.fsTab]: {icon: 'iconfont-nav-2-files', label: 'Files'},
  [Tabs.teamsTab]: {icon: 'iconfont-nav-2-teams', label: 'Teams'},
  [Tabs.peopleTab]: {icon: 'iconfont-nav-2-people', label: 'People'},
  [Tabs.settingsTab]: {icon: 'iconfont-nav-2-hamburger', label: 'More'},
  [Tabs.walletsTab]: {icon: 'iconfont-nav-2-wallets', label: 'Wallet'},
}

export enum AppState {
  UNINIT, // haven't rendered the nav yet
  NEEDS_INIT, // rendered but need to bootstrap
  INITED, // regular app now
}

const useConnectNavToRedux = () => {
  console.log('bbb ConnectNavToRedux rendering ')
  const dispatch = Container.useDispatch()
  const setNavOnce = React.useRef(false)
  React.useEffect(() => {
    console.log('bbb ConnectNavToRedux useeffect ', setNavOnce.current)
    if (!setNavOnce.current) {
      if (Constants.navigationRef_.isReady()) {
        setNavOnce.current = true
        dispatch(ConfigGen.createSetNavigator({navigator}))

        if (__DEV__) {
          window.DEBUGNavigator = Constants.navigationRef_.current
          window.DEBUGRouter2 = Constants
          console.log('aaaa debug nav', Constants.navigationRef_.current)
        }
      }
    }
  }, [setNavOnce])
}

const useIsDarkChanged = () => {
  const isDarkMode = Container.useSelector(state => ConfigConstants.isDarkMode(state.config))
  const darkChanged = Container.usePrevious(isDarkMode) !== isDarkMode
  return darkChanged
}

const useNavKey = (appState: AppState, key: React.MutableRefObject<number>) => {
  const darkChanged = useIsDarkChanged()
  if (darkChanged) {
    key.current++
  }

  return appState === AppState.NEEDS_INIT ? -1 : key.current
}

const useInitialState = () => {
  const darkChanged = useIsDarkChanged()
  return darkChanged
    ? Constants.navigationRef_?.isReady()
      ? Constants.navigationRef_?.getRootState()
      : undefined
    : undefined
}

export const useShared = () => {
  useConnectNavToRedux()
  // We use useRef and usePrevious so we can understand how our state has changed and do the right thing
  // if we use useEffect and useState we'll have to deal with extra renders which look really bad
  const loggedInLoaded = Container.useSelector(state => state.config.daemonHandshakeState === 'done')
  const loggedIn = Container.useSelector(state => state.config.loggedIn)
  const dispatch = Container.useDispatch()
  const navContainerKey = React.useRef(1)
  const oldNavPath = React.useRef<any>([])
  // keep track if we went to an init route yet or not
  const appState = React.useRef(loggedInLoaded ? AppState.NEEDS_INIT : AppState.UNINIT)

  if (appState.current === AppState.UNINIT && loggedInLoaded) {
    appState.current = AppState.NEEDS_INIT
  }

  const onStateChange = React.useCallback(() => {
    const old = oldNavPath.current
    const vp = Constants.getVisiblePath()
    console.log('bbb onstatechnaged', vp)
    dispatch(
      RouteTreeGen.createOnNavChanged({
        navAction: undefined,
        next: vp,
        prev: old,
      })
    )
    oldNavPath.current = vp
  }, [oldNavPath, dispatch])

  const navKey = useNavKey(appState.current, navContainerKey)
  const initialState = useInitialState()
  return {
    loggedInLoaded,
    loggedIn,
    appState,
    onStateChange,
    navKey,
    initialState,
  }
}

export const useSharedAfter = (appState: React.MutableRefObject<AppState>) => {
  // stuff that happens after the first hook is done
  // if we handled NEEDS_INIT we're done
  if (appState.current === AppState.NEEDS_INIT) {
    appState.current = AppState.INITED
  }
}

export const SimpleLoading = React.memo(() => {
  console.log('bbb simle loading render')
  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={{
        backgroundColor: Styles.globalColors.white,
        // backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
      }}
    >
      <Loading allowFeedback={false} failed="" status="" onRetry={null} onFeedback={null} />
    </Kb.Box2>
  )
})

export const FilesTabBadge = () => {
  const uploadIcon = FsConstants.getUploadIconForFilesTab(Container.useSelector(state => state.fs.badge))
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.fsBadgeIconUpload} /> : null
}

const styles = Styles.styleSheetCreate(() => ({
  fsBadgeIconUpload: {
    bottom: Styles.globalMargins.tiny,
    height: Styles.globalMargins.small,
    position: 'absolute',
    right: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
}))
