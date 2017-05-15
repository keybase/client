// @flow
import React from 'react'
import {Box, Icon, Text} from '../common-adapters'

export default function FacebookDescription() {
  return (
    <Box style={{flexDirection: 'column'}}>
      <Box>
        <Text style={{textAlign: 'center'}} type="BodySemibold">
          Click the link below and post. The text can be whatever you like, but make sure the post is
          {' '}
          <Text type="BodySemiboldItalic">public</Text>
          , like this:
        </Text>
      </Box>
      <Box style={{alignItems: 'center'}}>
        <Icon type="icon-facebook-visibility" />
      </Box>
    </Box>
  )
}
