// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'
import CreateNewAccount from './create-account/container'
import LinkExisting from './link-existing/container'
import Container from './container'
import ReceiveModal from './receive-modal/container'
import ExportSecretKey from './export-secret-key/container'
import TransactionDetails from './transaction-details/container'
import WalletSettings from './wallet/settings/container'
import SetDefaultAccount from './wallet/settings/set-default/container'
import SendForm from './send-form/container'
import ConfirmForm from './confirm-form/container'

const routeTree = makeRouteDefNode({
  children: {
    createNewAccount: {
      children: {},
      component: CreateNewAccount,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    exportSecretKey: {
      children: {},
      component: ExportSecretKey,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    linkExisting: {
      children: {},
      component: LinkExisting,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    receive: {
      children: {},
      component: ReceiveModal,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    settings: {
      children: {
        setDefaultAccount: {
          children: {},
          component: SetDefaultAccount,
          tags: makeLeafTags({layerOnTop: !isMobile}),
        },
      },
      component: WalletSettings,
    },
    sendReceiveForm: {
      children: {
        confirmForm: {
          children: {},
          component: ConfirmForm,
          tags: makeLeafTags({layerOnTop: !isMobile}),
        },
      },
      component: SendForm,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    transactionDetails: {
      component: TransactionDetails,
    },
  },
  component: Container,
  defaultSelected: '',
  tags: makeLeafTags({}),
})

export default routeTree
