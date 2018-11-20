// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {backgroundImageFn} from '../../../common-adapters/emoji'
import {Picker} from 'emoji-mart'

type SecretNoteProps = {
  secretNote: string, // Initial value only
  secretNoteError?: string,
  onChangeSecretNote: string => void,
  toSelf: boolean,
}

type PublicMemoProps = {
  publicMemo: string, // Initial value only
  publicMemoError?: string,
  onChangePublicMemo: string => void,
}

// TODO use wallet staticConfig to keep in sync with the service
const secretNoteMaxLength = 500
const publicMemoMaxLength = 28
const encoder = new TextEncoder('utf-8')
const getByteLength = s => encoder.encode(s).length

type SecretNoteState = {
  emojiPickerOpen: boolean,
  secretNote: string,
}

type PublicMemoState = {
  publicMemo: string,
}

class SecretNote extends React.Component<SecretNoteProps, SecretNoteState> {
  static defaultProps = {
    toSelf: false,
  }
  state = {
    emojiPickerOpen: false,
    secretNote: this.props.secretNote,
  }
  _emojiIcon = React.createRef()
  _note = React.createRef()

  _onChangeSecretNote = (secretNote: string) => {
    this.props.onChangeSecretNote(secretNote)
    this.setState(s => (s.secretNote === secretNote ? null : {secretNote}))
  }

  _insertEmoji = (emoji: string) => {
    if (this._note.current) {
      const noteInput = this._note.current
      const selection = noteInput.getSelection()
      if (!selection) {
        return
      }
      const secretNote =
        this.state.secretNote.slice(0, selection.start) + emoji + this.state.secretNote.slice(selection.end)
      const newSelection = {start: selection.start + emoji.length, end: selection.start + emoji.length}
      this.props.onChangeSecretNote(secretNote)
      this.setState({secretNote}, () => {
        const noteInput = this._note.current
        if (noteInput) {
          noteInput.setSelection(newSelection)
        }
      })
    }
  }

  _emojiPickerToggle = () => {
    this.setState(({emojiPickerOpen}) => {
      if (emojiPickerOpen && this._note.current) {
        this._note.current.focus()
      }
      return {emojiPickerOpen: !emojiPickerOpen}
    })
  }

  _emojiPickerOnClick = emoji => {
    this._insertEmoji(emoji.native)
    this._emojiPickerToggle()
  }

  render() {
    return (
      <>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.PlainInput
              multiline={true}
              placeholder={`${
                this.props.toSelf ? 'Add a note to yourself' : 'Add an encrypted note'
              } (in Keybase)`}
              placeholderColor={placeholderColor}
              rowsMin={Styles.isMobile ? 2 : 3}
              rowsMax={8}
              style={styles.input}
              ref={!Styles.isMobile ? this._note : undefined}
              onChangeText={this._onChangeSecretNote}
              value={this.state.secretNote}
              maxLength={secretNoteMaxLength}
            />
            {this.state.emojiPickerOpen && !Styles.isMobile && (
              <Kb.Overlay
                attachTo={() => this._emojiIcon.current}
                position="bottom right"
                onHidden={() => this.setState({emojiPickerOpen: false})}
              >
                <Picker
                  autoFocus={true}
                  emoji="star-struck"
                  title="reacjibase"
                  onClick={this._emojiPickerOnClick}
                  backgroundImageFn={backgroundImageFn}
                />
              </Kb.Overlay>
            )}
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.alignItemsCenter}>
            <Kb.Box2 direction="horizontal" style={styles.flexOne}>
              {!!this.state.secretNote && (
                <Kb.Text type="BodySmall">
                  {secretNoteMaxLength - getByteLength(this.state.secretNote)} characters left
                </Kb.Text>
              )}
            </Kb.Box2>
            {!Styles.isMobile && (
              <Kb.Icon
                boxStyle={styles.emojiIcon}
                onClick={this._emojiPickerToggle}
                style={Kb.iconCastPlatformStyles(styles.emojiIcon)}
                type="iconfont-emoji"
                ref={this._emojiIcon}
              />
            )}
          </Kb.Box2>
          {!!this.props.secretNoteError && (
            <Kb.Text type="BodySmallError">{this.props.secretNoteError}</Kb.Text>
          )}
        </Kb.Box2>
        <Divider error={!!this.props.secretNoteError} />
      </>
    )
  }
}

class PublicMemo extends React.Component<PublicMemoProps, PublicMemoState> {
  state = {
    publicMemo: this.props.publicMemo,
  }

  _onChangePublicMemo = (publicMemo: string) => {
    this.props.onChangePublicMemo(publicMemo)
    this.setState(s => (s.publicMemo === publicMemo ? null : {publicMemo}))
  }

  render() {
    return (
      <>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.PlainInput
            multiline={true}
            placeholder="Add a public memo (on Stellar)"
            placeholderColor={placeholderColor}
            style={styles.input}
            rowsMin={Styles.isMobile ? 1 : 2}
            rowsMax={6}
            onChangeText={this._onChangePublicMemo}
            value={this.state.publicMemo}
            maxLength={publicMemoMaxLength}
          />
          {!!this.state.publicMemo && (
            <Kb.Text type="BodySmall">
              {publicMemoMaxLength - getByteLength(this.state.publicMemo)} characters left
            </Kb.Text>
          )}
          {!!this.props.publicMemoError && (
            <Kb.Text type="BodySmallError">{this.props.publicMemoError}</Kb.Text>
          )}
        </Kb.Box2>
        <Divider error={!!this.props.publicMemoError} />
      </>
    )
  }
}

const Divider = ({error}: {error: boolean}) => (
  <Kb.Divider style={error ? Styles.collapseStyles([styles.divider, styles.dividerError]) : styles.divider} />
)

const placeholderColor = Styles.globalColors.black_20

const styles = Styles.styleSheetCreate({
  alignItemsCenter: {
    alignItems: 'center',
  },
  container: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.tiny,
  },
  divider: {
    marginTop: Styles.globalMargins.tiny,
  },
  dividerError: {
    backgroundColor: Styles.globalColors.red,
  },
  emojiIcon: {
    alignSelf: 'flex-end',
  },
  flexOne: {
    flex: 1,
  },
  input: {
    color: Styles.globalColors.black_75_on_white,
    padding: 0,
  },
})

export {SecretNote, PublicMemo}
