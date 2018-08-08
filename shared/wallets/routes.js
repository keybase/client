// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'
import LinkExisting from './link-existing/container'
import Container from './container'
import ReceiveModal from './receive-modal/container'
import ExportSecretKey from './export-secret-key/container'
import TransactionDetails from './transaction-details/container'
import SettingsPopup from './wallet/settings-popup/container'

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
    settings: {
      component: SettingsPopup,
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
