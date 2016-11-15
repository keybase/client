// @flow
import React from 'react'
import {Box} from './common-adapters'
import GlobalError from './global-errors/container'
import TabBar from './tab-bar/index.render'
import {loginTab, folderTab} from './constants/tabs'
import {connect} from 'react-redux'
import {globalStyles} from './styles'
import {navigateTo, switchTo} from './actions/route-tree'

import type {Tab} from './constants/tabs'
import type {Props} from './nav'

function Nav (props: Props) {
  return (
    <Box style={stylesTabsContainer}>
      {props.routeSelected !== loginTab &&
        <TabBar
          onTabClick={props.switchTab}
          selectedTab={props.routeSelected}
          username={props.username}
          badgeNumbers={{[folderTab]: props.folderBadge}}
        />
      }
      <GlobalError />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {props.children}
      </Box>
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
    favorite: {publicBadge = 0, privateBadge = 0},
    notifications: {menuBadge},
  }) => ({
    provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
    username,
    menuBadge,
    folderBadge: publicBadge + privateBadge,
  }),
  (dispatch: any, {routeSelected, routePath}) => ({
    switchTab: (tab: Tab) => {
      const action = routeSelected === tab ? navigateTo : switchTo
      dispatch(action(routePath.push(tab)))
    },
  })
)(Nav)
