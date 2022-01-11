import * as Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import * as Shared from './router.shared'
import * as Styles from '../styles'
import * as React from 'react'
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
import {createStackNavigator} from '@react-navigation/stack'
import {NavigationContainer} from '@react-navigation/native'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import * as Shim from './shim.desktop'
import * as Common from './common.desktop'
import {HeaderLeftCancel} from '../common-adapters/header-hoc'

export const headerDefaultStyle = Common.headerDefaultStyle
const Tab = createLeftTabNavigator()

// so we have a stack per tab
const tabToStack = new Map()
const makeTabStack = tab => {
  let Comp = tabToStack.get(tab)
  if (!Comp) {
    const S = createStackNavigator()
    Comp = () => {
      return (
        <S.Navigator initialRouteName={tabRoots[tab]} screenOptions={Common.defaultNavigationOptions}>
          {makeNavScreens(Shim.shim(routes, false, false), S.Screen, false)}
        </S.Navigator>
      )
    }
    tabToStack.set(tab, Comp)
  }
  return Comp
}

const makeNavScreens = (rs, Screen, _isModal) => {
  return Object.keys(rs).map(name => {
    return (
      <Screen
        key={name}
        navigationKey={name}
        name={name}
        getComponent={rs[name].getScreen}
        options={({route, navigation}) => {
          const no = rs[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({route, navigation}) : no
          return {...opt}
        }}
      />
    )
  })
}

const tabBarStyle = {
  get backgroundColor() {
    return Styles.globalColors.blueDarkOrGreyDarkest
  },
}

const AppTabs = () => {
  return (
    <Tab.Navigator
      backBehavior="none"
      screenOptions={() => {
        return {
          ...Common.defaultNavigationOptions,
          tabBarHideOnKeyboard: true,
          header: undefined,
          headerShown: false,
          tabBarShowLabel: Styles.isTablet,
          tabBarStyle,
          tabBarActiveBackgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
          tabBarInactiveBackgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
        }
      }}
    >
      {Tabs.desktopTabs.map(tab => (
        <Tab.Screen key={tab} name={tab} getComponent={() => makeTabStack(tab)} />
      ))}
    </Tab.Navigator>
  )
}
const LoggedOutStack = createStackNavigator()
const LoggedOut = () => (
  <LoggedOutStack.Navigator
    initialRouteName="login"
    screenOptions={ { headerShown: false, } as const }
  >
    {makeNavScreens(Shim.shim(loggedOutRoutes, false, true), LoggedOutStack.Screen, false)}
  </LoggedOutStack.Navigator>
)

const RootStack = createStackNavigator()
const ElectronApp = () => {
  const {loggedInLoaded, loggedIn, appState, onStateChange, navKey, initialState} = Shared.useShared()
  Shared.useSharedAfter(appState)

  return (
    <NavigationContainer
      ref={Constants.navigationRef_}
      key={String(navKey)}
      theme={Shared.theme}
      initialState={initialState}
      onStateChange={onStateChange}
    >
      <RootStack.Navigator
        key="root"
        screenOptions={{
          animationEnabled: false,
          presentation: 'transparentModal',
          headerLeft: () => <HeaderLeftCancel />,
          title: '',
          headerShown: false, // eventually do this after we pull apart modal2 etc
        }}
      >
        {!loggedInLoaded && (
          <RootStack.Screen key="loading" name="loading" component={Shared.SimpleLoading} />
        )}
        {loggedInLoaded && loggedIn && (
          <React.Fragment key="loggedIn">
            <RootStack.Screen key="loggedIn" name="loggedIn" component={AppTabs} />
            {makeNavScreens(Shim.shim(modalRoutes, true, false), RootStack.Screen, true)}
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
