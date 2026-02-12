import * as React from 'react'
import * as Styles from '@/styles'
import {isAndroid} from '@/constants/platform'
import {emojiIndexByName} from '../markdown/emoji-gen'
import Text from '../text'

import type {Props} from './native-emoji'

const sizes = [16, 18, 22, 24, 26, 28, 32, 36] as const
const sizeStyle = new Map<(typeof sizes)[number], Styles.StylesCrossPlatform>(
  sizes.map(size => [size, {fontSize: size - 2, lineHeight: undefined}])
)

// Android fails to paint emoji glyphs in mixed-content Text nodes when the
// variant selector (VS16 / U+FE0F) is appended to codepoints that already
// have Emoji_Presentation. iOS and desktop handle it fine.
const emojiVariantSuffix = isAndroid ? '' : '\ufe0f'

const EmojiWrapper = React.memo(function EmojiWrapper(props: Props) {
  const {emojiName, size} = props
  return (
    <Text
      type="Body"
      style={Styles.collapseStyles([sizeStyle.get(size), props.style])}
      allowFontScaling={props.allowFontScaling}
    >
      {emojiIndexByName[emojiName] ? emojiIndexByName[emojiName] + emojiVariantSuffix : emojiName}
    </Text>
  )
})

export default EmojiWrapper
