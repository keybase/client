import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Button, Text, StandardScreen} from '../../common-adapters'
import {Stars} from '../common.desktop'

import {Props, PaymentVariants} from './'

function PaymentOption({paymentOption}: {paymentOption: PaymentVariants}) {
  switch (paymentOption.type) {
    case 'credit-card-no-past': {
      const {onAddCreditCard} = paymentOption
      return <Button style={buttonStyle} onClick={onAddCreditCard} label="Add a credit card" />
    }
    case 'credit-card-with-past': {
      const {cardInfo, onPayWithSavedCard, onUpdateCard} = paymentOption
      return (
        <Box style={globalStyles.flexBoxColumn}>
          <Button
            style={{...buttonStyle, marginBottom: globalMargins.small}}
            onClick={onPayWithSavedCard}
            label={`Pay with ${cardInfo}`}
          />
          <Button style={buttonStyle} type="Dim" onClick={onUpdateCard} label="Update credit card" />
        </Box>
      )
    }
    case 'apple-pay': {
      const {onPayWithCardInstead} = paymentOption
      const text = `You are currently using Apple Pay. Please use your iPhone/iPad to switch plans.`
      return (
        <Box style={globalStyles.flexBoxColumn}>
          <Text center={true} type="BodySmallError" style={{marginBottom: globalMargins.large}}>
            {text}
          </Text>
          <Button
            style={buttonStyle}
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
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}>
        <Stars count={numStars} />
        <Text center={true} type="Header" style={{marginTop: globalMargins.small}}>
          {plan}
        </Text>
        <Text center={true} type="Body" style={{marginBottom: globalMargins.medium}}>
          {price}
        </Text>
        <Text
          center={true}
          type="BodySemibold"
          style={{marginBottom: globalMargins.large}}
        >{`You will be able to use up to ${gigabytes}GB of data.`}</Text>
        <PaymentOption paymentOption={paymentOption} />
      </Box>
    </StandardScreen>
  )
}

const buttonStyle = {
  alignSelf: 'center',
} as const

export default PlanDetails
