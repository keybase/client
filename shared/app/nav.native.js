// @flow
import {is} from 'immutable'
import GlobalError from './global-errors/container'
import Offline from '../offline'
import React, {Component} from 'react'
import {compose} from 'recompose'
import TabBar, {tabBarHeight} from './tab-bar/index.render.native'
import {
  Box,
  NativeKeyboard,
  NativeKeyboardAvoidingView,
  NativeAnimated,
} from '../common-adapters/index.native'
import {StatusBar} from 'react-native'
import {NavigationActions} from 'react-navigation'
import CardStackTransitioner from 'react-navigation/src/views/CardStackTransitioner'
import {chatTab, loginTab} from '../constants/tabs'
import {connect} from 'react-redux'
import {globalColors, globalStyles, statusBarHeight} from '../styles/index.native'
import {isIOS} from '../constants/platform'
import {navigateTo, navigateUp, switchTo} from '../actions/route-tree'

import type {Props} from './nav'
import type {TypedState} from '../constants/reducer'
import type {Tab} from '../constants/tabs'
import type {NavigationAction} from 'react-navigation'
import type {RouteProps, RouteRenderStack, RenderRouteResult} from '../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

type CardStackShimProps = {
  mode?: 'modal',
  renderRoute: (route: RenderRouteResult) => React$Element<*>,
  onNavigateBack: () => void,
  stack: RouteRenderStack,
}

class CardStackShim extends Component<*, CardStackShimProps, *> {
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

  shouldComponentUpdate(nextProps: CardStackShimProps) {
    return (
      this.props.mode !== nextProps.mode ||
      this.props.renderRoute !== nextProps.renderRoute ||
      this.props.onNavigateBack !== nextProps.onNavigateBack ||
      !is(this.props.stack, nextProps.stack)
    )
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

  return (
    <Box style={route.tags.underStatusBar ? sceneWrapStyleUnder : sceneWrapStyleOver}>
      <StatusBar
        hidden={hideStatusBar}
        translucent={true}
        backgroundColor="rgba(0, 26, 51, 0.25)"
        barStyle={barStyle({showStatusBarDarkContent, underStatusBar})}
      />
      {route.component}
    </Box>
  )
}

function MainNavStack(props: Props) {
  const screens = props.routeStack
  const shim = [
    <CardStackShim
      key={props.routeSelected}
      stack={screens}
      renderRoute={renderStackRoute}
      onNavigateBack={props.navigateUp}
    />,
    ![chatTab].includes(props.routeSelected) &&
      <Offline key="offline" reachable={props.reachable} appFocused={true} />,
    <GlobalError key="globalError" />,
  ].filter(Boolean)

  return (
    <Box style={globalStyles.fullHeight}>
      <NativeKeyboardAvoidingView
        style={{...globalStyles.fillAbsolute, backgroundColor: globalColors.white}}
        behavior={isIOS ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <Box style={globalStyles.flexGrow}>
          {shim}
        </Box>
        <AnimatedTabBar show={!props.hideNav}>
          <TabBar
            onTabClick={props.switchTab}
            selectedTab={props.routeSelected}
            badgeNumbers={props.navBadges.toJS()}
          />
        </AnimatedTabBar>
      </NativeKeyboardAvoidingView>
    </Box>
  )
}

type AnimatedTabBarProps = {
  show: boolean,
  children: any,
}
class AnimatedTabBar extends Component<void, AnimatedTabBarProps, {offset: any}> {
  state: {offset: any}

  constructor(props: AnimatedTabBarProps) {
    super(props)

    this.state = {
      offset: new NativeAnimated.Value(props.show ? tabBarHeight : 0),
    }
  }

  componentWillReceiveProps(nextProps: AnimatedTabBarProps) {
    if (this.props.show !== nextProps.show) {
      NativeAnimated.timing(this.state.offset, {
        duration: 200,
        toValue: nextProps.show ? tabBarHeight : 0,
      }).start()
    }
  }

  render() {
    return (
      <NativeAnimated.View
        style={{
          maxHeight: this.state.offset,
        }}
      >
        {this.props.children}
      </NativeAnimated.View>
    )
  }
}

class Nav extends Component<void, Props, {keyboardShowing: boolean}> {
  state = {
    keyboardShowing: false,
  }

  _keyboardShowListener = null
  _keyboardHideListener = null

  componentWillMount() {
    this._keyboardShowListener = NativeKeyboard.addListener(
      isIOS ? 'keyboardWillShow' : 'keyboardDidShow',
      () => this.setState({keyboardShowing: true})
    )
    this._keyboardHideListener = NativeKeyboard.addListener(
      isIOS ? 'keyboardWillHide' : 'keyboardDidHide',
      () => this.setState({keyboardShowing: false})
    )
  }

  componentWillUnmount() {
    this._keyboardShowListener && this._keyboardShowListener.remove()
    this._keyboardHideListener && this._keyboardHideListener.remove()

    this._keyboardShowListener = null
    this._keyboardHideListener = null
  }

  componentWillReceiveProps(nextProps: Props) {
    const nextPath = nextProps.routeStack.last().path
    const curPath = this.props.routeStack.last().path
    const curTags = this.props.routeStack.last().tags
    if (!nextPath.equals(curPath) && !curTags.keepKeyboardOnLeave) {
      NativeKeyboard.dismiss()
    }
  }

  render() {
    const baseScreens = this.props.routeStack.filter(r => !r.tags.layerOnTop)
    if (!baseScreens.size) {
      throw new Error('no route component to render without layerOnTop tag')
    }

    const fullscreenPred = r => r.tags.fullscreen
    const mainScreens = baseScreens.takeUntil(fullscreenPred)
    const fullScreens = baseScreens.skipUntil(fullscreenPred).unshift({
      path: ['main'],
      component: (
        <MainNavStack
          {...this.props}
          hideNav={this.props.hideNav || this.state.keyboardShowing}
          routeStack={mainScreens}
        />
      ),
      tags: {underStatusBar: true}, // don't pad nav stack (child screens have own padding)
    })

    const shim = (
      <CardStackShim
        stack={fullScreens}
        renderRoute={renderStackRoute}
        onNavigateBack={this.props.navigateUp}
        mode="modal"
      />
    )
    const layerScreens = this.props.routeStack.filter(r => r.tags.layerOnTop)
    const layers = layerScreens.map(r => r.leafComponent)

    // If we have layers, lets add an extra box, else lets just pass through
    if (layers.count()) {
      return (
        <Box style={globalStyles.fillAbsolute}>
          {shim}
          {layers}
        </Box>
      )
    } else {
      return shim
    }
  }
}

const sceneWrapStyleUnder = {
  backgroundColor: globalColors.white,
  ...globalStyles.fullHeight,
}

const sceneWrapStyleOver = {
  ...sceneWrapStyleUnder,
  paddingTop: statusBarHeight,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  dumbFullscreen: state.dev.debugConfig.dumbFullscreen,
  hideNav: ownProps.routeSelected === loginTab,
  navBadges: state.notifications.get('navBadges'),
  reachable: state.gregor.reachability.reachable,
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

export default compose(connect(mapStateToProps, mapDispatchToProps))(Nav)
