// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
// import {backgroundImageFn} from '../../../common-adapters/emoji'
// import {Picker} from 'emoji-mart'

type Props = {
  encryptedNoteError?: string,
  publicMemoError?: string,
  toSelf: boolean,
}

type State = {
  emojiPickerOpen: boolean,
}

class NoteAndMemo extends React.Component<Props, State> {
  // state = {
  //   emojiPickerOpen: false,
  // }
  // _emojiIcon = React.createRef()
  // _note = React.createRef()

  // _insertEmoji = (emoji: string) => {
  //   console.log(this._note)
  //   if (this._note.current !== null) {
  //     this._note.current.setValue(this._note.current.getValue() + emoji)
  //   }
  // }

  // _emojiPickerToggle = () => {
  //   this.setState(({emojiPickerOpen}) => ({emojiPickerOpen: !emojiPickerOpen}))
  // }

  // _emojiPickerOnClick = emoji => {
  //   this._insertEmoji(emoji.native)
  //   this._emojiPickerToggle()
  // }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {/* Encrypted Note */}
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.PlainInput
            multiline={true}
            placeholder={this.props.toSelf ? 'Add a note to yourself' : 'Add an encrypted note'}
            placeholderColor={placeholderColor}
            rowsMin={1}
            rowsMax={12}
            style={styles.encryptedNote}
          />
          {!Styles.isMobile && (
            <Kb.Icon
              boxStyle={
                styles.emojiIcon // onClick={this._emojiPickerToggle}
              }
              style={Kb.iconCastPlatformStyles(styles.emojiIcon)}
              type="iconfont-emoji"
            />
          )}
          {/* {this.state.emojiPickerOpen &&
            !Styles.isMobile && (
              <Kb.FloatingBox
                attachTo={this._emojiIcon.current}
                position="bottom left"
                onHidden={() => this.setState({emojiPickerOpen: false})}
              >
                <Picker
                  autoFocus={true}
                  emoji="star-struck"
                  title="reacjibase"
                  onClick={this._emojiPickerOnClick}
                  backgroundImageFn={backgroundImageFn}
                />
              </Kb.FloatingBox>
            )} */}
        </Kb.Box2>
        {!!this.props.encryptedNoteError && (
          <Kb.Text type="Body" style={styles.errorMessage}>
            {this.props.encryptedNoteError}
          </Kb.Text>
        )}
        <Kb.Divider style={this.props.encryptedNoteError ? styles.dividerError : undefined} />
        {/* Public Memo */}
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.PlainInput
            multiline={true}
            placeholder="Add a public memo"
            placeholderColor={placeholderColor}
            style={styles.publicMemo}
            rowsMin={1}
            rowsMax={6}
          />
        </Kb.Box2>
        {!!this.props.publicMemoError && (
          <Kb.Text type="Body" style={styles.errorMessage}>
            {this.props.publicMemoError}
          </Kb.Text>
        )}
        <Kb.Divider style={this.props.publicMemoError ? styles.dividerError : undefined} />
      </Kb.Box2>
    )
  }
}

const placeholderColor = Styles.globalColors.black_20

const sharedStyles = {
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
  paddingTop: Styles.globalMargins.tiny,
  paddingBottom: Styles.globalMargins.tiny,
  color: Styles.globalColors.black_75,
}

const styles = Styles.styleSheetCreate({
  emojiIcon: {
    alignSelf: 'flex-end',
    marginBottom: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
  errorMessage: {
    ...sharedStyles,
    color: Styles.globalColors.red,
  },
  dividerError: {
    backgroundColor: Styles.globalColors.red,
  },
  encryptedNote: Styles.platformStyles({
    common: {
      ...sharedStyles,
    },
    isElectron: {
      minHeight: 68,
      paddingRight: Styles.globalMargins.xtiny,
    },
    isMobile: {
      minHeight: 58,
    },
  }),
  publicMemo: Styles.platformStyles({
    common: {
      ...sharedStyles,
    },
    isElectron: {
      minHeight: 40,
    },
    isMobile: {
      minHeight: 48,
    },
  }),
  emojiPickerContainer: Styles.platformStyles({
    common: {
      borderRadius: 4,
      bottom: 34,
      position: 'absolute',
      right: -22,
    },
    isElectron: {
      boxShadow: `0 0 8px 0 ${Styles.globalColors.black_20}`,
    },
  }),
  emojiPickerContainerWrapper: {
    ...Styles.globalStyles.fillAbsolute,
  },
  emojiPickerRelative: {
    position: 'relative',
  },
})

export default NoteAndMemo
