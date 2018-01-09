// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import People from './container'
import profileRoutes from '../profile/routes'

const peopleRoute = makeRouteDefNode({
  ...profileRoutes.toObject(),
  component: People,
  tags: makeLeafTags({title: 'People'}),
})

export default peopleRoute
