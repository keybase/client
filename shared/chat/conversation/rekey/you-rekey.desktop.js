// @flow
import React from 'react'
import {Box, Button, Text} from '../../../common-adapters'
import {globalColors, globalStyles} from '../../../styles'

import type {Props} from './you-rekey'

const YouRekey = ({onRekey}: Props) => {
  return (
    <Box style={containerStyle}>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          backgroundColor: globalColors.red,
          justifyContent: 'center',
        }}
      >
        <Text
          backgroundMode="Terminal"
          style={{
            paddingBottom: 8,
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 8,
          }}
          type="BodySemibold"
        >
          This conversation needs to be rekeyed.
        </Text>
      </Box>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Button type="Secondary" backgroundMode="Terminal" onClick={onRekey} label="Rekey" />
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
