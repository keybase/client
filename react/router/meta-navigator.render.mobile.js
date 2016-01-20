import React, {View, Component} from '../base-react'

export default class MetaNavigatorRender extends Component {
  render () {
    const {rootComponent, uri, NavBar, Navigator, getComponentAtTop} = this.props
    const {componentAtTop, routeStack} = getComponentAtTop(rootComponent, uri)
    const Module = componentAtTop.component

    return (
      <Navigator
        saveName='main'
        ref={this.props.setNavigator}
        initialRouteStack={routeStack.toJS()}
        configureScene={route => route.sceneConfig || Navigator.SceneConfigs.FloatFromRight }
        renderScene={(route, navigator) => {
          const Module = route.component
          return (
            <View style={{flex: 1, marginTop: route.hideNavBar ? 0 : this.props.navBarHeight}}>
              <Module {...route.props} />
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
  rootComponent: React.PropTypes.func.isRequired,
  setNavigator: React.PropTypes.func.isRequired,
  uri: React.PropTypes.object.isRequired
}
