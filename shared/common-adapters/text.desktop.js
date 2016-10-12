// @flow
import React, {Component} from 'react'
import {findDOMNode} from 'react-dom'
import {globalStyles, globalColors} from '../styles'

import type {Props, MetaType, TextType, Background} from './text'

class Text extends Component<void, Props, void> {
  focus () {
    if (this.refs && this.refs.text) {
      this.refs.text.focus()
    }
  }

  highlightText () {
    const el = findDOMNode(this.refs.text)
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

    const meta = _metaData[this.props.type] || _metaData['HeaderBig']

    const className = [
      this.props.className,
      meta.isLink ? 'hover-underline' : null,
    ].filter(Boolean).join(' ')

    if (this.props.contentEditable) {
      return (
        <span
          ref='text'
          className={className}
          style={style}
          contentEditable={true}
          onKeyUp={this.props.onKeyUp}
          onKeyDown={this.props.onKeyDown}
          onClick={this.props.onClick} />)
    } else {
      return (
        <span
          ref='text'
          className={className}
          style={style}
          onClick={this.props.onClick}>{this.props.children}
        </span>)
    }
  }
}

function _defaultColor (backgroundMode: ?Background) {
  if (!backgroundMode) {
    backgroundMode = 'Normal'
  }

  return {
    'Normal': globalColors.white,
    'Announcements': globalColors.white,
    'Success': globalColors.white,
    'Information': globalColors.brown_60,
    'HighRisk': globalColors.white,
    'Documentation': globalColors.white,
    'Terminal': globalColors.white,
  }[backgroundMode]
}

function getStyle (type: TextType, backgroundMode?: ?Background, lineClamp?: ?number, clickable?: ?boolean) {
  const meta = _metaData[type] || _metaData['HeaderBig']

  const sizeStyle = _fontSizeToSizeStyle(meta.fontSize)
  const colorStyle = {color: meta.colorForBackgroundMode[backgroundMode || 'Normal'] || _defaultColor(backgroundMode)}
  const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null
  const lineClampStyle = lineClamp ? _lineClamp(lineClamp) : null
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

function _lineClamp (lines: number): Object {
  return {
    overflow: 'hidden',
    display: '-webkit-box',
    textOverflow: 'ellipsis',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
  }
}

function _fontSizeToSizeStyle (fontSize: number): ?Object {
  const height = {
    '24': 28,
    '16': 20,
    '14': 18,
    '13': 17,
    '11': 15,
  }[String(fontSize)]

  const lineHeight = height ? `${height}px` : null
  return {
    fontSize,
    lineHeight,
  }
}

const _blackNormalWhiteTerminal = {
  'Normal': globalColors.black_75,
  'Terminal': globalColors.white,
}

const _blueLink = {
  'Normal': globalColors.blue,
}

const _metaData: {[key: TextType]: MetaType} = {
  // Header
  'HeaderBig': {
    fontSize: 24,
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    styleOverride: globalStyles.fontBold,
  },
  'Header': {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontSemibold,
  },
  'HeaderLink': {
    colorForBackgroundMode: _blueLink,
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body big
  'BodyBig': {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 14,
    styleOverride: globalStyles.fontSemibold,
  },
  'BodyBigLink': {
    colorForBackgroundMode: _blueLink,
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body
  'Body': {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  'BodySemibold': {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 13,
    styleOverride: globalStyles.fontSemibold,
  },
  'BodySemiboldItalic': {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontSemibold,
      fontStyle: 'italic',
    },
  },
  'BodyPrimaryLink': {
    colorForBackgroundMode: {
      'Normal': globalColors.blue,
      'Terminal': globalColors.white,
    },
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  'BodySecondaryLink': {
    colorForBackgroundMode: {'Normal': globalColors.black_60},
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  'BodyError': {
    colorForBackgroundMode: {'Normal': globalColors.red},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  'BodySuccess': {
    colorForBackgroundMode: {'Normal': globalColors.green2},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  // Body Small
  'BodySmall': {
    colorForBackgroundMode: {
      'Normal': globalColors.black_40,
      'Terminal': globalColors.white_40,
    },
    fontSize: 11,
    styleOverride: globalStyles.fontRegular,
  },
  'BodySmallItalic': {
    colorForBackgroundMode: {
      'Normal': globalColors.black_40,
      'Terminal': globalColors.white_40,
    },
    fontSize: 11,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  'BodySmallInlineLink': {
    colorForBackgroundMode: {
      'Normal': globalColors.black_40,
      'Terminal': globalColors.white_40,
    },
    fontSize: 11,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  'BodySmallSemibold': {
    colorForBackgroundMode: {
      'Normal': globalColors.black_40,
      'Terminal': globalColors.white_40,
    },
    fontSize: 11,
    styleOverride: globalStyles.fontSemibold,
  },
  'BodySmallSemiboldInlineLink': {
    colorForBackgroundMode: {
      'Normal': globalColors.black_40,
      'Terminal': globalColors.white_40,
    },
    fontSize: 11,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  'BodySmallPrimaryLink': {
    colorForBackgroundMode: {
      'Normal': globalColors.blue,
      'Terminal': globalColors.white,
    },
    fontSize: 11,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  'BodySmallSecondaryLink': {
    colorForBackgroundMode: {'Normal': globalColors.black_60},
    fontSize: 11,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  'BodySmallError': {
    colorForBackgroundMode: {'Normal': globalColors.red},
    fontSize: 11,
    styleOverride: globalStyles.fontRegular,
  },
  'BodySmallSuccess': {
    colorForBackgroundMode: {'Normal': globalColors.green2},
    fontSize: 11,
    styleOverride: globalStyles.fontRegular,
  },
  // Terminal
  'Terminal': {
    colorForBackgroundMode: {
      'Normal': globalColors.blue3,
      'Terminal': globalColors.blue3,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: '20px',
    },
  },
  'TerminalComment': {
    colorForBackgroundMode: {
      'Normal': globalColors.blue3_40,
      'Terminal': globalColors.blue3_40,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: '20px',
    },
  },
  'TerminalEmpty': {
    colorForBackgroundMode: {
      'Normal': globalColors.blue3_40,
      'Terminal': globalColors.blue3_40,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontTerminal,
      height: 20,
      lineHeight: '20px',
    },
  },
  'TerminalInline': {
    colorForBackgroundMode: {
      'Normal': globalColors.darkBlue,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontTerminal,
      backgroundColor: globalColors.blue4,
      borderRadius: 2,
      display: 'inline-block',
      lineHeight: '14px',
      height: 16,
      padding: 2,
      wordWrap: 'break-word',
    },
  },
}

// TODO kill
const specialStyles = { }
const styles = { }

export {
  specialStyles,
  styles,
  // metaData,
  getStyle,
}

export default Text
