// @flow
import * as I from 'immutable'
import * as React from 'react'
import Feedback from '../settings/feedback-container'
import JoinOrLogin from './join-or-login/container'
import Loading from './loading/container'
import Relogin from './relogin/container'
import provisonRoutes from '../provision/routes'
import signupRoutes from './signup/routes'
import {connect, type TypedState} from '../util/container'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const mapStateToProps = (state: TypedState) => ({
  showLoading:
    state.config.daemonHandshakeWaiters.size > 0 ||
    (state.config.daemonHandshakeWaiters.size === 0 && state.config.daemonHandshakeFailedReason),
})

const Switcher = ({showLoading, navigateAppend}) =>
  showLoading ? <Loading navigateAppend={navigateAppend} /> : <JoinOrLogin navigateAppend={navigateAppend} />

const LoadingOrJoin = connect(mapStateToProps)(Switcher)

const addTags = component => ({component, tags: makeLeafTags({underStatusBar: true})})

// $FlowIssue
const recursiveLazyRoutes = I.Seq({
  feedback: addTags(Feedback),
  login: addTags(LoadingOrJoin),
  relogin: addTags(Relogin),
  ...provisonRoutes,
  ...signupRoutes,
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
