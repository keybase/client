// @flow
import React, {Component} from 'react'
import {globalMargins} from '../../styles'
import {Button, Input, StandardScreen, Text} from '../../common-adapters'

import type {Props} from './index'

type State = {
  email: string,
  originalEmail: string,
  edited: boolean,
}

class UpdateEmail extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      originalEmail: props.email || '',
      email: props.email || '',
      edited: false,
    }
  }

  handleEmailChange(email: string) {
    const edited = email !== this.state.originalEmail
    this.setState({
      email,
      edited,
    })
  }

  render() {
    const error = this.props.error ? {message: this.props.error.message, type: 'error'} : null
    return (
      <StandardScreen onBack={this.props.onBack} notification={error}>
        <Input
          hintText="Email"
          value={this.state.email}
          onChangeText={email => this.handleEmailChange(email)}
          style={{width: 400}}
        />
        <Button
          style={{alignSelf: 'center', marginTop: globalMargins.medium}}
          type="Primary"
          label="Save"
          onClick={() => {
            this.props.onSave(this.state.email)
          }}
          waiting={this.props.waitingForResponse}
        />

        {!!this.props.onResendConfirmationCode &&
          <Text
            style={{marginTop: globalMargins.large, textAlign: 'center'}}
            onClick={this.props.onResendConfirmationCode}
            link={true}
            type="BodyPrimaryLink"
          >
            Resend confirmation code
          </Text>}
      </StandardScreen>
    )
  }
}

export default UpdateEmail
