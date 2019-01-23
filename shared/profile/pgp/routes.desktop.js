// @flow
import {makeRouteDefNode} from '../../route-tree'
import Choice from './choice.desktop'
import Import from './import.desktop'
import Info from './info.desktop'
import Generate from './generate.desktop'
import Finished from './finished.desktop'

const routeTree = makeRouteDefNode({
  children: {
    import: {
      component: Import,
    },
    provideInfo: {
      children: {
        generate: {
          children: {
            finished: {
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
  finished: {getScreen: () => Finished},
  generate: {getScreen: () => Generate},
  import: {getScreen: () => Import},
  pgp: {getScreen: () => Choice},
  provideInfo: {getScreen: () => Info},
}
export default routeTree
