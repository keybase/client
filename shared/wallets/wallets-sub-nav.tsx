import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Common from '../router-v2/common'
import * as React from 'react'
import type AccountReloaderType from './common/account-reloader'
import type WalletListType from './wallet-list/container'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import {createStackNavigator} from '@react-navigation/stack'
import {RoutedOnboarding} from './onboarding/container'
import * as Shim from '../router-v2/shim'
import Wallet from './wallet/container'
import * as Container from '../util/container'

// walletsSubRoutes should only be used on desktop + tablet
const walletSubRoutes = {
  ...require('./routes').sharedRoutes,
  wallet: {getScreen: (): typeof Wallet => require('./wallet/container').default},
}

const WalletsAndDetails = () => {
  const AccountReloader = require('./common/account-reloader').default as typeof AccountReloaderType
  const WalletList = require('./wallet-list/container').default as typeof WalletListType
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
    screenOptions,
    initialRouteName,
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
          const no = walletSubRoutes[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({route, navigation}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

const RootStack = createStackNavigator()

const WalletsRootNav = () => {
  const acceptedDisclaimer = Container.useSelector(state => state.wallets.acceptedDisclaimer)
  const {HeaderTitle} = require('./nav-header/container')
  const {HeaderRightActions} = require('./nav-header/container')
  return (
    <RootStack.Navigator>
      {acceptedDisclaimer ? (
        <RootStack.Screen
          name="walletsubnav"
          component={WalletSubNavigator}
          options={{
            ...Common.defaultNavigationOptions,
            headerRightActions: () => <HeaderRightActions />,
            headerTitle: () => <HeaderTitle />,
            ...(Container.isTablet
              ? {
                  headerTitleContainerStyle: {
                    ...Common.defaultNavigationOptions.headerTitleContainerStyle,
                    alignSelf: 'stretch',
                    marginHorizontal: 0,
                    maxWidth: 9999,
                    marginRight: 8,
                  },
                  headerStyle: {height: 60},
                  headerLeftContainerStyle: {maxWidth: 0},
                  headerRightContainerStyle: {maxWidth: 0},
                }
              : {}),
          }}
        />
      ) : (
        <RootStack.Screen
          name="onboarding"
          component={RoutedOnboarding}
          options={{headerTitle: '', header: () => null}}
        />
      )}
    </RootStack.Navigator>
  )
}

WalletsRootNav.navigationOptions = {
  headerTitle: '',
  header: () => null,
}

export default WalletsRootNav
