// @flow
import React, {Component} from 'react'
import openURL from '../util/open-url'
import {NativeText} from './native-wrappers.native'
import {
  defaultColor,
  fontSizeToSizeStyle,
  lineClamp,
  metaData,
} from './text.meta.native'

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
      ...getStyle(
        this.props.type,
        this.props.backgroundMode,
        this.props.lineClamp,
        !!this.props.onClick
      ),
      ...this.props.style,
    }

    return (
      <NativeText
        ref={ref => {
          this._nativeText = ref
        }}
        style={style}
        {...lineClamp(this.props.lineClamp)}
        onPress={
          this.props.onClick ||
            (this.props.onClickURL ? this._urlClick : undefined)
        }
      >
        {this.props.children}
      </NativeText>
    )
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
  const colorStyle = {
    color: meta.colorForBackgroundMode[backgroundMode] ||
      defaultColor(backgroundMode),
  }
  const textDecoration = meta.isLink && backgroundMode !== 'Normal'
    ? {textDecorationLine: 'underline'}
    : {}

  return {
    ...sizeStyle,
    ...colorStyle,
    ...textDecoration,
    ...meta.styleOverride,
  }
}

export {getStyle}

export default Text
