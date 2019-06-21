import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  encryptedNote?: string
  publicMemo?: string
}

const NoteAndMemo = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {!!props.encryptedNote && (
      <React.Fragment>
        <Kb.Divider />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
          <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
            Encrypted note
          </Kb.Text>
          <Kb.Text selectable={true} type="Body" style={styles.bodyText}>
            {props.encryptedNote}
          </Kb.Text>
        </Kb.Box2>
      </React.Fragment>
    )}
    {!!props.publicMemo && (
      <React.Fragment>
        <Kb.Divider />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
          <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
            Public note
          </Kb.Text>
          <Kb.Text selectable={true} type="Body" style={styles.bodyText}>
            {props.publicMemo}
          </Kb.Text>
        </Kb.Box2>
      </React.Fragment>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  bodyText: Styles.platformStyles({
    common: {color: Styles.globalColors.black},
    isElectron: {wordBreak: 'break-word'},
  }),
  headingText: {
    color: Styles.globalColors.blueDark,
    marginBottom: Styles.globalMargins.xtiny,
  },
  memoContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default NoteAndMemo
