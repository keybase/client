// @flow
import SettingsContainer from './render'
import {connect} from 'react-redux'
import {switchTo} from '../actions/route-tree'

import type {RouteProps} from '../route-tree/render-route'

// $FlowIssue type this connector
export default connect(
  (state, {routeSelected, routeLeafTags}: RouteProps<{}, {}>) => ({
    badgeNumbers: {},  // TODO add badging logic
    selectedTab: routeSelected,
    isModal: routeLeafTags.modal,
  }),
  (dispatch, {routePath}: RouteProps<{}, {}>) => ({
    onTabChange: tab => { dispatch(switchTo(routePath.push(tab))) },
  })
)(SettingsContainer)
