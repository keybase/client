// @flow

import * as React from 'react'
import {Emoji, emojiIndex} from 'emoji-mart'

// Just the single set we use
import emojiSet from 'emoji-datasource-apple/img/apple/sheets/64.png'

import type {Props} from './emoji'

const backgroundImageFn = (set: string, sheetSize: string) => emojiSet

const skinToneRegex = /:([^:]*):(:skin-tone-\d:)?/i

const isValidEmoji = (fullEmoji: string) => {
  const parts = skinToneRegex.exec(fullEmoji)
  if (parts) {
    return !parts[1].startsWith('skin-tone') && emojiIndex.search(parts[1]).length > 0
  }
  return true
}

// Size 0 is cause we want the native emoji for copy/paste and not for rendering
const EmojiWrapper = (props: Props) => {
  const {emojiName, size} = props
  if (!isValidEmoji(emojiName)) {
    return emojiName
  }
  return (
    <Emoji emoji={emojiName} size={size} backgroundImageFn={backgroundImageFn}>
      <Emoji emoji={emojiName} size={0} native={true} />
    </Emoji>
  )
}

export {backgroundImageFn}

export default EmojiWrapper
