// @flow
import React from 'react'
import {emojiIndexByName} from '../markdown/parser'
import Text from './text'

import type {Props} from './emoji'

const EmojiWrapper = (props: Props) => {
  const emojiName = props.children ? props.children.join('') : ''
  return <Text type='Body' style={{fontSize: props.size}}>{emojiIndexByName[emojiName]}</Text>
}

export default EmojiWrapper
