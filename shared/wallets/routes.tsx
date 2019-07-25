import {isMobile} from '../constants/platform'
import * as Kb from '../common-adapters'
import * as React from 'react'
import {createNavigator, StackRouter, SceneView} from '@react-navigation/core'
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
import WalletOnboarding from './onboarding/container'
import WhatIsStellarModal from './what-is-stellar-modal'
import Airdrop from './airdrop/container'
import Settings from './wallet/settings/container'
import TransactionDetails from './transaction-details/container'
import Wallet from './wallet/container'

const sharedRoutes = {
  airdrop: {getScreen: (): typeof Airdrop => require('./airdrop/container').default, upgraded: true},
  // TODO connect broken
  settings: {
    getScreen: (): typeof Settings => require('./wallet/settings/container').default,
    upgraded: true,
  },
  // TODO connect broken
  transactionDetails: {
    getScreen: (): typeof TransactionDetails => require('./transaction-details/container').default,
    upgraded: true,
  },
}

const walletsSubRoutes = isMobile
  ? {}
  : {
      ...sharedRoutes,
      wallet: {getScreen: (): typeof Wallet => require('./wallet/container').default, upgraded: true},
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
  airdropQualify: {
    getScreen: (): typeof AirdropQualify => require('./airdrop/qualify/container').default,
    upgraded: true,
  },
  createNewAccount: {
    getScreen: (): typeof CreateNewAccount => require('./create-account/container').default,
    upgraded: true,
  },
  keybaseLinkError: {
    getScreen: (): typeof KeybaseLinkError => require('../deeplinks/error').default,
    upgraded: true,
  },
  linkExisting: {
    getScreen: (): typeof LinkExisting => require('./link-existing/container').default,
    upgraded: true,
  },
  reallyRemoveAccount: {
    getScreen: (): typeof ReallyRemoveAccountPopup =>
      require('./wallet/settings/popups').ReallyRemoveAccountPopup,
    upgraded: true,
  },
  receive: {getScreen: (): typeof Receive => require('./receive-modal/container').default, upgraded: true},
  removeAccount: {
    getScreen: (): typeof RemoveAccountPopup => require('./wallet/settings/popups').RemoveAccountPopup,
    upgraded: true,
  },
  renameAccount: {
    getScreen: (): typeof RenameAccountPopup => require('./wallet/settings/popups').RenameAccountPopup,
    upgraded: true,
  },
  sep7Confirm: {
    getScreen: (): typeof Sep7Confirm => require('./sep7-confirm/container').default,
    upgraded: true,
  },
  setDefaultAccount: {
    getScreen: (): typeof SetDefaultAccountPopup =>
      require('./wallet/settings/popups').SetDefaultAccountPopup,
    upgraded: true,
  },
  setInflation: {
    getScreen: (): typeof InflationDestination => require('./wallet/settings/popups').InflationDestination,
    upgraded: true,
  },
  trustline: {getScreen: (): typeof Trustline => require('./trustline/container').default, upgraded: true},
  walletOnboarding: {
    getScreen: (): typeof WalletOnboarding => require('./onboarding/container').default,
    upgraded: true,
  },
  whatIsStellarModal: {
    getScreen: (): typeof WhatIsStellarModal => require('./what-is-stellar-modal').default,
    upgraded: true,
  },
}
