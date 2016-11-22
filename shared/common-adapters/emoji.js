// @flow

import React from 'react'
import {Emoji} from 'emoji-mart'

import type {Props} from 'emoji-mart'

const EmojiWrapper = (props: Props) => {
  return <Emoji {...props} emoji={[':', ...props.children, ':'].join('')} />
}

export default EmojiWrapper
