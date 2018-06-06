// @flow
import {makeRouteDefNode} from '../route-tree'
import {PrivateFolders, PublicFolders, TeamFolders} from './container.desktop'

const routeTree = makeRouteDefNode({
  defaultSelected: 'private',
  children: {
    private: {
      component: PrivateFolders,
      initialState: {showingIgnored: false},
    },
    public: {
      component: PublicFolders,
      initialState: {showingIgnored: false},
    },
    team: {
      component: TeamFolders,
      initialState: {showingIgnored: false},
    },
  },
})

export default routeTree
