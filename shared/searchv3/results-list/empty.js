// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles} from '../../styles'
import {isMobile} from '../../constants/platform'

const owl = `
 ,___,
 [O.o]
 /)__)
 -"--"-`

function EmptyResults({style}: {style?: Object}) {
  return (
    <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.flexBoxColumn, height: 256, ...style}}>
      <Text type="BodySmallSemibold">Sorry, no humans match this.</Text>
      <Text type="BodySmallSemibold" style={owlStyle}>
        {owl}
      </Text>
    </Box>
  )
}

const owlStyle = {
  textAlign: 'center',
  ...(isMobile ? {} : {whiteSpace: 'pre'}),
}

export default EmptyResults
