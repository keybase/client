// @flow
import React, {Component} from 'react'
import {StyleSheet, Text, TouchableHighlight, View} from 'react-native'

import commonStyles from '../../styles/common'

export default class ExistingDeviceRender extends Component {
  render () {
    return (
      <View style={[styles.container, {marginTop: 200, padding: 20, alignItems: 'stretch'}]}>
        <Text style={commonStyles.h1}>What type of device would you like to connect this device with?</Text>
        <View style={{flex: 1, flexDirection: 'row', marginTop: 40, justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 40, paddingRight: 40}}>
          <TouchableHighlight onPress={() => this.props.onSubmitComputer()}>
            <View style={{flexDirection: 'column', alignItems: 'center'}}>
              <Text>[Desktop icon]</Text>
              <Text>Desktop Device &gt;</Text>
            </View>
          </TouchableHighlight>
          <TouchableHighlight onPress={() => this.props.onSubmitPhone()}>
            <View style={{flexDirection: 'column', alignItems: 'center'}}>
              <Text>[Mobile icon]</Text>
              <Text>Mobile Device &gt;</Text>
            </View>
          </TouchableHighlight>
        </View>
      </View>
    )
  }
}

ExistingDeviceRender.propTypes = {
  onSubmitComputer: React.PropTypes.func.isRequired,
  onSubmitPhone: React.PropTypes.func.isRequired,

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start',
  },
})
