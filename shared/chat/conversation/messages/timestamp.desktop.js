// @flow
import React from 'react'
import {Text} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import type {Props} from './timestamp'

const Timestamp = ({timestamp, style}: Props) => (
  <div style={{...globalStyles.flexBoxRow, ...style}}>
    <Text style={styleText} type='BodySmallSemibold'>{timestamp}</Text>
  </div>
)

export const styleText = {
  padding: globalMargins.tiny,
  flex: 1,
  textAlign: 'center',
  color: globalColors.black_40,
}
export default Timestamp
