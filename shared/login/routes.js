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

const mapStateToProps = (state: TypedState) => {
  const showLoading = state.config.daemonHandshakeState !== 'done'
  const showRelogin = !showLoading && state.config.configuredAccounts.size > 0
  return {showLoading, showRelogin}
}

const _RootLogin = ({showLoading, showRelogin, navigateAppend}) => {
  if (showLoading) {
    return <Loading navigateAppend={navigateAppend} />
  }
  if (showRelogin) {
    return <Relogin navigateAppend={navigateAppend} />
  }
  return <JoinOrLogin navigateAppend={navigateAppend} />
}

const RootLogin = connect(mapStateToProps, () => ({}), (s, d, o) => ({...o, ...s, ...d}))(_RootLogin)

const addTags = component => ({component, tags: makeLeafTags({underStatusBar: true})})

const recursiveLazyRoutes = I.Seq({
  feedback: addTags(Feedback),
  login: addTags(RootLogin),
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
