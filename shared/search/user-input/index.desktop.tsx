import {trim, last} from 'lodash-es'
import React, {Component} from 'react'
import AutosizeInput from './autosize-input.desktop'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
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
      <Kb.Box style={styles.pill}>
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
        <Kb.Text
          type="BodySemibold"
          style={Styles.platformStyles({
            common: {
              ...followingStateToStyle(followingState),
              lineHeight: 18,
              marginLeft: Styles.globalMargins.xtiny,
            },
          })}
        >
          {username}
        </Kb.Text>
        <Kb.Icon
          type="iconfont-close"
          onClick={this._onRemoveUser}
          style={{marginLeft: Styles.globalMargins.tiny}}
          fontSize={11}
        />
      </Kb.Box>
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
      !!userItems.length && (!!usernameText.length || isFocused) ? Styles.globalMargins.xtiny : 0

    return (
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          marginLeft: Styles.globalMargins.tiny,
          minHeight: 48,
        }}
      >
        <Kb.Box
          style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', flex: 1, flexWrap: 'wrap'}}
          onClick={this.focus}
          onMouseDown={this._preventInputDefocus}
        >
          {userItems.map(item => (
            <UserItem {...item} onRemoveUser={onRemoveUser} key={item.id} />
          ))}
          <Kb.Box style={styles.inputLine}>
            <AutosizeInput
              autoFocus={autoFocus}
              ref={el => {
                this._textInput = el
              }}
              inputStyle={Styles.collapseStyles([styles.input, {paddingLeft: inputLeftPadding}])}
              placeholder={userItems.length ? '' : placeholder}
              value={usernameText}
              onChange={onChangeText}
              onKeyDown={this._onInputKeyDown}
              onFocus={this._onFocus}
              onBlur={this._onBlur}
            />
            {showAddButton && onClickAddButton && (
              <Kb.Icon
                onClick={onClickAddButton}
                type="iconfont-add"
                style={Styles.platformStyles({
                  common: {
                    marginLeft: Styles.globalMargins.xtiny,
                  },
                  isElectron: {
                    cursor: 'pointer',
                  },
                })}
                color={Styles.globalColors.blue}
                fontSize={12}
              />
            )}
          </Kb.Box>
        </Kb.Box>
        {onClearSearch && !this.props.hideClearSearch && (
          <Kb.Icon
            type="iconfont-remove"
            style={{height: 16, marginRight: Styles.globalMargins.tiny, width: 16}}
            onClick={onClearSearch}
          />
        )}
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      input: Styles.platformStyles({
        isElectron: {
          ...getTextStyle('BodySemibold'),
          border: 'none',
          color: Styles.globalColors.black,
          flex: 1,
          lineHeight: 22,
          outline: 'none',
          padding: 0,
        },
      }),
      inputLine: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 24,
        marginBottom: 2,
        marginTop: 2,
        overflow: 'hidden',
      },
      pill: {
        ...Styles.globalStyles.flexBoxRow,
        ...Styles.globalStyles.flexBoxCenter,
        borderColor: Styles.globalColors.black_10,
        borderRadius: 24,
        borderStyle: 'solid',
        borderWidth: 1,
        height: 24,
        margin: 2,
        marginRight: Styles.globalMargins.xtiny,
        paddingBottom: Styles.globalMargins.xtiny,
        paddingLeft: Styles.globalMargins.xtiny,
        // 2 pixel fudge to accomodate built-in padding to iconfont-close
        paddingRight: Styles.globalMargins.tiny - 2,
        paddingTop: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default UserInput
