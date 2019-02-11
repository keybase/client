// @flow
import {makeLeafTags, makeRouteDefNode} from '../route-tree'
import {loginRouteTreeTitle} from './route-constants'
import {loginTab} from '../constants/tabs'
import Nav from './nav'
import loginRoutes from '../login/routes'

// TODO: We have only a single tab, so consider making loginRoutes the
// root.
const loginRouteTree = makeRouteDefNode({
  children: {
    [loginTab]: loginRoutes,
  },
  containerComponent: Nav,
  defaultSelected: loginTab,
  tags: makeLeafTags({title: loginRouteTreeTitle}),
})

export default loginRouteTree
