import * as React from 'react'
import openURL from '@/util/open-url'
import {fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'
import type {Props, TextType, TextStyle} from './text'
import * as Styles from '@/styles'
import {Text as NativeText, Alert} from 'react-native'
import * as Clipboard from 'expo-clipboard'

const modes = ['positive', 'negative'] as const

const styles2 = Styles.styleSheetCreate(
  () =>
    ({
      center: {textAlign: 'center'},
      fixOverdraw: {backgroundColor: Styles.globalColors.fastBlank},
    }) as const
)
// TEMP
const styles = Styles.styleSheetCreate(() =>
  Object.keys(metaData(true)).reduce<{[key: string]: Styles._StylesCrossPlatform}>((map, type) => {
    const meta = metaData(true)[type as TextType]
    modes.forEach(mode => {
      map[`${type}:${mode}`] = {
        ...fontSizeToSizeStyle(meta.fontSize),
        color: meta.colorForBackground[mode] || Styles.globalColors.black,
        ...meta.styleOverride,
      } as Styles._StylesCrossPlatform
    })
    return map
  }, {})
)

// Init common styles for perf

const Text = React.memo(
  React.forwardRef<NativeText, Props>(function Text(p, ref) {
    const _urlClick = () => {
      p.onClickURL && openURL(p.onClickURL)
    }

    const _urlCopy = (url?: string) => {
      if (!url) return
      Clipboard.setStringAsync(url)
        .then(() => {})
        .catch(() => {})
    }

    const _urlChooseOption = () => {
      const url = p.onLongPressURL
      if (!url) return
      Alert.alert('', url, [
        {style: 'cancel', text: 'Cancel'},
        {onPress: () => openURL(url), text: 'Open Link'},
        {onPress: () => _urlCopy(url), text: 'Copy Link'},
      ])
    }

    const baseStyle: Styles.StylesCrossPlatform = styles[`${p.type}:${p.negative ? 'negative' : 'positive'}`]
    const dynamicStyle: Styles._StylesCrossPlatform = p.negative
      ? _getStyle(p.type, p.negative, !!p.underline)
      : {}

    let style: Array<Styles.StylesCrossPlatform> | Styles.StylesCrossPlatform
    if (!Object.keys(dynamicStyle).length) {
      style =
        p.style || p.center || p.fixOverdraw
          ? [baseStyle, p.center && styles2.center, p.fixOverdraw && styles2.fixOverdraw, p.style]
          : baseStyle
    } else {
      style = [baseStyle, dynamicStyle, p.center && styles2.center, p.style]
    }

    const onPress =
      p.onClick ||
      (p.onClickURL ? _urlClick : undefined) ||
      // If selectable and there isn't already an onClick handler,
      // make a dummy one so that it shows the selection (on iOS).
      (p.selectable ? () => {} : undefined)

    const onLongPress = p.onLongPress || (p.onLongPressURL ? _urlChooseOption : undefined)

    return (
      <NativeText
        ref={ref}
        selectable={p.selectable}
        textBreakStrategy={p.textBreakStrategy ?? 'simple'}
        style={style}
        {...lineClamp(p.lineClamp || undefined, p.ellipsizeMode || undefined)}
        onPress={onPress}
        onLongPress={onLongPress}
        allowFontScaling={p.allowFontScaling ?? false}
      >
        {p.children}
      </NativeText>
    )
  })
)

// external things call this so leave the original alone
function _getStyle(type: TextType, isDarkMode: boolean, negative?: boolean, forceUnderline?: boolean) {
  if (!negative) {
    return forceUnderline ? ({textDecorationLine: 'underline'} as const) : {}
  }
  // negative === true
  const meta = metaData(isDarkMode)[type]
  const colorStyle = {color: meta.colorForBackground.negative}
  const textDecoration = meta.isLink ? ({textDecorationLine: 'underline'} as const) : {}

  return {
    ...colorStyle,
    ...textDecoration,
  }
}
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

export default Text
