// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as RouteTree from '../route-tree/render-route'
import GlobalError from './global-errors/container'
import Offline from '../offline/container'
import TabBar from './tab-bar/container'
import {isDarwin} from '../constants/platform'
import {Box, ErrorBoundary} from '../common-adapters'
import {
  chatTab,
  fsTab,
  loginTab,
  peopleTab,
  teamsTab,
  devicesTab,
  gitTab,
  settingsTab,
  walletsTab,
  type Tab,
} from '../constants/tabs'
import {navigateTo} from '../actions/route-tree'
import {connect, type TypedState, type Dispatch} from '../util/container'
import {globalStyles} from '../styles'
import flags from '../util/feature-flags'
import RpcStats from './rpc-stats'

type Props = {
  layerScreens: I.Stack<RouteTree.RenderRouteResult>,
  onHotkey: (cmd: string) => void,
  visibleScreen: RouteTree.RenderRouteResult,
  routeSelected: Tab,
  routePath: I.List<string>,
}

const hotKeyTabMap: {[string]: Tab} = {
  '1': peopleTab,
  '2': chatTab,
  '3': fsTab,
  '4': teamsTab,
  '5': devicesTab,
  '6': gitTab,
  '7': settingsTab,
}
if (flags.walletsEnabled) {
  hotKeyTabMap['8'] = walletsTab
}

const hotkeys = Object.keys(hotKeyTabMap).map(key => `${isDarwin ? 'command' : 'control'}+${key}`)

class Nav extends React.Component<Props> {
  render() {
    const {routeSelected, routePath, visibleScreen, layerScreens} = this.props
    return (
      <ErrorBoundary>
        <Box style={stylesTabsContainer}>
          {routeSelected !== loginTab && (
            <TabBar
              hotkeys={hotkeys}
              onHotkey={this.props.onHotkey}
              routeSelected={routeSelected}
              routePath={routePath}
            />
          )}
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
        <RpcStats />
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

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onHotkey: (cmd: string) => dispatch(navigateTo([hotKeyTabMap[cmd.replace(/(command|control)\+/, '')]])),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => {
  const visibleScreen = ownProps.routeStack.findLast(r => !r.tags.layerOnTop)
  if (!visibleScreen) {
    throw new Error('no route component to render without layerOnTop tag')
  }

  const layerScreens = ownProps.routeStack.filter(r => r.tags.layerOnTop)
  return {
    layerScreens,
    onHotkey: dispatchProps._onHotkey,
    routePath: ownProps.routePath,
    routeSelected: ownProps.routeSelected,
    visibleScreen,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Nav)
