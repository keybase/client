// @flow
// TODO remove Container
import Container from '../../login/forms/container'
import React, {Component} from 'react'
import {Button, UserCard, Text, FormWithCheckbox} from '../../common-adapters'
import {globalColors, globalMargins} from '../../styles'

import type {Props} from '.'

class Passphrase extends Component<Props> {
  render() {
    const {showTyping, toggleShowTyping} = this.props

    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.white, padding: 0}}
        onBack={this.props.onBack}
      >
        <UserCard style={stylesCard} username={this.props.username}>
          <Text center={true} type="Header" style={{color: globalColors.orange}}>
            {this.props.username}
          </Text>
          <FormWithCheckbox
            inputProps={{
              autoFocus: true,
              errorText: this.props.error,
              hintText: 'Passphrase',
              onChangeText: t => this.props.onChange(t),
              onEnterKeyDown: this.props.onSubmit,
              type: showTyping ? 'passwordVisible' : 'password',
              uncontrolled: true,
              value: this.props.passphrase,
            }}
            checkboxesProps={[{checked: !!showTyping, label: 'Show typing', onCheck: toggleShowTyping}]}
          />

          <Button
            fullWidth={true}
            waiting={this.props.waitingForResponse}
            label="Continue"
            type="Primary"
            onClick={this.props.onSubmit}
            disabled={!(this.props.passphrase && this.props.passphrase.length)}
          />
          <Text
            center={true}
            style={stylesForgot}
            type="BodySmallSecondaryLink"
            onClick={this.props.onForgotPassphrase}
          >
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
  flex: 1,
  marginTop: globalMargins.medium,
}
const stylesCard = {
  alignItems: 'stretch',
}

export default Passphrase
