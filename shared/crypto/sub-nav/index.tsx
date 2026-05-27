import * as React from 'react'
import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as Common from '@/router-v2/common'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import NavRow from './nav-row'
import {
  useNavigationBuilder,
  TabRouter,
  createNavigatorFactory,
} from '@react-navigation/core'
import type {TypedNavigator, NavigatorTypeBagBase} from '@react-navigation/native'
import {routeMapToScreenElements} from '@/router-v2/routes'
import {makeLayout} from '@/router-v2/screen-layout'
import type {RouteDef, GetOptionsParams} from '@/constants/types/router'
import {defineRouteMap} from '@/constants/types/router'
import LeftNav from './left-nav.desktop'

const cryptoSubRoutes = defineRouteMap({
  [Crypto.decryptTab]: {
    screen: React.lazy(async () => {
      const {DecryptIO} = await import('../decrypt')
      return {default: DecryptIO}
    }),
  },
  [Crypto.encryptTab]: {
    screen: React.lazy(async () => {
      const {EncryptIO} = await import('../encrypt')
      return {default: EncryptIO}
    }),
  },
  [Crypto.signTab]: {
    screen: React.lazy(async () => {
      const {SignIO} = await import('../sign')
      return {default: SignIO}
    }),
  },
  [Crypto.verifyTab]: {
    screen: React.lazy(async () => {
      const {VerifyIO} = await import('../verify')
      return {default: VerifyIO}
    }),
  },
})

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
  const onSelectTab = Common.useSubnavTabAction(navigation, state)

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.nav}>
          <LeftNav onClick={onSelectTab} selected={selectedTab} />
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

type NavType = NavigatorTypeBagBase & {
  ParamList: {
    [key in keyof typeof cryptoSubRoutes]: {}
  }
}

const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as unknown as () => TypedNavigator<NavType>
const TabNavigator = createLeftTabNavigator()
const makeOptions = (rd: RouteDef) => {
  return ({route, navigation}: GetOptionsParams) => {
    const no = rd.getOptions
    const opt = typeof no === 'function' ? no({navigation, route}) : no
    return {...opt}
  }
}
const cryptoScreens = routeMapToScreenElements(
  cryptoSubRoutes,
  TabNavigator.Screen,
  makeLayout,
  makeOptions,
  false,
  false,
  false
)
const DesktopCryptoSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={Crypto.encryptTab} backBehavior="none">
    {cryptoScreens}
  </TabNavigator.Navigator>
)

const NativeCryptoSubNav = () => {
  const {navigate} = C.useNav()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="tiny" style={styles.container} testID={TestIDs.CRYPTO_INPUT}>
      {Crypto.Tabs.map(t => (
        <NavRow
          key={t.tab}
          tab={t.tab}
          title={t.title}
          illustration={t.illustration}
          description={t.description}
          onClick={() => navigate(t.tab)}
        />
      ))}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: {backgroundColor: Kb.Styles.globalColors.white},
      container: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.xsmall,
      },
      nav: {width: 180},
    }) as const
)

export default isMobile ? NativeCryptoSubNav : DesktopCryptoSubNavigator
