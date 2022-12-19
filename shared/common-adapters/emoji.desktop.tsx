import type {Props} from './emoji'
import {type EmojiData, emojiNameMap, skinTones} from '../util/emoji'

// Just the single set we use
// @ts-ignore
import emojiSet from 'emoji-datasource-apple/img/apple/sheets/64.png'

const unifiedToNative = (unified: string) =>
  String.fromCodePoint(...unified.split('-').map(u => Number(`0x${u}`)))

const nameReg = /^(?::([^:]+):)(?::skin-tone-(\d):)?$/

const EmojiWrapper = (props: Props) => {
  const {emojiName, size, style} = props

  const match = emojiName.match(nameReg)
  if (!match) return null
  const name = match[1]
  const skin = match[2]

  let emoji: EmojiData | undefined = emojiNameMap[name]
  if (skin) {
    const skinNum = parseInt(skin)
    if (!isNaN(skinNum)) {
      emoji = emoji?.skin_variations?.[skinTones[skinNum - 1] ?? ''] as typeof emoji
    }
  }

  if (!emoji) return null

  const {sheet_x, sheet_y} = emoji
  const sheetColumns = 61
  const sheetRows = 61
  const multiplyX = 100 / (sheetColumns - 1)
  const multiplyY = 100 / (sheetRows - 1)
  const backgroundPosition = `${multiplyX * sheet_x}% ${multiplyY * sheet_y}%`
  const backgroundSize = `${100 * sheetColumns}% ${100 * sheetRows}%`
  const backgroundImage = `url("${emojiSet as string}")`

  return (
    <span
      className="emoji"
      title={name}
      style={{
        backgroundImage,
        backgroundPosition,
        backgroundSize,
        display: 'inline-block',
        height: size,
        width: size,
        ...(style as any),
      }}
    >
      {!props.disableSelecting && (
        <span className="emoji emoji-native">{unifiedToNative(emoji.unified)}</span>
      )}
    </span>
  )
}

export default EmojiWrapper
