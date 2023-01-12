import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as ChatConstants from '../../../constants/chat2'
import {EmojiPickerDesktop} from '../../../chat/emoji-picker/container'
import type {RenderableEmoji} from '../../../util/emoji'

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
  publicMemoOverride?: string
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

  _insertEmoji = (emojiStr: string, renderableEmoji: RenderableEmoji) => {
    if (this._note.current) {
      const emoji = renderableEmoji.unicodeStock ?? emojiStr
      const noteInput = this._note.current
      const selection = noteInput.getSelection()
      if (!selection) {
        return
      }
      // this.state is likely unsafe but afraid to change this now
      const secretNote =
        // eslint-disable-next-line
        this.state.secretNote.slice(0, selection.start || 0) +
        emoji +
        // eslint-disable-next-line
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
                <EmojiPickerDesktop
                  disableCustomEmoji={true}
                  conversationIDKey={ChatConstants.noConversationIDKey}
                  onPickAction={this._insertEmoji}
                  onDidPick={this._emojiPickerToggle}
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
                style={styles.emojiIcon}
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
            padding={0}
            placeholder="Add a public memo (on Stellar)"
            style={this.props.publicMemoOverride ? styles.inputDisabled : styles.input}
            rowsMin={Styles.isMobile ? 1 : 2}
            rowsMax={6}
            onChangeText={this._onChangePublicMemo}
            disabled={!!this.props.publicMemoOverride}
            value={this.props.publicMemoOverride || this.state.publicMemo}
            maxBytes={this.props.maxLength}
          />
          {!!this.state.publicMemo && (
            <Kb.Text type="BodyTiny">
              {this.props.maxLength - Buffer.byteLength(this.state.publicMemo)} characters left
            </Kb.Text>
          )}
          {!!this.props.publicMemoOverride && (
            <Kb.Text type="BodyTiny">This memo was provided by the recipient and cannot be changed.</Kb.Text>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
      input: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.white,
          color: Styles.globalColors.black_on_white,
        },
        isElectron: {
          // Line height change is so that emojis (unicode characters inside
          // textarea) are not clipped at the top. This change is accompanied by
          // a change in padding to offset the increased line height
          lineHeight: '22px',
        },
      }),
      inputDisabled: {
        backgroundColor: Styles.globalColors.white,
        color: Styles.globalColors.greyDarker,
      },
    } as const)
)

export {SecretNote, PublicMemo}
