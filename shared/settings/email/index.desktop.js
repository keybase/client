// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {
  Box,
  Button,
  Icon,
  Input,
  StandardScreen,
  Text,
} from '../../common-adapters'

import type {Props} from './index'

function VerifiedText({
  isVerified,
  style,
}: {
  isVerified: boolean,
  style?: Object,
}) {
  const color = isVerified ? globalColors.green2 : globalColors.red
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        alignSelf: 'center',
        ...style,
      }}
    >
      <Icon
        type={isVerified ? 'iconfont-check' : 'iconfont-close'}
        style={{color, marginRight: 3, marginTop: 2, fontSize: 11}}
      />
      <Text type="Body" style={{color}}>
        {isVerified ? 'Verified' : 'Not verified'}
      </Text>
    </Box>
  )
}

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
    const error = this.props.error
      ? {message: this.props.error.message, type: 'error'}
      : null
    return (
      <StandardScreen onBack={this.props.onBack} notification={error}>
        <Input
          hintText="Email"
          value={this.state.email}
          onChangeText={email => this.handleEmailChange(email)}
          style={{width: 400}}
        />
        {!this.state.edited &&
          <VerifiedText
            isVerified={this.props.isVerified}
            style={{marginTop: 2, justifyContent: 'center'}}
          />}
        <Button
          style={{
            alignSelf: 'center',
            marginTop: globalMargins.medium,
          }}
          type="Primary"
          label="Save"
          onClick={() => {
            this.props.onSave(this.state.email)
          }}
          waiting={this.props.waitingForResponse}
        />

        {!!this.props.onResendConfirmationCode &&
          <Text
            style={{
              marginTop: globalMargins.large,
              textAlign: 'center',
            }}
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
