// @flow
import {makeRouteDefNode} from '../../route-tree'
import Choice from './choice.desktop'
import Import from './import.desktop'
import Info from './info.desktop'
import Generate from './generate.desktop'
import Finished from './finished.desktop'

const routeTree = makeRouteDefNode({
  children: {
    profileImport: {
      component: Import,
    },
    profileProvideInfo: {
      children: {
        profileGenerate: {
          children: {
            profileFinished: {
              component: Finished,
            },
          },
          component: Generate,
        },
      },
      component: Info,
    },
  },
  component: Choice,
})

export const newRoutes = {
  profileFinished: {getScreen: () => Finished},
  profileGenerate: {getScreen: () => Generate},
  profileImport: {getScreen: () => Import},
  profilePgp: {getScreen: () => Choice},
  profileProvideInfo: {getScreen: () => Info},
}
export default routeTree
