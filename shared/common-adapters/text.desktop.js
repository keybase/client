// @flow
import React, {Component} from 'react'
import {findDOMNode} from 'react-dom'
import {globalStyles} from '../styles'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.desktop'

import type {Props, TextType, Background} from './text'

class Text extends Component<void, Props, void> {
  _span: any

  focus () {
    if (this._span) {
      this._span.focus()
    }
  }

  highlightText () {
    const el = findDOMNode(this._span)
    const range = document.createRange()
    range.selectNodeContents(el)

    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }

  render () {
    const style = {
      ...getStyle(this.props.type, this.props.backgroundMode, this.props.lineClamp, !!this.props.onClick),
      ...this.props.style,
    }

    const meta = metaData[this.props.type]

    const className = [
      this.props.className,
      meta.isLink ? 'hover-underline' : null,
    ].filter(Boolean).join(' ')

    return <span
      ref={ref => { this._span = ref }}
      className={className}
      style={style}
      onClick={this.props.onClick}>{this.props.children}</span>
  }
}

function getStyle (type: TextType, backgroundMode?: ?Background, lineClampNum?: ?number, clickable?: ?boolean) {
  const meta = metaData[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  const colorStyle = {color: meta.colorForBackgroundMode[backgroundMode || 'Normal'] || defaultColor(backgroundMode)}
  const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null
  const lineClampStyle = lineClampNum ? lineClamp(lineClampNum) : null
  const clickableStyle = clickable ? globalStyles.clickable : null

  return {
    ...sizeStyle,
    ...colorStyle,
    ...cursorStyle,
    ...lineClampStyle,
    ...clickableStyle,
    ...meta.styleOverride,
  }
}

export {
  getStyle,
}

export default Text
