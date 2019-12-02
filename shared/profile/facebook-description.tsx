import * as React from 'react'
import {Box, Text} from '../common-adapters'

export default function FacebookDescription() {
  return (
    <Box style={{flexDirection: 'column', maxWidth: 360}}>
      <Box>
        <Text center={true} type="BodySemibold">
          Post your proof to Facebook. Make sure it’s <Text type="BodySemiboldItalic">public</Text>, or we
          won’t be able to read it.
        </Text>
      </Box>
    </Box>
  )
}
