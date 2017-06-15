// @flow
import React, {Component} from 'react'
// import openURL from '../util/open-url'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.desktop'
import {findDOMNode} from 'react-dom'
import {globalStyles} from '../styles'
import shallowEqual from 'shallowequal'

import type {Props, TextType, Background} from './text'

class Text extends Component<void, Props, void> {
  _span: any

  highlightText() {
    const el = findDOMNode(this._span)
    const range = document.createRange()
    range.selectNodeContents(el)

    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }

  _setRef = (ref: any) => {
    this._span = ref
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

  _style(props) {
    return {
      ...getStyle(props.type, props.backgroundMode, props.lineClamp, !!props.onClick),
      ...props.style,
    }
  }

  _className(props) {
    const meta = metaData[props.type]
    const className = [props.className, meta.isLink ? 'hover-underline' : null].filter(Boolean).join(' ')

    return className || undefined
  }

  _urlClick = () => {
    // this.props.onClickURL && openURL(this.props.onClickURL)
  }

  render() {
    const style = this._style(this.props)
    const className = this._className(this.props)

    return (
      <span
        title={this.props.title}
        ref={this.props.allowHighlightText ? this._setRef : undefined}
        className={className}
        style={style}
        onClick={this.props.onClick || (this.props.onClickURL && this._urlClick)}
      >
        {this.props.children}
      </span>
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
  const colorStyle = {color: meta.colorForBackgroundMode[backgroundMode] || defaultColor(backgroundMode)}
  const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null
  const lineClampStyle = lineClampNum ? lineClamp(lineClampNum) : null
  const clickableStyle = clickable ? globalStyles.clickable : null
  const textDecoration = meta.isLink && backgroundMode !== 'Normal' ? {textDecoration: 'underline'} : null

  return {
    ...sizeStyle,
    ...colorStyle,
    ...cursorStyle,
    ...lineClampStyle,
    ...clickableStyle,
    ...textDecoration,
    ...meta.styleOverride,
  }
}

export {getStyle}

export default Text
