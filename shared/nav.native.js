// @flow
import React from 'react'
import {NavigationExperimental} from 'react-native'
import {Box, NativeKeyboardAvoidingView} from './common-adapters/index.native'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {globalColors, statusBarHeight} from './styles/index.native'
import {listenForNotifications} from './actions/notifications'
import {loginTab, folderTab} from './constants/tabs'
import TabBar from './tab-bar/index.render.native'
import {navigateTo, navigateUp, switchTo} from './actions/route-tree'
import GlobalError from './global-errors/container'
import {isAndroid} from './constants/platform'

import type {Props} from './nav'
import type {Tab} from './constants/tabs'

const {
  CardStack: NavigationCardStack,
} = NavigationExperimental

function Nav (props: Props) {
  const navigationState = {
    index: props.routeStack.size - 1,
    routes: props.routeStack.map(r => ({
      key: r.path.join('/'),
      component: r.component,
      tags: r.tags,
    })).toArray(),
  }

  return (
    <Box style={flexOne}>
      <NativeKeyboardAvoidingView behavior={isAndroid ? 'height' : 'padding'} style={{...flexOne, backgroundColor: globalColors.white}}>
        <NavigationCardStack
          key={props.routeSelected}
          style={flexOne}
          navigationState={navigationState}
          renderScene={({scene}) => {
            return (
              <Box style={{
                ...flexOne,
                backgroundColor: globalColors.white,
                paddingTop: scene.route.tags.underStatusBar ? 0 : statusBarHeight,
              }}>
                {scene.route.component}
              </Box>
            )
          }}
          onNavigateBack={props.navigateUp}
        />
      </NativeKeyboardAvoidingView>
      {props.routeSelected !== loginTab &&
        <TabBar
          onTabClick={props.switchTab}
          selectedTab={props.routeSelected}
          username={props.username}
          badgeNumbers={{[folderTab]: props.folderBadge}}
        />
      }
      <GlobalError />
    </Box>
  )
}

const flexOne = {
  flex: 1,
}

export default connect(
  ({favorite: {privateBadge, publicBadge}, config: {bootstrapped, extendedConfig, username}, dev: {debugConfig: {dumbFullscreen}}}) => ({
    bootstrapped,
    provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
    username,
    dumbFullscreen,
    folderBadge: privateBadge + publicBadge,
  }),
  (dispatch: any, {routeSelected, routePath}) => ({
    switchTab: (tab: Tab) => {
      const action = routeSelected === tab ? navigateTo : switchTo
      dispatch(action(routePath.push(tab)))
    },
    navigateUp: () => dispatch(navigateUp()),
    bootstrap: () => dispatch(bootstrap()),
    listenForNotifications: () => dispatch(listenForNotifications()),
  })
)(Nav)
