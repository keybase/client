import * as Common from '../router-v2/common'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Shim from '../router-v2/shim'
import * as Styles from '../styles'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import type AccountReloaderType from './common/account-reloader'
import type Wallet from './wallet/container'
import type WalletListType from './wallet-list/container'
import {RoutedOnboarding} from './onboarding/container'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'

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
          const no = walletSubRoutes[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

const RootStack = createNativeStackNavigator()

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

WalletsRootNav.navigationOptions = {
  header: () => null,
  headerTitle: '',
}

export default WalletsRootNav
