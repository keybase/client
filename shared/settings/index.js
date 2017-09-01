// @flow
import * as React from 'react'
import SettingsContainer from './render'
import pausableConnect from '../util/pausable-connect'
import {switchTo} from '../actions/route-tree'
import {logout} from '../actions/login/creators'

import type {Tab} from '../constants/settings'
import type {TypedState} from '../constants/reducer'
import type {RouteProps} from '../route-tree/render-route'

type StateProps = {
  badgeNumbers: {[key: Tab]: number},
  selectedTab: Tab,
}

const mapStateToProps = (state: TypedState, {routeSelected}: RouteProps<{}, {}>) => ({
  badgeNumbers: {}, // TODO add badging logic
  // TODO: Is there a way to validate that routeSelected is a Tab?
  selectedTab: (routeSelected: any),
})

export type DispatchProps = {
  onLogout: () => void,
  onTabChange: (tab: Tab) => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}: RouteProps<{}, {}>) => ({
  onLogout: () => dispatch(logout()),
  onTabChange: tab => dispatch(switchTo(routePath.push(tab))),
})

type OwnProps = {
  children: React.Node,
  showComingSoon: boolean,
}

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
  }
}

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(SettingsContainer)
