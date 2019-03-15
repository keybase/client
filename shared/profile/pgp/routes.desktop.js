// @flow
import {makeRouteDefNode} from '../../route-tree'
import Choice from './choice.desktop'
import Import from './import.desktop'
import Info from './info.desktop'
import Generate from './generate.desktop'
import Finished from './finished.desktop'

const routeTree = makeRouteDefNode({
  children: {
    profileImport: {component: Import},
    profileProvideInfo: {
      children: {
        profileGenerate: {
          children: {
            profileFinished: {component: Finished},
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
  profileFinished: {getScreen: () => Finished, upgraded: true},
  profileGenerate: {getScreen: () => Generate, upgraded: true},
  profileImport: {getScreen: () => Import, upgraded: true},
  profilePgp: {getScreen: () => Choice, upgraded: true},
  profileProvideInfo: {getScreen: () => Info, upgraded: true},
}
export default routeTree
