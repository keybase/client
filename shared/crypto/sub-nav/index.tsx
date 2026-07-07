import * as React from 'react'
import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as Common from '@/router-v2/common'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import NavRow from './nav-row'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import {routeMapToStaticScreens} from '@/router-v2/routes'
import {makeLayout} from '@/router-v2/screen-layout'
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

// The factory's static-config call signature is hidden by our custom-navigator typing, so
// re-surface it with a cast. Screens come from the same route-map converter the root uses.
const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as unknown as (config: {
  backBehavior: 'none'
  initialRouteName: string
  screens: ReturnType<typeof routeMapToStaticScreens>
}) => {getComponent: () => React.ComponentType}

const DesktopCryptoSubNavigator = createLeftTabNavigator({
  backBehavior: 'none',
  initialRouteName: Crypto.encryptTab,
  screens: routeMapToStaticScreens(cryptoSubRoutes, makeLayout, false, false, false),
}).getComponent()

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
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
        paddingTop: Kb.Styles.globalMargins.xsmall,
      },
      nav: {width: 180},
    }) as const
)

export default isMobile ? NativeCryptoSubNav : DesktopCryptoSubNavigator
