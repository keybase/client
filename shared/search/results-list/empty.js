// @flow
import * as React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, platformStyles} from '../../styles'

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

const owlStyle = platformStyles({
  common: {
    textAlign: 'center',
  },
  isElectron: {
    whiteSpace: 'pre',
  },
})

export default EmptyResults
