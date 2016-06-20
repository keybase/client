/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {findDOMNode} from 'react-dom'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {Props, Background} from './text'
import type {Context} from './terminal'

const LinkTypes = {
  'HeaderLink': true,
  'BodyPrimaryLink': true,
  'BodySmallLink': true,
  'BodySmallPrimaryLink': true,
  'BodySmallSecondaryLink': true,
  'BodyXSmallLink': true,
}

export default class Text extends Component {
  props: Props;
  context: Context;

  _terminalPrefix (type: Props.type): ?React$Element {
    return ({
      'TerminalEmpty': <span>&nbsp;</span>,
      'TerminalCommand': <span>> </span>,
      'TerminalComment': <span># </span>,
    }: {[key: string]: React$Element})[type]
  }

  static _inlineStyle (type: Props.type, context: Context): Object {
    switch (type) {
      case 'Terminal':
      case 'TerminalCommand':
      case 'TerminalComment':
      case 'TerminalUsername':
      case 'TerminalPublic':
      case 'TerminalPrivate':
      case 'TerminalSmall':
        return context.inTerminal ? {} : styles.textTerminalInline
      default:
        return {}
    }
  }

  static _colorStyleBackgroundMode (backgroundMode: Background, type: Props.type): Object {
    if (backgroundMode === 'Information') {
      return {color: globalColors.brown_60}
    }
    switch (type) {
      case 'HeaderJumbo':
      case 'HeaderBig':
      case 'Header':
      case 'BodySemibold':
      case 'BodySemiboldItalic':
      case 'BodySmallSemibold':
      case 'Body':
        return {color: backgroundMode === 'Normal' ? globalColors.black_75 : globalColors.white}
      case 'BodySmall':
      case 'BodyXSmall':
        return {color: backgroundMode === 'Normal' ? globalColors.black_40 : globalColors.white_40}
      case 'BodySmallLink':
      case 'BodyXSmallLink':
        return {color: backgroundMode === 'Normal' ? globalColors.black_60 : globalColors.white_75}
      default:
        return {}
    }
  }

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

  _typeStyle () {
    return {
      'BadgeNumber': styles.textBadge,
      'Body': styles.textBody,
      'BodyPrimaryLink': styles.textBodyPrimaryLink,
      'BodySemibold': styles.textBodySemibold,
      'BodySemiboldItalic': {...styles.textBodySemibold, ...globalStyles.italic, cursor: 'default'},
      'BodySmall': styles.textBodySmall,
      'BodySmallError': styles.textBodySmallError,
      'BodySmallLink': styles.textBodySmallLink,
      'BodySmallPrimaryLink': styles.textBodySmallPrimaryLink,
      'BodySmallSecondaryLink': styles.textBodySmallSecondaryLink,
      'BodySmallSemibold': styles.textBodySmallSemibold,
      'BodyXSmall': styles.textBodyXSmall,
      'BodyXSmallLink': styles.textBodyXSmallLink,
      'Error': styles.textError,
      'Header': styles.textHeader,
      'HeaderBig': styles.textHeaderBig,
      'HeaderError': styles.textHeaderError,
      'HeaderJumbo': styles.textHeaderJumbo,
      'HeaderLink': styles.textHeaderLink,
      'InputHeader': styles.textInputHeader,
      'Terminal': {...styles.textTerminal, color: (this.context.inTerminal ? globalColors.blue3 : globalColors.darkBlue)},
      'TerminalCommand': styles.textTerminalCommand,
      'TerminalComment': styles.textTerminalComment,
      'TerminalEmpty': styles.textTerminalEmpty,
      'TerminalPrivate': styles.textTerminalPrivate,
      'TerminalPublic': styles.textTerminalPublic,
      'TerminalSmall': {...styles.textTerminalSmall, color: (this.context.inTerminal ? globalColors.blue3 : globalColors.darkBlue)},
      'TerminalUsername': styles.textTerminalUsername,
    }[this.props.type]
  }

  render () {
    const typeStyle = this._typeStyle()
    let inline = true
    if (this.props.hasOwnProperty('inline')) {
      inline = this.props.inline
    }

    // $FlowIssue not types in the dict
    const linkClassname = LinkTypes[this.props.type] ? 'hover-underline' : null

    const style = {
      ...typeStyle,
      ...(LinkTypes[this.props.type] ? {cursor: 'pointer'} : {}),
      ...Text._colorStyleBackgroundMode(this.props.backgroundMode || 'Normal', this.props.type),
      ...(this.props.lineClamp ? lineClamp(this.props.lineClamp) : {}),
      ...(this.props.onClick ? globalStyles.clickable : {}),
      ...(inline ? {...Text._inlineStyle(this.props.type, this.context)} : {display: 'block'}),
      ...this.props.style,
    }

    const terminalPrefix = this._terminalPrefix(this.props.type)
    const className = (this.props.className || '') + ' ' + (linkClassname || '')

    if (this.props.contentEditable) {
      return (
        <span
          ref='text'
          className={className}
          style={style}
          contentEditable
          onKeyUp={this.props.onKeyUp}
          onKeyDown={this.props.onKeyDown}
          onClick={this.props.onClick} />)
    }

    return (
      <span
        ref='text'
        className={className}
        style={style}
        onClick={this.props.onClick}>{terminalPrefix}{this.props.children}</span>)
  }
}

Text.contextTypes = {
  inTerminal: React.PropTypes.bool,
}

const sizeGroups: { [key: '32' | '24' | '18' | '16' | '14' | '12']: Object } = {
  '32': {
    fontSize: 32,
    lineHeight: '38px',
  },
  '24': {
    fontSize: 24,
    lineHeight: '31px',
  },
  '18': {
    fontSize: 18,
    lineHeight: '25px',
  },
  '16': {
    fontSize: 16,
    lineHeight: '22px',
  },
  '14': {
    fontSize: 14,
    lineHeight: '19px',
  },
  '12': {
    fontSize: 12,
    lineHeight: '15px',
  },
}

const textCommon = {
  ...globalStyles.fontRegular,
  ...globalStyles.noSelect,
  cursor: 'inherit',
  letterSpacing: '0.3px',
}

const textTerminal = {
  ...globalStyles.fontTerminalSemibold,
  fontSize: 14,
  lineHeight: '21px',
}

const headerStyles = {
  textHeaderJumbo: {
    ...textCommon,
    ...globalStyles.fontBold,
    ...sizeGroups['32'],
  },

  textHeaderBig: {
    ...textCommon,
    ...globalStyles.fontBold,
    ...sizeGroups['24'],
  },

  textHeader: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['18'],
  },

  textHeaderLink: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['18'],
    color: globalColors.blue,
  },

  textHeaderError: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['18'],
    color: globalColors.red,
  },

  textInputHeader: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 14,
    lineHeight: '18px',
    color: globalColors.blue,
  },
}

export const specialStyles = {
  textInput: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 24,
    lineHeight: '29px',
  },
  paperKey: {
    ...textCommon,
    ...globalStyles.fontTerminalSemibold,
    color: globalColors.black_75,
    fontSize: 18,
    lineHeight: '24px',
  },
  username: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 24,
    lineHeight: '31px',
    color: globalColors.orange,
  },
}

export const styles = {
  ...headerStyles,
  textBody: {
    ...textCommon,
    ...sizeGroups['16'],
  },
  textBodyPrimaryLink: {
    ...textCommon,
    ...sizeGroups['16'],
    color: globalColors.blue,
  },
  textBodySemibold: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['16'],
  },
  textBodySmall: {
    ...textCommon,
    ...sizeGroups['14'],
  },
  textBadge: {
    ...textCommon,
    ...globalStyles.fontBold,
    ...sizeGroups['14'],
    lineHeight: '18px',
    color: globalColors.white,
  },
  textBodySmallLink: {
    ...textCommon,
    ...sizeGroups['14'],
  },
  textBodySmallError: {
    ...textCommon,
    ...sizeGroups['14'],
    color: globalColors.red,
  },
  textBodySmallPrimaryLink: {
    ...textCommon,
    ...sizeGroups['14'],
    color: globalColors.blue,
  },
  textBodyXSmall: {
    ...textCommon,
    ...sizeGroups['12'],
  },
  textBodyXSmallLink: {
    ...textCommon,
    ...sizeGroups['12'],
  },
  textBodySmallSecondaryLink: {
    ...textCommon,
    ...sizeGroups['14'],
    color: globalColors.black_60,
  },
  textBodySmallSemibold: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['14'],
  },
  textError: {
    ...textCommon,
    color: globalColors.red,
    fontSize: 14,
    lineHeight: '17px',
    letterSpacing: '0.2px',
  },
  textTerminal,
  textTerminalCommand: {
    ...textTerminal,
  },
  textTerminalComment: {
    ...textTerminal,
    color: globalColors.white_40,
  },
  textTerminalUsername: {
    ...textTerminal,
    color: globalColors.orange,
  },
  textTerminalPublic: {
    ...textTerminal,
    color: globalColors.yellowGreen2,
  },
  textTerminalPrivate: {
    ...textTerminal,
    color: globalColors.darkBlue2,
  },
  textTerminalEmpty: {
    ...textTerminal,
    minHeight: 20,
  },
  textTerminalSmall: {
    ...textTerminal,
    ...sizeGroups['14'],
  },
  textTerminalInline: {
    backgroundColor: globalColors.blue4,
    wordWrap: 'break-word',
    padding: 2,
    display: 'inline',
  },
}

const lineCommon = {
  overflow: 'hidden',
  display: '-webkit-box',
  textOverflow: 'ellipsis',
  WebkitBoxOrient: 'vertical',
}

export function lineClamp (lines: number): Object {
  return {
    ...lineCommon,
    WebkitLineClamp: lines,
  }
}
