import * as React from 'react'
import * as Styles from '../../styles'
import {Button, Input, StandardScreen} from '../../common-adapters'

import {Props} from './index'

function PaymentForm(props: Props) {
  return (
    <StandardScreen
      onBack={props.onBack}
      notification={props.errorMessage ? {message: props.errorMessage, type: 'error'} : null}
    >
      <Input
        hintText="Card number"
        value={props.cardNumber}
        onChangeText={props.onChangeCardNumber}
        style={styles.input}
      />
      <Input
        hintText="Name on card"
        value={props.name}
        onChangeText={props.onChangeName}
        style={styles.input}
      />
      <Input
        hintText="Card expiration (MM/YYYY)"
        value={props.expiration}
        onChangeText={props.onChangeExpiration}
        style={styles.input}
      />
      <Input
        hintText="Security code"
        value={props.securityCode}
        onChangeText={props.onChangeSecurityCode}
        style={styles.input}
      />
      <Button
        type="Success"
        label="Done, upgrade!"
        onClick={props.onSubmit}
        style={{marginTop: Styles.globalMargins.medium}}
      />
    </StandardScreen>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  input: {
    marginBottom: Styles.globalMargins.small,
    minWidth: 450,
  },
}))

export default PaymentForm
