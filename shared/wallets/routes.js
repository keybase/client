// @flow
import * as Constants from '../constants/wallets'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'

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
  } = require('./wallet/settings/popups')
  const SendForm = require('./send-form/container').default
  const QRScan = require('./qr-scan/container').default
  const ConfirmForm = require('./confirm-form/container').default
  const Wallet = require('./wallet/container').default
  const ChooseAsset = require('./send-form/choose-asset/container').default

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
    createNewAccount,
    exportSecretKey: {
      children: {},
      component: ExportSecretKey,
      tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
    },
    linkExisting,
    receive: {
      children: {},
      component: ReceiveModal,
      tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
    },
    [Constants.sendRequestFormRouteKey]: {
      children: {
        [Constants.confirmFormRouteKey]: {
          children: {},
          component: ConfirmForm,
          tags: makeLeafTags({
            layerOnTop: !isMobile,
            renderTopmostOnly: true,
            underNotch: true,
          }),
        },
        createNewAccount,
        linkExisting,
        [Constants.chooseAssetFormRouteKey]: {
          children: {},
          component: ChooseAsset,
          tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
        qrScan: {
          component: QRScan,
          tags: makeLeafTags({layerOnTop: true, underNotch: true}),
        },
      },
      component: SendForm,
      tags: makeLeafTags({
        layerOnTop: !isMobile,
        renderTopmostOnly: true,
        underNotch: true,
      }),
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
              tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
            },
          },
          component: RemoveAccountPopup,
          tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
        renameAccount: {
          children: {},
          component: RenameAccountPopup,
          tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
        setDefaultAccount: {
          children: {},
          component: SetDefaultAccountPopup,
          tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
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
