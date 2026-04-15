import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'

const DeleteHistoryWarning = () => {
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }
  const clearModals = C.Router2.clearModals
  const messageDeleteHistory = ConvoState.useChatContext(s => s.dispatch.messageDeleteHistory)
  const onDeleteHistory = () => {
    clearModals()
    messageDeleteHistory()
  }

  return (
    <>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([
          styles.padding,
          styles.box,
        ])}
      >
        <Kb.ImageIcon type={Kb.Styles.isMobile ? 'icon-message-deletion-64' : 'icon-message-deletion-48'} />
        <Kb.Text style={{padding: Kb.Styles.globalMargins.small}} type="Header">
          Delete conversation history?
        </Kb.Text>
        <Kb.Text center={Kb.Styles.isMobile} style={styles.text} type="Body">
          You are about to delete all the messages in this conversation. For everyone.
        </Kb.Text>
        <Kb.Box2 direction={Kb.Styles.isMobile ? 'verticalReverse' : 'horizontal'} style={styles.buttonBox}>
          <Kb.Button
            type="Dim"
            style={styles.button}
            onClick={onCancel}
            label="Cancel"
            fullWidth={Kb.Styles.isMobile}
          />
          <Kb.Button
            type="Danger"
            style={styles.button}
            onClick={onDeleteHistory}
            label="Yes, clear for everyone"
            fullWidth={Kb.Styles.isMobile}
          />
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.white,
          justifyContent: 'center',
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          width: '100%',
        },
      }),
      button: Kb.Styles.platformStyles({
        isElectron: {marginLeft: Kb.Styles.globalMargins.tiny},
        isMobile: {marginTop: Kb.Styles.globalMargins.tiny},
      }),
      buttonBox: Kb.Styles.platformStyles({
        common: {marginTop: Kb.Styles.globalMargins.xlarge},
        isMobile: {
          flex: 1,
          paddingTop: Kb.Styles.globalMargins.xlarge,
          width: '100%',
        },
      }),
      padding: Kb.Styles.platformStyles({
        isElectron: {
          marginBottom: 40,
          marginLeft: 80,
          marginRight: 80,
          marginTop: 40,
        },
        isMobile: {paddingTop: Kb.Styles.globalMargins.xlarge},
      }),
      text: {padding: Kb.Styles.globalMargins.small},
    }) as const
)

export default DeleteHistoryWarning
