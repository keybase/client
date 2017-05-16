// @flow
import React from 'react'
import {Text, Box} from '../../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../../styles'

export type Props = {
  timestamp: string,
}

const Timestamp = ({timestamp}: Props) => (
  <Box style={styleBox}>
    <Text style={styleText} type="BodySmallSemibold">{timestamp}</Text>
  </Box>
)

const styleBox = {
  ...globalStyles.flexBoxCenter,
}

const styleText = {
  color: globalColors.black_40,
  padding: globalMargins.tiny,
}
export default Timestamp
