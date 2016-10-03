// @flow
import React from 'react'
import {Box, Icon, Text} from '../common-adapters'

const styleCentered = {
  style: {
    textAlign: 'center',
  },
}

export default function FacebookDescription () {
  return (
    <Box style={{flexDirection: 'column'}}>
      <Box>
        <Text type='Body' {...styleCentered}>Click the link below and post. The text can be whatever you like, but make sure the post is <Text type='BodySemibold'>public</Text>, like this:</Text>
      </Box>
      <Box style={{padding: 20}}>
        <Icon type='icon-facebook-visibility' />
      </Box>
    </Box>
  )
}
