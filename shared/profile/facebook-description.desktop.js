// @flow
import React from 'react'
import {Box, Text} from '../common-adapters'
import {resolveImageAsURL} from '../../desktop/resolve-root'

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
        <img src={__SCREENSHOT__ ? resolveImageAsURL('facebook_visibility-static.png') : resolveImageAsURL('facebook_visibility.gif')} />
      </Box>
    </Box>
  )
}
