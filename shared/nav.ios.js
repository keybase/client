// @flow
import Devices from './devices'
import DumbSheet from './dev/dumb-sheet'
import Folders from './folders'
import GlobalError from './global-errors/container'
import Login from './login'
import MetaNavigator from './router/meta-navigator'
import NoTab from './no-tab'
import ProfileContainer from './profile/container'
import PushNotification from 'react-native-push-notification'
import React, {Component} from 'react'
// import {PushNotificationIOS} from 'react-native'
import Search from './search'
import Settings from './settings'
import TabBar from './tab-bar/index.render.native'
import globalRoutes from './router/global-routes'
import hello from './util/hello'
import {Box, NativeNavigator, Text, ClickableBox, Icon, Button} from './common-adapters/index.native'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {globalStyles, globalColors, navBarHeight} from './styles/index.native'
import {listenForNotifications} from './actions/notifications'
import {mapValues} from 'lodash'
import {navigateTo, navigateUp, switchTab} from './actions/router'
import {startupTab, profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab} from './constants/tabs'

import type {VisibleTab} from './constants/tabs'

const tabs: {[key: VisibleTab]: {module: any}} = {
  [settingsTab]: {module: Settings, name: 'Settings'},
  [profileTab]: {module: ProfileContainer, name: 'Profile'},
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

type State = {
  askForPush: boolean,
}

type Props = any

class Nav extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      askForPush: true,
    }

    this.props.bootstrap()
    this.props.listenForNotifications()

    // Introduce ourselves to the service
    hello(0, 'iOS app', [], '0.0.0') // TODO real version

    // PushNotificationIOS.addEventListener('register', token => this.props.pushGotToken(token))

    PushNotification.configure({
      onRegister: token => this.props.pushGotToken(token),
      onNotification: notification => this.props.pushGotNotification(notification),
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    })

    PushNotification.checkPermissions(permissions => {
      console.log('aaaa', permissions)
      if (permissions.alert) {
        this.setState({askForPush: false})

        console.log('requesting persmissions')
        PushNotification.requestPermissions()

        console.log('aaa sending local notification')
        setTimeout(() => {
          PushNotification.localNotification({
            message: 'My Notification Message', // (required)
          })
        }, 2000)
      }
    })
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

  _onSeenPushWarning () {
    this.setState({askForPush: false})

    console.log('requesting persmissions')
    PushNotification.requestPermissions()
  }

  _renderAskForPush () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, backgroundColor: globalColors.black_75, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center'}}>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'stretch', backgroundColor: globalColors.darkBlue3, padding: 20, margin: 40, borderRadius: 10}}>
          <Text type='Body' backgroundMode='Terminal' style={{textAlign: 'center'}}>It's <Text type='BodySemibold' backgroundMode='Terminal' >very</Text> important you enable notifications.</Text>
          <Text type='Body' backgroundMode='Terminal' style={{textAlign: 'center', marginTop: 20}}>
              This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if you provision a new device, this phone will be contacted.
          </Text>
          <Box style={{alignSelf: 'flex-end', marginTop: 20}}>
            <Button type='Primary' onClick={() => this._onSeenPushWarning()} label='Got it!' />
          </Box>
        </Box>
      </Box>
    )
  }

  _activeTab () {
    return this.props.router.get('activeTab')
  }

  shouldComponentUpdate (nextProps, nextState) {
    return (nextProps.router.get('activeTab') !== this._activeTab() ||
      nextProps.dumbFullscreen !== this.props.dumbFullscreen ||
      nextState !== this.state)
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
        {this.state.askForPush && this._renderAskForPush()}
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

// $FlowIssue
export default connect(
  ({router, favorite: {privateBadge, publicBadge}, config: {bootstrapped, extendedConfig, username}, dev: {debugConfig: {dumbFullscreen}}}) => ({
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
    navigateTo: uri => dispatch(navigateTo(uri)),
    bootstrap: () => dispatch(bootstrap()),
    listenForNotifications: () => dispatch(listenForNotifications()),
    pushGotToken: token => console.log('Got token: ', token),
    pushGotNotification: notification => console.log('Got notification: ', notification),
  })
)(Nav)
