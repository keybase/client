import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  onCancel: () => void
  onDeleteHistory: () => void
}

const DeleteHistoryWarning = ({onCancel, onDeleteHistory}: Props) => (
  <Kb.MaybePopup onClose={onCancel}>
    {Styles.isMobile && <Kb.HeaderHocHeader onCancel={onCancel} />}
    <Kb.Box
      style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, styles.padding, styles.box] as const)}
    >
      <Kb.Icon type={Styles.isMobile ? 'icon-message-deletion-64' : 'icon-message-deletion-48'} />
      <Kb.Text style={{padding: Styles.globalMargins.small}} type="Header">
        Delete conversation history?
      </Kb.Text>
      <Kb.Text center={Styles.isMobile} style={styles.text} type="Body">
        You are about to delete all the messages in this conversation. For everyone.
      </Kb.Text>
      <Kb.Box style={styles.buttonBox}>
        <Kb.Button
          type="Dim"
          style={styles.button}
          onClick={onCancel}
          label="Cancel"
          fullWidth={Styles.isMobile}
        />
        <Kb.Button
          type="Danger"
          style={styles.button}
          onClick={onDeleteHistory}
          label="Yes, clear for everyone"
          fullWidth={Styles.isMobile}
        />
      </Kb.Box>
    </Kb.Box>
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Styles.globalColors.white,
          justifyContent: 'center',
          padding: Styles.globalMargins.small,
        },
        isMobile: {
          width: '100%',
        },
      }),
      button: Styles.platformStyles({
        isElectron: {marginLeft: Styles.globalMargins.tiny},
        isMobile: {marginTop: Styles.globalMargins.tiny},
      }),
      buttonBox: Styles.platformStyles({
        common: {marginTop: Styles.globalMargins.xlarge},
        isElectron: {...Styles.globalStyles.flexBoxRow},
        isMobile: {
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          flex: 1,
          flexDirection: 'column-reverse',
          paddingTop: Styles.globalMargins.xlarge,
          width: '100%',
        },
      }),
      padding: Styles.platformStyles({
        isElectron: {
          marginBottom: 40,
          marginLeft: 80,
          marginRight: 80,
          marginTop: 40,
        },
        isMobile: {paddingTop: Styles.globalMargins.xlarge},
      }),
      text: {padding: Styles.globalMargins.small},
    } as const)
)

export default DeleteHistoryWarning
