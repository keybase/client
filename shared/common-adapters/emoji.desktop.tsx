import * as React from 'react'
import type {Props} from './emoji'
import {emojiNameMap} from '../chat/conversation/messages/react-button/emoji-picker/data'

// Just the single set we use
// @ts-ignore
import emojiSet from 'emoji-datasource-apple/img/apple/sheets/64.png'

const unifiedToNative = (unified: string) =>
  String.fromCodePoint(...unified.split('-').map(u => Number(`0x${u}`)))

const nameReg = /^(?:\:([^\:]+)\:)(?:\:skin-tone-(\d)\:)?$/
const skins = ['1F3FA', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF']

const EmojiWrapper = (props: Props) => {
  const {emojiName, size} = props

  const match = emojiName.match(nameReg)
  if (!match) return null
  const name = match[1]
  const skin = match[2]

  let emoji = emojiNameMap[name]
  if (skin) {
    const skinNum = parseInt(skin)
    if (!isNaN(skinNum)) {
      emoji = emoji?.skin_variations?.[skins[skinNum - 1] ?? '']
    }
  }

  if (!emoji) return null

  const {sheet_x, sheet_y} = emoji
  const sheetColumns = 57
  const sheetRows = 57
  const multiplyX = 100 / (sheetColumns - 1)
  const multiplyY = 100 / (sheetRows - 1)
  const backgroundPosition = `${multiplyX * sheet_x}% ${multiplyY * sheet_y}%`
  const backgroundSize = `${100 * sheetColumns}% ${100 * sheetRows}%`
  const backgroundImage = `url("${emojiSet}")`

  return (
    <span
      className="emoji-mart-emoji"
      title={name}
      style={{
        backgroundImage,
        backgroundPosition,
        backgroundSize,
        display: 'inline-block',
        height: size,
        width: size,
      }}
    >
      {!props.disableSelecting && (
        <span className="emoji-mart-emoji emoji-mart-emoji-native">{unifiedToNative(emoji.unified)}</span>
      )}
    </span>
  )
}

export default EmojiWrapper
