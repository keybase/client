// @flow
import React from 'react'
import {Box} from '../common-adapters'
import GlobalError from './global-errors/container'
import Offline from '../offline'
import TabBar from './tab-bar/container'
import {chatTab, loginTab, profileTab} from '../constants/tabs'
import {connect} from 'react-redux'
import {globalStyles} from '../styles'
import {navigateTo, switchTo} from '../actions/route-tree'

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
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {visibleScreen.component({isActiveRoute: true, shouldRender: true})}
        {layerScreens.map(r => r.leafComponent({isActiveRoute: true, shouldRender: true}))}
      </Box>
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
  appFocused: state.config.appFocused,
  reachable: state.gregor.reachability.reachable,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  switchTab: (tab: Tab) => {
    if (tab === chatTab && ownProps.routeSelected === tab) {
      // clicking the chat tab when already selected should do nothing.
      return
    }

    // If we're going to the profile tab, switch to the current user's
    // profile first before switching tabs, if necessary.
    if (tab === profileTab) {
      dispatch(navigateTo([], [profileTab]))
      dispatch(switchTo([profileTab]))
      return
    }

    // otherwise, back out to the default route of the tab.
    const action = ownProps.routeSelected === tab ? navigateTo : switchTo
    // $FlowIssue TODO
    dispatch(action(ownProps.routePath.push(tab)))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(Nav)
