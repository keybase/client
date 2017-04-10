// @flow
import GlobalError from './global-errors/container'
import Offline from './offline'
import React, {Component} from 'react'
import TabBar, {tabBarHeight} from './tab-bar/index.render.native'
import {Box, NativeKeyboardAvoidingView} from './common-adapters/index.native'
import {StatusBar} from 'react-native'
import {CardStack, NavigationActions} from 'react-navigation'
import {chatTab, loginTab, folderTab} from './constants/tabs'
import {connect} from 'react-redux'
import {globalColors, globalStyles, statusBarHeight} from './styles/index.native'
import {isAndroid, isIOS} from './constants/platform'
import {navigateTo, navigateUp, switchTo} from './actions/route-tree'

import type {Props} from './nav'
import type {Tab} from './constants/tabs'
import type {NavigationAction} from 'react-navigation'

const StackWrapper = ({children}) => {
  // FIXME: KeyboardAvoidingView doubles the padding needed on Android. Remove
  // this shim when it works consistently with iOS.
  if (isAndroid) {
    return <Box style={flexOne}>{children}</Box>
  } else {
    return <NativeKeyboardAvoidingView behavior={'padding'} style={sceneWrapStyleUnder} children={children} />
  }
}

class CardStackShim extends Component {
  getScreenConfig = () => null

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

  render () {
    const stack = this.props.stack

    const navigation = {
      state: {
        index: stack.size - 1,
        routes: stack.map(route => {
          const routeName = route.path.join('/')
          return {key: routeName, routeName, params: route}
        }).toArray(),
      },
      dispatch: this._dispatchShim,
    }

    return (
      <CardStack
        navigation={navigation}
        router={this}
        headerMode='none'
        mode={this.props.mode}
      />
    )
  }
}

function renderMainStackRoute (route) {
  const {underStatusBar, hideStatusBar} = route.tags
  return (
    <Box style={route.tags.underStatusBar ? sceneWrapStyleUnder : sceneWrapStyleOver}>
      <StatusBar
        hidden={hideStatusBar}
        translucent={true}
        backgroundColor='rgba(0, 26, 51, 0.25)'
        barStyle={!underStatusBar && isIOS ? 'dark-content' : 'light-content'}
      />
      {route.component}
    </Box>
  )
}

function MainNavStack (props: Props) {
  const screens = props.routeStack

  return (
    <StackWrapper>
      <Box style={flexOne}>
        <CardStackShim
          key={props.routeSelected}
          stack={screens}
          renderRoute={renderMainStackRoute}
          onNavigateBack={props.navigateUp}
        />
        {![chatTab].includes(props.routeSelected) && <Offline reachability={props.reachability} appFocused={true} />}
        <GlobalError />
      </Box>
      {!props.hideNav &&
        <Box style={styleCollapsibleNav}>
          <TabBar
            onTabClick={props.switchTab}
            selectedTab={props.routeSelected}
            username={props.username}
            badgeNumbers={{
              [chatTab]: props.chatBadge,
              [folderTab]: props.folderBadge,
            }}
          />
        </Box>
      }
    </StackWrapper>
  )
}

function renderFullScreenStackRoute (route) {
  return (
    <Box style={globalStyles.fillAbsolute}>
      {route.component}
    </Box>
  )
}

function Nav (props: Props) {
  const baseScreens = props.routeStack.filter(r => !r.tags.layerOnTop)
  if (!baseScreens.size) {
    throw new Error('no route component to render without layerOnTop tag')
  }

  const fullscreenPred = r => r.tags.fullscreen
  const mainScreens = baseScreens.takeUntil(fullscreenPred)
  const fullScreens = baseScreens.skipUntil(fullscreenPred)
    .unshift({
      path: ['main'],
      component: <MainNavStack {...props} routeStack={mainScreens} />,
      tags: {},
    })

  const layerScreens = props.routeStack.filter(r => r.tags.layerOnTop)

  return (
    <Box style={globalStyles.fillAbsolute}>
      <CardStackShim
        stack={fullScreens}
        renderRoute={renderFullScreenStackRoute}
        onNavigateBack={props.navigateUp}
        mode='modal'
      />
      {layerScreens.map(r => r.leafComponent)}
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

const styleCollapsibleNav = {
  flexShrink: 999999,
}

const flexOne = {
  flex: 1,
}

export default connect(
  ({
    config: {extendedConfig, username},
    dev: {debugConfig: {dumbFullscreen}},
    notifications: {menuBadge, menuNotifications},
    gregor: {reachability},
  }, {routeStack, routeSelected}) => ({
    chatBadge: menuNotifications.chatBadge,
    dumbFullscreen,
    folderBadge: menuNotifications.folderBadge,
    provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
    username,
    hideNav: routeSelected === loginTab,
    reachability,
  }),
  (dispatch: any, {routeSelected, routePath}) => ({
    navigateUp: () => dispatch(navigateUp()),
    switchTab: (tab: Tab) => {
      if (tab === chatTab && routeSelected === tab) {
        dispatch(navigateTo(routePath.push(tab)))
        return
      }

      const action = routeSelected === tab ? navigateTo : switchTo
      dispatch(action(routePath.push(tab)))
    },
  })
)(Nav)
