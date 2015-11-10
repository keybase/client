'use strict'

import React, { Component, View } from '../base-react'
import { connect } from '../base-redux'

export default class MetaNavigatorRender extends Component {
  render () {
    const { NavBar, Navigator } = this.props

    return (
      <Navigator
        saveName='main'
        ref={this.props.setNavigator}
        initialRouteStack={this.props.routeStack.toJS()}
        configureScene={route => route.sceneConfig || Navigator.SceneConfigs.FloatFromRight }
        renderScene={(route, navigator) => {
          return (
            <View style={{flex: 1, marginTop: route.hideNavBar ? 0 : this.props.navBarHeight}}>
              {React.createElement(connect(route.mapStateToProps || (state => { return {} }))(route.component), {...route.props})}
            </View>
          )
        }}
        navigationBar={this.props.componentAtTop.hideNavBar ? null : NavBar}
      />
    )
  }
}

MetaNavigatorRender.propTypes = {
  NavBar: React.PropTypes.object.isRequired,
  Navigator: React.PropTypes.object.isRequired,
  componentAtTop: React.PropTypes.object.isRequired,
  navBarHeight: React.PropTypes.number.isRequired,
  routeStack: React.PropTypes.object.isRequired,
  setNavigator: React.PropTypes.func.isRequired
}
