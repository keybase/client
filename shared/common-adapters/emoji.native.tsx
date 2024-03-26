import * as React from 'react'
import * as Styles from '@/styles'
import {isAndroid} from '@/constants/platform'
import {emojiIndexByName} from './markdown/emoji-gen'
import Text from './text'

import type {Props} from './emoji'

const familyOverride = isAndroid ? {fontFamily: ''} : {}

const sizes = [16, 18, 22, 24, 26, 28, 32, 36] as const
const sizeStyle = new Map<(typeof sizes)[number], Styles.StylesCrossPlatform>(
  sizes.map(size => [size, {fontSize: size - 2, lineHeight: undefined, ...familyOverride}])
)

const EmojiWrapper = React.memo(function EmojiWrapper(props: Props) {
  const {emojiName, size} = props
  const emojiVariantSuffix = '\ufe0f' // see http://mts.io/2015/04/21/unicode-symbol-render-text-emoji/
  return (
    <Text
      type="Body"
      style={Styles.collapseStyles([sizeStyle.get(size), props.style])} // Mobile emoji need to be smaller with Proxima Nova
      allowFontScaling={props.allowFontScaling}
    >
      {!!emojiIndexByName[emojiName] && emojiIndexByName[emojiName] + emojiVariantSuffix}
    </Text>
  )
})

export default EmojiWrapper
