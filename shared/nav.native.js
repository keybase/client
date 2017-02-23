// @flow
import React from 'react'
import {NavigationExperimental} from 'react-native'
import {Box} from './common-adapters/index.native'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {globalColors, globalStyles, statusBarHeight} from './styles/index.native'
import {listenForNotifications} from './actions/notifications'
import {loginTab, folderTab} from './constants/tabs'
import TabBar from './tab-bar/index.render.native'
import {navigateTo, navigateUp, switchTo} from './actions/route-tree'
import GlobalError from './global-errors/container'
import type {Props} from './nav'
import type {Tab} from './constants/tabs'

const {
  CardStack: NavigationCardStack,
} = NavigationExperimental

function Nav (props: Props) {
  const visibleScreens = props.routeStack.filter(r => !r.tags.layerOnTop)
  if (!visibleScreens.size) {
    throw new Error('no route component to render without layerOnTop tag')
  }
  const navigationState = {
    index: visibleScreens.size - 1,
    routes: visibleScreens.map(r => ({
      key: r.path.join('/'),
      component: r.component,
      tags: r.tags,
    })).toArray(),
  }
  const layerScreens = props.routeStack.filter(r => r.tags.layerOnTop)

  return (
    <Box style={{flex: 1}}>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <NavigationCardStack
          key={props.routeSelected}
          navigationState={navigationState}
          renderScene={({scene}) => {
            return (
              <Box style={{
                flex: 1,
                backgroundColor: globalColors.white,
                paddingTop: scene.route.tags.underStatusBar ? 0 : statusBarHeight,
              }}>
                {scene.route.component}
              </Box>
            )
          }}
          onNavigateBack={props.navigateUp}
        />
        {layerScreens.map(r => r.leafComponent)}
      </Box>
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
