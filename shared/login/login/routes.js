// @flow
import * as I from 'immutable'
import {makeRouteDefNode, makeLeafTags} from '../../route-tree'
import Login from './container'
import Feedback from '../../settings/feedback-container'
import provisonRoutes from '../../provision/routes'

const addTags = component => ({component, tags: makeLeafTags({underStatusBar: true})})

const recursiveLazyRoutes = I.Seq({
  feedback: addTags(Feedback),
  login: addTags(Login),
  ...provisonRoutes,
})
  .map(routeData =>
    makeRouteDefNode({
      ...routeData,
      children: name => recursiveLazyRoutes.get(name),
    })
  )
  .toMap()

const routeTree = recursiveLazyRoutes.get('login')

export default routeTree
