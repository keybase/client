import * as Styles from '@/styles'
import {emojiIndexByName, spriteSheetWidth, spriteSheetHeight} from '../markdown/emoji-gen'
import Text from '../text'
import {type EmojiData} from '.'
import {emojiData} from './data'
import type {Props} from './native-emoji.shared'

const sizes = [16, 18, 22, 24, 26, 28, 32, 36] as const
const sizeStyle = new Map<(typeof sizes)[number], Styles.StylesCrossPlatform>(
  sizes.map(size => [size, {fontSize: size - 2, lineHeight: undefined}])
)

const emojiVariantSuffix = isAndroid ? '' : '️'

// Desktop: sprite sheet
import emojiSet from 'emoji-datasource-apple/img/apple/sheets/64.png'

const unifiedToNative = (unified: string) =>
  String.fromCodePoint(...unified.split('-').map(u => Number(`0x${u}`)))

const nameReg = /^(?::([^:]+):)(?::skin-tone-(\d):)?$/

function EmojiWrapper(props: Props) {
  const {emojiName, size} = props

  if (isMobile) {
    return (
      <Text
        type="Body"
        style={Styles.collapseStyles([sizeStyle.get(size), props.style])}
        allowFontScaling={props.allowFontScaling}
      >
        {emojiIndexByName[emojiName] ? emojiIndexByName[emojiName] + emojiVariantSuffix : emojiName}
      </Text>
    )
  }

  const match = emojiName.match(nameReg)
  if (!match) {
    if (emojiName) {
      return (
        <span
          className="emoji emoji-native"
          style={Styles.castStyleDesktop(
            Styles.platformStyles({
              common: {...props.style},
              isElectron: {
                display: 'inline-block',
                fontSize: size,
                height: size,
                width: size,
              } as const,
            })
          )}
        >
          {emojiName}
        </span>
      )
    } else {
      return null
    }
  }
  const name = match[1] ?? ''
  const skin = match[2]

  let emoji: EmojiData | undefined = emojiData.emojiNameMap[name]
  if (skin) {
    const skinNum = parseInt(skin)
    if (!isNaN(skinNum)) {
      const tone = emojiData.skinTones[skinNum - 1] ?? ''
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
          common: {...props.style},
          isElectron: {
            backgroundImage,
            backgroundPosition,
            backgroundSize,
            display: 'inline-block',
            height: size,
            width: size,
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
