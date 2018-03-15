// @flow
import React, {Component} from 'react'
import openURL from '../util/open-url'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'
import {glamorous} from '../styles'
import shallowEqual from 'shallowequal'
import {StyleSheet} from 'react-native'

import type {Props, TextType, Background} from './text'

const StyledText = glamorous.text({}, props => props.style)

const backgroundModes = [
  'Normal',
  'Announcements',
  'Success',
  'Information',
  'HighRisk',
  'Documentation',
  'Terminal',
]

const styleMap = Object.keys(metaData).reduce((map, type: TextType) => {
  const meta = metaData[type]
  backgroundModes.forEach(mode => {
    map[`${type}:${mode}`] = {
      ...fontSizeToSizeStyle(meta.fontSize),
      color: meta.colorForBackgroundMode[mode] || defaultColor(mode),
      ...meta.styleOverride,
    }
  })
  return map
}, {})

const styles = StyleSheet.create(styleMap)

// Init common styles for perf

class Text extends Component<Props> {
  _nativeText: any

  focus() {
    if (this._nativeText) {
      this._nativeText.focus()
    }
  }

  _urlClick = () => {
    openURL(this.props.onClickURL)
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
        : _getStyle(this.props.type, this.props.backgroundMode, this.props.lineClamp, !!this.props.onClick)),
    }

    let style
    if (!Object.keys(dynamicStyle).length) {
      style = this.props.style ? [baseStyle, this.props.style] : baseStyle
    } else {
      style = [baseStyle, dynamicStyle, this.props.style]
    }

    const onPress =
      this.props.onClick ||
      (this.props.onClickURL ? this._urlClick : undefined) ||
      // If selectable and there isn't already an onClick handler,
      // make a dummy one so that it shows the selection (on iOS).
      (this.props.selectable ? () => {} : undefined)

    return (
      <StyledText
        ref={ref => {
          this._nativeText = ref
        }}
        selectable={this.props.selectable}
        style={style}
        {...lineClamp(this.props.lineClamp)}
        onPress={onPress}
        onLongPress={this.props.onLongPress}
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
  clickable?: ?boolean
) {
  if (backgroundMode === 'Normal') return null
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
