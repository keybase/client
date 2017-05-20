// @flow
import React from 'react'
import {Box, Text, Button, StandardScreen} from '../../../common-adapters/index.native'
import {globalColors, globalStyles, globalMargins} from '../../../styles'

import type {Props} from './you-rekey'

const YouRekey = ({onEnterPaperkey, onBack}: Props) => {
  const bannerEl = (
    <Box style={{...globalStyles.flexBoxRow, backgroundColor: globalColors.red, justifyContent: 'center'}}>
      <Text
        backgroundMode="Terminal"
        style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
        type="BodySemibold"
      >
        This conversation needs to be rekeyed.
      </Text>
    </Box>
  )
  const notification = {type: 'error', message: bannerEl}

  return (
    <StandardScreen onBack={onBack} theme="dark" notification={notification}>
      <Box style={containerStyle}>
        <Box
          style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'stretch', justifyContent: 'center'}}
        >
          <Text type="BodySmall" style={textStyle} backgroundMode="Terminal">
            To unlock this conversation, open one of your other devices or enter a paperkey.
          </Text>
          <Button
            type="Secondary"
            backgroundMode="Terminal"
            onClick={onEnterPaperkey}
            label="Enter a paper key"
          />
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
  textAlign: 'center',
  marginTop: globalMargins.large,
  marginBottom: globalMargins.large,
}

export default YouRekey
