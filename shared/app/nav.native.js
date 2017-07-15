// @flow
import {is, Map} from 'immutable'
import GlobalError from './global-errors/container'
import Offline from '../offline'
import React, {Component} from 'react'
import {compose, lifecycle} from 'recompose'
import TabBar, {tabBarHeight} from './tab-bar/index.render.native'
import {Box, NativeKeyboard, NativeKeyboardAvoidingView} from '../common-adapters/index.native'
import {Dimensions, StatusBar} from 'react-native'
import {NavigationActions} from 'react-navigation'
import CardStackTransitioner from 'react-navigation/src/views/CardStackTransitioner'
import {chatTab, loginTab, profileTab, folderTab, settingsTab} from '../constants/tabs'
import {connect} from 'react-redux'
import {globalColors, globalStyles, statusBarHeight} from '../styles/index.native'
import {isAndroid, isIOS} from '../constants/platform'
import {navigateTo, navigateUp, switchTo} from '../actions/route-tree'

import type {Props} from './nav'
import type {TypedState} from '../constants/reducer'
import type {Tab} from '../constants/tabs'
import type {NavigationAction} from 'react-navigation'
import type {RouteProps, RouteRenderStack, RenderRouteResult} from '../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

type CardStackShimProps = {
  mode?: 'modal',
  renderRoute: (route: RenderRouteResult, isActive: boolean) => React$Element<*>,
  onNavigateBack: () => void,
  stack: RouteRenderStack,
  hidden?: boolean,
}

class CardStackShim extends Component<*, CardStackShimProps, *> {
  getScreenOptions = () => ({transitionInteractivityThreshold: 0.9})
  getStateForAction = emptyObj
  getActionForPathAndParams = emptyObj
  getPathAndParamsForState = emptyObj
  getComponentForState = emptyObj

  getComponentForRouteName = () => this.RenderRouteShim

  RenderRouteShim = ({navigation}) => {
    const {route, isActive} = navigation.state.params
    return this.props.renderRoute(route, isActive)
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
            const isActive = !this.props.hidden && index === 0
            return {key: routeName, routeName, params: {route, isActive}}
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
        style={{position: 'absolute', left: this.props.hidden ? -9999 : 0, width: '100%', height: '100%'}}
      />
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

function renderStackRoute(route, isActive) {
  const {underStatusBar, hideStatusBar, showStatusBarDarkContent} = route.tags
  // Skip extra view if no statusbar
  if (hideStatusBar) {
    return route.component({isActive})
  }

  return (
    <Box style={route.tags.underStatusBar ? sceneWrapStyleUnder : sceneWrapStyleOver}>
      <StatusBar
        hidden={hideStatusBar}
        translucent={true}
        backgroundColor="rgba(0, 26, 51, 0.25)"
        barStyle={barStyle({showStatusBarDarkContent, underStatusBar})}
      />
      {route.component({isActive})}
    </Box>
  )
}

const forIOS = ({hideNav, content, tabBar}) => (
  <Box style={flexOne}>
    <NativeKeyboardAvoidingView behavior="padding" style={sceneWrapStyleUnder}>
      {content}
    </NativeKeyboardAvoidingView>
    {!hideNav && tabBar}
  </Box>
)

const forAndroid = ({hideNav, content, tabBar}) => (
  <Box style={flexOne}>
    <Box style={!hideNav ? styleScreenSpaceAndroid : flexOne}>
      {content}
    </Box>
    {!hideNav &&
      <Box style={styleCollapsibleNavAndroid}>
        {tabBar}
      </Box>}
  </Box>
)

const tabIsCached = {
  [profileTab]: true,
  [folderTab]: true,
  [chatTab]: true,
  [settingsTab]: true,
}

class MainNavStack extends Component {
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
      <Box style={{height: '100%'}}>
        {stacks}
        {![chatTab].includes(props.routeSelected)
          ? <Offline key="offline" reachable={props.reachable} appFocused={true} />
          : null}
        <GlobalError key="globalError" />
      </Box>
    )
    const tabBar = (
      <TabBar
        onTabClick={props.switchTab}
        selectedTab={props.routeSelected}
        badgeNumbers={props.navBadges.toJS()}
      />
    )
    const Container = isAndroid ? forAndroid : forIOS
    return <Container hideNav={props.hideNav} content={content} tabBar={tabBar} />
  }
}

function Nav(props: Props) {
  const baseScreens = props.routeStack.filter(r => !r.tags.layerOnTop)
  if (!baseScreens.size) {
    throw new Error('no route component to render without layerOnTop tag')
  }

  const fullscreenPred = r => r.tags.fullscreen
  const mainScreens = baseScreens.takeUntil(fullscreenPred)
  const fullScreens = baseScreens.skipUntil(fullscreenPred).unshift({
    path: ['main'],
    component: () => <MainNavStack {...props} routeStack={mainScreens} />,
    tags: {underStatusBar: true}, // don't pad nav stack (child screens have own padding)
  })

  const shim = (
    <CardStackShim
      stack={fullScreens}
      renderRoute={renderStackRoute}
      onNavigateBack={props.navigateUp}
      mode="modal"
    />
  )
  const layerScreens = props.routeStack.filter(r => r.tags.layerOnTop)
  const layers = layerScreens.map(r => r.leafComponent({isActive: true}))

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

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      const nextPath = nextProps.routeStack.last().path
      const curPath = this.props.routeStack.last().path
      const curTags = this.props.routeStack.last().tags
      if (!nextPath.equals(curPath) && !curTags.keepKeyboardOnLeave) {
        NativeKeyboard.dismiss()
      }
    },
  })
)(Nav)
