import * as React from 'react'
import {emojiIndexByName} from './markdown/emoji-gen'
import Text from './text'

import {Props} from './emoji'

const EmojiWrapper = (props: Props) => {
  const {emojiName, size} = props
  const emojiVariantSuffix = '\ufe0f' // see http://mts.io/2015/04/21/unicode-symbol-render-text-emoji/
  return (
    <Text
      type="Body"
      style={{fontSize: size ? size - 2 : undefined, lineHeight: undefined}} // Mobile emoji need to be smaller with Proxima Nova
      allowFontScaling={props.allowFontScaling}
    >
      {!!emojiIndexByName[emojiName] && emojiIndexByName[emojiName] + emojiVariantSuffix}
    </Text>
  )
}

export default EmojiWrapper
