import * as React from 'react'
import {isAndroid} from '../constants/platform'
import {emojiIndexByName} from './markdown/emoji-gen'
import Text from './text'

import type {Props} from './emoji'

const familyOverride = isAndroid ? {fontFamily: ''} : {}

const sizeStyle = new Map([
  [16, {fontSize: 16 - 2, lineHeight: undefined, ...familyOverride}],
  [18, {fontSize: 18 - 2, lineHeight: undefined, ...familyOverride}],
  [32, {fontSize: 32 - 2, lineHeight: undefined, ...familyOverride}],
])

const EmojiWrapper = React.memo(function EmojiWrapper(props: Props) {
  const {emojiName, size} = props
  const emojiVariantSuffix = '\ufe0f' // see http://mts.io/2015/04/21/unicode-symbol-render-text-emoji/
  return (
    <Text
      type="Body"
      style={[sizeStyle.get(size), props.style as any]} // Mobile emoji need to be smaller with Proxima Nova
      allowFontScaling={props.allowFontScaling}
    >
      {!!emojiIndexByName[emojiName] && emojiIndexByName[emojiName] + emojiVariantSuffix}
    </Text>
  )
})

export default EmojiWrapper
