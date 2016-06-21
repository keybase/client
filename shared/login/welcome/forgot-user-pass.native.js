import React, {Component} from 'react'
import {StyleSheet, Text, TextInput, View} from 'react-native'
import {connect} from 'react-redux'
import commonStyles from '../../styles/common'
import Button from '../../common-adapters/button'
import {updateForgotPasswordEmail, submitForgotPassword} from '../../actions/login'

class ForgotUserPass extends Component {
  render () {
    return (
      <View style={{flex: 1, marginTop: 64, marginBottom: 48, justifyContent: 'flex-start'}}>
        {this.props.success ? (
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
          value={this.props.email}
          onChangeText={email => this.props.updateEmail(email)}
          onSubmitEditing={() => this.props.submit()}
          autoCorrect={false}
          autoFocus
          editable={!this.props.submitting && !this.props.success}
          placeholder='Email address (or username)'
          keyboardType='email-address'
          clearButtonMode='while-editing'
        />
        <Button
          title='Submit'
          style={styles.submitButton}
          onPress={() => this.props.submit()}
          enabled={!this.props.success}
        />
        {this.props.error && (
          <Text style={{color: 'red'}}>{this.props.error.toString()}</Text>
        )}
      </View>
    )
  }

  componentWillUnmount () {
    this.props.updateEmail('')
  }

  static parseRoute () {
    return {componentAtTop: {}}
  }
}

ForgotUserPass.propTypes = {
  updateEmail: React.PropTypes.func.isRequired,
  submit: React.PropTypes.func.isRequired,
  email: React.PropTypes.string.isRequired,
  submitting: React.PropTypes.bool.isRequired,
  success: React.PropTypes.bool.isRequired,
  error: React.PropTypes.object,
}

const styles = StyleSheet.create({
  submitButton: {
    width: 100,
    marginRight: 10,
    alignSelf: 'flex-end',
  },
})

export default connect(
  state => {
    const {
      forgotPasswordEmailAddress: email,
      forgotPasswordSubmitting: submitting,
      forgotPasswordSuccess: success,
      forgotPasswordError: error,
    } = state.login
    return {email, submitting, success, error}
  },
  dispatch => {
    return {
      updateEmail: email => dispatch(updateForgotPasswordEmail(email)),
      submit: () => dispatch(submitForgotPassword()),
    }
  }
)(ForgotUserPass)
