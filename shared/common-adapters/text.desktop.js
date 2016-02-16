/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import type {Props} from './text'

export default class Text extends Component {
  props: Props;

  _terminalPrefix (type: Props.type): ?ReactElement {
    return ({
      TerminalEmpty: <span>&nbsp;</span>,
      TerminalCommand: <span>> </span>,
      TerminalComment: <span># </span>
    }: {[key: string]: ReactElement})[type]
  }

  render (): ReactElement {
    const typeStyle = {
      'Header-Jumbo': styles.textHeaderJumbo,
      'Header-Big': styles.textHeaderBig,
      'Header': styles.textHeader,
      'Body-Semibold': styles.textBodySemibold,
      'Body': styles.textBody,
      'Body-Small': styles.textBodySmall,
      'Error': styles.textError,
      'Terminal-Inline': {...styles.textTerminal, ...styles.textTerminalInline},
      'Terminal': styles.textTerminal,
      'TerminalCommand': styles.textTerminal,
      'TerminalComment': {...styles.textTerminal, ...styles.textTerminalComment},
      'TerminalEmpty': {...styles.textTerminal, ...styles.textTerminalEmpty}
    }[this.props.type]

    const opacity = this.props.darkMode ? 1 : 0.75

    const color = this.props.darkMode ? globalColorsDZ2.white : globalColorsDZ2.black

    const style = {
      opacity,
      color,
      ...typeStyle,
      ...(this.props.lineClamp ? lineClamp(this.props.lineClamp) : {}),
      ...(this.props.link ? styles.textLinkMixin : {}),
      ...(this.props.small ? styles.textSmallMixin : {}),
      ...(this.props.reversed ? styles.textReversedMixin : {}),
      ...(this.props.onClick ? globalStyles.clickable : {}),
      ...(this.props.inline ? styles.inline : {}),
      ...this.props.style
    }

    const terminalPrefix = this._terminalPrefix(this.props.type)

    const props = {
      className: (this.props.link ? 'hover-underline' : ''),
      style,
      onClick: this.props.onClick
    }

    // $FlowIssue doesn't like strings for react classes
    const tag: ReactClass = this.props.inline ? 'span' : 'p'

    return React.createElement(tag, props, [terminalPrefix, this.props.children])
  }
}

const textCommon = {
  ...globalStyles.fontRegular,
  ...globalStyles.noSelect,
  cursor: 'inherit'
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
    opacity: 0.4,
    letterSpacing: '0.3px'
  },
  textError: {
    ...textCommon,
    color: globalColors.highRiskWarning,
    fontSize: 13,
    lineHeight: '17px',
    letterSpacing: '0.2px'
  },
  textTerminal: {
    ...textCommon,
    ...globalStyles.fontTerminalSemibold,
    fontSize: 14,
    lineHeight: '21px',
    letterSpacing: '0.3px',
    color: globalColorsDZ2.blue3
  },
  textTerminalComment: {
    color: globalColorsDZ2.white,
    opacity: 0.4
  },
  textTerminalEmpty: {
    minHeight: 20,
  },
  textTerminalInline: {
    backgroundColor: globalColorsDZ2.blue4,
    color: globalColorsDZ2.darkBlue
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
  inline: {
    display: 'inline-block'
  }
}

const lineCommon = {
  overflow: 'hidden',
  display: '-webkit-box',
  textOverflow: 'ellipsis',
  WebkitBoxOrient: 'vertical'
}

function lineClamp (lines: number) {
  return {
    ...lineCommon,
    WebkitLineClamp: lines
  }
}
