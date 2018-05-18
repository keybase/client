// @flow
import * as React from 'react'
import {emojiIndexByName} from '../markdown/parser'
import Text from './text'

type Props = {
  size?: number,
  emojiName: string,
  allowFontScaling?: boolean,
}

const EmojiWrapper = (props: Props) => {
  const {emojiName, size} = props
  const emojiVariantSuffx = '\ufe0f' // see http://mts.io/2015/04/21/unicode-symbol-render-text-emoji/
  return (
    <Text
      type="Body"
      style={{fontSize: size, lineHeight: undefined}}
      allowFontScaling={props.allowFontScaling}
    >
      {emojiIndexByName[emojiName] + emojiVariantSuffx}
    </Text>
  )
}

export default EmojiWrapper
