// @flow
import React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Button, Icon, Input, StandardScreen, Text} from '../../common-adapters'

import type {Props} from './index'

function VerifiedText ({isVerified, style}: {isVerified: boolean, style?: Object}) {
  const color = isVerified ? globalColors.green2 : globalColors.red
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', alignSelf: 'center', ...style}}>
      <Icon
        type={isVerified ? 'iconfont-check' : 'iconfont-close'}
        style={{color, marginRight: 3, marginTop: 2}} />
      <Text type='Body' style={{color}}>
        {isVerified ? 'Verified' : 'Not verified'}
      </Text>
    </Box>
  )
}

function UpdateEmail (props: Props) {
  const error = props.error ? {message: props.error.message, type: 'error'} : null
  return (
    <StandardScreen
      onBack={props.onBack}
      notification={error}>
      <Input
        hintText='Email'
        value={props.email}
        onChangeText={props.onChangeNewEmail}
        style={{width: 400}} />
      {!props.edited &&
        <VerifiedText isVerified={props.isVerified} style={{marginTop: 2, justifyContent: 'center'}} />
      }
      <Button
        style={{alignSelf: 'center', marginTop: globalMargins.medium}}
        type='Primary'
        label='Save'
        onClick={props.onSave}
        waiting={props.waitingForResponse} />

      {!!props.onResendConfirmationCode &&
        <Text
          style={{marginTop: globalMargins.large, textAlign: 'center'}}
          onClick={props.onResendConfirmationCode}
          link={true}
          type='BodyPrimaryLink'>
          Resend confirmation code
        </Text>}
    </StandardScreen>
  )
}

export default UpdateEmail
