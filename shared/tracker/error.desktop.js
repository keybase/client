// @flow
import * as React from 'react'
import Header from './header.desktop'
import {Box, Button, Text, ButtonBar} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'

type Props = {
  onClose: () => void,
  errorMessage: string,
  onRetry: ?() => void,
}

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
      <Text style={errorTextStyle} type="BodySmallError">
        {errorMessage}
      </Text>
      <ButtonBar>
        <Button onClick={onRetry} type="Primary" label="Retry fetching identity" />
      </ButtonBar>
    </Box>
  )
}

const errorTextStyle = {
  marginBottom: globalMargins.medium,
  marginTop: globalMargins.medium,
  textAlign: 'center',
}

export default TrackerError
