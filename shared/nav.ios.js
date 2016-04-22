import React, {Component} from 'react'
import {View, Navigator, Text, TouchableOpacity, StyleSheet} from 'react-native'

import {mapValues} from 'lodash'

import TabBar from './tab-bar/index.render.native'

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

import type {VisibleTab} from './constants/tabs'
import {devicesTab, moreTab, startupTab, folderTab, peopleTab, loginTab, profileTab} from './constants/tabs'

const tabs: {[key: VisibleTab]: {module: any}} = {
  [profileTab]: {module: Login, name: 'Login'},
  [devicesTab]: {module: Devices, name: 'Devices'},
  [folderTab]: {module: More, name: 'More'},
  [peopleTab]: {module: More, name: 'More'},
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

  shouldComponentUpdate (nextProps, nextState) {
    const activeTab = this.props.tabbedRouter.get('activeTab')
    const nextActiveTab = nextProps.tabbedRouter.get('activeTab')
    if (activeTab !== nextActiveTab) {
      return true
    }

    if (this.props.config.navState !== nextProps.config.navState) {
      return true
    }

    return false
  }

  render () {
    const activeTab = this.props.tabbedRouter.get('activeTab')

    // if (this.props.config.navState === Constants.navStartingUp) {
      // return (
        // <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          // <Text>Loading...</Text>
        // </View>
      // )
    // }

    // if (this.props.config.navState === Constants.navErrorStartingUp) {
      // return (
        // <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          // <Text>Error Loading: {this.props.config.error.toString()}</Text>
          // <Button type='Secondary' title='Retry' onPress={() => this.props.startup()} isAction />
        // </View>
      // )
    // }

    if (activeTab === loginTab) {
      return this._renderContent(loginTab, Login)
    }

    const {module} = tabs[activeTab]
    if (activeTab === startupTab) {
      return this._renderContent(activeTab, module)
    }

    const tabContent = mapValues(tabs, ({module}, tab) => (activeTab === tab && this._renderContent(tab, module)))

    return (
      <View style={{flex: 1}}>
        <TabBar onTabClick={t => console.log('clicked tab:', t)} selectedTab={activeTab} username='max' badgeNumbers={{}} tabContent={tabContent}/>
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
  store => store,
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      navigateUp: () => dispatch(navigateUp()),
      navigateTo: uri => dispatch(navigateTo(uri)),
      bootstrap: () => dispatch(bootstrap())
    }
  }
)(Nav)
