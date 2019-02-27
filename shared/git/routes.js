// @flow
import * as I from 'immutable'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'

const routeTree = () =>
  makeRouteDefNode({
    children: {
      gitDeleteRepo: {component: require('./delete-repo/container').default},
      gitNewRepo: {component: require('./new-repo/container').default},
      gitSelectChannel: {
        component: require('./select-channel/container').default,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
    },
    component: require('./container').default,
    initialState: {expandedSet: I.Set()},
    tags: makeLeafTags({title: 'Git'}),
  })

export default routeTree

export const newRoutes = {
  'settingsTabs.gitTab': {getScreen: () => require('./container').default},
  'tabs.gitTab': {getScreen: () => require('./container').default},
}
export const newModalRoutes = {
  gitDeleteRepo: {getScreen: () => require('./delete-repo/container').default},
  gitNewRepo: {getScreen: () => require('./new-repo/container').default},
  gitSelectChannel: {getScreen: () => require('./select-channel/container').default},
}
