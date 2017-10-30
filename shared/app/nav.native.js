// @flow
import CardStackTransitioner from 'react-navigation/src/views/CardStack/CardStackTransitioner'
import GlobalError from './global-errors/container'
import Offline from '../offline'
import React, {Component} from 'react'
import TabBar from './tab-bar/container'
import {
  Box,
  NativeKeyboard,
  NativeKeyboardAvoidingView,
  NativeAnimated,
  NativeStatusBar,
} from '../common-adapters/index.native'
import {NavigationActions, type NavigationAction} from 'react-navigation'
import {chatTab, loginTab, peopleTab, folderTab, settingsTab, type Tab} from '../constants/tabs'
import {compose} from 'recompose'
import {connect, type TypedState} from '../util/container'
import {globalColors, globalStyles, statusBarHeight} from '../styles/index.native'
import * as I from 'immutable'
import {isIOS, isIPhoneX} from '../constants/platform'
import {navigateTo, navigateUp, switchTo} from '../actions/route-tree'
import {tabBarHeight} from './tab-bar/index.render.native'
import {type Props, type OwnProps} from './nav'
import {type RouteRenderStack, type RenderRouteResult} from '../route-tree/render-route'
import {makeLeafTags} from '../route-tree'

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
      !I.is(this.props.stack, nextProps.stack)
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
            // The bottom/back item of the stack is our top (active) screen
            const isActiveRoute = !this.props.hidden && index === stack.size - 1
            const shouldRender = !this.props.hidden && (index === stack.size - 1 || index === stack.size - 2)
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
  const {underStatusBar, hideStatusBar, showStatusBarDarkContent, root} = route.tags || {}

  let style
  if (root) {
    style = sceneWrapStyleNoStatusBarPadding
  } else {
    style = route.tags && route.tags.underStatusBar
      ? sceneWrapStyleNoStatusBarPadding
      : sceneWrapStyleWithStatusBarPadding
  }

  return (
    <Box style={style}>
      {!isIPhoneX &&
        <NativeStatusBar
          hidden={hideStatusBar && !isIPhoneX}
          translucent={true}
          backgroundColor="rgba(0, 26, 51, 0.25)"
          barStyle={barStyle(showStatusBarDarkContent, underStatusBar)}
        />}
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
    stackCache: I.Map(),
  }

  componentWillReceiveProps() {
    const {routeSelected, routeStack} = this.props
    if (tabIsCached.hasOwnProperty(routeSelected)) {
      this.setState(({stackCache}) => ({stackCache: stackCache.set(routeSelected, routeStack)}))
    }
  }

  _switchTab = tab => {
    this.props.switchTab(tab)
  }

  render() {
    const props = this.props
    const {stackCache} = this.state

    const stacks = stackCache
      .set(props.routeSelected, props.routeStack)
      .toArray()
      .map(([key, stack]) => (
        <CardStackShim
          key={key}
          hidden={key !== props.routeSelected}
          stack={stack}
          renderRoute={renderStackRoute}
          onNavigateBack={props.navigateUp}
        />
      ))

    const content = (
      <Box style={globalStyles.flexGrow}>
        {stacks}
        {![chatTab].includes(props.routeSelected)
          ? <Offline key="offline" reachable={props.reachable} appFocused={true} />
          : null}
        <GlobalError key="globalError" />
        <AnimatedTabBar show={!props.hideNav}>
          <TabBar onTabClick={this._switchTab} selectedTab={props.routeSelected} />
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
    const nextRS = nextProps.routeStack
    const nextLastPath = nextRS ? nextRS.last() : null
    const nextPath = nextLastPath ? nextLastPath.path : I.List()
    const RS = this.props.routeStack
    const curLastPath = RS ? RS.last() : null
    const curPath = curLastPath ? curLastPath.path : I.List()
    const curTags = curLastPath ? curLastPath.tags : {}
    if (!nextPath.equals(curPath) && (!curTags || !curTags.keepKeyboardOnLeave)) {
      NativeKeyboard.dismiss()
    }
  }

  render() {
    const baseScreens = this.props.routeStack.filter(r => !r.tags || !r.tags.layerOnTop)
    if (!baseScreens.size) {
      throw new Error('no route component to render without layerOnTop tag')
    }

    const fullscreenPred = r => r.tags && r.tags.fullscreen
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
      tags: makeLeafTags({root: true}), // special case to avoid padding else we'll double pad
    })

    const shim = (
      <CardStackShim
        stack={fullScreens}
        renderRoute={renderStackRoute}
        onNavigateBack={this.props.navigateUp}
        mode="modal"
      />
    )
    const layerScreens = this.props.routeStack.filter(r => r.tags && r.tags.layerOnTop)
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

const sceneWrapStyleNoStatusBarPadding = {
  ...globalStyles.fullHeight,
  backgroundColor: globalColors.white,
}

const sceneWrapStyleWithStatusBarPadding = {
  ...sceneWrapStyleNoStatusBarPadding,
  paddingTop: isIPhoneX ? 40 : statusBarHeight,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _me: state.config.username,
  hideNav: ownProps.routeSelected === loginTab,
  reachable: state.gregor.reachability.reachable,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  navigateUp: () => dispatch(navigateUp()),
  switchTab: (tab: Tab) => {
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
      dispatch(switchTo([peopleTab]))
      return
    }

    const action = ownProps.routeSelected === tab ? navigateTo : switchTo
    dispatch(action(ownProps.routePath.push(tab)))
  },
})

export default compose(connect(mapStateToProps, mapDispatchToProps))(Nav)
