'use strict'
/* @flow */

const React = require('react-native')
const {
  Component,
  StyleSheet,
  View,
  Text,
  TextInput
} = React

const commonStyles = require('../styles/common')

class Developer extends Component {
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
            value={this.state.deviceName}
            enablesReturnKeyAutomatically
            returnKeyType='next'
            autoCorrect={false}
            onChangeText={() => { console.log('typing') }}
            />
        </View>
    )
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

module.exports = Developer
