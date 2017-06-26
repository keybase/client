// @flow
import GlobalError from './global-errors/container'
import Offline from './offline'
import React, {Component} from 'react'
import {compose, lifecycle} from 'recompose'
import TabBar, {tabBarHeight} from './tab-bar/index.render.native'
import {Box, NativeKeyboard, NativeKeyboardAvoidingView} from './common-adapters/index.native'
import {Dimensions, StatusBar} from 'react-native'
import {NavigationActions} from 'react-navigation'
import CardStackTransitioner from 'react-navigation/src/views/CardStackTransitioner'
import {chatTab, loginTab} from './constants/tabs'
import {connect} from 'react-redux'
import {globalColors, globalStyles, statusBarHeight} from './styles/index.native'
import {isAndroid, isIOS} from './constants/platform'
import {navigateTo, navigateUp, switchTo} from './actions/route-tree'
import glamorous from 'glamorous-native'

import type {Props} from './nav'
import type {TypedState} from './constants/reducer'
import type {Tab} from './constants/tabs'
import type {NavigationAction} from 'react-navigation'
import type {RouteProps} from './route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

class CardStackShim extends Component {
  getScreenOptions = () => ({transitionInteractivityThreshold: 0.9})
  getStateForAction = emptyObj
  getActionForPathAndParams = emptyObj
  getPathAndParamsForState = emptyObj
  getComponentForState = emptyObj

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

  render() {
    const stack = this.props.stack

    const navigation = {
      state: {
        index: stack.size - 1,
        routes: stack
          .map(route => {
            const routeName = route.path.join('/')
            return {key: routeName, routeName, params: route}
          })
          .toArray(),
      },
      dispatch: this._dispatchShim,
      navigate: nop,
      goBack: nop,
      setParams: nop,
    }

    return (
      <CardStackTransitioner navigation={navigation} router={this} headerMode="none" mode={this.props.mode} />
    )
  }
}

const nop = () => {}
const emptyObj = () => ({})

const barStyle = ({showStatusBarDarkContent, underStatusBar}) => {
  // android always uses light-content
  if (!isIOS) {
    return 'light-content'
  }
  // allow an override when underStatusBar is true, but
  // the content being displayed has a light background
  if (showStatusBarDarkContent) {
    return 'dark-content'
  }
  // replicates original behaviour of showing light text
  // in the status bar when 'underStatusBar' is set to true
  if (underStatusBar) {
    return 'light-content'
  }
  // default to showing dark-content (dark text/icons) when
  // on iOS
  return 'dark-content'
}

function renderStackRoute(route) {
  const {underStatusBar, hideStatusBar, showStatusBarDarkContent} = route.tags
  const View = glamorous.view(route.tags.underStatusBar ? sceneWrapStyleUnder : sceneWrapStyleOver)
  return (
    <View>
      <StatusBar
        hidden={hideStatusBar}
        translucent={true}
        backgroundColor="rgba(0, 26, 51, 0.25)"
        barStyle={barStyle({showStatusBarDarkContent, underStatusBar})}
      />
      {route.component}
    </View>
  )
}

const Container = isIOS
  ? ({shim, tabBar}) => (
      <Box style={flexOne}>
        <NativeKeyboardAvoidingView behavior="padding" style={sceneWrapStyleUnder}>
          {shim}
        </NativeKeyboardAvoidingView>
      </Box>
    )
  : ({hideNav, shim, tabBar}) => (
      <Box style={flexOne}>
        <Box style={!hideNav ? styleScreenSpaceAndroid : flexOne}>
          {shim}
        </Box>
      </Box>
    )

function MainNavStack({routeStack, routeSelected, navigateUp, reachability, hideNav}) {
  const screens = routeStack
  const shim = (
    <Box style={flexOne}>
      <CardStackShim
        key={routeSelected}
        stack={screens}
        renderRoute={renderStackRoute}
        onNavigateBack={navigateUp}
      />
      {![chatTab].includes(routeSelected) && <Offline reachability={reachability} appFocused={true} />}
      <GlobalError />
    </Box>
  )
  return <Container hideNav={hideNav} shim={shim} />
}

function Nav(props: Props) {
  const baseScreens = props.routeStack.filter(r => !r.tags.layerOnTop)
  if (!baseScreens.size) {
    throw new Error('no route component to render without layerOnTop tag')
  }

  const fullscreenPred = r => r.tags.fullscreen
  const mainScreens = baseScreens.takeUntil(fullscreenPred)
  const fullScreens = baseScreens.skipUntil(fullscreenPred).unshift({
    component: (
      <MainNavStack
        routeStack={mainScreens}
        routeSelected={props.routeSelected}
        navigateUp={props.navigateUp}
        reachability={props.reachability}
      />
    ),
    path: ['main'],
    tags: {underStatusBar: true}, // don't pad nav stack (child screens have own padding)
  })

  const layerScreens = props.routeStack.filter(r => r.tags.layerOnTop)

  return (
    <Box style={globalStyles.fillAbsolute}>
      <CardStackShim
        stack={fullScreens}
        renderRoute={renderStackRoute}
        onNavigateBack={props.navigateUp}
        mode="modal"
      />
      {layerScreens.map(r => r.leafComponent)}
      {!props.hideNav &&
        <Box style={isIOS ? null : styleCollapsibleNavAndroid}>
          <TabBar
            onTabClick={props.switchTab}
            selectedTab={props.routeSelected}
            username={props.username}
            badgeNumbers={props.navBadges.toJS()}
          />
        </Box>}
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
  hideKeyboard: state.config.hideKeyboard,
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

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      const nextPath = nextProps.routeStack.last().path
      const curPath = this.props.routeStack.last().path
      const curTags = this.props.routeStack.last().tags
      if (!nextPath.equals(curPath) && !curTags.keepKeyboardOnLeave) {
        NativeKeyboard.dismiss()
      } else if (this.props.hideKeyboard !== nextProps.hideKeyboard) {
        NativeKeyboard.dismiss()
      }
    },
  })
)(Nav)
