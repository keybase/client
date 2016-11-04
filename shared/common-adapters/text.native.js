// @flow
import React, {Component} from 'react'
import {NativeText} from './index.native'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'

import type {Props, TextType, Background} from './text'

class Text extends Component<void, Props, void> {
  _nativeText: any

  focus () {
    if (this._nativeText) {
      this._nativeText.focus()
    }
  }

  render () {
    const style = {
      ...getStyle(this.props.type, this.props.backgroundMode, this.props.lineClamp, !!this.props.onClick),
      ...this.props.style,
    }

    return <NativeText
      ref={ref => { this._nativeText = ref }}
      style={style}
      {...lineClamp(this.props.lineClamp)}
      onPress={this.props.onClick}>{this.props.children}</NativeText>
  }
}

function getStyle (type: TextType, backgroundMode?: ?Background, lineClampNum?: ?number, clickable?: ?boolean) {
  const meta = metaData[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  const colorStyle = {color: meta.colorForBackgroundMode[backgroundMode || 'Normal'] || defaultColor(backgroundMode)}
  const textDecoration = meta.isLink ? {textDecorationLine: 'underline'} : {}

  return {
    ...sizeStyle,
    ...colorStyle,
    ...textDecoration,
    ...meta.styleOverride,
  }
}

export {
  getStyle,
}

export default Text
