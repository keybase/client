// @flow
import * as I from 'immutable'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as RouteTreeGen from '../actions/route-tree-gen'
import CardStackTransitioner from 'react-navigation/src/views/CardStack/CardStackTransitioner'
import GlobalError from './global-errors/container'
import Offline from '../offline/container'
import React, {Component} from 'react'
import RpcStats from './rpc-stats'
import TabBar from './tab-bar/container'
import type {Props, OwnProps} from './nav.types'
import {NavigationActions, type NavigationAction} from 'react-navigation'
import {addSizeListener} from '../styles/status-bar'
import * as Tabs from '../constants/tabs'
import {connect} from '../util/container'
import {isIOS, isIPhoneX} from '../constants/platform'
import {makeLeafTags} from '../route-tree'
import {tabBarHeight} from './tab-bar/index.native'
import {type RouteRenderStack, type RenderRouteResult} from '../route-tree/render-route'
import {GatewayDest} from 'react-gateway'

type CardStackShimProps = {
  mode: 'modal' | 'card',
  renderRoute: (route: RenderRouteResult, shouldRender: boolean) => any,
  onNavigateBack: () => any,
  stack: RouteRenderStack,
  hidden: boolean,
}

const nop = () => {}
const emptyObj = () => ({})

class CardStackShim extends Component<CardStackShimProps> {
  getScreenOptions = () => ({})
  getStateForAction = emptyObj
  getActionForPathAndParams = emptyObj
  getPathAndParamsForState = emptyObj
  getComponentForState = emptyObj

  getComponentForRouteName = () => this.RenderRouteShim

  RenderRouteShim = ({navigation}) => {
    const {route, shouldRender} = navigation.state.params
    return this.props.renderRoute(route, shouldRender)
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

  _transitionConfig = () => ({
    containerStyle: {
      backgroundColor: Styles.globalColors.fastBlank,
    },
  })

  render() {
    const stack = this.props.stack

    const navigation = {
      dispatch: this._dispatchShim,
      goBack: nop,
      navigate: nop,
      setParams: nop,
      state: {
        index: stack.size - 1,
        routes: stack
          .map((route, index) => {
            const routeName = route.path.join('/')
            // The bottom/back item of the stack is our top (active) screen
            const shouldRender =
              !this.props.hidden && (index === stack.size - 1 || (isIOS && index === stack.size - 2))
            return {key: routeName, params: {route, shouldRender}, routeName}
          })
          .toArray(),
      },
    }

    return (
      <CardStackTransitioner
        navigation={navigation}
        router={this}
        headerMode="none"
        mode={this.props.mode}
        style={this.props.hidden ? styles.hiddenTransitioner : undefined}
        cardStyle={styles.card}
        transitionConfig={this._transitionConfig}
      />
    )
  }
}

const barStyle = showStatusBarDarkContent => {
  // android always uses light-content
  if (!isIOS) {
    return 'light-content'
  }
  // allow an override when underStatusBar is true, but
  // the content being displayed has a light background
  if (showStatusBarDarkContent) {
    return 'dark-content'
  }
  // default to showing dark-content (dark text/icons) when
  // on iOS
  return 'dark-content'
}

function renderStackRoute(route, shouldRender) {
  const {showStatusBarDarkContent, hideStatusBar, root, underNotch} = route.tags || {}
  // We always wrap with a safe top area unless
  // 1. Root view
  // 2. They want to go under the notch
  // 3. Android and they hide the status bar
  const makeSafeAreaOnTop = !root && !underNotch && !(Styles.isAndroid && hideStatusBar)

  return (
    <Kb.NativeView style={styles.routeOuter}>
      {!isIPhoneX && (
        <Kb.NativeStatusBar
          hidden={hideStatusBar}
          translucent={true}
          backgroundColor="rgba(0, 26, 51, 0.25)"
          barStyle={barStyle(showStatusBarDarkContent)}
        />
      )}
      {makeSafeAreaOnTop && <Kb.SafeAreaViewTop />}
      <Kb.BoxGrow>{route.component({shouldRender})}</Kb.BoxGrow>
    </Kb.NativeView>
  )
}

class MainNavStack extends Component<any, {verticalOffset: number}> {
  _listener = null
  _mounted = false
  state = {
    verticalOffset: 0,
  }

  componentDidMount() {
    this._mounted = true
    this._listener = addSizeListener(this.statusBarListener)
  }

  componentWillUnmount() {
    this._mounted = false
    // turns out remove() doesn't guarantee that the callback doesn't happen. This comes from native
    // so there's a race, so we need _mounted to really protect ourself. i could 100% repro statusBarListener being called AFTEr remove() is called :(
    this._listener && this._listener.remove()
  }

  statusBarListener = (frameData: any) => {
    if (frameData.height === 0 && isIPhoneX) {
      // this is a rotation event
      return
    }

    // the iPhone X has default status bar height of 45px
    // and it doesn't increase in height like earlier devices.
    // (so this should always be 0 on an iPhone X, but this should still
    // be correct if it expands)
    if (this._mounted) {
      this.setState({verticalOffset: frameData.height - (isIPhoneX ? 45 : 20)})
    }
  }

  render() {
    const props = this.props

    const stacks = (
      <CardStackShim
        key={props.routeSelected}
        hidden={false}
        mode="card"
        stack={props.routeStack}
        renderRoute={renderStackRoute}
        onNavigateBack={props.navigateUp}
      />
    )

    // if the route is under the status bar keep this at 0 always
    const keyboardVerticalOffset = this.state.verticalOffset

    const content = (
      <Kb.NativeView style={styles.content}>
        {stacks}
        {![
          Tabs.chatTab,
          Tabs.peopleTab,
          Tabs.settingsTab,
          Tabs.gitTab,
          Tabs.devicesTab,
          Tabs.teamsTab,
        ].includes(props.routeSelected) ? (
          <Offline key="offline" />
        ) : null}
        {!props.hideNav && (
          <Kb.NativeSafeAreaView style={props.keyboardShowing ? styles.noTabSafeArea : styles.tabSafeArea}>
            <AnimatedTabBar show={!props.keyboardShowing}>
              <TabBar routeSelected={props.routeSelected} routePath={props.routePath} />
            </AnimatedTabBar>
          </Kb.NativeSafeAreaView>
        )}
      </Kb.NativeView>
    )
    return (
      <Kb.NativeView style={styles.container}>
        <Kb.NativeKeyboardAvoidingView
          style={styles.keyboard}
          behavior={isIOS ? 'padding' : undefined}
          /** TODO get rid of this once a better fix exists
           * keyboardVerticalOffset is to work around a bug in KeyboardAvoidingView
           * when the in-call status bar is active. See https://github.com/facebook/react-native/issues/17862
           * We need to account for the extra offset made by the larger in call status bar (on pre-iPhone X devices).
           */
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {content}
          <GatewayDest
            name="keyboard-avoiding-root"
            component={ViewForGatewayDest}
            pointerEvents="box-none"
            style={styles.gatewayDest}
          />
        </Kb.NativeKeyboardAvoidingView>
      </Kb.NativeView>
    )
  }
}
const ViewForGatewayDest = <T>(props: T) => <Kb.NativeView {...props} />

type AnimatedTabBarProps = {
  show: boolean,
  children: any,
}

class AnimatedTabBar extends Component<AnimatedTabBarProps, {offset: any}> {
  state: {offset: any}

  constructor(props: AnimatedTabBarProps) {
    super(props)

    this.state = {
      offset: new Kb.NativeAnimated.Value(props.show ? tabBarHeight : 0),
    }
  }

  componentDidUpdate(prevProps: AnimatedTabBarProps) {
    if (!isIOS) return null
    if (this.props.show !== prevProps.show) {
      Kb.NativeAnimated.timing(this.state.offset, {
        duration: 200,
        toValue: this.props.show ? tabBarHeight : 0,
      }).start()
    }
  }

  render() {
    if (isIOS) {
      return (
        <Kb.NativeAnimated.View
          style={Styles.collapseStyles([{maxHeight: this.state.offset}, styles.tabBar])}
        >
          {this.props.children}
        </Kb.NativeAnimated.View>
      )
    } else {
      return (
        <Kb.NativeView
          style={Styles.collapseStyles([
            this.props.show ? styles.tabBarHeightBar : styles.tabBarHeightZero,
            styles.tabBar,
          ])}
        >
          {this.props.children}
        </Kb.NativeView>
      )
    }
  }
}

class Nav extends Component<Props, {keyboardShowing: boolean}> {
  state = {
    keyboardShowing: false,
  }

  _keyboardShowListener = null
  _keyboardHideListener = null

  componentDidMount() {
    this._keyboardShowListener = Kb.NativeKeyboard.addListener(
      isIOS ? 'keyboardWillShow' : 'keyboardDidShow',
      () => this.setState({keyboardShowing: true})
    )
    this._keyboardHideListener = Kb.NativeKeyboard.addListener(
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

  componentDidUpdate(prevProps: Props) {
    const nextRS = this.props.routeStack
    const nextLastPath = nextRS ? nextRS.last() : null
    const nextPath = nextLastPath ? nextLastPath.path : I.List()
    const RS = prevProps.routeStack
    const curLastPath = RS ? RS.last() : null
    const curPath = curLastPath ? curLastPath.path : I.List()
    const curTags = curLastPath ? curLastPath.tags : {}
    if (!nextPath.equals(curPath) && (!curTags || !curTags.keepKeyboardOnLeave)) {
      Kb.NativeKeyboard.dismiss()
    }
  }

  render() {
    const baseScreens = this.props.routeStack.filter(r => !r.tags || !r.tags.layerOnTop)
    if (!baseScreens.size) {
      throw new Error('no route component to render without layerOnTop tag')
    }

    const fullscreenPred = r => r.tags && r.tags.fullscreen
    const mainScreens = baseScreens.takeUntil(fullscreenPred)
    const fullScreens: any = baseScreens.skipUntil(fullscreenPred).unshift({
      component: () => (
        <MainNavStack
          {...this.props}
          hideNav={this.props.hideNav}
          keyboardShowing={this.state.keyboardShowing}
          routeStack={mainScreens}
        />
      ),
      path: ['main'],
      tags: makeLeafTags({root: true}), // special case to avoid padding else we'll double pad
    })

    const shim = (
      <CardStackShim
        stack={fullScreens}
        renderRoute={renderStackRoute}
        onNavigateBack={this.props.navigateUp}
        mode="modal"
        hidden={false}
      />
    )
    const layerScreens = this.props.routeStack.filter(r => r.tags && r.tags.layerOnTop)
    const layers = layerScreens.map((r, idx) =>
      r.tags.hideStatusBar ? (
        <React.Fragment key={String(idx)}>
          <Kb.NativeStatusBar hidden={!isIPhoneX} translucent={true} />
          {!r.tags.underNotch && <Kb.SafeAreaViewTop />}
          {r.leafComponent({shouldRender: true})}
        </React.Fragment>
      ) : (
        r.leafComponent({shouldRender: true})
      )
    )

    return (
      <>
        {shim}
        {layers}
        <GlobalError key="globalError" />
        <RpcStats />
      </>
    )
  }
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  _me: state.config.username,
  hideNav: ownProps.routeSelected === Tabs.loginTab,
})

const mapDispatchToProps = dispatch => ({
  navigateUp: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  // MUST spread ownProps as navigateUp overrides the passed in props!!
  ...ownProps,
  hideNav: stateProps.hideNav,
  navigateUp: dispatchProps.navigateUp,
})

const styles = Styles.styleSheetCreate({
  card: {backgroundColor: Styles.globalColors.fastBlank},
  container: {flexGrow: 1, position: 'relative'},
  content: {...Styles.globalStyles.flexGrow},
  gatewayDest: {height: '100%', position: 'absolute', top: 0, width: '100%'},
  hiddenTransitioner: {
    height: '100%',
    left: -9999,
    position: 'absolute',
    width: '100%',
  },
  keyboard: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.fastBlank,
  },
  noTabSafeArea: {backgroundColor: Styles.globalColors.white, flexGrow: 0},
  routeOuter: {height: '100%', position: 'relative'},
  tabBar: {overflow: 'hidden'},
  tabBarHeightBar: {height: tabBarHeight},
  tabBarHeightZero: {height: 0},
  tabSafeArea: {backgroundColor: Styles.globalColors.darkBlue2, flexGrow: 0},
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Nav)
