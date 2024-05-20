import * as React from 'react'
import openURL from '@/util/open-url'
import {fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'
import shallowEqual from 'shallowequal'
import type {Props, TextType} from './text'
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
const styles = Styles.styleSheetCreate(() =>
  Object.keys(metaData()).reduce<{[key: string]: Styles._StylesCrossPlatform}>((map, type) => {
    const meta = metaData()[type as TextType]
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

class Text extends React.Component<Props> {
  _nativeText: null | {focus: () => void} = null

  highlightText() {
    // ignored
  }

  focus() {
    if (this._nativeText) {
      this._nativeText.focus()
    }
  }

  _urlClick = () => {
    this.props.onClickURL && openURL(this.props.onClickURL)
  }

  _urlCopy = (url?: string) => {
    if (!url) return
    Clipboard.setStringAsync(url)
      .then(() => {})
      .catch(() => {})
  }

  _urlChooseOption = () => {
    const url = this.props.onLongPressURL
    if (!url) return
    Alert.alert('', url, [
      {style: 'cancel', text: 'Cancel'},
      {onPress: () => openURL(url), text: 'Open Link'},
      {onPress: () => this._urlCopy(url), text: 'Copy Link'},
    ])
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    return !shallowEqual(this.props, nextProps, (obj: unknown, oth: unknown, key: unknown) => {
      if (key === 'style') {
        return shallowEqual(obj, oth)
      } else if (key === 'children' && this.props.plainText && nextProps.plainText) {
        // child will be plain text
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  private setRef = (r: typeof this._nativeText) => {
    this._nativeText = r
  }

  render() {
    const baseStyle: Styles.StylesCrossPlatform =
      styles[`${this.props.type}:${this.props.negative ? 'negative' : 'positive'}`]
    const dynamicStyle: Styles._StylesCrossPlatform = this.props.negative
      ? _getStyle(this.props.type, this.props.negative, !!this.props.underline)
      : {}

    let style: Array<Styles.StylesCrossPlatform> | Styles.StylesCrossPlatform
    if (!Object.keys(dynamicStyle).length) {
      style =
        this.props.style || this.props.center || this.props.fixOverdraw
          ? [
              baseStyle,
              this.props.center && styles2.center,
              this.props.fixOverdraw && styles2.fixOverdraw,
              this.props.style,
            ]
          : baseStyle
    } else {
      style = [baseStyle, dynamicStyle, this.props.center && styles2.center, this.props.style]
    }

    const onPress =
      this.props.onClick ||
      (this.props.onClickURL ? this._urlClick : undefined) ||
      // If selectable and there isn't already an onClick handler,
      // make a dummy one so that it shows the selection (on iOS).
      (this.props.selectable ? () => {} : undefined)

    const onLongPress =
      this.props.onLongPress || (this.props.onLongPressURL ? this._urlChooseOption : undefined)

    return (
      <NativeText
        ref={this.setRef}
        selectable={this.props.selectable}
        textBreakStrategy={this.props.textBreakStrategy ?? 'simple'}
        style={style}
        {...lineClamp(this.props.lineClamp || undefined, this.props.ellipsizeMode || undefined)}
        onPress={onPress}
        onLongPress={onLongPress}
        allowFontScaling={this.props.allowFontScaling ?? false}
      >
        {this.props.children}
      </NativeText>
    )
  }
}

// external things call this so leave the original alone
function _getStyle(type: TextType, negative?: boolean, forceUnderline?: boolean) {
  if (!negative) {
    return forceUnderline ? ({textDecorationLine: 'underline'} as const) : {}
  }
  // negative === true
  const meta = metaData()[type]
  const colorStyle = {color: meta.colorForBackground.negative}
  const textDecoration = meta.isLink ? ({textDecorationLine: 'underline'} as const) : {}

  return {
    ...colorStyle,
    ...textDecoration,
  }
}
function getStyle(type: TextType, negative?: boolean) {
  const meta = metaData()[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  const colorStyle = {color: meta.colorForBackground[negative ? 'negative' : 'positive']}
  const textDecoration = meta.isLink && negative ? {textDecorationLine: 'underline'} : {}

  return {
    ...sizeStyle,
    ...colorStyle,
    ...textDecoration,
    ...meta.styleOverride,
  }
}

export default Text
export {getStyle}
