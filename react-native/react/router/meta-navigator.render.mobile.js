'use strict'

import React, { View, Component } from '../base-react'
import { connect } from '../base-redux'

export default class MetaNavigatorRender extends Component {
  render () {
    const { store, rootComponent, uri, NavBar, Navigator, getComponentAtTop } = this.props

    let {componentAtTop, routeStack} = getComponentAtTop(rootComponent, store, uri)

    return (
      <Navigator
        saveName='main'
        ref={this.props.setNavigator}
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
}

MetaNavigatorRender.propTypes = {
  uri: React.PropTypes.object.isRequired,
  store: React.PropTypes.object.isRequired,
  rootComponent: React.PropTypes.func.isRequired,
  getComponentAtTop: React.PropTypes.func.isRequired,
  NavBar: React.PropTypes.object.isRequired,
  Navigator: React.PropTypes.object.isRequired,
  setNavigator: React.PropTypes.func.isRequired,
  navBarHeight: React.PropTypes.number.isRequired
}
