// @flow
import React, {Component} from 'react'
import Text from './text'
import shallowEqual from 'shallowequal'
import {globalStyles, globalColors} from '../styles'
import {isMobile} from '../constants/platform'

import type {Props, PlaintextProps} from './usernames'

function usernameText({
  type,
  users,
  style,
  commaColor,
  inline,
  redColor,
  backgroundMode,
  colorFollowing,
  colorBroken = true,
  onUsernameClicked,
  underline = false,
}: Props) {
  return users.map((u, i) => {
    const userStyle = {
      ...style,
      ...(!isMobile ? {textDecoration: 'inherit'} : null),
      ...(colorFollowing && !u.you ? {color: u.following ? globalColors.green2 : globalColors.blue} : null),
      ...(colorBroken && u.broken && !u.you ? {color: redColor || globalColors.red} : null),
      ...(inline && !isMobile ? {display: 'inline'} : null),
      ...(u.you ? globalStyles.italic : null),
    }

    // Make sure onClick is undefined when _onUsernameClicked is, so
    // as to not override any existing onClick handler from containers
    // on native. (See DESKTOP-3963.)
    const _onUsernameClicked = onUsernameClicked
    return (
      <Text type={type} key={u.username}>
        <Text
          type={type}
          backgroundMode={backgroundMode}
          className={underline ? 'hover-underline' : undefined}
          onClick={_onUsernameClicked ? () => _onUsernameClicked(u.username) : undefined}
          style={userStyle}
        >
          {u.username}
        </Text>
        {i !== users.length - 1 && // Injecting the commas here so we never wrap and have newlines starting with a ,
          <Text
            type={type}
            backgroundMode={backgroundMode}
            style={{...style, color: commaColor, marginRight: 1, textDecoration: 'none'}}
          >
            ,
          </Text>}
      </Text>
    )
  })
}

const inlineStyle = isMobile
  ? {}
  : {
      display: 'inline',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      width: '100%',
    }

const nonInlineStyle = {
  ...globalStyles.flexBoxRow,
  flexWrap: 'wrap',
  ...(isMobile ? null : {textDecoration: 'inherit'}),
}
const inlineProps = isMobile ? {lineClamp: 1} : {}

class Usernames extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'containerStyle', 'users'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render() {
    const containerStyle = this.props.inline ? inlineStyle : nonInlineStyle
    const rwers = this.props.users.filter(u => !u.readOnly)
    const readers = this.props.users.filter(u => !!u.readOnly)

    return (
      <Text
        type={this.props.type}
        backgroundMode={this.props.backgroundMode}
        style={{...containerStyle, ...this.props.containerStyle}}
        title={this.props.title}
        {...(this.props.inline ? inlineProps : {})}
      >
        {!!this.props.prefix &&
          <Text type={this.props.type} backgroundMode={this.props.backgroundMode} style={this.props.style}>
            {this.props.prefix}
          </Text>}
        {usernameText({...this.props, users: rwers})}
        {!!readers.length &&
          <Text
            type={this.props.type}
            backgroundMode={this.props.backgroundMode}
            style={{...this.props.style, marginRight: 1}}
          >
            #
          </Text>}
        {usernameText({...this.props, users: readers})}
        {!!this.props.suffix &&
          <Text type={this.props.type} backgroundMode={this.props.backgroundMode} style={this.props.style}>
            {this.props.suffix}
          </Text>}
      </Text>
    )
  }
}

const divider = isMobile ? ', ' : ',\u200a'

class PlaintextUsernames extends Component<PlaintextProps> {
  shouldComponentUpdate(nextProps: PlaintextProps) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['containerStyle', 'users'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render() {
    const containerStyle = inlineStyle
    const rwers = this.props.users.filter(u => !u.readOnly)

    return (
      <Text
        type={this.props.type}
        backgroundMode={this.props.backgroundMode}
        style={{...containerStyle, ...this.props.containerStyle}}
        title={this.props.title}
        {...inlineProps}
      >
        {rwers.map(u => u.username).join(divider)}
      </Text>
    )
  }
}

export {usernameText, Usernames, PlaintextUsernames}
