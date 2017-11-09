// @flow
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
    <Text type="BodySmall" style={{textAlign: 'center'}}>
      Sorry, no conversations match this.
    </Text>
    <Text type="BodySmall" style={{textAlign: 'center'}}>
      ,___,
    </Text>
    <Text type="BodySmall" style={{textAlign: 'center'}}>
      [O.o]
    </Text>
    <Text type="BodySmall" style={{textAlign: 'center'}}>
      /)__)
    </Text>
    <Text type="BodySmall" style={{textAlign: 'center'}}>
      -"--"-
    </Text>
  </Box>
)
