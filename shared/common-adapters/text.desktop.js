/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'

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
        return this.context.inTerminal ? {} : styles.textTerminalInline
      default:
        return {}
    }
  }

  _colorStyleBackgroundMode (backgroundMode: Background, type: Props.type): Object {
    if (backgroundMode === 'Information') {
      return {color: globalColorsDZ2.brown60}
    }
    switch (type) {
      case 'HeaderJumbo':
      case 'HeaderBig':
      case 'Header':
      case 'BodySemibold':
      case 'BodySmallSemibold':
      case 'Body':
        return {color: backgroundMode === 'Normal' ? globalColorsDZ2.black75 : globalColorsDZ2.white}
      case 'BodySmall':
        return {color: backgroundMode === 'Normal' ? globalColorsDZ2.black40 : globalColorsDZ2.white40}
      case 'BodyPrimaryLink':
        return {color: globalColorsDZ2.blue}
      case 'BodySecondaryLink':
        return {color: globalColorsDZ2.black40}
      default:
        return {}
    }
  }

  render () {
    const typeStyle = {
      'HeaderJumbo': styles.textHeaderJumbo,
      'HeaderBig': styles.textHeaderBig,
      'Header': styles.textHeader,
      'BodySemibold': styles.textBodySemibold,
      'Body': styles.textBody,
      'BodyPrimaryLink': styles.textBody,
      'BodySecondaryLink': styles.textBody,
      'BodySmall': styles.textBodySmall,
      'BodySmallSemibold': styles.textBodySmallSemibold,
      'Error': styles.textError,
      'Terminal': {...styles.textTerminal, color: (this.context.inTerminal ? globalColorsDZ2.blue3 : globalColorsDZ2.darkBlue)},
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
      ...(this.props.lineClamp ? lineClamp(this.props.lineClamp) : {}),
      ...(this.props.small ? styles.textSmallMixin : {}),
      ...(this.props.onClick ? globalStyles.clickable : {}),
      ...(inline ? {...this._inlineStyle(this.props.type)} : {display: 'block'}),
      ...this._colorStyleBackgroundMode(this.props.backgroundMode || 'Normal', this.props.type),
      ...this.props.style
    }

    const terminalPrefix = this._terminalPrefix(this.props.type)
    const className = (this.props.className || '') + ' ' + (linkClassname || '')

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
    ...globalStyles.fontBold,
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
    color: globalColorsDZ2.blue
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
    color: globalColors.highRiskWarning,
    fontSize: 13,
    lineHeight: '17px',
    letterSpacing: '0.2px'
  },
  textTerminal,
  textTerminalCommand: {
    ...textTerminal
  },
  textTerminalComment: {
    ...textTerminal,
    color: globalColorsDZ2.white40
  },
  textTerminalUsername: {
    ...textTerminal,
    color: globalColorsDZ2.orange
  },
  textTerminalPublic: {
    ...textTerminal,
    color: globalColorsDZ2.yellowGreen2
  },
  textTerminalPrivate: {
    ...textTerminal,
    color: globalColorsDZ2.darkBlue2
  },
  textTerminalEmpty: {
    ...textTerminal,
    minHeight: 20
  },
  textTerminalInline: {
    backgroundColor: globalColorsDZ2.blue4,
    wordWrap: 'break-word',
    display: 'inline'
  },
  textSmallMixin: {
    color: globalColors.grey2,
    fontSize: 13,
    lineHeight: '17px'
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
