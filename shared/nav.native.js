// @flow
import GlobalError from './global-errors/container'
import Offline from './offline'
import React, {Component} from 'react'
import TabBar, {tabBarHeight} from './tab-bar/index.render.native'
import {Box, NativeKeyboardAvoidingView} from './common-adapters/index.native'
import {Dimensions, StatusBar} from 'react-native'
import {CardStack, NavigationActions} from 'react-navigation'
import {chatTab, loginTab} from './constants/tabs'
import {connect} from 'react-redux'
import {globalColors, globalStyles, statusBarHeight} from './styles/index.native'
import {isAndroid, isIOS} from './constants/platform'
import {navigateTo, navigateUp, switchTo} from './actions/route-tree'

import type {Props} from './nav'
import type {TypedState} from './constants/reducer'
import type {Tab} from './constants/tabs'
import type {NavigationAction} from 'react-navigation'
import type {RouteProps} from './route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

class CardStackShim extends Component {
  getScreenConfig = () => null

  getComponentForRouteName = () => this.RenderRouteShim

  RenderRouteShim = ({navigation}) => {
    const route = navigation.state.params
    return this.props.renderRoute(route)
  }

  _dispatchShim = (action: NavigationAction) => {
    if (action.type === NavigationActions.BACK) {
      this.props.onNavigateBack()
    }
  }

  render () {
    const stack = this.props.stack

    const navigation = {
      state: {
        index: stack.size - 1,
        routes: stack.map(route => {
          const routeName = route.path.join('/')
          return {key: routeName, routeName, params: route}
        }).toArray(),
      },
      dispatch: this._dispatchShim,
    }

    return (
      <CardStack
        navigation={navigation}
        router={this}
        headerMode='none'
        mode={this.props.mode}
      />
    )
  }
}

function renderMainStackRoute (route) {
  const {underStatusBar, hideStatusBar} = route.tags
  return (
    <Box style={route.tags.underStatusBar ? sceneWrapStyleUnder : sceneWrapStyleOver}>
      <StatusBar
        hidden={hideStatusBar}
        translucent={true}
        backgroundColor='rgba(0, 26, 51, 0.25)'
        barStyle={!underStatusBar && isIOS ? 'dark-content' : 'light-content'}
      />
      {route.component}
    </Box>
  )
}

const forIOS = ({hideNav, shim, tabBar}) => (
  <Box style={flexOne}>
    <NativeKeyboardAvoidingView behavior={'padding'} style={sceneWrapStyleUnder}>
      {shim}
    </NativeKeyboardAvoidingView>
    {!hideNav && tabBar}
  </Box>
)

const forAndroid = ({hideNav, shim, tabBar}) => (
  <Box style={flexOne}>
    <Box style={!hideNav ? styleScreenSpaceAndroid : flexOne}>
      {shim}
    </Box>
    {!hideNav &&
      <Box style={styleCollapsibleNavAndroid}>
        {tabBar}
      </Box>}
  </Box>
)

function MainNavStack (props: Props) {
  const screens = props.routeStack
  const shim = (
    <Box style={flexOne}>
      <CardStackShim
        key={props.routeSelected}
        stack={screens}
        renderRoute={renderMainStackRoute}
        onNavigateBack={props.navigateUp}
      />
      {![chatTab].includes(props.routeSelected) && <Offline reachability={props.reachability} appFocused={true} />}
      <GlobalError />
    </Box>
  )

  const tabBar = <TabBar
    onTabClick={props.switchTab}
    selectedTab={props.routeSelected}
    username={props.username}
    badgeNumbers={props.navBadges.toJS()}
  />

  const Container = isAndroid ? forAndroid : forIOS
  return <Container hideNav={props.hideNav} shim={shim} tabBar={tabBar} />
}

function renderFullScreenStackRoute (route) {
  return (
    <Box style={globalStyles.fillAbsolute}>
      {route.component}
    </Box>
  )
}

function Nav (props: Props) {
  const baseScreens = props.routeStack.filter(r => !r.tags.layerOnTop)
  if (!baseScreens.size) {
    throw new Error('no route component to render without layerOnTop tag')
  }

  const fullscreenPred = r => r.tags.fullscreen
  const mainScreens = baseScreens.takeUntil(fullscreenPred)
  const fullScreens = baseScreens.skipUntil(fullscreenPred)
    .unshift({
      path: ['main'],
      component: <MainNavStack {...props} routeStack={mainScreens} />,
      tags: {},
    })

  const layerScreens = props.routeStack.filter(r => r.tags.layerOnTop)

  return (
    <Box style={globalStyles.fillAbsolute}>
      <CardStackShim
        stack={fullScreens}
        renderRoute={renderFullScreenStackRoute}
        onNavigateBack={props.navigateUp}
        mode='modal'
      />
      {layerScreens.map(r => r.leafComponent)}
    </Box>
  )
}

const sceneWrapStyleUnder = {
  backgroundColor: globalColors.white,
  flex: 1,
}

const sceneWrapStyleOver = {
  backgroundColor: globalColors.white,
  flex: 1,
  paddingTop: statusBarHeight,
}

const styleScreenSpaceAndroid = {
  flex: -1,
  height: Dimensions.get('window').height - tabBarHeight,
}

const styleCollapsibleNavAndroid = {
  flexShrink: 999999,
}

const flexOne = {
  flex: 1,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  dumbFullscreen: state.dev.debugConfig.dumbFullscreen,
  hideNav: ownProps.routeSelected === loginTab,
  navBadges: state.notifications.get('navBadges'),
  reachability: state.gregor.reachability,
  username: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  navigateUp: () => dispatch(navigateUp()),
  switchTab: (tab: Tab) => {
    if (tab === chatTab && ownProps.routeSelected === tab) {
      dispatch(navigateTo(ownProps.routePath.push(tab)))
      return
    }

    const action = ownProps.routeSelected === tab ? navigateTo : switchTo
    // $FlowIssue TODO fix this
    dispatch(action(ownProps.routePath.push(tab)))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(Nav)
