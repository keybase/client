// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import Container from './container'
import ReceiveModal from './receive-modal/container'

const routeTree = makeRouteDefNode({
  children: {
    receive: {
      component: ReceiveModal,
    },
  },
  component: Container,
  defaultSelected: '',
  tags: makeLeafTags({}),
})

export default routeTree
