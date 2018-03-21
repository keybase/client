// @flow
import {makeLeafTags, makeRouteDefNode} from '../route-tree'
import {loginRouteTreeTitle} from './route-constants'
import {loginTab} from '../constants/tabs'
import Nav from './nav'
import loginRoutes from '../login/routes'

// TODO: We have only a single tab, so consider making loginRoutes the
// root.
const loginRouteTree = makeRouteDefNode({
  tags: makeLeafTags({title: loginRouteTreeTitle}),
  children: {
    [loginTab]: loginRoutes,
  },
  containerComponent: Nav,
  defaultSelected: loginTab,
})

export default loginRouteTree
