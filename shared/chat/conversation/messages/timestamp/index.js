// @flow
import React from 'react'
import {Text, Box} from '../../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../../styles'

export type Props = {
  timestamp: string,
  style: Object,
}

const Timestamp = ({timestamp, style}: Props) => {
  // if (id === '1487729110517') {
    // console.log('aaaa', id, style)
  // }

  return (
    <Box style={style}>
      <Box style={globalStyles.flexBoxRow}>
        <Text style={styleText} type='BodySmallSemibold'>{Date.now()} {timestamp}</Text>
      </Box>
    </Box>
  )
}

export const styleText = {
  color: globalColors.black_40,
  flex: 1,
  padding: globalMargins.tiny,
  textAlign: 'center',
}
export default Timestamp
