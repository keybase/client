// @flow
import React from 'react'
import {Box, Button, Text} from '../../common-adapters'
import {globalColors, globalStyles} from '../../styles'

const ParticipantRekey = ({onRekey}: {onRekey: () => void}) => {
  return (
    <Box style={containerStyle}>
      <Box style={{...globalStyles.flexBoxRow, backgroundColor: globalColors.red, justifyContent: 'center'}}>
        <Text backgroundMode='Terminal' style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}} type='BodySemibold'>This conversation needs to be rekeyed.</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1, justifyContent: 'center'}}>
        <Button onRekey={onRekey} label='Rekey' />
      </Box>
    </Box>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: globalColors.darkBlue4,
  flex: 1,
  justifyContent: 'flex-start',
}

export default ParticipantRekey
