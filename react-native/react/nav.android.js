import TabBar from './native/tab-bar'
import {connect} from './base-redux'
import MetaNavigator from './router/meta-navigator'
import globalRoutes from './router/global-routes'

import Folders from './folders'
import Chat from './chat'
import People from './people'
import Devices from './devices'
import NoTab from './no-tab'
import More from './more'
import Startup from './start-up'

import React, {Component, Text, View, StyleSheet, BackAndroid, DrawerLayoutAndroid, Image, TouchableNativeFeedback} from './base-react'

import {folderTab, chatTab, peopleTab, devicesTab, moreTab, startupTab, prettify} from './constants/tabs'
import {androidTabBarHeight} from './styles/native'

import {switchTab} from './actions/tabbed-router'
import {navigateBack} from './actions/router'
import {startup} from './actions/config'

import * as Constants from './constants/config'

const tabs = {
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Chat, name: 'Chat'},
  [peopleTab]: {module: People, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'},
  [moreTab]: {module: More, name: 'More'},
  [startupTab]: {module: Startup, name: null}
}

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
  renderScene: React.PropTypes.func.isRequired
}

class Nav extends Component {
  constructor (props) {
    super(props)
    this.props.startup()
  }

  _renderContent (activeTab) {
    const {module} = tabs[activeTab]
    return (
      <View style={styles.tabContent} collapsable={false}>
        <MetaNavigator
          rootComponent={module || NoTab}
          tab={activeTab}
          globalRoutes={globalRoutes}
          navBarHeight={0}
          Navigator={AndroidNavigator}
          NavBar={<View/>}
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
    const activeTab = this.props.tabbedRouter.get('activeTab')

    if (this.props.config.navState === Constants.navStartingUp) {
      return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Text>Loading...</Text>
        </View>
      )
    }

    if (activeTab === startupTab) {
      return this._renderContent(startupTab)
    }

    const drawerContnet = (
      <View style={{flex: 1, backgroundColor: '#fff'}}>
        <Text style={{margin: 10, fontSize: 15, textAlign: 'left'}}>I'm in the Drawer!</Text>
      </View>
    )

    return (
      <DrawerLayoutAndroid
        drawerWidth={300}
        ref='drawer'
        drawerPosition={DrawerLayoutAndroid.positions.Left}
        renderNavigationView={() => drawerContnet}>
        <View collapsable={false} style={{flex: 1}}>
            <View
              title={''}
              style={styles.toolbar}>
              <View collapsable={false} style={styles.toolbarContent}>
                <View style={{flex: 0}}>
                <TouchableNativeFeedback
                  onPress={ () => this.refs.drawer && this.refs.drawer.openDrawer() }
                  delayPressIn={0}
                  background={TouchableNativeFeedback.SelectableBackground()} >
                  <View>
                    <Image style={[styles.toolbarImage, {marginTop: 4}]} resizeMode={'contain'} source={require('./images/nav/ic_menu_black_24dp.png')}/>
                  </View>
                </TouchableNativeFeedback>
              </View>

                <View style={{marginLeft: 40}}>
                  <Text style={styles.toolbarName}>{prettify(activeTab)}</Text>
                </View>

                <View style={styles.toolbarSearchWrapper}>
                  <TouchableNativeFeedback
                    onPress={ () => console.log('todo: show search')}
                    delayPressIn={0}
                    background={TouchableNativeFeedback.SelectableBackground()}>
                    <View>
                      <Image style={styles.toolbarImage} resizeMode={'contain'} source={require('./images/nav/ic_search_black_24dp.png')}/>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              </View>
            </View>
          <View collapsable={false} style={{flex: 2}}>
            <TabBar style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}}>
              { Object.keys(tabs).map(tab => {
                const {name} = tabs[tab]
                return (
                  name &&
                  <TabBar.Item
                    title={name}
                    selected={activeTab === tab}
                    onPress={() => this.props.switchTab(tab)}>
                    {this._renderContent(tab)}
                  </TabBar.Item>
                ) })
              }
            </TabBar>
          </View>
        </View>
      </DrawerLayoutAndroid>

    )
  }
}

Nav.propTypes = {
  switchTab: React.PropTypes.func.isRequired,
  navigateBack: React.PropTypes.func.isRequired,
  startup: React.PropTypes.func.isRequired,
  tabbedRouter: React.PropTypes.object.isRequired,
  config: React.PropTypes.shape({
    navState: React.PropTypes.oneOf([Constants.navStartingUp, Constants.navNeedsRegistration, Constants.navNeedsLogin, Constants.navLoggedIn])
  }).isRequired
}

const styles = StyleSheet.create({
  tabContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    marginBottom: androidTabBarHeight
  },
  toolbar: {
    height: 50,
    flex: 0
  },

  toolbarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 10
  },

  toolbarName: {
    fontWeight: 'bold',
    fontSize: 24,
    color: 'black'
  },

  toolbarImage: {
    height: 40,
    width: 30
  },

  toolbarSearchWrapper: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end'
  }
})

export default connect(
  store => store,
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      navigateBack: () => dispatch(navigateBack()),
      startup: () => dispatch(startup())
    }
  }
)(Nav)
