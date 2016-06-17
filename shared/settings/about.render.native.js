import React, {Component} from 'react'
import {Text, View, StyleSheet} from 'react-native'
import commonStyles from '../styles/common'

export default class Render extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Version 0.1</Text>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF',
  },
})
