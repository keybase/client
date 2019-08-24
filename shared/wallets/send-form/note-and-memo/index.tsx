import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {backgroundImageFn} from '../../../common-adapters/emoji'
import {Picker} from 'emoji-mart'

type SecretNoteProps = {
  secretNote: string // Initial value only
  secretNoteError?: string
  onChangeSecretNote: (note: string) => void
  toSelf: boolean
  maxLength: number
}

type PublicMemoProps = {
  publicMemo: string // Initial value only
  publicMemoError?: string
  onChangePublicMemo: (memo: string) => void
  maxLength: number
}

type SecretNoteState = {
  emojiPickerOpen: boolean
  secretNote: string
}

type PublicMemoState = {
  publicMemo: string
}

class SecretNote extends React.Component<SecretNoteProps, SecretNoteState> {
  static defaultProps = {
    toSelf: false,
  }
  state = {
    emojiPickerOpen: false,
    secretNote: this.props.secretNote,
  }
  _emojiIcon = React.createRef<Kb.Icon>()
  _note = React.createRef<Kb.PlainInput>()

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
        this.state.secretNote.slice(0, selection.start || 0) +
        emoji +
        this.state.secretNote.slice(selection.end || 0)
      if (Buffer.byteLength(secretNote) > this.props.maxLength) {
        return
      }
      const newSelection = {
        end: (selection.start || 0) + emoji.length,
        start: (selection.start || 0) + emoji.length,
      }
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
              maxBytes={this.props.maxLength}
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
                <Kb.Text type="BodyTiny">
                  {this.props.maxLength - Buffer.byteLength(this.state.secretNote)} characters left
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
            maxBytes={this.props.maxLength}
          />
          {!!this.state.publicMemo && (
            <Kb.Text type="BodyTiny">
              {this.props.maxLength - Buffer.byteLength(this.state.publicMemo)} characters left
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
    marginTop: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  divider: {
    marginTop: Styles.globalMargins.tiny,
  },
  dividerError: {
    backgroundColor: Styles.globalColors.red,
  },
  emojiIcon: {
    alignSelf: 'flex-end',
    marginTop: 1, // otherwise top is cut off w/ long note
  },
  flexOne: {
    flex: 1,
  },
  input: {
    color: Styles.globalColors.black_on_white,
    padding: 0,
  },
})

export {SecretNote, PublicMemo}
