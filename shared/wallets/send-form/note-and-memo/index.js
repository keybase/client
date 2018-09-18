// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {backgroundImageFn} from '../../../common-adapters/emoji'
import {Picker} from 'emoji-mart'

type Props = {
  memoError?: string,
  noteError?: string,
  onChangePublicMemo: string => void,
  onChangeSecretNote: string => void,
  toSelf: boolean,
}

type State = {
  emojiPickerOpen: boolean,
}

class NoteAndMemo extends React.Component<Props, State> {
  static defaultProps = {
    toSelf: false,
  }
  state = {
    emojiPickerOpen: false,
  }
  _emojiIcon = React.createRef()
  _note = React.createRef()

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
              onChangeText={this.props.onChangeSecretNote}
              placeholder={this.props.toSelf ? 'Add a note to yourself' : 'Add an encrypted note'}
              placeholderColor={placeholderColor}
              rowsMin={Styles.isMobile ? 2 : 3}
              rowsMax={12}
              style={styles.input}
              ref={!Styles.isMobile ? this._note : undefined}
            />
            {!Styles.isMobile && (
              <Kb.Icon
                boxStyle={styles.emojiIcon}
                onClick={this._emojiPickerToggle}
                style={Kb.iconCastPlatformStyles(styles.emojiIcon)}
                type="iconfont-emoji"
                ref={this._emojiIcon}
              />
            )}
            {this.state.emojiPickerOpen &&
              !Styles.isMobile && (
                <Kb.Overlay
                  attachTo={this._emojiIcon.current}
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
          {!!this.props.noteError && <Kb.Text type="BodySmallError">{this.props.noteError}</Kb.Text>}
        </Kb.Box2>
        <Kb.Divider
          style={Styles.collapseStyles([
            styles.divider,
            this.props.noteError ? {backgroundColor: Styles.globalColors.red} : {},
          ])}
        />
        {/* Public Memo */}
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.PlainInput
            multiline={true}
            onChangeText={this.props.onChangePublicMemo}
            placeholder="Add a public memo"
            placeholderColor={placeholderColor}
            style={styles.input}
            rowsMin={Styles.isMobile ? 1 : 2}
            rowsMax={6}
          />
          {!!this.props.memoError && <Kb.Text type="BodySmallError">{this.props.memoError}</Kb.Text>}
        </Kb.Box2>
        <Kb.Divider
          style={Styles.collapseStyles([
            styles.divider,
            this.props.memoError ? {backgroundColor: Styles.globalColors.red} : {},
          ])}
        />
      </Kb.Box2>
    )
  }
}

const placeholderColor = Styles.globalColors.black_20

const styles = Styles.styleSheetCreate({
  container: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.tiny,
  },
  emojiIcon: {
    alignSelf: 'flex-end',
  },
  divider: {
    marginTop: Styles.globalMargins.tiny,
  },
  dividerError: {
    backgroundColor: Styles.globalColors.red,
  },
  input: {
    color: Styles.globalColors.black_75,
    padding: 0,
  },
})

export default NoteAndMemo
