// @flow
import {makeRouteDefNode} from '../../route-tree'
import {ConnectedChoice, ConnectedImport, ConnectedPgpInfo, ConnectedGeneratePgp, ConnectedFinished} from './'

const routeTree = makeRouteDefNode({
  children: {
    import: {
      component: ConnectedImport,
    },
    provideInfo: {
      children: {
        generate: {
          children: {
            finished: {
              component: ConnectedFinished,
            },
          },
          component: ConnectedGeneratePgp,
        },
      },
      component: ConnectedPgpInfo,
    },
  },
  component: ConnectedChoice,
})

export default routeTree
