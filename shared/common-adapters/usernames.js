// @flow
import React, {Component} from 'react'
import Text from './text'
import shallowEqual from 'shallowequal'
import {globalStyles, globalColors} from '../styles'
import {isMobile} from '../constants/platform'

import type {Props} from './usernames'

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
      <Text
        key={u.username}
        type={type}
        backgroundMode={backgroundMode}
        onClick={_onUsernameClicked ? () => _onUsernameClicked(u.username) : undefined}
        style={userStyle}
      >
        {u.username}
        {i !== users.length - 1 && // Injecting the commas here so we never wrap and have newlines starting with a ,
          <Text
            type={type}
            backgroundMode={backgroundMode}
            style={{...style, color: commaColor, marginRight: 1}}
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

class Usernames extends Component<void, Props, void> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'containerStyle', 'users'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  _joinUsernames(usernames: Array<string>) {
    return usernames.join(this.props.plainDivider || ', ')
  }

  render() {
    const containerStyle = this.props.inline ? inlineStyle : nonInlineStyle
    const rwers = this.props.users.filter(u => !u.readOnly)
    const readers = this.props.users.filter(u => !!u.readOnly)

    if (this.props.plainText) {
      // TODO: Apply filter when plainText is not set, if needed.
      let usernames = rwers.map(u => u.username)
      if (this.props.filter) {
        // TODO team and channels
        const regexp = new RegExp(this.props.filter, 'i')
        const matches = usernames.filter(n => n.match(regexp))
        const nonMatches = usernames.filter(n => !n.match(regexp))
        usernames = matches.concat(nonMatches)
      }
      const usernamesStr = this._joinUsernames(usernames)
      return (
        <Text
          type={this.props.type}
          backgroundMode={this.props.backgroundMode}
          style={{...containerStyle, ...this.props.containerStyle}}
          title={this.props.title}
          {...(this.props.inline ? inlineProps : {})}
        >
          {this.props.prefix}
          {usernamesStr}
          {this.props.suffix}
        </Text>
      )
    }

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

export {usernameText}

export default Usernames
