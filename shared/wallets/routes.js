// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {MaybePopupHoc} from '../common-adapters'
import {isMobile} from '../constants/platform'
import LinkExisting from './link-existing/container'
import Container from './container'
import ReceiveModal from './receive-modal/container'
import ExportSecretKey from './export-secret-key/container'

const routeTree = makeRouteDefNode({
  children: {
    exportSecretKey: {
      children: {},
      component: ExportSecretKey,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    linkExisting: {
      children: {},
      component: MaybePopupHoc(isMobile)(LinkExisting),
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    receive: {
      children: {},
      component: ReceiveModal,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
  },
  component: Container,
  defaultSelected: '',
  tags: makeLeafTags({}),
})

export default routeTree
