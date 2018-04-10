// @flow
import {last} from 'lodash-es'
import React, {Component} from 'react'
import {TextInput, Animated} from 'react-native'
import {Box, Text, Icon, ClickableBox} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, platformStyles} from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'
import {getStyle as getTextStyle} from '../../common-adapters/text'

import type {UserDetails, Props} from './'

type UserItemProps = UserDetails & {onRemoveUser: (id: string) => void}
type UserItemState = {isSelected: boolean, selectAnim: Animated.Value}

class UserItem extends Component<UserItemProps, UserItemState> {
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
              style={[
                _pillTextStyle,
                usernameStyle,
                globalStyles.fontSemibold,
                {
                  color: selectAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [usernameStyle.color, globalColors.white],
                  }),
                  marginLeft: 3,
                },
              ]}
            >
              {username}
            </Animated.Text>
          </Animated.View>
        </ClickableBox>
        <Text
          type="BodySemibold"
          style={[
            _pillTextStyle,
            {
              color: globalColors.black_20,
            },
          ]}
        >
          ,
        </Text>
        {/* We can't listen to keyboard events in RN Android, so instead we
            create an offscreen text input with a single space character and
            observe it being removed when the value changes. */}
        {isSelected && (
          <TextInput
            autoFocus={true}
            onBlur={this._onDeselect}
            onChangeText={this._onChangeText}
            value=" "
            underlineColorAndroid="transparent"
            style={{position: 'absolute', left: -9999}}
          />
        )}
      </Box>
    )
  }
}

type State = {isFocused: boolean, selectionStart: ?number, selectionEnd: ?number}

const ZERO_WIDTH_SPACE = '\u200B'

class UserInput extends Component<Props, State> {
  _textInput: TextInput

  state = {
    isFocused: false,
    selectionStart: null,
    selectionEnd: null,
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

  _onChangeText = text => {
    if (text.charAt(0) !== ZERO_WIDTH_SPACE && this.props.userItems.length) {
      // Backspace key detected when the zero width space is removed (we use
      // this hack because detecting soft backspace is really tricky on
      // Android).
      this.props.onRemoveUser(last(this.props.userItems).id)
      return
    }
    this.props.onChangeText(text.replace(ZERO_WIDTH_SPACE, ''))
  }

  _onSelectionChange = ({nativeEvent: {selection: {start, end}}}) => {
    this.setState({selectionStart: start, selectionEnd: end})
  }

  _onRemoveUser = (username: string) => {
    this.props.onRemoveUser(username)
    this.focus()
  }

  render() {
    const {autoFocus, placeholder, userItems, usernameText, onClickAddButton, onAddSelectedUser} = this.props

    const {isFocused, selectionStart, selectionEnd} = this.state

    // Force cursor to be after zero width space so backspace key deletes it.
    // This fixes tricksy edge cases where the user moves the cursor to the
    // left end of the input via drag or arrow key interactions. Note: Android
    // RN crashes if we set the selection to 1 before the value is updated to
    // include the zero width space.
    const clampedSelection =
      selectionStart === null
        ? null
        : {start: Math.max(1, selectionStart || 1), end: Math.max(1, selectionEnd || 1)}

    const showAddButton = !!userItems.length && !usernameText.length && onClickAddButton
    return (
      <ClickableBox feedback={false} onClick={this.focus}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'center',
            flexWrap: 'wrap',
            minHeight: 40,
            marginLeft: globalMargins.xtiny,
          }}
        >
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
              value={isFocused ? ZERO_WIDTH_SPACE + usernameText : usernameText}
              selection={clampedSelection}
              onChangeText={this._onChangeText}
              onSelectionChange={this._onSelectionChange}
              onSubmitEditing={onAddSelectedUser}
              underlineColorAndroid="transparent"
              returnKeyType="next"
            />
            {showAddButton &&
              onClickAddButton && (
                <Icon
                  onClick={onClickAddButton}
                  type="iconfont-add"
                  style={{
                    fontSize: 16,
                    height: 16,
                    color: globalColors.blue,
                  }}
                />
              )}
          </Box>
        </Box>
      </ClickableBox>
    )
  }
}

const _pillStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderRadius: 2,
  height: 24,
  paddingBottom: 2,
  paddingLeft: 1,
  paddingRight: 1,
  paddingTop: 2,
}

const _pillTextStyle = platformStyles({
  isMobile: {
    fontSize: 14,
    height: 22,
    lineHeight: 20,
  },
})

const _inputStyle = platformStyles({
  isMobile: {
    ...getTextStyle('BodySemibold'),
    color: globalColors.black_75,
    fontWeight: '600',
    height: 22,
    lineHeight: 20,
    paddingBottom: 2,
    paddingTop: 2,
  },
})

export default UserInput
