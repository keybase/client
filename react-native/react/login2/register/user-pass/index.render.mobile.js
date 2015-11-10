'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TextInput, View } from '../../../base-react'
import Button from '../../../common-adapters/button'
import commonStyles from '../../../styles/common'

export default class UserPassRender extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username || 'test13',
      passphrase: props.passphrase || 'okokokokokok'
    }
  }

  onSubmit () {
    this.props.onSubmit(this.state.username, this.state.passphrase)
  }

  render () {
    const buttonEnabled = this.props.buttonEnabled(this.state.username, this.state.passphrase)
    return (
      <View style={styles.container}>
        <Text style={commonStyles.h1}>{this.props.title}</Text>
        <Text style={commonStyles.h2}>{this.props.subTitle}</Text>
        <TextInput style={[commonStyles.textInput, {marginTop: 20}]}
          placeholder='Keybase Username'
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={(username) => this.setState({username})}
          onSubmitEditing={(event) => this.refs['passphrase'].focus()}
          returnKeyType='next'
          value={this.state.username}
        />
        <TextInput style={[commonStyles.textInput]}
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={(passphrase) => this.setState({passphrase})}
          onSubmitEditing={() => this.onSubmit() }
          ref='passphrase'
          returnKeyType='done'
          secureTextEntry
          value={this.state.passphrase}
          placeholder='Keybase Passphrase'
        />

        {this.props.error && (
          <Text>{this.props.error.toString()}</Text>
        )}

        <Button style={{alignSelf: 'flex-end', marginTop: 20}} buttonStyle={commonStyles.actionButton} onPress={() => this.onSubmit()} enabled={buttonEnabled} title='Submit'/>
      </View>
    )
  }
}

UserPassRender.propTypes = {
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  error: React.PropTypes.object,
  onSubmit: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  subTitle: React.PropTypes.string,
  buttonEnabled: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 100,
    padding: 20
  }
})

