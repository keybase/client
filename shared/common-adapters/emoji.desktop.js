// @flow

import React from 'react'
import {Emoji} from 'emoji-mart'

import type {Props} from 'emoji-mart'

const backgroundImageFn = (set, sheetSize) => require(`emoji-datasource/sheet_${set}_${sheetSize}.png`)

const EmojiWrapper = (props: Props) => {
  return <Emoji {...props} emoji={[':', ...props.children, ':'].join('')} backgroundImageFn={backgroundImageFn} />
}

export {backgroundImageFn}

export default EmojiWrapper
