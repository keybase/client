'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TextInput, View } from 'react-native'
import commonStyles from '../../styles/common'
import Button from '../../common-adapters/button'
import { updateForgotPasswordEmail, submitForgotPassword } from '../../actions/login2'

export default class ForgotUserPass extends Component {
  render () {
    return (
      <View style={{ flex: 1, marginTop: 64, marginBottom: 48, justifyContent: 'flex-start' }}>
        {this.props.forgotPasswordSuccess ? (
          <View>
            <Text style={commonStyles.h1}>Email sent!</Text>
            <Text style={[commonStyles.h2, {marginBottom: 40}]}>Great great great.</Text>
          </View>
        ) : (
          <View>
            <Text style={commonStyles.h1}>Forgot your username or password?</Text>
            <Text style={[commonStyles.h2, {marginBottom: 40}]}>We’ll send it to you.</Text>
          </View>
        )}
        <TextInput
          style={commonStyles.textInput}
          value={this.props.forgotPasswordEmailAddress}
          onChangeText={(email) => this.props.dispatch(updateForgotPasswordEmail(email)) }
          onSubmitEditing={() => this.props.dispatch(submitForgotPassword())}
          autoCorrect={false}
          autoFocus
          editable={!this.props.forgotPasswordSubmitting && !this.props.forgotPasswordSuccess}
          placeholder='Email address (or username)'
          keyboardType='email-address'
          clearButtonMode='while-editing'
        />
        <Button
          title='Submit'
          style={styles.submitButton}
          onPress={() => this.props.dispatch(submitForgotPassword())}
          enabled={!this.props.forgotPasswordSuccess}
        />
        {this.props.forgotPasswordError && (
          <Text style={{color: 'red'}}>{this.props.forgotPasswordError.toString()}</Text>
        )}
      </View>
    )
  }

  componentWillUnmount () {
    this.props.dispatch(updateForgotPasswordEmail(''))
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => state.login2
      }
    }
  }
}

ForgotUserPass.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  forgotPasswordEmailAddress: React.PropTypes.string.isRequired,
  forgotPasswordSubmitting: React.PropTypes.bool.isRequired,
  forgotPasswordSuccess: React.PropTypes.bool.isRequired,
  forgotPasswordError: React.PropTypes.object
}

const styles = StyleSheet.create({
  submitButton: {
    width: 100,
    marginRight: 10,
    alignSelf: 'flex-end'
  }
})
