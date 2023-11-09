import * as Common from './common.desktop'
import * as C from '../constants'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import {shim, getOptions} from './shim'
import * as Tabs from '../constants/tabs'
import Header from './header/index.desktop'
import type {RouteMap} from '../constants/types/router2'
import {HeaderLeftCancel} from '../common-adapters/header-hoc'
import {NavigationContainer} from '@react-navigation/native'
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import './router.css'

export const headerDefaultStyle = Common.headerDefaultStyle
const Tab = createLeftTabNavigator()

type DesktopTabs = (typeof Tabs.desktopTabs)[number]

const tabRootsVals = Object.values(tabRoots).filter(root => {
  return root !== tabRoots[Tabs.fsTab] && root !== tabRoots[Tabs.gitTab]
}) // we allow some root anywhere
// we don't want the other roots in other stacks
const routesMinusRoots = (tab: DesktopTabs) => {
  const keepVal = tabRoots[tab]
  return Object.keys(routes).reduce<RouteMap>((m, k) => {
    if (k === keepVal || !tabRootsVals.includes(k as any)) {
      m[k] = routes[k]
    }
    return m
  }, {})
}

// we must ensure we don't keep remaking these components
const tabScreensCache = new Map()
const makeTabStack = (tab: DesktopTabs) => {
  const S = createNativeStackNavigator()

  let tabScreens = tabScreensCache.get(tab)
  if (!tabScreens) {
    tabScreens = makeNavScreens(shim(routesMinusRoots(tab), false, false), S.Screen, false)
    tabScreensCache.set(tab, tabScreens)
  }

  const Comp = React.memo(
    function TabStackNavigator() {
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

const makeNavScreens = (rs: any, Screen: any, _isModal: boolean) => {
  return Object.keys(rs).map(name => {
    return (
      <Screen
        key={name}
        navigationKey={name}
        name={name}
        getComponent={rs[name].getScreen}
        options={({route, navigation}: any) => {
          const no = getOptions(rs[name])
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    )
  })
}

const AppTabsInner = () => {
  // so we have a stack per tab
  const tabStacks = React.useMemo(
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
          tabBarActiveBackgroundColor: Kb.Styles.globalColors.blueDarkOrGreyDarkest,
          tabBarHideOnKeyboard: true,
          tabBarInactiveBackgroundColor: Kb.Styles.globalColors.blueDarkOrGreyDarkest,
          tabBarShowLabel: Kb.Styles.isTablet,
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

const LoggedOutStack = createNativeStackNavigator()
const LoggedOutScreens = makeNavScreens(shim(loggedOutRoutes, false, true), LoggedOutStack.Screen, false)
const LoggedOut = React.memo(function LoggedOut() {
  return (
    <LoggedOutStack.Navigator
      initialRouteName="login"
      screenOptions={{
        header: ({navigation}) => (
          <Header
            navigation={navigation}
            options={{headerBottomStyle: {height: 0}, headerHideBorder: true}}
          />
        ),
      }}
    >
      {LoggedOutScreens}
    </LoggedOutStack.Navigator>
  )
})

const RootStack = createNativeStackNavigator()
const ModalScreens = makeNavScreens(shim(modalRoutes, true, false), RootStack.Screen, true)
const documentTitle = {
  formatter: () => {
    const t = C.getTab()
    const m = t ? Tabs.desktopTabMeta[t] : undefined
    const tabLabel: string = m?.label ?? ''
    return `Keybase: ${tabLabel}`
  },
}
const ElectronApp = () => {
  const {loggedInLoaded, loggedIn, appState, onStateChange, navKey, initialState} = Shared.useShared()
  Shared.useSharedAfter(appState)

  return (
    <NavigationContainer
      ref={C.navigationRef_ as any}
      key={String(navKey)}
      theme={Shared.theme}
      initialState={initialState}
      onStateChange={onStateChange}
      documentTitle={documentTitle}
    >
      <RootStack.Navigator
        key="root"
        screenOptions={{
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
