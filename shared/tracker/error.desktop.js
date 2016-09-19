// @flow

import React from 'react'
import Header from './header.render'

import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'
import type {Props} from './error'

function TrackerError ({errorMessage, onRetry, onClose}: Props) {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Header
        reason={'Error in getting identity information :\'('}
        onClose={onClose}
        trackerState={'error'}
        currentlyFollowing={false}
        headerStyle={{position: undefined}}
        loggedIn={false}
      />
      <Text style={errorTextStyle} type='Error'>
        {errorMessage}
      </Text>
      <Button onClick={onRetry} style={retryStyle} type='Primary' label='Retry fetching identity' />
    </Box>
  )
}

const errorTextStyle = {
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
}

const retryStyle = {
  alignSelf: 'center',
  marginTop: 'auto',
  marginBottom: globalMargins.small,
}

export default TrackerError
