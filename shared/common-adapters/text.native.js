// @flow
import React, {Component} from 'react'
import openURL from '../util/open-url'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.native'
import {clickableVisible} from '../local-debug'
import glamorous from 'glamorous-native'
import shallowEqual from 'shallowequal'

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

    const StyledText = glamorous.text(style)

    return (
      <StyledText
        ref={ref => {
          this._nativeText = ref
        }}
        {...lineClamp(this.props.lineClamp)}
        onPress={this.props.onClick || (this.props.onClickURL ? this._urlClick : undefined)}
        onLongPress={this.props.onLongPress}
        allowFontScaling={this.props.allowFontScaling}
      >
        {this.props.children}
      </StyledText>
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
