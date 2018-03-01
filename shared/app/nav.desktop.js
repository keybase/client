// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as RouteTree from '../route-tree/render-route'
import GlobalError from './global-errors/container'
import Offline from '../offline/container'
import TabBar from './tab-bar/container'
import {Box, ErrorBoundary} from '../common-adapters'
import {chatTab, loginTab, type Tab} from '../constants/tabs'
import {connect, type TypedState, type Dispatch} from '../util/container'
import {globalStyles} from '../styles'

type Props = {
  layerScreens: I.Stack<RouteTree.RenderRouteResult>,
  visibleScreen: RouteTree.RenderRouteResult,
  routeSelected: Tab,
  routePath: I.List<string>,
}

class Nav extends React.Component<Props> {
  render() {
    const {routeSelected, routePath, visibleScreen, layerScreens} = this.props
    return (
      <ErrorBoundary>
        <Box style={stylesTabsContainer}>
          {routeSelected !== loginTab && <TabBar routeSelected={routeSelected} routePath={routePath} />}
          <ErrorBoundary>
            <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
              {/* We use a fixed key here so we don't remount components like chat. */}
              {visibleScreen.component({key: '0', shouldRender: true})}
              {layerScreens.map(r => r.leafComponent({shouldRender: true}))}
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

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => {
  const visibleScreen = ownProps.routeStack.findLast(r => !r.tags.layerOnTop)
  if (!visibleScreen) {
    throw new Error('no route component to render without layerOnTop tag')
  }

  const layerScreens = ownProps.routeStack.filter(r => r.tags.layerOnTop)
  return {
    layerScreens,
    routePath: ownProps.routePath,
    routeSelected: ownProps.routeSelected,
    visibleScreen,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Nav)
