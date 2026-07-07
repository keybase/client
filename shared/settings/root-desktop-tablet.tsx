import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Common from '@/router-v2/common'
import {routeMapToStaticScreens} from '@/router-v2/routes'
import {makeLayout} from '@/router-v2/screen-layout'
import LeftNav from './sub-nav/left-nav'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
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

// The factory's static-config call signature is hidden by our custom-navigator typing, so
// re-surface it with a cast. Screens come from the same route-map converter the root uses.
const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as unknown as (config: {
  backBehavior: 'none'
  initialRouteName: string
  screens: ReturnType<typeof routeMapToStaticScreens>
}) => {getComponent: () => React.ComponentType}

// TODO on ipad this doesn't have a stack navigator so when you go into crypto you get
// a push from the parent stack. If we care just make a generic left nav / right stack
// that the global app / etc could use and put it here also. not worth it now
const SettingsSubNavigator = createLeftTabNavigator({
  backBehavior: 'none',
  initialRouteName: settingsAccountTab,
  screens: routeMapToStaticScreens(settingsDesktopTabRoutes, makeLayout, false, false, false),
}).getComponent()

export default SettingsSubNavigator
