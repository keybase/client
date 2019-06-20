import {isMobile} from '../constants/platform'
import * as Kb from '../common-adapters'
import * as React from 'react'
import {createNavigator, StackRouter, SceneView} from '@react-navigation/core'
import * as Shim from '../router-v2/shim'

const sharedRoutes = {
  airdrop: {getScreen: () => require('./airdrop/container').default, upgraded: true},
  settings: {getScreen: () => require('./wallet/settings/container').default, upgraded: true},
  transactionDetails: {getScreen: () => require('./transaction-details/container').default, upgraded: true},
}

const walletsSubRoutes = isMobile
  ? {}
  : {
      ...sharedRoutes,
      wallet: {getScreen: () => require('./wallet/container').default, upgraded: true},
    }

class WalletsSubNav extends React.PureComponent<any> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeKey]
    const childNav = descriptor.navigation
    const WalletsAndDetails = require('./wallets-and-details/container').default

    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <WalletsAndDetails>
          <SceneView
            navigation={childNav}
            component={descriptor.getComponent()}
            screenProps={this.props.screenProps}
          />
        </WalletsAndDetails>
      </Kb.Box2>
    )
  }
}

export const newRoutes = {
  walletsRoot: {
    getScreen: () => {
      if (isMobile) {
        return require('./wallet/container').default
      } else {
        const WalletsSubNavigator = createNavigator(
          WalletsSubNav,
          StackRouter(Shim.shim(walletsSubRoutes), {initialRouteName: 'wallet'}),
          {}
        )

        const {HeaderTitle, HeaderRightActions} = require('./nav-header/container')

        WalletsSubNavigator.navigationOptions = {
          header: undefined,
          headerExpandable: true,
          headerRightActions: HeaderRightActions,
          headerTitle: HeaderTitle,
          title: 'Wallet',
        }

        return WalletsSubNavigator
      }
    },
    upgraded: true,
  },
  ...sharedRoutes, // these are valid inside AND outside the subnav
}

export const newModalRoutes = {
  ...require('./routes-send-request-form').newModalRoutes,
  airdropQualify: {getScreen: () => require('./airdrop/qualify/container').default, upgraded: true},
  createNewAccount: {getScreen: () => require('./create-account/container').default, upgraded: true},
  exportSecretKey: {getScreen: () => require('./export-secret-key/container').default, upgraded: true},
  linkExisting: {getScreen: () => require('./link-existing/container').default, upgraded: true},
  reallyRemoveAccount: {
    getScreen: () => require('./wallet/settings/popups').ReallyRemoveAccountPopup,
    upgraded: true,
  },
  receive: {getScreen: () => require('./receive-modal/container').default, upgraded: true},
  removeAccount: {getScreen: () => require('./wallet/settings/popups').RemoveAccountPopup, upgraded: true},
  renameAccount: {getScreen: () => require('./wallet/settings/popups').RenameAccountPopup, upgraded: true},
  setDefaultAccount: {
    getScreen: () => require('./wallet/settings/popups').SetDefaultAccountPopup,
    upgraded: true,
  },
  setInflation: {getScreen: () => require('./wallet/settings/popups').InflationDestination, upgraded: true},
  walletOnboarding: {getScreen: () => require('./onboarding/container').default, upgraded: true},
  whatIsStellarModal: {
    getScreen: () => require('./what-is-stellar-modal').default,
    upgraded: true,
  },
}
