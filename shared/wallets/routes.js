// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import Container from './container'
import ReceiveModal from './receive-modal/container'
import ExportSecretKey from './export-secret-key/container'
import {isMobile} from '../constants/platform'

const routeTree = makeRouteDefNode({
  children: {
    receive: {
      children: {},
      component: ReceiveModal,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    exportSecretKey: {
      children: {},
      component: ExportSecretKey,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
  },
  component: Container,
  defaultSelected: '',
  tags: makeLeafTags({}),
})

export default routeTree
