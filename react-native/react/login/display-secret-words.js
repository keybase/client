'use strict'
/* @flow */

import React from 'react-native'
const {
  Component,
  StyleSheet,
  View,
  Text
} = React

import commonStyles from '../styles/common'

class DisplaySecretWords extends Component {
  constructor (props) {
    super(props)

    props.onSubmit()
  }

  render () {
    return (
        <View style={styles.container}>
          <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Register Device</Text>
          <Text style={[{margin: 20, marginBottom: 20}, commonStyles.h2]}>In order to register this device you need to enter in the secret phrase generated on an existing device</Text>
          <Text style={[styles.secret, commonStyles.h1]}>{this.props.secretWords}</Text>
        </View>
    )
  }
}

DisplaySecretWords.propTypes = {
  navigator: React.PropTypes.object,
  response: React.PropTypes.object,
  secretWords: React.PropTypes.string
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  },
  secret: {
    textAlign: 'center',
    marginBottom: 75,
    backgroundColor: 'grey',
    borderColor: 'black',
    padding: 10
  }
})

export default DisplaySecretWords
