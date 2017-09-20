// @flow
import * as React from 'react'
import {Box, ErrorBoundary} from '../common-adapters'
import GlobalError from './global-errors/container'
import Offline from '../offline'
import TabBar from './tab-bar/container'
import {chatTab, loginTab, profileTab} from '../constants/tabs'
import {connect} from 'react-redux'
import {globalStyles} from '../styles'
import {navigateTo, switchTo} from '../actions/route-tree'
import {getPathProps} from '../route-tree'
import {showUserProfile} from '../actions/profile'

import type {Tab} from '../constants/tabs'
import type {Props} from './nav'
import type {TypedState} from '../constants/reducer'
import type {RouteProps} from '../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

function Nav(props: Props) {
  const visibleScreen = props.routeStack.findLast(r => !r.tags.layerOnTop)
  if (!visibleScreen) {
    throw new Error('no route component to render without layerOnTop tag')
  }
  const layerScreens = props.routeStack.filter(r => r.tags.layerOnTop)
  return (
    <Box style={stylesTabsContainer}>
      {props.routeSelected !== loginTab &&
        <TabBar onTabClick={props.switchTab} selectedTab={props.routeSelected} />}
      <ErrorBoundary>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
          {visibleScreen.component({isActiveRoute: true, shouldRender: true})}
          {layerScreens.map(r => r.leafComponent({isActiveRoute: true, shouldRender: true}))}
        </Box>
      </ErrorBoundary>
      <div id="popupContainer" />
      {![chatTab, loginTab].includes(props.routeSelected) &&
        <Offline reachable={props.reachable} appFocused={props.appFocused} />}
      <GlobalError />
    </Box>
  )
}

const stylesTabsContainer = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _me: state.config.username,
  _routeState: state.routeTree.routeState,
  appFocused: state.config.appFocused,
  reachable: state.gregor.reachability.reachable,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _switchTab: (tab: Tab, isLastProfileMe: ?boolean, me: ?string) => {
    if (tab === chatTab && ownProps.routeSelected === tab) {
      // clicking the chat tab when already selected should do nothing.
      return
    }

    // If we're going to the profile tab, switch to the current user's
    // profile first before switching tabs, if necessary.
    if (tab === profileTab) {
      if (ownProps.routeSelected === tab) {
        // clicking on profile tab when already selected should back out to root profile page
        dispatch(navigateTo([], [profileTab]))
      }
      if (me && !isLastProfileMe) {
        // Add current user to top of profile stack
        dispatch(showUserProfile(me))
      }
      dispatch(switchTo([profileTab]))
      return
    }

    // otherwise, back out to the default route of the tab.
    const action = ownProps.routeSelected === tab ? navigateTo : switchTo
    // $FlowIssue TODO
    dispatch(action(ownProps.routePath.push(tab)))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  // Get route stack for profile tab
  const profilePathProps = getPathProps(stateProps._routeState, [profileTab])
  // Isolate leaf node
  const profileNode =
    (profilePathProps && profilePathProps.size > 0 && profilePathProps.get(profilePathProps.size - 1)) || null
  // Check if either
  // 1. The root of the profile tab is the leaf node or
  // 2. The leaf profile page is the current user
  const isLastProfileMe =
    profileNode &&
    (profileNode.node === profileTab ||
      (profileNode.props && profileNode.props.get('username') === stateProps._me))

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    switchTab: (tab: Tab) => {
      dispatchProps._switchTab(tab, isLastProfileMe, stateProps._me)
    },
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Nav)
