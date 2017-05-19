// @flow
import React, {Component} from 'react'
import openURL from '../util/open-url'
import {NativeClipboard, NativeText} from './native-wrappers.native'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'
import {clickableVisible} from '../local-debug'

import {Alert} from 'react-native'

import type {Props, TextType, Background} from './text'

class Text extends Component<void, Props, void> {
  _nativeText: any

  focus() {
    if (this._nativeText) {
      this._nativeText.focus()
    }
  }

  _urlClick = () => {
    openURL(this.props.onClickURL)
  }

  _urlCopy = () => {
    NativeClipboard.setString(this.props.onClickURL)
  }

  _urlChooseOption = () => {
    Alert.alert('', this.props.onClickURL, [
      {style: 'cancel', text: 'Cancel'},
      {onPress: this._urlClick, text: 'Open Link'},
      {onPress: this._urlCopy, text: 'Copy Link'},
    ])
  }

  render() {
    const style = {
      ...getStyle(this.props.type, this.props.backgroundMode, this.props.lineClamp, !!this.props.onClick),
      ...(clickableVisible && this.props.onClick ? visibleStyle : {}),
      ...this.props.style,
    }

    return (
      <NativeText
        ref={ref => {
          this._nativeText = ref
        }}
        style={style}
        {...lineClamp(this.props.lineClamp)}
        onPress={this.props.onClick || (this.props.onClickURL ? this._urlClick : undefined)}
        onLongPress={this._urlChooseOption}
      >
        {this.props.children}
      </NativeText>
    )
  }
}

const visibleStyle = {
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
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

export {getStyle}

export default Text
