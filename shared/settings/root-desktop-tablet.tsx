import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Common from '@/router-v2/common'
import {makeNavScreens} from '@/router-v2/shim'
import LeftNav from './sub-nav/left-nav'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import type {TypedNavigator, NavigatorTypeBagBase, StaticConfig} from '@react-navigation/native'
import {sharedNewRoutes} from './routes'
import {settingsAccountTab} from '@/stores/settings'

const settingsSubRoutes = {
  ...sharedNewRoutes,
}

function LeftTabNavigator({
  initialRouteName,
  children,
  screenOptions,
  backBehavior,
}: Parameters<typeof useNavigationBuilder>[1] & {
  backBehavior: 'initialRoute' | 'firstRoute' | 'history' | 'order' | 'none'
}) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
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
  const navigate = React.useCallback((s: string) => {
    navRef.current(s)
  }, [])

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.nav}>
          <LeftNav onClick={onSelectTab} selected={selectedTab} navigate={navigate} />
        </Kb.Box2>
        <Kb.BoxGrow>
          {state.routes.map((route, i) => {
            return i === state.index ? (
              <Kb.Box2 key={route.key} direction="vertical" fullHeight={true} fullWidth={true}>
                {descriptors[route.key]?.render()}
              </Kb.Box2>
            ) : null
          })}
        </Kb.BoxGrow>
      </Kb.Box2>
    </NavigationContent>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Kb.Styles.globalColors.white},
  nav: {width: Kb.Styles.isTablet ? 200 : 180},
}))

type NavType = NavigatorTypeBagBase & {
  ParamList: {
    [key in keyof typeof settingsSubRoutes]: undefined
  }
}

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as () => TypedNavigator<
  NavType,
  StaticConfig<NavigatorTypeBagBase>
>
const TabNavigator = createLeftTabNavigator()
const settingsScreens = makeNavScreens(settingsSubRoutes, TabNavigator.Screen, false, false)

// TODO on ipad this doesn't have a stack navigator so when you go into crypto you get
// a push from the parent stack. If we care just make a generic left nav / right stack
// that the global app / etc could use and put it here also. not worth it now
const SettingsSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={settingsAccountTab} backBehavior="none">
    {settingsScreens}
  </TabNavigator.Navigator>
)

export default SettingsSubNavigator
