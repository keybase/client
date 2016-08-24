import Devices from './devices'
import DumbSheet from './dev/dumb-sheet'
import Folders from './folders'
import ListenLogUi from './native/listen-log-ui'
import Login from './login'
import MetaNavigator from './router/meta-navigator'
import NoTab from './no-tab'
import Profile from './profile'
import React, {Component} from 'react'
import Search from './search'
import Settings from './settings'
import TabBar from './tab-bar/index.render.native'
import flags from './util/feature-flags'
import globalRoutes from './router/global-routes'
import hello from './util/hello'
import type {VisibleTab} from './constants/tabs'
import {Box, NativeNavigator, Text, ClickableBox, Icon} from './common-adapters'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {listenForNotifications} from './actions/notifications'
import {mapValues} from 'lodash'
import {globalStyles, globalColors, navBarHeight} from './styles/style-guide'
import {navigateTo, navigateUp, switchTab} from './actions/router'
import {startupTab, profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab} from './constants/tabs'

const tabs: {[key: VisibleTab]: {module: any}} = {
  [settingsTab]: {module: Settings, name: 'Settings'},
  [profileTab]: {module: Profile, name: 'Profile'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Settings, name: 'Chat'},
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

class Nav extends Component {
  constructor (props) {
    super(props)

    this.props.bootstrap()
    this.props.listenForNotifications()

    // Handle logUi.log
    ListenLogUi()

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
      </Box>
    )
  }

  _activeTab () {
    return this.props.router.get('activeTab')
  }

  shouldComponentUpdate (nextProps, nextState) {
    return (nextProps.router.get('activeTab') !== this._activeTab() ||
            nextProps.dumbFullscreen !== this.props.dumbFullscreen)
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

    const tabContent = mapValues(tabs, ({module}, tab) => (activeTab === tab && this._renderContent(tab, module)))

    return (
      <Box style={{flex: 1}}>
        <TabBar onTabClick={this.props.switchTab} selectedTab={activeTab} username={this.props.username} badgeNumbers={{[folderTab]: this.props.folderBadge}} tabContent={tabContent} />
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
  ({router, favorite: {privateBadge, publicBadge}, config: {bootstrapped, extendedConfig, username}, dev: {debugConfig: {dumbFullscreen}}}) => ({
    router,
    bootstrapped,
    provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
    username,
    dumbFullscreen,
    folderBadge: flags.tabFoldersEnabled ? privateBadge + publicBadge : 0,
  }),
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      navigateUp: () => dispatch(navigateUp()),
      navigateTo: uri => dispatch(navigateTo(uri)),
      bootstrap: () => dispatch(bootstrap()),
      listenForNotifications: () => dispatch(listenForNotifications()),
    }
  }
)(Nav)
