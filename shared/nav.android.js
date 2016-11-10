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
import React, {Component} from 'react'
import Search from './search'
import Settings from './settings'
import TabBar from './tab-bar/index.render.native'
import globalRoutes from './router/global-routes'
import hello from './util/hello'
import {Text, Box, NativeBackAndroid, NativeDrawerLayoutAndroid, NativeImage, NativeTouchableNativeFeedback} from './common-adapters/index.native'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {listenForNotifications} from './actions/notifications'
import {mapValues} from 'lodash'
import {navigateUp, switchTab} from './actions/router'
import {profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab, tabPrettify} from './constants/tabs'
import {setupSource} from './util/forward-logs.native'

import type {Tab} from './constants/tabs'

module.hot && module.hot.accept(() => {
  console.log('accepted update in nav.android')
})

const tabs: {[key: Tab]: {module: any}} = {
  [settingsTab]: {module: Settings, name: 'Settings'},
  [profileTab]: {module: ProfileContainer, name: 'Profile'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Chat, name: 'Chat'},
  [peopleTab]: {module: Search, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'},
}

setupSource()

class AndroidNavigator extends Component {
  push (componentAtTop) {
    return false
  }

  getCurrentRoutes () {
    return []
  }

  popToRoute (targetRoute) {
    return false
  }

  immediatelyResetRouteStack () {
    return false
  }

  render () {
    let componentAtTop = this.props.initialRouteStack[this.props.initialRouteStack.length - 1]
    return this.props.renderScene(componentAtTop, null)
  }
}

AndroidNavigator.propTypes = {
  initialRouteStack: React.PropTypes.array.isRequired,
  renderScene: React.PropTypes.func.isRequired,
}

class Nav extends Component {
  constructor (props) {
    super(props)
    this.props.bootstrap()
    this.props.listenForNotifications()

    // Introduce ourselves to the service
    hello(0, 'Android app', [], '0.0.0') // TODO real version
  }

  _renderContent (activeTab, module) {
    return (
      <Box style={styles.tabContent} collapsable={false}>
        <MetaNavigator
          rootComponent={module || NoTab}
          tab={activeTab}
          globalRoutes={globalRoutes}
          navBarHeight={0}
          Navigator={AndroidNavigator}
          NavBar={<Box />}
        />
        <GlobalError />
      </Box>
    )
  }

  componentWillMount () {
    NativeBackAndroid.addEventListener('hardwareBackPress', () => {
      // Just going up vs back for now
      const currentRoute = this.props.router.getIn(['tabs', this.props.router.get('activeTab'), 'uri'])
      if (currentRoute == null || currentRoute.count() <= 1) {
        return false
      }
      this.props.navigateUp()
      return true
    })
  }

  render () {
    if (this.props.dumbFullscreen) {
      return <DumbSheet />
    }

    const activeTab = this.props.router.get('activeTab')

    if (activeTab === loginTab) {
      return this._renderContent(loginTab, Login)
    }

    const drawerContent = (
      <Box style={{flex: 1, backgroundColor: '#fff'}}>
        <Text type='Header' style={{margin: 10, fontSize: 15, textAlign: 'left'}}>I'm in the Drawer!</Text>
      </Box>
    )

    const tabContent = mapValues(tabs, ({module}, tab) => (activeTab === tab && this._renderContent(tab, module)))
    const username = this.props.username

    return (
      <NativeDrawerLayoutAndroid
        drawerWidth={300}
        ref='drawer'
        drawerPosition={NativeDrawerLayoutAndroid.positions.Left}
        renderNavigationView={() => drawerContent}>
        <Box collapsable={false} style={{flex: 1}}>
          <Box
            title={''}
            style={styles.toolbar}>
            <Box collapsable={false} style={styles.toolbarContent}>
              <Box style={{flex: 0}}>
                <NativeTouchableNativeFeedback
                  onPress={() => this.refs.drawer && this.refs.drawer.openDrawer()}
                  delayPressIn={0}
                  background={NativeTouchableNativeFeedback.SelectableBackground()} >
                  <Box>
                    <NativeImage style={{...styles.toolbarImage, ...{marginTop: 4}}} resizeMode={'contain'} source={require('./images/nav/ic_menu_black_24dp.png')} />
                  </Box>
                </NativeTouchableNativeFeedback>
              </Box>

              <Box style={{marginLeft: 40}}>
                <Text type='Header'>{tabPrettify(activeTab)}</Text>
              </Box>

              <Box style={styles.toolbarSearchWrapper}>
                <NativeTouchableNativeFeedback
                  onPress={() => console.log('todo: show search')}
                  delayPressIn={0}
                  background={NativeTouchableNativeFeedback.SelectableBackground()}>
                  <Box>
                    <NativeImage style={styles.toolbarImage} resizeMode={'contain'} source={require('./images/nav/ic_search_black_24dp.png')} />
                  </Box>
                </NativeTouchableNativeFeedback>
              </Box>
            </Box>
          </Box>
          <Box collapsable={false} style={{flex: 2}}>
            <TabBar onTabClick={this.props.switchTab} selectedTab={activeTab} username={username} badgeNumbers={{[folderTab]: this.props.folderBadge}} tabContent={tabContent} />
          </Box>
        </Box>
      </NativeDrawerLayoutAndroid>
    )
  }
}

const styles = {
  tabContent: {
    flex: 1,
  },
  toolbar: {
    height: 50,
    flex: 0,
  },

  toolbarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 10,
  },

  toolbarImage: {
    height: 40,
    width: 30,
  },

  toolbarSearchWrapper: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
}

// $FlowIssue
export default connect(
  ({
    router,
    config: {bootstrapped, extendedConfig, username},
    dev: {debugConfig: {dumbFullscreen}},
    favorite: {publicBadge, privateBadge},
    notifications: {menuBadge}}) => ({
      router,
      bootstrapped,
      provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
      username,
      dumbFullscreen,
      folderBadge: privateBadge + publicBadge,
    }),
  dispatch => ({
    switchTab: tab => dispatch(switchTab(tab)),
    navigateUp: () => dispatch(navigateUp()),
    bootstrap: () => dispatch(bootstrap()),
    listenForNotifications: () => dispatch(listenForNotifications()),
  })
)(Nav)
