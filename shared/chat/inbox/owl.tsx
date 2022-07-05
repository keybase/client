import * as React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles} from '../../styles'

export const Owl = () => (
  <Box
    style={{
      ...globalStyles.fillAbsolute,
      ...globalStyles.flexBoxColumn,
      justifyContent: 'center',
      zIndex: -1,
    }}
  >
    <Text center={true} type="BodySmall">
      Sorry, no conversations match this.
    </Text>
    <Text center={true} type="BodySmall">
      ,___,
    </Text>
    <Text center={true} type="BodySmall">
      [O.o]
    </Text>
    <Text center={true} type="BodySmall">
      /)__)
    </Text>
    <Text center={true} type="BodySmall">
      -"--"-
    </Text>
  </Box>
)
