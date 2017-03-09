// @flow
import GlobalError from './global-errors/container'
import React from 'react'
import TabBar from './tab-bar/index.render.native'
import {Box, NativeKeyboardAvoidingView} from './common-adapters/index.native'
import {NavigationExperimental, Keyboard, StatusBar} from 'react-native'
import {chatTab, loginTab, folderTab} from './constants/tabs'
import {connect} from 'react-redux'
import {globalColors, globalStyles, statusBarHeight} from './styles/index.native'
import {isAndroid} from './constants/platform'
import {navigateTo, navigateUp, switchTo} from './actions/route-tree'

import type {Props} from './nav'
import type {Tab} from './constants/tabs'

const {
  CardStack: NavigationCardStack,
} = NavigationExperimental

const StackWrapper = ({children}) => {
  if (isAndroid) {
    return children
  } else {
    return <NativeKeyboardAvoidingView behavior={'padding'} style={sceneWrapStyleUnder} children={children} />
  }
}

function Nav (props: Props) {
  const visibleScreens = props.routeStack.filter(r => !r.tags.layerOnTop)
  if (!visibleScreens.size) {
    throw new Error('no route component to render without layerOnTop tag')
  }
  const navigationState = {
    index: visibleScreens.size - 1,
    routes: visibleScreens.map(r => ({
      component: r.component,
      key: r.path.join('/'),
      tags: r.tags,
    })).toArray(),
  }
  const layerScreens = props.routeStack.filter(r => r.tags.layerOnTop)

  return (
    <Box style={flexOne}>
      <StackWrapper>
        <Box style={flexColumnOne}>
          <NavigationCardStack
            key={props.routeSelected}
            navigationState={navigationState}
            renderScene={({scene}) => {
              return (
                <Box style={scene.route.tags.underStatusBar ? sceneWrapStyleUnder : sceneWrapStyleOver}>
                  <StatusBar hidden={scene.route.tags.hideStatusBar} />
                  {scene.route.component}
                </Box>
              )
            }}
            onNavigateBack={props.navigateUp}
          />
          {layerScreens.map(r => r.leafComponent)}
        </Box>
      </StackWrapper>
      {!props.hideNav &&
        <TabBar
          onTabClick={props.switchTab}
          selectedTab={props.routeSelected}
          username={props.username}
          badgeNumbers={{
            [chatTab]: props.chatBadge,
            [folderTab]: props.folderBadge,
          }}
        />
      }
      <GlobalError />
    </Box>
  )
}

class HideNavOnKeyboard extends React.Component {
  keyboardWillShowListener: any;
  keyboardWillHideListener: any;

  componentWillMount () {
    this.keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', this._keyboardWillShow)
    this.keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', this._keyboardWillHide)
  }

  componentWillUnmount () {
    this.keyboardWillShowListener.remove()
    this.keyboardWillHideListener.remove()
  }

  state = {
    hidden: false,
  }

  _keyboardWillShow = () => {
    this.setState({
      hidden: true,
    })
  }

  _keyboardWillHide = () => {
    this.setState({
      hidden: false,
    })
  }

  render () {
    return <Nav {...this.props} hideNav={this.props.hideNav || this.state.hidden} />
  }
}

const sceneWrapStyleUnder = {
  backgroundColor: globalColors.white,
  flex: 1,
}

const sceneWrapStyleOver = {
  backgroundColor: globalColors.white,
  flex: 1,
  paddingTop: statusBarHeight,
}

const flexColumnOne = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const flexOne = {
  flex: 1,
}

export default connect(
  ({
    config: {extendedConfig, username},
    dev: {debugConfig: {dumbFullscreen}},
    notifications: {menuBadge, menuNotifications},
  }, {routeSelected}) => ({
    chatBadge: menuNotifications.chatBadge,
    dumbFullscreen,
    folderBadge: menuNotifications.folderBadge,
    provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
    username,
    hideNav: routeSelected === loginTab,
  }),
  (dispatch: any, {routeSelected, routePath}) => ({
    navigateUp: () => dispatch(navigateUp()),
    switchTab: (tab: Tab) => {
      if (tab === chatTab && routeSelected === tab) {
        // clicking the chat tab when already selected should persistState and nav to the chat tab
        dispatch(navigateTo(routePath.push(tab), null, true))
        return
      }

      const action = routeSelected === tab ? navigateTo : switchTo
      dispatch(action(routePath.push(tab)))
    },
  })
)(isAndroid ? HideNavOnKeyboard : Nav)
