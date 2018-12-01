// @flow
import * as React from 'react'
import {Box, Text, Button, StandardScreen} from '../../../common-adapters/mobile.native'
import {globalColors, globalStyles, globalMargins} from '../../../styles'
import type {Props} from './you-rekey.types'

const YouRekey = ({onEnterPaperkey, onBack}: Props) => {
  const bannerEl = (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        backgroundColor: globalColors.red,
        justifyContent: 'center',
      }}
    >
      <Text
        backgroundMode="Terminal"
        style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8, textAlign: 'center'}}
        type="BodySemibold"
      >
        This conversation needs to be rekeyed.
      </Text>
    </Box>
  )
  const notification = {message: bannerEl, type: 'error'}

  return (
    <StandardScreen onBack={onBack} theme="dark" notification={notification}>
      <Box style={containerStyle}>
        <Box
          style={{...globalStyles.flexBoxColumn, alignItems: 'stretch', flex: 1, justifyContent: 'center'}}
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
  marginBottom: globalMargins.large,
  marginTop: globalMargins.large,
  textAlign: 'center',
}

export default YouRekey
