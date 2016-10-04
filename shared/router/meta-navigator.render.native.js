// @flow
import React, {Component} from 'react'
import {Box} from '../common-adapters'

export default class MetaNavigatorRender extends Component {
  render () {
    const {rootComponent, uri, NavBar, Navigator, getComponentAtTop} = this.props
    const {componentAtTop, routeStack} = getComponentAtTop(rootComponent, uri)

    return (
      <Navigator
        saveName='main'
        ref={this.props.setNavigator}
        initialRouteStack={routeStack.toJS()}
        configureScene={route => route.sceneConfig || Navigator.SceneConfigs.FloatFromRight}
        renderScene={(route, navigator) => {
          const element = route.element
          const Module = route.component
          return (
            <Box style={{flex: 1, marginTop: route.hideNavBar ? 0 : this.props.navBarHeight}}>
              {element}
              {!element && Module && <Module {...route.props} />}
            </Box>
          )
        }}
        navigationBar={componentAtTop.hideNavBar ? null : NavBar}
      />
    )
  }
}
