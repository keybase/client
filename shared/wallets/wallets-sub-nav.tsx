import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Common from '../router-v2/common.desktop'
import * as React from 'react'
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

function LeftTabNavigator({initialRouteName, children, screenOptions, backBehavior}) {
  const {state, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    screenOptions,
    initialRouteName,
  })

  const WalletsAndDetails = require('./wallets-and-details').default

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

const styles = Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Styles.globalColors.white},
  nav: {width: Styles.globalStyles.mediumSubNavWidth},
}))

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
  return (
    <RootStack.Navigator>
      {acceptedDisclaimer ? (
        <RootStack.Screen
          name="walletsubnav"
          component={WalletSubNavigator}
          options={{
            ...Common.defaultNavigationOptions,
            headerRightActions: require('./nav-header/container').HeaderRightActions,
            headerTitle: require('./nav-header/container').HeaderTitle,
            headerTitleContainerStyle: {left: 0, right: 16},
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
