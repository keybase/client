// @flow
import React, {Component} from 'react'
import openURL from '../util/open-url'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'
import * as Styled from '../styles'
import shallowEqual from 'shallowequal'
import {NativeClipboard, NativeText, NativeStyleSheet, NativeAlert} from './native-wrappers.native'
import type {Props, TextType, Background} from './text'

const StyledText = Styled.styled(NativeText)({}, props => props.style)

const backgroundModes = [
  'Normal',
  'Announcements',
  'Success',
  'Information',
  'HighRisk',
  'Documentation',
  'Terminal',
]

const styleMap = Object.keys(metaData).reduce(
  (map, type: TextType) => {
    const meta = metaData[type]
    backgroundModes.forEach(mode => {
      map[`${type}:${mode}`] = {
        ...fontSizeToSizeStyle(meta.fontSize),
        color: meta.colorForBackgroundMode[mode] || defaultColor(mode),
        ...meta.styleOverride,
      }
    })
    return map
  },
  {
    center: {textAlign: 'center'},
  }
)

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
    openURL(this.props.onClickURL)
  }

  _urlCopy = (url: ?string) => {
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
    const baseStyle = styles[`${this.props.type}:${this.props.backgroundMode || 'Normal'}`]
    const dynamicStyle = {
      ...(this.props.backgroundMode === 'Normal'
        ? {}
        : _getStyle(
            this.props.type,
            this.props.backgroundMode,
            this.props.lineClamp,
            !!this.props.onClick,
            !!this.props.underline
          )),
    }

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
      <StyledText
        ref={ref => {
          this._nativeText = ref
        }}
        selectable={this.props.selectable}
        style={style}
        {...lineClamp(this.props.lineClamp, this.props.ellipsizeMode)}
        onPress={onPress}
        onLongPress={onLongPress}
        allowFontScaling={this.props.allowFontScaling}
      >
        {this.props.children}
      </StyledText>
    )
  }
}

// external things call this so leave the original alone
function _getStyle(
  type: TextType,
  backgroundMode?: Background = 'Normal',
  lineClampNum?: ?number,
  clickable?: ?boolean,
  forceUnderline: boolean
) {
  if (backgroundMode === 'Normal') {
    return forceUnderline ? {textDecorationLine: 'underline'} : {}
  }
  const meta = metaData[type]
  const colorStyle = {color: meta.colorForBackgroundMode[backgroundMode] || defaultColor(backgroundMode)}
  const textDecoration = meta.isLink ? {textDecorationLine: 'underline'} : {}

  return {
    ...colorStyle,
    ...textDecoration,
  }
}
function getStyle(
  type: TextType,
  backgroundMode?: Background = 'Normal',
  lineClampNum?: ?number,
  clickable?: ?boolean
) {
  const meta = metaData[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  const colorStyle = {color: meta.colorForBackgroundMode[backgroundMode] || defaultColor(backgroundMode)}
  const textDecoration = meta.isLink && backgroundMode !== 'Normal' ? {textDecorationLine: 'underline'} : {}

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
