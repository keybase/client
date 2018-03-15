// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
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
  marginRight: globalMargins.xtiny,
  paddingTop: 2,
}

const stylesTube = {
  backgroundColor: globalColors.black_20,
  borderRadius: 4.5,
  height: 4,
  marginTop: 3,
  width: 40,
}

const stylesTubeStuffing = {
  ...stylesTube,
  backgroundColor: globalColors.white,
  marginTop: -4,
}

const stylesText = platformStyles({
  common: {
    color: globalColors.white,
    fontSize: 10,
    lineHeight: 1.2,
  },
})

export default Progress
