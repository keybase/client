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
  'tabs:peopleTab': {
    getScreen: () => require('./container').default,
    getHeader: () => require('./container').header,
    // navigationOptions: {headerTitle: 'title in route'},
  },
}

export default peopleRoute
