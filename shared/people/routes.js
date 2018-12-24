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

export default peopleRoute
