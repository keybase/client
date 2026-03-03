import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Crypto from '@/stores/crypto'
import * as Common from '@/router-v2/common.desktop'
import LeftNav from './left-nav.desktop'
import {
  useNavigationBuilder,
  TabRouter,
  createNavigatorFactory,
  type NavigationContainerRef,
} from '@react-navigation/core'
import type {TypedNavigator, NavigatorTypeBagBase, StaticConfig} from '@react-navigation/native'
import {routeMapToScreenElements} from '@/router-v2/routes'
import {makeLayout} from '@/router-v2/screen-layout.desktop'
import type {RouteDef, GetOptionsParams} from '@/constants/types/router'

/* Desktop SubNav */
const cryptoSubRoutes = {
  [Crypto.decryptTab]: {
    screen: React.lazy(async () => {
      const {DecryptIO} = await import('../operations/decrypt')
      return {default: DecryptIO}
    }),
  },
  [Crypto.encryptTab]: {
    screen: React.lazy(async () => {
      const {EncryptIO} = await import('../operations/encrypt')
      return {default: EncryptIO}
    }),
  },
  [Crypto.signTab]: {
    screen: React.lazy(async () => {
      const {SignIO} = await import('../operations/sign')
      return {default: SignIO}
    }),
  },

  [Crypto.verifyTab]: {
    screen: React.lazy(async () => {
      const {VerifyIO} = await import('../operations/verify')
      return {default: VerifyIO}
    }),
  },
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
    navigation as unknown as NavigationContainerRef<object>,
    state
  )

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

const styles = Kb.Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Kb.Styles.globalColors.white},
  nav: {width: 180},
}))

type NavType = NavigatorTypeBagBase & {
  ParamList: {
    [key in keyof typeof cryptoSubRoutes]: undefined
  }
}

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as () => TypedNavigator<
  NavType,
  StaticConfig<NavigatorTypeBagBase>
>
const TabNavigator = createLeftTabNavigator()
const makeOptions = (rd: RouteDef) => {
  return ({route, navigation}: GetOptionsParams) => {
    const no = rd.getOptions
    const opt = typeof no === 'function' ? no({navigation, route}) : no
    return {...opt}
  }
}
const cryptoScreens = routeMapToScreenElements(cryptoSubRoutes, TabNavigator.Screen, makeLayout, makeOptions, false, false)
const CryptoSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={Crypto.encryptTab} backBehavior="none">
    {cryptoScreens}
  </TabNavigator.Navigator>
)

export default CryptoSubNavigator
