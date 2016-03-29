/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {Text as RNText} from 'react-native'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {Props, Background} from './text'
import type {Context} from './terminal'

export default class Text extends Component {
  props: Props;
  context: Context;

  _terminalPrefix (type: Props.type): ?React$Element {
    return ({
      'TerminalEmpty': <RNText>&nbsp;</RNText>,
      'TerminalCommand': <RNText>> </RNText>,
      'TerminalComment': <RNText># </RNText>
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
      'BodySemiboldItalic': {...styles.textBodySemibold, ...globalStyles.italic},
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
        linkStyle = {}
        linkClassname = 'hover-underline'
    }

    const style = {
      ...typeStyle,
      ...linkStyle,
      ...this._colorStyleBackgroundMode(this.props.backgroundMode || 'Normal', this.props.type),
      ...(this.props.onClick ? globalStyles.clickable : {}),
      ...(inline ? {...this._inlineStyle(this.props.type)} : {}),
      ...this.props.style
    }

    const terminalPrefix = this._terminalPrefix(this.props.type)
    const className = (this.props.className || '') + ' ' + (linkClassname || '')

    if (this.props.contentEditable) {
      return (
        <RNText
          ref='text'
          className={className}
          style={style}
          contentEditable
          onKeyUp={this.props.onKeyUp}
          onKeyDown={this.props.onKeyDown}
          onClick={this.props.onClick}/>)
    }

    return (
      <RNText
        className={className}
        style={style}
        onClick={this.props.onClick}>{terminalPrefix}{this.props.children}</RNText>)
  }
}

Text.contextTypes = {
  inTerminal: React.PropTypes.bool
}

const textCommon = {
  ...globalStyles.fontRegular,
  letterSpacing: 0.3
}

const textTerminal = {
  ...globalStyles.fontTerminalSemibold,
  fontSize: 14,
  lineHeight: 21,
  letterSpacing: 0.3
}

const headerStyles = {
  textHeaderJumbo: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 40,
    lineHeight: 46
  },

  textHeaderBig: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 30,
    lineHeight: 36
  },

  textHeader: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 22,
    lineHeight: 28
  },

  textInputHeader: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 15,
    lineHeight: 20,
    color: globalColors.blue
  }
}

export const specialStyles = {
  textInput: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 24,
    lineHeight: 29
  },
  paperKey: {
    ...textCommon,
    ...globalStyles.fontTerminalSemibold,
    color: globalColors.black75,
    fontSize: 18,
    lineHeight: 24
  },
  username: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 24,
    lineHeight: 31,
    color: globalColors.orange
  }
}

export const styles = {
  ...headerStyles,
  textBody: {
    ...textCommon,
    fontSize: 18,
    lineHeight: 24
  },
  textBodySemibold: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 18,
    lineHeight: 24
  },
  textBodySmall: {
    ...textCommon,
    fontSize: 14,
    lineHeight: 19
  },
  textBodySmallSemibold: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 15,
    lineHeight: 20
  },
  textError: {
    ...textCommon,
    color: globalColors.red,
    fontSize: 15,
    lineHeight: 20
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
    ...textTerminal
  },
  textTerminalSmall: {
    ...textTerminal,
    fontSize: 15,
    lineHeight: 21
  },
  textTerminalInline: {
    backgroundColor: globalColors.blue4,
    padding: 2
  }
}
