import {isMobile} from '../constants/platform'
import * as Kb from '../common-adapters'
import * as React from 'react'
import {
  NavigationViewProps,
  createNavigator,
  createSwitchNavigator,
  StackRouter,
  SceneView,
} from '@react-navigation/core'
import * as Shim from '../router-v2/shim'
import AirdropQualify from './airdrop/qualify/container'
import CreateNewAccount from './create-account/container'
import LinkExisting from './link-existing/container'
import {
  RenameAccountPopup,
  ReallyRemoveAccountPopup,
  RemoveAccountPopup,
  InflationDestination,
  SetDefaultAccountPopup,
} from './wallet/settings/popups'
import Receive from './receive-modal/container'
import Sep7Confirm from './sep7-confirm/container'
import KeybaseLinkError from '../deeplinks/error'
import Trustline from './trustline/container'
import {RoutedOnboarding} from './onboarding/container'
import WhatIsStellarModal from './what-is-stellar-modal'
import Airdrop from './airdrop/container'
import Settings from './wallet/settings/container'
import TransactionDetails from './transaction-details/container'
import Wallet from './wallet/container'
import * as Container from '../util/container'

const sharedRoutes = {
  airdrop: {getScreen: (): typeof Airdrop => require('./airdrop/container').default},
  // TODO connect broken
  settings: {getScreen: (): typeof Settings => require('./wallet/settings/container').default},
  // TODO connect broken
  transactionDetails: {
    getScreen: (): typeof TransactionDetails => require('./transaction-details/container').default,
  },
}

// walletsSubRoutes should only be used on desktop
const walletsSubRoutes = {
  ...sharedRoutes,
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
      // index 0 means we're on the onboarding page, so hide the header
      headerMode: navigation.state.index === 0 ? 'none' : undefined,
      headerRightActions: require('./nav-header/container').HeaderRightActions,
      headerTitle: require('./nav-header/container').HeaderTitle,
      title: 'Wallet',
    }
  }

  componentDidMount() {
    if (!this.props.acceptedDisclaimer) {
      this.props.navigation.navigate('onboarding')
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

export const newRoutes = {
  walletsRoot: isMobile
    ? {getScreen: () => require('./wallet/container').default}
    : // MUST use screen and not getScreen for subnavs!
      {screen: OnboardingOrWallets},
  ...sharedRoutes, // these are valid inside AND outside the subnav
}

export const newModalRoutes = {
  ...require('./routes-send-request-form').newModalRoutes,
  airdropQualify: {getScreen: (): typeof AirdropQualify => require('./airdrop/qualify/container').default},
  createNewAccount: {getScreen: (): typeof CreateNewAccount => require('./create-account/container').default},
  keybaseLinkError: {getScreen: (): typeof KeybaseLinkError => require('../deeplinks/error').default},
  linkExisting: {getScreen: (): typeof LinkExisting => require('./link-existing/container').default},
  reallyRemoveAccount: {
    getScreen: (): typeof ReallyRemoveAccountPopup =>
      require('./wallet/settings/popups').ReallyRemoveAccountPopup,
  },
  receive: {getScreen: (): typeof Receive => require('./receive-modal/container').default},
  removeAccount: {
    getScreen: (): typeof RemoveAccountPopup => require('./wallet/settings/popups').RemoveAccountPopup,
  },
  renameAccount: {
    getScreen: (): typeof RenameAccountPopup => require('./wallet/settings/popups').RenameAccountPopup,
  },
  sep7Confirm: {getScreen: (): typeof Sep7Confirm => require('./sep7-confirm/container').default},
  setDefaultAccount: {
    getScreen: (): typeof SetDefaultAccountPopup =>
      require('./wallet/settings/popups').SetDefaultAccountPopup,
  },
  setInflation: {
    getScreen: (): typeof InflationDestination => require('./wallet/settings/popups').InflationDestination,
  },
  trustline: {getScreen: (): typeof Trustline => require('./trustline/container').default},
  walletOnboarding: {
    getScreen: (): typeof RoutedOnboarding => require('./onboarding/container').RoutedOnboarding,
  },
  whatIsStellarModal: {
    getScreen: (): typeof WhatIsStellarModal => require('./what-is-stellar-modal').default,
  },
}
