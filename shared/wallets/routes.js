// @flow
import * as Constants from '../constants/wallets'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'
import CreateNewAccount from './create-account/container'
import LinkExisting from './link-existing/container'
import WalletsAndDetails from './wallets-and-details'
import ReceiveModal from './receive-modal/container'
import ExportSecretKey from './export-secret-key/container'
import TransactionDetails from './transaction-details/container'
import AccountSettings from './wallet/settings/container'
import {
  SetDefaultAccountPopup,
  RemoveAccountPopup,
  ReallyRemoveAccountPopup,
  RenameAccountPopup,
} from './wallet/settings/popups'
import SendForm from './send-form/container'
import ConfirmForm from './confirm-form/container'
import Wallet from './wallet/container'
import ChooseAsset from './send-form/choose-asset/container'
import WalletsList from './wallet-list/container'

const createNewAccount = {
  children: {},
  component: CreateNewAccount,
  tags: makeLeafTags({layerOnTop: !isMobile}),
}

const linkExisting = {
  children: {},
  component: LinkExisting,
  tags: makeLeafTags({layerOnTop: !isMobile}),
}

const walletChildren = {
  createNewAccount,
  exportSecretKey: {
    children: {},
    component: ExportSecretKey,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  linkExisting,
  receive: {
    children: {},
    component: ReceiveModal,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  [Constants.sendReceiveFormRouteKey]: {
    children: {
      [Constants.confirmFormRouteKey]: {
        children: {},
        component: ConfirmForm,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      createNewAccount,
      linkExisting,
      [Constants.chooseAssetFormRouteKey]: {
        children: {},
        component: ChooseAsset,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
    },
    component: SendForm,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  settings: {
    children: {
      createNewAccount,
      linkExisting,
      removeAccount: {
        children: {
          reallyRemoveAccount: {
            children: {},
            component: ReallyRemoveAccountPopup,
            tags: makeLeafTags({layerOnTop: !isMobile}),
          },
        },
        component: RemoveAccountPopup,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      renameAccount: {
        children: {},
        component: RenameAccountPopup,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      setDefaultAccount: {
        children: {},
        component: SetDefaultAccountPopup,
        tags: makeLeafTags({layerOnTop: !isMobile}),
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

const routeTree = isMobile
  ? makeRouteDefNode({
      children: {
        wallet: {
          children: walletChildren,
          component: Wallet,
        },
      },
      component: WalletsList,
      tags: makeLeafTags({title: 'Wallets'}),
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

export default routeTree
