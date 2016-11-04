// @flow
import Chat from './chat/container'
import Devices from './devices'
import DumbSheet from './dev/dumb-sheet'
import Folders from './folders'
import GlobalError from './global-errors/container'
import Login from './login'
import MetaNavigator from './router/meta-navigator'
import NoTab from './no-tab'
import ProfileContainer from './profile/container'
import Push from './push/push.native'
import React, {Component} from 'react'
import Search from './search'
import Settings from './settings'
import TabBar from './tab-bar/index.render.native'
import globalRoutes from './router/global-routes'
import hello from './util/hello'
import {Box, NativeNavigator, Text, ClickableBox, Icon} from './common-adapters/index.native'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {globalStyles, globalColors, navBarHeight} from './styles/index.native'
import {listenForNotifications} from './actions/notifications'
import {mapValues} from 'lodash'
import {navigateTo, navigateUp, switchTab} from './actions/router'
import {startupTab, profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab} from './constants/tabs'

import type {Tab} from './constants/tabs'

const tabs: {[key: Tab]: {module: any}} = {
  [settingsTab]: {module: Settings, name: 'Settings'},
  [profileTab]: {module: ProfileContainer, name: 'Profile'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Chat, name: 'Chat'},
  [peopleTab]: {module: Search, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'},
}

function NavigationBarRouteMapper (navigateTo, navigateUp) {
  return {
    LeftButton: function (route, navigator, index, navState) {
      if (typeof route.leftButton !== 'undefined') {
        return route.leftButton
      }

      if (index === 0) {
        return null
      }

      return (
        <ClickableBox
          onClick={() => route.upLink ? navigateTo(route.upLink) : navigateUp()}
          style={styles.navBarLeftButton}
          underlayColor={globalColors.white}>
          <Box>
            {(route.upTitle || route.leftButtonTitle)
              ? <Text type='Body' style={styles.navBarButtonText}>{route.upTitle || route.leftButtonTitle}</Text>
              : <Box style={{...globalStyles.flexBoxRow, justifyContent: 'flex-start', alignItems: 'center', marginLeft: 8}}>
                <Icon type='iconfont-back' />
                <Text type='Body' style={{...styles.navBarButtonText, marginTop: 0, marginLeft: 5}}>Back</Text>
              </Box>}
          </Box>
        </ClickableBox>
      )
    },

    RightButton: function (route, navigator, index, navState) {
      if (!route.rightButtonAction) {
        return null
      }
      return (
        <ClickableBox onClick={() => route.rightButtonAction()} style={styles.navBarRightButton}>
          <Box>
            <Text type='Body' style={{...styles.navBarButtonText}}>
              {route.rightButtonTitle || 'Done'}
            </Text>
          </Box>
        </ClickableBox>
      )
    },

    Title: function (route, navigator, index, navState) {
      return !!route.title &&
        <Box style={styles.navBarTitleText}>
          <Text type='BodySmallSemibold' style={styles.navBarTitleTextText}>
            {route.title.toUpperCase()}
          </Text>
        </Box>
    },
  }
}

type Props = any

class Nav extends Component<void, Props, void> {

  constructor (props: Props) {
    super(props)

    this.props.bootstrap()
    this.props.listenForNotifications()

    // Introduce ourselves to the service
    hello(0, 'iOS app', [], '0.0.0') // TODO real version
  }

  navBar () {
    return (
      <NativeNavigator.NavigationBar
        routeMapper={NavigationBarRouteMapper(this.props.navigateTo, this.props.navigateUp)} />
    )
  }

  _renderContent (tab, module) {
    const tabStyle = {
      flex: 1,
      marginBottom: 0,
    }

    return (
      <Box style={tabStyle}>
        <MetaNavigator
          tab={tab}
          globalRoutes={globalRoutes}
          rootComponent={module || NoTab}
          Navigator={NativeNavigator}
          NavBar={this.navBar()}
          navBarHeight={navBarHeight}
        />
        <GlobalError />
      </Box>
    )
  }

  _activeTab () {
    return this.props.router.get('activeTab')
  }

  render () {
    if (this.props.dumbFullscreen) {
      return <DumbSheet />
    }

    const activeTab = this._activeTab()

    if (activeTab === loginTab) {
      return this._renderContent(loginTab, Login)
    }

    const {module} = tabs[activeTab]
    if (activeTab === startupTab) {
      return this._renderContent(activeTab, module)
    }

    const enablePushPrompt = this.props.provisioned && this.props.permissionsPrompt
    const tabContent = mapValues(tabs, ({module}, tab) => (activeTab === tab && this._renderContent(tab, module)))
    return (
      <Box style={{flex: 1}}>
        {!enablePushPrompt && <TabBar onTabClick={this.props.switchTab} selectedTab={activeTab} username={this.props.username} badgeNumbers={{[folderTab]: this.props.folderBadge}} tabContent={tabContent} />}
        <Push prompt={enablePushPrompt} />
      </Box>
    )
  }
}

const commonStyles = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 24,
}

const styles = {
  navBarTitleTextText: {
    fontSize: 15,
    color: globalColors.black_75,
  },
  navBarTitleText: {
    ...commonStyles,
  },
  navBarLeftButton: {
    ...commonStyles,
    paddingLeft: 10,
    paddingRight: 10,
  },
  navBarRightButton: {
    ...commonStyles,
    paddingLeft: 10,
    paddingRight: 10,
  },
  navBarButtonText: {
    ...commonStyles,
    color: globalColors.blue,
  },
}

export default connect(
  (state: any) => {
    const {router, favorite: {privateBadge, publicBadge}, config: {extendedConfig, username}, push: {permissionsPrompt}, dev: {debugConfig: {dumbFullscreen}}} = state
    return ({
      router,
      provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
      username,
      dumbFullscreen,
      folderBadge: privateBadge + publicBadge,
      permissionsPrompt,
    })
  },
  (dispatch: any) => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      navigateUp: () => dispatch(navigateUp()),
      navigateTo: uri => dispatch(navigateTo(uri)),
      bootstrap: () => dispatch(bootstrap()),
      listenForNotifications: () => dispatch(listenForNotifications()),
    }
  }
)(Nav)
