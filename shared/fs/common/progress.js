// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Box, Text} from '../../common-adapters'
import {memoize} from 'lodash-es'

type ProgressProps = {
  completePortion: number,
  text: string,
  width: number,
}

const Progress = ({completePortion, text, width}: ProgressProps) => (
  <Box style={stylesOuter}>
    <Box style={stylesTubeBox}>
      <Box style={stylesTube(width)} />
      <Box style={{...stylesTubeStuffing, width: completePortion * width}} />
    </Box>
    <Text type="BodySmallSemibold" style={stylesText}>
      {text}
    </Text>
  </Box>
)

const stylesOuter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'flex-start',
}

const stylesTubeBox = {
  marginRight: globalMargins.xtiny,
}

const stylesTube = memoize(width => ({
  backgroundColor: globalColors.black_20,
  borderRadius: 4.5,
  height: 4,
  marginTop: 3,
  width,
}))

const stylesTubeStuffing = {
  ...stylesTube(),
  backgroundColor: globalColors.white,
  marginTop: -4,
}

const stylesText = platformStyles({
  common: {
    color: globalColors.white,
    fontSize: 10,
    lineHeight: 14,
  },
})

export default Progress
