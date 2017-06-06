// @flow

import React from 'react'
import {Emoji} from 'emoji-mart'

// Just the single set we use
import emojiSet from 'emoji-datasource-apple/img/apple/sheets/64.png'

import type {Props} from './emoji'

const backgroundImageFn = (set: string, sheetSize: string) => emojiSet

// Size 0 is cause we want the native emoji for copy/paste and not for rendering
const EmojiWrapper = (props: Props) => {
  const {emojiName, size} = props
  return (
    <Emoji emoji={emojiName} size={size} backgroundImageFn={backgroundImageFn}>
      <Emoji emoji={emojiName} size={0} native={true} />
    </Emoji>
  )
}

export {backgroundImageFn}

export default EmojiWrapper
