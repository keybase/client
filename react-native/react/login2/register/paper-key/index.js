'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TextInput, View } from 'react-native'
import commonStyles from '../../../styles/common'
import Button from '../../../common-adapters/button'
import { navigateTo } from '../../../actions/router'

export default class PaperKey extends Component {
  constructor (props) {
    super(props)

    this.state = {
      paperKey: ''
    }
  }

  render () {
    return (
      <View style={[styles.container, {backgroundColor: 'red', paddingTop: 200}]}>
        <Text style={[commonStyles.h1, {padding: 10}]}>Register with a paper key</Text>
        <Text style={[commonStyles.h2, {padding: 10, marginBottom: 20}]}>Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum Lorem ipsum </Text>
        <TextInput style={commonStyles.textInput}
          placeholder='Enter your paper key'
          onChangeText={(paperKey) => this.setState({paperKey})}
        />
        <Button
          style={{alignSelf: 'flex-end', marginRight: 10}}
          onPress={() => { this.props.submit() }}
          title='Submit & Log in'
          enabled={this.state.paperKey}/>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      props: {
        submit: () => store.dispatch(navigateTo(['login2', 'register', 'setPublicName']))
      }
    }
  }
}

PaperKey.propTypes = {
  submit: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start'
  }
})

