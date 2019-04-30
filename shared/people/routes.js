// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const peopleRoute = () => {
  const profileRoutes = require('../profile/routes').default()
  return makeRouteDefNode({
    ...profileRoutes.toObject(),
    component: require('./container').default,
    tags: makeLeafTags({title: 'People'}),
  })
}

export const newRoutes = {
  peopleRoot: {
    getScreen: () => require('./container').default,
    upgraded: true,
  },
}

export const newModalRoutes = {}
export default peopleRoute
