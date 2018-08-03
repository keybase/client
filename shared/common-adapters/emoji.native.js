// @flow
import * as React from 'react'
import {emojiIndexByName} from '../markdown/parser'
import Text from './text'

import type {Props} from './emoji'

const EmojiWrapper = (props: Props) => {
  const {emojiName, size} = props
  const emojiVariantSuffix = '\ufe0f' // see http://mts.io/2015/04/21/unicode-symbol-render-text-emoji/
  return (
    <Text
      type="Body"
      style={{fontSize: size, lineHeight: undefined}}
      allowFontScaling={props.allowFontScaling}
    >
      {!!emojiIndexByName[emojiName] && emojiIndexByName[emojiName] + emojiVariantSuffix}
    </Text>
  )
}

export default EmojiWrapper
