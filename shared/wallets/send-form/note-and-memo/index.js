// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {}

const NoteAndMemo = (props: Props) => (
  <React.Fragment>
    <Kb.PlainInput
      multiline={true}
      placeholder="Add an encrypted note"
      placeholderColor={placeholderColor}
      style={styles.encryptedNote}
    />
    <Kb.Divider />
    <Kb.PlainInput
      multiline={true}
      placeholder="Add a public memo"
      placeholderColor={placeholderColor}
      style={styles.publicMemo}
    />
    <Kb.Divider />
  </React.Fragment>
)

const placeholderColor = Styles.globalColors.black_20

const sharedStyles = {
  width: '100%',
  color: Styles.globalColors.black_75,
  paddingTop: Styles.globalMargins.xsmall,
  paddingBottom: Styles.globalMargins.xsmall,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
}

const styles = Styles.styleSheetCreate({
  encryptedNote: {
    ...sharedStyles,
    minHeight: 68,
  },
  publicMemo: {
    ...sharedStyles,
    minHeight: 40,
  },
})

export default NoteAndMemo
