import * as React from 'react'
import * as Styles from '../../styles'
import {Box, Button, Text, StandardScreen} from '../../common-adapters'
import {Stars} from '../common.desktop'

import {Props, PaymentVariants} from '.'

function PaymentOption({paymentOption}: {paymentOption: PaymentVariants}) {
  switch (paymentOption.type) {
    case 'credit-card-no-past': {
      const {onAddCreditCard} = paymentOption
      return <Button style={styles.button} onClick={onAddCreditCard} label="Add a credit card" />
    }
    case 'credit-card-with-past': {
      const {cardInfo, onPayWithSavedCard, onUpdateCard} = paymentOption
      return (
        <Box style={Styles.globalStyles.flexBoxColumn}>
          <Button
            style={{...styles.button, marginBottom: Styles.globalMargins.small}}
            onClick={onPayWithSavedCard}
            label={`Pay with ${cardInfo}`}
          />
          <Button style={styles.button} type="Dim" onClick={onUpdateCard} label="Update credit card" />
        </Box>
      )
    }
    case 'apple-pay': {
      const {onPayWithCardInstead} = paymentOption
      const text = `You are currently using Apple Pay. Please use your iPhone/iPad to switch plans.`
      return (
        <Box style={Styles.globalStyles.flexBoxColumn}>
          <Text center={true} type="BodySmallError" style={{marginBottom: Styles.globalMargins.large}}>
            {text}
          </Text>
          <Button
            style={styles.button}
            type="Dim"
            onClick={onPayWithCardInstead}
            label="Use a credit card instead"
          />
        </Box>
      )
    }
  }
  return null
}

function PlanDetails({plan, price, paymentOption, onBack, gigabytes, numStars}: Props) {
  return (
    <StandardScreen onBack={onBack}>
      <Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Stars count={numStars} />
        <Text center={true} type="Header" style={{marginTop: Styles.globalMargins.small}}>
          {plan}
        </Text>
        <Text center={true} type="Body" style={{marginBottom: Styles.globalMargins.medium}}>
          {price}
        </Text>
        <Text
          center={true}
          type="BodySemibold"
          style={{marginBottom: Styles.globalMargins.large}}
        >{`You will be able to use up to ${gigabytes}GB of data.`}</Text>
        <PaymentOption paymentOption={paymentOption} />
      </Box>
    </StandardScreen>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {
        alignSelf: 'center',
      },
    } as const)
)

export default PlanDetails
