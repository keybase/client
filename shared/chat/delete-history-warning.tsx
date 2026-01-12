import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import MaybePopup from './maybe-popup'

const DeleteHistoryWarning = () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const messageDeleteHistory = Chat.useChatContext(s => s.dispatch.messageDeleteHistory)
  const onDeleteHistory = () => {
    clearModals()
    messageDeleteHistory()
  }

  return (
    <MaybePopup onClose={onCancel}>
      {Kb.Styles.isMobile && <Kb.HeaderHocHeader onCancel={onCancel} />}
      <Kb.Box
        style={Kb.Styles.collapseStyles([
          Kb.Styles.globalStyles.flexBoxColumn,
          styles.padding,
          styles.box,
        ] as const)}
      >
        <Kb.Icon type={Kb.Styles.isMobile ? 'icon-message-deletion-64' : 'icon-message-deletion-48'} />
        <Kb.Text style={{padding: Kb.Styles.globalMargins.small}} type="Header">
          Delete conversation history?
        </Kb.Text>
        <Kb.Text center={Kb.Styles.isMobile} style={styles.text} type="Body">
          You are about to delete all the messages in this conversation. For everyone.
        </Kb.Text>
        <Kb.Box style={styles.buttonBox}>
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
        </Kb.Box>
      </Kb.Box>
    </MaybePopup>
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
        isElectron: {...Kb.Styles.globalStyles.flexBoxRow},
        isMobile: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          flex: 1,
          flexDirection: 'column-reverse',
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
