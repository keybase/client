import * as Kb from '../common-adapters'
import * as Container from '../util/container'
import * as Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import * as Shared from './router.shared'
import * as Styles from '../styles'
import * as React from 'react'
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
// import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
// import TabBar from './tab-bar.desktop'
// import {
//   NavigationViewProps,
//   // createNavigator,
//   StackRouter,
//   SwitchRouter,
//   NavigationActions,
//   getNavigation,
//   NavigationContext,
//   // SceneView,
//   createSwitchNavigator,
// } from '@react-navigation/core'
import {createStackNavigator} from '@react-navigation/stack'
import {NavigationContainer, getFocusedRouteNameFromRoute} from '@react-navigation/native'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {HeaderLeftArrow, HeaderLeftCancel} from '../common-adapters/header-hoc'
// import {modalRoutes, routes, nameToTab, loggedOutRoutes, tabRoots} from './routes'
// import {getActiveIndex, getActiveKey} from './util'
// import Header from './header/index.desktop'
import * as Shim from './shim.desktop'
// import GlobalError from '../app/global-errors/container'
// import OutOfDate from '../app/out-of-date'

/**
 * How this works:
 * There are 3 layers
 * Normal screens
 * Modal screens
 * Floating screens
 *
 * You have 2 nested routers, a tab router and modal stack
 * When the modal has a valid route ModalView is rendered, which renders AppView underneath
 * When there are no modals AppView is rendered
 * Floating is rendered to a portal on top
 */

export const headerDefaultStyle = {}
// const noScreenProps = {}
// // The app with a tab bar on the left and content area on the right
// // A single content view and n-modals on top
// const AppView = React.memo((props: NavigationViewProps<any>) => {
//   const {navigation, descriptors} = props
//   const {state} = navigation
//   const {index, routes} = state
//   const {key} = routes[index]
//   const descriptor = descriptors[key]
//   const {navigation: childNav, state: childState, options} = descriptor
//   const {routeName} = childState
//   const selectedTab = nameToTab[routeName]
//   // transparent headers use position absolute and need to be rendered last so they go on top w/o zindex
//   const direction = options.headerTransparent ? 'vertical' : 'verticalReverse'
//   const activeIndex = getActiveIndex(state)
//   const activeKey = getActiveKey(state)
//
//   const sceneView = (
//     <SceneView
//       navigation={childNav}
//       component={descriptor.getComponent()}
//       screenProps={props.screenProps || noScreenProps}
//     />
//   )
//   // if the header is transparent this needs to be on the same layer
//   const scene = descriptor.options.headerTransparent ? (
//     <Kb.Box2 direction="vertical" style={styles.transparentSceneUnderHeader}>
//       {sceneView}
//     </Kb.Box2>
//   ) : (
//     <Kb.BoxGrow style={styles.sceneContainer}>{sceneView}</Kb.BoxGrow>
//   )
//
//   return (
//     <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
//       <Kb.Box2
//         direction={direction}
//         fullHeight={true}
//         style={selectedTab ? styles.contentArea : styles.contentAreaLogin}
//       >
//         {scene}
//         <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true}>
//           <Header
//             loggedIn={!!selectedTab}
//             options={descriptor.options}
//             onPop={() => childNav.goBack(activeKey)}
//             allowBack={activeIndex !== 0}
//           />
//         </Kb.Box2>
//       </Kb.Box2>
//     </Kb.Box2>
//   )
// })
//
// const mouseResetValue = -9999
// const mouseDistanceThreshold = 5
//
// const ModalView = React.memo((props: NavigationViewProps<any>) => {
//   const {navigation, descriptors} = props
//   const {state} = navigation
//   const {index, routes} = state
//   const {key} = routes[index]
//   const descriptor = descriptors[key]
//   const {navigation: childNav, getComponent} = descriptor
//
//   // We render the app below us
//   const appKey = routes[0].key
//   const appNav = navigation.getChildNavigation(appKey)
//   const appDescriptor = descriptors[appKey]
//
//   const Component = getComponent()
//   const getNavigationOptions: undefined | Object | ((n: {navigation: typeof childNav}) => Object) =
//     // @ts-ignore
//     Component?.navigationOptions
//   let navigationOptions: undefined | Object
//   if (typeof getNavigationOptions === 'function') {
//     navigationOptions = getNavigationOptions({navigation: childNav})
//   } else if (typeof getNavigationOptions === 'object') {
//     navigationOptions = getNavigationOptions
//   }
//   // @ts-ignore
//   const {modal2Style, modal2AvoidTabs, modal2, modal2ClearCover, modal2NoClose, modal2Type} =
//     navigationOptions ?? {}
//
//   const popRef = React.useRef(navigation.pop)
//   React.useEffect(() => {
//     popRef.current = navigation.pop
//   }, [navigation])
//
//   const backgroundRef = React.useRef(null)
//   // we keep track of mouse down/up to determine if we should call it a 'click'. We don't want dragging the
//   // window around to count
//   const [mouseDownX, setMouseDownX] = React.useState(mouseResetValue)
//   const [mouseDownY, setMouseDownY] = React.useState(mouseResetValue)
//   const onMouseDown = React.useCallback(
//     (e: React.MouseEvent) => {
//       const {screenX, screenY, target} = e.nativeEvent
//       if (target !== backgroundRef.current) {
//         return
//       }
//       setMouseDownX(screenX)
//       setMouseDownY(screenY)
//     },
//     [setMouseDownX, setMouseDownY]
//   )
//   const onMouseUp = React.useCallback(
//     (e: React.MouseEvent) => {
//       const {screenX, screenY, target} = e.nativeEvent
//       if (target !== backgroundRef.current) {
//         return
//       }
//       const delta = Math.abs(screenX - mouseDownX) + Math.abs(screenY - mouseDownY)
//       const dismiss = delta < mouseDistanceThreshold
//       setMouseDownX(mouseResetValue)
//       setMouseDownY(mouseResetValue)
//       if (dismiss && !modal2NoClose) {
//         popRef.current?.()
//       }
//     },
//     [setMouseDownX, setMouseDownY, mouseDownX, mouseDownY, modal2NoClose]
//   )
//   // if the modals change clear this value
//   React.useEffect(() => {
//     setMouseDownX(mouseResetValue)
//     setMouseDownY(mouseResetValue)
//   }, [index])
//
//   let modal: React.ReactNode = null
//
//   const modalModeToStyle = new Map<ModalType, Styles.StylesCrossPlatform>([
//     ['Default', styles.modalModeDefault],
//     ['DefaultFullHeight', styles.modalModeDefaultFullHeight],
//     ['DefaultFullWidth', styles.modalModeDefaultFullWidth],
//     ['Wide', styles.modalModeWide],
//   ])
//
//   if (index > 0) {
//     if (modal2) {
//       modal = (
//         <Kb.Box2
//           key="background"
//           direction="horizontal"
//           ref={backgroundRef}
//           style={Styles.collapseStyles([styles.modal2Container, modal2ClearCover && styles.modal2ClearCover])}
//           onMouseDown={onMouseDown as any}
//           onMouseUp={onMouseUp as any}
//         >
//           {modal2AvoidTabs && (
//             <Kb.Box2 direction="vertical" className="tab-container" style={styles.modal2AvoidTabs} />
//           )}
//           <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.modal2Style, modal2Style])}>
//             <Kb.Box2 direction="vertical" style={modalModeToStyle.get(modal2Type ?? 'Default')}>
//               <SceneView
//                 key="ModalLayer"
//                 navigation={childNav}
//                 component={Component}
//                 screenProps={props.screenProps || noScreenProps}
//               />
//               {!modal2ClearCover && !modal2NoClose && (
//                 <Kb.Icon
//                   type="iconfont-close"
//                   onClick={() => popRef.current?.()}
//                   color={Styles.globalColors.whiteOrWhite_75}
//                   hoverColor={Styles.globalColors.white_40OrWhite_40}
//                   style={styles.modal2CloseIcon}
//                 />
//               )}
//             </Kb.Box2>
//           </Kb.Box2>
//         </Kb.Box2>
//       )
//     } else {
//       modal = (
//         <Kb.Box2 key="background" direction="vertical" style={styles.modalContainer}>
//           <SceneView
//             key="ModalLayer"
//             navigation={childNav}
//             component={Component}
//             screenProps={props.screenProps || noScreenProps}
//           />
//         </Kb.Box2>
//       )
//     }
//   }
//
//   return (
//     <>
//       <SceneView
//         key="AppLayer"
//         navigation={appNav}
//         component={appDescriptor.getComponent()}
//         screenProps={props.screenProps || noScreenProps}
//       />
//       {modal}
//       <GlobalError />
//       <OutOfDate />
//     </>
//   )
// })
//
// const TabView = React.memo((props: NavigationViewProps<any>) => {
//   const {navigation, descriptors} = props
//   const {state} = navigation
//   const {index, routes} = state
//   const {key} = routes[index]
//   const descriptor = descriptors[key]
//   const {navigation: childNav, state: childState} = descriptor
//   const {routeName} = childState
//   const sceneView = (
//     <SceneView
//       navigation={childNav}
//       component={descriptor.getComponent()}
//       screenProps={props.screenProps || noScreenProps}
//     />
//   )
//   return (
//     <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
//       <TabBar navigation={navigation} selectedTab={routeName as Tabs.AppTab} />
//       {sceneView}
//     </Kb.Box2>
//   )
// })
//
// const tabs = Shared.desktopTabs
//
// const TabNavigator = createNavigator(
//   TabView,
//   SwitchRouter(
//     tabs.reduce((map, tab) => {
//       map[tab] = createNavigator(
//         AppView,
//         StackRouter(Shim.shim(routes, false), {
//           // @ts-ignore types are wrong, this exists
//           initialRouteKey: tabRoots[tab],
//           initialRouteName: tabRoots[tab],
//           initialRouteParams: undefined,
//         }),
//         {}
//       )
//       return map
//     }, {}),
//     {backBehavior: 'none', resetOnBlur: false}
//   ),
//   {}
// )
//
// const LoggedInStackNavigator = createNavigator(
//   ModalView,
//   StackRouter(
//     {
//       Main: {screen: TabNavigator},
//       ...Shim.shim(modalRoutes, true),
//     },
//     {
//       // @ts-ignore
//       initialRouteKey: 'Main',
//       // @ts-ignore
//       initialRouteName: 'Main',
//     }
//   ),
//   {}
// )
//
// const LoggedOutStackNavigator = createNavigator(
//   AppView,
//   StackRouter(
//     {...Shim.shim(loggedOutRoutes, false)},
//     {
//       // @ts-ignore TODO add custom nav options somewhere
//       defaultNavigationOptions: () => ({headerHideBorder: true}),
//       initialRouteName: 'login',
//     }
//   ),
//   {}
// )
//
// const RootStackNavigator = createSwitchNavigator(
//   {
//     loggedIn: LoggedInStackNavigator,
//     loggedOut: LoggedOutStackNavigator,
//   },
//   {initialRouteName: 'loggedOut'}
// )
//
// type Subscriber = (data: {action: Object | null; lastState: Object | null; state: any; type: string}) => void
//
// const createElectronApp = (Component: any) => {
//   // Based on https://github.com/react-navigation/react-navigation-native/blob/master/src/createAppContainer.js
//   class ElectronApp extends React.PureComponent<any, any> {
//     private navState: any = null // always use this value and not whats in state since thats async
//     private actionEventSubscribers = new Set<Subscriber>()
//     private navigation: any
//     private initialAction: any = null
//
//     constructor(props: any) {
//       super(props)
//       this.initialAction = NavigationActions.init()
//       this.state = {nav: Component.router.getStateForAction(this.initialAction)}
//     }
//
//     componentDidUpdate() {
//       // Clear cached navState every tick
//       if (this.navState === this.state.nav) {
//         this.navState = null
//       }
//     }
//
//     componentDidMount() {
//       const action = this.initialAction
//       // maybe slightly unsafe but keeping this close to the reference
//       // eslint-disable-next-line
//       let startupState = this.state.nav
//       if (!startupState) {
//         startupState = Component.router.getStateForAction(action)
//       }
//       const dispatchActions = () =>
//         this.actionEventSubscribers.forEach(subscriber =>
//           subscriber({
//             action,
//             lastState: null,
//             state: this.state.nav,
//             type: 'action',
//           })
//         )
//
//       if (startupState === this.state.nav) {
//         dispatchActions()
//         return
//       }
//
//       // eslint-disable-next-line react/no-did-mount-set-state
//       this.setState({nav: startupState}, () => {
//         dispatchActions()
//       })
//     }
//
//     _onNavigationStateChange(prevNav: any, nav: any, action: any) {
//       this.props.onNavigationStateChange(prevNav, nav, action)
//     }
//
//     dispatch = (action: any) => {
//       // navState will have the most up-to-date value, because setState sometimes behaves asyncronously
//       this.navState = this.navState || this.state.nav
//       const lastNavState = this.navState
//       const reducedState = Component.router.getStateForAction(action, lastNavState)
//       const navState = reducedState === null ? lastNavState : reducedState
//
//       const dispatchActionEvents = () => {
//         this.actionEventSubscribers.forEach(subscriber =>
//           subscriber({
//             action,
//             lastState: lastNavState,
//             state: navState,
//             type: 'action',
//           })
//         )
//       }
//
//       if (reducedState === null) {
//         // The router will return null when action has been handled and the state hasn't changed.
//         // dispatch returns true when something has been handled.
//         dispatchActionEvents()
//         return true
//       }
//
//       if (navState !== lastNavState) {
//         // Cache updates to state.nav during the tick to ensure that subsequent calls will not discard this change
//         this.navState = navState
//         this.setState({nav: navState}, () => {
//           this._onNavigationStateChange(lastNavState, navState, action)
//           dispatchActionEvents()
//         })
//         return true
//       }
//
//       dispatchActionEvents()
//       return false
//     }
//
//     _getScreenProps = () => this.props.screenProps
//
//     private setRef = () => {
//       this.props.updateNavigator(this)
//     }
//
//     render() {
//       let navigation = this.props.navigation
//       const navState = this.state.nav
//       if (!navState) {
//         return null
//       }
//       if (!this.navigation || this.navigation.state !== navState) {
//         this.navigation = getNavigation(
//           Component.router,
//           navState,
//           this.dispatch,
//           this.actionEventSubscribers,
//           this._getScreenProps,
//           () => this.navigation
//         )
//       }
//       navigation = this.navigation
//       return (
//         <NavigationContext.Provider key={this.props.isDarkMode ? 'dark' : 'light'} value={navigation}>
//           <Component {...this.props} navigation={navigation} ref={this.setRef} />
//         </NavigationContext.Provider>
//       )
//     }
//
//     getNavState = () => this.navState || this.state.nav
//
//     dispatchOldAction = (old: any) => {
//       const actions = Shared.oldActionToNewActions(old, this.getNavState()) || []
//       actions.forEach(a => this.dispatch(a))
//     }
//   }
//   return ElectronApp
// }
//
// const ElectronApp: any = createElectronApp(RootStackNavigator)
//
// const styles = Styles.styleSheetCreate(() => {
//   const modalModeCommon = Styles.platformStyles({
//     isElectron: {
//       ...Styles.desktopStyles.boxShadow,
//       backgroundColor: Styles.globalColors.white,
//       borderRadius: Styles.borderRadius,
//       pointerEvents: 'auto',
//       position: 'relative',
//     },
//   })
//   return {
//     contentArea: {
//       flexGrow: 1,
//       position: 'relative',
//     },
//     contentAreaLogin: Styles.platformStyles({
//       isElectron: {
//         flexGrow: 1,
//         position: 'relative',
//       },
//       isMobile: {
//         flexGrow: 1,
//         position: 'relative',
//       },
//     }),
//     modal2AvoidTabs: Styles.platformStyles({
//       isElectron: {
//         backgroundColor: undefined,
//         height: 0,
//         pointerEvents: 'none',
//       },
//     }),
//     modal2ClearCover: {backgroundColor: undefined},
//     modal2CloseIcon: Styles.platformStyles({
//       isElectron: {
//         cursor: 'pointer',
//         padding: Styles.globalMargins.tiny,
//         position: 'absolute',
//         right: Styles.globalMargins.tiny * -4,
//         top: 0,
//       },
//     }),
//     modal2Container: {
//       ...Styles.globalStyles.fillAbsolute,
//       backgroundColor: Styles.globalColors.black_50OrBlack_60,
//     },
//     modal2Style: Styles.platformStyles({
//       isElectron: {flexGrow: 1, pointerEvents: 'none'},
//     }),
//     modalContainer: {
//       ...Styles.globalStyles.fillAbsolute,
//     },
//     modalModeDefault: Styles.platformStyles({
//       common: {...modalModeCommon},
//       isElectron: {
//         maxHeight: 560,
//         width: 400,
//       },
//     }),
//     modalModeDefaultFullHeight: Styles.platformStyles({
//       common: {...modalModeCommon},
//       isElectron: {
//         height: 560,
//         width: 400,
//       },
//     }),
//     modalModeDefaultFullWidth: Styles.platformStyles({
//       common: {...modalModeCommon},
//       isElectron: {
//         height: 560,
//         width: '100%',
//       },
//     }),
//     modalModeWide: Styles.platformStyles({
//       common: {...modalModeCommon},
//       isElectron: {
//         height: 400,
//         width: 560,
//       },
//     }),
//     sceneContainer: {flexDirection: 'column'},
//     transparentSceneUnderHeader: {...Styles.globalStyles.fillAbsolute},
//   } as const
// })
//
// type ModalType = 'Default' | 'DefaultFullHeight' | 'DefaultFullWidth' | 'Wide'
//
// export default ElectronApp
const actionWidth = 64
const defaultNavigationOptions: any = {
  headerLeft: HeaderLeftArrow,
  headerStyle: headerDefaultStyle,
  headerTitleContainerStyle: {
    alignItems: 'stretch',
    // backgroundColor: 'red',
    flexGrow: 1,
  },
  headerBackTitle: 'temp',
  headerBackVisible: true,
  headerRightContainerStyle: {
    // backgroundColor: 'orange',
    // width: actionWidth,
    paddingRight: 8,
  },
  headerLeftContainerStyle: {
    // backgroundColor: 'yellow',
    paddingLeft: 8,
    width: actionWidth,
  },
  headerTitle: hp => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1} center={true}>
      {hp.children}
    </Kb.Text>
  ),
}
const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {
    // backgroundColor: 'pink',
    color: Styles.globalColors.black,
  },
  keyboard: {
    flexGrow: 1,
    position: 'relative',
  },
}))

const Tab = createLeftTabNavigator()

// const fastTransitionSpec = {
//   animation: 'spring',
//   config: {
//     stiffness: 1000,
//     damping: 500,
//     mass: 0.3,
//     overshootClamping: true,
//     restDisplacementThreshold: 10,
//     restSpeedThreshold: 10,
//   },
// }

// so we have a stack per tab?
const tabToStack = new Map()
const makeTabStack = tab => {
  let Comp = tabToStack.get(tab)
  if (!Comp) {
    const S = createStackNavigator()
    Comp = ({navigation, route}) => {
      React.useLayoutEffect(() => {
        const routeName = getFocusedRouteNameFromRoute(route)
        const hideTabs = routeName === 'chatConversation'
        navigation.setOptions({tabBarStyle: hideTabs ? {display: 'none'} : tabBarStyle})
      }, [navigation, route])
      return (
        <S.Navigator
          initialRouteName={tabRoots[tab]}
          screenOptions={{
            ...defaultNavigationOptions,
          }}
        >
          {makeNavScreens(Shim.shim(routes, false, false), S.Screen, false)}
        </S.Navigator>
      )
    }
    tabToStack.set(tab, Comp)
  }
  return Comp
}

const makeNavScreens = (rs, Screen, isModal) => {
  return Object.keys(rs).map(name => {
    return (
      <Screen
        key={name}
        name={name}
        getComponent={rs[name].getScreen}
        options={({route, navigation}) => {
          const no = rs[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({route, navigation}) : no
          return {...opt}
        }}
      />
    )
  })
}

const tabBarStyle = {
  get backgroundColor() {
    return Styles.globalColors.blueDarkOrGreyDarkest
  },
}

const AppTabs = () => {
  console.log('aaa appTab rendering')

  return (
    <Tab.Navigator
      backBehavior="none"
      screenOptions={({route}) => {
        return {
          ...defaultNavigationOptions,
          tabBarHideOnKeyboard: true,
          headerShown: false,
          tabBarShowLabel: Styles.isTablet,
          tabBarStyle,
          tabBarActiveBackgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
          tabBarInactiveBackgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
          // tabBarIcon: ({focused}) => <TabBarIcon isFocused={focused} routeName={route.name} />,
        }
      }}
    >
      {Tabs.desktopTabs.map(tab => (
        <Tab.Screen key={tab} name={tab} getComponent={() => makeTabStack(tab)} />
      ))}
    </Tab.Navigator>
  )
}
const LoggedOutStack = createStackNavigator()
const LoggedOut = () => (
  <LoggedOutStack.Navigator
    initialRouteName="login"
    screenOptions={{
      tabBarHideOnKeyboard: true,
      headerShown: false,
    }}
  >
    {makeNavScreens(Shim.shim(loggedOutRoutes, false, true), LoggedOutStack.Screen, false)}
  </LoggedOutStack.Navigator>
)
const RootStack = createStackNavigator()
const ElectronApp = () => {
  const {loggedInLoaded, loggedIn, appState, onStateChange, navKey, initialState} = Shared.useShared()

  console.log('bbb RNApp render', {
    appState: appState.current,
    navKey,
    initialState,
    loggedIn,
    loggedInLoaded,
  })

  Shared.useSharedAfter(appState)

  return (
    <NavigationContainer
      ref={Constants.navigationRef_}
      key={String(navKey)}
      initialState={initialState}
      onStateChange={onStateChange}
    >
      <RootStack.Navigator
        key="root"
        screenOptions={{
          animationEnabled: false,
          presentation: 'modal',
          headerLeft: HeaderLeftCancel,
          title: '',
          headerShown: false, // eventually do this after we pull apart modal2 etc
        }}
      >
        {!loggedInLoaded && (
          <RootStack.Screen key="loading" name="loading" component={Shared.SimpleLoading} />
        )}
        {loggedInLoaded && loggedIn && (
          <>
            <RootStack.Screen name="loggedIn" component={AppTabs} />
            {makeNavScreens(Shim.shim(modalRoutes, true, false), RootStack.Screen, true)}
          </>
        )}
        {loggedInLoaded && !loggedIn && <RootStack.Screen name="loggedOut" component={LoggedOut} />}
      </RootStack.Navigator>
    </NavigationContainer>
  )
}

export default ElectronApp
