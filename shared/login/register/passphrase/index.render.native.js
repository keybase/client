// @flow
import React, {Component} from 'react'
import {Button, UserCard, Text, FormWithCheckbox} from '../../../common-adapters'
import {specialStyles} from '../../../common-adapters/text'
import {globalColors} from '../../../styles/style-guide'
import Container from '../../forms/container'
import type {Props} from './index.render'

class Render extends Component<void, Props, void> {
  render () {
    const {saveInKeychain, showTyping, toggleSaveInKeychain, toggleShowTyping} = this.props

    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.lightGrey, padding: 0}}
        onBack={this.props.onBack}>
        <UserCard style={stylesCard} username={this.props.username}>
          <Text type='HeaderBig' style={{...specialStyles.username, ...usernameStyle}}>{this.props.username}</Text>
          <FormWithCheckbox
            style={stylesInput}
            inputProps={{
              autoFocus: true,
              type: showTyping ? 'passwordVisible' : 'password',
              floatingLabelText: 'Passphrase',
              onEnterKeyDown: this.props.onSubmit,
              onChangeText: t => this.props.onChange(t),
              value: this.props.passphrase,
              errorText: this.props.error,
            }}
            checkboxesProps={[
              {label: 'Save in keychain', checked: !!(saveInKeychain), onCheck: toggleSaveInKeychain},
              {label: 'Show typing', checked: !!(showTyping), onCheck: toggleShowTyping},
            ]} />

          <Button
            fullWidth
            waiting={this.props.waitingForResponse}
            label='Continue'
            type='Primary'
            onClick={this.props.onSubmit}
            enabled={this.props.passphrase && this.props.passphrase.length} />
          <Text style={stylesForgot} type='BodySmallSecondaryLink' onClick={this.props.onForgotPassphrase}>Forgot passphrase?</Text>
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  flex: 1,
  marginTop: 40,
}
const stylesInput = {
  flex: 1,
  marginTop: 40,
  paddingBottom: 30,
}
const stylesForgot = {
  marginTop: 20,
}
const stylesCard = {
  alignItems: 'stretch',
}

const usernameStyle = {
  marginTop: 30,
  textAlign: 'center',
}

export default Render
