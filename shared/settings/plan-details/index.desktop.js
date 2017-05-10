// @flow
import React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Button, Text, StandardScreen} from '../../common-adapters'
import {Stars} from '../common.desktop'

import type {Props, PaymentVariants} from './'

function PaymentOption({paymentOption}: {paymentOption: PaymentVariants}) {
  switch (paymentOption.type) {
    case 'credit-card-no-past':
      const {onAddCreditCard} = paymentOption
      return (
        <Button
          style={buttonStyle}
          type="Primary"
          onClick={onAddCreditCard}
          label="Add a credit card"
        />
      )
    case 'credit-card-with-past':
      const {cardInfo, onPayWithSavedCard, onUpdateCard} = paymentOption
      return (
        <Box style={globalStyles.flexBoxColumn}>
          <Button
            style={{
              ...buttonStyle,
              marginBottom: globalMargins.small,
            }}
            type="Primary"
            onClick={onPayWithSavedCard}
            label={`Pay with ${cardInfo}`}
          />
          <Button
            style={buttonStyle}
            type="Secondary"
            onClick={onUpdateCard}
            label="Update credit card"
          />
        </Box>
      )
    case 'apple-pay':
      const {onPayWithCardInstead} = paymentOption
      const text = `You are currently using Apple Pay. Please use your iPhone/iPad to switch plans.`
      return (
        <Box style={globalStyles.flexBoxColumn}>
          <Text
            type="BodyError"
            style={{
              textAlign: 'center',
              marginBottom: globalMargins.large,
            }}
          >
            {text}
          </Text>
          <Button
            style={buttonStyle}
            type="Secondary"
            onClick={onPayWithCardInstead}
            label="Use a credit card instead"
          />
        </Box>
      )
  }
}

function PlanDetails({
  plan,
  price,
  paymentOption,
  onBack,
  gigabytes,
  numStars,
}: Props) {
  return (
    <StandardScreen onBack={onBack}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        <Stars count={numStars} />
        <Text
          type={'Header'}
          style={{
            textAlign: 'center',
            marginTop: globalMargins.small,
          }}
        >
          {plan}
        </Text>
        <Text
          type={'Body'}
          style={{
            textAlign: 'center',
            marginBottom: globalMargins.medium,
          }}
        >
          {price}
        </Text>
        <Text
          type={'BodySemibold'}
          style={{
            textAlign: 'center',
            marginBottom: globalMargins.large,
          }}
        >{`You will be able to use up to ${gigabytes}GB of data.`}</Text>
        <PaymentOption paymentOption={paymentOption} />
      </Box>
    </StandardScreen>
  )
}

const buttonStyle = {
  alignSelf: 'center',
}

export default PlanDetails
