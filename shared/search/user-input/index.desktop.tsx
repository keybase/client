import {trim, last} from 'lodash-es'
import React, {Component} from 'react'
import {Box, Text, Icon} from '../../common-adapters'
import AutosizeInput from './autosize-input.desktop'
import {globalColors, globalMargins, globalStyles, platformStyles, collapseStyles} from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'
import {getStyle as getTextStyle} from '../../common-adapters/text'
import {UserDetails, Props} from '.'

type UserItemProps = UserDetails & {
  onRemoveUser: (id: string) => void
}

class UserItem extends Component<UserItemProps> {
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
          style={platformStyles({
            common: {
              ...followingStateToStyle(followingState),
              lineHeight: 18,
              marginLeft: globalMargins.xtiny,
            },
          })}
        >
          {username}
        </Text>
        <Icon
          type="iconfont-close"
          onClick={this._onRemoveUser}
          style={{marginLeft: globalMargins.tiny}}
          fontSize={11}
        />
      </Box>
    )
  }
}

type State = {
  isFocused: boolean
}

class UserInput extends Component<Props, State> {
  _textInput: AutosizeInput | null = null

  state = {
    isFocused: false,
  }

  focus = () => {
    this._textInput && this._textInput.focus()
  }

  _onFocus = () => {
    this.props.onFocus && this.props.onFocus()
    this.setState({isFocused: true})
  }

  _onBlur = () => {
    this.setState({isFocused: false})
  }

  _onInputKeyDown = ev => {
    const target: HTMLInputElement = ev.target
    if (
      this.props.userItems.length &&
      ev.key === 'Backspace' &&
      target.selectionStart === 0 &&
      target.selectionEnd === 0
    ) {
      const item = last(this.props.userItems)
      item && this.props.onRemoveUser(item.id)
    } else if (ev.key === 'ArrowUp') {
      this.props.onMoveSelectUp()
      ev.preventDefault()
    } else if (ev.key === 'ArrowDown') {
      this.props.onMoveSelectDown()
      ev.preventDefault()
    } else if (
      (ev.key === 'Enter' || ev.key === 'Tab') &&
      !trim(this.props.usernameText) &&
      this.props.onEnterEmptyText
    ) {
      if (this.props.selectedSearchId) {
        this.props.onAddSelectedUser()
      } else {
        this.props.onEnterEmptyText()
      }
    } else if (ev.key === 'Enter' || ev.key === 'Tab' || ev.key === ',') {
      this.props.onAddSelectedUser()
      ev.preventDefault()
    } else if (ev.key === 'Escape') {
      this.props.onCancel && this.props.onCancel()
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
      hideAddButton,
      onChangeText,
      onClearSearch,
      onClickAddButton,
      onRemoveUser,
      placeholder,
      userItems,
      usernameText,
    } = this.props
    const {isFocused} = this.state

    const showAddButton = !!userItems.length && !usernameText.length && onClickAddButton && !hideAddButton
    const inputLeftPadding =
      !!userItems.length && (!!usernameText.length || isFocused) ? globalMargins.xtiny : 0

    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          marginLeft: globalMargins.tiny,
          minHeight: 48,
        }}
      >
        <Box
          style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1, flexWrap: 'wrap'}}
          onClick={this.focus}
          onMouseDown={this._preventInputDefocus}
        >
          {userItems.map(item => (
            <UserItem {...item} onRemoveUser={onRemoveUser} key={item.id} />
          ))}
          <Box style={_inputLineStyle}>
            <AutosizeInput
              autoFocus={autoFocus}
              ref={el => {
                this._textInput = el
              }}
              inputStyle={collapseStyles([_inputStyle, {paddingLeft: inputLeftPadding}])}
              placeholder={userItems.length ? '' : placeholder}
              value={usernameText}
              onChange={onChangeText}
              onKeyDown={this._onInputKeyDown}
              onFocus={this._onFocus}
              onBlur={this._onBlur}
            />
            {showAddButton && onClickAddButton && (
              <Icon
                onClick={onClickAddButton}
                type="iconfont-add"
                style={platformStyles({
                  common: {
                    marginLeft: globalMargins.xtiny,
                  },
                  isElectron: {
                    cursor: 'pointer',
                  },
                })}
                color={globalColors.blue}
                fontSize={12}
              />
            )}
          </Box>
        </Box>
        {onClearSearch && !this.props.hideClearSearch && (
          <Icon
            type="iconfont-remove"
            style={{height: 16, marginRight: globalMargins.tiny, width: 16}}
            onClick={onClearSearch}
          />
        )}
      </Box>
    )
  }
}

const _pillStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.flexBoxCenter,
  borderColor: globalColors.black_10,
  borderRadius: 24,
  borderStyle: 'solid',
  borderWidth: 1,
  height: 24,
  margin: 2,
  marginRight: globalMargins.xtiny,
  paddingBottom: globalMargins.xtiny,
  paddingLeft: globalMargins.xtiny,
  // 2 pixel fudge to accomodate built-in padding to iconfont-close
  paddingRight: globalMargins.tiny - 2,
  paddingTop: globalMargins.xtiny,
}

const _inputLineStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 24,
  marginBottom: 2,
  marginTop: 2,
  overflow: 'hidden',
}

const _inputStyle = platformStyles({
  isElectron: {
    ...getTextStyle('BodySemibold'),
    border: 'none',
    color: globalColors.black,
    flex: 1,
    lineHeight: 22,
    outline: 'none',
    padding: 0,
  },
})

export default UserInput
