// @flow
import React from 'react'
import {Box, Text, Button, BackButton} from '../../../common-adapters/index.native'
import {globalColors, globalStyles} from '../../../styles'

import type {Props} from './you-rekey'

const YouRekey = ({onEnterPaperkey, onBack}: Props) => {
  return (
    <Box style={containerStyle}>
      <BackButton onClick={onBack} style={{alignSelf: 'flex-start', marginLeft: 16, marginBottom: 10, marginTop: 10}} iconStyle={{color: globalColors.white}} />
      <Box style={{...globalStyles.flexBoxRow, backgroundColor: globalColors.red, justifyContent: 'center'}}>
        <Text backgroundMode='Terminal' style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}} type='BodySemibold'>This conversation needs to be rekeyed.</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text type='Body' backgroundMode='Terminal'>Open one of your other devices to unlock this conversation</Text>
        <Text type='Body' backgroundMode='Terminal' style={{marginBottom: 10}}>Or enter a paperkey</Text>
        <Button type='Secondary' backgroundMode='Terminal' onClick={onEnterPaperkey} label='Enter a paper key' />
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
