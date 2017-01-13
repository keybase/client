// @flow

import React from 'react'
import {Emoji} from 'emoji-mart'

// Just the single set we use
import emojiSet from 'emoji-datasource/sheet_apple_64.png'

import type {Props} from 'emoji-mart'

const backgroundImageFn = (set: string, sheetSize: string) => emojiSet

const EmojiWrapper = (props: Props) => {
  const emojiText = `:${props.children}:`
  return (
    <Emoji {...props} emoji={emojiText} backgroundImageFn={backgroundImageFn}>
      <span style={{opacity: 0}}>
        <Emoji emoji={emojiText} size={props.size} native={true} />
      </span>
    </Emoji>
  )
}

export {backgroundImageFn}

export default EmojiWrapper
