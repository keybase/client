// @flow

import React from 'react'
import {Emoji} from 'emoji-mart'

import type {Props} from 'emoji-mart'

type SetType = 'apple' | 'emojione' | 'google' | 'twitter'
type SheetSizeType = '16' | '20' | '32' | '64'
const backgroundImageFn = (set: SetType, sheetSize: SheetSizeType) => {
  switch (set) {
    case 'apple':
      return {
        '16': require('emoji-datasource/sheet_apple_16.png'),
        '20': require('emoji-datasource/sheet_apple_20.png'),
        '32': require('emoji-datasource/sheet_apple_32.png'),
        '64': require('emoji-datasource/sheet_apple_64.png'),
      }[sheetSize]
    case 'emojione':
      return {
        '16': require('emoji-datasource/sheet_emojione_16.png'),
        '20': require('emoji-datasource/sheet_emojione_20.png'),
        '32': require('emoji-datasource/sheet_emojione_32.png'),
        '64': require('emoji-datasource/sheet_emojione_64.png'),
      }[sheetSize]
    case 'google':
      return {
        '16': require('emoji-datasource/sheet_google_16.png'),
        '20': require('emoji-datasource/sheet_google_20.png'),
        '32': require('emoji-datasource/sheet_google_32.png'),
        '64': require('emoji-datasource/sheet_google_64.png'),
      }[sheetSize]
    case 'twitter':
      return {
        '16': require('emoji-datasource/sheet_twitter_16.png'),
        '20': require('emoji-datasource/sheet_twitter_20.png'),
        '32': require('emoji-datasource/sheet_twitter_32.png'),
        '64': require('emoji-datasource/sheet_twitter_64.png'),
      }[sheetSize]
  }
}

const EmojiWrapper = (props: Props) => {
  return <Emoji {...props} emoji={[':', ...props.children, ':'].join('')} backgroundImageFn={backgroundImageFn} />
}

export {backgroundImageFn}

export default EmojiWrapper
