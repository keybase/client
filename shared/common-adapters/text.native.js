// @flow
import React, {Component} from 'react'
import openURL from '../util/open-url'
import {NativeText} from './native-wrappers.native'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'
import {clickableVisible} from '../local-debug'

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

  render() {
    const style = {
      ...getStyle(this.props.type, this.props.backgroundMode, this.props.lineClamp, !!this.props.onClick),
      ...(clickableVisible && this.props.onClick ? visibleStyle : {}),
      ...this.props.style,
    }

    if (style['color'] === undefined) {
      console.warn(
        'Text color is not being set properly, might be Markdown overriding to undefined (common-adapters/text.native.js)'
      )
    }

    return (
      <NativeText
        ref={ref => {
          this._nativeText = ref
        }}
        style={style}
        {...lineClamp(this.props.lineClamp)}
        onPress={this.props.onClick || (this.props.onClickURL ? this._urlClick : undefined)}
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
