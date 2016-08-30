import Devices from './devices'
import DumbSheet from './dev/dumb-sheet'
import Folders from './folders'
import ListenLogUi from './native/listen-log-ui'
import Login from './login'
import MetaNavigator from './router/meta-navigator'
import NoTab from './no-tab'
import ProfileContainer from './profile/container'
import React, {Component} from 'react'
import Search from './search'
import Settings from './settings'
import TabBar from './tab-bar/index.render.native'
import flags from './util/feature-flags'
import forwardLogs from './native/forward-logs'
import globalRoutes from './router/global-routes'
import hello from './util/hello'
import {Text, View, StyleSheet, BackAndroid, DrawerLayoutAndroid, Image, TouchableNativeFeedback} from 'react-native'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {listenForNotifications} from './actions/notifications'
import {mapValues} from 'lodash'
import {navigateBack, switchTab} from './actions/router'
import {profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab, prettify} from './constants/tabs'

const tabs: {[key: VisibleTab]: {module: any}} = {
  [settingsTab]: {module: Settings, name: 'Settings'},
  [profileTab]: {module: ProfileContainer, name: 'Profile'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Settings, name: 'Chat'},
  [peopleTab]: {module: Search, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'},
}

forwardLogs()

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

    // Handle logUi.log
    ListenLogUi()

    // Introduce ourselves to the service
    hello(0, 'Android app', [], '0.0.0') // TODO real version
  }

  _renderContent (activeTab, module) {
    return (
      <View style={styles.tabContent} collapsable={false}>
        <MetaNavigator
          rootComponent={module || NoTab}
          tab={activeTab}
          globalRoutes={globalRoutes}
          navBarHeight={0}
          Navigator={AndroidNavigator}
          NavBar={<View />}
        />
      </View>
    )
  }

  componentWillMount () {
    BackAndroid.addEventListener('hardwareBackPress', () => {
      // TODO Properly handle android back button press
      const currentRoute = this.props.router.getIn(['tabs', this.props.router.get('activeTab'), 'uri'])
      if (currentRoute == null || currentRoute.count() <= 1) {
        return false
      }
      this.props.navigateBack()
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
      <View style={{flex: 1, backgroundColor: '#fff'}}>
        <Text style={{margin: 10, fontSize: 15, textAlign: 'left'}}>I'm in the Drawer!</Text>
      </View>
    )

    const tabContent = mapValues(tabs, ({module}, tab) => (activeTab === tab && this._renderContent(tab, module)))
    const username = this.props.username

    return (
      <DrawerLayoutAndroid
        drawerWidth={300}
        ref='drawer'
        drawerPosition={DrawerLayoutAndroid.positions.Left}
        renderNavigationView={() => drawerContent}>
        <View collapsable={false} style={{flex: 1}}>
          <View
            title={''}
            style={styles.toolbar}>
            <View collapsable={false} style={styles.toolbarContent}>
              <View style={{flex: 0}}>
                <TouchableNativeFeedback
                  onPress={() => this.refs.drawer && this.refs.drawer.openDrawer()}
                  delayPressIn={0}
                  background={TouchableNativeFeedback.SelectableBackground()} >
                  <View>
                    <Image style={[styles.toolbarImage, {marginTop: 4}]} resizeMode={'contain'} source={require('./images/nav/ic_menu_black_24dp.png')} />
                  </View>
                </TouchableNativeFeedback>
              </View>

              <View style={{marginLeft: 40}}>
                <Text style={styles.toolbarName}>{prettify(activeTab)}</Text>
              </View>

              <View style={styles.toolbarSearchWrapper}>
                <TouchableNativeFeedback
                  onPress={() => console.log('todo: show search')}
                  delayPressIn={0}
                  background={TouchableNativeFeedback.SelectableBackground()}>
                  <View>
                    <Image style={styles.toolbarImage} resizeMode={'contain'} source={require('./images/nav/ic_search_black_24dp.png')} />
                  </View>
                </TouchableNativeFeedback>
              </View>
            </View>
          </View>
          <View collapsable={false} style={{flex: 2}}>
            <TabBar onTabClick={this.props.switchTab} selectedTab={activeTab} username={username} badgeNumbers={{[folderTab]: this.props.folderBadge}} tabContent={tabContent} />
          </View>
        </View>
      </DrawerLayoutAndroid>

    )
  }
}

const styles = StyleSheet.create({
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

  toolbarName: {
    fontWeight: 'bold',
    fontSize: 24,
    color: 'black',
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
})

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
      folderBadge: flags.tabFoldersEnabled ? privateBadge + publicBadge : 0,
    }),
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      navigateBack: () => dispatch(navigateBack()),
      bootstrap: () => dispatch(bootstrap()),
      listenForNotifications: () => dispatch(listenForNotifications()),
    }
  }
)(Nav)
