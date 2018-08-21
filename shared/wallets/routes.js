// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'
import LinkExisting from './link-existing/container'
import Container from './container'
import ReceiveModal from './receive-modal/container'
import ExportSecretKey from './export-secret-key/container'
import TransactionDetails from './transaction-details/container'
import SendForm from './send-form/container'
import ConfirmForm from './confirm-form/container'

const routeTree = makeRouteDefNode({
  children: {
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
