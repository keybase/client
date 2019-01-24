// @flow
import * as Kb from '../common-adapters'
import * as I from 'immutable'
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
  SceneView,
} from '@react-navigation/core'
import {routes, nameToTab} from './routes'
import {LeftAction} from '../common-adapters/header-hoc'
import * as Shared from './router.shared'

// TODO modals
// <Kb.ErrorBoundary>
// {!options.skipOffline && <Offline />}
// <GlobalError />

class Header extends React.PureComponent {
  render() {
    // TODO add more here as we use more options on the mobile side maybe
    const opt = this.props.options
    if (opt.headerMode === 'none') {
      return null
    }

    // let leftAction = null
    // if (typeof opt.headerBackTitle === 'string') {
    // leftAction = (
    // <Kb.Text type="BodyPrimaryLink" onClick={opt.onPop}>
    // {opt.headerBackTitle}
    // </Kb.Text>
    // )
    // } else if (typeof opt.headerBackTitle === 'function') {
    // const CustomBackTitle = opt.headerBackTitle
    // leftAction = <CustomBackTitle />
    // } else {
    // leftAction = (
    // )
    // }

    let title = null
    if (typeof opt.headerTitle === 'string') {
      title = <Kb.Text type="BodySemibold">{opt.headerTitle}</Kb.Text>
    } else if (typeof opt.headerTitle === 'function') {
      const CustomTitle = opt.headerTitle
      title = <CustomTitle>{opt.title}</CustomTitle>
    }

    const rightAction = opt.headerRight

    let style = null
    if (opt.headerTransparent) {
      style = {position: 'absolute', zIndex: 9999}
    }

    return (
      <Kb.Box2
        noShrink={true}
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([styles.headerContainer, style])}
        gap="xtiny"
        gapEnd={true}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerBack}>
          <LeftAction
            badgeNumber={0}
            leftAction="back"
            hideBackLabel={true}
            onLeftAction={this.props.onPop}
            disabled={!this.props.allowBack}
          />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          {title}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

// The app with a tab bar on the left and content area on the right
// A single content view and n modals on top
class AppView extends React.PureComponent {
  render() {
    const p = this.props
    const index = p.navigation.state.index
    // Find topmost non modal
    let nonModalIndex = index
    let modals = []
    while (nonModalIndex >= 0) {
      const activeKey = p.navigation.state.routes[nonModalIndex].key
      const descriptor = p.descriptors[activeKey]
      const Component = descriptor.getComponent()
      const options = Component.navigationOptions || {}
      if (!options.isModal) {
        break
      }
      modals.unshift(descriptor)
      --nonModalIndex
    }

    const activeKey = p.navigation.state.routes[nonModalIndex].key
    const descriptor = p.descriptors[activeKey]
    const childNav = descriptor.navigation
    // const childNav = p.navigation.getChildNavigation(p.navigation.state.routes[p.navigation.state.index].key)

    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <TabBar selectedTab={nameToTab[descriptor.state.routeName]} />
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.contentArea}>
          <Header options={descriptor.options} onPop={childNav.pop} allowBack={index !== 0} />
          <SceneView
            navigation={childNav}
            component={descriptor.getComponent()}
            screenProps={p.screenProps}
          />
        </Kb.Box2>
        {/* modals.map(modal => {
          const component = modal.getComponent()
          return <SceneView key={modal.key} component={component} />
        }) */}
      </Kb.Box2>
    )
  }
}

const shimmedRoutes = Shared.shimRoutes(routes)
const AppNavigator = createNavigator(
  AppView,
  // TODO don't hardcode this
  StackRouter(shimmedRoutes, {initialRouteName: 'tabs:peopleTab'}),
  {}
)

const createElectronApp = App => {
  const initAction = NavigationActions.init()

  // Based on https://github.com/react-navigation/react-navigation-web/blob/master/src/createBrowserApp.js
  class ElectronApp extends React.Component<any, any> {
    state = {nav: App.router.getStateForAction(initAction)}
    _actionEventSubscribers = new Set()
    _navigation: any
    componentDidMount() {
      this._actionEventSubscribers.forEach(subscriber =>
        subscriber({action: initAction, lastState: null, state: this.state.nav, type: 'action'})
      )
    }
    render() {
      this._navigation = getNavigation(
        App.router,
        this.state.nav,
        this.dispatch,
        this._actionEventSubscribers,
        () => this.props.screenProps,
        () => this._navigation
      )
      return (
        <NavigationProvider value={this._navigation}>
          <App navigation={this._navigation} />
        </NavigationProvider>
      )
    }
    getState = () => this.state
    dispatchOldAction = (action: any) => this.dispatch(Shared.oldActionToNewAction(action, this))
    dispatch = action => {
      const lastState = this.state.nav
      const newState = App.router.getStateForAction(action, lastState)
      const dispatchEvents = () =>
        this._actionEventSubscribers.forEach(subscriber =>
          subscriber({action, lastState, state: newState, type: 'action'})
        )
      if (newState && newState !== lastState) {
        this.setState({nav: newState}, dispatchEvents)
      } else {
        dispatchEvents()
      }
    }
  }
  return ElectronApp
}

const ElectronApp = createElectronApp(AppNavigator)

const styles = Styles.styleSheetCreate({
  back: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
    },
  }),
  contentArea: {
    flexGrow: 1,
    position: 'relative',
  },
  headerContainer: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      ...Styles.desktopStyles.windowDragging,
    },
  }),
  headerBack: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      minHeight: 36,
    },
  }),
  modalContainer: {},
})

export default ElectronApp
