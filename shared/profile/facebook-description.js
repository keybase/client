// @flow
import React from 'react'
import {Box, Icon, Text} from '../common-adapters'
import {globalMargins} from '../styles'

export default function FacebookDescription() {
  return (
    <Box style={{flexDirection: 'column'}}>
      <Box>
        <Text style={{textAlign: 'center'}} type="BodySemibold">
          Finally, post your proof to Facebook. We'll ask for permission to read your posts, so that we can find this one afterwards. The text can be whatever you like, but — and this is really important — make sure your post is
          {' '}
          <Text type="BodySemiboldItalic">public</Text>
          , like this:
        </Text>
      </Box>
      <Box style={{alignItems: 'center', marginTop: globalMargins.small}}>
        <Icon type="icon-facebook-visibility" />
      </Box>
    </Box>
  )
}
