// @flow
import * as I from 'immutable'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'

const routeTree = () =>
  makeRouteDefNode({
    children: {
      deleteRepo: {
        component: require('./delete-repo/container').default,
      },
      newRepo: {
        component: require('./new-repo/container').default,
      },
      selectChannel: {
        component: require('./select-channel/container').default,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
    },
    component: require('./container').default,
    initialState: {expandedSet: I.Set()},
    tags: makeLeafTags({title: 'Git'}),
  })

export default routeTree
