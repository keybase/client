// @flow
import * as I from 'immutable'
import * as React from 'react'
import {connect, type RouteProps} from '../util/container'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => {
  const showLoading = state.config.daemonHandshakeState !== 'done'
  const showRelogin = !showLoading && state.config.configuredAccounts.size > 0
  return {showLoading, showRelogin}
}

const _RootLogin = ({showLoading, showRelogin, navigateAppend}) => {
  const JoinOrLogin = require('./join-or-login/container').default
  const Loading = require('./loading/container').default
  const Relogin = require('./relogin/container').default
  if (showLoading) {
    return <Loading navigateAppend={navigateAppend} />
  }
  if (showRelogin) {
    return <Relogin navigateAppend={navigateAppend} />
  }
  return <JoinOrLogin navigateAppend={navigateAppend} />
}

const RootLogin = connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d})
)(_RootLogin)

const addTags = component => ({component, tags: makeLeafTags({hideStatusBar: true})})

const routeTree = () => {
  const provisonRoutes = require('../provision/routes').default
  const signupRoutes = require('./signup/routes').default
  const Feedback = require('../settings/feedback-container').default
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
  return recursiveLazyRoutes.get('login')
}

export default routeTree
