import React, {Component} from 'react'
import {TabBarIOS, View, Navigator, Text, TouchableOpacity, StyleSheet} from 'react-native'

import {connect} from 'react-redux'

import MetaNavigator from './router/meta-navigator'
import globalRoutes from './router/global-routes'

import Devices from './devices'
import NoTab from './no-tab'
import More from './more'
import Startup from './start-up'
import Login from './login'

import {switchTab} from './actions/tabbed-router'
import {navigateTo, navigateUp} from './actions/router'
import {bootstrap} from './actions/config'

import {constants as styleConstants} from './styles/common'

import {devicesTab, moreTab, startupTab, loginTab} from './constants/tabs'
import ListenLogUi from './native/listen-log-ui'
import {listenForNotifications} from './actions/notifications'
import hello from './util/hello'

const tabs = {
  [loginTab]: {module: Login, name: 'Login'},
  [devicesTab]: {module: Devices, name: 'Devices'},
  [moreTab]: {module: More, name: 'More'},
  [startupTab]: {module: Startup}
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

      const previousRoute = navState.routeStack[index - 1]

      return (
        <TouchableOpacity
          onPress={() => route.upLink ? navigateTo(route.upLink) : navigateUp()}
          style={styles.navBarLeftButton}>
          <Text style={[styles.navBarText, styles.navBarButtonText]}>
            {route.upTitle || route.leftButtonTitle || previousRoute.title || 'Back'}
          </Text>
        </TouchableOpacity>
      )
    },

    RightButton: function (route, navigator, index, navState) {
      if (!route.rightButtonAction) {
        return null
      }
      return (
        <TouchableOpacity
          onPress={() => route.rightButtonAction()}
          style={styles.navBarRightButton}>
          <Text style={[styles.navBarText, styles.navBarButtonText]}>
            {route.rightButtonTitle || 'Done'}
          </Text>
        </TouchableOpacity>
      )
    },

    Title: function (route, navigator, index, navState) {
      return (
        <Text style={[styles.navBarText, styles.navBarTitleText]}>
          {route.title || ''}
        </Text>
      )
    }
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

    // TODO android also!
  }

  navBar () {
    return (
      <Navigator.NavigationBar
        style={styles.navBar}
        routeMapper={NavigationBarRouteMapper(this.props.navigateTo, this.props.navigateUp)}/>
    )
  }

  _renderContent (tab, module) {
    const tabStyle = {
      flex: 1,
      marginBottom: tab === loginTab ? 0 : styleConstants.tabBarHeight
    }

    return (
      <View style={tabStyle}>
        <MetaNavigator
          tab={tab}
          globalRoutes={globalRoutes}
          rootComponent={module || NoTab}
          Navigator={Navigator}
          NavBar={this.navBar()}
          navBarHeight={styleConstants.navBarHeight}
        />
      </View>
    )
  }

  _activeTab () {
    return this.props.tabbedRouter.get('activeTab')
  }

  shouldComponentUpdate (nextProps, nextState) {
    return (nextProps.tabbedRouter.get('activeTab') !== this._activeTab())
  }

  render () {
    const activeTab = this._activeTab()

    if (activeTab === loginTab) {
      return this._renderContent(loginTab, Login)
    }

    const {module} = tabs[activeTab]
    if (activeTab === startupTab) {
      return this._renderContent(activeTab, module)
    }

    return (
      <View style={{flex: 1}}>
        <TabBarIOS tintColor='black' translucent={false}>
        {Object.keys(tabs).map(tab => {
          const {name} = tabs[tab]

          return (name &&
            <TabBarIOS.Item
              key={tab}
              title={name}
              selected={activeTab === tab}
              onPress={() => this.props.switchTab(tab)}>
              {activeTab === tab && this._renderContent(tab, module)}
            </TabBarIOS.Item>
          ) })
        }
        </TabBarIOS>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  navBar: {
    backgroundColor: 'white'
  },
  navBarText: {
    fontSize: 16,
    marginVertical: 10
  },
  navBarTitleText: {
    color: 'blue',
    fontWeight: '500',
    marginVertical: 9
  },
  navBarLeftButton: {
    paddingLeft: 10
  },
  navBarRightButton: {
    paddingRight: 10
  },
  navBarButtonText: {
    color: 'blue'
  }
})

export default connect(
  ({tabbedRouter, config: {bootstrapped, extendedConfig}}) => ({
    tabbedRouter,
    bootstrapped,
    provisioned: extendedConfig && !!extendedConfig.device
  }),
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      navigateUp: () => dispatch(navigateUp()),
      navigateTo: uri => dispatch(navigateTo(uri)),
      bootstrap: () => dispatch(bootstrap()),
      listenForNotifications: () => dispatch(listenForNotifications())
    }
  }
)(Nav)
