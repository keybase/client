// @flow
import * as Constants from '../../constants/searchv3'
import {last} from 'lodash'
import React, {Component} from 'react'
import {AutosizeInput, Box, Text, Icon, ClickableBox} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'
import {getStyle as getTextStyle} from '../../common-adapters/text'

import type {IconType} from '../../common-adapters/icon'

export type UserDetails = {
  followingState: Constants.FollowingState,
  icon: ?IconType,
  service: Constants.Service,
  username: string,
}

export type UserItemProps = UserDetails & {onRemoveUser: (username: string) => void}

export type Props = {
  placeholder?: string,
  userItems: Array<UserDetails>,
  usernameText: string,
  showAddButton: boolean,
  onChangeText: (usernameText: string) => void,
  onRemoveUser: (username: string) => void,
  onClickAddButton: () => void,
}

class UserItem extends Component<void, UserItemProps, void> {
  _onRemoveUser = () => {
    this.props.onRemoveUser(this.props.username)
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
            fontSize: 16,
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
            marginBottom: 2,
          }}
        >
          {username}
        </Text>
        <Icon
          type="iconfont-close"
          onClick={this._onRemoveUser}
          style={{fontSize: 12, marginLeft: globalMargins.tiny}}
        />
      </Box>
    )
  }
}

class UserInput extends Component<void, Props, void> {
  _textInput: AutosizeInput

  _focusInput = () => {
    this._textInput.focus()
  }

  _onInputKeyDown = ev => {
    if (
      this.props.userItems.length &&
      ev.key === 'Backspace' &&
      ev.target.selectionStart === 0 &&
      ev.target.selectionEnd === 0
    ) {
      this.props.onRemoveUser(last(this.props.userItems).username)
    }
  }

  render() {
    const {
      placeholder,
      userItems,
      usernameText,
      onChangeText,
      showAddButton,
      onClickAddButton,
      onRemoveUser,
    } = this.props

    const inputLeftPadding = userItems.length ? {paddingLeft: globalMargins.xtiny} : null
    return (
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flexWrap: 'wrap'}}>
        {userItems.map(item => <UserItem {...item} onRemoveUser={onRemoveUser} key={item.username} />)}
        <AutosizeInput
          ref={el => {
            this._textInput = el
          }}
          flex={1}
          inputStyle={{..._inputStyle, ...inputLeftPadding}}
          placeholder={placeholder}
          value={usernameText}
          onChange={onChangeText}
          onKeyDown={this._onInputKeyDown}
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
        <ClickableBox style={{flex: 1, cursor: 'text', height: 24}} onClick={this._focusInput}>
          &nbsp; {/* Material-UI child warns if no children */}
        </ClickableBox>
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

const _inputStyle = {
  ...getTextStyle('Body'),
  flex: 1,
  color: globalColors.black_75,
  border: 'none',
  outline: 'none',
  lineHeight: '22px',
  padding: 0,
  marginBottom: 2,
}

export default UserInput
