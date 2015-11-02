'use strict'

import React, { View } from 'react-native'
import { connect } from '../base-redux'

export default function () {
  const { store, rootComponent, uri, NavBar, Navigator } = this.props

  let {componentAtTop, routeStack} = this.getComponentAtTop(rootComponent, store, uri)

  return (
    <Navigator
      saveName='main'
      ref='navigator'
      initialRouteStack={routeStack.toJS()}
      configureScene={route => route.sceneConfig || Navigator.SceneConfigs.FloatFromRight }
      renderScene={(route, navigator) => {
        return (
          <View style={{flex: 1, marginTop: route.hideNavBar ? 0 : this.props.navBarHeight}}>
            {React.createElement(connect(route.mapStateToProps || (state => { return {} }))(route.component), {...route.props})}
          </View>
        )
      }}
      navigationBar={componentAtTop.hideNavBar ? null : NavBar}
    />
  )
}
