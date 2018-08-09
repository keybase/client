// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {Picker} from 'emoji-mart'

type Props = {
  encryptedNoteError?: string,
  publicMemoError?: string,
}

type State = {
  emojiPickerOpen: boolean,
}

class NoteAndMemo extends React.Component<Props, State> {
  state = {
    emojiPickerOpen: false,
  }
  _emojiIcon = React.createRef()

  _emojiPickerToggle = () => {
    this.setState(({emojiPickerOpen}) => ({emojiPickerOpen: !emojiPickerOpen}))
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.encryptedNoteContainer}>
          <Kb.PlainInput
            multiline={true}
            placeholder="Add an encrypted note"
            placeholderColor={placeholderColor}
            style={sharedStyles}
            rowsMin={1}
            rowsMax={12}
          />
          <Kb.Icon
            onClick={this._emojiPickerToggle}
            boxStyle={styles.emojiIconContainer}
            style={Kb.iconCastPlatformStyles(styles.emojiIcon)}
            type="iconfont-emoji"
            ref={this._emojiIcon}
          />
          {this.state.emojiPickerOpen &&
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
                  onClick={() => console.log('clicked!')}
                  // backgroundImageFn={backgroundImageFn}
                />
              </Kb.FloatingBox>
            )}
        </Kb.Box2>
        {!!this.props.encryptedNoteError && (
          <Kb.Text type="Body" style={styles.errorMessage}>
            {this.props.encryptedNoteError}
          </Kb.Text>
        )}
        <Kb.Divider style={this.props.encryptedNoteError ? styles.dividerError : undefined} />
        <Kb.PlainInput
          multiline={true}
          placeholder="Add a public memo"
          placeholderColor={placeholderColor}
          style={styles.publicMemo}
          rowsMin={1}
          rowsMax={6}
        />
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
  width: '100%',
  color: Styles.globalColors.black_75,
  paddingTop: Styles.globalMargins.xsmall,
  paddingBottom: Styles.globalMargins.xsmall,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.xtiny,
}

const styles = Styles.styleSheetCreate({
  container: {
    flex: 1,
  },
  emojiIconContainer: {
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
  encryptedNoteContainer: {
    minHeight: 68,
  },
  publicMemo: {
    ...sharedStyles,
    minHeight: 40,
  },

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
