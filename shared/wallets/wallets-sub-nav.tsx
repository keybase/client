import * as Kb from '../common-adapters'
import {LeftAction} from '../common-adapters/header-hoc'
import * as React from 'react'
import {
  NavigationViewProps,
  createNavigator,
  createSwitchNavigator,
  StackRouter,
  SceneView,
} from '@react-navigation/core'
import {RoutedOnboarding} from './onboarding/container'
import * as Shim from '../router-v2/shim'
import Wallet from './wallet/container'
import * as Container from '../util/container'

// walletsSubRoutes should only be used on desktop + tablet
const walletsSubRoutes = {
  ...require('./routes').sharedRoutes,
  wallet: {getScreen: (): typeof Wallet => require('./wallet/container').default},
}
const noScreenProps = {}

class WalletsSubNav extends React.PureComponent<NavigationViewProps<any>> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeKey]
    const childNav = descriptor.navigation
    const WalletsAndDetails = require('./wallets-and-details').default

    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <WalletsAndDetails>
          <SceneView
            navigation={childNav}
            component={descriptor.getComponent()}
            screenProps={this.props.screenProps || noScreenProps}
          />
        </WalletsAndDetails>
      </Kb.Box2>
    )
  }
}

const WalletsSubNavigator = createNavigator(
  WalletsSubNav,
  StackRouter(Shim.shim(walletsSubRoutes), {initialRouteName: 'wallet'}),
  {}
)
const OnboardingOrWalletsNavigator = createSwitchNavigator(
  {
    onboarding: RoutedOnboarding,
    walletsubnav: WalletsSubNavigator,
  },
  {initialRouteName: 'walletsubnav'}
)

type OnboardingOrWalletsProps = NavigationViewProps<any> & {acceptedDisclaimer: boolean}

class _OnboardingOrWallets extends React.Component<OnboardingOrWalletsProps> {
  static router = OnboardingOrWalletsNavigator.router
  static navigationOptions = ({navigation}) => {
    return {
      header: undefined,
      headerExpandable: true,
      headerLeft: Container.isTablet
        ? hp => {
            // establish if we have anything on the subnav stack, if so allow a pop
            const subNav = hp.scene.route?.index === 1
            const subNavDepth = subNav && (hp.scene.route.routes[1]?.index ?? 0) > 0
            return subNavDepth ? (
              <LeftAction
                badgeNumber={0}
                leftAction="back"
                onLeftAction={navigation.pop}
                customIconColor={hp.tintColor}
              />
            ) : null
          }
        : undefined,
      // index 0 means we're on the onboarding page, so hide the header
      headerMode: navigation.state.index === 0 ? 'none' : undefined,
      headerRightActions: require('./nav-header/container').HeaderRightActions,
      headerTitle: require('./nav-header/container').HeaderTitle,
      headerTitleContainerStyle: {left: 0, right: 16},
      title: 'Wallet',
    }
  }

  componentDidMount() {
    if (!this.props.acceptedDisclaimer) {
      this.props.navigation.navigate('onboarding')
    } else {
      // We might have navigated to onboarding on a previous mount.
      this.props.navigation.navigate('walletsubnav')
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.acceptedDisclaimer === false && this.props.acceptedDisclaimer === true) {
      this.props.navigation.navigate('walletsubnav')
    }
  }

  render() {
    return <OnboardingOrWalletsNavigator {...this.props} />
  }
}
const OnboardingOrWallets = Container.namedConnect(
  state => ({
    acceptedDisclaimer: state.wallets.acceptedDisclaimer,
  }),
  undefined,
  (stateProps, _, ownProps: NavigationViewProps<any>) => ({...stateProps, ...ownProps}),
  'OnboardingOrWallets'
)(_OnboardingOrWallets)

export default OnboardingOrWallets
