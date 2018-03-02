// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Text} from '../../common-adapters'

type ProgressProps = {
  completePortion: number,
  text: string,
}

const Progress = ({completePortion, text}: ProgressProps) => (
  <Box style={stylesOuter}>
    <Box style={stylesTubeBox}>
      <Box style={stylesTube} />
      <Box style={{...stylesTubeStuffing, width: completePortion * 40}} />
    </Box>
    <Text type="BodySmallSemibold" style={stylesText}>
      {text}
    </Text>
  </Box>
)

const stylesOuter = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'flex-start',
}

const stylesTubeBox = {
  paddingTop: 2,
  marginRight: globalMargins.xtiny,
}

const stylesTube = {
  height: 4,
  width: 40,
  borderRadius: 4.5,
  backgroundColor: globalColors.black_20,
  marginTop: 3,
}

const stylesTubeStuffing = {
  ...stylesTube,
  backgroundColor: globalColors.white,
  marginTop: -4,
}

const stylesText = {
  color: globalColors.white,
  lineHeight: 1.2,
  fontSize: 10,
}

export default Progress
