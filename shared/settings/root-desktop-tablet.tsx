import * as React from 'react'
import * as C from '@/constants'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import * as Kb from '@/common-adapters'
import * as Common from '@/router-v2/common'
import {routeMapToStaticScreens, routes, tabRoots} from '@/router-v2/routes'
import {createNativeStackNavigator, type NativeStackNavigationOptions} from '@react-navigation/native-stack'
import {makeLayout} from '@/router-v2/screen-layout'
import LeftNav from './sub-nav/left-nav'
import {useNavigationBuilder, TabRouter, createNavigatorFactory, useNavigation} from '@react-navigation/core'
import {NavigationContainer, NavigationIndependentTree, useTheme} from '@react-navigation/native'
import AccountSwitchHeaderAvatar from '@/router-v2/account-switch-header-avatar'
import {settingsDesktopTabRoutes} from './routes'
import {settingsAccountTab} from '@/constants/settings'

function LeftTabNavigator({
  initialRouteName,
  children,
  screenOptions,
  backBehavior,
}: Parameters<typeof useNavigationBuilder>[1] & {
  backBehavior: 'initialRoute' | 'firstRoute' | 'history' | 'order' | 'none'
}) {
  const styles = useStyles()
  const {state, navigation, descriptors, render} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    initialRouteName,
    screenOptions,
  })

  const selectedTab = state.routes[state.index]?.name ?? ''
  const onSelectTab = Common.useSubnavTabAction(
    // eslint-disable-next-line
    navigation as any,
    state
  )

  const navRef = React.useRef((_s: string) => {})
  React.useEffect(() => {
    navRef.current = (s: string) => {
      navigation.navigate(s)
    }
  }, [navigation])
  const navigate = (s: string) => {
    navRef.current(s)
  }
  // the phone list has a contacts row, so a phone's split (an iPhone Duo unfolded) keeps it
  const contactsLabel = useSettingsContactsState(s =>
    !C.isPhone ? undefined : s.importEnabled ? 'Phone contacts' : 'Import phone contacts'
  )
  // each pane clears only the screen edge it touches
  const {left, right} = Kb.useScreenSideInsets()
  // On mobile each column draws its own native bar (see LeftColumn), so the tab's bar would be a
  // second one above them. Nothing is pushed on the tab's stack above this screen: settings screens
  // push inside their pane, everything else opens above the tabs.
  const parentNavigation = useNavigation()
  React.useLayoutEffect(() => {
    if (isMobile) parentNavigation.setOptions({headerShown: false})
  }, [parentNavigation])
  const leftNav = (
    <LeftNav onClick={onSelectTab} selected={selectedTab} navigate={navigate} contactsLabel={contactsLabel} />
  )

  return render(
    <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
      <Kb.Box2 direction="vertical" fullHeight={true} style={{width: navWidth + left}}>
        <Kb.ScreenSideInsetsContext value={{left, right: 0}}>
          {LeftColumn ? (
            <LeftNavContext value={leftNav}>
              <LeftColumn />
            </LeftNavContext>
          ) : (
            leftNav
          )}
        </Kb.ScreenSideInsetsContext>
      </Kb.Box2>
      <Kb.BoxGrow>
        <Kb.ScreenSideInsetsContext value={{left: 0, right}}>
          {state.routes.map((route, i) => {
            const selected = i === state.index
            const desc = descriptors[route.key]
            return (
              <React.Activity key={route.name} mode={selected ? 'visible' : 'hidden'}>
                <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
                  {desc?.render()}
                </Kb.Box2>
              </React.Activity>
            )
          })}
        </Kb.ScreenSideInsetsContext>
      </Kb.BoxGrow>
    </Kb.Box2>
  )
}

const tabRootNames = new Set<string>(Object.values(tabRoots).filter(Boolean))
const navWidth = isMobile ? 200 : 180

const useStyles = Kb.Styles.createStyleHook(theme => ({
  box: {backgroundColor: theme.white},
}))

// The factory's static-config call signature is hidden by our custom-navigator typing, so
// re-surface it with a cast. Screens come from the same route-map converter the root uses.
const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as unknown as (config: {
  backBehavior: 'none'
  initialRouteName: string
  screens: Record<string, {screen: React.ComponentType}>
}) => {getComponent: () => React.ComponentType}

// On mobile each page is its own stack holding every route, as an iPad tab's stack does, so a screen
// a page opens (a device, a git repo, an encrypt screen) pushes inside the pane instead of over the
// whole tab. Every page shows its bar, level with the list's: a push from a bar-less page to a
// headered one judders on iOS (react-native-screens#3773).
const paneScreens = isMobile
  ? routeMapToStaticScreens(
      Object.fromEntries(
        Object.entries(routes).filter(([name]) => !tabRootNames.has(name))
      ) as typeof routes,
      makeLayout,
      false,
      false
    )
  : undefined

// The list's column on mobile: a stack of one screen, so its bar is a native bar like the pages'.
// The tab's bar is hidden while this shows, so this one carries the tab's title and account switcher.
const LeftNavContext = React.createContext<React.ReactNode>(null)
const LeftNavScreen = () => <>{React.useContext(LeftNavContext)}</>
const leftColumnOptions: NativeStackNavigationOptions = {
  ...Common.defaultNavigationOptions,
  title: C.isPhone ? 'More' : 'Settings',
  ...(isIOS
    ? {
        unstable_headerLeftItems: () => [
          {element: <AccountSwitchHeaderAvatar />, hidesSharedBackground: true, type: 'custom' as const},
        ],
      }
    : {headerLeft: () => <AccountSwitchHeaderAvatar />}),
}
const LeftStack = isMobile
  ? createNativeStackNavigator({
      initialRouteName: 'settingsLeftNav',
      screens: {settingsLeftNav: {options: leftColumnOptions, screen: LeftNavScreen}},
    }).getComponent()
  : undefined
// A screen holds one navigator, and this column sits beside the pages' navigator, so it gets a tree of
// its own. The list never navigates in it: its rows call the settings navigator.
function LeftColumnTree() {
  const theme = useTheme()
  if (!LeftStack) return null
  return (
    <NavigationIndependentTree>
      <NavigationContainer theme={theme}>
        <LeftStack />
      </NavigationContainer>
    </NavigationIndependentTree>
  )
}
const LeftColumn = LeftStack ? LeftColumnTree : undefined
const pageScreens = paneScreens
  ? Object.fromEntries(
      Object.keys(settingsDesktopTabRoutes).map(name => [
        name,
        {
          screen: createNativeStackNavigator({
            initialRouteName: name,
            screenOptions: Common.defaultNavigationOptions as NativeStackNavigationOptions,
            screens: paneScreens,
          }).getComponent(),
        },
      ])
    )
  : routeMapToStaticScreens(settingsDesktopTabRoutes, makeLayout, false, false)

// annotated: router-v2/routes lazily imports this module, so an inferred type would be circular
const SettingsSubNavigator: React.ComponentType = createLeftTabNavigator({
  backBehavior: 'none',
  initialRouteName: settingsAccountTab,
  screens: pageScreens,
}).getComponent()

export default SettingsSubNavigator
