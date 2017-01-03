// @flow

import React from 'react'
import {Emoji} from 'emoji-mart'

// Just the single set we use
import emojiSet from 'emoji-datasource/sheet_apple_64.png'

import type {Props} from 'emoji-mart'

const backgroundImageFn = (set: string, sheetSize: string) => emojiSet

const EmojiWrapper = (props: Props) => {
  return <Emoji {...props} emoji={[':', ...props.children, ':'].join('')} backgroundImageFn={backgroundImageFn} />
}

export {backgroundImageFn}

export default EmojiWrapper
