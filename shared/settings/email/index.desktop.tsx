import React, {Component} from 'react'
import {globalMargins} from '../../styles'
import {Button, Input, StandardScreen, Text} from '../../common-adapters'

import {Props} from './index'

type State = {
  email: string
}

class UpdateEmail extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      email: props.email || '',
    }
  }

  handleEmailChange(email: string) {
    this.setState({email})
  }

  render() {
    const error = this.props.error ? ({message: this.props.error.message, type: 'error'} as const) : null
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
          label="Save"
          onClick={() => {
            this.props.onSave(this.state.email)
          }}
          waiting={this.props.waitingForResponse}
        />

        {!!this.props.onResendConfirmationCode && (
          <Text
            center={true}
            style={{marginTop: globalMargins.large}}
            onClick={this.props.onResendConfirmationCode}
            type="BodyPrimaryLink"
          >
            Resend confirmation code
          </Text>
        )}
      </StandardScreen>
    )
  }
}

export default UpdateEmail
