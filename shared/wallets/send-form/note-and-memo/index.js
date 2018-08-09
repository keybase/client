// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  encryptedNoteError?: string,
  publicMemoError?: string,
}

const NoteAndMemo = (props: Props) => (
  <Kb.ScrollView style={styles.container}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.encryptedNoteContainer}>
      <Kb.PlainInput
        multiline={true}
        placeholder="Add an encrypted note"
        placeholderColor={placeholderColor}
        style={sharedStyles}
      />
      <Kb.Icon
        // color={this.state.emojiPickerOpen ? globalColors.black_75 : null}
        onClick={() => {}}
        boxStyle={styles.emojiIconContainer}
        style={Kb.iconCastPlatformStyles(styles.emojiIcon)}
        type="iconfont-emoji"
      />
    </Kb.Box2>
    {!!props.encryptedNoteError && (
      <Kb.Text type="Body" style={styles.errorMessage}>
        {props.encryptedNoteError}
      </Kb.Text>
    )}
    <Kb.Divider style={props.encryptedNoteError ? styles.dividerError : undefined} />
    <Kb.PlainInput
      multiline={true}
      placeholder="Add a public memo"
      placeholderColor={placeholderColor}
      style={styles.publicMemo}
    />
    {!!props.publicMemoError && (
      <Kb.Text type="Body" style={styles.errorMessage}>
        {props.publicMemoError}
      </Kb.Text>
    )}
    <Kb.Divider style={props.publicMemoError ? styles.dividerError : undefined} />
  </Kb.ScrollView>
)

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
})

export default NoteAndMemo
