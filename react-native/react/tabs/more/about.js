'use strict'

import React, { Component, StyleSheet, View, Text } from 'react-native'
import commonStyles from '../../styles/common'

export default class About extends Component {
  constructor (props) {
    super(props)

    this.state = {}
  }

  // TODO get version from golang
  render () {
    return (
        <View style={styles.container}>
          <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Version 0.1</Text>
        </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'About'
      }
    }
  }
}

About.propTypes = {}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  }
})
