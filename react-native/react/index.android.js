/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 */
'use strict';

var React = require('react-native');
var {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  DrawerLayoutAndroid,
  TouchableNativeFeedback,
} = React;

var Login = require('./login');

var Keybase = React.createClass({

  getInitialState: function() {
    return {"nav": "intro"};
  },

  _toLogin: function() {
    this.refs.drawer.closeDrawer()
    this.setState({"nav":"login"})
    console.log("Going to login!")
  },

  render: function() {
      var navigationView = (
        <View style={{backgroundColor: 'white', flexDirection:"column", position: "absolute", top:0, bottom: 0, right:0, left: 0}}>
          <Text style={{margin: 10, fontSize: 15, textAlign: 'left'}}>Im in the Drawer!</Text>
          <TouchableNativeFeedback onPress={this._toLogin}
            background={TouchableNativeFeedback.SelectableBackground()}
            delayPressIn={0}>
            <View><Text style={{margin: 30}}>Login</Text></View>
          </TouchableNativeFeedback>
        </View>
      );

      var internalView = null;

      if (this.state.nav == "login") {
        internalView = <Login/>
      } else {
        internalView = <Text style={{fontSize: 25, textAlign:"center", marginTop:20}}>Keybase</Text>
      }

      return (
        <DrawerLayoutAndroid
          drawerWidth={200}
          ref="drawer"
          drawerPosition={DrawerLayoutAndroid.positions.Left}
          renderNavigationView={() => navigationView}>
          {internalView}
        </DrawerLayoutAndroid>
      );

  }
});

var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

AppRegistry.registerComponent('Keybase', () => Keybase);
