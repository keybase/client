'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  StyleSheet,
  View,
  Text,
  TextInput
} from 'react-native'

import commonStyles from '../../styles/common'

export default class Developer extends Component {
  constructor (props) {
    super(props)

    this.state = { }
  }

  render () {
    return (
        <View style={styles.container}>
          <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Dev settings</Text>
          <TextInput
            style={styles.input}
            placeholder='Some setting'
            value='TODO'
            enablesReturnKeyAutomatically
            returnKeyType='next'
            autoCorrect={false}
            onChangeText={() => { console.log('typing') }}
            />
        </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const componentAtTop = {
      title: 'Developer',
      component: Developer
    }

    return {
      componentAtTop,
      parseNextRoute: null
    }
  }
}

Developer.propTypes = {
  navigator: React.PropTypes.object.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  },
  input: {
    height: 40,
    marginBottom: 5,
    marginLeft: 10,
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: '#0f0f0f',
    fontSize: 13,
    padding: 4
  },
  submitWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  }
})

export default Developer
