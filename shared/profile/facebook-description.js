// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../common-adapters'
import {globalMargins} from '../styles'

export default function FacebookDescription() {
  return (
    <Box style={{flexDirection: 'column', maxWidth: 460}}>
      <Box>
        <Text style={{textAlign: 'center'}} type="BodySemibold">
          Post your proof to Facebook. We’ll ask for permission to read your posts so we can find it. The text
          can be whatever you like, but make sure it’s <Text type="BodySemiboldItalic">public</Text>
          , like this, or we won’t be able to read it:
        </Text>
      </Box>
      <Box style={{alignItems: 'center', marginTop: globalMargins.small}}>
        <Icon type="icon-facebook-visibility" />
      </Box>
    </Box>
  )
}
