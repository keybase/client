import React, {Component} from 'react'
import openURL from '../util/open-url'
import {fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'
import * as Styles from '../styles'
import shallowEqual from 'shallowequal'
import {NativeClipboard, NativeText, NativeStyleSheet, NativeAlert} from './native-wrappers.native'
import {Props, TextType} from './text'

const modes = ['positive', 'negative']

const styleMap = Object.keys(metaData()).reduce<{[key: string]: Styles.StylesCrossPlatform}>(
  (map, type) => {
    const meta = metaData()[type as TextType]
    modes.forEach(mode => {
      map[`${type}:${mode}`] = {
        ...fontSizeToSizeStyle(meta.fontSize),
        color: meta.colorForBackground[mode] || Styles.globalColors.black,
        ...meta.styleOverride,
      }
    })
    return map
  },
  {center: {textAlign: 'center'}}
)

// @ts-ignore TODO fix styles
const styles = NativeStyleSheet.create(styleMap)

// Init common styles for perf

class Text extends Component<Props> {
  static defaultProps = {
    allowFontScaling: false,
  }
  _nativeText: any

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

  _urlCopy = (url: string | null) => {
    if (!url) return
    NativeClipboard.setString(url)
  }

  _urlChooseOption = () => {
    const url = this.props.onLongPressURL
    if (!url) return
    NativeAlert.alert('', url, [
      {style: 'cancel', text: 'Cancel'},
      {onPress: () => openURL(url), text: 'Open Link'},
      {onPress: () => this._urlCopy(url), text: 'Copy Link'},
    ])
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (key === 'style') {
        return shallowEqual(obj, oth)
      } else if (key === 'children' && this.props.plainText && nextProps.plainText) {
        // child will be plain text
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render() {
    const baseStyle = styles[`${this.props.type}:${this.props.negative ? 'negative' : 'positive'}`]
    const dynamicStyle = this.props.negative
      ? _getStyle(
          this.props.type,
          this.props.negative,
          this.props.lineClamp,
          !!this.props.onClick,
          !!this.props.underline
        )
      : {}

    let style
    if (!Object.keys(dynamicStyle).length) {
      style =
        this.props.style || this.props.center
          ? [baseStyle, this.props.center && styles.center, this.props.style]
          : baseStyle
    } else {
      style = [baseStyle, dynamicStyle, this.props.center && styles.center, this.props.style]
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
        ref={ref => {
          this._nativeText = ref
        }}
        selectable={this.props.selectable}
        textBreakStrategy={this.props.textBreakStrategy}
        style={style}
        {...lineClamp(this.props.lineClamp || undefined, this.props.ellipsizeMode || undefined)}
        onPress={onPress}
        onLongPress={onLongPress}
        allowFontScaling={this.props.allowFontScaling}
      >
        {this.props.children}
      </NativeText>
    )
  }
}

// external things call this so leave the original alone
function _getStyle(
  type: TextType,
  negative?: boolean,
  _?: number | null,
  __?: boolean | null,
  // @ts-ignore the order of these parameters because this is used in a lot
  // of places
  forceUnderline: boolean
) {
  if (!negative) {
    return forceUnderline ? {textDecorationLine: 'underline'} : {}
  }
  // negative === true
  const meta = metaData()[type]
  const colorStyle = {color: meta.colorForBackground.negative}
  const textDecoration = meta.isLink ? {textDecorationLine: 'underline'} : {}

  return {
    ...colorStyle,
    ...textDecoration,
  }
}
function getStyle(type: TextType, negative?: boolean, _?: number | null, __?: boolean | null) {
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
export {Text as TextMixed}
export {allTextTypes} from './text.shared'
