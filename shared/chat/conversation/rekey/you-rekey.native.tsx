import * as React from 'react'
import {Box, Text, Button, StandardScreen} from '../../../common-adapters/mobile.native'
import {globalStyles, globalMargins} from '../../../styles'
import {Props} from './you-rekey.types'

const YouRekey = ({onEnterPaperkey, onBack}: Props) => {
  const notification = {message: 'This conversation needs to be rekeyed.', type: 'error' as const}

  return (
    <StandardScreen onBack={onBack} theme="dark" notification={notification}>
      <Box style={containerStyle}>
        <Box
          style={{...globalStyles.flexBoxColumn, alignItems: 'stretch', flex: 1, justifyContent: 'center'}}
        >
          <Text center={true} type="BodySmall" style={textStyle} negative={true}>
            To unlock this conversation, open one of your other devices or enter a paperkey.
          </Text>
          <Button onClick={onEnterPaperkey} label="Enter a paper key" />
        </Box>
      </Box>
    </StandardScreen>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  flex: 1,
  justifyContent: 'flex-start',
}

const textStyle = {
  marginBottom: globalMargins.large,
  marginTop: globalMargins.large,
}

export default YouRekey
