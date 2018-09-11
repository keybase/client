// @flow
import * as I from 'immutable'
import MainPage from './container'
import NewRepo from './new-repo/container'
import DeleteRepo from './delete-repo/container'
import SelectChannel from './select-channel/container'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'

const routeTree = makeRouteDefNode({
  children: {
    deleteRepo: {
      component: DeleteRepo,
    },
    newRepo: {
      component: NewRepo,
    },
    selectChannel: {
      component: SelectChannel,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
  },
  component: MainPage,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Git'}),
})

export default routeTree
