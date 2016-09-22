// @flow
import React from 'react'
import {globalMargins} from '../../styles'
import {Button, Input, StandardScreen} from '../../common-adapters'

import type {Props} from './index'

function PaymentForm (props: Props) {
  return (
    <StandardScreen
      onBack={props.onBack}
      notification={props.errorMessage ? {message: props.errorMessage, type: 'error'} : null}
    >
      <Input
        floatingLabelText='Card number'
        value={props.cardNumber}
        onChangeText={props.onChangeCardNumber}
        style={styleInput}
      />
      <Input
        floatingLabelText='Name on card'
        value={props.name}
        onChangeText={props.onChangeName}
        style={styleInput}
      />
      <Input
        floatingLabelText='Card expiration (MM/YYYY)'
        value={props.expiration}
        onChangeText={props.onChangeExpiration}
        style={styleInput}
      />
      <Input
        floatingLabelText='Security code'
        value={props.securityCode}
        onChangeText={props.onChangeSecurityCode}
        style={styleInput}
      />
      <Button
        type='Follow'
        label='Done, upgrade!'
        onClick={props.onSubmit}
        style={{marginTop: globalMargins.medium}}
      />
    </StandardScreen>
  )
}

const styleInput = {
  minWidth: 450,
  marginBottom: globalMargins.small,
}

export default PaymentForm
