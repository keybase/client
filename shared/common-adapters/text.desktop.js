/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {Props, Background} from './text'
import type {Context} from './terminal'

export default class Text extends Component {
  props: Props;
  context: Context;

  _terminalPrefix (type: Props.type): ?React$Element {
    return ({
      'TerminalEmpty': <span>&nbsp;</span>,
      'TerminalCommand': <span>> </span>,
      'TerminalComment': <span># </span>
    }: {[key: string]: React$Element})[type]
  }

  _inlineStyle (type: Props.type): Object {
    switch (type) {
      case 'Terminal':
      case 'TerminalCommand':
      case 'TerminalComment':
      case 'TerminalUsername':
      case 'TerminalPublic':
      case 'TerminalPrivate':
      case 'TerminalSmall':
        return this.context.inTerminal ? {} : styles.textTerminalInline
      default:
        return {}
    }
  }

  _colorStyleBackgroundMode (backgroundMode: Background, type: Props.type): Object {
    if (backgroundMode === 'Information') {
      return {color: globalColors.brown60}
    }
    switch (type) {
      case 'HeaderJumbo':
      case 'HeaderBig':
      case 'Header':
      case 'BodySemibold':
      case 'BodySemiboldItalic':
      case 'BodySmallSemibold':
      case 'Body':
        return {color: backgroundMode === 'Normal' ? globalColors.black75 : globalColors.white}
      case 'BodySmall':
        return {color: backgroundMode === 'Normal' ? globalColors.black40 : globalColors.white40}
      case 'BodyPrimaryLink':
        return {color: globalColors.blue}
      case 'BodySecondaryLink':
        return {color: globalColors.black40}
      default:
        return {}
    }
  }

  focus () {
    if (this.refs && this.refs.text) {
      this.refs.text.focus()
    }
  }

  render () {
    const typeStyle = {
      'HeaderJumbo': styles.textHeaderJumbo,
      'HeaderBig': styles.textHeaderBig,
      'Header': styles.textHeader,
      'HeaderError': {...styles.textHeader, color: globalColors.red},
      'BodySemibold': styles.textBodySemibold,
      'BodySemiboldItalic': {...styles.textBodySemibold, ...globalStyles.italic, cursor: 'default'},
      'Body': styles.textBody,
      'BodyPrimaryLink': styles.textBody,
      'BodySecondaryLink': styles.textBodySmall,
      'BodySmall': styles.textBodySmall,
      'BodySmallSemibold': styles.textBodySmallSemibold,
      'Error': styles.textError,
      'Terminal': {...styles.textTerminal, color: (this.context.inTerminal ? globalColors.blue3 : globalColors.darkBlue)},
      'TerminalSmall': {...styles.textTerminalSmall, color: (this.context.inTerminal ? globalColors.blue3 : globalColors.darkBlue)},
      'TerminalCommand': styles.textTerminalCommand,
      'TerminalComment': styles.textTerminalComment,
      'TerminalUsername': styles.textTerminalUsername,
      'TerminalPublic': styles.textTerminalPublic,
      'TerminalPrivate': styles.textTerminalPrivate,
      'TerminalEmpty': styles.textTerminalEmpty,
      'InputHeader': styles.textInputHeader
    }[this.props.type]

    let inline = true
    if (this.props.hasOwnProperty('inline')) {
      inline = this.props.inline
    }

    let linkStyle = null
    let linkClassname = null
    switch (this.props.type) {
      case 'BodyPrimaryLink':
      case 'BodySecondaryLink':
        linkStyle = {
          cursor: 'pointer'
        }
        linkClassname = 'hover-underline'
    }

    const style = {
      ...typeStyle,
      ...linkStyle,
      ...this._colorStyleBackgroundMode(this.props.backgroundMode || 'Normal', this.props.type),
      ...(this.props.lineClamp ? lineClamp(this.props.lineClamp) : {}),
      ...(this.props.small ? styles.textSmallMixin : {}),
      ...(this.props.onClick ? globalStyles.clickable : {}),
      ...(inline ? {...this._inlineStyle(this.props.type)} : {display: 'block'}),
      ...this.props.style
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
          onClick={this.props.onClick}/>)
    }

    return (
      <span
        className={className}
        style={style}
        onClick={this.props.onClick}>{terminalPrefix}{this.props.children}</span>)
  }
}

Text.contextTypes = {
  inTerminal: React.PropTypes.bool
}

const textCommon = {
  ...globalStyles.fontRegular,
  ...globalStyles.noSelect,
  cursor: 'inherit'
}

const textTerminal = {
  ...globalStyles.fontTerminalSemibold,
  fontSize: 14,
  lineHeight: '21px',
  letterSpacing: '0.3px'
}

const headerStyles = {
  textHeaderJumbo: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 32,
    lineHeight: '38px',
    letterSpacing: '0.3px'
  },

  textHeaderBig: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 24,
    lineHeight: '31px',
    letterSpacing: '0.3px'
  },

  textHeader: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 18,
    lineHeight: '25px',
    letterSpacing: '0.3px'
  },

  textInputHeader: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 14,
    lineHeight: '18px',
    letterSpacing: '0.3px',
    color: globalColors.blue
  }
}

export const specialStyles = {
  textInput: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 24,
    lineHeight: '29px',
    letterSpacing: '0.3px'
  },
  paperKey: {
    ...textCommon,
    ...globalStyles.fontTerminalSemibold,
    color: globalColors.black75,
    fontSize: 18,
    lineHeight: '24px',
    letterSpacing: '0.3px'
  },
  username: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 24,
    lineHeight: '31px',
    letterSpacing: '0.3px',
    color: globalColors.orange
  }
}

export const styles = {
  ...headerStyles,
  textBody: {
    ...textCommon,
    fontSize: 16,
    lineHeight: '22px',
    letterSpacing: '0.3px'
  },
  textBodySemibold: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 16,
    lineHeight: '22px',
    letterSpacing: '0.3px'
  },
  textBodySmall: {
    ...textCommon,
    fontSize: 14,
    lineHeight: '19px',
    letterSpacing: '0.3px'
  },
  textBodySmallSemibold: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 14,
    lineHeight: '19px',
    letterSpacing: '0.3px'
  },
  textError: {
    ...textCommon,
    color: globalColors.red,
    fontSize: 14,
    lineHeight: '17px',
    letterSpacing: '0.2px'
  },
  textTerminal,
  textTerminalCommand: {
    ...textTerminal
  },
  textTerminalComment: {
    ...textTerminal,
    color: globalColors.white40
  },
  textTerminalUsername: {
    ...textTerminal,
    color: globalColors.orange
  },
  textTerminalPublic: {
    ...textTerminal,
    color: globalColors.yellowGreen2
  },
  textTerminalPrivate: {
    ...textTerminal,
    color: globalColors.darkBlue2
  },
  textTerminalEmpty: {
    ...textTerminal,
    minHeight: 20
  },
  textTerminalSmall: {
    ...textTerminal,
    fontSize: 14,
    lineHeight: '19px'
  },
  textTerminalInline: {
    backgroundColor: globalColors.blue4,
    wordWrap: 'break-word',
    padding: 2,
    display: 'inline'
  },
  textSmallMixin: {
    color: globalColors.black40,
    fontSize: 14,
    lineHeight: '19px'
  }
}

const lineCommon = {
  overflow: 'hidden',
  display: '-webkit-box',
  textOverflow: 'ellipsis',
  WebkitBoxOrient: 'vertical'
}

export function lineClamp (lines: number): Object {
  return {
    ...lineCommon,
    WebkitLineClamp: lines
  }
}
