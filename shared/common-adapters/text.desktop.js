import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './text'

export default class Text extends Component {
  props: Props;

  render () {
    const typeStyle = {
      'Header': styles.textHeader,
      'Body': styles.textBody,
      'Error': styles.textError,
      'TerminalCommand': styles.textTerminalCommand,
      'TerminalComment': styles.textTerminalComment,
      'TerminalEmpty': styles.textTerminalEmpty
    }[this.props.type]

    const style = {
      ...typeStyle,
      ...(this.props.lineClamp ? lineClamp(this.props.lineClamp) : {}),
      ...(this.props.link ? styles.textLinkMixin : {}),
      ...(this.props.small ? styles.textSmallMixin : {}),
      ...(this.props.reversed ? styles.textReversedMixin : {}),
      ...(this.props.onClick ? globalStyles.clickable : {}),
      ...(this.props.inline ? styles.inline : {}),
      ...this.props.style
    }

    const terminalPrefix = {
      TerminalEmpty: <span>&nbsp;</span>,
      TerminalCommand: <span>> </span>,
      TerminalComment: <span># </span>
    }[this.props.type]

    return <p className={this.props.link ? 'hover-underline' : ''} style={style} onClick={this.props.onClick}>{terminalPrefix}{this.props.children}</p>
  }
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
  lineClamp: React.PropTypes.number
}

const textCommon = {
  ...globalStyles.fontRegular,
  ...globalStyles.noSelect,
  color: globalColors.grey1,
  cursor: 'inherit'
}

export const styles = {
  textHeader: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 18,
    lineHeight: '22px',
    letterSpacing: '0.5px'
  },
  textBody: {
    ...textCommon,
    fontSize: 15,
    lineHeight: '20px',
    letterSpacing: '0.2px'
  },
  textError: {
    ...textCommon,
    color: globalColors.highRiskWarning,
    fontSize: 13,
    lineHeight: '17px',
    letterSpacing: '0.2px'
  },
  textTerminalCommand: {
    ...textCommon,
    ...globalStyles.fontTerminal,
    color: globalColors.white,
    fontSize: 13,
    lineHeight: '16px',
    letterSpacing: '0.2px'
  },
  textTerminalComment: {
    ...textCommon,
    ...globalStyles.fontTerminal,
    color: globalColors.grey2,
    fontSize: 13,
    lineHeight: '16px',
    letterSpacing: '0.2px'
  },
  textTerminalEmpty: {
    ...textCommon,
    ...globalStyles.fontTerminal,
    color: globalColors.grey1,
    fontSize: 13,
    lineHeight: '16px',
    minHeight: 20,
    letterSpacing: '0.2px'
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
