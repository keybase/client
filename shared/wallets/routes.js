// @flow
import * as Constants from '../constants/wallets'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'
import * as Kb from '../common-adapters'
import * as React from 'react'
import {createNavigator, StackRouter, SceneView} from '@react-navigation/core'
import * as Shim from '../router-v2/shim'

const routeTree = () => {
  const CreateNewAccount = require('./create-account/container').default
  const LinkExisting = require('./link-existing/container').default
  const WalletsAndDetails = require('./wallets-and-details/container').default
  const ReceiveModal = require('./receive-modal/container').default
  const ExportSecretKey = require('./export-secret-key/container').default
  const TransactionDetails = require('./transaction-details/container').default
  const AccountSettings = require('./wallet/settings/container').default
  const {
    SetDefaultAccountPopup,
    RemoveAccountPopup,
    ReallyRemoveAccountPopup,
    RenameAccountPopup,
    InflationDestination,
  } = require('./wallet/settings/popups')
  const Wallet = require('./wallet/container').default
  const Airdrop = require('./airdrop/container').default
  const AirdropQualify = require('./airdrop/qualify/container').default

  const createNewAccount = {
    children: {},
    component: CreateNewAccount,
    tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
  }

  const linkExisting = {
    children: {},
    component: LinkExisting,
    tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
  }

  const walletChildren = {
    airdrop: {
      children: {
        airdropQualify: {
          component: AirdropQualify,
          tags: makeLeafTags({layerOnTop: true}),
        },
      },
      component: Airdrop,
    },
    createNewAccount,
    exportSecretKey: {
      children: {},
      component: ExportSecretKey,
      tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile, renderTopmostOnly: true}),
    },
    linkExisting,
    receive: {
      children: {},
      component: ReceiveModal,
      tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile, renderTopmostOnly: true}),
    },
    [Constants.sendRequestFormRouteKey]: require('./routes-send-request-form').default(),
    settings: {
      children: {
        createNewAccount,
        linkExisting,
        removeAccount: {
          children: {
            reallyRemoveAccount: {
              children: {},
              component: ReallyRemoveAccountPopup,
              tags: makeLeafTags({
                fullscreen: isMobile,
                layerOnTop: !isMobile,
                renderTopmostOnly: true,
                underNotch: true,
              }),
            },
          },
          component: RemoveAccountPopup,
          tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
        renameAccount: {
          children: {},
          component: RenameAccountPopup,
          tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
        setDefaultAccount: {
          children: {},
          component: SetDefaultAccountPopup,
          tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
        setInflation: {
          children: {},
          component: InflationDestination,
          tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
      },
      component: AccountSettings,
    },
    transactionDetails: {
      children: {
        createNewAccount,
        linkExisting,
      },
      component: TransactionDetails,
    },
  }
  // On mobile we take the user directly to the wallet page, and they
  // navigate by tapping on the wallet name which brings up a
  // switcher. On desktop, we use a wallet list component and we don't
  // have a wallet switcher tied to the name.
  return isMobile
    ? makeRouteDefNode({
        children: walletChildren,
        component: Wallet,
      })
    : makeRouteDefNode({
        children: {
          wallet: {
            children: walletChildren,
            component: Wallet,
          },
        },
        containerComponent: WalletsAndDetails,
        defaultSelected: 'wallet',
      })
}

export default routeTree

const sharedRoutes = {
  airdrop: {getScreen: () => require('./airdrop/container').default},
  settings: {getScreen: () => require('./wallet/settings/container').default},
  transactionDetails: {getScreen: () => require('./transaction-details/container').default},
}

const walletsSubRoutes = isMobile
  ? {}
  : {
      ...sharedRoutes,
      wallet: {getScreen: () => require('./wallet/container').default},
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
        {/* $FlowIssue */}
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
  'tabs.walletsTab': {
    getScreen: () => {
      if (isMobile) {
        return require('./wallet/container').default
      } else {
        const WalletsSubNavigator = createNavigator(
          WalletsSubNav,
          StackRouter(Shim.shim(walletsSubRoutes), {initialRouteName: 'wallet'}),
          {}
        )

        const HeaderTitle = require('./nav-header/container').HeaderTitle

        WalletsSubNavigator.navigationOptions = {
          header: undefined,
          headerTitle: HeaderTitle,
          title: 'Wallet',
        }

        return WalletsSubNavigator
      }
    },
    upgraded: true,
  },
  ...(isMobile
    ? {
        ...sharedRoutes,
      }
    : {}),
}

export const newModalRoutes = {
  ...require('./routes-send-request-form').newModalRoutes,
  airdropQualify: {getScreen: () => require('./airdrop/qualify/container').default},
  createNewAccount: {getScreen: () => require('./create-account/container').default},
  exportSecretKey: {getScreen: () => require('./export-secret-key/container').default},
  linkExisting: {getScreen: () => require('./link-existing/container').default},
  reallyRemoveAccount: {getScreen: () => require('./wallet/settings/popups').ReallyRemoveAccountPopup},
  receive: {getScreen: () => require('./receive-modal/container').default},
  removeAccount: {getScreen: () => require('./wallet/settings/popups').RemoveAccountPopup},
  renameAccount: {getScreen: () => require('./wallet/settings/popups').RenameAccountPopup},
  setDefaultAccount: {getScreen: () => require('./wallet/settings/popups').SetDefaultAccountPopup},
  setInflation: {getScreen: () => require('./wallet/settings/popups').InflationDestination},
}
