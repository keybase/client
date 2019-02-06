// @flow
//
// Notes:
// leaving headerhoc
// default screens have no header
// opt into new split header, MUST set header to undefined in their connector navigatinoOptions
//
//
//
// statusbar handling
// inject old ownprops?
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as React from 'react'
import GlobalError from '../app/global-errors/container'
import Offline from '../offline/container'
import TabBar from './tab-bar/container'
import {
  createNavigator,
  SwitchRouter,
  StackRouter,
  StackActions,
  NavigationActions,
  NavigationContext,
  getNavigation,
  NavigationProvider,
  NavigationEvents,
  SceneView,
} from '@react-navigation/core'
import {createAppContainer} from '@react-navigation/native'
import StackHeader from 'react-navigation-stack/src/views/Header/Header'
import {createBottomTabNavigator} from 'react-navigation-tabs'
import {createStackNavigator} from 'react-navigation-stack'
import {modalRoutes, routes, nameToTab} from './routes'
import {LeftAction} from '../common-adapters/header-hoc'
import * as Shared from './router.shared'
import {useScreens} from 'react-native-screens'
// turn on screens
useScreens()

// deprecating routestate concept entirely
// const emptyMap = I.Map()
// // don't path this likely
// const emptyList = I.List()
// class BridgeSceneView extends React.PureComponent {
// _routeProps = {
// get: key => this.props.navigation.getParam(key),
// }
// _pop = () => this.props.navigation.pop()

// // TODO remove all the routeprops etc
// render() {
// const Component = this.props.component
// const options = Component.navigationOptions || {}
// return (
// <NavigationContext.Provider value={this.props.navigation}>
// <Kb.ErrorBoundary>
// <Component
// routeProps={this._routeProps}
// routePath={emptyList}
// routeState={emptyMap}
// navigation={this.props.navigation}
// />
// </Kb.ErrorBoundary>
// {!options.skipOffline && <Offline />}
// <GlobalError />
// </NavigationContext.Provider>
// )
// }
// }

// The app with a tab bar on the left and content area on the right
// A single content view and n modals on top
// class AppView extends React.PureComponent {
// render() {
// const p = this.props
// const index = p.navigation.state.index
// // Find topmost non modal
// let nonModalIndex = index
// let modals = []
// while (nonModalIndex >= 0) {
// const activeKey = p.navigation.state.routes[nonModalIndex].key
// const descriptor = p.descriptors[activeKey]
// const Component = descriptor.getComponent()
// const options = Component.navigationOptions || {}
// if (!options.isModal) {
// break
// }
// modals.unshift(descriptor)
// --nonModalIndex
// }

// const activeKey = p.navigation.state.routes[nonModalIndex].key
// const descriptor = p.descriptors[activeKey]

// return (
// <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
// <TabBar selectedTab={nameToTab[descriptor.state.routeName]} />
// <Kb.Box2 direction="vertical" fullHeight={true} style={styles.contentArea}>
// <BridgeSceneView navigation={descriptor.navigation} component={descriptor.getComponent()} />
// </Kb.Box2>
// {modals.map(modal => {
// const Component = modal.getComponent()
// return (
// <Component
// key={modal.key}
// routeProps={{get: key => modal.navigation.getParam(key)}}
// routePath={emptyList}
// routeState={emptyMap}
// navigation={modal.navigation}
// />
// )
// })}
// </Kb.Box2>
// )
// }
// }

// const StackNavigator = createNavigator(AppView, routes, {
// headerMode: 'none',
// initialRouteName: 'tabs:peopleTab',
// })

//
// We need to wrap the params that come into the components so the old way isn't totally broken short term
const shimmedRoutes = Shared.shimRoutes(routes)

const MainStackNavigator = createStackNavigator(shimmedRoutes, {
  defaultNavigationOptions: p => ({
    // header: p => <Kb.SafeAreaViewTop />,
    // headerMode: 'none',
    // headerTransitionPreset: 'fade-in-place',
    // cardOverlayEnabled: true,
    // static navigationOptions = p => {
    // return {
    // headerTitle: p.navigation.getParam('username'),
    // headerTitle: hp => (
    // <Kb.Text center={true} type="Body">
    // CUSTOM{p.navigation.getParam('username')} long long long long lonlong long long long lonlong long long
    // long longgglong long long long long
    // </Kb.Text>
    // ),
    headerLeft: hp => (
      <LeftAction
        badgeNumber={0}
        leftAction="back"
        onLeftAction={hp.onPress}
        disabled={hp.scene.index === 0}
      />
    ),
    // headerRight: (
    // maybe move tabbar etc to  ElectronApp
    // <Kb.Box2 direction="horizontal" fullHeight={true} centerChildren={true}>
    // <Kb.Icon type="iconfont-ellipsis" />
    // <Kb.Icon type="iconfont-ellipsis" />
    // <Kb.Icon type="iconfont-ellipsis" />
    // </Kb.Box2>
    // ),
    // header: hp => (
    // <Kb.SafeAreaViewTop style={hp.style}>
    // <Kb.Text center={true} type="Body">
    // {p.navigation.getParam('username')}
    // </Kb.Text>
    // </Kb.SafeAreaViewTop>
    // ),
    header: null,
    headerTitle: null,
    headerMode: 'float',
    // headerTransitionPreset: 'uikit',
    // cardOverlayEnabled: true,
    // }
    // }
  }),
  // headerMode: 'none',
  initialRouteName: 'tabs:peopleTab',
})

// The nested modal nav can't easily show a header so we just inject it in
const ModalHeader = p => {
  // const scene = {index: 0, isActive: true, descriptor: {options: {}}}
  const scene = {descriptor: {options: {...p.navigationOptions}}, index: 0, isActive: true}
  const scenes = [scene]
  // const navigation = {state: {index: 0}}
  // const getScreenDetails = () => ({
  // options: {
  // title: 'Modal',
  // // headerLeft: <Kb.Button type='title="Cancel" onPress={() => p.navigation.goBack()} />,
  // },
  // })
  // <StackHeader scene={scene} scenes={scenes} navigation={navigation} getScreenDetails={getScreenDetails} />
  return <StackHeader mode="screen" scene={scene} scenes={scenes} navigation={p.navigation} />
}

// const shimmedModalRoutes = Shared.shimRoutes(modalRoutes)
const shimmedModalRoutes = Shared.shimRoutes(modalRoutes) // , ModalHeader)
const RootStackNavigator = createStackNavigator(
  {
    Main: {
      screen: MainStackNavigator,
    },
    ...shimmedModalRoutes,
  },
  {
    headerMode: 'none',
    mode: 'modal',
  }
)

// // NOT using rn-bototm tab
// const tabNavigator = createBottomTabNavigator({
// people: stackNavigator,
// chat: stackNavigator,
// files: stackNavigator,
// settings: stackNavigator,
// })

/// / gets the current screen from navigation state
function getActiveRouteName(navigationState) {
  if (!navigationState) {
    return null
  }
  const route = navigationState.routes[navigationState.index]
  // dive into nested navigators
  if (route.routes) {
    return getActiveRouteName(route)
  }
  return route.routeName
}
class CustomStackNavigator extends React.PureComponent<any> {
  static router = RootStackNavigator.router
  // static router = MainStackNavigator.router

  render() {
    // const p = this.props
    // const index = p.navigation.state.index
    // // Find topmost non modal TODO maybe we odn't need this with multiple stacks?
    // let nonModalIndex = index
    // let modals = []
    // while (nonModalIndex >= 0) {
    // const activeKey = p.navigation.state.routes[nonModalIndex].key
    // const descriptor = p.descriptors[activeKey]
    // const Component = descriptor.getComponent()
    // const options = Component.navigationOptions || {}
    // if (!options.isModal) {
    // break
    // }
    // modals.unshift(descriptor)
    // --nonModalIndex
    // }
    // {nameToTab[descriptor.state.routeName]}
    // const activeKey = p.navigation.state.routes[nonModalIndex].key
    // const descriptor = p.descriptors[activeKey]

    // let isUnderNotch = false
    // const route = routes[this.props.activeKey]
    // if (route) {
    // if (route.getScreen) {
    // const options = route.getScreen().navigationOptions || {}
    // if (options.isUnderNotch) {
    // isUnderNotch = true
    // }
    // }
    // }
    // {!isUnderNotch && <Kb.SafeAreaViewTop />}
    //
    //
    //
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.NativeKeyboardAvoidingView style={styles.keyboard} behavior="padding">
          <RootStackNavigator navigation={this.props.navigation} />
        </Kb.NativeKeyboardAvoidingView>
        <TabBar selectedTab={nameToTab[this.props.activeKey]} />
        <GlobalError />
      </Kb.Box2>
    )
  }
}
const AppContainer = createAppContainer(CustomStackNavigator)

class RNApp extends React.Component<any, any> {
  // state = {selectedTab: 'tabs:peopleTab'}
  state = {activeKey: 'tabs:peopleTab'}
  _nav = null
  _onNavigationStateChange = (prevState, currentState) => {
    const activeKey = getActiveRouteName(currentState)
    // const prevScreen = getActiveRouteName(prevState)

    // if (prevScreen !== currentScreen) {
    // console.log('aaaa', currentScreen)
    // const selectedTab = nameToTab[currentScreen]
    // this.setState(p => (p.selectedTab === selectedTab ? null : {selectedTab}))
    // }
    this.setState(p => (p.activeKey === activeKey ? null : {activeKey}))
  }

  // getState = () => this._nav.state
  // dispatch = (p: any) => p && this._nav.dispatch(p)
  // TODO remove this eventually, just so we can handle the old style actions
  dispatchOldAction = (old: any) => {
    const nav = this._nav
    if (!nav) {
      throw new Error('Missing nav?')
    }
    const action = Shared.oldActionToNewAction(old, nav._navigation)
    action && nav.dispatch(action)
  }

  render() {
    // selectedTab={this.state.selectedTab}
    return (
      <AppContainer
        ref={nav => (this._nav = nav)}
        onNavigationStateChange={this._onNavigationStateChange}
        activeKey={this.state.activeKey}
      />
    )
  }
}

// const AppNavigator = createNavigator(
// AppView,
// // TODO don't hardcode this
// StackRouter(routes, {initialRouteName: 'tabs:peopleTab'}),
// {}
// )

// const createRNApp = App => {
// const initAction = NavigationActions.init()

// // Based on https://github.com/react-navigation/react-navigation-web/blob/master/src/createBrowserApp.js
// class RNApp extends React.Component<any, any> {
// state = {nav: App.router.getStateForAction(initAction)}
// _actionEventSubscribers = new Set()
// _navigation: any
// componentDidMount() {
// this._actionEventSubscribers.forEach(subscriber =>
// subscriber({action: initAction, lastState: null, state: this.state.nav, type: 'action'})
// )
// }
// render() {
// this._navigation = getNavigation(
// App.router,
// this.state.nav,
// this._dispatch,
// this._actionEventSubscribers,
// () => this.props.screenProps,
// () => this._navigation
// )
// return (
// <NavigationProvider value={this._navigation}>
// <App navigation={this._navigation} />
// </NavigationProvider>
// )
// }
// // just so we have nice access to this in the action
// push = route => this._dispatch(StackActions.push(route))
// pop = () => this._dispatch(StackActions.pop())
// _dispatch = action => {
// const lastState = this.state.nav
// const newState = App.router.getStateForAction(action, lastState)
// const dispatchEvents = () =>
// this._actionEventSubscribers.forEach(subscriber =>
// subscriber({action, lastState, state: newState, type: 'action'})
// )
// if (newState && newState !== lastState) {
// this.setState({nav: newState}, dispatchEvents)
// } else {
// dispatchEvents()
// }
// }
// }
// return RNApp
// }

// const RNApp = createRNApp(AppNavigator)
// const RNApp = createAppContainer(tabNavigator)

const styles = Styles.styleSheetCreate({
  contentArea: {
    flexGrow: 1,
    position: 'relative',
  },
  keyboard: {
    flexGrow: 1,
  },
  modalContainer: {},
})

export default RNApp
