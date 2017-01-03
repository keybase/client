// @flow
import React from 'react'
import {Box} from './common-adapters'
import GlobalError from './global-errors/container'
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
    config: {extendedConfig, username},
    notifications: {menuBadge, menuNotifications},
  }) => ({
    provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
    username,
    folderBadge: menuNotifications.folderBadge,
    chatBadge: menuNotifications.chatBadge,
  }),
  (dispatch: any, {routeSelected, routePath}) => ({
    switchTab: (tab: Tab) => {
      const action = routeSelected === tab ? navigateTo : switchTo
      dispatch(action(routePath.push(tab)))
    },
  })
)(Nav)
