'use strict'

import React from 'react-native'
import TabBar from './native/TabBar'

import {
  Component,
  Text,
  View,
  BackAndroid
} from 'react-native'

import ScrollableTabView from 'react-native-scrollable-tab-view'

class Nav extends Component {
  constructor (props) {
    super(props)

    this.state = {
      page: 'native'
    }
  }

  nativeVersion () {
    return (
      <TabBar style={{position: 'absolute', left: 0, right: 0, top: 40, bottom: 0}}>
        <View style={{backgroundColor: 'orange', flex: 1}}><Text>screen 0</Text></View>
        <View style={{backgroundColor: 'blue', flex: 1}}><Text>screen 1</Text></View>
        <View style={{backgroundColor: 'green', flex: 1}}><Text>screen 2</Text></View>
        <View style={{backgroundColor: 'yellow', flex: 1}}><Text>screen 3</Text></View>
      </TabBar>
    )
  }

  jsVersion () {
    return (
      <ScrollableTabView
        edgeHitWidth={200}>
        <View style={{backgroundColor: 'red', flex: 1}}><Text>screen 0</Text></View>
        <View style={{backgroundColor: 'blue', flex: 1}}><Text>screen 1</Text></View>
        <View style={{backgroundColor: 'green', flex: 1}}><Text>screen 2</Text></View>
        <View style={{backgroundColor: 'yellow', flex: 1}}><Text>screen 3</Text></View>
      </ScrollableTabView>
    )
  }

  componentWillMount () {
    BackAndroid.addEventListener('hardwareBackPress', () => {
      this.setState({page: 'none'})
      return true
    })
  }

  render () {
    if (this.state.page === 'native') {
      return (this.nativeVersion())
    } else if (this.state.page === 'jsVersion') {
      return (this.jsVersion())
    }
    return (
      <View style={{flex: 1}}>
        <Text style={{fontSize: 32, paddingTop: 20, textAlign: 'center'}}
          onPress={() => this.setState({page: 'jsVersion'})}>
          JS Version
        </Text>

        <Text style={{fontSize: 32, paddingTop: 20, textAlign: 'center'}}
          onPress={() => this.setState({page: 'native'})}>
          Native Version
        </Text>
      </View>
    )
  }
}

export default Nav
