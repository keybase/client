import * as Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import * as Shared from './router.shared'
import * as Styles from '../styles'
import * as React from 'react'
import {useMemo} from '../util/memoize'
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
import createNoDupeStackNavigator from './stack'
import {NavigationContainer} from '@react-navigation/native'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import type {RouteMap} from '../util/container'
import * as Shim from './shim.desktop'
import * as Common from './common.desktop'
import {HeaderLeftCancel} from '../common-adapters/header-hoc'

export const headerDefaultStyle = Common.headerDefaultStyle
const Tab = createLeftTabNavigator()

type DesktopTabs = typeof Tabs.desktopTabs[number]

const tabRootsVals = Object.values(tabRoots).filter(root => root != tabRoots[Tabs.fsTab]) // we allow fs root anywhere
// we don't want the other roots in other stacks
const routesMinusRoots = (tab: DesktopTabs) => {
  const keepVal = tabRoots[tab]
  return Object.keys(routes).reduce<RouteMap>((m, k) => {
    if (k === keepVal || !tabRootsVals.includes(k)) {
      m[k] = routes[k]
    }
    return m
  }, {})
}

// we must ensure we don't keep remaking these components
const tabScreensCache = new Map()
const makeTabStack = (tab: DesktopTabs) => {
  const S = createNoDupeStackNavigator()

  let tabScreens = tabScreensCache.get(tab)
  if (!tabScreens) {
    tabScreens = makeNavScreens(Shim.shim(routesMinusRoots(tab), false, false), S.Screen, false)
    tabScreensCache.set(tab, tabScreens)
  }

  const Comp = React.memo(
    () => {
      return (
        <S.Navigator
          initialRouteName={tabRoots[tab]}
          screenOptions={{
            ...Common.defaultNavigationOptions,
          }}
        >
          {tabScreens}
        </S.Navigator>
      )
    },
    () => true
  )
  return Comp
}

const makeNavScreens = (rs, Screen, _isModal: boolean) => {
  return Object.keys(rs).map(name => {
    return (
      <Screen
        key={name}
        navigationKey={name}
        name={name}
        getComponent={rs[name].getScreen}
        options={({route, navigation}) => {
          const no = rs[name].getOptions ?? rs[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    )
  })
}

const AppTabsInner = () => {
  // so we have a stack per tab
  const tabStacks = useMemo(
    () => Tabs.desktopTabs.map(tab => <Tab.Screen key={tab} name={tab} component={makeTabStack(tab)} />),
    []
  )

  return (
    <Tab.Navigator
      backBehavior="none"
      screenOptions={() => {
        return {
          ...Common.defaultNavigationOptions,
          header: undefined,
          headerShown: false,
          tabBarActiveBackgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
          tabBarHideOnKeyboard: true,
          tabBarInactiveBackgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
          tabBarShowLabel: Styles.isTablet,
          tabBarStyle: Common.tabBarStyle,
        }
      }}
    >
      {tabStacks}
    </Tab.Navigator>
  )
}

const AppTabs = React.memo(
  AppTabsInner,
  () => true // ignore all props
)

const LoggedOutStack = createNoDupeStackNavigator()
const LoggedOutScreens = makeNavScreens(Shim.shim(loggedOutRoutes, false, true), LoggedOutStack.Screen, false)
const LoggedOut = React.memo(() => (
  <LoggedOutStack.Navigator initialRouteName="login" screenOptions={{headerShown: false} as const}>
    {LoggedOutScreens}
  </LoggedOutStack.Navigator>
))

const RootStack = createNoDupeStackNavigator()
const ModalScreens = makeNavScreens(Shim.shim(modalRoutes, true, false), RootStack.Screen, true)
const documentTitle = {
  formatter: () => {
    const tabLabel = Tabs.desktopTabMeta[Constants.getCurrentTab() ?? '']?.label ?? ''
    return `Keybase: ${tabLabel}`
  },
}
const ElectronApp = () => {
  const {loggedInLoaded, loggedIn, appState, onStateChange, navKey, initialState} = Shared.useShared()
  Shared.useSharedAfter(appState)

  return (
    <NavigationContainer
      ref={Constants.navigationRef_ as any}
      key={String(navKey)}
      theme={Shared.theme}
      initialState={initialState}
      onStateChange={onStateChange}
      documentTitle={documentTitle}
    >
      <RootStack.Navigator
        key="root"
        screenOptions={{
          animationEnabled: false,
          headerLeft: () => <HeaderLeftCancel />,
          headerShown: false, // eventually do this after we pull apart modal2 etc
          presentation: 'transparentModal',
          title: '',
        }}
      >
        {!loggedInLoaded && (
          <RootStack.Screen key="loading" name="loading" component={Shared.SimpleLoading} />
        )}
        {loggedInLoaded && loggedIn && (
          <React.Fragment key="loggedIn">
            <RootStack.Screen key="loggedIn" name="loggedIn" component={AppTabs} />
            {ModalScreens}
          </React.Fragment>
        )}
        {loggedInLoaded && !loggedIn && (
          <RootStack.Screen key="loggedOut" name="loggedOut" component={LoggedOut} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  )
}

export default ElectronApp
