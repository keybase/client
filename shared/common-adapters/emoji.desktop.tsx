import type {Props} from './emoji'
import {type EmojiData, emojiNameMap, skinTones} from '@/util/emoji-shared'
import {spriteSheetWidth, spriteSheetHeight} from './markdown/emoji-gen'
import * as Styles from '@/styles'

// Just the single set we use
import emojiSet from 'emoji-datasource-apple/img/apple/sheets/64.png'

const unifiedToNative = (unified: string) =>
  String.fromCodePoint(...unified.split('-').map(u => Number(`0x${u}`)))

const nameReg = /^(?::([^:]+):)(?::skin-tone-(\d):)?$/

const EmojiWrapper = (props: Props) => {
  const {emojiName, size, style} = props

  const match = emojiName.match(nameReg)
  if (!match) return null
  const name = match[1] ?? ''
  const skin = match[2]

  let emoji: EmojiData | undefined = emojiNameMap[name]
  if (skin) {
    const skinNum = parseInt(skin)
    if (!isNaN(skinNum)) {
      const tone = skinTones[skinNum - 1] ?? ''
      if (tone) {
        emoji = emoji?.skin_variations?.[tone] as typeof emoji
      }
    }
  }

  if (!emoji) return null

  const {sheet_x, sheet_y} = emoji
  const sheetColumns = spriteSheetWidth
  const sheetRows = spriteSheetHeight
  const multiplyX = 100 / (sheetColumns - 1)
  const multiplyY = 100 / (sheetRows - 1)
  const backgroundPosition = `${multiplyX * sheet_x}% ${multiplyY * sheet_y}%`
  const backgroundSize = `${100 * sheetColumns}% ${100 * sheetRows}%`
  const backgroundImage = `url("${emojiSet}")`

  return (
    <span
      className="emoji"
      title={name}
      style={Styles.castStyleDesktop(
        Styles.platformStyles({
          isElectron: {
            backgroundImage,
            backgroundPosition,
            backgroundSize,
            display: 'inline-block',
            height: size,
            width: size,
            ...style,
          },
        })
      )}
    >
      {!props.disableSelecting && (
        <span className="emoji emoji-native">{unifiedToNative(emoji.unified)}</span>
      )}
    </span>
  )
}

export default EmojiWrapper
