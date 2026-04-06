import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Common from '@/router-v2/common'
import {routeMapToScreenElements} from '@/router-v2/routes'
import {makeLayout} from '@/router-v2/screen-layout.desktop'
import type {RouteDef, GetOptionsParams} from '@/constants/types/router'
import LeftNav from './sub-nav/left-nav'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import type {TypedNavigator, NavigatorTypeBagBase} from '@react-navigation/native'
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
  const navigate = (s: string) => {
    navRef.current(s)
  }

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.nav}>
          <LeftNav onClick={onSelectTab} selected={selectedTab} navigate={navigate} />
        </Kb.Box2>
        <Kb.BoxGrow>
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
  ParamList: {[K in keyof typeof settingsDesktopTabRoutes]: undefined}
}

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as unknown as () => TypedNavigator<NavType>
const TabNavigator = createLeftTabNavigator()
const makeOptions = (rd: RouteDef) => {
  return ({route, navigation}: GetOptionsParams) => {
    const no = rd.getOptions
    const opt = typeof no === 'function' ? no({navigation, route}) : no
    return {...opt}
  }
}
const settingsScreens = routeMapToScreenElements(
  settingsDesktopTabRoutes,
  TabNavigator.Screen,
  makeLayout,
  makeOptions,
  false,
  false,
  false
)

// TODO on ipad this doesn't have a stack navigator so when you go into crypto you get
// a push from the parent stack. If we care just make a generic left nav / right stack
// that the global app / etc could use and put it here also. not worth it now
const SettingsSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={settingsAccountTab} backBehavior="none">
    {settingsScreens}
  </TabNavigator.Navigator>
)

export default SettingsSubNavigator
