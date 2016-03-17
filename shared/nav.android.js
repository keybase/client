import React, {Component} from 'react'
import {Text, View, StyleSheet, BackAndroid, DrawerLayoutAndroid, Image, TouchableNativeFeedback, ViewPagerAndroid} from 'react-native'

import {connect} from 'react-redux'
import MetaNavigator from './router/meta-navigator'
import globalRoutes from './router/global-routes'

import Folders from './folders'
import Chat from './chat'
import People from './people'
import Devices from './devices'
import NoTab from './no-tab'
import More from './more'

import {folderTab, chatTab, peopleTab, devicesTab, moreTab, startupTab, prettify} from './constants/tabs'

import {switchTab} from './actions/tabbed-router'
import {navigateBack} from './actions/router'
import {bootstrap} from './actions/config'

const tabs = {
  [folderTab]: Folders,
  [chatTab]: Chat,
  [peopleTab]: People,
  [devicesTab]: Devices,
  [moreTab]: More
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
    this.props.bootstrap()
  }

  _renderContent (activeTab) {
    const module = tabs[activeTab]
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

    // if (this.props.config.navState === Constants.navStartingUp) {
      // return (
        // <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          // <Text>Loading...</Text>
        // </View>
      // )
    // }

    if (activeTab === startupTab) {
      return this._renderContent(startupTab)
    }

    const drawerContnet = (
      <View style={{flex: 1, backgroundColor: '#fff'}}>
        <Text style={{margin: 10, fontSize: 15, textAlign: 'left'}}>I'm in the Drawer!</Text>
      </View>
    )

    const tabKeys = Object.keys(tabs)

    let activeIndex = tabKeys.indexOf(activeTab)
    activeIndex = activeIndex === -1 ? 0 : activeIndex

    const tabViews = tabKeys.map(k => {
      return (
        <View key={k}>
          {this._renderContent(k)}
        </View>
      )
    })

    const tabBarNames = tabKeys.map((k, i) => {
      return (
        <TouchableNativeFeedback
          key={k}
          onPress={() => {
            if (this._viewPagerRef) {
              this._viewPagerRef.setPage(i)
              this.props.switchTab(k)
            }
          }}>
          <View style={{flex: 0}}>
            <Text>{prettify(k)}</Text>
          </View>
        </TouchableNativeFeedback>
      )
    })

    const tabBar = (
      <View style={{flex: 0, flexDirection: 'row', justifyContent: 'space-around'}}>{tabBarNames}</View>
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
                  onPress={() => this.refs.drawer && this.refs.drawer.openDrawer()}
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
                  onPress={() => console.log('todo: show search')}
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
            {tabBar}
            <ViewPagerAndroid
              ref={r => (this._viewPagerRef = r)}
              style={{flex: 1}}
              initialPage={activeIndex}
              onPageSelected={e => this.props.switchTab(tabKeys[e.nativeEvent.position])}>
              {tabViews}
            </ViewPagerAndroid>
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
  }).isRequired
}

const styles = StyleSheet.create({
  tabContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
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
      bootstrap: () => dispatch(bootstrap())
    }
  }
)(Nav)
