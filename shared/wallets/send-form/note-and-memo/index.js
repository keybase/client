// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {backgroundImageFn} from '../../../common-adapters/emoji'
import {Picker} from 'emoji-mart'

type Props = {
  publicMemo: string, // Initial value only
  publicMemoError?: string,
  secretNote: string, // Initial value only
  secretNoteError?: string,
  onChangePublicMemo: string => void,
  onChangeSecretNote: string => void,
  toSelf: boolean,
}

// TODO use wallet staticConfig to keep in sync with the service
const secretNoteMaxLength = 500
const publicMemoMaxLength = 28

type State = {
  emojiPickerOpen: boolean,
  publicMemo: string,
  secretNote: string,
}
class NoteAndMemo extends React.Component<Props, State> {
  static defaultProps = {
    toSelf: false,
  }
  state = {
    emojiPickerOpen: false,
    publicMemo: this.props.publicMemo,
    secretNote: this.props.secretNote,
  }
  _emojiIcon = React.createRef()
  _note = React.createRef()

  _onChangeSecretNote = (secretNote: string) => {
    this.props.onChangeSecretNote(secretNote)
    this.setState(s => (s.secretNote === secretNote ? null : {secretNote}))
  }
  _onChangePublicMemo = (publicMemo: string) => {
    this.props.onChangePublicMemo(publicMemo)
    this.setState(s => (s.publicMemo === publicMemo ? null : {publicMemo}))
  }

  _insertEmoji = (emoji: string) => {
    if (this._note.current) {
      this._note.current.transformText(({text, selection}) => {
        const newText = text.slice(0, selection.start) + emoji + text.slice(selection.end)
        const pos = selection.start + 1
        return {text: newText, selection: {start: pos, end: pos}}
      }, true)
    }
  }

  _emojiPickerToggle = () => {
    this.setState(({emojiPickerOpen}) => ({emojiPickerOpen: !emojiPickerOpen}))
  }

  _emojiPickerOnClick = emoji => {
    this._insertEmoji(emoji.native)
    this._emojiPickerToggle()
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {/* Encrypted Note */}
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.PlainInput
              multiline={true}
              placeholder={this.props.toSelf ? 'Add a note to yourself' : 'Add an encrypted note'}
              placeholderColor={placeholderColor}
              rowsMin={Styles.isMobile ? 2 : 3}
              rowsMax={8}
              style={styles.input}
              ref={!Styles.isMobile ? this._note : undefined}
              onChangeText={this._onChangeSecretNote}
              value={this.state.secretNote}
              maxLength={secretNoteMaxLength}
            />
            {this.state.emojiPickerOpen &&
              !Styles.isMobile && (
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
                  {secretNoteMaxLength - this.state.secretNote.length} characters left
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
        <Kb.Divider
          style={Styles.collapseStyles([
            styles.divider,
            this.props.secretNoteError ? {backgroundColor: Styles.globalColors.red} : {},
          ])}
        />
        {/* Public Memo */}
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.PlainInput
            multiline={true}
            placeholder="Add a public memo"
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
              {publicMemoMaxLength - this.state.publicMemo.length} characters left
            </Kb.Text>
          )}
          {!!this.props.publicMemoError && (
            <Kb.Text type="BodySmallError">{this.props.publicMemoError}</Kb.Text>
          )}
        </Kb.Box2>
        <Kb.Divider
          style={Styles.collapseStyles([
            styles.divider,
            this.props.publicMemoError ? {backgroundColor: Styles.globalColors.red} : {},
          ])}
        />
      </Kb.Box2>
    )
  }
}

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
    color: Styles.globalColors.black_75,
    padding: 0,
  },
})

export default NoteAndMemo
