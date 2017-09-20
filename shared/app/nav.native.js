// @flow
import {is, Map} from 'immutable'
import GlobalError from './global-errors/container'
import Offline from '../offline'
import React, {Component} from 'react'
import {compose} from 'recompose'
import {tabBarHeight} from './tab-bar/index.render.native'
import TabBar from './tab-bar/container'
import {
  Box,
  NativeKeyboard,
  NativeKeyboardAvoidingView,
  NativeAnimated,
  NativeStatusBar,
} from '../common-adapters/index.native'
import {NavigationActions} from 'react-navigation'
import CardStackTransitioner from 'react-navigation/src/views/CardStack/CardStackTransitioner'
import {chatTab, loginTab, peopleTab, folderTab, settingsTab} from '../constants/tabs'
import {connect} from 'react-redux'
import {globalColors, globalStyles, statusBarHeight} from '../styles/index.native'
import {isIOS} from '../constants/platform'
import {navigateTo, navigateUp, switchTo} from '../actions/route-tree'
import {showUserProfile} from '../actions/profile'
import {mergeProps} from './nav.shared.js'

import type {Props} from './nav'
import type {TypedState} from '../constants/reducer'
import type {Tab} from '../constants/tabs'
import type {NavigationAction} from 'react-navigation'
import type {RouteProps, RouteRenderStack, RenderRouteResult} from '../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

type CardStackShimProps = {
  mode?: 'modal',
  renderRoute: (route: RenderRouteResult, isActiveRoute: boolean, shouldRender: boolean) => any,
  onNavigateBack: () => void,
  stack: RouteRenderStack,
  hidden?: boolean,
}

class CardStackShim extends Component<CardStackShimProps, *> {
  static defaultProps: *
  getScreenOptions = () => ({})
  getStateForAction = emptyObj
  getActionForPathAndParams = emptyObj
  getPathAndParamsForState = emptyObj
  getComponentForState = emptyObj

  getComponentForRouteName = () => this.RenderRouteShim

  RenderRouteShim = ({navigation}) => {
    const {route, isActiveRoute, shouldRender} = navigation.state.params
    return this.props.renderRoute(route, isActiveRoute, shouldRender)
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
          .map((route, index) => {
            const routeName = route.path.join('/')
            // Immutable.Stack indexes go from N-1(top/front)...0(bottom/back)
            // The bottom/back item of the stack is our top (active) screen
            const isActiveRoute = !this.props.hidden && index === 0
            const shouldRender = !this.props.hidden && (index === 0 || index === 1)
            return {key: routeName, routeName, params: {route, isActiveRoute, shouldRender}}
          })
          .toArray(),
      },
      dispatch: this._dispatchShim,
      navigate: nop,
      goBack: nop,
      setParams: nop,
    }

    return (
      <CardStackTransitioner
        navigation={navigation}
        router={this}
        headerMode="none"
        mode={this.props.mode}
        style={this.props.hidden ? _hiddenTransitionerStyle : undefined}
      />
    )
  }
}

const _hiddenTransitionerStyle = {position: 'absolute', left: -9999, width: '100%', height: '100%'}

const nop = () => {}
const emptyObj = () => ({})

const barStyle = (showStatusBarDarkContent, underStatusBar) => {
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

function renderStackRoute(route, isActiveRoute, shouldRender) {
  const {underStatusBar, hideStatusBar, showStatusBarDarkContent} = route.tags

  return (
    <Box style={route.tags.underStatusBar ? sceneWrapStyleUnder : sceneWrapStyleOver}>
      <NativeStatusBar
        hidden={hideStatusBar}
        translucent={true}
        backgroundColor="rgba(0, 26, 51, 0.25)"
        barStyle={barStyle(showStatusBarDarkContent, underStatusBar)}
      />
      {route.component({isActiveRoute, shouldRender})}
    </Box>
  )
}

const tabIsCached = {
  [peopleTab]: true,
  [folderTab]: true,
  [chatTab]: true,
  [settingsTab]: true,
}

class MainNavStack extends Component<any, any> {
  state = {
    stackCache: Map(),
  }

  componentWillReceiveProps() {
    const {routeSelected, routeStack} = this.props
    if (tabIsCached.hasOwnProperty(routeSelected)) {
      this.setState(({stackCache}) => ({stackCache: stackCache.set(routeSelected, routeStack)}))
    }
  }

  render() {
    const props = this.props
    const {stackCache} = this.state

    const stacks = stackCache
      .set(props.routeSelected, props.routeStack)
      .map((stack, key) => (
        <CardStackShim
          key={key}
          hidden={key !== props.routeSelected}
          stack={stack}
          renderRoute={renderStackRoute}
          onNavigateBack={props.navigateUp}
        />
      ))
      .toArray()

    const content = (
      <Box style={globalStyles.flexGrow}>
        {stacks}
        {![chatTab].includes(props.routeSelected)
          ? <Offline key="offline" reachable={props.reachable} appFocused={true} />
          : null}
        <GlobalError key="globalError" />
        <AnimatedTabBar show={!props.hideNav}>
          <TabBar onTabClick={props.switchTab} selectedTab={props.routeSelected} />
        </AnimatedTabBar>
      </Box>
    )
    return (
      <Box style={globalStyles.fullHeight}>
        <NativeKeyboardAvoidingView style={_keyboardStyle} behavior={isIOS ? 'padding' : undefined}>
          {content}
        </NativeKeyboardAvoidingView>
      </Box>
    )
  }
}

// TODO glamour
const _keyboardStyle = {
  ...globalStyles.fillAbsolute,
  backgroundColor: globalColors.white,
}

type AnimatedTabBarProps = {
  show: boolean,
  children: any,
}

class AnimatedTabBar extends Component<AnimatedTabBarProps, {offset: any}> {
  state: {offset: any}

  constructor(props: AnimatedTabBarProps) {
    super(props)

    this.state = {
      offset: new NativeAnimated.Value(props.show ? tabBarHeight : 0),
    }
  }

  componentWillReceiveProps(nextProps: AnimatedTabBarProps) {
    if (!isIOS) return
    if (this.props.show !== nextProps.show) {
      NativeAnimated.timing(this.state.offset, {
        duration: 200,
        toValue: nextProps.show ? tabBarHeight : 0,
      }).start()
    }
  }

  render() {
    if (isIOS) {
      return (
        <NativeAnimated.View
          style={{
            maxHeight: this.state.offset,
          }}
        >
          {this.props.children}
        </NativeAnimated.View>
      )
    } else {
      return (
        <Box style={this.props.show ? _tabBarHeightBar : _tabBarHeightZero}>
          {this.props.children}
        </Box>
      )
    }
  }
}

const _tabBarHeightBar = {
  height: tabBarHeight,
}
const _tabBarHeightZero = {
  height: 0,
}

class Nav extends Component<Props, {keyboardShowing: boolean}> {
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
      component: () => (
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
    const layers = layerScreens.map(r => r.leafComponent({isActiveRoute: true, shouldRender: true}))

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
  ...globalStyles.fullHeight,
  backgroundColor: globalColors.white,
}

const sceneWrapStyleOver = {
  ...sceneWrapStyleUnder,
  paddingTop: statusBarHeight,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _me: state.config.username,
  dumbFullscreen: state.dev.debugConfig.dumbFullscreen,
  hideNav: ownProps.routeSelected === loginTab,
  reachable: state.gregor.reachability.reachable,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  navigateUp: () => dispatch(navigateUp()),
  _switchTab: (tab: Tab, me: ?string) => {
    if (tab === chatTab && ownProps.routeSelected === tab) {
      dispatch(navigateTo(ownProps.routePath.push(tab)))
      return
    }

    // If we're going to the people tab, switch to the current user's
    // profile first before switching tabs, if necessary.
    if (tab === peopleTab) {
      if (ownProps.routeSelected === tab) {
        // clicking on profile tab when already selected should back out to root profile page
        dispatch(navigateTo([], [peopleTab]))
      }
      dispatch(showUserProfile(me))
      dispatch(switchTo([peopleTab]))
      return
    }

    const action = ownProps.routeSelected === tab ? navigateTo : switchTo
    // $FlowIssue TODO fix this
    dispatch(action(ownProps.routePath.push(tab)))
  },
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(Nav)
