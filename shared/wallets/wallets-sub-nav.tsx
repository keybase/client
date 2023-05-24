import * as React from 'react'
import * as Common from '../router-v2/common'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Shim from '../router-v2/shim'
import * as Styles from '../styles'
import {RoutedOnboarding} from './onboarding/container'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {getOptions} from '../router-v2/shim.shared'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import {sharedRoutes} from './routes'
import wallet from './wallet/page'

// walletsSubRoutes should only be used on desktop + tablet
const walletSubRoutes = {
  ...sharedRoutes,
  wallet,
}

const AccountReloader = React.lazy(async () => import('./common/account-reloader'))
const WalletList = React.lazy(async () => import('./wallet-list/container'))

const WalletsAndDetails = () => {
  return (
    <AccountReloader>
      <Kb.Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        noShrink={true}
        style={styles.walletListContainer}
      >
        <WalletList style={{height: '100%'}} />
      </Kb.Box2>
    </AccountReloader>
  )
}

function LeftTabNavigator({initialRouteName, children, screenOptions, backBehavior}) {
  const {state, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    initialRouteName,
    screenOptions,
  })

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.nav}>
          <WalletsAndDetails />
        </Kb.Box2>
        <Kb.BoxGrow>
          {state.routes.map((route, i) => {
            return i === state.index ? (
              <Kb.Box2 key={route.key} direction="vertical" fullHeight={true} fullWidth={true}>
                {descriptors[route.key].render()}
              </Kb.Box2>
            ) : null
          })}
        </Kb.BoxGrow>
      </Kb.Box2>
    </NavigationContent>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: {backgroundColor: Styles.globalColors.white},
      nav: {width: Styles.globalStyles.mediumSubNavWidth},
      walletListContainer: {
        backgroundColor: Styles.globalColors.blueGrey,
        borderStyle: 'solid',
      },
    } as const)
)

const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
const TabNavigator = createLeftTabNavigator()
const shimmed = Shim.shim(walletSubRoutes, false, false)

const WalletSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName="wallet" backBehavior="none">
    {Object.keys(shimmed).map(name => (
      <TabNavigator.Screen
        key={name}
        name={name}
        getComponent={walletSubRoutes[name].getScreen}
        options={({route, navigation}) => {
          const no = getOptions(walletSubRoutes[name])
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

const RootStack = createNativeStackNavigator()

const HeaderTitle = React.lazy(async () => {
  const {HeaderTitle} = await import('./nav-header/container')
  return {default: HeaderTitle}
})
const HeaderRightActions = React.lazy(async () => {
  const {HeaderRightActions} = await import('./nav-header/container')
  return {default: HeaderRightActions}
})

const WalletsRootNav = () => {
  const acceptedDisclaimer = Container.useSelector(state => state.wallets.acceptedDisclaimer)
  return (
    <RootStack.Navigator>
      {acceptedDisclaimer ? (
        <RootStack.Screen
          name="walletsubnav"
          component={WalletSubNavigator}
          options={{
            ...Common.defaultNavigationOptions,
            // @ts-ignore this is used by desktops implementation, TODO better typing / naming
            headerRightActions: () => <HeaderRightActions />,
            ...(Container.isTablet
              ? {
                  headerLeftContainerStyle: {maxWidth: 0},
                  headerRightContainerStyle: {maxWidth: 0},
                  headerStyle: {height: 60},
                  headerTitle: () => (
                    <Common.TabletWrapper>
                      <Kb.Box2 fullWidth={true} direction="vertical">
                        <HeaderTitle />
                      </Kb.Box2>
                    </Common.TabletWrapper>
                  ),
                  headerTitleContainerStyle: {},
                }
              : {
                  headerTitle: () => <HeaderTitle />,
                }),
          }}
        />
      ) : (
        <RootStack.Screen
          name="walletOnboarding"
          component={RoutedOnboarding}
          options={{header: () => null, headerTitle: ''}}
        />
      )}
    </RootStack.Navigator>
  )
}

export default WalletsRootNav
