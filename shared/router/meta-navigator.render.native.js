import React, {Component} from 'react'
import {View} from 'react-native'

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
            <View style={{flex: 1, marginTop: route.hideNavBar ? 0 : this.props.navBarHeight}}>
              {element}
              {!element && Module && <Module {...route.props} />}
            </View>
          )
        }}
        navigationBar={componentAtTop.hideNavBar ? null : NavBar}
      />
    )
  }
}

MetaNavigatorRender.propTypes = {
  NavBar: React.PropTypes.object.isRequired,
  Navigator: React.PropTypes.func.isRequired,
  getComponentAtTop: React.PropTypes.func.isRequired,
  navBarHeight: React.PropTypes.number.isRequired,
  rootComponent: React.PropTypes.oneOfType([
    React.PropTypes.func,
    React.PropTypes.shape({
      parseRoute: React.PropTypes.func.isRequired,
    }),
  ]).isRequired,
  setNavigator: React.PropTypes.func.isRequired,
  uri: React.PropTypes.object.isRequired,
}
