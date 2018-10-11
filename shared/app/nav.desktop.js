// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as RouteTree from '../route-tree/render-route'
import GlobalError from './global-errors/container'
import Offline from '../offline/container'
import TabBar from './tab-bar/container'
import {isDarwin} from '../constants/platform'
import {Box, ErrorBoundary} from '../common-adapters'
import * as Tabs from '../constants/tabs'
import {switchTo} from '../actions/route-tree'
import {connect, type TypedState} from '../util/container'
import {globalStyles} from '../styles'
import RpcStats from './rpc-stats'

type Props = {
  layerScreens: I.Stack<RouteTree.RenderRouteResult>,
  onHotkey: (cmd: string) => void,
  visibleScreen: RouteTree.RenderRouteResult,
  routeSelected: Tabs.Tab,
  routePath: I.List<string>,
}


const hotkeyTabMap = Tabs.desktopTabOrder.reduce((tabMap, tab, index) => {
  tabMap[index + 1] = tab
  return tabMap
}, {})

const hotkeys = Object.keys(hotkeyTabMap).map(key => `${isDarwin ? 'command' : 'ctrl'}+${key}`)

class Nav extends React.Component<Props> {
  render() {
    const {routeSelected, routePath, visibleScreen, layerScreens} = this.props
    return (
      <ErrorBoundary>
        <Box style={stylesTabsContainer}>
          {routeSelected !== Tabs.loginTab && (
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
          {![Tabs.chatTab, Tabs.loginTab].includes(routeSelected) && <Offline />}
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

const mapDispatchToProps = dispatch => ({
  _onHotkey: (cmd: string) => {
    const tab = hotkeyTabMap[cmd.replace(/(command|ctrl)\+/, '')]
    if (tab) {
      dispatch(switchTo([tab]))
    }
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
    onHotkey: dispatchProps._onHotkey,
    routePath: ownProps.routePath,
    routeSelected: ownProps.routeSelected,
    visibleScreen,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Nav)
