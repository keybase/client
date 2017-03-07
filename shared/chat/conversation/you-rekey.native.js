// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters/index.native'
import {globalColors, globalStyles} from '../../styles'

const YouRekey = ({onRekey}: {onRekey: () => void}) => {
  return (
    <Box style={containerStyle}>
      <Box style={{...globalStyles.flexBoxRow, backgroundColor: globalColors.red, justifyContent: 'center'}}>
        <Text backgroundMode='Terminal' style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}} type='BodySemibold'>This conversation needs to be rekeyed.</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text type='Body' backgroundMode='Terminal'>Open one of your other devices to unlock this conversation</Text>
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

export default YouRekey
