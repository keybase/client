// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as RouteTree from '../route-tree/render-route'
import GlobalError from './global-errors/container'
import Offline from '../offline/container'
import TabBar from './tab-bar/container'
import {Box, ErrorBoundary} from '../common-adapters'
import {chatTab, loginTab, peopleTab, profileTab, type Tab} from '../constants/tabs'
import {connect, type TypedState, type Dispatch} from '../util/container'
import {globalStyles} from '../styles'
import {navigateTo, switchTo} from '../actions/route-tree'
import {createShowUserProfile} from '../actions/profile-gen'
import {type OwnProps} from './nav'

type Props = {
  layerScreens: I.Stack<RouteTree.RenderRouteResult>,
  switchTab: (tab: Tab) => void,
  visibleScreen: RouteTree.RenderRouteResult,
  routeSelected: Tab,
}

class Nav extends React.PureComponent<Props> {
  render() {
    const {routeSelected, visibleScreen, layerScreens, switchTab} = this.props
    return (
      <ErrorBoundary>
        <Box style={stylesTabsContainer}>
          {routeSelected !== loginTab && <TabBar onTabClick={switchTab} selectedTab={routeSelected} />}
          <ErrorBoundary>
            <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
              {/* We use a fixed key here so we don't remount components like chat. */}
              <visibleScreen.component key="0" isActiveRoute={true} shouldRender={true} />
              {layerScreens.map(r => (
                <r.leafComponent key={r.path.join(':')} isActiveRoute={true} shouldRender={true} />
              ))}
            </Box>
          </ErrorBoundary>
          <ErrorBoundary>
            <div id="popupContainer" />
          </ErrorBoundary>
          {![chatTab, loginTab].includes(routeSelected) && <Offline />}
          <GlobalError />
        </Box>
      </ErrorBoundary>
    )
  }
}

const stylesTabsContainer = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const mapStateToProps = (state: TypedState) => ({
  _username: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _switchTab: (tab: Tab, me: ?string) => {
    if (tab === chatTab && ownProps.routeSelected === tab) {
      // clicking the chat tab when already selected should do nothing.
      return
    }

    // If we're going to the people tab, switch to the current user's
    // people first before switching tabs, if necessary.
    if (tab === peopleTab) {
      if (ownProps.routeSelected === tab) {
        // clicking on people tab when already selected should back out to root people page
        dispatch(navigateTo([], [peopleTab]))
      }
      dispatch(switchTo([peopleTab]))
      return
    }

    // profileTab = self avatar in bottom left corner
    // On click switch to people tab and push current user onto people route stack
    if (tab === profileTab) {
      me && dispatch(createShowUserProfile({username: me}))
      dispatch(switchTo([peopleTab]))
      return
    }

    // otherwise, back out to the default route of the tab.
    const action = ownProps.routeSelected === tab ? navigateTo : switchTo
    dispatch(action(ownProps.routePath.push(tab)))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => {
  const visibleScreen = ownProps.routeStack.findLast(r => !r.tags.layerOnTop)
  if (!visibleScreen) {
    throw new Error('no route component to render without layerOnTop tag')
  }

  const layerScreens = ownProps.routeStack.filter(r => r.tags.layerOnTop)
  return {
    layerScreens,
    routeSelected: ownProps.routeSelected,
    switchTab: (tab: Tab) => dispatchProps._switchTab(tab, stateProps._username),
    visibleScreen,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Nav)
