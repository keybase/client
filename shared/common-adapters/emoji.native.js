// @flow
import React from 'react'
import {emojiIndexByName} from '../markdown/parser'
import Text from './text'

import type {Props} from './emoji'

const EmojiWrapper = (props: Props) => {
  const emojiName = props.children ? props.children.join('') : ''
  const emojiVariantSuffx = '\ufe0f'  // see http://mts.io/2015/04/21/unicode-symbol-render-text-emoji/
  return <Text type='Body' style={{fontSize: props.size}}>{emojiIndexByName[emojiName] + emojiVariantSuffx}</Text>
}

export default EmojiWrapper
