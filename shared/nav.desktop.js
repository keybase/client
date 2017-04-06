// @flow
import React from 'react'
import {Box} from './common-adapters'
import GlobalError from './global-errors/container'
import Offline from './offline'
import TabBar from './tab-bar/index.render'
import {chatTab, loginTab, folderTab} from './constants/tabs'
import {connect} from 'react-redux'
import {globalStyles} from './styles'
import {navigateTo, switchTo} from './actions/route-tree'

import type {Tab} from './constants/tabs'
import type {Props} from './nav'

function Nav (props: Props) {
  const visibleScreen = props.routeStack.findLast(r => !r.tags.layerOnTop)
  if (!visibleScreen) {
    throw new Error('no route component to render without layerOnTop tag')
  }
  const layerScreens = props.routeStack.filter(r => r.tags.layerOnTop)
  return (
    <Box style={stylesTabsContainer}>
      {props.routeSelected !== loginTab &&
        <TabBar
          onTabClick={props.switchTab}
          selectedTab={props.routeSelected}
          username={props.username}
          badgeNumbers={{
            [folderTab]: props.folderBadge,
            [chatTab]: props.chatBadge,
          }}
        />
      }
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {visibleScreen.component}
        {layerScreens.map(r => r.leafComponent)}
      </Box>
      <div id='popupContainer' />
      {![chatTab, loginTab].includes(props.routeSelected) && <Offline reachability={props.reachability} appFocused={props.appFocused} />}
      <GlobalError />
    </Box>
  )
}

const stylesTabsContainer = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

export default connect(
  ({
    config: {extendedConfig, username, appFocused},
    notifications: {menuBadge, menuNotifications},
    gregor: {reachability},
  }) => ({
    provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
    username,
    folderBadge: menuNotifications.folderBadge,
    chatBadge: menuNotifications.chatBadge,
    reachability,
    appFocused,
  }),
  (dispatch: any, {routeSelected, routePath}) => ({
    switchTab: (tab: Tab) => {
      if (tab === chatTab && routeSelected === tab) {
        // clicking the chat tab when already selected should do nothing.
        return
      }
      // otherwise, back out to the default route of the tab.
      const action = routeSelected === tab ? navigateTo : switchTo
      dispatch(action(routePath.push(tab)))
    },
  })
)(Nav)
