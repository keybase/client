// @flow
import {RouteDefNode} from '../../route-tree'
import {ConnectedChoice, ConnectedImport, ConnectedPgpInfo, ConnectedGeneratePgp, ConnectedFinished} from './'

const routeTree = new RouteDefNode({
  component: ConnectedChoice,
  children: {
    import: {
      component: ConnectedImport,
    },
    provideInfo: {
      component: ConnectedPgpInfo,
      children: {
        generate: {
          component: ConnectedGeneratePgp,
          children: {
            finished: {
              component: ConnectedFinished,
            },
          },
        },
      },
    },
  },
})

export default routeTree
