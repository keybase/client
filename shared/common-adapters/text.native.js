/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {Text as RNText} from 'react-native'
import {globalStyles, globalColors} from '../styles/style-guide'
import Platform, {OS} from '../constants/platform'

import type {Props, Background} from './text'
import type {Context} from './terminal'

const isAndroid = Platform.OS_ANDROID === OS

export default class Text extends Component {
  props: Props;
  context: Context;

  _terminalPrefix (type: Props.type): ?React$Element {
    return ({
      'TerminalEmpty': <RNText>&nbsp;</RNText>,
      'TerminalCommand': <RNText>> </RNText>,
      'TerminalComment': <RNText># </RNText>,
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

  static _colorStyleBackgroundMode (backgroundMode: Background, type: Props.type, inTerminal: boolean): Object {
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
      case 'BadgeNumber':
        return {}
      case 'BodyPrimaryLink':
        return {color: globalColors.blue}
      case 'BodySecondaryLink':
        return {color: globalColors.black_60}
      case 'Terminal':
        return {color: inTerminal ? globalColors.blue3 : globalColors.darkBlue}
      case 'TerminalSmall':
        return {color: inTerminal ? globalColors.blue3 : globalColors.darkBlue}
      default:
        return {}
    }
  }

  focus () {
    if (this.refs && this.refs.text) {
      this.refs.text.focus()
    }
  }

  // We want to reuse these styles for other things that can be styled similarly
  // e.g. RN's TextInput. So this function needs to be pure & static
  static textStyle (props: Props, context: Context) {
    const typeStyle = {
      'BadgeNumber': styles.textBadge,
      'Body': styles.textBody,
      'BodyPrimaryLink': styles.textBody,
      'BodySemibold': styles.textBodySemibold,
      'BodySemiboldItalic': {...styles.textBodySemibold, ...globalStyles.italic},
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
      'HeaderError': {...styles.textHeader, color: globalColors.red},
      'HeaderJumbo': styles.textHeaderJumbo,
      'HeaderLink': styles.textHeaderLink,
      'InputHeader': styles.textInputHeader,
      'Terminal': styles.textTerminal,
      'TerminalCommand': styles.textTerminalCommand,
      'TerminalComment': styles.textTerminalComment,
      'TerminalEmpty': styles.textTerminalEmpty,
      'TerminalPrivate': styles.textTerminalPrivate,
      'TerminalPublic': styles.textTerminalPublic,
      'TerminalSmall': styles.textTerminalSmall,
      'TerminalUsername': styles.textTerminalUsername,
    }[props.type]

    let inline = true
    if (props.hasOwnProperty('inline')) {
      inline = props.inline
    }

    const style = {
      ...typeStyle,
      ...Text._colorStyleBackgroundMode(props.backgroundMode || 'Normal', props.type, !!context.inTerminal),
      ...(props.onClick ? globalStyles.clickable : {}),
      ...(inline ? {...Text._inlineStyle(props.type, context)} : {}),
      ...props.style,
    }

    return style
  }

  render () {
    const style = Text.textStyle(this.props, this.context)

    const terminalPrefix = this._terminalPrefix(this.props.type)
    const className = this.props.className

    if (this.props.contentEditable) {
      return (
        <RNText
          ref='text'
          className={className}
          style={style}
          contentEditable
          onKeyUp={this.props.onKeyUp}
          onKeyDown={this.props.onKeyDown}
          onPress={this.props.onClick} />)
    }

    return (
      <RNText
        className={className}
        style={style}
        onPress={this.props.onClick}>{terminalPrefix}{this.props.children}</RNText>)
  }
}

Text.contextTypes = {
  inTerminal: React.PropTypes.bool,
}

const sizeGroups: { [key: '40' | '30' | '22' | '18' | '15' | '13']: Object } = {
  '40': {
    fontSize: 40,
    lineHeight: 46,
  },
  '30': {
    fontSize: 30,
    lineHeight: 36,
  },
  '22': {
    fontSize: 22,
    lineHeight: 28,
  },
  '18': {
    fontSize: 18,
    lineHeight: 24,
  },
  '15': {
    fontSize: 15,
    lineHeight: 20,
  },
  '13': {
    fontSize: 13,
    lineHeight: 18,
  },
}

const textCommon = {
  ...globalStyles.fontRegular,
  textAlignVertical: 'center',
  letterSpacing: 0.3,
}

const textTerminal = {
  ...textCommon,
  ...globalStyles.fontTerminalSemibold,
  fontSize: 14,
  lineHeight: 21,
}

export const specialStyles = {
  textInput: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    fontSize: 24,
    lineHeight: 29,
  },
  paperKey: {
    ...textCommon,
    ...globalStyles.fontTerminalSemibold,
    ...sizeGroups['15'],
    color: globalColors.darkBlue,
  },
  username: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 24,
    lineHeight: 31,
    color: globalColors.orange,
  },
}

export const styles = {
  textHeaderJumbo: {
    ...textCommon,
    ...globalStyles.fontBold,
    ...sizeGroups['40'],
  },
  textHeaderBig: {
    ...textCommon,
    ...globalStyles.fontBold,
    ...sizeGroups['30'],
  },
  textHeader: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['22'],
  },
  textHeaderLink: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['22'],
    color: globalColors.blue,
  },
  textInputHeader: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['15'],
    color: globalColors.blue,
  },
  textBody: {
    ...textCommon,
    ...sizeGroups['18'],
  },
  textBodySemibold: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['18'],
  },
  textBadge: {
    ...textCommon,
    ...globalStyles.fontBold,
    color: globalColors.white,
    lineHeight: 11,
    fontSize: 11,
    ...(isAndroid ? {
      position: 'relative',
      bottom: 3,
      marginBottom: -3,
      paddingBottom: 0,
      lineHeight: 13,
    } : {}),
  },
  textBodySmall: {
    ...textCommon,
    ...sizeGroups['15'],
  },
  textBodySmallError: {
    ...textCommon,
    ...sizeGroups['15'],
    color: globalColors.red,
  },
  textBodySmallLink: {
    ...textCommon,
    ...sizeGroups['15'],
  },
  textBodySmallPrimaryLink: {
    ...textCommon,
    ...sizeGroups['15'],
    color: globalColors.blue,
  },
  textBodySmallSecondaryLink: {
    ...textCommon,
    ...sizeGroups['15'],
    color: globalColors.black_60,
  },
  textBodySmallSemibold: {
    ...textCommon,
    ...globalStyles.fontSemibold,
    ...sizeGroups['15'],
  },
  textBodyXSmall: {
    ...textCommon,
    ...sizeGroups['13'],
  },
  textBodyXSmallLink: {
    ...textCommon,
    ...sizeGroups['13'],
  },
  textError: {
    ...textCommon,
    color: globalColors.red,
    ...sizeGroups['15'],
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
  },
  textTerminalSmall: {
    ...textTerminal,
    fontSize: 15,
    lineHeight: 21,
  },
  textTerminalInline: {
    backgroundColor: globalColors.blue4,
    padding: 2,
  },
}
