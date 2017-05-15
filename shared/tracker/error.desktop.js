// @flow
import React from 'react'
import Header from './header.render'

import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'
import type {Props} from './error'

function TrackerError({errorMessage, onRetry, onClose}: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Header
        reason="Error in getting identity information :'("
        onClose={onClose}
        trackerState={'error'}
        currentlyFollowing={false}
        headerStyle={{position: undefined}}
        loggedIn={false}
      />
      <Text style={errorTextStyle} type="BodyError">
        {errorMessage}
      </Text>
      <Box style={retryStyle}>
        <Button onClick={() => onRetry()} type="Primary" label="Retry fetching identity" />
      </Box>
    </Box>
  )
}

const errorTextStyle = {
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
  textAlign: 'center',
}

const retryStyle = {
  alignSelf: 'center',
  marginTop: 'auto',
  marginBottom: globalMargins.small,
}

export default TrackerError
