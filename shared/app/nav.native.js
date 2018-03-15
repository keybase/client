// @flow
import CardStackTransitioner from 'react-navigation/src/views/CardStack/CardStackTransitioner'
import GlobalError from './global-errors/container'
import Offline from '../offline/container'
import React, {Component} from 'react'
import {type EmitterListener} from 'react-native'
import TabBar from './tab-bar/container'
import {
  Box,
  NativeKeyboard,
  NativeKeyboardAvoidingView,
  NativeAnimated,
  NativeStatusBar,
} from '../common-adapters/index.native'
import {NavigationActions, type NavigationAction} from 'react-navigation'
import {chatTab, loginTab, peopleTab, folderTab, settingsTab} from '../constants/tabs'
import {compose} from 'recompose'
import {connect, type TypedState} from '../util/container'
import {globalColors, globalStyles, statusBarHeight, styleSheetCreate} from '../styles'
import {addSizeListener} from '../styles/status-bar'
import * as I from 'immutable'
import {isIOS, isIPhoneX} from '../constants/platform'
import {navigateUp} from '../actions/route-tree'
import {tabBarHeight} from './tab-bar/index.render.native'
import {type Props, type OwnProps} from './nav'
import {type RouteRenderStack, type RenderRouteResult} from '../route-tree/render-route'
import {makeLeafTags} from '../route-tree'

type CardStackShimProps = {
  mode?: 'modal',
  renderRoute: (route: RenderRouteResult, shouldRender: boolean) => any,
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
      backgroundColor: globalColors.fastBlank,
    },
  })

  render() {
    const stack = this.props.stack

    const navigation = {
      state: {
        index: stack.size - 1,
        routes: stack
          .map((route, index) => {
            const routeName = route.path.join('/')
            // The bottom/back item of the stack is our top (active) screen
            const shouldRender = !this.props.hidden && (index === stack.size - 1 || index === stack.size - 2)
            return {key: routeName, routeName, params: {route, shouldRender}}
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
        style={this.props.hidden ? styles.hiddenTransitioner : undefined}
        cardStyle={{backgroundColor: globalColors.fastBlank}}
        transitionConfig={this._transitionConfig}
      />
    )
  }
}

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

function renderStackRoute(route, shouldRender) {
  const {underStatusBar, showStatusBarDarkContent, hideStatusBar, root} = route.tags || {}

  let style
  if (root) {
    style = styles.sceneWrapStyleNoStatusBarPadding
  } else {
    style =
      route.tags && route.tags.underStatusBar
        ? styles.sceneWrapStyleNoStatusBarPadding
        : styles.sceneWrapStyleWithStatusBarPadding
  }

  return (
    <Box style={style}>
      {!isIPhoneX && (
        <NativeStatusBar
          hidden={hideStatusBar && !isIPhoneX}
          translucent={true}
          backgroundColor="rgba(0, 26, 51, 0.25)"
          barStyle={barStyle(showStatusBarDarkContent, underStatusBar)}
        />
      )}
      {route.component({shouldRender})}
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
  _listener: EmitterListener
  state = {
    stackCache: I.Map(),
    verticalOffset: 0,
  }

  componentWillMount() {
    this._listener = addSizeListener(this.statusBarListener)
  }

  componentWillUnmount() {
    this._listener && this._listener.remove()
  }

  statusBarListener = (frameData: any) => {
    // the iPhone X has default status bar height of 45px
    // and it doesn't increase in height like earlier devices.
    // (so this should always be 0 on an iPhone X, but this should still
    // be correct if it expands)
    this.setState({verticalOffset: frameData.height - (isIPhoneX ? 45 : 20)})
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
      <Box style={styles.content}>
        {stacks}
        {![chatTab].includes(props.routeSelected) ? <Offline key="offline" /> : null}
        <GlobalError key="globalError" />
        <AnimatedTabBar show={!props.hideNav}>
          <TabBar routeSelected={props.routeSelected} routePath={props.routePath} />
        </AnimatedTabBar>
      </Box>
    )
    return (
      <Box style={styles.container}>
        <NativeKeyboardAvoidingView
          style={styles.keyboard}
          behavior={isIOS ? 'padding' : undefined}
          /** TODO get rid of this once a better fix exists
           * keyboardVerticalOffset is to work around a bug in KeyboardAvoidingView
           * when the in-call status bar is active. See https://github.com/facebook/react-native/issues/17862
           * We need to account for the extra offset made by the larger in call status bar (on pre-iPhone X devices).
           */
          keyboardVerticalOffset={this.state.verticalOffset}
        >
          {content}
        </NativeKeyboardAvoidingView>
      </Box>
    )
  }
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
        <NativeAnimated.View style={{maxHeight: this.state.offset}}>
          {this.props.children}
        </NativeAnimated.View>
      )
    } else {
      return (
        <Box style={this.props.show ? styles.tabBarHeightBar : styles.tabBarHeightZero}>
          {this.props.children}
        </Box>
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
    const layers = layerScreens.map(r => r.leafComponent({shouldRender: true}))

    return (
      <Box style={styles.shimContainer}>
        {shim}
        {layers}
      </Box>
    )
  }
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _me: state.config.username,
  hideNav: ownProps.routeSelected === loginTab,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  navigateUp: () => dispatch(navigateUp()),
})

const styles = styleSheetCreate({
  container: globalStyles.fullHeight,
  content: globalStyles.flexGrow,
  hiddenTransitioner: {
    height: '100%',
    left: -9999,
    position: 'absolute',
    width: '100%',
  },
  keyboard: {
    ...globalStyles.fillAbsolute,
    backgroundColor: globalColors.fastBlank,
  },
  sceneWrapStyleNoStatusBarPadding: {
    ...globalStyles.fullHeight,
    backgroundColor: globalColors.fastBlank,
  },
  sceneWrapStyleWithStatusBarPadding: {
    ...globalStyles.fullHeight,
    backgroundColor: globalColors.fastBlank,
    paddingTop: isIPhoneX ? 40 : statusBarHeight,
  },
  shimContainer: globalStyles.fillAbsolute,
  tabBarHeightBar: {
    height: tabBarHeight,
  },
  tabBarHeightZero: {
    height: 0,
  },
})

export default compose(connect(mapStateToProps, mapDispatchToProps))(Nav)
