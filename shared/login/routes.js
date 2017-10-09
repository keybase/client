// @flow
import {makeRouteDefNode} from '../route-tree'
import loginRoutes from './login/routes'
import signupRoutes from './signup/routes'
import Intro from './forms/intro'
import Feedback from '../settings/feedback-container'

const routeTree = makeRouteDefNode({
  component: Intro,
  children: {
    feedback: {
      component: Feedback,
      tags: {hideStatusBar: true, fullscreen: true},
    },
    login: loginRoutes,
    signup: signupRoutes,
  },
})

export default routeTree
