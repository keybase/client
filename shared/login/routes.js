// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import loginRoutes from './login/routes'
import signupRoutes from './signup/routes'
import Forms from './forms'
import Feedback from '../settings/feedback-container'

const routeTree = makeRouteDefNode({
  component: Forms,
  children: {
    feedback: {
      component: Feedback,
      tags: makeLeafTags({hideStatusBar: true, fullscreen: true}),
    },
    // $FlowIssue
    login: loginRoutes,
    signup: signupRoutes,
  },
})

export default routeTree
