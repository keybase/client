/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'

// $FlowFixMe remove when we stop using the old version of text
import TextOld from './text.old'

import type {Props} from './text'

export default class Text extends Component {
  props: Props;

  _terminalPrefix (type: Props.type): ?ReactElement {
    return ({
      'TerminalEmpty': <span>&nbsp;</span>,
      'TerminalCommand': <span>> </span>,
      'TerminalComment': <span># </span>
    }: {[key: string]: ReactElement})[type]
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

  _colorStyleDarkmode (type: Props.type): Object {
    switch (type) {
      case 'HeaderJumbo':
      case 'HeaderBig':
      case 'Header':
      case 'BodySemibold':
      case 'Body':
        return {color: globalColorsDZ2.white}
      case 'BodySmall':
        return {color: globalColorsDZ2.white40}
      default:
        return {}
    }
  }

  render (): ReactElement {
    if (!this.props.dz2) {
      return <TextOld {...this.props}/>
    }

    const typeStyle = {
      'HeaderJumbo': styles.textHeaderJumbo,
      'HeaderBig': styles.textHeaderBig,
      'Header': styles.textHeader,
      'BodySemibold': styles.textBodySemibold,
      'Body': styles.textBody,
      'BodySmall': styles.textBodySmall,
      'Error': styles.textError,
      'Terminal': {...styles.textTerminal, color: (this.context.inTerminal ? globalColorsDZ2.blue3 : globalColorsDZ2.darkBlue)},
      'TerminalCommand': styles.textTerminalCommand,
      'TerminalComment': styles.textTerminalComment,
      'TerminalUsername': styles.textTerminalUsername,
      'TerminalPublic': styles.textTerminalPublic,
      'TerminalPrivate': styles.textTerminalPrivate,
      'TerminalEmpty': styles.textTerminalEmpty,
      'InputHeader': styles.textInputHeader,
      'Warning': styles.textWarning
    }[this.props.type]

    let inline = true
    if (this.props.hasOwnProperty('inline')) {
      inline = this.props.inline
    }

    const style = {
      ...typeStyle,
      ...(this.props.lineClamp ? lineClamp(this.props.lineClamp) : {}),
      ...(this.props.link ? styles.textLinkMixin : {}),
      ...(this.props.small ? styles.textSmallMixin : {}),
      ...(this.props.reversed ? styles.textReversedMixin : {}),
      ...(this.props.onClick ? globalStyles.clickable : {}),
      ...(inline ? {...this._inlineStyle(this.props.type)} : {display: 'block'}),
      ...(this.props.darkMode ? this._colorStyleDarkmode(this.props.type) : {}),
      ...this.props.style
    }

    const terminalPrefix = this._terminalPrefix(this.props.type)
    const className = this.props.className || ''

    return (
      <span
        className={this.props.link ? 'hover-underline ' + className : className}
        style={style}
        onClick={this.props.onClick}>{terminalPrefix}{this.props.children}</span>)
  }
}

Text.contextTypes = {
  inTerminal: React.PropTypes.bool
}

Text.propTypes = {
  type: React.PropTypes.oneOf(['Header', 'Body', 'TerminalCommand', 'TerminalComment', 'TerminalEmpty']),
  link: React.PropTypes.bool,
  small: React.PropTypes.bool,
  reversed: React.PropTypes.bool,
  children: React.PropTypes.node,
  style: React.PropTypes.object,
  onClick: React.PropTypes.func,
  inline: React.PropTypes.bool,
  lineClamp: React.PropTypes.number,
  className: React.PropTypes.string
}

const textCommon = {
  ...globalStyles.DZ2.fontRegular,
  ...globalStyles.noSelect,
  cursor: 'inherit'
}

const textTerminal = {
  ...globalStyles.DZ2.fontTerminalSemibold,
  fontSize: 14,
  lineHeight: '21px',
  letterSpacing: '0.3px'
}

const headerStyles = {
  textHeaderJumbo: {
    ...textCommon,
    ...globalStyles.DZ2.fontBold,
    fontSize: 32,
    lineHeight: '38px',
    letterSpacing: '0.3px'
  },

  textHeaderBig: {
    ...textCommon,
    ...globalStyles.DZ2.fontBold,
    fontSize: 24,
    lineHeight: '31px',
    letterSpacing: '0.3px'
  },

  textHeader: {
    ...textCommon,
    ...globalStyles.DZ2.fontBold,
    fontSize: 18,
    lineHeight: '25px',
    letterSpacing: '0.3px'
  },

  textInputHeader: {
    ...textCommon,
    ...globalStyles.DZ2.fontSemibold,
    fontSize: 14,
    lineHeight: '18px',
    letterSpacing: '0.3px',
    color: globalColorsDZ2.blue2
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
    ...globalStyles.DZ2.fontSemibold,
    fontSize: 16,
    lineHeight: '22px',
    letterSpacing: '0.3px'
  },
  textBodySmall: {
    ...textCommon,
    color: globalColorsDZ2.black40,
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
  textLinkMixin: {
    color: globalColors.blue,
    cursor: 'pointer'
  },
  textSmallMixin: {
    color: globalColors.grey2,
    fontSize: 13,
    lineHeight: '17px'
  },
  textReversedMixin: {
    color: globalColors.white
  },
  textWarning: {
    ...textCommon,
    ...globalStyles.DZ2.fontBold,
    fontSize: 24,
    lineHeight: '31px',
    letterSpacing: '0.3px',
    color: globalColorsDZ2.brown60
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
