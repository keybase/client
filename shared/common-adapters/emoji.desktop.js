// @flow

import * as React from 'react'
import {Emoji, emojiIndex} from 'emoji-mart'

// Just the single set we use
import emojiSet from 'emoji-datasource-apple/img/apple/sheets/64.png'

import type {Props} from './emoji'

const backgroundImageFn = (set: string, sheetSize: string) => emojiSet

// Workaround for bug where if an invalid emoji name is supplied to Emoji,
// a full crash is triggered. Here we check the value between the first
// pair of colons & make sure it's not a skin-tone modifier and that we
// have a match for it in the emoji index
// Bug filed here: https://github.com/missive/emoji-mart/issues/143
const emojiDataRegex = /:([^:]*):(:skin-tone-\d:)?/i
const isValidEmoji = (fullEmoji: string) => {
  const match = emojiDataRegex.exec(fullEmoji)
  if (match) {
    const id = match[1] && match[1].toLowerCase()
    const searchResults = emojiIndex.search(id)
    for (let emoji of searchResults) {
      if (emoji.id.toLowerCase() === id) {
        return true
      }
    }
  }
  return false
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
