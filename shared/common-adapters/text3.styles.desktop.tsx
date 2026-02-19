import * as Styles from '@/styles'
import {fontSizeToSizeStyle, metaData} from './text.meta.desktop'
import type {TextType, TextStyle} from './text3.shared'

export function getTextStyle(type: TextType, isDarkMode: boolean): TextStyle {
  const meta = metaData(isDarkMode)[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  // pipe positive color through because caller probably isn't using class
  const colorStyle = {color: meta.colorForBackground['positive']}
  const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null

  return Styles.platformStyles({
    common: {
      ...meta.styleOverride,
    },
    isElectron: {
      ...sizeStyle,
      ...colorStyle,
      ...cursorStyle,
    },
  })
}
