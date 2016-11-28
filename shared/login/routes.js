// @flow
import {RouteDefNode} from '../route-tree'
import loginRoutes from './login/routes'
import signupRoutes from './signup/routes'
import Intro from './forms/intro'

const routeTree = new RouteDefNode({
  component: Intro,
  children: {
    login: loginRoutes,
    signup: signupRoutes,
  },
})

export default routeTree
