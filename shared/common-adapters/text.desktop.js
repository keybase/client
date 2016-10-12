// @flow
import React, {Component} from 'react'
import {findDOMNode} from 'react-dom'
import {globalStyles, globalColors} from '../styles'

import type {Context} from './terminal'
import type {Props, MetaType} from './text'

class Text extends Component<void, Props, void> {
  context: Context;
  // _terminalPrefix (type: $PropertyType<Props, 'type'>): ?React$Element<*> {
    // return ({
      // 'TerminalEmpty': <span>&nbsp;</span>,
      // 'TerminalCommand': <span>> </span>,
      // 'TerminalComment': <span># </span>,
    // }: {[key: string]: React$Element<*>})[type]
  // }

  // static _isLink (type: $PropertyType<Props>) {
    // return !!({
      // 'HeaderLink': true,
      // 'BodyPrimaryLink': true,
      // 'BodySmallLink': true,
      // 'BodySmallPrimaryLink': true,
      // 'BodySmallSecondaryLink': true,
      // 'BodyXSmallLink': true,
    // }[type])
  // }

  // static _inlineStyle (type: $PropertyType<Props, 'type'>, context: Context): Object {
    // switch (type) {
      // case 'Terminal':
      // case 'TerminalCommand':
      // case 'TerminalComment':
      // case 'TerminalUsername':
      // case 'TerminalPublic':
      // case 'TerminalPrivate':
      // case 'TerminalSmall':
        // return context.inTerminal ? {} : styles.textTerminalInline
      // default:
        // return {}
    // }
  // }

  // static _colorStyleBackgroundMode (backgroundMode: Background, type: $PropertyType<Props, 'type'>): Object {
    // if (backgroundMode === 'Information') {
      // return {color: globalColors.brown_60}
    // }
    // switch (type) {
      // case 'HeaderBig':
      // case 'Header':
      // case 'BodySemibold':
      // case 'BodySemiboldItalic':
      // case 'BodySmallSemibold':
      // case 'Body':
        // return {color: backgroundMode === 'Normal' ? globalColors.black_75 : globalColors.white}
      // case 'BodySmall':
      // case 'BodySmallItalic':
      // case 'BodyXSmall':
        // return {color: backgroundMode === 'Normal' ? globalColors.black_40 : globalColors.white_40}
      // case 'BodySmallLink':
      // case 'BodyXSmallLink':
        // return {color: backgroundMode === 'Normal' ? globalColors.black_60 : globalColors.white_75}
      // default:
        // return {}
    // }
  // }

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

  // _typeStyle () {
    // return {
      // 'BadgeNumber': styles.textBadge,
      // 'Body': styles.textBody,
      // 'BodyPrimaryLink': styles.textBodyPrimaryLink,
      // 'BodySemibold': styles.textBodySemibold,
      // 'BodySemiboldItalic': {...styles.textBodySemibold, ...globalStyles.italic, cursor: 'default'},
      // 'BodySmall': styles.textBodySmall,
      // 'BodySmallItalic': {...styles.textBodySmall, ...globalStyles.italic},
      // 'BodySmallError': styles.textBodySmallError,
      // 'BodySmallLink': styles.textBodySmallLink,
      // 'BodySmallPrimaryLink': styles.textBodySmallPrimaryLink,
      // 'BodySmallSecondaryLink': styles.textBodySmallSecondaryLink,
      // 'BodySmallSemibold': styles.textBodySmallSemibold,
      // 'BodyXSmall': styles.textBodyXSmall,
      // 'BodyXSmallLink': styles.textBodyXSmallLink,
      // 'Error': styles.textError,
      // 'Header': styles.textHeader,
      // 'HeaderBig': styles.textHeaderBig,
      // 'HeaderError': styles.textHeaderError,
      // 'HeaderLink': styles.textHeaderLink,
      // 'InputHeader': styles.textInputHeader,
      // 'Terminal': {...styles.textTerminal, color: (this.context.inTerminal ? globalColors.blue3 : globalColors.darkBlue)},
      // 'TerminalCommand': styles.textTerminalCommand,
      // 'TerminalComment': styles.textTerminalComment,
      // 'TerminalEmpty': styles.textTerminalEmpty,
      // 'TerminalPrivate': styles.textTerminalPrivate,
      // 'TerminalPublic': styles.textTerminalPublic,
      // 'TerminalSmall': {...styles.textTerminalSmall, color: (this.context.inTerminal ? globalColors.blue3 : globalColors.darkBlue)},
      // 'TerminalUsername': styles.textTerminalUsername,
    // }[this.props.type]
  // }

  render () {
    const meta = metaData[this.props.type] || metaData['HeaderBig'] // TODO other types

    // let inline = true
    // if (this.props.hasOwnProperty('inline')) {
      // inline = this.props.inline
    // }

    const sizeStyle = _fontSizeToSizeStyle(meta.fontSize)
    const colorStyle = {color: meta.colorForBackgroundMode[this.props.backgroundMode || 'Normal'] || globalColors.white}
    const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null
    const lineClampStyle = this.props.lineClamp ? _lineClamp(this.props.lineClamp) : null
    const clickableStyle = this.props.onClick ? globalStyles.clickable : null
    // TODO simplify thisA
    // const inlineStyle = inline && meta.isTerminal && context.inTerminal ? styles.textTerminalInline : {display: 'block'}

    const style = {
      ...sizeStyle,
      ...colorStyle,
      ...cursorStyle,
      ...lineClampStyle,
      ...clickableStyle,
      // ...inlineStyle,
      ...meta.styleOverride,
      ...this.props.style,
    }

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
          onClick={this.props.onClick}>{meta.prefix}{this.props.children}
        </span>)
    }
  }
}

Text.contextTypes = {
  inTerminal: React.PropTypes.bool,
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

const metaData: {[key: $PropertyType<Props, 'type'>]: MetaType} = {
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
      'Normal': globalColors.darkBlue,
      'Terminal': globalColors.blue3,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontRegular,
      lineHeight: '20px',
    },
  },
}

// const sizeGroups: { [key: '24' | '16' | '14' | '13' | '11']: Object } = {
  // '24': {
    // fontSize: 24,
    // lineHeight: '28px',
  // },
  // '16': {
    // fontSize: 16,
    // lineHeight: '20px',
  // },
  // '14': {
    // fontSize: 14,
    // lineHeight: '18px',
  // },
  // '13': {
    // fontSize: 13,
    // lineHeight: '17px',
  // },
  // '11': {
    // fontSize: 11,
    // lineHeight: '15px',
  // },
// }

// const textCommon = {
  // ...globalStyles.fontRegular,
  // cursor: 'inherit',
// }

// const textTerminal = {
  // ...globalStyles.fontTerminalSemibold,
  // fontSize: 14,
  // lineHeight: '21px',
// }

// const headerStyles = {
  // textHeaderBig: {
    // ...textCommon,
    // ...globalStyles.fontBold,
    // ...sizeGroups['24'],
  // },

  // textHeader: {
    // ...textCommon,
    // ...globalStyles.fontSemibold,
    // ...sizeGroups['16'],
  // },

  // textHeaderLink: {
    // ...textCommon,
    // ...globalStyles.fontSemibold,
    // ...sizeGroups['16'],
    // color: globalColors.blue,
  // },

  // textInputHeader: {
    // ...textCommon,
    // ...globalStyles.fontSemibold,
    // fontSize: 14,
    // lineHeight: '18px',
    // color: globalColors.blue,
  // },
// }

const specialStyles = {
  // textInput: {
    // ...textCommon,
    // ...globalStyles.fontSemibold,
    // fontSize: 24,
    // lineHeight: '29px',
  // },
  // paperKey: {
    // ...textCommon,
    // ...globalStyles.fontTerminalSemibold,
    // color: globalColors.black_75,
    // fontSize: 18,
    // lineHeight: '24px',
  // },
  // username: {
    // ...textCommon,
    // ...globalStyles.fontBold,
    // fontSize: 24,
    // lineHeight: '31px',
    // color: globalColors.orange,
  // },
}

const styles = {
  // ...headerStyles,
  // textBody: {
    // ...textCommon,
    // ...sizeGroups['16'],
  // },
  // textBodyPrimaryLink: {
    // ...textCommon,
    // ...sizeGroups['16'],
    // color: globalColors.blue,
  // },
  // textBodySemibold: {
    // ...textCommon,
    // ...globalStyles.fontSemibold,
    // ...sizeGroups['16'],
  // },
  // textBodySmall: {
    // ...textCommon,
    // ...sizeGroups['14'],
  // },
  // textBadge: {
    // ...textCommon,
    // ...globalStyles.fontBold,
    // ...sizeGroups['14'],
    // lineHeight: '18px',
    // color: globalColors.white,
  // },
  // textBodySmallLink: {
    // ...textCommon,
    // ...sizeGroups['14'],
  // },
  // textBodySmallError: {
    // ...textCommon,
    // ...sizeGroups['14'],
    // color: globalColors.red,
  // },
  // textBodySmallPrimaryLink: {
    // ...textCommon,
    // ...sizeGroups['14'],
    // color: globalColors.blue,
  // },
  // textBodyXSmall: {
    // ...textCommon,
    // ...sizeGroups['12'],
  // },
  // textBodyXSmallLink: {
    // ...textCommon,
    // ...sizeGroups['12'],
  // },
  // textBodySmallSecondaryLink: {
    // ...textCommon,
    // ...sizeGroups['14'],
    // color: globalColors.black_60,
  // },
  // textBodySmallSemibold: {
    // ...textCommon,
    // ...globalStyles.fontSemibold,
    // ...sizeGroups['14'],
  // },
  // textError: {
    // ...textCommon,
    // color: globalColors.red,
    // fontSize: 14,
    // lineHeight: '17px',
  // },
  // textTerminal,
  // textTerminalCommand: {
    // ...textTerminal,
  // },
  // textTerminalComment: {
    // ...textTerminal,
    // color: globalColors.blue3_40,
  // },
  // textTerminalUsername: {
    // ...textTerminal,
    // color: globalColors.orange,
  // },
  // textTerminalPublic: {
    // ...textTerminal,
    // color: globalColors.yellowGreen2,
  // },
  // textTerminalPrivate: {
    // ...textTerminal,
    // color: globalColors.darkBlue2,
  // },
  // textTerminalEmpty: {
    // ...textTerminal,
    // minHeight: 20,
  // },
  // textTerminalSmall: {
    // ...textTerminal,
    // ...sizeGroups['14'],
  // },
  // textTerminalInline: {
    // backgroundColor: globalColors.blue4,
    // wordWrap: 'break-word',
    // padding: 2,
    // display: 'inline-block',
  // },
}

export {
  specialStyles,
  styles,
  metaData,
}

export default Text
