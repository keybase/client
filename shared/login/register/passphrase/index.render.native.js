// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import {Button, UserCard, Text, FormWithCheckbox} from '../../../common-adapters'
import {globalColors, globalMargins} from '../../../styles'

import type {Props} from './index.render'

class PassphraseRender extends Component<void, Props, void> {
  render() {
    const {showTyping, toggleShowTyping} = this.props

    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.white, padding: 0}}
        onBack={this.props.onBack}
      >
        <UserCard style={stylesCard} username={this.props.username}>
          <Text type="Header" style={{color: globalColors.orange, ...usernameStyle}}>
            {this.props.username}
          </Text>
          <FormWithCheckbox
            inputProps={{
              autoFocus: true,
              type: showTyping ? 'passwordVisible' : 'password',
              floatingHintTextOverride: 'Passphrase',
              onEnterKeyDown: this.props.onSubmit,
              onChangeText: t => this.props.onChange(t),
              value: this.props.passphrase,
              errorText: this.props.error,
            }}
            checkboxesProps={[{label: 'Show typing', checked: !!showTyping, onCheck: toggleShowTyping}]}
          />

          <Button
            fullWidth={true}
            waiting={this.props.waitingForResponse}
            label="Continue"
            type="Primary"
            onClick={this.props.onSubmit}
            enabled={this.props.passphrase && this.props.passphrase.length}
          />
          <Text style={stylesForgot} type="BodySmallSecondaryLink" onClick={this.props.onForgotPassphrase}>
            Forgot passphrase?
          </Text>
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  flex: 1,
}
const stylesForgot = {
  marginTop: globalMargins.medium,
  flex: 1,
  textAlign: 'center',
}
const stylesCard = {
  alignItems: 'stretch',
}
const usernameStyle = {
  textAlign: 'center',
}

export default PassphraseRender
