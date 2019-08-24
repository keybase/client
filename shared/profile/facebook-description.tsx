import * as React from 'react'
import {Box, Icon, Text} from '../common-adapters'
import {globalMargins} from '../styles'

export default function FacebookDescription() {
  return (
    <Box style={{flexDirection: 'column', maxWidth: 360}}>
      <Box>
        <Text center={true} type="BodySemibold">
          Post your proof to Facebook. Make sure it’s <Text type="BodySemiboldItalic">public</Text>, or we
          won’t be able to read it:
        </Text>
      </Box>
      <Box style={{alignItems: 'center', marginTop: globalMargins.small}}>
        <Icon type="icon-facebook-visibility" />
      </Box>
    </Box>
  )
}
