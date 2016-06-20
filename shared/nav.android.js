import React, {Component} from 'react'
import {Text, View, StyleSheet, BackAndroid, DrawerLayoutAndroid, Image, TouchableNativeFeedback} from 'react-native'

import {connect} from 'react-redux'
import MetaNavigator from './router/meta-navigator'
import globalRoutes from './router/global-routes'
import TabBar from './tab-bar/index.render.native'

import Devices from './devices'
import NoTab from './no-tab'
import Settings from './settings'
import Profile from './profile'
import Login from './login'
import {mapValues} from 'lodash'

import {dumbFullscreen} from './local-debug'
import DumbSheet from './dev/dumb-sheet'

import {profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab, prettify} from './constants/tabs'

import {switchTab} from './actions/tabbed-router'
import {navigateBack} from './actions/router'
import {bootstrap} from './actions/config'
import ListenLogUi from './native/listen-log-ui'
import {listenForNotifications} from './actions/notifications'
import hello from './util/hello'

import forwardLogs from './native/forward-logs'

const tabs: {[key: VisibleTab]: {module: any}} = {
  [settingsTab]: {module: Settings, name: 'Settings'},
  [profileTab]: {module: Profile, name: 'Profile'},
  [folderTab]: {module: Settings, name: 'Folders'},
  [chatTab]: {module: Settings, name: 'Chat'},
  [peopleTab]: {module: Settings, name: 'People'},
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
      const currentRoute = this.props.tabbedRouter.getIn(['tabs', this.props.tabbedRouter.get('activeTab'), 'uri'])
      if (currentRoute == null || currentRoute.count() <= 1) {
        return false
      }
      this.props.navigateBack()
      return true
    })
  }

  render () {
    if (dumbFullscreen) {
      return <DumbSheet />
    }

    const activeTab = this.props.tabbedRouter.get('activeTab')

    if (activeTab === loginTab) {
      return this._renderContent(loginTab, Login)
    }

    const drawerContent = (
      <View style={{flex: 1, backgroundColor: '#fff'}}>
        <Text style={{margin: 10, fontSize: 15, textAlign: 'left'}}>I'm in the Drawer!</Text>
      </View>
    )

    const tabContent = mapValues(tabs, ({module}, tab) => (activeTab === tab && this._renderContent(tab, module)))

    const username = this.props.config.username

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
            <TabBar onTabClick={this.props.switchTab} selectedTab={activeTab} username={username} badgeNumbers={{}} tabContent={tabContent} />

          </View>
        </View>
      </DrawerLayoutAndroid>

    )
  }
}

Nav.propTypes = {
  switchTab: React.PropTypes.func.isRequired,
  navigateBack: React.PropTypes.func.isRequired,
  bootstrap: React.PropTypes.func.isRequired,
  tabbedRouter: React.PropTypes.object.isRequired,
  config: React.PropTypes.shape({
  }).isRequired,
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
  store => store,
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      navigateBack: () => dispatch(navigateBack()),
      bootstrap: () => dispatch(bootstrap()),
      listenForNotifications: () => dispatch(listenForNotifications()),
    }
  }
)(Nav)
