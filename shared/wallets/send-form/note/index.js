// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {}

const Note = (props: Props) => (
  <React.Fragment>
    <Kb.PlainInput
      multiline={true}
      placeholder="Add a public memo"
      placeholderColor={Styles.globalColors.black_20}
      style={styles.input}
    />
    <Kb.Divider />
  </React.Fragment>
)

const styles = Styles.styleSheetCreate({
  input: {
    width: '100%',
    color: Styles.globalColors.black_75,
    paddingTop: Styles.globalMargins.xsmall,
    paddingBottom: Styles.globalMargins.xsmall,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
})

export default Note
