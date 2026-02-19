import {fontSizeToSizeStyle, metaData} from './text.meta.native'
import type {TextType, TextStyle} from './text3.shared'

export function getTextStyle(type: TextType, isDarkMode: boolean): TextStyle {
  const meta = metaData(isDarkMode)[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  const colorStyle = {color: meta.colorForBackground['positive']}

  return {
    ...sizeStyle,
    ...colorStyle,
    ...meta.styleOverride,
  }
}
