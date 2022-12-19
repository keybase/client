import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  encryptedNote?: string
  publicMemo?: string
}

const NoteAndMemo = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {!!props.encryptedNote && (
      <>
        <Kb.Divider />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
          <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
            Encrypted note
          </Kb.Text>
          <Kb.Text selectable={true} type="Body" style={styles.bodyText}>
            {props.encryptedNote}
          </Kb.Text>
        </Kb.Box2>
      </>
    )}
    {!!props.publicMemo && (
      <>
        <Kb.Divider />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
          <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
            Public memo
          </Kb.Text>
          <Kb.Text selectable={true} type="Body" style={styles.bodyText}>
            {props.publicMemo}
          </Kb.Text>
        </Kb.Box2>
      </>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  bodyText: Styles.platformStyles({
    common: {color: Styles.globalColors.black},
    isElectron: {wordBreak: 'break-word'} as const,
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
}))

export default NoteAndMemo
