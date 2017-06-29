// @flow
import React, {Component} from 'react'
import {AutosizeInput, Box, Text, Icon} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'
import {getStyle as getTextStyle} from '../../common-adapters/text'

import type {UserDetails, Props} from './'

type UserItemProps = UserDetails & {onRemoveUser: (id: string) => void}

class UserItem extends Component<void, UserItemProps, void> {
  _onRemoveUser = () => {
    this.props.onRemoveUser(this.props.id)
  }

  render() {
    const {followingState, icon, service, username} = this.props
    return (
      <Box style={_pillStyle}>
        <IconOrAvatar
          icon={icon}
          service={service}
          username={username}
          avatarSize={16}
          style={{
            // Add more space to the left of square icons
            marginLeft: service === 'Hacker News' || service === 'Facebook' ? 3 : 0,
          }}
        />
        <Text
          type="BodySemibold"
          style={{
            ...followingStateToStyle(followingState),
            lineHeight: '18px',
            marginLeft: globalMargins.xtiny,
          }}
        >
          {username}
        </Text>
        <Icon
          type="iconfont-close"
          onClick={this._onRemoveUser}
          style={{fontSize: 11, marginLeft: globalMargins.tiny}}
        />
      </Box>
    )
  }
}

type State = {isFocused: boolean}

class UserInput extends Component<void, Props, State> {
  _textInput: AutosizeInput

  state = {
    isFocused: false,
  }

  focus = () => {
    this._textInput.focus()
  }

  _onFocus = () => {
    this.setState({isFocused: true})
  }

  _onBlur = () => {
    this.setState({isFocused: false})
  }

  _onInputKeyDown = ev => {
    if (
      this.props.userItems.count() &&
      ev.key === 'Backspace' &&
      ev.target.selectionStart === 0 &&
      ev.target.selectionEnd === 0
    ) {
      this.props.onRemoveUser(this.props.userItems.get(-1).id)
    } else if (ev.key === 'ArrowUp') {
      this.props.onMoveSelectUp()
      ev.preventDefault()
    } else if (ev.key === 'ArrowDown') {
      this.props.onMoveSelectDown()
      ev.preventDefault()
    } else if (ev.key === 'Enter' || ev.key === 'Tab') {
      this.props.onEnter()
      ev.preventDefault()
    }
  }

  _preventInputDefocus(ev) {
    // We prevent default handling of mousedown events on the container so that
    // our input doesn't get defocused.
    ev.preventDefault()
  }

  render() {
    const {
      autoFocus,
      placeholder,
      userItems,
      usernameText,
      onChangeText,
      onClickAddButton,
      onRemoveUser,
    } = this.props
    const {isFocused} = this.state

    const showAddButton = !!userItems.length && !usernameText.length
    const inputLeftPadding = !!userItems.length && (!!usernameText.length || isFocused)
      ? globalMargins.xtiny
      : 0
    return (
      <Box
        style={{...globalStyles.flexBoxRow, alignItems: 'center', flexWrap: 'wrap'}}
        onClick={this.focus}
        onMouseDown={this._preventInputDefocus}
      >
        {userItems.map(item => <UserItem {...item} onRemoveUser={onRemoveUser} key={item.id} />)}
        <Box style={_inputLineStyle}>
          <AutosizeInput
            autoFocus={autoFocus}
            ref={el => {
              this._textInput = el
            }}
            inputStyle={{..._inputStyle, paddingLeft: inputLeftPadding}}
            placeholder={userItems.length ? '' : placeholder}
            value={usernameText}
            onChange={onChangeText}
            onKeyDown={this._onInputKeyDown}
            onFocus={this._onFocus}
            onBlur={this._onBlur}
          />
          {showAddButton &&
            <Icon
              onClick={onClickAddButton}
              type="iconfont-add"
              style={{
                fontSize: 12,
                color: globalColors.blue,
                marginLeft: globalMargins.xtiny,
                cursor: 'pointer',
              }}
            />}
        </Box>
      </Box>
    )
  }
}

const _pillStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.flexBoxCenter,
  height: 24,
  paddingLeft: globalMargins.xtiny,
  // 2 pixel fudge to accomodate built-in padding to iconfont-close
  paddingRight: globalMargins.tiny - 2,
  paddingTop: globalMargins.xtiny,
  paddingBottom: globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
  margin: 2,
  borderRadius: 24,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: globalColors.black_10,
}

const _inputLineStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 24,
  marginTop: 2,
  marginBottom: 2,
  overflow: 'hidden',
}

const _inputStyle = {
  ...getTextStyle('Body'),
  flex: 1,
  color: globalColors.black_75,
  border: 'none',
  outline: 'none',
  lineHeight: '22px',
  padding: 0,
}

export default UserInput
