// @flow
import React, {Component} from 'react'
import {TextInput, Animated} from 'react-native'
import {Box, Text, Icon, ClickableBox} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'
import {getStyle as getTextStyle} from '../../common-adapters/text'

import type {UserDetails, Props} from './'

type UserItemProps = UserDetails & {onRemoveUser: (id: string) => void}
type UserItemState = {isSelected: boolean, selectAnim: Animated.Value}

class UserItem extends Component<void, UserItemProps, UserItemState> {
  state = {
    isSelected: false,
    selectAnim: new Animated.Value(0),
  }

  _onRemoveUser = () => {
    this.props.onRemoveUser(this.props.id)
  }

  _onSelect = () => {
    Animated.timing(this.state.selectAnim, {toValue: 1, duration: 100}).start()
    this.setState({isSelected: true})
  }

  _onDeselect = () => {
    Animated.timing(this.state.selectAnim, {toValue: 0, duration: 100}).start()
    this.setState({isSelected: false})
  }

  _onChangeText = (text: string) => {
    if (!text.length) {
      this._onDeselect()
      this._onRemoveUser()
    }
  }

  render() {
    const {followingState, icon, service, username} = this.props
    const {isSelected, selectAnim} = this.state

    const usernameStyle = followingStateToStyle(followingState)
    return (
      <Box style={{...globalStyles.flexBoxRow, marginRight: globalMargins.xtiny}}>
        <ClickableBox feedback={false} onClick={this._onSelect}>
          <Animated.View
            style={{
              ..._pillStyle,
              backgroundColor: selectAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [globalColors.white_0, globalColors.blue],
              }),
            }}
          >
            <IconOrAvatar icon={icon} service={service} username={username} avatarSize={16} />
            <Animated.Text
              style={{
                ..._pillTextStyle,
                ...usernameStyle,
                ...globalStyles.fontSemibold,
                color: selectAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [usernameStyle.color, globalColors.white],
                }),
                marginLeft: 3,
              }}
            >
              {username}
            </Animated.Text>
          </Animated.View>
        </ClickableBox>
        <Text
          type="BodySemibold"
          style={{
            ..._pillTextStyle,
            color: globalColors.black_20,
          }}
        >
          ,
        </Text>
        {/* We can't listen to keyboard events in RN Android, so instead we
            create an offscreen text input with a single space character and
            observe it being removed when the value changes. */}
        {isSelected &&
          <TextInput
            autoFocus={true}
            onBlur={this._onDeselect}
            onChangeText={this._onChangeText}
            value=" "
            style={{position: 'absolute', left: -9999}}
          />}
      </Box>
    )
  }
}

type State = {isFocused: boolean}

class UserInput extends Component<void, Props, State> {
  _textInput: TextInput

  state = {
    isFocused: false,
  }

  focus = () => {
    this._textInput && this._textInput.focus()
  }

  _onFocus = () => {
    this.setState({isFocused: true})
  }

  _onBlur = () => {
    this.setState({isFocused: false})
  }

  _onRemoveUser = (username: string) => {
    this.props.onRemoveUser(username)
    this.focus()
  }

  render() {
    const {
      autoFocus,
      placeholder,
      userItems,
      usernameText,
      onChangeText,
      onClickAddButton,
      onAddSelectedUser,
      onClearSearch,
    } = this.props

    const showAddButton = !!userItems.length && !usernameText.length && onClickAddButton
    return (
      <ClickableBox feedback={false} onClick={this.focus}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flexWrap: 'wrap'}}>
          {userItems.map(item => <UserItem {...item} onRemoveUser={this._onRemoveUser} key={item.id} />)}
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              height: 24,
              alignItems: 'center',
              flexGrow: 1,
              minWidth: 50,
            }}
          >
            <TextInput
              autoFocus={autoFocus}
              autoCorrect={false}
              autoCapitalize={'none'}
              ref={el => {
                this._textInput = el
              }}
              onFocus={this._onFocus}
              onBlur={this._onBlur}
              style={{
                ..._inputStyle,
                ...(showAddButton ? {width: this.state.isFocused ? 10 : 0} : {flexGrow: 1}),
              }}
              placeholder={userItems.length ? '' : placeholder}
              value={usernameText}
              onChangeText={onChangeText}
              onSubmitEditing={onAddSelectedUser}
              returnKeyType="next"
            />
            {showAddButton &&
              onClickAddButton &&
              <Icon
                onClick={onClickAddButton}
                type="iconfont-add"
                style={{
                  fontSize: 16,
                  height: 16,
                  color: globalColors.blue,
                }}
              />}
          </Box>
          {onClearSearch &&
            <Icon
              type="iconfont-remove"
              style={{height: 16, width: 16, marginRight: 16}}
              onClick={onClearSearch}
            />}
        </Box>
      </ClickableBox>
    )
  }
}

const _pillStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 24,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 1,
  paddingRight: 1,
  borderRadius: 2,
}

const _pillTextStyle = {
  fontSize: 14,
  lineHeight: 20,
  height: 22,
}

const _inputStyle = {
  ...getTextStyle('Body'),
  fontSize: 14,
  color: globalColors.black_75,
  lineHeight: 20,
  height: 22,
  paddingTop: 2,
  paddingBottom: 2,
}

export default UserInput
