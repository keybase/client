// @flow

import React from 'react'
import {Emoji} from 'emoji-mart'

// Just the single set we use
import emojiSet from 'emoji-datasource/sheet_apple_64.png'

import type {Props} from 'emoji-mart'

const backgroundImageFn = (set: string, sheetSize: string) => emojiSet

// Size 0 is cause we want the native emoji for copy/paste and not for rendering
const EmojiWrapper = (props: Props) => {
  const emojiText = String(props.children)
  return (
    <Emoji {...props} emoji={emojiText} backgroundImageFn={backgroundImageFn}>
      <Emoji emoji={emojiText} size={0} native={true} />
    </Emoji>
  )
}

export {backgroundImageFn}

export default EmojiWrapper
